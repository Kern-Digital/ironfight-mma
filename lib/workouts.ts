import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { getFirestoreDb } from "./firebase";
import type { TimerConfig } from "./use-workout-timer";
import type { Category, Difficulty, WorkoutStatus } from "./types";

export type WorkoutSession = {
  id: string;
  label: string | null;
  category: Category | null;
  difficulty: Difficulty | null;
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  completedAt: Date;
  totalWorkSeconds: number;
  status: WorkoutStatus;
  exerciseIds: string[];
  techniqueIds: string[];
};

type WorkoutDoc = {
  label: string | null;
  category?: Category | null;
  difficulty?: Difficulty | null;
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  completedAt: Timestamp | null;
  totalWorkSeconds: number;
  status?: WorkoutStatus;
  exerciseIds?: string[];
  techniqueIds?: string[];
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
  exerciseIds?: string[];
  techniqueIds?: string[];
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
 * Übungs-/Technik-IDs für Dashboard-Statistiken.
 */
export async function logWorkoutFull(
  userId: string,
  options: LogWorkoutOptions,
) {
  const { config } = options;
  const totalWorkSeconds = config.rounds * config.workSeconds;
  await addDoc(workoutsCol(userId), {
    label: options.label,
    category: options.category ?? null,
    difficulty: options.difficulty ?? null,
    rounds: config.rounds,
    workSeconds: config.workSeconds,
    restSeconds: config.restSeconds,
    completedAt: serverTimestamp(),
    totalWorkSeconds,
    status: options.status ?? "completed",
    exerciseIds: options.exerciseIds ?? [],
    techniqueIds: options.techniqueIds ?? [],
  });
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
      totalWorkSeconds: data.totalWorkSeconds,
      status: data.status ?? "completed",
      exerciseIds: data.exerciseIds ?? [],
      techniqueIds: data.techniqueIds ?? [],
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
