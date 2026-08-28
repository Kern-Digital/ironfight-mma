import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { getFirestoreDb } from "./firebase";
import type { TimerConfig } from "./use-workout-timer";
import type { WorkoutPlan } from "./workout-plans";
import type {
  Category,
  Difficulty,
  WorkoutDefinition,
  WorkoutStatus,
} from "./types";

export type WorkoutSession = {
  id: string;
  label: string | null;
  category: Category | null;
  difficulty: Difficulty | null;
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  completedAt: Date;
  /** Wann die Session GESTARTET wurde — ältere Logs haben nur completedAt */
  startedAt: Date | null;
  totalWorkSeconds: number;
  status: WorkoutStatus;
  exerciseIds: string[];
  techniqueIds: string[];
  /** Volle Definition (mit Blockstruktur) — Teilschritt 3 bis zur
      Runner-Umstellung; ganz alte Logs haben nur die flache
      exerciseIds-Liste, neue stattdessen den Plan */
  definition: WorkoutDefinition | null;
  /** Ausgeführter Plan (mit Blockpausen + Rubrik-Titeln) — seit der
      Runner-Umstellung aufs Plan-Modell die Basis fürs Herz-Feature */
  plan: WorkoutPlan | null;
  /** Als Favorit gespeicherte persönliche Kopie (users/{uid}/workoutPlans) */
  savedPlanId: string | null;
};

type WorkoutDoc = {
  label: string | null;
  category?: Category | null;
  difficulty?: Difficulty | null;
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  completedAt: Timestamp | null;
  startedAt?: Timestamp | null;
  totalWorkSeconds: number;
  status?: WorkoutStatus;
  exerciseIds?: string[];
  techniqueIds?: string[];
  definition?: WorkoutDefinition | null;
  plan?: WorkoutPlan | null;
  savedPlanId?: string | null;
};

function workoutsCol(userId: string) {
  return collection(getFirestoreDb(), "users", userId, "workouts");
}

export interface LogWorkoutOptions {
  config: TimerConfig;
  label: string | null;
  category?: Category | null;
  difficulty?: Difficulty | null;
  status?: WorkoutStatus;
  /** Wann die Session gestartet wurde (Anzeige „Letzte Workouts") */
  startedAt?: Date | null;
  exerciseIds?: string[];
  techniqueIds?: string[];
  /** Volle Definition — nur noch für ältere Aufrufer, neue loggen `plan` */
  definition?: WorkoutDefinition | null;
  /** Ausgeführter Plan — Basis für „als Favorit speichern" (Herz im Hub) */
  plan?: WorkoutPlan | null;
}

/** Vereinfachter Logger — bleibt rückwärtskompatibel mit bestehendem Code. */
export async function logWorkout(
  userId: string,
  config: TimerConfig,
  label: string | null,
) {
  return logWorkoutFull(userId, {
    config,
    label,
    status: "completed",
  });
}

/**
 * Erweiterter Logger — schreibt Kategorie, Schwierigkeit, Status,
 * Übungs-/Technik-IDs für Dashboard-Statistiken. Rückgabe ist die ID des
 * neuen Log-Eintrags (Herz auf dem Fertig-Screen braucht sie).
 */
export async function logWorkoutFull(
  userId: string,
  options: LogWorkoutOptions,
): Promise<string> {
  const { config } = options;
  const totalWorkSeconds = config.rounds * config.workSeconds;
  const ref = await addDoc(workoutsCol(userId), {
    label: options.label,
    category: options.category ?? null,
    difficulty: options.difficulty ?? null,
    rounds: config.rounds,
    workSeconds: config.workSeconds,
    restSeconds: config.restSeconds,
    completedAt: serverTimestamp(),
    startedAt: options.startedAt ?? null,
    totalWorkSeconds,
    status: options.status ?? "completed",
    exerciseIds: options.exerciseIds ?? [],
    techniqueIds: options.techniqueIds ?? [],
    definition: options.definition ?? null,
    plan: options.plan ?? null,
    savedPlanId: null,
  });
  return ref.id;
}

/**
 * Favoriten-Verweis am Log-Eintrag setzen/lösen (Herz im Hub): die
 * eigentliche Kopie liegt in users/{uid}/workoutPlans, hier steht nur
 * ihre ID — daraus speist sich der Gefüllt-Zustand des Herzens.
 */
export async function setWorkoutSavedPlan(
  userId: string,
  workoutId: string,
  savedPlanId: string | null,
) {
  await updateDoc(doc(workoutsCol(userId), workoutId), { savedPlanId });
}

export async function getRecentWorkouts(
  userId: string,
  count = 10,
): Promise<WorkoutSession[]> {
  const q = query(
    workoutsCol(userId),
    orderBy("completedAt", "desc"),
    limit(count),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as WorkoutDoc;
    return {
      id: d.id,
      label: data.label,
      category: data.category ?? null,
      difficulty: data.difficulty ?? null,
      rounds: data.rounds,
      workSeconds: data.workSeconds,
      restSeconds: data.restSeconds,
      completedAt: data.completedAt?.toDate() ?? new Date(),
      startedAt: data.startedAt?.toDate() ?? null,
      totalWorkSeconds: data.totalWorkSeconds,
      status: data.status ?? "completed",
      exerciseIds: data.exerciseIds ?? [],
      techniqueIds: data.techniqueIds ?? [],
      definition: data.definition ?? null,
      plan: data.plan ?? null,
      savedPlanId: data.savedPlanId ?? null,
    };
  });
}

export type WorkoutStats = {
  total: number;
  thisWeek: number;
  streak: number;
  lastLabel: string | null;
  /** Insgesamt verbrachte Trainingszeit in Sekunden */
  totalSeconds: number;
  /** Meisttrainierte Kategorie + Anzahl */
  topCategory: { category: Category; count: number } | null;
  /** Anzahl pro Kategorie */
  byCategory: Record<Category, number>;
};

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function computeStats(sessions: WorkoutSession[]): WorkoutStats {
  const total = sessions.length;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisWeek = sessions.filter((s) => s.completedAt >= sevenDaysAgo).length;

  const days = new Set(sessions.map((s) => dayKey(s.completedAt)));
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!days.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const lastLabel = sessions[0]?.label ?? null;
  const totalSeconds = sessions.reduce((s, w) => s + (w.totalWorkSeconds || 0), 0);

  const byCategory: Record<Category, number> = {
    boxing: 0,
    wrestling: 0,
    bjj: 0,
    "muay-thai": 0,
  };
  for (const s of sessions) {
    if (s.category) byCategory[s.category] += 1;
  }
  let topCategory: { category: Category; count: number } | null = null;
  for (const cat of Object.keys(byCategory) as Category[]) {
    const count = byCategory[cat];
    if (count > 0 && (!topCategory || count > topCategory.count)) {
      topCategory = { category: cat, count };
    }
  }

  return {
    total,
    thisWeek,
    streak,
    lastLabel,
    totalSeconds,
    topCategory,
    byCategory,
  };
}
