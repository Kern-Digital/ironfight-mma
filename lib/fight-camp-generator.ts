/**
 * Fight-Camp-Plan-Generator
 *
 * Erzeugt einen 4-Phasen-Vorbereitungsplan basierend auf:
 *   • Trainings-Historie (Stärken/Schwächen-Analyse)
 *   • Gegner-Profil (Stil → relevante Bereiche)
 *   • Anzahl Wochen bis zum Kampf
 *
 * Methodisch: Aus der Master-Technik-DB werden Techniken gefiltert nach
 *   • Disziplin = MMA-tauglich (boxing/mma/muay-thai/wrestling/bjj)
 *   • TrainingArea passt zur Phase + den Critical Gaps
 *   • Difficulty/Level passt zum Schüler-Level
 *
 * Übungen kommen aus der Exercise-DB, gefiltert nach Phase + Intensität.
 *
 * Kein KI-System, sondern eine erklärbare Heuristik. Trainer darf den Plan
 * danach frei editieren (im UI).
 */

import { ALL_TECHNIQUES } from "./techniques";
import { EXERCISES } from "./exercises";
import {
  distributePhaseWeeks,
  type FightCamp,
  type FightCampPhase,
  type FightCampPhaseBlock,
  type OpponentProfile,
} from "./fight-camp";
import {
  recommendFocus,
  type TrainingHistoryAnalysis,
} from "./fight-camp-analysis";
import type {
  AthleteLevel,
  Category,
  TrainingArea,
} from "./types";

// ─── Phasen-Charakteristik ─────────────────────────────────────────────────

interface PhaseSpec {
  focus: string;
  /** Welche TrainingArea-Tags soll diese Phase bevorzugt aufgreifen */
  preferredAreas: TrainingArea[];
  /** Welche difficulties sind erlaubt */
  difficulties: Array<"anfaenger" | "fortgeschritten" | "pro">;
  /** Empfohlene Sessions/Woche */
  sessionsPerWeek: number;
  /** Sparring-Anteil */
  sparringRatio: number;
  /** Wie viele Techniken in der Phase empfehlen */
  techniqueTarget: number;
  /** Wie viele Übungen */
  exerciseTarget: number;
  /** Bevorzugte Exercise-Kinds */
  preferredExerciseKinds: Array<"warmup" | "technique" | "conditioning" | "cooldown">;
}

const PHASE_SPECS: Record<FightCampPhase, PhaseSpec> = {
  foundation: {
    focus:
      "Volumen-Aufbau, technische Sauberkeit, Grundkondition. Hier wird das Fundament gelegt, auf dem später Schwerpunkte stehen.",
    preferredAreas: [
      "stand-up",
      "footwork",
      "punches",
      "drills",
      "defense",
      "combos",
      "ground-control",
    ],
    difficulties: ["anfaenger", "fortgeschritten"],
    sessionsPerWeek: 4,
    sparringRatio: 0.1,
    techniqueTarget: 10,
    exerciseTarget: 8,
    preferredExerciseKinds: ["warmup", "technique", "conditioning"],
  },
  "specific-prep": {
    focus:
      "Gegnerspezifische Schwerpunkte. Lücken aus der Analyse schließen, Stärken weiter ausbauen. Gameplan-Drills.",
    preferredAreas: [], // wird aus Gap-Analyse befüllt
    difficulties: ["fortgeschritten", "pro"],
    sessionsPerWeek: 5,
    sparringRatio: 0.25,
    techniqueTarget: 12,
    exerciseTarget: 8,
    preferredExerciseKinds: ["technique", "conditioning"],
  },
  "sparring-simulation": {
    focus:
      "Hartes Sparring, Kampfsimulation. Gameplan unter Druck. Cardio-Spitze. Reaktionszeit. Mentale Härte.",
    preferredAreas: [
      "combos",
      "defense",
      "transitions",
      "clinch",
      "takedown-defense",
    ],
    difficulties: ["fortgeschritten", "pro"],
    sessionsPerWeek: 5,
    sparringRatio: 0.5,
    techniqueTarget: 8,
    exerciseTarget: 6,
    preferredExerciseKinds: ["technique", "conditioning"],
  },
  taper: {
    focus:
      "Belastung reduzieren, Schärfe behalten. Kein hartes Sparring mehr. Mobility, leichte Drills, mentale Vorbereitung. Gewichtsmanagement.",
    preferredAreas: ["footwork", "drills", "combos"],
    difficulties: ["fortgeschritten"],
    sessionsPerWeek: 3,
    sparringRatio: 0.05,
    techniqueTarget: 5,
    exerciseTarget: 4,
    preferredExerciseKinds: ["warmup", "cooldown", "technique"],
  },
};

// ─── Hilfsmittel ───────────────────────────────────────────────────────────

function techniqueAreas(t: (typeof ALL_TECHNIQUES)[number]): TrainingArea[] {
  return Array.isArray(t.trainingArea)
    ? t.trainingArea
    : t.trainingArea
      ? [t.trainingArea]
      : [];
}

/** Level → erlaubte Schwierigkeitsstufen */
function difficultiesForLevel(
  level: AthleteLevel | null | undefined,
): Array<"anfaenger" | "fortgeschritten" | "pro"> {
  switch (level) {
    case "beginner":
      return ["anfaenger"];
    case "intermediate":
      return ["anfaenger", "fortgeschritten"];
    case "advanced":
      return ["fortgeschritten", "pro"];
    case "competitor":
      return ["fortgeschritten", "pro"];
    default:
      return ["anfaenger", "fortgeschritten"];
  }
}

/**
 * Filtert Techniken passend zur Phase + bevorzugten Bereichen + Disziplin.
 * Sortiert nach Relevanz (Schnittmenge mit preferredAreas).
 */
function pickTechniques(
  phase: FightCampPhase,
  preferredAreas: TrainingArea[],
  categories: Category[],
  level: AthleteLevel | null | undefined,
  target: number,
): string[] {
  const spec = PHASE_SPECS[phase];
  const levelDiffs = difficultiesForLevel(level);
  const allowedDiffs = spec.difficulties.filter((d) => levelDiffs.includes(d));
  const areaSet = new Set<TrainingArea>(preferredAreas);

  const scored = ALL_TECHNIQUES.map((t) => {
    if (!categories.includes(t.category)) return null;
    if (!allowedDiffs.includes(t.difficulty)) return null;
    const areas = techniqueAreas(t);
    const matchCount = areas.filter((a) => areaSet.has(a)).length;
    // Priorität: matchCount × 10, plus Core/Support-Bonus
    const roleBonus =
      t.role === "core"
        ? 3
        : t.role === "support"
          ? 1
          : t.role === "combo"
            ? 2
            : 0;
    const score = matchCount * 10 + roleBonus + (t.priorityScore ?? 0) * 0.5;
    return score > 0 ? { id: t.id, score } : null;
  })
    .filter(Boolean)
    .sort((a, b) => b!.score - a!.score);

  return scored.slice(0, target).map((s) => s!.id);
}

function pickExercises(
  phase: FightCampPhase,
  categories: Category[],
  target: number,
): string[] {
  const spec = PHASE_SPECS[phase];
  const pool = EXERCISES.filter((e) => {
    if (!spec.preferredExerciseKinds.includes(e.kind)) return false;
    if (e.category === "any") return true;
    return categories.includes(e.category);
  });

  // Bevorzuge Conditioning in foundation/specific, Drills in sparring-prep
  const scored = pool.map((e) => {
    let score = 1;
    if (phase === "foundation" && e.kind === "conditioning") score += 2;
    if (phase === "specific-prep" && e.kind === "technique") score += 2;
    if (phase === "sparring-simulation" && e.intensity === "high") score += 3;
    if (phase === "taper" && (e.kind === "cooldown" || e.intensity === "low"))
      score += 3;
    return { id: e.id, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, target).map((s) => s.id);
}

// ─── Plan-Generator ────────────────────────────────────────────────────────

export interface GeneratePlanInput {
  weeksTotal: number;
  startedAt?: Date;
  competitionDate: Date;
  athleteLevel: AthleteLevel | null | undefined;
  analysis: TrainingHistoryAnalysis;
  opponent: OpponentProfile;
}

/**
 * Erzeugt einen 4-Phasen-Plan aus echten Techniken + Übungen der App.
 */
export function generateFightCampPhases(
  input: GeneratePlanInput,
): FightCampPhaseBlock[] {
  const startedAt = input.startedAt ?? new Date();
  const distribution = distributePhaseWeeks(input.weeksTotal);
  const focus = recommendFocus(input.analysis, input.opponent);

  // Kategorien: primär MMA-relevante Kategorien — limitieren auf das, was die App kennt
  const primaryCats: Category[] = ["boxing", "wrestling", "bjj", "muay-thai"];

  // Schwerpunkt der Phase 2 = Critical Gaps + Style-Areas
  const specificPrepAreas: TrainingArea[] = [
    ...focus.criticalGaps,
    ...focus.recommendedAreas,
  ].filter((v, i, a) => a.indexOf(v) === i);

  const phases: FightCampPhaseBlock[] = [];
  let cursor = new Date(startedAt);

  const phaseOrder: FightCampPhase[] = [
    "foundation",
    "specific-prep",
    "sparring-simulation",
    "taper",
  ];

  for (const phase of phaseOrder) {
    const weeks = distribution[phase];
    const startsAt = new Date(cursor);
    const endsAt = new Date(cursor.getTime() + weeks * 7 * 24 * 3600 * 1000);
    cursor = endsAt;

    const spec = PHASE_SPECS[phase];
    const preferredAreas: TrainingArea[] =
      phase === "specific-prep" ? specificPrepAreas : spec.preferredAreas;

    const techniqueIds = pickTechniques(
      phase,
      preferredAreas,
      primaryCats,
      input.athleteLevel,
      spec.techniqueTarget,
    );
    const exerciseIds = pickExercises(
      phase,
      primaryCats,
      spec.exerciseTarget,
    );

    phases.push({
      phase,
      startsAt,
      endsAt,
      weeks,
      focus: spec.focus,
      techniqueIds,
      exerciseIds,
      trainingAreas: preferredAreas,
      categories: primaryCats,
      sessionsPerWeek: spec.sessionsPerWeek,
      sparringRatio: spec.sparringRatio,
    });
  }

  // Letzte Phase auf das Kampfdatum schieben — falls Distribution leicht abweicht
  if (phases.length > 0) {
    const last = phases[phases.length - 1];
    last.endsAt = new Date(input.competitionDate);
    if (last.endsAt.getTime() < last.startsAt.getTime()) {
      last.startsAt = new Date(last.endsAt.getTime() - 7 * 24 * 3600 * 1000);
    }
  }

  return phases;
}

/**
 * Erzeugt ein komplettes Fight-Camp aus den Inputs.
 *
 * `ownerIsStaff` fehlt im Rückgabetyp mit Absicht — das Feld gehört zur
 * Ablage, nicht zur Planung (wie `gymId` und `opponentId`, die der Aufrufer
 * ebenfalls ergänzt). Weil es an `FightCamp` PFLICHT ist, verlangt
 * `createFightCamp` es damit sichtbar von jeder Anlegestelle; ein Vergessen
 * ist ein Compile-Fehler statt eines Camps, das aus der Liste fällt
 * (Begründung in lib/fight-camp.ts).
 */
export function generateFightCamp(input: {
  studentUid: string;
  createdBy: string;
  competitionDate: Date;
  competitionName: string;
  startedAt?: Date;
  athleteLevel: AthleteLevel | null | undefined;
  analysis: TrainingHistoryAnalysis;
  opponent: OpponentProfile;
}): Omit<FightCamp, "id" | "createdAt" | "ownerIsStaff"> {
  const startedAt = input.startedAt ?? new Date();
  const weeksTotal = Math.max(
    1,
    Math.ceil(
      (input.competitionDate.getTime() - startedAt.getTime()) /
        (7 * 24 * 3600 * 1000),
    ),
  );
  const phases = generateFightCampPhases({
    weeksTotal,
    startedAt,
    competitionDate: input.competitionDate,
    athleteLevel: input.athleteLevel,
    analysis: input.analysis,
    opponent: input.opponent,
  });

  return {
    studentUid: input.studentUid,
    createdBy: input.createdBy,
    competitionDate: input.competitionDate,
    competitionName: input.competitionName,
    weeksTotal,
    startedAt,
    opponent: input.opponent,
    phases,
    status: "active",
  };
}
