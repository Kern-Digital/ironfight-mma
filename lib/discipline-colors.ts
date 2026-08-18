/**
 * Zentrale Disziplin-Farben — die EINZIGE Quelle für Disziplin-/Kampfbereich-
 * Farbcodierung in der ganzen App (Vorgabe des Users, Aug 2026):
 *
 *   Eine Rubrik = überall dieselbe Farbe. Wer einen Schlag, Kick oder Wurf
 *   sieht, soll allein an der Farbe erkennen, zu welcher Disziplin er gehört —
 *   auf der Startseite, in der Bibliothek, im Stundenplan, in Workout-Plänen
 *   und in allen Trainer-Charts (Fight-DNA-Split, Technik-Statistik).
 *
 * Die 5 Kampf-Familien:
 *   Schläge/Boxen = Cyan · Kicks (Muay Thai, Kickboxen, Karate) = Violett ·
 *   Wrestling/Takedowns/Würfe = Pink · Boden/BJJ = Amber · Clinch = Mint
 *
 * WICHTIG: Innerhalb EINES Charts dürfen nie zwei ähnliche Töne stehen —
 * deshalb ist #9D7BFA (Hell-Violett, KI-Akzent) hier bewusst NICHT vergeben.
 * Neue Farbzuordnungen immer hier ergänzen, nie lokal in Komponenten.
 */

import type { Category, Discipline } from "@/lib/types";

/** Grundfarben der 5 Kampf-Familien. */
export const FIGHT_FAMILY_COLOR = {
  /** Schläge / Boxen */
  striking: "#23C4CE",
  /** Kicks / Muay Thai / Kickboxen / Karate */
  kicks: "#8A63E8",
  /** Wrestling / Takedowns / Würfe */
  wrestling: "#FF4FA8",
  /** Boden / BJJ */
  ground: "#FFB648",
  /** Clinch */
  clinch: "#3EE06B",
} as const;

/** Neutralfarben für Misch- bzw. Sonderdisziplinen (keine Kampf-Familie). */
export const MIXED_DISCIPLINE_COLOR = "#F0EEF9"; // MMA = alles → neutral hell
export const NEUTRAL_DISCIPLINE_COLOR = "#9CA3AF"; // Self-Defense/Wing Tsung

/** Hauptkategorien (Startseite, Workouts, Bibliothek, Stundenplan). */
export const CATEGORY_COLOR: Record<Category, string> = {
  boxing: FIGHT_FAMILY_COLOR.striking,
  wrestling: FIGHT_FAMILY_COLOR.wrestling,
  bjj: FIGHT_FAMILY_COLOR.ground,
  "muay-thai": FIGHT_FAMILY_COLOR.kicks,
};

/** Fein-Disziplinen (Kurs-/Technik-Zuordnung). */
export const DISCIPLINE_COLOR: Record<Discipline, string> = {
  boxing: FIGHT_FAMILY_COLOR.striking,
  kickboxen: FIGHT_FAMILY_COLOR.kicks,
  "muay-thai": FIGHT_FAMILY_COLOR.kicks,
  "fitness-kickboxen": FIGHT_FAMILY_COLOR.kicks,
  karate: FIGHT_FAMILY_COLOR.kicks,
  wrestling: FIGHT_FAMILY_COLOR.wrestling,
  bjj: FIGHT_FAMILY_COLOR.ground,
  mma: MIXED_DISCIPLINE_COLOR,
  "wing-tsung": NEUTRAL_DISCIPLINE_COLOR,
  "self-defense": NEUTRAL_DISCIPLINE_COLOR,
};
