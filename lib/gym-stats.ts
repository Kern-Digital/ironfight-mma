/**
 * Kennzahlen eines Gyms — die Rechnung hinter den Übersichtsseiten.
 *
 * SIE LIEGT HIER UND NICHT IN DEN SEITEN, weil dieselben Zahlen an mehreren
 * Stellen auftauchen (Trainer-Übersicht, Verwaltungs-Übersicht, später die
 * Plattform-Konsole). Zwei Rechnungen für dieselbe Kennzahl wären zwei
 * Wahrheiten, und die Frage „warum steht da eine andere Zahl" ist teurer als
 * diese Datei.
 *
 * WAS EINE TEILNAHME IST — und was nicht: Sie entsteht, wenn jemand im
 * Kursplan auf „Teilnehmen" tippt (`recordParticipation`). Das ist eine
 * SELBSTAUSKUNFT, keine kontrollierte Anwesenheit. Jede Beschriftung im UI
 * muss das tragen: „Rückmeldungen", nicht „Anwesenheit". Eine Zahl, die
 * aussieht wie Anwesenheit und keine ist, führt zu Entscheidungen auf
 * falscher Grundlage.
 *
 * GYM-TRENNUNG: Alle Abfragen filtern auf `gymId`. Bei den Teilnahmen ist das
 * nicht nur Höflichkeit, sondern Bedingung — die Firestore-Regel für die
 * collectionGroup verlangt den Filter, sonst wird die Abfrage abgewiesen
 * (deny by default, Konzept §3.3).
 */

import {
  collectionGroup,
  getDocs,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { getFirestoreDb } from "./firebase";
import { getWeekIdentifier, TRAINING_BLOCKS } from "./schedule";

/** Eine gelesene Teilnahme, auf das Nötige reduziert. */
export interface ParticipationPoint {
  trainingBlockId: string;
  blockTitle: string;
  weekIdentifier: string;
  joinedAt: Date;
}

/**
 * Alle Teilnahmen des Gyms seit einem Stichtag.
 *
 * EINE Abfrage für alle Kennzahlen: Der Verlauf, die Kurs-Auslastung und die
 * Wochenzahl entstehen anschließend im Speicher. Drei getrennte Abfragen
 * wären dreimal Lesekosten für dieselben Dokumente — und Firestore rechnet
 * pro gelesenem Dokument ab (Kostenkarte).
 */
export async function getParticipationsSince(
  gymId: string,
  since: Date,
): Promise<ParticipationPoint[]> {
  const q = query(
    collectionGroup(getFirestoreDb(), "participations"),
    where("gymId", "==", gymId),
    where("joinedAt", ">=", Timestamp.fromDate(since)),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      trainingBlockId: String(data.trainingBlockId ?? ""),
      blockTitle: String(data.blockTitle ?? ""),
      weekIdentifier: String(data.weekIdentifier ?? ""),
      joinedAt: (data.joinedAt as Timestamp | undefined)?.toDate() ?? new Date(0),
    };
  });
}

/** Ein Punkt im Wochenverlauf. */
export interface WeekPoint {
  weekIdentifier: string;
  /** Wie viele Rückmeldungen in dieser Woche. */
  count: number;
  /** Montag dieser Woche — für die Beschriftung der Achse. */
  weekStart: Date;
}

/**
 * Der Wochenverlauf der letzten `weeks` Wochen, LÜCKENLOS.
 *
 * Wochen ohne eine einzige Rückmeldung kommen als Null zurück und fehlen
 * nicht. Eine Kurve, die stille Wochen einfach überspringt, zeigt einen
 * gleichmäßigen Verlauf, wo in Wahrheit eine Lücke war — und genau die Lücke
 * ist die Information.
 */
export function weeklyCourse(
  points: ParticipationPoint[],
  weeks: number,
  now: Date,
): WeekPoint[] {
  const byWeek = new Map<string, number>();
  for (const p of points) {
    byWeek.set(p.weekIdentifier, (byWeek.get(p.weekIdentifier) ?? 0) + 1);
  }
  const out: WeekPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(now.getTime() - i * 7 * 86400000);
    // Auf Montag zurückschieben, damit die Beschriftung zur Woche passt.
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    weekStart.setHours(0, 0, 0, 0);
    const id = getWeekIdentifier(weekStart);
    out.push({ weekIdentifier: id, count: byWeek.get(id) ?? 0, weekStart });
  }
  return out;
}

/** Auslastung eines einzelnen Kurses in einem Zeitraum. */
export interface CourseLoad {
  trainingBlockId: string;
  title: string;
  weekday: number;
  startTime: string;
  /** Rückmeldungen im betrachteten Zeitraum. */
  count: number;
}

/**
 * Welche Kurse laufen, welche nicht — absteigend sortiert.
 *
 * Kurse OHNE eine einzige Rückmeldung stehen mit Null in der Liste und fallen
 * nicht heraus. Sie sind der eigentliche Befund: Ein Kurs, von dem nie jemand
 * zurückmeldet, ist entweder unbeliebt oder niemand kennt den Knopf — beides
 * will ein Trainer sehen, und beides verschwände beim Weglassen.
 */
export function courseLoad(points: ParticipationPoint[]): CourseLoad[] {
  const counts = new Map<string, number>();
  for (const p of points) {
    counts.set(p.trainingBlockId, (counts.get(p.trainingBlockId) ?? 0) + 1);
  }
  return TRAINING_BLOCKS.map((b) => ({
    trainingBlockId: b.id,
    title: b.title,
    weekday: b.weekday,
    startTime: b.startTime,
    count: counts.get(b.id) ?? 0,
  })).sort((a, b) => b.count - a.count);
}

/** Ein Monat in der Mitglieder-Kurve. */
export interface MonthPoint {
  /** "2026-09" — nur intern, nie im UI anzeigen. */
  key: string;
  /** Erster Tag des Monats — für die Beschriftung. */
  start: Date;
  /** Neu dazugekommen in diesem Monat. */
  joined: number;
  /** Gesamtstand am Ende des Monats. */
  total: number;
}

/**
 * Mitglieder-Wachstum der letzten `months` Monate.
 *
 * Sie rechnet auf einer bereits geladenen Mitgliederliste statt selbst
 * abzufragen: Die Liste steht auf den Verwaltungsseiten ohnehin schon, und
 * eine zweite Abfrage wäre dieselben Dokumente ein zweites Mal bezahlt.
 *
 * OHNE BEITRITTSDATUM ZÄHLT NIEMAND MIT — auch nicht als „irgendwann davor".
 * Ein geratenes Datum verschöbe die Kurve, und niemand könnte hinterher
 * sagen, welcher Balken echt ist. Der Gesamtstand am Ende bleibt trotzdem
 * richtig, weil er die volle Liste zählt.
 */
export function memberGrowth(
  members: { gymJoinedAt?: Date | null; createdAt?: Date | null }[],
  months: number,
  now: Date,
): MonthPoint[] {
  const joinDate = (m: { gymJoinedAt?: Date | null; createdAt?: Date | null }) =>
    m.gymJoinedAt ?? m.createdAt ?? null;
  const monthKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

  const joinedPerMonth = new Map<string, number>();
  for (const m of members) {
    const d = joinDate(m);
    if (!d) continue;
    const k = monthKey(d);
    joinedPerMonth.set(k, (joinedPerMonth.get(k) ?? 0) + 1);
  }

  const out: MonthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const k = monthKey(start);
    // Gesamtstand: alle, die bis zum Monatsende dabei waren. Wer kein Datum
    // hat, zählt erst im letzten Monat mit — er ist ja heute Mitglied.
    const total = members.filter((m) => {
      const d = joinDate(m);
      if (!d) return i === 0;
      return d < end;
    }).length;
    out.push({ key: k, start, joined: joinedPerMonth.get(k) ?? 0, total });
  }
  return out;
}

/** Wie viele der 24 Wochenkurse haben diese Woche Inhalte? */
export interface CoverageResult {
  withContent: number;
  total: number;
  /** 0–1, gerundet wird erst in der Anzeige. */
  ratio: number;
}

export function weeklyCoverage(sessionCount: number): CoverageResult {
  const total = TRAINING_BLOCKS.length;
  // Mehr gepflegte Einheiten als Kurse kann es geben, wenn Altdaten aus
  // gelöschten Kursen herumliegen. Dann wäre die Quote > 1 und der Ring
  // liefe über — deshalb gedeckelt.
  const withContent = Math.min(sessionCount, total);
  return { withContent, total, ratio: total === 0 ? 0 : withContent / total };
}
