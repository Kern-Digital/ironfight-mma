/**
 * Workout-Pläne — strukturierte Trainingspläne auf WorkoutDefinition-Basis.
 * Ersetzt das alte Textlisten-Modell aus lib/training-plans.ts
 * (Etappe „Workout-Pläne", siehe CLAUDE.md-Backlog; 2026-08).
 *
 * Modell-Entscheidungen:
 *   • Übungen sind ausschließlich IDs aus lib/exercises — keine Freitexte.
 *     Dauer, Runden und Equipment jeder Übung kommen aus der Übungs-DB.
 *   • Die Pause ist ein Feld PRO BLOCK (editierbar), nicht pro Übung —
 *     die Gesamtdauer wird daraus BERECHNET und nie gespeichert.
 *   • Pläne sind Gym-Inhalt in Firestore (gyms/{gymId}/workoutPlans,
 *     Trainer pflegen) plus persönliche Kopien (users/{uid}/workoutPlans).
 *     Die eingebauten Start-Pläne (lib/workout-plan-defaults.ts) sind nur
 *     der Fallback, solange ein Gym noch keine eigenen Pläne hat.
 *   • `discipline` ist die volle Disziplin-Liste (nicht nur Category), damit
 *     ein Gym später genau seine Rubriken zeigt (Multi-Gym §10 / Phase 3).
 */

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { getFirestoreDb } from "./firebase";
import { getExerciseById } from "./exercises";
import { DEFAULT_WORKOUT_PLANS } from "./workout-plan-defaults";
import type {
  Category,
  Difficulty,
  Discipline,
  EquipmentId,
  Exercise,
  WorkoutBlock,
  WorkoutDefinition,
} from "./types";

// ─── Modell ────────────────────────────────────────────────────────────────

export interface WorkoutPlanBlock {
  /** Anzeigename der Rubrik („Aufwärmen", „Technik", …) */
  title: string;
  /** Phase für Runner & Statistik — kompatibel zu WorkoutBlock.phase */
  phase: WorkoutBlock["phase"];
  /** Übungs-IDs aus lib/exercises — Reihenfolge = Trainingsreihenfolge */
  exerciseIds: string[];
  /** Pause zwischen den Runden/Übungen dieses Blocks in Sekunden */
  restSeconds: number;
}

export interface WorkoutPlan {
  id: string;
  /** Stabiler Deep-Link-Teil für /workout/plans/[slug] (Firestore: = Doc-ID) */
  slug: string;
  gymId: string;
  discipline: Discipline;
  difficulty: Difficulty;
  name: string;
  /** Eine Zeile für Karten/Listen */
  short: string;
  description: string;
  blocks: WorkoutPlanBlock[];
  /** Sortierung innerhalb Disziplin+Level — Client sortiert, fehlt = ans Ende */
  sortOrder?: number;
}

/** Persönliche Kopie in users/{uid}/workoutPlans. */
export interface PersonalWorkoutPlan extends WorkoutPlan {
  /** Gym-Plan, aus dem die Kopie entstand — null = selbst erstellt */
  sourcePlanId: string | null;
  updatedAt: Date | null;
}

// ─── Berechnungen (Gesamtdauer, Übungszahl, Equipment) ─────────────────────

/** Aufgelöste Übungen eines Blocks — unbekannte IDs werden übersprungen. */
export function blockExercises(block: WorkoutPlanBlock): Exercise[] {
  return block.exerciseIds
    .map((id) => getExerciseById(id))
    .filter((e): e is Exercise => Boolean(e));
}

export function planExerciseCount(plan: WorkoutPlan): number {
  return plan.blocks.reduce((sum, b) => sum + blockExercises(b).length, 0);
}

/**
 * Gesamtdauer in Sekunden — berechnet, nie gespeichert:
 * pro Block Arbeitszeit aller Runden (defaultRounds × durationSeconds aus der
 * Übungs-DB) plus Blockpause zwischen den Runden (nach der letzten Runde
 * eines Blocks keine Pause).
 */
export function planDurationSeconds(plan: WorkoutPlan): number {
  let total = 0;
  for (const block of plan.blocks) {
    let rounds = 0;
    for (const ex of blockExercises(block)) {
      total += ex.defaultRounds * ex.durationSeconds;
      rounds += ex.defaultRounds;
    }
    if (rounds > 1) total += (rounds - 1) * block.restSeconds;
  }
  return total;
}

/** Benötigtes Equipment (Vereinigung über alle Übungen; leer = Bodyweight). */
export function planEquipment(plan: WorkoutPlan): EquipmentId[] {
  const set = new Set<EquipmentId>();
  for (const block of plan.blocks) {
    for (const ex of blockExercises(block)) {
      for (const eq of ex.equipment) set.add(eq);
    }
  }
  return Array.from(set);
}

// ─── Brücke zum Runner (/workout, /workout/session) ────────────────────────

/**
 * Nächstliegende Kern-Kategorie einer Disziplin. Runner und Workout-Logs
 * rechnen (noch) in Category — exakt für die vier Kern-Disziplinen, Näherung
 * für den Rest, bis der Runner in Teilschritt 4 direkt auf dem neuen Modell
 * läuft (Familien-Zuordnung wie in lib/discipline-colors.ts).
 */
export const DISCIPLINE_CATEGORY: Record<Discipline, Category> = {
  boxing: "boxing",
  kickboxen: "muay-thai",
  "muay-thai": "muay-thai",
  "fitness-kickboxen": "muay-thai",
  karate: "muay-thai",
  mma: "boxing",
  wrestling: "wrestling",
  bjj: "bjj",
  "wing-tsung": "boxing",
  "self-defense": "boxing",
};

/**
 * Plan → WorkoutDefinition für die bestehenden Runner-Seiten (?payload=…).
 * Timer-Defaults kommen wie im Generator aus der ersten Hauptteil-Übung;
 * die Blockpausen nutzt der Runner erst nach seiner Umstellung (Schritt 4).
 */
export function planToWorkoutDefinition(plan: WorkoutPlan): WorkoutDefinition {
  const firstMain =
    plan.blocks
      .filter((b) => b.phase === "main")
      .flatMap(blockExercises)[0] ?? plan.blocks.flatMap(blockExercises)[0];

  return {
    id: `plan-${plan.slug}`,
    label: plan.name,
    category: DISCIPLINE_CATEGORY[plan.discipline],
    difficulty: plan.difficulty,
    rounds: firstMain?.defaultRounds ?? 3,
    workSeconds: firstMain?.durationSeconds ?? 180,
    restSeconds: firstMain?.restSeconds ?? 60,
    prepSeconds: 10,
    blocks: plan.blocks
      .filter((b) => b.exerciseIds.length > 0)
      .map((b) => ({ phase: b.phase, exerciseIds: b.exerciseIds })),
  };
}

// ─── Firestore: Gym-Pläne + persönliche Kopien ─────────────────────────────

type WorkoutPlanDoc = {
  gymId: string;
  discipline: Discipline;
  difficulty: Difficulty;
  name: string;
  short: string;
  description: string;
  blocks: WorkoutPlanBlock[];
  sortOrder?: number;
  sourcePlanId?: string | null;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  updatedBy?: string;
};

function gymPlansCol(gymId: string) {
  return collection(getFirestoreDb(), "gyms", gymId, "workoutPlans");
}

function personalPlansCol(uid: string) {
  return collection(getFirestoreDb(), "users", uid, "workoutPlans");
}

function sortPlans<T extends WorkoutPlan>(plans: T[]): T[] {
  return plans.sort((a, b) => {
    const oa = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const ob = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name, "de");
  });
}

function docToPlan(id: string, data: WorkoutPlanDoc): WorkoutPlan {
  return {
    id,
    slug: id,
    gymId: data.gymId,
    discipline: data.discipline,
    difficulty: data.difficulty,
    name: data.name,
    short: data.short ?? "",
    description: data.description ?? "",
    blocks: data.blocks ?? [],
    sortOrder: data.sortOrder,
  };
}

/** Nur-Daten-Payload eines Plans (id/slug leben in der Doc-ID). */
function planPayload(gymId: string, plan: WorkoutPlan) {
  return {
    gymId,
    discipline: plan.discipline,
    difficulty: plan.difficulty,
    name: plan.name,
    short: plan.short,
    description: plan.description,
    blocks: plan.blocks,
    ...(plan.sortOrder !== undefined ? { sortOrder: plan.sortOrder } : {}),
  };
}

/** Alle Gym-Pläne (Trainer-Inhalt). Kleine Menge → eine Query, Client filtert. */
export async function listGymWorkoutPlans(gymId: string): Promise<WorkoutPlan[]> {
  const snap = await getDocs(gymPlansCol(gymId));
  return sortPlans(
    snap.docs.map((d) => docToPlan(d.id, d.data() as WorkoutPlanDoc)),
  );
}

/**
 * Pläne, die ein Mitglied dieses Gyms sieht: die Gym-Pläne aus Firestore,
 * solange keine existieren die eingebauten Start-Pläne (Fallback, damit die
 * App vor dem Seeden in Schritt 5 nicht leer ist).
 */
export async function listWorkoutPlansForGym(gymId: string): Promise<WorkoutPlan[]> {
  const own = await listGymWorkoutPlans(gymId);
  if (own.length > 0) return own;
  return DEFAULT_WORKOUT_PLANS;
}

/** Gym-Plan anlegen/aktualisieren (Trainer/Admin — Rules erzwingen das Gym). */
export async function upsertGymWorkoutPlan(
  gymId: string,
  plan: WorkoutPlan,
  updatedBy: string,
): Promise<string> {
  const ref = plan.id ? doc(gymPlansCol(gymId), plan.id) : doc(gymPlansCol(gymId));
  await setDoc(ref, {
    ...planPayload(gymId, plan),
    updatedAt: serverTimestamp(),
    updatedBy,
    ...(plan.id ? {} : { createdAt: serverTimestamp() }),
  }, { merge: true });
  return ref.id;
}

export async function deleteGymWorkoutPlan(gymId: string, planId: string) {
  await deleteDoc(doc(gymPlansCol(gymId), planId));
}

/** Persönliche Pläne des Users — neueste zuerst („Eigene Workoutpläne"). */
export async function listPersonalWorkoutPlans(
  uid: string,
): Promise<PersonalWorkoutPlan[]> {
  const snap = await getDocs(
    query(personalPlansCol(uid), orderBy("updatedAt", "desc")),
  );
  return snap.docs.map((d) => {
    const data = d.data() as WorkoutPlanDoc;
    return {
      ...docToPlan(d.id, data),
      sourcePlanId: data.sourcePlanId ?? null,
      updatedAt: data.updatedAt?.toDate() ?? null,
    };
  });
}

/**
 * Persönlichen Plan speichern. Beim Bearbeiten eines Gym-Plans entsteht so
 * die persönliche Kopie (sourcePlanId = Original; das Original bleibt) —
 * ohne plan.id wird eine neue Doc-ID vergeben, Rückgabe ist die ID.
 */
export async function upsertPersonalWorkoutPlan(
  uid: string,
  plan: WorkoutPlan,
  options: { sourcePlanId?: string | null } = {},
): Promise<string> {
  const ref = plan.id
    ? doc(personalPlansCol(uid), plan.id)
    : doc(personalPlansCol(uid));
  await setDoc(ref, {
    ...planPayload(plan.gymId, plan),
    sourcePlanId: options.sourcePlanId ?? null,
    updatedAt: serverTimestamp(),
    ...(plan.id ? {} : { createdAt: serverTimestamp() }),
  }, { merge: true });
  return ref.id;
}

export async function deletePersonalWorkoutPlan(uid: string, planId: string) {
  await deleteDoc(doc(personalPlansCol(uid), planId));
}
