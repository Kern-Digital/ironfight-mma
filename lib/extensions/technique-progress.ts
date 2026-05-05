/**
 * Technik-Fortschritt (Stub mit minimalem Firestore-CRUD)
 *
 * Pro User × Technik wird ein Status gespeichert:
 *   not_started → learned → practiced → mastered
 *
 * Aktuell nur Datenstruktur und CRUD vorhanden — UI-Integration folgt
 * in einer späteren Iteration (im Dashboard und auf der Technik-Detailseite).
 */

import {
  doc,
  getDoc,
  getDocs,
  collection,
  serverTimestamp,
  setDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { getFirestoreDb } from "../firebase";
import type {
  TechniqueProgress,
  TechniqueProgressStatus,
} from "../types";

type Doc = {
  status: TechniqueProgressStatus;
  practiceCount: number;
  lastPracticedAt?: Timestamp | null;
  updatedAt?: Timestamp;
};

function ref(uid: string, techniqueId: string) {
  return doc(getFirestoreDb(), "users", uid, "techniqueProgress", techniqueId);
}

export async function getTechniqueProgress(
  uid: string,
  techniqueId: string,
): Promise<TechniqueProgress | null> {
  const snap = await getDoc(ref(uid, techniqueId));
  if (!snap.exists()) return null;
  const data = snap.data() as Doc;
  return {
    techniqueId,
    status: data.status,
    practiceCount: data.practiceCount ?? 0,
    lastPracticedAt: data.lastPracticedAt?.toDate(),
  };
}

export async function setTechniqueStatus(
  uid: string,
  techniqueId: string,
  status: TechniqueProgressStatus,
) {
  await setDoc(
    ref(uid, techniqueId),
    {
      status,
      practiceCount: 0,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function recordPractice(uid: string, techniqueId: string) {
  const r = ref(uid, techniqueId);
  const snap = await getDoc(r);
  const prev = snap.exists()
    ? (snap.data() as Doc).practiceCount ?? 0
    : 0;
  await setDoc(
    r,
    {
      status: "practiced",
      practiceCount: prev + 1,
      lastPracticedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function getAllProgress(uid: string): Promise<TechniqueProgress[]> {
  const col = collection(getFirestoreDb(), "users", uid, "techniqueProgress");
  const snap = await getDocs(col);
  return snap.docs.map((d) => {
    const data = d.data() as Doc;
    return {
      techniqueId: d.id,
      status: data.status,
      practiceCount: data.practiceCount ?? 0,
      lastPracticedAt: data.lastPracticedAt?.toDate(),
    };
  });
}
