/**
 * Admin-Funktionen — nur für Nutzer mit role = "admin" aufrufbar.
 * Firestore-Regeln erzwingen dies serverseitig.
 *
 * Trainer-Lesefunktionen (z. B. `listAllStudents`) erfordern, dass die
 * Firestore-Regeln Trainer-Lesezugriff auf die `users`-Collection erlauben.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { getFirestoreDb } from "./firebase";
import type { AthleteProfile, UserRole } from "./types";

export type AdminUserEntry = {
  uid: string;
  email: string | null;
  displayName: string | null;
  authProviderName: string | null;
  role: UserRole | undefined;
  createdAt: Date | undefined;
};

export type StudentEntry = AdminUserEntry & {
  athlete?: AthleteProfile;
};

/**
 * Lädt einen einzelnen Schüler inkl. Athleten-Profil (Trainer-Detailansicht).
 * Wirft, wenn das Profil nicht existiert oder Lese-Zugriff fehlt.
 */
export async function getStudentEntry(uid: string): Promise<StudentEntry | null> {
  const ref = doc(getFirestoreDb(), "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as Record<string, unknown>;
  const athleteData = data.athlete as
    | {
        primaryDiscipline?: AthleteProfile["primaryDiscipline"];
        level?: AthleteProfile["level"];
        trainingStartDate?: Timestamp | null;
        weightKg?: number | null;
        heightCm?: number | null;
        reachCm?: number | null;
        stance?: AthleteProfile["stance"];
        weightClass?: AthleteProfile["weightClass"];
        bjjBelt?: AthleteProfile["bjjBelt"];
        gymName?: string | null;
        trainerName?: string | null;
        nextCompetitionDate?: Timestamp | null;
        nextCompetitionName?: string | null;
      }
    | undefined;
  const athlete: AthleteProfile | undefined = athleteData
    ? {
        primaryDiscipline: athleteData.primaryDiscipline ?? null,
        level: athleteData.level ?? null,
        trainingStartDate: athleteData.trainingStartDate?.toDate() ?? null,
        weightKg: athleteData.weightKg ?? null,
        heightCm: athleteData.heightCm ?? null,
        reachCm: athleteData.reachCm ?? null,
        stance: athleteData.stance ?? null,
        weightClass: athleteData.weightClass ?? null,
        bjjBelt: athleteData.bjjBelt ?? null,
        gymName: athleteData.gymName ?? null,
        trainerName: athleteData.trainerName ?? null,
        nextCompetitionDate: athleteData.nextCompetitionDate?.toDate() ?? null,
        nextCompetitionName: athleteData.nextCompetitionName ?? null,
      }
    : undefined;
  return {
    uid: snap.id,
    email: (data.email as string | null) ?? null,
    displayName: (data.displayName as string | null) ?? null,
    authProviderName: (data.authProviderName as string | null) ?? null,
    role: data.role as UserRole | undefined,
    createdAt: (data.createdAt as Timestamp | undefined)?.toDate(),
    athlete,
  } satisfies StudentEntry;
}

/** Lädt alle registrierten Nutzer (absteigend nach Registrierungsdatum). */
export async function listAllUsers(): Promise<AdminUserEntry[]> {
  const q = query(
    collection(getFirestoreDb(), "users"),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      uid: d.id,
      email: data.email ?? null,
      displayName: data.displayName ?? null,
      authProviderName: data.authProviderName ?? null,
      role: data.role as UserRole | undefined,
      createdAt: data.createdAt?.toDate() as Date | undefined,
    };
  });
}

/**
 * Lädt alle Schüler/Mitglieder inkl. Athleten-Profil.
 * Trainer und Admins sehen die gesamte Mitgliederliste; Trainer-/Admin-Accounts
 * werden ausgefiltert, da der Fokus auf Schülern liegt.
 */
export async function listAllStudents(): Promise<StudentEntry[]> {
  const q = query(
    collection(getFirestoreDb(), "users"),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => {
      const data = d.data() as Record<string, unknown>;
      const athleteData = data.athlete as
        | {
            primaryDiscipline?: AthleteProfile["primaryDiscipline"];
            level?: AthleteProfile["level"];
            trainingStartDate?: Timestamp | null;
            weightKg?: number | null;
            heightCm?: number | null;
            reachCm?: number | null;
            stance?: AthleteProfile["stance"];
            weightClass?: AthleteProfile["weightClass"];
            bjjBelt?: AthleteProfile["bjjBelt"];
            gymName?: string | null;
            trainerName?: string | null;
            nextCompetitionDate?: Timestamp | null;
            nextCompetitionName?: string | null;
          }
        | undefined;
      const athlete: AthleteProfile | undefined = athleteData
        ? {
            primaryDiscipline: athleteData.primaryDiscipline ?? null,
            level: athleteData.level ?? null,
            trainingStartDate: athleteData.trainingStartDate?.toDate() ?? null,
            weightKg: athleteData.weightKg ?? null,
            heightCm: athleteData.heightCm ?? null,
            reachCm: athleteData.reachCm ?? null,
            stance: athleteData.stance ?? null,
            weightClass: athleteData.weightClass ?? null,
            bjjBelt: athleteData.bjjBelt ?? null,
            gymName: athleteData.gymName ?? null,
            trainerName: athleteData.trainerName ?? null,
            nextCompetitionDate:
              athleteData.nextCompetitionDate?.toDate() ?? null,
            nextCompetitionName: athleteData.nextCompetitionName ?? null,
          }
        : undefined;
      return {
        uid: d.id,
        email: (data.email as string | null) ?? null,
        displayName: (data.displayName as string | null) ?? null,
        authProviderName: (data.authProviderName as string | null) ?? null,
        role: data.role as UserRole | undefined,
        createdAt: (data.createdAt as Timestamp | undefined)?.toDate(),
        athlete,
      } satisfies StudentEntry;
    })
    .filter((u) => (u.role ?? "user") === "user");
}
