import type { TrainingBlock } from "./types";

// ─── WOHER DIE KURSE KOMMEN (seit 26.09.2026) ──────────────────────────────
// Bis zum 26.09. stand hier `TRAINING_BLOCKS`, EINE Woche für alle Gyms. Jetzt
// hat jedes Gym seinen eigenen Plan (lib/kursplan.ts), gelesen über
// useKursplan() (lib/kursplan-context.tsx). Jede Funktion hier bekommt die
// Kurse deshalb als erstes Argument — sie rechnet, sie liest nicht.

export const WEEKDAY_LABELS = [
  "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag",
];

export const WEEKDAY_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

// ─── Kurse = Kursnamen ──────────────────────────────────────────────────────
// Ein KURS ist ein Kursname, nicht ein Termin: „MMA Teens" steht viermal im
// Plan (Mi 2×, Fr 2×) und ist trotzdem ein Kurs — dieselbe Regel wie der
// Kurs-Filter der Athletenliste (lib/student-courses.ts). Gespeichert werden
// trotzdem die Termin-IDs: sie sind stabil, ein Titel ist es nicht.

/** Alle Kursnamen in der Reihenfolge des Kursplans (erster Termin zählt). */
export function courseTitles(blocks: TrainingBlock[]): string[] {
  return Array.from(new Set(blocks.map((b) => b.title)));
}

/** Die Termine eines Kursnamens (leer, wenn es ihn nicht gibt). */
export function blocksForCourse(blocks: TrainingBlock[], title: string): TrainingBlock[] {
  return blocks.filter((b) => b.title === title);
}

/**
 * Kursnamen zu gespeicherten Termin-IDs — in Kursplan-Reihenfolge, jeder
 * einmal. Unbekannte IDs (Kurs aus dem Plan genommen) fallen still raus.
 */
export function courseTitlesOf(blocks: TrainingBlock[], blockIds: string[]): string[] {
  const titel = new Set(
    blockIds.flatMap((id) => {
      const b = blockById(blocks, id);
      return b ? [b.title] : [];
    }),
  );
  return courseTitles(blocks).filter((t) => titel.has(t));
}

/** Termin-ID → Termin (undefined für unbekannte IDs). */
export function blockById(blocks: TrainingBlock[], id: string): TrainingBlock | undefined {
  return blocks.find((b) => b.id === id);
}

/** ISO-Wochenkennung — nur intern, nie im UI anzeigen. Bsp: "2026-W19" */
export function getWeekIdentifier(date: Date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** Aktueller Wochentag (0=Montag, 6=Sonntag) — europäische Konvention */
export function getCurrentWeekday(): number {
  return (new Date().getDay() + 6) % 7;
}

/** Blöcke für einen bestimmten Wochentag, nach Beginn sortiert. */
export function getBlocksForDay(blocks: TrainingBlock[], weekday: number): TrainingBlock[] {
  return blocks
    .filter((b) => b.weekday === weekday)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

// ─── Aktueller / nächster Kurs (Header der Stab-Hülle, 01.09.2026) ───────────

export interface CurrentBlock {
  block: TrainingBlock;
  /** Läuft der Kurs GERADE, oder ist er der nächste? */
  state: "now" | "next";
  /** 0 = heute, 1 = morgen, … — nur bei `state: "next"` interessant. */
  dayOffset: number;
}

/** "18:30" → Minuten seit Mitternacht. Ungültiges → NaN. */
function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Der Kurs, der gerade läuft — sonst der nächste, notfalls an einem der
 * folgenden Tage.
 *
 * WARUM `now` HEREINGEREICHT WIRD und nicht in der Funktion entsteht: Der
 * Header rendert auf dem Server vor und im Browser noch einmal. Läse die
 * Funktion selbst die Uhr, stünden dort zwei verschiedene Zeiten und React
 * meldete einen Hydrations-Fehler. Der Aufrufer bestimmt den Zeitpunkt —
 * und ruft erst NACH dem Einhängen (siehe components/shell/StaffHeader).
 */
export function getCurrentBlock(blocks: TrainingBlock[], now: Date): CurrentBlock | null {
  const today = (now.getDay() + 6) % 7;
  const minutes = now.getHours() * 60 + now.getMinutes();

  for (const block of getBlocksForDay(blocks, today)) {
    const start = minutesOfDay(block.startTime);
    const end = minutesOfDay(block.endTime);
    if (minutes >= start && minutes < end) return { block, state: "now", dayOffset: 0 };
    if (minutes < start) return { block, state: "next", dayOffset: 0 };
  }

  // Feierabend: der erste Kurs des nächsten Tages, an dem überhaupt einer ist.
  // Bis 7, nicht bis 6 — sonst fände ein Sonntagabend den Sonntag nicht wieder.
  for (let offset = 1; offset <= 7; offset++) {
    const [first] = getBlocksForDay(blocks, (today + offset) % 7);
    if (first) return { block: first, state: "next", dayOffset: offset };
  }
  return null;
}
