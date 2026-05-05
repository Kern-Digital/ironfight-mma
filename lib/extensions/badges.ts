/**
 * Badges / XP / Level-System (Stub)
 *
 * Architektonische Vorbereitung. Badges werden später basierend auf
 * Workout-Logs, Streaks und Technik-Fortschritt vergeben.
 */

import type { Badge } from "../types";

/** Statische Liste möglicher Badges — kann später dynamisch unlocked werden. */
export const AVAILABLE_BADGES: Badge[] = [
  {
    id: "first_workout",
    label: "Erstes Workout",
    description: "Du hast dein erstes Workout abgeschlossen.",
  },
  {
    id: "streak_7",
    label: "7 Tage Streak",
    description: "7 Tage in Folge trainiert.",
  },
  {
    id: "streak_30",
    label: "30 Tage Streak",
    description: "30 Tage in Folge trainiert. Beast-Mode.",
  },
  {
    id: "boxing_fundamentals",
    label: "Boxing-Grundlagen",
    description: "Alle Anfänger-Techniken im Boxing gemeistert.",
  },
  {
    id: "wrestling_takedowns",
    label: "Wrestling-Takedowns",
    description: "Single- & Double-Leg in Sparring eingesetzt.",
  },
  {
    id: "bjj_first_submission",
    label: "Erste BJJ-Submission",
    description: "Erstes Tap durch Submission im Sparring.",
  },
];

/** XP-Berechnung — Stub für späteres Level-System. */
export function xpForWorkout(seconds: number): number {
  return Math.round(seconds / 60); // 1 XP pro Minute
}

export function levelForXp(xp: number): { level: number; nextAt: number } {
  // Quadratisch wachsende Schwellen: Level n = n^2 * 50 XP
  let level = 1;
  while (xp >= level * level * 50) level += 1;
  return { level, nextAt: level * level * 50 };
}
