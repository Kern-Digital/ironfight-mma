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
  where,
} from "firebase/firestore";
import { getFirestoreDb } from "./firebase";
import { effectiveRights, readRoleSet, type RoleSet } from "./roles";
import type { AthleteProfile } from "./types";

export type AdminUserEntry = {
  uid: string;
  email: string | null;
  displayName: string | null;
  authProviderName: string | null;
  /**
   * Rechte aus dem Abfrage-Spiegel am users-Dokument (Checkpoint 3,
   * lib/roles.ts) — Plattform-Rang eingerechnet.
   *
   * AUTORITATIV IST DER CUSTOM CLAIM; hier steht der Spiegel, weil Claims
   * nicht abfragbar sind und die Mitgliederliste die Häkchen anzeigen muss.
   * Geschrieben wird er ausschliesslich von /api/members/role, die dabei
   * Claim und Spiegel gemeinsam setzt (und die Claims zurücknimmt, wenn der
   * Spiegel fehlschlägt).
   */
  rights: RoleSet;
  /**
   * Beitritt zum Gym (gesetzt von /api/invites/redeem). Fehlt bei
   * Bestandsmitgliedern, die es vor dem Einladungssystem schon gab — dann
   * gilt `createdAt` (siehe memberSince in lib/members.ts).
   */
  gymJoinedAt: Date | undefined;
  createdAt: Date | undefined;
  /**
   * Gym des Kontos — `null` heißt NICHT „Default-Gym", sondern „gehört
   * gerade zu keinem Gym" (CLAUDE.md, „Konto vs. Mitgliedschaft"): so sieht
   * ein Konto nach `/api/members/remove` aus und jedes, das sich ohne
   * Einladung registriert hat.
   *
   * NUR DIE PLATTFORM-ÜBERSICHT BRAUCHT DAS FELD. Eine Gym-Liste ist
   * ohnehin nach `gymId` gefiltert — dort wäre die Angabe an jeder Zeile
   * dieselbe. Erst plattformweit wird sie zur Frage: Wie verteilen sich die
   * Konten auf die Gyms, und wie viele hängen an keinem?
   */
  gymId: string | null;
  /**
   * Marke der Demo-Mitglieder (`scripts/seed-demo-gym.mjs`). Sie sind
   * users-Dokumente OHNE Auth-Konto — niemand meldet sich als Demo-Mitglied
   * an. Ohne diese Marke wäre jede plattformweite Zahl um die Demo-Menge zu
   * hoch, ohne dass es jemandem auffiele.
   */
  isDemo: boolean;
};

export type StudentEntry = AdminUserEntry & {
  athlete?: AthleteProfile;
};

type AthleteDoc = {
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
};

function decodeAthlete(raw: AthleteDoc | undefined): AthleteProfile | undefined {
  if (!raw) return undefined;
  return {
    primaryDiscipline: raw.primaryDiscipline ?? null,
    level: raw.level ?? null,
    trainingStartDate: raw.trainingStartDate?.toDate() ?? null,
    weightKg: raw.weightKg ?? null,
    heightCm: raw.heightCm ?? null,
    reachCm: raw.reachCm ?? null,
    stance: raw.stance ?? null,
    weightClass: raw.weightClass ?? null,
    bjjBelt: raw.bjjBelt ?? null,
    gymName: raw.gymName ?? null,
    trainerName: raw.trainerName ?? null,
    nextCompetitionDate: raw.nextCompetitionDate?.toDate() ?? null,
    nextCompetitionName: raw.nextCompetitionName ?? null,
  };
}

function decodeStudentEntry(
  uid: string,
  data: Record<string, unknown>,
): StudentEntry {
  return {
    uid,
    email: (data.email as string | null) ?? null,
    displayName: (data.displayName as string | null) ?? null,
    authProviderName: (data.authProviderName as string | null) ?? null,
    rights: effectiveRights(readRoleSet(data)),
    gymId: ((data.gymId as string | null | undefined) ?? null) || null,
    isDemo: data.isDemo === true,
    gymJoinedAt: (data.gymJoinedAt as Timestamp | undefined)?.toDate(),
    createdAt: (data.createdAt as Timestamp | undefined)?.toDate(),
    athlete: decodeAthlete(data.athlete as AthleteDoc | undefined),
  } satisfies StudentEntry;
}

/** Trainer- oder Admin-Account (im Kampfkontext trotzdem ein Athlet). */
export function isStaffEntry(entry: { rights: RoleSet }): boolean {
  return entry.rights.trainer;
}

/**
 * Lädt einen einzelnen Schüler inkl. Athleten-Profil (Trainer-Detailansicht).
 * Wirft, wenn das Profil nicht existiert oder Lese-Zugriff fehlt.
 */
export async function getStudentEntry(uid: string): Promise<StudentEntry | null> {
  const ref = doc(getFirestoreDb(), "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return decodeStudentEntry(snap.id, snap.data() as Record<string, unknown>);
}

/**
 * Lädt alle registrierten Nutzer (absteigend nach Registrierungsdatum).
 * NUR für Plattform-Admins: die Firestore-Regeln erlauben die ungefilterte
 * users-Query ausschließlich dem Plattform-Rang (gym-übergreifend).
 */
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
      rights: effectiveRights(readRoleSet(data)),
      gymId: ((data.gymId as string | null | undefined) ?? null) || null,
      isDemo: data.isDemo === true,
      gymJoinedAt: data.gymJoinedAt?.toDate() as Date | undefined,
      createdAt: data.createdAt?.toDate() as Date | undefined,
    };
  });
}

/**
 * Lädt ALLE Mitglieder des eigenen Gyms inkl. Athleten-Profil — ohne
 * Rollenfilter. `gymId` = resolveGymId(profile); die Firestore-Regeln lassen
 * Trainern ohnehin nur das eigene Gym (Query MUSS daher gym-gefiltert sein).
 *
 * Gedacht für Kontexte, in denen auch Trainer/Admins **Athleten** sind
 * (Wettkampf anlegen, DeepFight-Analysen): dort ist die Rolle nur ein Label,
 * kein Ausschlusskriterium. Wer eine reine Schülerliste braucht (Verwaltung,
 * Kurs-Abos, Fortschritt), nimmt `listAllStudents()`.
 */
export async function listAllMembers(gymId: string): Promise<StudentEntry[]> {
  const q = query(
    collection(getFirestoreDb(), "users"),
    where("gymId", "==", gymId),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) =>
    decodeStudentEntry(d.id, d.data() as Record<string, unknown>),
  );
}

/**
 * Lädt alle Schüler/Mitglieder des eigenen Gyms inkl. Athleten-Profil.
 * Trainer-/Admin-Accounts werden ausgefiltert, da der Fokus auf Schülern liegt.
 */
export async function listAllStudents(gymId: string): Promise<StudentEntry[]> {
  const members = await listAllMembers(gymId);
  return members.filter((u) => !isStaffEntry(u));
}
