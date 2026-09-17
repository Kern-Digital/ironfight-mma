/**
 * Fight-Camp-Plan-Generator
 *
 * Erzeugt einen 4-Phasen-Vorbereitungsplan basierend auf:
 *   • Trainings-Historie (Stärken/Schwächen-Analyse)
 *   • Gegner-Profil (Stil → relevante Bereiche)
 *   • Anzahl Wochen bis zum Kampf
 *
 * Methodisch: Aus der Master-Technik-DB werden Techniken gefiltert nach
 *   • Kategorie passt zur Kampfart des Wettkampfs (KATEGORIEN_JE_KAMPFART;
 *     ohne Kampfart wie bisher alle vier — MMA-Mischung)
 *   • TrainingArea passt zur Phase + den Critical Gaps
 *   • Difficulty/Level passt zum Schüler-Level
 *
 * Übungen kommen aus der Exercise-DB, gefiltert nach Phase + Intensität.
 *
 * Kein KI-System, sondern eine erklärbare Heuristik. Trainer darf den Plan
 * danach frei editieren (im UI) — seit 17.09.2026 Stufe 1: Fokus, Einheiten,
 * Sparring-Anteil und Notiz je Phase (components/trainer/PhasenEditor.tsx,
 * lib/fight-camp.ts `updateFightCampPhase`); Stufe 2: Kampf verschieben, die
 * Phasen verteilen sich neu (`verschiebeKampf`). Die Zeitachse rechnet für
 * BEIDE Wege `phasenZeitachse` (lib/fight-camp.ts) — Leons Ansage „wie beim
 * Anlegen neu verteilen" hält nur, solange es EINE Verteilung gibt.
 * Stufe 3: Der Trainer tauscht Techniken und Übungen je Phase — was er dabei
 * zur Wahl hat, sagt `waehlbareTechniken`/`waehlbareUebungen` (unten), und das
 * ist dieselbe Kampfart-Regel wie beim Anlegen. Eigene Phasenlängen folgen.
 */

import { ALL_TECHNIQUES } from "./techniques";
import { EXERCISES } from "./exercises";
import {
  phasenZeitachse,
  planWochen,
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
  Exercise,
  Technique,
  TrainingArea,
} from "./types";
import type { Sport } from "./video-analysis";

/**
 * Welche Technik-Kategorien der App eine Kampfart trainiert (Leon 17.09.2026:
 * Kampfart am Wettkampf). Vorher mischte JEDER Plan Boxen, Ringen, BJJ und
 * Muay Thai — ein Boxkampf bekam Takedowns und Submissions in den Plan.
 */
export const KATEGORIEN_JE_KAMPFART: Record<Sport, Category[]> = {
  mma: ["boxing", "wrestling", "bjj", "muay-thai"],
  boxen: ["boxing"],
  kickboxen: ["boxing", "muay-thai"],
  ringen: ["wrestling"],
  sambo: ["wrestling", "bjj"],
  bjj: ["bjj"],
};

const ALLE_KATEGORIEN: Category[] = ["boxing", "wrestling", "bjj", "muay-thai"];

/** Die Kategorien, aus denen ein Wettkampf dieser Kampfart schöpft. */
export function kategorienDerKampfart(sport: Sport | null | undefined): Category[] {
  return sport ? KATEGORIEN_JE_KAMPFART[sport] : ALLE_KATEGORIEN;
}

/**
 * WAS DER TRAINER IN EINE PHASE LEGEN DARF (Leon 17.09.2026, Stufe 3:
 * „Techniken tauschen"). Dieselbe Regel wie beim Anlegen des Plans: Ein
 * Boxkampf bietet Box-Techniken an, kein Double Leg. Ohne Kampfart am
 * Wettkampf steht die ganze Bibliothek offen (MMA-Mischung wie bisher).
 *
 * Sortiert nach Kategorie in der Reihenfolge der Kampfart und darin nach
 * Namen — die Suche zeigt so bei „ha" erst den Haken, nicht den Hammerfaust-
 * Treffer aus einer Randkategorie.
 */
export function waehlbareTechniken(sport: Sport | null | undefined): Technique[] {
  const cats = kategorienDerKampfart(sport);
  return ALL_TECHNIQUES.filter((t) => cats.includes(t.category)).sort(
    (a, b) =>
      cats.indexOf(a.category) - cats.indexOf(b.category) ||
      a.name.localeCompare(b.name, "de"),
  );
}

/**
 * Dasselbe für die Übungen. `category: "any"` (Seilspringen, Sprints, Mobility)
 * passt zu jeder Kampfart und steht immer zur Wahl — die stehen am Ende, weil
 * die kampfartnahen Übungen die eigentliche Arbeit der Phase sind.
 */
export function waehlbareUebungen(sport: Sport | null | undefined): Exercise[] {
  const cats = kategorienDerKampfart(sport);
  return EXERCISES.filter((e) => e.category === "any" || cats.includes(e.category)).sort(
    (a, b) =>
      (a.category === "any" ? cats.length : cats.indexOf(a.category)) -
        (b.category === "any" ? cats.length : cats.indexOf(b.category)) ||
      a.name.localeCompare(b.name, "de"),
  );
}

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
  /**
   * Nur noch Beiwerk: Die Zeitachse rechnet `phasenZeitachse` aus `startedAt`
   * und `competitionDate` (lib/fight-camp.ts) — dieselbe Verteilung, die eine
   * Verschiebung benutzt (Leon 17.09.2026: „wie beim Anlegen neu verteilen").
   */
  weeksTotal?: number;
  startedAt?: Date;
  competitionDate: Date;
  athleteLevel: AthleteLevel | null | undefined;
  analysis: TrainingHistoryAnalysis;
  opponent: OpponentProfile;
  /** Kampfart des Wettkampfs; null = alle vier Kategorien (Bestand). */
  sport?: Sport | null;
}

/**
 * Erzeugt einen 4-Phasen-Plan aus echten Techniken + Übungen der App.
 */
export function generateFightCampPhases(
  input: GeneratePlanInput,
): FightCampPhaseBlock[] {
  const startedAt = input.startedAt ?? new Date();
  const achse = phasenZeitachse(startedAt, input.competitionDate);
  const focus = recommendFocus(input.analysis, input.opponent);

  // Kategorien der Kampfart — ohne Kampfart alle vier, wie vor dem 17.09.2026.
  const primaryCats: Category[] = kategorienDerKampfart(input.sport);

  // Schwerpunkt der Phase 2 = Critical Gaps + Style-Areas
  const specificPrepAreas: TrainingArea[] = [
    ...focus.criticalGaps,
    ...focus.recommendedAreas,
  ].filter((v, i, a) => a.indexOf(v) === i);

  const phases: FightCampPhaseBlock[] = [];

  for (const { phase, startsAt, endsAt, weeks } of achse) {
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

  // Die letzte Phase endet auf dem Kampftag — das erledigt `phasenZeitachse`.
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
  sport: Sport | null;
}): Omit<FightCamp, "id" | "createdAt" | "ownerIsStaff"> {
  const startedAt = input.startedAt ?? new Date();
  const weeksTotal = planWochen(startedAt, input.competitionDate);
  const phases = generateFightCampPhases({
    weeksTotal,
    startedAt,
    competitionDate: input.competitionDate,
    athleteLevel: input.athleteLevel,
    analysis: input.analysis,
    opponent: input.opponent,
    sport: input.sport,
  });

  return {
    studentUid: input.studentUid,
    createdBy: input.createdBy,
    competitionDate: input.competitionDate,
    competitionName: input.competitionName,
    sport: input.sport,
    weeksTotal,
    startedAt,
    opponent: input.opponent,
    phases,
    status: "active",
    notizen: [],
  };
}
