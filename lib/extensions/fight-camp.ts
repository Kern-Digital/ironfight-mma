/**
 * Fight-Camp-Mode (Stub)
 *
 * Architektonische Vorbereitung für eine spätere Fight-Camp-Funktion:
 * 4-, 8- oder 12-Wochen-Programme mit Wochenplänen, Tagesplänen und
 * automatischer Workout-Zuteilung. Nicht funktional, aber bereits vom
 * Type-System abgedeckt.
 */

import type { Category, Difficulty, FightCampPlan } from "../types";

export interface FightCampDayPlan {
  day: number;
  workoutIds: string[];
  /** Optional: Notiz für den Tag (Sparring, Recovery, etc.) */
  note?: string;
}

export interface FightCampWeek {
  weekNumber: number;
  focus: string; // z. B. "Konditionierung", "Technik-Refresh"
  days: FightCampDayPlan[];
}

export interface FightCampInput {
  weeks: 4 | 8 | 12;
  category: Category;
  difficulty: Difficulty;
  daysPerWeek: number;
  startsAt: Date;
}

/**
 * Erstellt ein leeres Fight-Camp-Skelett.
 * Spätere Implementierung wird hier aus der Workout-/Übungs-Bibliothek
 * progressive Pläne generieren.
 */
export function createFightCampSkeleton(input: FightCampInput): FightCampPlan {
  const ms = input.startsAt.getTime();
  const endsAt = new Date(ms + input.weeks * 7 * 24 * 3600 * 1000);
  return {
    id: `camp-${ms}`,
    weeks: input.weeks,
    category: input.category,
    startsAt: input.startsAt,
    endsAt,
    schedule: [],
  };
}
