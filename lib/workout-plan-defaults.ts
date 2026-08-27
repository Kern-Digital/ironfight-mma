/**
 * Eingebaute Start-Pläne — Fallback, solange ein Gym noch keine eigenen
 * Workout-Pläne in Firestore hat (gyms/{gymId}/workoutPlans).
 *
 * Inhaltlich sind das die vier alten Text-Pläne (lib/training-plans.ts,
 * ersetzt 2026-08), neu ausgedrückt über Übungs-IDs aus lib/exercises —
 * Freitext-Format/Notes sind bewusst weg, Dauer/Runden/Equipment kommen
 * jetzt aus der Übungs-DB. Die echten Start-Pläne pro Disziplin × Level
 * werden in Etappen-Schritt 5 per KI ausgearbeitet, von den Trainern
 * geprüft und dann als Gym-Inhalt in Firestore gepflegt — danach greift
 * dieser Fallback nicht mehr.
 *
 * Die Slugs (boxing, wrestling, bjj, muay-thai) bleiben erhalten, damit
 * bestehende Deep-Links /workout/plans/[slug] weiter funktionieren.
 */

import { DEFAULT_GYM_ID } from "./gym";
import type { WorkoutPlan } from "./workout-plans";

export const DEFAULT_WORKOUT_PLANS: WorkoutPlan[] = [
  {
    id: "boxing",
    slug: "boxing",
    gymId: DEFAULT_GYM_ID,
    discipline: "boxing",
    difficulty: "anfaenger",
    name: "Boxing",
    short: "Footwork, Combinations, Defense.",
    description:
      "Klassisches Boxing-Workout. Fokus auf saubere Technik, Bewegung und Konditionierung.",
    sortOrder: 1,
    blocks: [
      {
        title: "Aufwärmen",
        phase: "warmup",
        restSeconds: 30,
        exerciseIds: ["warmup_jump_rope", "warmup_shadowbox"],
      },
      {
        title: "Technik",
        phase: "main",
        restSeconds: 60,
        exerciseIds: [
          "boxing_jab_cross_bag",
          "boxing_defense_drill",
          "boxing_pad_combos",
        ],
      },
      {
        title: "Konditionierung",
        phase: "conditioning",
        restSeconds: 30,
        exerciseIds: ["cond_burpees", "cond_sit_ups"],
      },
    ],
  },
  {
    id: "wrestling",
    slug: "wrestling",
    gymId: DEFAULT_GYM_ID,
    discipline: "wrestling",
    difficulty: "fortgeschritten",
    name: "Wrestling",
    short: "Takedowns, Sprawls, Kontrolle.",
    description:
      "Wrestling-Session mit Fokus auf Stand & Motion, Penetration Steps und Takedowns. Hohe Intensität, kurze Pausen.",
    sortOrder: 2,
    blocks: [
      {
        title: "Aufwärmen",
        phase: "warmup",
        restSeconds: 30,
        exerciseIds: ["warmup_stance_motion", "wrestling_penetration_drill"],
      },
      {
        title: "Takedowns",
        phase: "main",
        restSeconds: 30,
        exerciseIds: [
          "wrestling_single_leg_drill",
          "wrestling_double_leg_drill",
          "wrestling_sprawl_drill",
        ],
      },
      {
        title: "Live",
        phase: "conditioning",
        restSeconds: 60,
        exerciseIds: ["cond_wrestler_ladder"],
      },
    ],
  },
  {
    id: "bjj",
    slug: "bjj",
    gymId: DEFAULT_GYM_ID,
    discipline: "bjj",
    difficulty: "anfaenger",
    name: "Brazilian Jiu-Jitsu",
    short: "Submissions, Sweeps, Guards.",
    description:
      "Bodenkampf-Session. Saubere Mechanik vor Geschwindigkeit — Position vor Submission.",
    sortOrder: 3,
    blocks: [
      {
        title: "Solo-Movements",
        phase: "warmup",
        restSeconds: 15,
        exerciseIds: ["warmup_solo_drills_bjj", "bjj_shrimp_drill"],
      },
      {
        title: "Technik",
        phase: "main",
        restSeconds: 30,
        exerciseIds: ["bjj_armbar_reps", "bjj_triangle_reps"],
      },
      {
        title: "Sparring",
        phase: "main",
        restSeconds: 60,
        exerciseIds: ["bjj_positional_sparring"],
      },
    ],
  },
  {
    id: "muay-thai",
    slug: "muay-thai",
    gymId: DEFAULT_GYM_ID,
    discipline: "muay-thai",
    difficulty: "anfaenger",
    name: "Muay Thai",
    short: "Knies, Ellbogen, Clinch.",
    description:
      "Muay Thai mit allen acht Gliedmaßen. Schienbein-Konditionierung, schwere Kicks, Pratzenarbeit.",
    sortOrder: 4,
    blocks: [
      {
        title: "Aufwärmen",
        phase: "warmup",
        restSeconds: 30,
        exerciseIds: ["warmup_jump_rope", "muaythai_shin_conditioning"],
      },
      {
        title: "Technik",
        phase: "main",
        restSeconds: 60,
        exerciseIds: [
          "muaythai_teep_bag",
          "muaythai_kick_bag",
          "muaythai_knee_clinch",
        ],
      },
      {
        title: "Pratzen",
        phase: "main",
        restSeconds: 60,
        exerciseIds: ["muaythai_pad_combos"],
      },
    ],
  },
];

export function getDefaultPlanBySlug(slug: string): WorkoutPlan | undefined {
  return DEFAULT_WORKOUT_PLANS.find((p) => p.slug === slug);
}
