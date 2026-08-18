/**
 * Claude-Stufe (Stufe 2) der Video-Analyse — der „Analyst" der Pipeline.
 *
 * Bekommt die rohen Gemini-Beobachtungen (A + B) plus die bestehende DNA und
 * liefert die eigentliche Bewertung nach Fragenkatalog:
 *   C — qualitative Befunde auf die 9 DNA-Kategorien gemappt
 *   D — Stil, Scores, Top-Listen, Gefahrenprofil
 *   E — Merge-Vorschlag (confirms / contradicts / weight)
 *
 * Structured Outputs (JSON-Schema) garantieren, dass das Ergebnis exakt in
 * unser Datenmodell (VideoEvaluation) passt. API-Key: ANTHROPIC_API_KEY.
 */

import Anthropic from "@anthropic-ai/sdk";
import { GEMINI_MODELS, geminiGenerateJson, parseModelJson } from "./gemini";
import { DNA_CATEGORIES } from "../gegner-dna";
import { cleanActionStats, cleanDnaSplit, isDnaSplitEmpty } from "../fight-stats";
import type {
  AnalysisMode,
  AnalysisUsage,
  FighterDescription,
  VideoEvaluation,
  VideoObservation,
} from "../video-analysis";
import type { ActionStat, DnaSplit } from "../fight-stats";

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-opus-5";

/**
 * Listenpreise in USD pro 1M Token [Input, Output] — für die Guthaben-Anzeige
 * als EUR ≈ 1:1 gerechnet (Schätzung, kein exakter Kontostand).
 */
function priceFor(model: string): [number, number] {
  if (model.includes("opus")) return [5, 25];
  if (model.includes("sonnet")) return [3, 15];
  if (model.includes("haiku")) return [1, 5];
  return [0, 0];
}

function computeUsage(
  model: string,
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  },
): AnalysisUsage {
  const [inRate, outRate] = priceFor(model);
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const inputTokens = usage.input_tokens + cacheWrite + cacheRead;
  const costEur =
    (usage.input_tokens * inRate +
      cacheWrite * inRate * 1.25 +
      cacheRead * inRate * 0.1 +
      usage.output_tokens * outRate) /
    1_000_000;
  return {
    inputTokens,
    outputTokens: usage.output_tokens,
    costEur: Math.round(costEur * 10000) / 10000,
    model,
  };
}

// ─── JSON-Schema für Structured Outputs ─────────────────────────────────────

const str = { type: "string" } as const;
const num = { type: "number" } as const;
const nstr = { anyOf: [{ type: "string" }, { type: "null" }] } as const;
const nnum = { anyOf: [{ type: "number" }, { type: "null" }] } as const;
const strArr = { type: "array", items: str } as const;

function obj(properties: Record<string, unknown>) {
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  } as const;
}
function arr(items: unknown) {
  return { type: "array", items } as const;
}
function nullable(schema: unknown) {
  return { anyOf: [schema, { type: "null" }] } as const;
}

const findingSchema = obj({
  questionId: str,
  categoryId: str,
  answer: str,
  confidence: num,
  evidence: strArr,
});

const topEntrySchema = obj({ title: str, reason: str, confidence: num });

const dnaSplitSchema = obj({
  boxing: num,
  kicking: num,
  wrestling: num,
  ground: num,
  clinch: num,
});

const zoneSchema = {
  anyOf: [{ type: "string", enum: ["center", "open", "cage"] }, { type: "null" }],
} as const;

const EVALUATION_SCHEMA = obj({
  summary: str,
  style: obj({ primaryStyle: nstr, approach: nstr, baseDiscipline: nstr }),
  findings: arr(findingSchema),
  scores: obj({
    aggression: nnum,
    cageControl: nnum,
    cardio: nnum,
    damage: nnum,
    durability: nnum,
    fightIq: nnum,
    predictability: nnum,
  }),
  topWeapons: arr(topEntrySchema),
  topPatterns: arr(topEntrySchema),
  topWeaknesses: arr(topEntrySchema),
  topDangers: arr(topEntrySchema),
  dangerProfile: obj({
    mostDangerousWhen: nstr,
    finishes: nstr,
    vulnerableWhen: nstr,
  }),
  actionStats: arr(
    obj({ id: str, attempted: num, landed: num, zone: zoneSchema, setup: nstr }),
  ),
  dnaSplit: nullable(dnaSplitSchema),
  merge: obj({
    confirms: strArr,
    contradicts: arr(obj({ questionId: str, existing: str, observed: str })),
    weight: num,
  }),
});

// ─── Prompt ─────────────────────────────────────────────────────────────────

function dnaCatalogText(): string {
  return DNA_CATEGORIES.map(
    (c) =>
      `Kategorie "${c.id}" (${c.label}):\n` +
      c.questions.map((q) => `  - ${q.id}: ${q.label}`).join("\n"),
  ).join("\n");
}

const SYSTEM_PROMPT = `Du bist ein erfahrener MMA-Cheftrainer und Kampfanalyst. Du bekommst die rohen, gezählten Video-Beobachtungen eines Kampfsport-Analysten (JSON) und erstellst daraus eine fundierte, praxistaugliche Analyse für einen Trainer.

Grundregeln:
- Stütze jede Aussage auf die Beobachtungsdaten. Kein Raten: Fragen, zu denen die Daten nichts hergeben, lässt du weg (kein Befund mit leerer Substanz).
- Jeder Befund trägt eine Konfidenz 0-1 (wie belastbar ist er nach EINEM Video) und Evidenz (Timestamps oder konkrete Zahlen aus der Beobachtung).
- Antworte auf Deutsch, in klarer Trainersprache. Konkret statt generisch: nenne Techniken, Situationen, Zonen und Runden beim Namen.
- Befunde ordnest du den vorgegebenen Frage-IDs zu. Nutze nur existierende IDs aus dem Katalog.
- Scores 0-100 nur vergeben, wenn die Daten sie tragen, sonst null.
- Die Beschreibung der Kämpfer-Identifikation stammt aus Stufe 1 — übernimm deren Unsicherheit in deine Konfidenzen (niedrige idConfidence senkt alle Konfidenzen).`;

function userPrompt(args: EvaluateArgs): string {
  const {
    mode,
    fighter,
    observation,
    existingDna,
    existingSplit,
    existingStats,
    profileContext,
  } = args;

  const modeText =
    mode === "opponent"
      ? `AUFGABE (Gegner-Scouting): Erstelle die Gegner-Analyse für "${fighter.name}".
- gameplan_*: Wie schlagen WIR diesen Gegner (Plan gegen ihn).
- drills_*: Wie bereiten wir UNSEREN Athleten auf ihn vor.
- exploits_*: Welche seiner Schwächen nutzen wir aus.`
      : `AUFGABE (Eigener Athlet): Erstelle die Leistungsanalyse für UNSEREN eigenen Athleten "${fighter.name}". Interpretiere die Kategorien entwicklungsorientiert:
- weaknesses_*: seine Baustellen, ehrlich benannt.
- exploits_*: was GEGNER bei ihm ausnutzen könnten (damit wir es abstellen).
- gameplan_*: wie er seine Stärken künftig besser einsetzt.
- drills_*: konkrete Trainingsschwerpunkte, um die Lücken zu schließen.`;

  const dnaBlock =
    Object.keys(existingDna).length > 0
      ? `BESTEHENDE DNA-ANTWORTEN (Frage-ID → bisherige Antwort):\n${JSON.stringify(existingDna, null, 2)}`
      : "BESTEHENDE DNA-ANTWORTEN: keine (erstes Video).";

  const statsBlock =
    existingStats.length > 0 || existingSplit
      ? `BESTEHENDE STATS:\nSplit: ${JSON.stringify(existingSplit)}\nActions: ${JSON.stringify(existingStats)}`
      : "BESTEHENDE STATS: keine.";

  return `${modeText}

PROFIL-KONTEXT: ${profileContext || "keiner"}

FRAGE-KATALOG (nur diese IDs für findings verwenden):
${dnaCatalogText()}

${dnaBlock}

${statsBlock}

VIDEO-BEOBACHTUNG (Stufe 1, ein einzelner Kampf):
${JSON.stringify(observation, null, 2)}

ZUM MERGE-ABSCHNITT (nur relevant, wenn bestehende Antworten existieren):
- confirms: Frage-IDs, deren bestehende Antwort dieses Video inhaltlich bestätigt.
- contradicts: Frage-IDs, bei denen das Video der bestehenden Antwort widerspricht — mit "existing" (bisherige Antwort) und "observed" (was das Video zeigt). Nichts wird still überschrieben; das entscheidet der Trainer.
- weight 0-1: Wie stark dieses Video die DNA gewichten darf (Aktualität × Niveau des damaligen Gegners × Abdeckung/Qualität × Regelwerk-Nähe, aus den meta-Feldern).

ZU actionStats: Übernimm die gezählten Techniken aus der Beobachtung mit den Katalog-IDs (ohne "other"-Einträge), inkl. dominanter Zone und Setup, damit sie direkt in die bestehende Zähltabelle passen.

Erstelle jetzt die vollständige Analyse als JSON gemäß Schema.`;
}

// ─── Bewertung ausführen ────────────────────────────────────────────────────

export interface EvaluateArgs {
  mode: AnalysisMode;
  fighter: FighterDescription;
  observation: VideoObservation;
  existingDna: Record<string, string>;
  existingSplit: DnaSplit | null;
  existingStats: ActionStat[];
  profileContext: string;
}

/** Defensive Normalisierung des Claude-Ergebnisses. */
function normalizeEvaluation(e: Partial<VideoEvaluation>): VideoEvaluation {
  const clamp01 = (n: unknown) =>
    Math.max(0, Math.min(1, Number(n) || 0));
  return {
    summary: e.summary ?? "",
    style: {
      primaryStyle: e.style?.primaryStyle ?? null,
      approach: e.style?.approach ?? null,
      baseDiscipline: e.style?.baseDiscipline ?? null,
    },
    findings: (e.findings ?? [])
      .filter((f) => f.questionId && f.answer?.trim())
      .map((f) => ({
        questionId: f.questionId,
        categoryId: f.categoryId ?? f.questionId.split("_")[0] ?? "",
        answer: f.answer.trim(),
        confidence: clamp01(f.confidence),
        evidence: f.evidence ?? [],
      })),
    scores: {
      aggression: e.scores?.aggression ?? null,
      cageControl: e.scores?.cageControl ?? null,
      cardio: e.scores?.cardio ?? null,
      damage: e.scores?.damage ?? null,
      durability: e.scores?.durability ?? null,
      fightIq: e.scores?.fightIq ?? null,
      predictability: e.scores?.predictability ?? null,
    },
    topWeapons: e.topWeapons ?? [],
    topPatterns: e.topPatterns ?? [],
    topWeaknesses: e.topWeaknesses ?? [],
    topDangers: e.topDangers ?? [],
    dangerProfile: {
      mostDangerousWhen: e.dangerProfile?.mostDangerousWhen ?? null,
      finishes: e.dangerProfile?.finishes ?? null,
      vulnerableWhen: e.dangerProfile?.vulnerableWhen ?? null,
    },
    actionStats: cleanActionStats(e.actionStats ?? []),
    dnaSplit:
      e.dnaSplit && !isDnaSplitEmpty(e.dnaSplit as DnaSplit)
        ? cleanDnaSplit(e.dnaSplit as DnaSplit)
        : null,
    merge: {
      confirms: e.merge?.confirms ?? [],
      contradicts: (e.merge?.contradicts ?? []).filter((c) => c.questionId),
      weight: clamp01(e.merge?.weight ?? 0.5),
    },
  };
}

/**
 * Kostenloser Fallback: Bewertung über Gemini Flash, solange kein
 * ANTHROPIC_API_KEY gesetzt ist. Gleicher Prompt, gleiche Normalisierung —
 * nur ohne hartes Schema-Enforcement (dafür defensives Parsen).
 */
async function evaluateWithGeminiFallback(
  args: EvaluateArgs,
): Promise<{ evaluation: VideoEvaluation; model: string; usage: AnalysisUsage | null }> {
  const model = GEMINI_MODELS.flash;
  const prompt = `${SYSTEM_PROMPT}

${userPrompt(args)}

Gib AUSSCHLIESSLICH ein JSON-Objekt zurück, das exakt diesem JSON-Schema entspricht (keine Kommentare, kein Markdown):
${JSON.stringify(EVALUATION_SCHEMA)}`;
  const text = await geminiGenerateJson(model, prompt);
  const parsed = parseModelJson<Partial<VideoEvaluation>>(text);
  return {
    evaluation: normalizeEvaluation(parsed),
    model: `${model} (Fallback)`,
    // Gratis-Fallback (Gemini Free Tier) — verbraucht kein Claude-Guthaben.
    usage: null,
  };
}

/**
 * Führt die Bewertung aus (Stufe 2). Bevorzugt Claude (Streaming + Structured
 * Outputs); ohne ANTHROPIC_API_KEY automatisch der kostenlose Gemini-Fallback.
 */
export async function evaluateObservation(
  args: EvaluateArgs,
): Promise<{ evaluation: VideoEvaluation; model: string; usage: AnalysisUsage | null }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return evaluateWithGeminiFallback(args);
  const client = new Anthropic({ apiKey: key });

  const stream = client.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: 32000,
    system: SYSTEM_PROMPT,
    output_config: {
      format: {
        type: "json_schema",
        schema: EVALUATION_SCHEMA as unknown as Record<string, unknown>,
      },
    },
    messages: [{ role: "user", content: userPrompt(args) }],
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new Error("Claude hat die Auswertung abgelehnt (Safety-Filter).");
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("Claude-Antwort wurde abgeschnitten — bitte erneut versuchen.");
  }

  const text = message.content
    .filter(
      (b): b is Extract<typeof b, { type: "text" }> => b.type === "text",
    )
    .map((b) => b.text)
    .join("");
  if (!text.trim()) throw new Error("Claude lieferte kein Ergebnis");

  const parsed = JSON.parse(text) as Partial<VideoEvaluation>;
  return {
    evaluation: normalizeEvaluation(parsed),
    model: CLAUDE_MODEL,
    usage: computeUsage(CLAUDE_MODEL, message.usage),
  };
}
