/**
 * Firestore-Schema:
 *
 *   trainingSessions/{blockId}_{weekId}
 *     trainingBlockId  string
 *     weekIdentifier   string   ("2026-W19" — intern, nicht im UI)
 *     exerciseIds      string[]
 *     updatedAt        Timestamp
 *     updatedBy        string   (uid des Trainers)
 *
 *   users/{uid}/library/{exerciseId}   ← exerciseId = Document-ID → kein Duplikat möglich
 *     exerciseId       string
 *     source           "training" | "manual"
 *     trainingSessionId string | null
 *     contextLabel     string | null
 *     addedAt          Timestamp
 *
 *   users/{uid}/participations/{sessionId}
 *     trainingSessionId string
 *     trainingBlockId   string
 *     blockTitle        string
 *     weekIdentifier    string
 *     joinedAt          Timestamp
 *
 * Hinweis Firestore-Regeln: Die Collection `trainingSessions` muss
 *   read: allow if request.auth != null
 *   write: allow if get(/users/$(request.auth.uid)).data.role in ["trainer","admin"]
 * in der Firebase Console konfiguriert werden.
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
import { TRAINING_BLOCKS, getWeekIdentifier } from "./schedule";
import type { BlockSubscription, LibraryEntry, TrainingSession } from "./types";

// ─── Training Sessions ─────────────────────────────────────────────────────

function makeSessionId(blockId: string, weekId: string) {
  return `${blockId}_${weekId}`;
}

function sessionDocRef(blockId: string, weekId: string) {
  return doc(
    getFirestoreDb(),
    "trainingSessions",
    makeSessionId(blockId, weekId),
  );
}

/** Lädt eine Trainingseinheit für einen Block + Woche. Null wenn noch nicht angelegt. */
export async function getTrainingSession(
  blockId: string,
  weekId: string,
): Promise<TrainingSession | null> {
  const snap = await getDoc(sessionDocRef(blockId, weekId));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    id: snap.id,
    trainingBlockId: d.trainingBlockId,
    weekIdentifier: d.weekIdentifier,
    exerciseIds: d.exerciseIds ?? [],
    techniqueIds: d.techniqueIds ?? [],
    updatedAt: d.updatedAt?.toDate(),
    updatedBy: d.updatedBy,
  };
}

/**
 * Speichert Übungen für eine Trainingseinheit (Trainer-Aktion).
 * Erstellt die Session falls nötig.
 */
export async function setSessionExercises(
  blockId: string,
  weekId: string,
  exerciseIds: string[],
  updatedBy: string,
): Promise<TrainingSession> {
  const ref = sessionDocRef(blockId, weekId);
  await setDoc(
    ref,
    {
      trainingBlockId: blockId,
      weekIdentifier: weekId,
      exerciseIds,
      updatedAt: serverTimestamp(),
      updatedBy,
    },
    { merge: true },
  );
  return {
    id: makeSessionId(blockId, weekId),
    trainingBlockId: blockId,
    weekIdentifier: weekId,
    exerciseIds,
    techniqueIds: [],
    updatedBy,
  };
}

/**
 * Speichert Kampftechniken für eine Trainingseinheit (Trainer-Aktion).
 * Ersetzt exerciseIds als primäres Feld für Kurs-Inhalte.
 */
export async function setSessionTechniques(
  blockId: string,
  weekId: string,
  techniqueIds: string[],
  updatedBy: string,
): Promise<TrainingSession> {
  const ref = sessionDocRef(blockId, weekId);
  await setDoc(
    ref,
    {
      trainingBlockId: blockId,
      weekIdentifier: weekId,
      techniqueIds,
      updatedAt: serverTimestamp(),
      updatedBy,
    },
    { merge: true },
  );
  return {
    id: makeSessionId(blockId, weekId),
    trainingBlockId: blockId,
    weekIdentifier: weekId,
    exerciseIds: [],
    techniqueIds,
    updatedBy,
  };
}

// ─── Persönliche Bibliothek ────────────────────────────────────────────────

function libraryDocRef(uid: string, exerciseId: string) {
  return doc(getFirestoreDb(), "users", uid, "library", exerciseId);
}

function libraryColRef(uid: string) {
  return collection(getFirestoreDb(), "users", uid, "library");
}

/**
 * Fügt eine Übung zur persönlichen Bibliothek hinzu.
 * Da exerciseId = Document-ID, sind Duplikate strukturell ausgeschlossen.
 * Gibt `true` zurück wenn neu hinzugefügt, `false` wenn bereits vorhanden.
 */
export async function addToLibrary(
  uid: string,
  exerciseId: string,
  source: "training" | "manual",
  trainingSessionId?: string,
  contextLabel?: string,
): Promise<boolean> {
  const ref = libraryDocRef(uid, exerciseId);
  const existing = await getDoc(ref);
  if (existing.exists()) return false;

  await setDoc(ref, {
    exerciseId,
    type: "exercise",
    source,
    trainingSessionId: trainingSessionId ?? null,
    contextLabel: contextLabel ?? null,
    addedAt: serverTimestamp(),
  });
  return true;
}

/**
 * Fügt eine Kampftechnik zur persönlichen Bibliothek hinzu.
 * techniqueId = Document-ID → kein Duplikat möglich.
 * Gibt `true` zurück wenn neu hinzugefügt, `false` wenn bereits vorhanden.
 */
export async function addTechniqueToLibrary(
  uid: string,
  techniqueId: string,
  source: "training" | "manual",
  trainingSessionId?: string,
  contextLabel?: string,
): Promise<boolean> {
  const ref = libraryDocRef(uid, techniqueId);
  const existing = await getDoc(ref);
  if (existing.exists()) return false;

  await setDoc(ref, {
    exerciseId: techniqueId,
    type: "technique",
    source,
    trainingSessionId: trainingSessionId ?? null,
    contextLabel: contextLabel ?? null,
    addedAt: serverTimestamp(),
  });
  return true;
}

/**
 * Fügt alle Techniken einer Session zur Bibliothek hinzu.
 * Vollständig dedup-sicher. Gibt Anzahl neu hinzugefügter Techniken zurück.
 */
export async function addSessionTechniquesToLibrary(
  uid: string,
  session: TrainingSession,
  contextLabel: string,
): Promise<number> {
  let added = 0;
  for (const techniqueId of session.techniqueIds ?? []) {
    const wasNew = await addTechniqueToLibrary(
      uid,
      techniqueId,
      "training",
      session.id,
      contextLabel,
    );
    if (wasNew) added++;
  }
  return added;
}

/**
 * Fügt alle Übungen einer Session zur Bibliothek hinzu.
 * Vollständig dedup-sicher. Gibt Anzahl neu hinzugefügter Übungen zurück.
 */
export async function addSessionExercisesToLibrary(
  uid: string,
  session: TrainingSession,
  contextLabel: string,
): Promise<number> {
  let added = 0;
  for (const exerciseId of session.exerciseIds) {
    const wasNew = await addToLibrary(
      uid,
      exerciseId,
      "training",
      session.id,
      contextLabel,
    );
    if (wasNew) added++;
  }
  return added;
}

/** Liest die gesamte Bibliothek des Users (absteigend nach Datum). */
export async function getLibrary(uid: string): Promise<LibraryEntry[]> {
  const q = query(libraryColRef(uid), orderBy("addedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      exerciseId: data.exerciseId as string,
      type: (data.type as "exercise" | "technique") ?? undefined,
      source: data.source as "training" | "manual",
      trainingSessionId: data.trainingSessionId ?? undefined,
      contextLabel: data.contextLabel ?? undefined,
      addedAt: (data.addedAt as Timestamp).toDate(),
    };
  });
}

/** Entfernt eine Übung aus der persönlichen Bibliothek. */
export async function removeFromLibrary(
  uid: string,
  exerciseId: string,
): Promise<void> {
  await deleteDoc(libraryDocRef(uid, exerciseId));
}

// ─── Teilnahmen ────────────────────────────────────────────────────────────

function participationDocRef(uid: string, sessionId: string) {
  return doc(getFirestoreDb(), "users", uid, "participations", sessionId);
}

/** Speichert eine Trainingsteilnahme. Idempotent — zweimaliges Klicken hat keinen Effekt. */
export async function recordParticipation(
  uid: string,
  session: TrainingSession,
  blockTitle: string,
  /**
   * Das Gym des Teilnehmers. Ohne diese Angabe zählt die Teilnahme in keiner
   * Gym-Kennzahl mit — siehe `Participation.gymId` in lib/types.ts: Eine
   * collectionGroup-Abfrage sieht den Elternpfad nicht und kann die
   * Zugehörigkeit sonst weder lesen noch in den Regeln prüfen.
   */
  gymId?: string,
): Promise<void> {
  const ref = participationDocRef(uid, session.id);
  const existing = await getDoc(ref);
  if (existing.exists()) return;

  await setDoc(ref, {
    trainingSessionId: session.id,
    trainingBlockId: session.trainingBlockId,
    blockTitle,
    weekIdentifier: session.weekIdentifier,
    joinedAt: serverTimestamp(),
    ...(gymId ? { gymId } : {}),
  });
}

/** Prüft ob der User bereits an einer Session teilnimmt. */
export async function hasParticipated(
  uid: string,
  sessionId: string,
): Promise<boolean> {
  const snap = await getDoc(participationDocRef(uid, sessionId));
  return snap.exists();
}

/** Zählt Trainingseinheiten, die in einer bestimmten Woche angelegt wurden (Trainer-Dashboard). */
export async function getSessionCountForWeek(weekId: string): Promise<number> {
  const q = query(
    collection(getFirestoreDb(), "trainingSessions"),
    where("weekIdentifier", "==", weekId),
  );
  const snap = await getDocs(q);
  return snap.size;
}

// ─── Kurs-Abonnements ──────────────────────────────────────────────────────

function subscriptionDocRef(uid: string, blockId: string) {
  return doc(getFirestoreDb(), "users", uid, "subscriptions", blockId);
}

function subscriptionColRef(uid: string) {
  return collection(getFirestoreDb(), "users", uid, "subscriptions");
}

/** Abonniert einen festen Wochenkurs. Idempotent. */
export async function subscribeToBlock(
  uid: string,
  blockId: string,
): Promise<void> {
  const block = TRAINING_BLOCKS.find((b) => b.id === blockId);
  if (!block) throw new Error(`Unknown training block: ${blockId}`);

  const ref = subscriptionDocRef(uid, blockId);
  const existing = await getDoc(ref);
  if (existing.exists()) return;

  await setDoc(ref, {
    trainingBlockId: blockId,
    blockTitle: block.title,
    weekday: block.weekday,
    startTime: block.startTime,
    subscribedAt: serverTimestamp(),
  });
}

/** Hebt das Abo eines Kurses auf. */
export async function unsubscribeFromBlock(
  uid: string,
  blockId: string,
): Promise<void> {
  await deleteDoc(subscriptionDocRef(uid, blockId));
}

/** Prüft ob der User einen Kurs abonniert hat. */
export async function isSubscribedToBlock(
  uid: string,
  blockId: string,
): Promise<boolean> {
  const snap = await getDoc(subscriptionDocRef(uid, blockId));
  return snap.exists();
}

/** Listet alle Kurs-Abos eines Users. */
export async function getSubscriptions(
  uid: string,
): Promise<BlockSubscription[]> {
  const snap = await getDocs(subscriptionColRef(uid));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      trainingBlockId: data.trainingBlockId as string,
      blockTitle: data.blockTitle as string,
      weekday: data.weekday as number,
      startTime: data.startTime as string,
      subscribedAt: (data.subscribedAt as Timestamp | undefined)?.toDate() ?? new Date(),
      lastSyncedWeek: data.lastSyncedWeek as string | undefined,
    };
  });
}

/**
 * Welche der übergebenen Mitglieder haben diesen Kurs abonniert? (Freigabe-
 * Dialog der Trainer-Pläne: Kurs-Auswahl belegt die Schüler-Checkliste vor.)
 * Ein getDoc pro Mitglied — die Doc-ID der Subcollection IST die Kurs-ID,
 * und Trainer dürfen die Abos ihrer Gym-Mitglieder per Rules lesen. Eine
 * collectionGroup-Query wäre billiger, hat aber bewusst keine Rules-Freigabe.
 */
export async function filterSubscribedUids(
  blockId: string,
  uids: string[],
): Promise<string[]> {
  const checks = await Promise.all(
    uids.map(async (uid) => {
      try {
        const snap = await getDoc(subscriptionDocRef(uid, blockId));
        return snap.exists() ? uid : null;
      } catch {
        return null;
      }
    }),
  );
  return checks.filter((uid): uid is string => uid !== null);
}

/**
 * Synchronisiert alle abonnierten Kurse für die aktuelle Woche.
 * Holt zugewiesene Techniken und packt sie in die Library.
 * `lastSyncedWeek` verhindert Doppelsync innerhalb derselben Woche.
 *
 * @returns Anzahl neu zur Bibliothek hinzugefügter Techniken
 */
export async function syncSubscribedBlocks(uid: string): Promise<number> {
  const subs = await getSubscriptions(uid);
  if (subs.length === 0) return 0;

  const weekId = getWeekIdentifier();
  let totalAdded = 0;

  for (const sub of subs) {
    if (sub.lastSyncedWeek === weekId) continue;

    const session = await getTrainingSession(sub.trainingBlockId, weekId);
    const hasTechniques = !!session && (session.techniqueIds?.length ?? 0) > 0;

    if (hasTechniques && session) {
      const added = await addSessionTechniquesToLibrary(uid, session, sub.blockTitle);
      totalAdded += added;
    }

    // Nur als gesynct markieren wenn der Trainer schon Techniken hinterlegt hat —
    // sonst verpasst der User Inhalte, die nach dem ersten App-Load der Woche
    // hinzugefügt werden.
    if (hasTechniques) {
      await updateDoc(subscriptionDocRef(uid, sub.trainingBlockId), {
        lastSyncedWeek: weekId,
      });
    }
  }

  return totalAdded;
}
