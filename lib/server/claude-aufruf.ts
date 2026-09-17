/**
 * EIN Weg zu Claude für alle Server-Aufgaben (17.09.2026, abgestimmt zwischen
 * den Fenstern „Steckbrief-Rest" und „Etappe 3"): die Bewertung einer Analyse
 * (lib/server/claude.ts), die Profilsätze (lib/server/satzschreiber.ts) und der
 * Gameplan eines Wettkampfs (lib/server/gameplan.ts).
 *
 * WAS HIER EINMAL STEHT, statt dreimal auseinanderzulaufen:
 *   • Modell Opus 5, Streaming mit `finalMessage()` (lange Antworten reißen
 *     sonst am HTTP-Timeout).
 *   • Serverseitiger Fallback bei Ablehnungen (`fallbacks: "default"`, Beta
 *     server-side-fallback-2026-07-01): Lehnt ein Sicherheitsfilter die Anfrage
 *     ab, rechnet die API sie im selben Aufruf auf dem empfohlenen Modell neu.
 *     Kampfsport-Texte sind Grenzfälle für solche Filter — ohne Fallback stünde
 *     dann eine leere Analyse da.
 *   • Überlastung (5xx nach den SDK-Wiederholungen) weicht auf Sonnet 5 aus —
 *     außer `nurOpus` (Detail-Analyse). Ein Verbindungsabbruch wechselt das
 *     Modell nicht. Beide Meldungen tragen die Wortmarke „überlastet": Der
 *     Client startet darauf automatisch neu (VideoUploadFlow).
 *   • Die Kosten rechnen nach `message.model` — nach einem Fallback zählt das
 *     Modell, das wirklich geantwortet hat.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { AnalysisUsage } from "../video-analysis";

export const CLAUDE_MODELL = process.env.CLAUDE_MODEL || "claude-opus-5";
const AUSWEICH_MODELL = "claude-sonnet-5";
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

/**
 * Listenpreise in USD je 1 Mio. Token [Eingabe, Ausgabe] — für die
 * Guthaben-Anzeige als EUR ≈ 1:1 gerechnet (Schätzung, kein Kontostand).
 * Sonnet 5 kostet 2/10 $, NICHT 3/15 wie Sonnet 4.6 (bis 17.09. falsch gebucht).
 */
export function preisJeMillion(model: string): [number, number] {
  if (model.includes("fable") || model.includes("mythos")) return [10, 50];
  if (model.includes("opus")) return [5, 25];
  if (model.includes("sonnet-5")) return [2, 10];
  if (model.includes("sonnet")) return [3, 15];
  if (model.includes("haiku")) return [1, 5];
  return [0, 0];
}

export function kostenAusUsage(
  model: string,
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  },
): AnalysisUsage {
  const [inRate, outRate] = preisJeMillion(model);
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const costEur =
    (usage.input_tokens * inRate +
      cacheWrite * inRate * 1.25 +
      cacheRead * inRate * 0.1 +
      usage.output_tokens * outRate) /
    1_000_000;
  return {
    inputTokens: usage.input_tokens + cacheWrite + cacheRead,
    outputTokens: usage.output_tokens,
    costEur: Math.round(costEur * 10000) / 10000,
    model,
  };
}

export function hatClaudeSchluessel(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export interface ClaudeAnfrage {
  system: string;
  user: string;
  /** Obergrenze der Antwort inkl. Denken (Standard 32.000). */
  maxTokens?: number;
  /** true = bei Überlastung nie unter Opus ausweichen (Detail-Analyse). */
  nurOpus?: boolean;
  /** Denktiefe; ohne Angabe gilt der Modell-Standard („high"). */
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  /** JSON-Schema für Structured Outputs — nur für kleine Schemata (Grammatik-Limit). */
  schema?: Record<string, unknown>;
  /** Zahl der bisher empfangenen Antwort-Zeichen (Fortschrittsanzeige). */
  onProgress?: (zeichen: number) => void;
}

export interface ClaudeAntwort {
  text: string;
  /** Das Modell, das geantwortet hat (nach Ausweichen oder Fallback ein anderes). */
  model: string;
  usage: AnalysisUsage;
}

const UEBERLASTET =
  "Claude ist gerade überlastet (hohe Nachfrage bei Anthropic). Bitte in 1–2 Minuten erneut versuchen.";
const VERBINDUNG =
  "Claude ist gerade nicht erreichbar (Verbindungsabbruch, wie bei Überlastung — überlastet). Bitte in 1–2 Minuten erneut versuchen.";

const istUeberlastet = (err: unknown): boolean =>
  err instanceof Anthropic.APIError && typeof err.status === "number" && err.status >= 500;
// Verbindungsabbrüche (SDK: „Connection error.", kein Status) sind
// vorübergehend wie eine Überlastung — gemessen 16.09. im Browser-Lauf.
const istVerbindung = (err: unknown): boolean => err instanceof Anthropic.APIConnectionError;

/** Ruft Claude und liefert Text, Modell und Kosten — oder wirft eine lesbare Meldung. */
export async function rufeClaude(a: ClaudeAnfrage): Promise<ClaudeAntwort> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY fehlt — Claude ist nicht eingerichtet.");
  const client = new Anthropic({ apiKey: key });

  const lauf = async (model: string) => {
    const stream = client.beta.messages.stream({
      model,
      max_tokens: a.maxTokens ?? 32000,
      system: a.system,
      messages: [{ role: "user", content: a.user }],
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      ...(a.effort || a.schema
        ? {
            output_config: {
              ...(a.effort ? { effort: a.effort } : {}),
              ...(a.schema ? { format: { type: "json_schema" as const, schema: a.schema } } : {}),
            },
          }
        : {}),
    });
    // Echter Fortschritt: die Antwort wächst zeichenweise. Bei einem
    // Modellwechsel startet der Zähler neu — der Client sichert gegen Rückschritte.
    if (a.onProgress) stream.on("text", (_delta, snapshot) => a.onProgress?.(snapshot.length));
    return stream.finalMessage();
  };

  let message: Awaited<ReturnType<typeof lauf>>;
  try {
    message = await lauf(CLAUDE_MODELL);
  } catch (err) {
    if (istVerbindung(err)) throw new Error(VERBINDUNG);
    if (!istUeberlastet(err)) throw err;
    if (a.nurOpus) throw new Error(UEBERLASTET);
    try {
      message = await lauf(AUSWEICH_MODELL);
    } catch (err2) {
      if (istVerbindung(err2)) throw new Error(VERBINDUNG);
      if (istUeberlastet(err2)) throw new Error(UEBERLASTET);
      throw err2;
    }
  }

  if (message.stop_reason === "refusal") {
    throw new Error("Claude hat die Anfrage abgelehnt (Sicherheitsfilter, auch nach dem Fallback).");
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("Claude-Antwort wurde abgeschnitten — bitte erneut versuchen.");
  }
  const text = message.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("");
  if (!text.trim()) throw new Error("Claude lieferte kein Ergebnis.");

  return { text, model: message.model, usage: kostenAusUsage(message.model, message.usage) };
}
