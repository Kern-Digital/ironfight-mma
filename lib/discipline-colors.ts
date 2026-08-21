/**
 * Zentrale Disziplin-Farben — die EINZIGE Quelle für Disziplin-/Kampfbereich-
 * Farbcodierung in der ganzen App (Vorgabe des Users, Aug 2026):
 *
 *   Eine Rubrik = überall dieselbe Farbe. Wer einen Schlag, Kick oder Wurf
 *   sieht, soll allein an der Farbe erkennen, zu welcher Disziplin er gehört —
 *   auf der Startseite, in der Bibliothek, im Stundenplan, in Workout-Plänen
 *   und in allen Trainer-Charts (Fight-DNA-Split, Technik-Statistik).
 *
 * Seit dem Redesign (2026-08) sind die Werte CSS-Variablen (--cat-* in
 * app/globals.css) statt Hex: Dark und Light bekommen so automatisch die
 * passende Abstufung, und Multi-Gym Phase 3 kann die Slots später frei
 * konfigurierten Gym-Rubriken zuweisen. KONSEQUENZ: Transparenz-Varianten
 * NIE per Hex-Alpha-Anhang (`${color}66`) bilden, sondern mit
 * `color-mix(in oklab, ${color} 40%, transparent)`.
 *
 * Die 5 Kampf-Familien:
 *   Schläge/Boxen = Cyan · Kicks (Muay Thai, Kickboxen, Karate) = Violett ·
 *   Wrestling/Takedowns/Würfe = Pink · Boden/BJJ = Amber · Clinch = Mint
 *
 * WICHTIG: Innerhalb EINES Charts dürfen nie zwei ähnliche Töne stehen —
 * deshalb ist das helle KI-Violett (--accent-2) hier bewusst NICHT vergeben.
 * Neue Farbzuordnungen immer hier ergänzen, nie lokal in Komponenten.
 */

import type { Category, Discipline } from "@/lib/types";

/** Grundfarben der 5 Kampf-Familien. */
export const FIGHT_FAMILY_COLOR = {
  /** Schläge / Boxen */
  striking: "var(--cat-1)",
  /** Kicks / Muay Thai / Kickboxen / Karate */
  kicks: "var(--cat-2)",
  /** Wrestling / Takedowns / Würfe */
  wrestling: "var(--cat-3)",
  /** Boden / BJJ */
  ground: "var(--cat-4)",
  /** Clinch */
  clinch: "var(--cat-5)",
} as const;

/** Neutralfarben für Misch- bzw. Sonderdisziplinen (keine Kampf-Familie). */
export const MIXED_DISCIPLINE_COLOR = "var(--cat-mixed)"; // MMA = alles → neutral
export const NEUTRAL_DISCIPLINE_COLOR = "var(--cat-neutral)"; // Self-Defense/Wing Tsung

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
