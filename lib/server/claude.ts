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

import { GEMINI_MODELS, geminiGenerateJson, parseModelJson } from "./gemini";
import { hatClaudeSchluessel, rufeClaude } from "./claude-aufruf";
import { DNA_CATEGORIES } from "../gegner-dna";
import {
  ACTION_CATALOG,
  ACTION_GROUP_META,
  actionLabel,
  cleanActionStats,
  cleanDnaSplit,
  isDnaSplitEmpty,
} from "../fight-stats";
import {
  VARIANTE_LABEL,
  begriffe,
  erlaubteTechniken,
  filtereBeobachtung,
  filtereTechnikStats,
  frageGiltFuer,
  freieSplitSchluessel,
  gesperrteGruppen,
  splitNachSteckbrief,
  steckbrief,
  varianteFuer,
  zonenLabel,
  type Flaeche,
  type Variante,
  type VerworfeneAktion,
} from "../kampfart-steckbrief";
import { FIGHT_RECENCY_LABEL, SPORT_LABEL, sideKeyFromText } from "../video-analysis";
import type {
  AnalysisMode,
  AnalysisUsage,
  ConfirmedAnswer,
  FighterDescription,
  FightRecency,
  Sport,
  VideoEvaluation,
  VideoObservation,
} from "../video-analysis";
import type { ActionStat, DnaSplit } from "../fight-stats";

// Modell, Streaming, Ausweichen bei Überlastung, Fallback bei Ablehnung und
// die Kostenrechnung stehen seit 17.09.2026 EINMAL in ./claude-aufruf.ts.

// ─── JSON-Schema für Structured Outputs ─────────────────────────────────────

// Nullable via Typ-Array statt anyOf — kompiliert zu einer deutlich
// kleineren Grammatik (anyOf-Ketten sprengen das Schema-Limit der API).
const str = { type: "string" } as const;
const num = { type: "number" } as const;
const nstr = { type: ["string", "null"] } as const;
const nnum = { type: ["number", "null"] } as const;
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
  // Seiten-Schlüssel fürs Tauziehen (lib/profile-evidence.ts): benennt die
  // AUSSAGE, nicht den Wortlaut — zwei Videos, die dasselbe sagen, tragen
  // denselben Schlüssel.
  sideKey: str,
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
  type: ["string", "null"],
  enum: ["center", "open", "cage", null],
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
    // Bestätigungen zählen nur MIT Beleg (Timestamps) — Modelle bestätigen
    // Vorgaben bereitwillig; ohne Beleg wiegt eine Bestätigung nichts.
    confirms: arr(obj({ questionId: str, evidence: strArr })),
    contradicts: arr(obj({ questionId: str, existing: str, observed: str })),
    weight: num,
  }),
});

// ─── Prompt ─────────────────────────────────────────────────────────────────

/**
 * Der Fragenkatalog für DIESES Video (Kampfart-Steckbriefe, 17.09.2026):
 * nur die Fragen, die in der Kampfart gelten — eine gesperrte Frage steht
 * gar nicht erst im Text —, in der Fassung des Profils: Gegner „er",
 * eigener Athlet „du". Die Du-Fassung ist seit Leons Wunsch kurz („Wo bist
 * du angreifbar?"); die Aufzählung der er-Fassung („– Druck und Kontrolle,
 * Passen …") hängt die Bewertung in Klammern an, damit sie genau bleibt.
 */
function dnaCatalogText(sport: Sport | null, mode: AnalysisMode, flaeche: Flaeche | null): string {
  const kategorieRaum = begriffe(sport, flaeche).kategorieRaum;
  // Die Aufzählung der Flächen („am Käfig, an den Seilen, am Mattenrand")
  // bleibt draußen — welche Fläche gilt, sagt der Kampfart-Absatz.
  const ohneFlaechen = (label: string) =>
    label.replace(/ – am Käfig, an den Seilen, am Mattenrand/, "").replace(/ \(Käfig, Seile, Mattenrand\)/, "");
  const duMitDetail = (label: string, labelDu: string) => {
    const detail = ohneFlaechen(label).split(" – ")[1]?.replace(/\?$/, "").trim();
    // Eine Aufzählung mit „er" (z. B. „oder zieht er Guard") bleibt draußen —
    // sie zöge die Antwort in die er-Form.
    const mitEr = /\b(er|sein\w*|ihm|ihn)\b/.test(detail ?? "");
    return detail && !mitEr && !labelDu.includes(" – ") ? `${labelDu} (${detail})` : labelDu;
  };
  return DNA_CATEGORIES.map((c) => {
    const fragen = c.questions.filter((q) => frageGiltFuer(q.id, sport));
    if (fragen.length === 0) return "";
    const label = c.id === "cage-space" ? kategorieRaum : c.label;
    return (
      `Kategorie "${c.id}" (${label}):\n` +
      fragen
        .map((q) => `  - ${q.id}: ${mode === "athlete" ? duMitDetail(q.label, q.labelDu) : ohneFlaechen(q.label)}`)
        .join("\n")
    );
  })
    .filter(Boolean)
    .join("\n");
}

/**
 * Rolle je Kampfart — vorher stand hier fest „MMA-Cheftrainer", und in
 * Sparrings ohne Bodenkampf fand die Bewertung Takedowns (Stresstests 16.09.).
 */
function systemPrompt(sport: Sport | null): string {
  const rolle = steckbrief(sport)?.rolle ?? "Kampfsport-Cheftrainer";
  return `Du bist ein erfahrener ${rolle} und Kampfanalyst. ${SYSTEM_REGELN}`;
}

const SYSTEM_REGELN = `Du bekommst die rohen, gezählten Video-Beobachtungen eines Kampfsport-Analysten (JSON) und erstellst daraus eine fundierte, praxistaugliche Analyse für einen Trainer.

Grundregeln:
- Stütze jede Aussage auf die Beobachtungsdaten. Kein Raten: Fragen, zu denen die Daten nichts hergeben, lässt du weg (kein Befund mit leerer Substanz).
- NUR WAS VORKAM: Eine Phase, Technik oder Situation, die im Video nicht vorkommt (0 Versuche, 0 Sekunden, keine Szene), ist KEIN Befund — weder Stärke noch Schwäche, Lücke, Exploit, Plan oder Drill. Lass die Frage dann weg; schreib nie „fehlt komplett", „ungetestet", „Baustelle" oder „ein Gegner wird das ausnutzen" über etwas, das nicht passiert ist. Nur die summary nennt EINMAL knapp, was nicht vorkam („Boden und Takedowns kamen in diesem Video nicht vor.").
- Richtwerte und Prüfsätze prüfen nur die Plausibilität der Beobachtung. Eine Abweichung davon ist nie selbst ein Befund — ein Sparring ist kein Wettkampf.
- Jeder Befund trägt eine Konfidenz 0-1 (wie belastbar ist er nach EINEM Video) und Evidenz (Timestamps oder konkrete Zahlen aus der Beobachtung).
- Antworte auf Deutsch, in klarer Trainersprache. Konkret statt generisch: nenne Techniken, Situationen, Zonen und Runden beim Namen.
- Befunde ordnest du den vorgegebenen Frage-IDs zu. Nutze nur existierende IDs aus dem Katalog.
- Jeder Befund trägt einen sideKey: ein kurzer Slug in Kleinbuchstaben (a-z, 0-9, Bindestrich), der die KERNAUSSAGE benennt, nicht den Wortlaut. Geht es um eine Technik, ist der sideKey die Katalog-ID (z. B. "cross", "low-kick", "double-leg"); geht es um ein Verhalten, ein kurzer Begriff (z. B. "clinch-suchen", "rueckwaerts", "konter", "orthodox", "southpaw", "am-cage"). Zwei Videos mit derselben Kernaussage müssen denselben sideKey bekommen. Nennt eine Antwort ZWEI gleichrangige Aussagen, wähle die stärker belegte.
- ZAHLEN ehrlich nach Menge (Konfidenzintervall): Unter 5 Versuchen nennst du nur die Zählung als Tatsache („3 Versuche, 2 Treffer") — keine Quote, keinen Bruch wie „2 von 3" und KEIN Urteil aus Treffern oder Fehlschlägen: nie „2 Versuche ohne Treffer, bringt dir wenig", nie „setz den Teep früher ein (bei 2 Versuchen einmal gestoppt)". Was du an der AUSFÜHRUNG siehst, benennst du auch bei einem einzigen Versuch — mit Zeitstempel und ohne Trefferzahl („Dein Takedown bei 00:20 kam ohne Vorbereitung — übe den Entry."). Stärke, Schwäche, Plan oder Drill stützt du unter 5 Versuchen nur auf so eine beschriebene Szene, nie auf die Zählung. Von 5 bis 9 Versuchen nur als Bruch („3 von 5"), ohne Prozent. Ab 10 Versuchen Prozent, ab 20 mit Bandbreite („etwa 40–60 %").
- Ein einzelnes Video zeigt eine Tendenz, noch kein Muster — ein Muster braucht mehrere Videos.
- Scores 0-100 nur vergeben, wenn die Daten sie tragen, sonst null.
- Schreib nie JSON-Feldnamen (cagePressureSeconds, dnaSplit, takedownsAgainst, zone=center) in Texte oder Evidenz — schreib, was sie bedeuten („0 Sekunden am Rand", „70 % Distanz mit den Händen").
- Die Beschreibung der Kämpfer-Identifikation stammt aus Stufe 1 — übernimm deren Unsicherheit in deine Konfidenzen (niedrige idConfidence senkt alle Konfidenzen).`;

/**
 * Der Kampfart-Absatz (docs/kampfart-steckbriefe.md 8.2): Begriffe, erlaubte
 * Techniken, was die Beobachtung verworfen hat, feste Split-Nullen,
 * Prüfsätze. Ohne Kampfart (Bestand) bleibt der Absatz leer. Die Wörter für
 * Mitte, Rand und Zonen kommen aus der FLÄCHE des Videos (Vorlauf) — Käfig
 * nur, wenn einer zu sehen ist (Leon 17.09.2026).
 */
const FLAECHE_ORT: Record<Flaeche, string> = {
  kaefig: "im Käfig",
  ring: "im Ring",
  matte: "auf der Matte",
};

function kampfartBlock(
  sport: Sport | null,
  variante: Variante | null,
  flaeche: Flaeche | null,
  verworfen: VerworfeneAktion[],
): string {
  const s = steckbrief(sport);
  if (!s || !sport) return "";
  const b = begriffe(sport, flaeche);
  const zonen = zonenLabel(sport, flaeche);
  const flaechenSatz = flaeche
    ? `Gekämpft wird ${FLAECHE_ORT[flaeche]}.${flaeche === "kaefig" ? "" : ` „Käfig" oder „Cage" schreibst du hier nie${flaeche === "ring" ? "" : `, „Seile" auch nicht`}.`}`
    : `Die Kampffläche ist unbekannt — schreib neutral „Mitte" und „am Rand", nie „Käfig", „Cage" oder „Seile".`;
  const phasen = [b.phaseStand, b.phaseKontakt, b.phaseBoden].filter(Boolean).join(" / ");
  const erlaubt = erlaubteTechniken(sport, variante)
    .map((id) => `${id} (${actionLabel(id)})`)
    .join(", ");
  const gesperrt = gesperrteGruppen(sport, variante).map((g) => ACTION_GROUP_META[g].label);
  const nurAndereVariante = s.varianten
    ? ACTION_CATALOG.filter(
        (a) => !erlaubteTechniken(sport, variante).includes(a.id) && erlaubteTechniken(sport, null).includes(a.id),
      ).map((a) => a.label)
    : [];
  const verworfenText = verworfen.length
    ? verworfen.map((v) => `${v.attempted} × ${actionLabel(v.id)}`).join(", ")
    : "nichts";
  const nullen = s.splitNull.length
    ? `${s.splitNull.join(", ")} sind in dieser Kampfart fest 0 — verteile den Split nur auf ${freieSplitSchluessel(sport).join(", ")}.`
    : "Alle fünf Split-Schlüssel sind möglich.";
  const pruefsaetze = [
    s.anker.split,
    ...s.anker.pruefsaetze,
    ...(variante && s.anker.variante?.[variante] ? [s.anker.variante[variante]!] : []),
  ];

  return `
KAMPFART (vom Trainer bestätigt, verlässlich): ${SPORT_LABEL[sport]}${variante ? `, Variante ${VARIANTE_LABEL[variante]}` : ""}.
- Fläche: ${flaechenSatz}
- Begriffe: Kampffläche ${b.flaeche}, Mitte ${b.mitte}, Rand „${b.rand}"; Phasen ${phasen}; der Kampfbeginn heißt „${b.runde1}". Fachwörter, die passen: ${b.wortschatz.join(", ")}.
- ${zonen ? `Zonen in der Beobachtung: center = ${zonen.center}, open = ${zonen.open}, cage = ${zonen.cage}. Schreib in deinen Texten genau diese Wörter.` : "Diese Kampfart hat keine Zonen: Der Rand ist nur Neustart. Setze zone in actionStats immer auf null."}
- Techniken, die in dieser Kampfart zählen: ${erlaubt}.${gesperrt.length ? ` Gesperrt sind: ${gesperrt.join(", ")}.` : ""}${nurAndereVariante.length ? ` Nur in der anderen Variante erlaubt: ${nurAndereVariante.join(", ")}.` : ""} Techniken außerhalb dieser Liste sind hier Foul oder Erkennungsfehler — nenne sie NIE als Waffe, Schwäche, Muster oder Drill.
- Aus der Beobachtung verworfen, weil es nicht zur Kampfart passt: ${verworfenText}. Die Beobachtung unten ist bereits gefiltert.
- Split: ${nullen}
- Prüfsätze (Plausibilität, kein Automatismus — weicht die Beobachtung deutlich ab, senke die Konfidenz und prüfe die Phasen):
${pruefsaetze.map((p) => `  · ${p}`).join("\n")}
`;
}

function userPrompt(args: EvaluateArgs): string {
  const {
    mode,
    fighter,
    existingSplit,
    existingStats,
    profileContext,
    recency,
  } = args;
  const sport = args.sport ?? null;
  const variante = varianteFuer(sport, args.variante);
  const flaeche = args.flaeche ?? null;
  // Die Bewertung sieht die Beobachtung so, wie sie in der Kampfart gilt.
  const { observation, verworfen } = filtereBeobachtung(args.observation, sport, variante);
  // Bestand nur zu Fragen, die hier gelten — sonst bestätigt oder
  // widerspricht die Bewertung einer Frage, die dieses Video nie stellt.
  const existingDna = Object.fromEntries(
    Object.entries(args.existingDna).filter(([q]) => frageGiltFuer(q, sport)),
  );

  // Additiv: ohne Trainer-Angabe ("unknown") bleibt der Prompt exakt so, wie
  // er vor Einführung des Zeitraum-Feldes war.
  const recencyBlock =
    recency && recency !== "unknown"
      ? `\nZEITLICHE EINORDNUNG (Trainer-Angabe, verlässlich): Der Kampf liegt im Zeitraum "${FIGHT_RECENCY_LABEL[recency]}". Nutze das statt meta.estimatedAge (Schätzung des Video-Analysten) und berücksichtige es bei der Aktualität deiner Aussagen.\n`
      : "";

  const modeText =
    mode === "opponent"
      ? `AUFGABE (Gegner-Scouting): Erstelle die Gegner-Analyse für "${fighter.name}".
- gameplan_*: Wie schlagen WIR diesen Gegner (Plan gegen ihn).
- drills_*: Wie bereiten wir UNSEREN Athleten auf ihn vor.
- exploits_*: Welche seiner Schwächen nutzen wir aus.`
      : `AUFGABE (Eigener Athlet): Erstelle die Leistungsanalyse für UNSEREN eigenen Athleten "${fighter.name}". Der Athlet liest sie selbst: Schreib ALLE Texte (summary, style, findings, evidence, top*, dangerProfile) in der Du-Form an ihn — „Du kämpfst orthodox …", nie „${fighter.name} kämpft …" oder „er". Interpretiere die Kategorien entwicklungsorientiert:
- weaknesses_*: deine Baustellen, ehrlich benannt — nur aus dem, was im Video passiert ist.
- exploits_*: was Gegner bei dir ausnutzen könnten, gezeigt an einer Szene aus dem Video.
- gameplan_*: wie du deine Stärken künftig besser einsetzt.
- drills_*: konkrete Trainingsschwerpunkte zu dem, was im Video sichtbar wurde.`;

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
${recencyBlock}${kampfartBlock(sport, variante, flaeche, verworfen)}
FRAGE-KATALOG (nur diese IDs für findings verwenden${mode === "athlete" ? `; die Fragen stehen in der Du-Fassung an den Athleten, deine Antworten auch („Du suchst …")` : ""}):
${dnaCatalogText(sport, mode, flaeche)}

${dnaBlock}

${statsBlock}

VIDEO-BEOBACHTUNG (Stufe 1, ein einzelner Kampf):
${JSON.stringify(observation, null, 2)}

ZUM MERGE-ABSCHNITT (nur relevant, wenn bestehende Antworten existieren):
- confirms: bestehende Antworten, die dieses Video inhaltlich bestätigt — je Eintrag questionId UND evidence (Timestamps "mm:ss" oder konkrete Zahlen aus der Beobachtung). Ohne Beleg keine Bestätigung eintragen: Eine Bestätigung ohne evidence zählt nicht.
- contradicts: Frage-IDs, bei denen das Video der bestehenden Antwort widerspricht — mit "existing" (bisherige Antwort) und "observed" (was das Video zeigt). Was am Ende im Profil steht, entscheidet die gewichtete Rechnung über alle Videos, nicht dieses eine.
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
  /** Zeitliche Einordnung des Kampfes; bei "unknown" bleibt der Prompt unverändert. */
  recency?: FightRecency;
  /**
   * Kampfart und Variante des Videos (Zuordnungs-Schirm) — bestimmen Rolle,
   * Begriffe, offene Fragen und die gefilterte Beobachtung. Ohne Kampfart
   * (Bestand, „Analyse fortsetzen" alter Stände) gilt alles.
   */
  sport?: Sport | null;
  variante?: Variante | null;
  /** Käfig, Ring oder Matte aus dem Vorlauf — nur die Wörter; null = neutral. */
  flaeche?: Flaeche | null;
  /** Analyse-Stufe: bei "pro" (Detail-Analyse) darf NIE unter Opus gewechselt werden. */
  tier: "flash" | "pro";
  /**
   * Fortschritts-Rückmeldung: Zahl der bisher empfangenen Antwort-Zeichen.
   * Nur die Claude-Stufe kann das liefern (sie streamt bereits); der
   * Gemini-Fallback ruft es nicht — dort greift clientseitig die Zeitschätzung.
   */
  onProgress?: (chars: number) => void;
}

/**
 * Defensive Normalisierung des Claude-Ergebnisses — mit dem Steckbrief der
 * Kampfart: Befunde zu gesperrten Fragen fallen weg, Zähler und Split
 * folgen der Erlaubnisliste und den festen Nullen (die commit-Route prüft
 * dasselbe noch einmal).
 */
function normalizeEvaluation(
  e: Partial<VideoEvaluation>,
  sport: Sport | null = null,
  variante: Variante | null = null,
): VideoEvaluation {
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
      .filter((f) => f.questionId && f.answer?.trim() && frageGiltFuer(f.questionId, sport))
      .map((f) => ({
        questionId: f.questionId,
        categoryId: f.categoryId ?? f.questionId.split("_")[0] ?? "",
        answer: f.answer.trim(),
        confidence: clamp01(f.confidence),
        evidence: f.evidence ?? [],
        sideKey: normalizeSideKey(f.sideKey) || sideKeyFromText(f.answer),
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
    actionStats: cleanActionStats(filtereTechnikStats(e.actionStats ?? [], sport, variante).stats),
    dnaSplit:
      e.dnaSplit && !isDnaSplitEmpty(e.dnaSplit as DnaSplit)
        ? splitNachSteckbrief(cleanDnaSplit(e.dnaSplit as DnaSplit), sport)
        : null,
    merge: {
      confirms: normalizeConfirms(e.merge?.confirms),
      contradicts: (e.merge?.contradicts ?? []).filter((c) => c.questionId),
      weight: clamp01(e.merge?.weight ?? 0.5),
    },
  };
}

/** Slug in Kleinbuchstaben; alles andere fällt auf den Text-Schlüssel zurück. */
function normalizeSideKey(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const slug = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^\x00-\x7f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, 40);
}

/** Bestätigungen: neue Form {questionId, evidence} — nackte IDs (altes Modell) ohne Beleg. */
function normalizeConfirms(raw: unknown): ConfirmedAnswer[] {
  if (!Array.isArray(raw)) return [];
  const out: ConfirmedAnswer[] = [];
  for (const c of raw) {
    if (typeof c === "string" && c.trim()) out.push({ questionId: c.trim(), evidence: [] });
    else if (c && typeof c === "object" && typeof (c as ConfirmedAnswer).questionId === "string") {
      const ev = (c as ConfirmedAnswer).evidence;
      out.push({
        questionId: (c as ConfirmedAnswer).questionId,
        evidence: Array.isArray(ev) ? ev.filter((x) => typeof x === "string" && x.trim()) : [],
      });
    }
  }
  return out;
}

/**
 * Der fertige Prompt OHNE KI-Aufruf — für scripts/zeige-bewertungs-prompt.mjs:
 * Wer am Prompt schraubt, prüft den Text an einer gespeicherten Beobachtung,
 * bevor ein Lauf Geld kostet.
 */
export function bewertungsPrompt(args: EvaluateArgs): { system: string; user: string } {
  return { system: systemPrompt(args.sport ?? null), user: userPrompt(args) };
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
  const prompt = `${systemPrompt(args.sport ?? null)}

${userPrompt(args)}

Gib AUSSCHLIESSLICH ein JSON-Objekt zurück, das exakt diesem JSON-Schema entspricht (keine Kommentare, kein Markdown):
${JSON.stringify(EVALUATION_SCHEMA)}`;
  const text = await geminiGenerateJson(model, prompt);
  const parsed = parseModelJson<Partial<VideoEvaluation>>(text);
  return {
    evaluation: normalizeEvaluation(parsed, args.sport ?? null, varianteFuer(args.sport, args.variante)),
    model: `${model} (Fallback)`,
    // Gratis-Fallback (Gemini Free Tier) — verbraucht kein Claude-Guthaben.
    usage: null,
  };
}

/**
 * Führt die Bewertung aus (Stufe 2). Bevorzugt Claude über die gemeinsame
 * Hülle (./claude-aufruf.ts); ohne ANTHROPIC_API_KEY automatisch der
 * kostenlose Gemini-Fallback.
 */
export async function evaluateObservation(
  args: EvaluateArgs,
): Promise<{ evaluation: VideoEvaluation; model: string; usage: AnalysisUsage | null }> {
  if (!hatClaudeSchluessel()) return evaluateWithGeminiFallback(args);

  // Kein Structured-Outputs-Enforcement: das VideoEvaluation-Schema
  // überschreitet das Grammatik-Limit der API ("compiled grammar is too
  // large", verifiziert 2026-08-18). Stattdessen wird das Schema als Text in
  // den Prompt gelegt und die Antwort defensiv geparst + normalisiert —
  // derselbe bewährte Weg wie beim Gemini-Fallback.
  const content = `${userPrompt(args)}

Gib AUSSCHLIESSLICH ein JSON-Objekt zurück, das exakt diesem JSON-Schema entspricht (keine Kommentare, kein Markdown):
${JSON.stringify(EVALUATION_SCHEMA)}`;

  // Bei der Detail-Analyse (tier="pro") wird NIE unter Opus gewechselt
  // (Vorgabe) — dann greift der Auto-Neustart im Client über „überlastet".
  const { text, model, usage } = await rufeClaude({
    system: systemPrompt(args.sport ?? null),
    user: content,
    maxTokens: 32000,
    nurOpus: args.tier === "pro",
    onProgress: args.onProgress,
  });

  const parsed = parseModelJson<Partial<VideoEvaluation>>(text);
  return {
    evaluation: normalizeEvaluation(parsed, args.sport ?? null, varianteFuer(args.sport, args.variante)),
    model,
    usage,
  };
}
