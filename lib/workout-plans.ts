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
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirestoreDb } from "./firebase";
import { getExerciseById } from "./exercises";
import { setWorkoutSavedPlan, type WorkoutSession } from "./workouts";
import { DIFFICULTY_LABEL, DISCIPLINE_LABEL } from "./types";
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
  /** STANDARD-Rundenpause der Rubrik in Sekunden — pro Übung über
      WorkoutPlan.restOverrides übersteuerbar (Leons Vorgabe 2026-08-28:
      Rundenpause einzeln je Übung, eingestellt in den Übungsdetails) */
  restSeconds: number;
  /** Pause NACH diesem Block, vor der nächsten Rubrik (Chip zwischen den
      Rubriken, Rad-Picker). Optional — fehlt = 0 s (ältere Pläne). */
  restAfterSeconds?: number;
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
  /** Rundenpause PRO ÜBUNG (Sekunden), keyed nach Übungs-ID — übersteuert
      die Standard-Rundenpause der Rubrik. Bewusst auf Plan-Ebene: der Wert
      überlebt Verschieben/Duplizieren; taucht dieselbe Übung mehrfach auf,
      teilt sie sich die Pause. */
  restOverrides?: Record<string, number>;
  /** Sortierung innerhalb Disziplin+Level — Client sortiert, fehlt = ans Ende */
  sortOrder?: number;
}

/** Effektive Rundenpause einer Übung: Override des Plans, sonst der
    Standard der Rubrik. */
export function exerciseRestSeconds(
  plan: WorkoutPlan,
  block: WorkoutPlanBlock,
  exerciseId: string,
): number {
  return plan.restOverrides?.[exerciseId] ?? block.restSeconds;
}

/** Persönliche Kopie in users/{uid}/workoutPlans. */
export interface PersonalWorkoutPlan extends WorkoutPlan {
  /** Gym-Plan, aus dem die Kopie entstand — null = selbst erstellt */
  sourcePlanId: string | null;
  updatedAt: Date | null;
}

/**
 * Trainer-Plan mit Freigabe (AUSBAU Stufe 1) in gyms/{gymId}/trainerPlans —
 * bewusst GETRENNT von gyms/{gymId}/workoutPlans: die Start-/Gym-Pläne sind
 * für alle Mitglieder lesbar (ungefilterte Query), Trainer-Pläne nur für die
 * freigegebenen Athleten. Die Sichtbarkeit liegt SERVERSEITIG in den
 * Firestore-Regeln über `audienceUids` (Muster opponents.sharedWith) — beim
 * Freigeben materialisiert, KEIN Client-Filter.
 */
export interface TrainerWorkoutPlan extends WorkoutPlan {
  /** SICHERHEITSWIRKSAM: uids, für die der Plan freigegeben ist (Rules-Read
      via array-contains). Leer = Entwurf, nur Trainer/Admin sehen ihn. */
  audienceUids: string[];
  /** Nur Anzeige: beim Freigeben gewählte Kurse (TRAINING_BLOCKS-IDs).
      Die Auswahl ist ein SNAPSHOT — wer den Kurs später abonniert, kommt
      nicht automatisch dazu (echte Mitgliedschaft erst Multi-Gym Phase 2). */
  audienceCourseIds: string[];
  createdBy: string;
  /** Anzeigename des Erstellers, BEIM ANLEGEN mitgeschrieben — Athleten
      dürfen fremde users-Dokumente nicht lesen (Rules), könnten die uid
      also nie auflösen. „Von X geteilt" braucht den Namen im Dokument. */
  createdByName: string;
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
 * Gesamtdauer in Sekunden — berechnet, nie gespeichert. Spiegelt den
 * Auto-Durchlauf des Runners: pro Übung Arbeitszeit aller Runden plus ihre
 * Rundenpause zwischen den Runden UND als Übergang zur nächsten Übung der
 * Rubrik (nach der letzten Übung einer Rubrik keine Rundenpause); zwischen
 * den Rubriken die Zwischen-Rubrik-Pause (restAfterSeconds).
 */
export function planDurationSeconds(plan: WorkoutPlan): number {
  let total = 0;
  plan.blocks.forEach((block, i) => {
    const exs = blockExercises(block);
    exs.forEach((ex, j) => {
      const rest = exerciseRestSeconds(plan, block, ex.id);
      total += ex.defaultRounds * ex.durationSeconds;
      total += (ex.defaultRounds - 1) * rest;
      if (j < exs.length - 1) total += rest;
    });
    if (i < plan.blocks.length - 1) total += block.restAfterSeconds ?? 0;
  });
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

// ─── Editor-Hilfen: Übungslisten unveränderlich bearbeiten ─────────────────
// Generisch über T, damit PersonalWorkoutPlan seine Zusatzfelder behält.

function withBlockExercises<T extends WorkoutPlan>(
  plan: T,
  blockIndex: number,
  mutate: (ids: string[]) => string[],
): T {
  return {
    ...plan,
    blocks: plan.blocks.map((b, i) =>
      i === blockIndex ? { ...b, exerciseIds: mutate([...b.exerciseIds]) } : b,
    ),
  } as T;
}

export function planWithAddedExercise<T extends WorkoutPlan>(
  plan: T,
  blockIndex: number,
  exerciseId: string,
): T {
  return withBlockExercises(plan, blockIndex, (ids) => {
    ids.push(exerciseId);
    return ids;
  });
}

export function planWithRemovedExercise<T extends WorkoutPlan>(
  plan: T,
  blockIndex: number,
  exerciseIndex: number,
): T {
  return withBlockExercises(plan, blockIndex, (ids) => {
    ids.splice(exerciseIndex, 1);
    return ids;
  });
}

/** Duplikat landet direkt hinter dem Original (rechts wischen = kopieren). */
export function planWithDuplicatedExercise<T extends WorkoutPlan>(
  plan: T,
  blockIndex: number,
  exerciseIndex: number,
): T {
  return withBlockExercises(plan, blockIndex, (ids) => {
    ids.splice(exerciseIndex + 1, 0, ids[exerciseIndex]);
    return ids;
  });
}

/**
 * Ganze Rubrik entfernen (Trainer-Editor, Leon 30.08.) — restOverrides
 * bleiben bewusst stehen: sie sind pro Übungs-ID und können in anderen
 * Rubriken weiterwirken; verwaiste Einträge sind wirkungslos.
 */
export function planWithRemovedBlock<T extends WorkoutPlan>(
  plan: T,
  blockIndex: number,
): T {
  return {
    ...plan,
    blocks: plan.blocks.filter((_, i) => i !== blockIndex),
  } as T;
}

/** Neue leere Rubrik ans Ende („+ Block", Leon 30.08.) — der Titel wird
    im Editor direkt umbenannt (onBlockTitleChange). */
export function planWithAddedBlock<T extends WorkoutPlan>(plan: T): T {
  return {
    ...plan,
    blocks: [
      ...plan.blocks,
      { title: "Neuer Block", phase: "main", exerciseIds: [], restSeconds: 60 },
    ],
  } as T;
}

/**
 * Ganze Rubrik verschieben (Halten auf freier Blockfläche, Leon 30.08.) —
 * wie bei den Übungen gilt die Zielposition NACH dem Entfernen an der
 * Quelle. Die Zwischen-Pause (restAfterSeconds) wandert mit ihrer Rubrik.
 */
export function planWithMovedBlock<T extends WorkoutPlan>(
  plan: T,
  from: number,
  to: number,
): T {
  const blocks = [...plan.blocks];
  const [moved] = blocks.splice(from, 1);
  if (!moved) return plan;
  blocks.splice(Math.max(0, Math.min(blocks.length, to)), 0, moved);
  return { ...plan, blocks } as T;
}

/**
 * Übung verschieben — auch über Blockgrenzen (Halten + ▲/▼). Die
 * Zielposition gilt NACH dem Entfernen an der Quelle (relevant nur
 * innerhalb desselben Blocks).
 */
export function planWithMovedExercise<T extends WorkoutPlan>(
  plan: T,
  from: { block: number; index: number },
  to: { block: number; index: number },
): T {
  const id = plan.blocks[from.block]?.exerciseIds[from.index];
  if (id === undefined) return plan;
  const removed = withBlockExercises(plan, from.block, (ids) => {
    ids.splice(from.index, 1);
    return ids;
  });
  return withBlockExercises(removed, to.block, (ids) => {
    ids.splice(Math.max(0, Math.min(ids.length, to.index)), 0, id);
    return ids;
  });
}

// ─── Runner (/workout, /workout/session): Payload & Konverter ──────────────

/**
 * Nächstliegende Kern-Kategorie einer Disziplin. Der Runner läuft nativ auf
 * dem Plan-Modell; nur Workout-Logs und die Dashboard-Statistik rechnen
 * weiter in Category — exakt für die vier Kern-Disziplinen, Näherung für
 * den Rest (Familien-Zuordnung wie in lib/discipline-colors.ts).
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

/** Anzeigename der Runner-Phasen — zentrale Quelle für alle Block-Titel. */
export const PHASE_LABEL: Record<WorkoutBlock["phase"], string> = {
  warmup: "Aufwärmen",
  main: "Hauptteil",
  conditioning: "Konditionierung",
  cooldown: "Cooldown",
};

/**
 * Ausgeführtes Workout (Log-Eintrag) → Plan für die persönliche Kopie
 * (Herz-Favorit im Hub, Teilschritt 3). Neue Logs tragen den ausgeführten
 * Plan (Blockpausen und Rubrik-Titel bleiben erhalten); ältere Logs haben
 * stattdessen eine WorkoutDefinition, noch ältere nur die flache
 * Übungsfolge — dann entsteht ein Hauptteil-Block daraus.
 */
export function workoutSessionToPlan(session: WorkoutSession): WorkoutPlan {
  const def = session.definition;
  const blocks: WorkoutPlanBlock[] = session.plan
    ? session.plan.blocks.filter((b) => b.exerciseIds.length > 0)
    : def
      ? def.blocks
          .filter((b) => b.exerciseIds.length > 0)
          .map((b) => ({
            title: PHASE_LABEL[b.phase] ?? b.phase,
            phase: b.phase,
            exerciseIds: b.exerciseIds,
            restSeconds: def.restSeconds,
            restAfterSeconds: def.restSeconds,
          }))
      : [
          {
            title: PHASE_LABEL.main,
            phase: "main" as const,
            exerciseIds: session.exerciseIds,
            restSeconds: session.restSeconds,
          },
        ];
  return {
    id: "",
    slug: "",
    gymId: "personal",
    // Category ist Teilmenge von Discipline (gleiche Slugs)
    discipline: session.plan?.discipline ?? session.category ?? "boxing",
    difficulty: session.difficulty ?? "anfaenger",
    name: session.label ?? "Workout",
    short: "",
    description: "Als Favorit gespeichertes Workout.",
    blocks,
    ...(session.plan?.restOverrides
      ? { restOverrides: session.plan.restOverrides }
      : {}),
  };
}

/**
 * Favoriten-Plan ENTFERNEN (Wischen in „Meine Workouts", leeres Herz auf
 * der Plan-Seite, Herz-Toggle im Hub): löscht die persönliche Kopie und
 * setzt ALLE Log-Einträge zurück, deren Herz auf diesen Plan zeigt —
 * sonst bliebe im Hub/Verlauf ein gefülltes Herz auf einen toten Plan.
 * Rückgabe: die IDs der zurückgesetzten Log-Einträge (für lokalen State).
 */
export async function removeSavedPlan(
  uid: string,
  planId: string,
): Promise<string[]> {
  await deletePersonalWorkoutPlan(uid, planId);
  const workoutsCol = collection(getFirestoreDb(), "users", uid, "workouts");
  const snap = await getDocs(
    query(workoutsCol, where("savedPlanId", "==", planId)),
  );
  await Promise.all(
    snap.docs.map((d) => updateDoc(d.ref, { savedPlanId: null })),
  );
  return snap.docs.map((d) => d.id);
}

/**
 * Herz-Favorit (Hub, Verlauf, Fertig-Screen): speichert ein ausgeführtes
 * Workout als persönlichen Plan bzw. entfernt die Kopie wieder. Rückgabe
 * ist der neue savedPlanId-Zustand des Log-Eintrags (null = entfernt).
 */
export async function toggleWorkoutFavorite(
  uid: string,
  session: WorkoutSession,
): Promise<string | null> {
  if (session.savedPlanId) {
    await removeSavedPlan(uid, session.savedPlanId);
    return null;
  }
  const planId = await upsertPersonalWorkoutPlan(
    uid,
    workoutSessionToPlan(session),
    { sourcePlanId: null },
  );
  await setWorkoutSavedPlan(uid, session.id, planId);
  return planId;
}

/**
 * WorkoutDefinition → Plan. Der Runner läuft nativ auf Plan-Blöcken —
 * Definitionen (Generator-Ergebnisse, ältere Session-Links) werden beim
 * Einlesen in die Plan-Form gehoben. Als Blockpause bleibt nur der flache
 * restSeconds-Timerwert der Definition, mehr weiß sie nicht.
 */
export function workoutDefinitionToPlan(def: WorkoutDefinition): WorkoutPlan {
  return {
    id: def.id,
    slug: def.id,
    gymId: "generated",
    // Category ist Teilmenge von Discipline (gleiche Slugs)
    discipline: def.category,
    difficulty: def.difficulty,
    name: def.label,
    short: "",
    description: `Auto-generiertes Workout — ${DIFFICULTY_LABEL[def.difficulty]} · ${DISCIPLINE_LABEL[def.category]}`,
    blocks: def.blocks
      .filter((b) => b.exerciseIds.length > 0)
      .map((b) => ({
        title: PHASE_LABEL[b.phase] ?? b.phase,
        phase: b.phase,
        exerciseIds: b.exerciseIds,
        restSeconds: def.restSeconds,
        // Generierte Workouts pausieren zwischen allem gleich lang
        restAfterSeconds: def.restSeconds,
      })),
  };
}

/**
 * Plan → ?payload=…-Wert für /workout/session und /workout. Gleiches
 * Encoding wie früher beim Generator (encodeURIComponent im Wert, außen
 * URLSearchParams) — parseSessionPayload ist das Gegenstück.
 */
export function planToSessionPayload(plan: WorkoutPlan): string {
  return encodeURIComponent(JSON.stringify(plan));
}

/**
 * ?payload=…-Wert → Plan. Versteht BEIDE Formate: das Plan-JSON (Standard
 * seit der Runner-Umstellung) und die alte WorkoutDefinition (ältere
 * Bookmarks/Verläufe) — erkannt am label-Feld, das nur Definitionen haben.
 */
export function parseSessionPayload(payload: string | null): WorkoutPlan | null {
  if (!payload) return null;
  try {
    const data = JSON.parse(decodeURIComponent(payload)) as
      | WorkoutPlan
      | WorkoutDefinition;
    if (!data || typeof data !== "object" || !Array.isArray(data.blocks)) {
      return null;
    }
    return "label" in data ? workoutDefinitionToPlan(data) : data;
  } catch {
    return null;
  }
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
  restOverrides?: Record<string, number>;
  sortOrder?: number;
  sourcePlanId?: string | null;
  audienceUids?: string[];
  audienceCourseIds?: string[];
  createdBy?: string;
  createdByName?: string;
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
    ...(data.restOverrides ? { restOverrides: data.restOverrides } : {}),
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
    ...(plan.restOverrides ? { restOverrides: plan.restOverrides } : {}),
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
 * Pläne, die ein Mitglied dieses Gyms sieht — seit dem Seeding (Etappe
 * „Workout-Pläne", Schritt 5) direkt aus Firestore. Die eingebauten
 * Start-Pläne (DEFAULT_WORKOUT_PLANS) sind nur noch Datenquelle des
 * Seed-Skripts (scripts/seed-workout-plans.mjs), kein Laufzeit-Fallback.
 */
export async function listWorkoutPlansForGym(gymId: string): Promise<WorkoutPlan[]> {
  return listGymWorkoutPlans(gymId);
}

/** Einzelner Gym-Plan; Doc-ID = Slug → stabile Deep-Links /workout/plans/[slug]. */
export async function getGymWorkoutPlan(
  gymId: string,
  planId: string,
): Promise<WorkoutPlan | null> {
  const snap = await getDoc(doc(gymPlansCol(gymId), planId));
  if (!snap.exists()) return null;
  return docToPlan(snap.id, snap.data() as WorkoutPlanDoc);
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

/** Einzelne persönliche Kopie — null, wenn es sie (nicht mehr) gibt. */
export async function getPersonalWorkoutPlan(
  uid: string,
  planId: string,
): Promise<PersonalWorkoutPlan | null> {
  const snap = await getDoc(doc(personalPlansCol(uid), planId));
  if (!snap.exists()) return null;
  const data = snap.data() as WorkoutPlanDoc;
  return {
    ...docToPlan(snap.id, data),
    sourcePlanId: data.sourcePlanId ?? null,
    updatedAt: data.updatedAt?.toDate() ?? null,
  };
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

// ─── Firestore: Trainer-Pläne mit Freigabe (AUSBAU Stufe 1) ────────────────

function trainerPlansCol(gymId: string) {
  return collection(getFirestoreDb(), "gyms", gymId, "trainerPlans");
}

function docToTrainerPlan(id: string, data: WorkoutPlanDoc): TrainerWorkoutPlan {
  return {
    ...docToPlan(id, data),
    audienceUids: data.audienceUids ?? [],
    audienceCourseIds: data.audienceCourseIds ?? [],
    createdBy: data.createdBy ?? "",
    createdByName: data.createdByName ?? "",
    updatedAt: data.updatedAt?.toDate() ?? null,
  };
}

/** ALLE Trainer-Pläne des Gyms — nur Trainer/Admin (Rules erzwingen das). */
export async function listTrainerWorkoutPlans(
  gymId: string,
): Promise<TrainerWorkoutPlan[]> {
  const snap = await getDocs(trainerPlansCol(gymId));
  return sortPlans(
    snap.docs.map((d) => docToTrainerPlan(d.id, d.data() as WorkoutPlanDoc)),
  );
}

/**
 * Für DIESEN Athleten freigegebene Trainer-Pläne („Vom Trainer für dich").
 * Die array-contains-Query auf die eigene uid ist für die Rules-Engine
 * beweisbar — mehr darf ein Athlet in dieser Collection nicht lesen.
 */
export async function listSharedTrainerPlans(
  gymId: string,
  uid: string,
): Promise<TrainerWorkoutPlan[]> {
  const snap = await getDocs(
    query(trainerPlansCol(gymId), where("audienceUids", "array-contains", uid)),
  );
  return sortPlans(
    snap.docs.map((d) => docToTrainerPlan(d.id, d.data() as WorkoutPlanDoc)),
  );
}

/** Einzelner Trainer-Plan — wirft permission-denied ohne Freigabe/Rolle. */
export async function getTrainerWorkoutPlan(
  gymId: string,
  planId: string,
): Promise<TrainerWorkoutPlan | null> {
  const snap = await getDoc(doc(trainerPlansCol(gymId), planId));
  if (!snap.exists()) return null;
  return docToTrainerPlan(snap.id, snap.data() as WorkoutPlanDoc);
}

/**
 * Trainer-Plan anlegen/aktualisieren (Inhalt — Name, Blöcke, Pausen, …).
 * Die Freigabe-Felder werden hier bewusst NICHT angefasst (merge), dafür
 * gibt es updateTrainerPlanAudience; beim Anlegen starten sie leer.
 */
export async function upsertTrainerWorkoutPlan(
  gymId: string,
  plan: WorkoutPlan,
  updatedBy: string,
  updatedByName = "",
  options: { isCreator?: boolean } = {},
): Promise<string> {
  const ref = plan.id
    ? doc(trainerPlansCol(gymId), plan.id)
    : doc(trainerPlansCol(gymId));
  await setDoc(
    ref,
    {
      ...planPayload(gymId, plan),
      updatedAt: serverTimestamp(),
      updatedBy,
      // Speichert der ERSTELLER, wird sein Anzeigename aufgefrischt —
      // so heilen Pläne von vor der Namens-Denormalisierung selbst und
      // eine Namensänderung schlägt durch. Fremde Trainer fassen das
      // Feld nie an (sonst stünde ihr Name auf fremden Plänen).
      ...(plan.id && options.isCreator && updatedByName
        ? { createdByName: updatedByName }
        : {}),
      ...(plan.id
        ? {}
        : {
            // Frischer Plan: Freigabe startet leer, Ersteller wird
            // festgeschrieben (Name denormalisiert — s. createdByName)
            audienceUids: [],
            audienceCourseIds: [],
            createdBy: updatedBy,
            createdByName: updatedByName,
            createdAt: serverTimestamp(),
          }),
    },
    { merge: true },
  );
  return ref.id;
}

/**
 * Fremden Trainer-Plan als EIGENEN Plan übernehmen (Leon 31.08.): ein
 * anderer Trainer darf einen freigegebenen Plan anpassen und als neuen
 * eigenen Plan speichern — Original und dessen Freigabe bleiben unberührt,
 * die Kopie startet ohne Freigabe (er gibt sie selbst frei).
 */
export async function copyAsOwnTrainerPlan(
  gymId: string,
  plan: WorkoutPlan,
  createdBy: string,
  createdByName = "",
): Promise<string> {
  return upsertTrainerWorkoutPlan(
    gymId,
    { ...plan, id: "" },
    createdBy,
    createdByName,
  );
}

/**
 * Freigabe MATERIALISIEREN: die explizite Schüler-Auswahl wird als
 * audienceUids geschrieben (Kurse sind nur Anzeige-Info). Snapshot-Semantik —
 * erneutes Speichern aktualisiert die Liste.
 */
export async function updateTrainerPlanAudience(
  gymId: string,
  planId: string,
  audienceUids: string[],
  audienceCourseIds: string[],
): Promise<void> {
  await updateDoc(doc(trainerPlansCol(gymId), planId), {
    audienceUids,
    audienceCourseIds,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTrainerWorkoutPlan(gymId: string, planId: string) {
  await deleteDoc(doc(trainerPlansCol(gymId), planId));
}
