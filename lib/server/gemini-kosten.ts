/**
 * Gemini-Kosten buchen — Schritt 0 des Geschäftsplans (20.09.2026).
 *
 * Bis zum 20.09.2026 buchte die App NUR Claude: `preisJeMillion` in
 * claude-aufruf.ts kennt keine Gemini-Modelle und gab für sie [0, 0] zurück,
 * und `generateContentOnce` las die Token-Zahlen aus Googles Antwort gar nicht
 * erst aus. Solange der Key im Gratis-Tarif lief, war das egal; seit dem
 * Bezahltarif (16.09.2026) kostet jede Beobachtung echtes Geld, das in keiner
 * Auswertung auftauchte. Jede „Ø-Kosten je Analyse" war damit eine Untergrenze.
 *
 * Listenpreise USD je 1 Mio. Token [Eingabe, Ausgabe], Bezahltarif, Stand
 * 16.09.2026 laut ai.google.dev/gemini-api/docs/pricing; EUR ≈ USD wie in
 * claude-aufruf.ts. Video- und Bild-Token sind Eingabe zum Eingabepreis,
 * Denk-Tokens der Thinking-Modelle zählen als Ausgabe. Audio-Token rechnet
 * Google bei manchen Modellen höher ab — hier NICHT gesondert, weil die
 * Preisseite für die 3.x-Flash-Modelle keinen eigenen Audio-Satz nennt. Die
 * Zahl ist damit eine Untergrenze mit kleinem, bekanntem Fehler — statt null.
 *
 * Gemini 3.8 Flash: 0,75/3,75 bis 31.12.2026, ab 01.01.2027 1,50/7,50 —
 * offiziell datiert. Die Umschaltung steht deshalb im Code, nicht in einer
 * Erinnerung. Gemini 3.1 Pro gilt bis 200 Tsd. Eingabe-Token; darüber nimmt
 * Google mehr — die Pro-Kette läuft im echten Fluss aber nicht (immer Flash).
 *
 * UNBEKANNTES Modell → teuerster bekannter Flash-Satz UND eine Warnung im Log
 * (einmal je Modell und Prozess). Lieber zu hoch buchen als still zu niedrig.
 */

import type { Firestore } from "firebase-admin/firestore";
import type { AnalysisUsage } from "../video-analysis";
import type { GeminiUsage } from "./gemini";
import { bucheKiKosten } from "./ki-kosten";

const FLASH_TEUERSTER: [number, number] = [1.5, 9];
const UMSCHALTUNG_3_8 = Date.UTC(2027, 0, 1);
const gewarnt = new Set<string>();

export function preisJeMillionGemini(modelVersion: string, am: Date = new Date()): [number, number] {
  const m = modelVersion.toLowerCase();
  if (m.includes("3.8-flash")) return am.getTime() >= UMSCHALTUNG_3_8 ? [1.5, 7.5] : [0.75, 3.75];
  if (m.includes("3.5-flash-lite")) return [0.3, 2.5];
  if (m.includes("3.5-flash")) return [1.5, 9];
  if (m.includes("3.1-pro")) return [2, 12];
  if (!gewarnt.has(modelVersion)) {
    gewarnt.add(modelVersion);
    console.warn(
      `[gemini-kosten] Kein Preis für "${modelVersion}" hinterlegt — gebucht zum teuersten Flash-Satz (${FLASH_TEUERSTER.join("/")} $). Preistabelle nachziehen.`,
    );
  }
  return FLASH_TEUERSTER;
}

/** Aus Googles `usageMetadata` dieselbe Form, die auch Claude liefert. */
export function kostenAusGeminiUsage(usage: GeminiUsage, am: Date = new Date()): AnalysisUsage {
  const [inRate, outRate] = preisJeMillionGemini(usage.modelVersion, am);
  const ausgabe = usage.outputTokens + usage.thoughtTokens;
  const costEur = (usage.promptTokens * inRate + ausgabe * outRate) / 1_000_000;
  return {
    inputTokens: usage.promptTokens,
    outputTokens: ausgabe,
    costEur: Math.round(costEur * 10000) / 10000,
    model: usage.modelVersion,
  };
}

/**
 * Bucht einen Gemini-Aufruf als Art „gemini" — sofort, nicht erst beim
 * Übernehmen: Die Kosten sind da, sobald das Modell geantwortet hat. Wirft
 * nie; eine gescheiterte Buchung darf Vorlauf, Rahmen oder Analyse nicht
 * scheitern lassen. `dbHolen` ist eine Funktion, weil `adminDb()` selbst
 * werfen kann (Admin-SDK nicht verfügbar) — auch das fängt diese Stelle.
 */
export async function bucheGeminiKosten(
  dbHolen: () => Firestore,
  gymId: string,
  usage: GeminiUsage,
  at: Date = new Date(),
): Promise<void> {
  try {
    await bucheKiKosten(dbHolen(), gymId, kostenAusGeminiUsage(usage, at), at, "gemini");
  } catch (err) {
    console.warn("[gemini-kosten] Buchung fehlgeschlagen:", err instanceof Error ? err.message : err);
  }
}
