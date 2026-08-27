/**
 * Eingebaute Start-Pläne — Fallback, solange ein Gym noch keine eigenen
 * Workout-Pläne in Firestore hat (gyms/{gymId}/workoutPlans).
 *
 * Seit Teilschritt 2 der Etappe „Workout-Pläne": pro Disziplin × Level
 * mindestens ein Plan (Boxing/Anfänger zwei, damit die Planliste als Liste
 * erlebbar ist). Struktur folgt dem klassischen Session-Aufbau Aufwärmen →
 * Technik → Konditionierung → Cooldown; Pro unterscheidet sich über
 * Übungsauswahl, Blockdichte und kürzere Pausen, nicht zwingend über Länge.
 * Alle Dauer-/Runden-/Equipment-Werte kommen aus der Übungs-DB
 * (lib/exercises) — die Pläne referenzieren nur IDs.
 *
 * Das ist die KI-ERSTAUSARBEITUNG (Leons Vorgabe: KI arbeitet aus, Trainer
 * prüfen nur). Der recherche-gestützte Feinschliff + das Seeden nach
 * Firestore folgen in Etappen-Schritt 5 — danach greift dieser Fallback
 * nicht mehr. Slugs sind plan-spezifisch (disziplin-name), nicht mehr nur
 * die Disziplin.
 */

import { DEFAULT_GYM_ID } from "./gym";
import type { Category } from "./types";
import type { WorkoutPlan } from "./workout-plans";

// ─── Disziplin-Einstieg (Ebene 1 des Training-Tabs) ────────────────────────

export interface WorkoutDisciplineInfo {
  /** Vier Kern-Disziplinen — später die frei konfigurierten Gym-Rubriken */
  discipline: Category;
  name: string;
  /** Eine Zeile für die Disziplin-Karte im Hub */
  short: string;
}

export const WORKOUT_DISCIPLINES: WorkoutDisciplineInfo[] = [
  {
    discipline: "boxing",
    name: "Boxing",
    short: "Footwork, Combinations, Defense.",
  },
  {
    discipline: "wrestling",
    name: "Wrestling",
    short: "Takedowns, Sprawls, Kontrolle.",
  },
  {
    discipline: "bjj",
    name: "Brazilian Jiu-Jitsu",
    short: "Submissions, Sweeps, Guards.",
  },
  {
    discipline: "muay-thai",
    name: "Muay Thai",
    short: "Knies, Ellbogen, Clinch.",
  },
];

export function getWorkoutDiscipline(
  discipline: string,
): WorkoutDisciplineInfo | undefined {
  return WORKOUT_DISCIPLINES.find((d) => d.discipline === discipline);
}

// ─── Start-Pläne ───────────────────────────────────────────────────────────

export const DEFAULT_WORKOUT_PLANS: WorkoutPlan[] = [
  // ── Boxing ──────────────────────────────────────────────────────────────
  {
    id: "boxing-fundament",
    slug: "boxing-fundament",
    gymId: DEFAULT_GYM_ID,
    discipline: "boxing",
    difficulty: "anfaenger",
    name: "Fundament",
    short: "Saubere Basics am Sack und an den Pratzen.",
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
    id: "boxing-shadow-footwork",
    slug: "boxing-shadow-footwork",
    gymId: DEFAULT_GYM_ID,
    discipline: "boxing",
    difficulty: "anfaenger",
    name: "Shadow & Footwork",
    short: "Komplett ohne Geräte — überall machbar.",
    description:
      "Reines Bodyweight-Boxing: Schattenboxen, Beinarbeit und Verteidigung. Ideal für zuhause oder unterwegs — kein Equipment nötig.",
    sortOrder: 2,
    blocks: [
      {
        title: "Aufwärmen",
        phase: "warmup",
        restSeconds: 20,
        exerciseIds: ["warmup_jumping_jacks", "warmup_shadowbox"],
      },
      {
        title: "Technik",
        phase: "main",
        restSeconds: 45,
        exerciseIds: ["boxing_shadow_combos", "boxing_defense_drill"],
      },
      {
        title: "Konditionierung",
        phase: "conditioning",
        restSeconds: 20,
        exerciseIds: ["cond_pushups", "cond_squats", "cond_sit_ups"],
      },
      {
        title: "Cooldown",
        phase: "cooldown",
        restSeconds: 0,
        exerciseIds: ["cooldown_stretch"],
      },
    ],
  },
  {
    id: "boxing-power-kombis",
    slug: "boxing-power-kombis",
    gymId: DEFAULT_GYM_ID,
    discipline: "boxing",
    difficulty: "fortgeschritten",
    name: "Power & Kombis",
    short: "Dreier-Kombinationen mit Schlagkraft-Arbeit.",
    description:
      "Längere Kombinationen am Sack und an den Pratzen, danach Schlagkraft- und Core-Arbeit mit Gewichten. Für Boxer mit sauberer Grundtechnik.",
    sortOrder: 3,
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
          "boxing_jab_cross_hook_bag",
          "boxing_pad_combos",
          "boxing_defense_drill",
        ],
      },
      {
        title: "Konditionierung",
        phase: "conditioning",
        restSeconds: 30,
        exerciseIds: ["cond_dumbbell_punches", "cond_med_ball_slams"],
      },
      {
        title: "Cooldown",
        phase: "cooldown",
        restSeconds: 0,
        exerciseIds: ["cooldown_stretch"],
      },
    ],
  },
  {
    id: "boxing-fight-camp",
    slug: "boxing-fight-camp",
    gymId: DEFAULT_GYM_ID,
    discipline: "boxing",
    difficulty: "pro",
    name: "Fight-Camp-Runde",
    short: "Hohe Dichte, kurze Pausen — Wettkampf-Rhythmus.",
    description:
      "Kampfnahe Session mit verkürzten Pausen: viel Volumen am Sack und an den Pratzen, danach explosive Konditionierung. Nur mit stabiler Grundlage trainieren.",
    sortOrder: 4,
    blocks: [
      {
        title: "Aufwärmen",
        phase: "warmup",
        restSeconds: 20,
        exerciseIds: ["warmup_jump_rope"],
      },
      {
        title: "Technik",
        phase: "main",
        restSeconds: 45,
        exerciseIds: [
          "boxing_jab_cross_hook_bag",
          "boxing_shadow_combos",
          "boxing_pad_combos",
        ],
      },
      {
        title: "Konditionierung",
        phase: "conditioning",
        restSeconds: 20,
        exerciseIds: ["cond_burpees", "cond_kb_swings_20", "cond_dumbbell_punches"],
      },
      {
        title: "Cooldown",
        phase: "cooldown",
        restSeconds: 0,
        exerciseIds: ["cooldown_breathing"],
      },
    ],
  },

  // ── Wrestling ───────────────────────────────────────────────────────────
  {
    id: "wrestling-takedown-basics",
    slug: "wrestling-takedown-basics",
    gymId: DEFAULT_GYM_ID,
    discipline: "wrestling",
    difficulty: "anfaenger",
    name: "Takedown-Basics",
    short: "Stand, Penetration Step, erster Single Leg.",
    description:
      "Einstieg ins Wrestling: sauberer Stand, Penetration Steps und der erste Single Leg. Sprawls in kurzen Intervallen, moderates Tempo.",
    sortOrder: 1,
    blocks: [
      {
        title: "Aufwärmen",
        phase: "warmup",
        restSeconds: 30,
        exerciseIds: ["warmup_stance_motion", "warmup_jumping_jacks"],
      },
      {
        title: "Takedowns",
        phase: "main",
        restSeconds: 40,
        exerciseIds: [
          "wrestling_penetration_drill",
          "wrestling_single_leg_drill",
          "wrestling_sprawl_drill",
        ],
      },
      {
        title: "Konditionierung",
        phase: "conditioning",
        restSeconds: 30,
        exerciseIds: ["cond_squats", "cond_sit_ups"],
      },
      {
        title: "Cooldown",
        phase: "cooldown",
        restSeconds: 0,
        exerciseIds: ["cooldown_stretch"],
      },
    ],
  },
  {
    id: "wrestling-takedowns-sprawls",
    slug: "wrestling-takedowns-sprawls",
    gymId: DEFAULT_GYM_ID,
    discipline: "wrestling",
    difficulty: "fortgeschritten",
    name: "Takedowns & Sprawls",
    short: "Single, Double und Sprawl in hoher Schlagzahl.",
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
    id: "wrestling-matten-motor",
    slug: "wrestling-matten-motor",
    gymId: DEFAULT_GYM_ID,
    discipline: "wrestling",
    difficulty: "pro",
    name: "Matten-Motor",
    short: "Takedown-Ketten plus schwerer Kraft-Zirkel.",
    description:
      "Wettkampfnahe Dichte: Takedown-Ketten mit minimaler Pause, danach Wrestler-Leiter und schwere Explosiv-Arbeit. Für erfahrene Ringer.",
    sortOrder: 3,
    blocks: [
      {
        title: "Aufwärmen",
        phase: "warmup",
        restSeconds: 20,
        exerciseIds: ["warmup_stance_motion"],
      },
      {
        title: "Takedowns",
        phase: "main",
        restSeconds: 30,
        exerciseIds: [
          "wrestling_penetration_drill",
          "wrestling_double_leg_drill",
          "wrestling_sprawl_drill",
        ],
      },
      {
        title: "Konditionierung",
        phase: "conditioning",
        restSeconds: 30,
        exerciseIds: [
          "cond_wrestler_ladder",
          "cond_kb_swings_20",
          "cond_med_ball_slams",
        ],
      },
      {
        title: "Cooldown",
        phase: "cooldown",
        restSeconds: 0,
        exerciseIds: ["cooldown_breathing"],
      },
    ],
  },

  // ── Brazilian Jiu-Jitsu ─────────────────────────────────────────────────
  {
    id: "bjj-grundlinie-boden",
    slug: "bjj-grundlinie-boden",
    gymId: DEFAULT_GYM_ID,
    discipline: "bjj",
    difficulty: "anfaenger",
    name: "Grundlinie Boden",
    short: "Solo-Movements und erstes Positions-Sparring.",
    description:
      "Bodenkampf-Einstieg: Shrimpen, Solo-Movements und Positions-Sparring in ruhigem Tempo. Saubere Mechanik vor Geschwindigkeit — Position vor Submission.",
    sortOrder: 1,
    blocks: [
      {
        title: "Solo-Movements",
        phase: "warmup",
        restSeconds: 15,
        exerciseIds: ["warmup_solo_drills_bjj", "bjj_shrimp_drill"],
      },
      {
        title: "Sparring",
        phase: "main",
        restSeconds: 30,
        exerciseIds: ["bjj_positional_sparring"],
      },
      {
        title: "Konditionierung",
        phase: "conditioning",
        restSeconds: 20,
        exerciseIds: ["cond_pushups", "cond_sit_ups"],
      },
      {
        title: "Cooldown",
        phase: "cooldown",
        restSeconds: 0,
        exerciseIds: ["cooldown_stretch"],
      },
    ],
  },
  {
    id: "bjj-submission-kette",
    slug: "bjj-submission-kette",
    gymId: DEFAULT_GYM_ID,
    discipline: "bjj",
    difficulty: "fortgeschritten",
    name: "Submission-Kette",
    short: "Armbar und Triangle in Wiederholung, dann Sparring.",
    description:
      "Bodenkampf-Session. Saubere Mechanik vor Geschwindigkeit — Armbar- und Triangle-Wiederholungen, danach Positions-Sparring.",
    sortOrder: 2,
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
      {
        title: "Cooldown",
        phase: "cooldown",
        restSeconds: 0,
        exerciseIds: ["cooldown_stretch"],
      },
    ],
  },
  {
    id: "bjj-rolling-intensiv",
    slug: "bjj-rolling-intensiv",
    gymId: DEFAULT_GYM_ID,
    discipline: "bjj",
    difficulty: "pro",
    name: "Rolling Intensiv",
    short: "Submission-Ketten und Sparring mit Minimal-Pausen.",
    description:
      "Hohe Dichte am Boden: Submission-Wiederholungen und Positions-Sparring mit minimalen Pausen, abgeschlossen mit explosiver Konditionierung.",
    sortOrder: 3,
    blocks: [
      {
        title: "Solo-Movements",
        phase: "warmup",
        restSeconds: 10,
        exerciseIds: ["bjj_shrimp_drill", "warmup_solo_drills_bjj"],
      },
      {
        title: "Technik",
        phase: "main",
        restSeconds: 20,
        exerciseIds: ["bjj_armbar_reps", "bjj_triangle_reps"],
      },
      {
        title: "Sparring",
        phase: "main",
        restSeconds: 45,
        exerciseIds: ["bjj_positional_sparring"],
      },
      {
        title: "Konditionierung",
        phase: "conditioning",
        restSeconds: 20,
        exerciseIds: ["cond_burpees", "cond_kb_swings_20"],
      },
      {
        title: "Cooldown",
        phase: "cooldown",
        restSeconds: 0,
        exerciseIds: ["cooldown_breathing"],
      },
    ],
  },

  // ── Muay Thai ───────────────────────────────────────────────────────────
  {
    id: "muay-thai-acht-waffen",
    slug: "muay-thai-acht-waffen",
    gymId: DEFAULT_GYM_ID,
    discipline: "muay-thai",
    difficulty: "anfaenger",
    name: "Acht Waffen",
    short: "Teep, Kicks und Knie — die Grundschule.",
    description:
      "Muay Thai mit allen acht Gliedmaßen. Schienbein-Konditionierung, schwere Kicks, Pratzenarbeit.",
    sortOrder: 1,
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
  {
    id: "muay-thai-pratzen-power",
    slug: "muay-thai-pratzen-power",
    gymId: DEFAULT_GYM_ID,
    discipline: "muay-thai",
    difficulty: "fortgeschritten",
    name: "Pratzen & Power",
    short: "Kick-Volumen am Sack plus Explosiv-Arbeit.",
    description:
      "Kick-Volumen am schweren Sack, lange Pratzen-Runden und explosive Kraft mit Kettlebell und Medizinball. Für Thaiboxer mit sicherer Grundtechnik.",
    sortOrder: 2,
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
        restSeconds: 45,
        exerciseIds: ["muaythai_kick_bag", "muaythai_pad_combos"],
      },
      {
        title: "Konditionierung",
        phase: "conditioning",
        restSeconds: 30,
        exerciseIds: ["cond_kb_swings_10", "cond_med_ball_slams"],
      },
      {
        title: "Cooldown",
        phase: "cooldown",
        restSeconds: 0,
        exerciseIds: ["cooldown_stretch"],
      },
    ],
  },
  {
    id: "muay-thai-clinch-druck",
    slug: "muay-thai-clinch-druck",
    gymId: DEFAULT_GYM_ID,
    discipline: "muay-thai",
    difficulty: "pro",
    name: "Clinch & Druck",
    short: "Volles Technik-Volumen mit Minimal-Pausen.",
    description:
      "Wettkampfnahe Session: Teep, Kicks, Knie und Pratzen in dichter Folge mit verkürzten Pausen, danach explosive Konditionierung.",
    sortOrder: 3,
    blocks: [
      {
        title: "Aufwärmen",
        phase: "warmup",
        restSeconds: 20,
        exerciseIds: ["warmup_jump_rope"],
      },
      {
        title: "Technik",
        phase: "main",
        restSeconds: 30,
        exerciseIds: [
          "muaythai_teep_bag",
          "muaythai_kick_bag",
          "muaythai_knee_clinch",
          "muaythai_pad_combos",
        ],
      },
      {
        title: "Konditionierung",
        phase: "conditioning",
        restSeconds: 20,
        exerciseIds: ["cond_burpees", "cond_kb_swings_20"],
      },
      {
        title: "Cooldown",
        phase: "cooldown",
        restSeconds: 0,
        exerciseIds: ["cooldown_breathing"],
      },
    ],
  },
];

export function getDefaultPlanBySlug(slug: string): WorkoutPlan | undefined {
  return DEFAULT_WORKOUT_PLANS.find((p) => p.slug === slug);
}

/** Pläne einer Disziplin, nach sortOrder (fehlt = ans Ende), dann Name. */
export function defaultPlansForDiscipline(discipline: string): WorkoutPlan[] {
  return DEFAULT_WORKOUT_PLANS.filter((p) => p.discipline === discipline).sort(
    (a, b) => {
      const oa = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const ob = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
      if (oa !== ob) return oa - ob;
      return a.name.localeCompare(b.name, "de");
    },
  );
}
