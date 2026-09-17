/**
 * KI-Kosten buchen — für jede Art von Claude-Aufruf dieselbe Stelle (17.09.2026,
 * abgestimmt zwischen „Steckbrief-Rest" und „Etappe 3"). Vorher buchte nur die
 * commit-Route (`bookUsage`); mit Profilsätzen und Gameplan kommen zwei weitere
 * Aufrufer dazu.
 *
 * Ablage wie bisher: `aiUsage/summary` (plattformweit) und `aiUsage/gym-{gymId}`
 * mit Monatsverlauf `months.JJJJ-MM`. NEU je Art: `spentEurJeArt.<art>` und
 * `anzahlJeArt.<art>` (Summe und je Monat).
 *
 * `analysisCount` zählt NUR Analysen — sonst bliese jeder Satz- oder
 * Gameplan-Aufruf die Analysenzahl in der Admin-Übersicht auf.
 *
 * ZWEI GEMESSENE FALLEN (17.09.2026):
 *  1. `set({ "months.2026-09.spentEur": … }, { merge: true })` legt KEINEN
 *     verschachtelten Monat an, sondern ein Feld, dessen NAME Punkte enthält —
 *     so stand es im Gym-Dokument, und die Admin-Seite (`months[monat]`) las
 *     0 €. Punkt-Pfade gelten nur in `update`. Diese Funktion schreibt deshalb
 *     per `update` und hebt die wörtlichen Altfelder beim ersten Buchen in den
 *     echten Monatsverlauf.
 *  2. Derselbe Pfad darf in EINEM `update` nur einmal stehen („Field … was
 *     specified multiple times", gemessen von Etappe 3). Altfeld und neue
 *     Buchung im selben Monat werden deshalb erst als Zahl je Pfad addiert und
 *     dann als EIN Increment geschrieben.
 *
 * Best-effort: Der Aufrufer fängt Fehler ab, eine gescheiterte Buchung lässt
 * die eigentliche Arbeit nie scheitern.
 */

import { FieldPath, FieldValue, type Firestore } from "firebase-admin/firestore";
import { monthKey, type AnalysisUsage } from "../video-analysis";

export type KiKostenArt = "analyse" | "satz" | "gameplan";

/** Pfad → Betrag, der hochgezählt wird. */
type Zuwachs = Map<string, number>;

function addiere(z: Zuwachs, pfad: string, betrag: number) {
  z.set(pfad, (z.get(pfad) ?? 0) + betrag);
}

/** Was eine Buchung hochzählt — gesamt (und mit `monat` auch im Monatsverlauf). */
export function buchungsZuwachs(usage: AnalysisUsage, art: KiKostenArt, monat: string | null): Zuwachs {
  const z: Zuwachs = new Map();
  addiere(z, "spentEur", usage.costEur);
  addiere(z, "inputTokens", usage.inputTokens);
  addiere(z, "outputTokens", usage.outputTokens);
  addiere(z, `spentEurJeArt.${art}`, usage.costEur);
  addiere(z, `anzahlJeArt.${art}`, 1);
  if (art === "analyse") addiere(z, "analysisCount", 1);
  if (monat) {
    addiere(z, `months.${monat}.spentEur`, usage.costEur);
    addiere(z, `months.${monat}.spentEurJeArt.${art}`, usage.costEur);
    if (art === "analyse") addiere(z, `months.${monat}.analysisCount`, 1);
  }
  return z;
}

/** Wörtliche Altfelder „months.JJJJ-MM.x" (Falle 1): Betrag in den Zuwachs, Namen zum Löschen. */
export function altfelder(data: Record<string, unknown> | undefined, z: Zuwachs): string[] {
  const loeschen: string[] = [];
  for (const [name, wert] of Object.entries(data ?? {})) {
    const m = /^months\.(\d{4}-\d{2})\.(spentEur|analysisCount)$/.exec(name);
    if (!m || typeof wert !== "number") continue;
    addiere(z, `months.${m[1]}.${m[2]}`, wert);
    loeschen.push(name);
  }
  return loeschen;
}

/** Bucht einen Zuwachs in EIN aiUsage-Dokument (exportiert für die Messung am Wegwerf-Dokument). */
export async function buche(db: Firestore, docId: string, z: Zuwachs, anlegen: Record<string, unknown>) {
  const ref = db.collection("aiUsage").doc(docId);
  // Anlegen VOR der Transaktion: `update` verlangt ein bestehendes Dokument.
  await ref.set(anlegen, { merge: true });
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const zuwachs: Zuwachs = new Map(z);
    const loeschen = altfelder(snap.data(), zuwachs);
    const paare: unknown[] = [];
    for (const [pfad, betrag] of Array.from(zuwachs)) paare.push(pfad, FieldValue.increment(betrag));
    for (const name of loeschen) paare.push(new FieldPath(name), FieldValue.delete());
    paare.push("updatedAt", FieldValue.serverTimestamp());
    const [feld, wert, ...rest] = paare as [string, unknown, ...unknown[]];
    tx.update(ref, feld, wert, ...rest);
  });
}

export async function bucheKiKosten(
  db: Firestore,
  gymId: string,
  usage: AnalysisUsage,
  at: Date,
  art: KiKostenArt,
): Promise<void> {
  await Promise.all([
    buche(db, "summary", buchungsZuwachs(usage, art, null), {}),
    buche(db, `gym-${gymId}`, buchungsZuwachs(usage, art, monthKey(at)), { gymId }),
  ]);
}
