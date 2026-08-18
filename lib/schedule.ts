import type { TrainingBlock } from "./types";

export const TRAINING_BLOCKS: TrainingBlock[] = [
  // ─── Montag (0) ───────────────────────────────────────────────────────────
  { id: "mon-01", weekday: 0, title: "Wing Tsung Kleine Helden", startTime: "16:15", endTime: "17:00", level: "kids", discipline: "wing-tsung" },
  { id: "mon-02", weekday: 0, title: "Wing Tsung Jugend", startTime: "17:15", endTime: "18:15", level: "teens", discipline: "wing-tsung" },
  { id: "mon-03", weekday: 0, title: "Wing Tsung Adult", startTime: "18:30", endTime: "20:00", level: "adult", discipline: "wing-tsung" },
  { id: "mon-04", weekday: 0, title: "MMA Advanced (Grappling)", startTime: "20:15", endTime: "21:45", level: "advanced", category: "wrestling", discipline: "wrestling" },

  // ─── Dienstag (1) ─────────────────────────────────────────────────────────
  { id: "tue-01", weekday: 1, title: "Karate Mixed", startTime: "15:00", endTime: "17:00", level: "mixed", discipline: "karate" },
  { id: "tue-02", weekday: 1, title: "Kickboxen Teens", startTime: "17:15", endTime: "18:15", level: "teens", category: "boxing", discipline: "kickboxen" },
  { id: "tue-03", weekday: 1, title: "Kickboxen Adult", startTime: "18:30", endTime: "20:00", level: "adult", category: "boxing", discipline: "kickboxen" },
  { id: "tue-04", weekday: 1, title: "MMA (Ringen)", startTime: "20:15", endTime: "21:45", category: "wrestling", discipline: "wrestling" },

  // ─── Mittwoch (2) ─────────────────────────────────────────────────────────
  { id: "wed-01", weekday: 2, title: "MMA Teens", startTime: "16:00", endTime: "17:00", level: "teens", discipline: "mma" },
  { id: "wed-02", weekday: 2, title: "MMA Teens", startTime: "17:15", endTime: "18:15", level: "teens", discipline: "mma" },
  { id: "wed-03", weekday: 2, title: "MMA Advanced (Sparring)", startTime: "18:30", endTime: "20:00", level: "advanced", discipline: "mma" },
  { id: "wed-04", weekday: 2, title: "MMA", startTime: "20:15", endTime: "21:45", discipline: "mma" },

  // ─── Donnerstag (3) ───────────────────────────────────────────────────────
  { id: "thu-01", weekday: 3, title: "MMA Mixed", startTime: "10:00", endTime: "11:30", level: "mixed", discipline: "mma" },
  { id: "thu-02", weekday: 3, title: "Muay Thai Teens", startTime: "16:00", endTime: "17:00", level: "teens", category: "muay-thai", discipline: "muay-thai" },
  { id: "thu-03", weekday: 3, title: "Wing Tsung Jugend", startTime: "17:15", endTime: "18:15", level: "teens", discipline: "wing-tsung" },
  { id: "thu-04", weekday: 3, title: "(Fitness-)Kickboxen", startTime: "18:30", endTime: "20:00", category: "boxing", discipline: "fitness-kickboxen" },
  { id: "thu-05", weekday: 3, title: "Muay Thai Adult", startTime: "20:15", endTime: "21:45", level: "adult", category: "muay-thai", discipline: "muay-thai" },

  // ─── Freitag (4) ──────────────────────────────────────────────────────────
  { id: "fri-01", weekday: 4, title: "MMA Teens", startTime: "16:00", endTime: "17:00", level: "teens", discipline: "mma" },
  { id: "fri-02", weekday: 4, title: "MMA Teens", startTime: "17:15", endTime: "18:15", level: "teens", discipline: "mma" },
  { id: "fri-03", weekday: 4, title: "MMA Advanced", startTime: "18:30", endTime: "20:00", level: "advanced", discipline: "mma" },
  { id: "fri-04", weekday: 4, title: "MMA", startTime: "20:15", endTime: "21:45", discipline: "mma" },

  // ─── Samstag (5) ──────────────────────────────────────────────────────────
  { id: "sat-01", weekday: 5, title: "MMA/Kickboxen Sparring", startTime: "10:00", endTime: "11:30", category: "boxing", discipline: "kickboxen" },
  { id: "sat-02", weekday: 5, title: "Karate Mixed", startTime: "18:00", endTime: "20:00", level: "mixed", discipline: "karate" },

  // ─── Sonntag (6) ──────────────────────────────────────────────────────────
  { id: "sun-01", weekday: 6, title: "Open Mat für Mitglieder", startTime: "10:00", endTime: "12:00" },
];

export const WEEKDAY_LABELS = [
  "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag",
];

export const WEEKDAY_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

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

/** Blöcke für einen bestimmten Wochentag */
export function getBlocksForDay(weekday: number): TrainingBlock[] {
  return TRAINING_BLOCKS.filter((b) => b.weekday === weekday);
}
