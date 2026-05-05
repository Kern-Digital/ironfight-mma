import {
  EXERCISES,
  exercisesForCategory,
  exercisesWithEquipment,
} from "./exercises";
import type {
  Category,
  Difficulty,
  EquipmentId,
  Exercise,
  WorkoutBlock,
  WorkoutDefinition,
} from "./types";

/**
 * Workout-Generator-Eingabe.
 */
export interface GeneratorInput {
  category: Category;
  difficulty: Difficulty;
  equipment: EquipmentId[];
  /** Gesamtdauer in Minuten (10..120) */
  durationMinutes: number;
  /** Optional festgelegtes Label für das Workout */
  label?: string;
}

/**
 * Workout-Generator: erstellt aus den Eingaben ein passendes Workout.
 *
 * Aufteilung der Zeit:
 *   • Warm-up:        ~12 %  (mind. 1 Übung)
 *   • Hauptteil:      ~58 %  (Technik-Übungen)
 *   • Konditionierung:~22 %  (mind. 1 Übung wenn ≥15 min)
 *   • Cooldown:       ~8 %   (mind. 1 Übung wenn ≥20 min)
 *
 * Übungen werden nur dann eingesetzt, wenn ihr benötigtes Equipment
 * komplett verfügbar ist. Wenn nichts passt, wird auf Bodyweight-Übungen
 * derselben Kategorie zurückgegriffen.
 */
export function generateWorkout(input: GeneratorInput): WorkoutDefinition {
  const totalMin = clamp(input.durationMinutes, 5, 120);
  const totalSec = totalMin * 60;

  const warmupTime = Math.max(120, Math.round(totalSec * 0.12));
  const mainTime = Math.round(totalSec * 0.58);
  const condTime = totalMin >= 15 ? Math.round(totalSec * 0.22) : 0;
  const cooldownTime = totalMin >= 20 ? Math.max(120, Math.round(totalSec * 0.08)) : 0;

  // Pool: alle Übungen, deren Equipment komplett verfügbar ist
  const allowedByEquipment = exercisesWithEquipment(
    // Bodyweight ist immer "verfügbar", solange irgendwas ausgewählt ist
    ensureBodyweight(input.equipment),
  );
  const fitsCategory = (e: Exercise) =>
    e.category === input.category || e.category === "any";
  const fitsDifficulty = (e: Exercise) =>
    e.difficulty === input.difficulty || e.difficulty === "any";

  const pool = allowedByEquipment.filter(fitsCategory);

  // Helper: nimmt Übungen einer kind aus dem Pool, gewichtet nach passender Schwierigkeit
  function pickKind(
    kind: Exercise["kind"],
    targetTime: number,
  ): { ids: string[]; usedTime: number } {
    if (targetTime === 0) return { ids: [], usedTime: 0 };
    let candidates = pool.filter((e) => e.kind === kind);
    // Lieber passende Schwierigkeit, sonst egal
    const matchingDiff = candidates.filter(fitsDifficulty);
    if (matchingDiff.length) candidates = matchingDiff;

    if (!candidates.length) {
      // Fallback: kategorie-übergreifend (any-Kategorie)
      candidates = allowedByEquipment.filter(
        (e) => e.kind === kind && (e.category === "any" || e.category === input.category),
      );
    }
    if (!candidates.length) return { ids: [], usedTime: 0 };

    const ids: string[] = [];
    let usedTime = 0;
    let safety = 0;
    while (usedTime < targetTime && safety < 20) {
      // Reihenfolge: erstmal jede Übung einmal, dann wiederholen
      const remainingChoices = candidates.filter((c) => !ids.includes(c.id));
      const choice = remainingChoices.length
        ? remainingChoices[Math.floor(Math.random() * remainingChoices.length)]
        : candidates[Math.floor(Math.random() * candidates.length)];

      const exTime =
        choice.defaultRounds * (choice.durationSeconds + choice.restSeconds);
      ids.push(choice.id);
      usedTime += exTime;
      safety += 1;
    }
    return { ids, usedTime };
  }

  const blocks: WorkoutBlock[] = [];
  const warmup = pickKind("warmup", warmupTime);
  if (warmup.ids.length) blocks.push({ phase: "warmup", exerciseIds: warmup.ids });

  const main = pickKind("technique", mainTime);
  if (main.ids.length) blocks.push({ phase: "main", exerciseIds: main.ids });

  if (condTime > 0) {
    const cond = pickKind("conditioning", condTime);
    if (cond.ids.length)
      blocks.push({ phase: "conditioning", exerciseIds: cond.ids });
  }

  if (cooldownTime > 0) {
    const cool = pickKind("cooldown", cooldownTime);
    if (cool.ids.length) blocks.push({ phase: "cooldown", exerciseIds: cool.ids });
  }

  // Wenn alles leer ist (z. B. Equipment & Kategorie passen zu nichts):
  // Fallback Bodyweight-Boxen-Workout
  if (blocks.length === 0) {
    const fallback = exercisesForCategory(input.category)
      .filter((e) => e.equipment.length === 0)
      .slice(0, 4);
    blocks.push({
      phase: "main",
      exerciseIds: fallback.length
        ? fallback.map((e) => e.id)
        : EXERCISES.filter((e) => e.equipment.length === 0)
            .slice(0, 4)
            .map((e) => e.id),
    });
  }

  // Berechne Default-Timer-Werte basierend auf erster Hauptteil-Übung
  const firstMain = blocks
    .find((b) => b.phase === "main")
    ?.exerciseIds.map((id) => EXERCISES.find((e) => e.id === id))
    .find((e): e is Exercise => Boolean(e));

  const rounds = firstMain?.defaultRounds ?? 3;
  const workSeconds = firstMain?.durationSeconds ?? 180;
  const restSeconds = firstMain?.restSeconds ?? 60;

  return {
    id: `gen-${Date.now()}`,
    label: input.label ?? `${capitalize(input.category)} ${totalMin} min`,
    category: input.category,
    difficulty: input.difficulty,
    rounds,
    workSeconds,
    restSeconds,
    prepSeconds: 10,
    blocks,
    generatedFrom: {
      equipment: input.equipment,
      durationMinutes: totalMin,
      category: input.category,
      difficulty: input.difficulty,
    },
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ensureBodyweight(equipment: EquipmentId[]): EquipmentId[] {
  if (equipment.length === 0) return ["bodyweight"];
  return equipment.includes("bodyweight") ? equipment : [...equipment, "bodyweight"];
}
