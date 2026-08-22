import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getFirestoreDb } from "./firebase";
import {
  DEFAULT_USER_SETTINGS,
  type AthleteProfile,
  type UserProfile,
  type UserRole,
  type UserSettings,
} from "./types";

/** Firestore-Repräsentation des Athleten-Profils (Date → Timestamp) */
type AthleteDoc = {
  primaryDiscipline?: AthleteProfile["primaryDiscipline"];
  gender?: AthleteProfile["gender"];
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

function athleteFromDoc(data?: AthleteDoc | null): AthleteProfile | undefined {
  if (!data) return undefined;
  return {
    primaryDiscipline: data.primaryDiscipline ?? null,
    gender: data.gender ?? null,
    level: data.level ?? null,
    trainingStartDate: data.trainingStartDate?.toDate() ?? null,
    weightKg: data.weightKg ?? null,
    heightCm: data.heightCm ?? null,
    reachCm: data.reachCm ?? null,
    stance: data.stance ?? null,
    weightClass: data.weightClass ?? null,
    bjjBelt: data.bjjBelt ?? null,
    gymName: data.gymName ?? null,
    trainerName: data.trainerName ?? null,
    nextCompetitionDate: data.nextCompetitionDate?.toDate() ?? null,
    nextCompetitionName: data.nextCompetitionName ?? null,
  };
}

/**
 * Firestore-Schema:
 *   users/{uid}  → UserProfile-Dokument
 *
 * Wichtig: `displayName` ist hier der vom NUTZER gewählte FighterName
 *          und ist absichtlich getrennt vom Auth-Provider-Namen
 *          (z. B. Google-Klarname).
 */

type ProfileDoc = {
  email: string | null;
  authProviderName: string | null;
  displayName: string | null;
  username?: string | null;
  role?: UserRole;
  gymId?: string | null;
  settings: UserSettings;
  onboarded: boolean;
  trainerOnboarded?: boolean;
  createdAt?: Timestamp;
  athlete?: AthleteDoc;
};

function profileRef(uid: string) {
  return doc(getFirestoreDb(), "users", uid);
}

/** Liest das Profil aus Firestore. Erstellt es nicht. */
export async function getUserProfile(
  uid: string,
): Promise<UserProfile | null> {
  const snap = await getDoc(profileRef(uid));
  if (!snap.exists()) return null;
  const data = snap.data() as ProfileDoc;
  return {
    uid,
    email: data.email,
    authProviderName: data.authProviderName,
    displayName: data.displayName,
    username: data.username ?? null,
    role: data.role,
    gymId: data.gymId ?? null,
    settings: { ...DEFAULT_USER_SETTINGS, ...(data.settings ?? {}) },
    onboarded: data.onboarded === true,
    trainerOnboarded: data.trainerOnboarded === true,
    createdAt: data.createdAt?.toDate(),
    athlete: athleteFromDoc(data.athlete),
  };
}

/**
 * Stellt sicher, dass ein Profil existiert.
 * Wenn keins existiert, wird eines mit defaults angelegt.
 * Der Auth-Anzeigename (Google etc.) wird in `authProviderName` gespeichert,
 * NICHT in `displayName`. So kommt der Klarname nicht in die UI.
 */
export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const ref = profileRef(user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data() as ProfileDoc;
    // Auth-Provider-Name aktualisieren falls geändert (Display-Name bleibt!)
    if (data.authProviderName !== user.displayName && user.displayName) {
      await updateDoc(ref, { authProviderName: user.displayName });
    }
    return {
      uid: user.uid,
      email: data.email,
      authProviderName: user.displayName ?? data.authProviderName,
      displayName: data.displayName,
      username: data.username ?? null,
      role: data.role,
      gymId: data.gymId ?? null,
      settings: { ...DEFAULT_USER_SETTINGS, ...(data.settings ?? {}) },
      onboarded: data.onboarded === true,
      trainerOnboarded: data.trainerOnboarded === true,
      createdAt: data.createdAt?.toDate(),
      athlete: athleteFromDoc(data.athlete),
    };
  }

  // Neuer User: Auth-Name wandert in authProviderName, displayName bleibt null
  const newDoc: ProfileDoc = {
    email: user.email,
    authProviderName: user.displayName ?? null,
    displayName: null,
    username: null,
    settings: DEFAULT_USER_SETTINGS,
    onboarded: false,
  };
  await setDoc(ref, { ...newDoc, createdAt: serverTimestamp() });

  return {
    uid: user.uid,
    email: user.email,
    authProviderName: user.displayName ?? null,
    displayName: null,
    username: null,
    settings: DEFAULT_USER_SETTINGS,
    onboarded: false,
  };
}

/** Setzt den vom User gewählten FighterName. */
export async function setDisplayName(uid: string, displayName: string | null) {
  const trimmed = displayName?.trim() || null;
  await setDoc(profileRef(uid), { displayName: trimmed, onboarded: true }, { merge: true });
}

/** Markiert den Onboarding-Flow als abgeschlossen, ohne Namen zu setzen. */
export async function markOnboarded(uid: string) {
  await setDoc(profileRef(uid), { onboarded: true }, { merge: true });
}

/** Markiert das Trainer-Erst-Onboarding als gesehen. */
export async function markTrainerOnboarded(uid: string) {
  await setDoc(profileRef(uid), { trainerOnboarded: true }, { merge: true });
}

/** Aktualisiert User-Settings teilweise. */
export async function updateUserSettings(
  uid: string,
  patch: Partial<UserSettings>,
) {
  const ref = profileRef(uid);
  const snap = await getDoc(ref);
  const current = snap.exists()
    ? ((snap.data() as ProfileDoc).settings ?? DEFAULT_USER_SETTINGS)
    : DEFAULT_USER_SETTINGS;
  await setDoc(ref, { settings: { ...current, ...patch } }, { merge: true });
}

/** Patcht das Athleten-Profil (alle Felder optional). */
export async function updateAthleteProfile(
  uid: string,
  patch: Partial<AthleteProfile>,
) {
  const ref = profileRef(uid);
  const snap = await getDoc(ref);
  const current =
    (snap.exists() ? (snap.data() as ProfileDoc).athlete : undefined) ?? {};

  // Date-Felder zu Timestamp konvertieren, undefined → existing, null → null (clear)
  const next: AthleteDoc = { ...current };
  if (patch.primaryDiscipline !== undefined) next.primaryDiscipline = patch.primaryDiscipline;
  if (patch.gender !== undefined) next.gender = patch.gender;
  if (patch.level !== undefined) next.level = patch.level;
  if (patch.trainingStartDate !== undefined) {
    next.trainingStartDate = patch.trainingStartDate
      ? Timestamp.fromDate(patch.trainingStartDate)
      : null;
  }
  if (patch.weightKg !== undefined) next.weightKg = patch.weightKg;
  if (patch.heightCm !== undefined) next.heightCm = patch.heightCm;
  if (patch.reachCm !== undefined) next.reachCm = patch.reachCm;
  if (patch.stance !== undefined) next.stance = patch.stance;
  if (patch.weightClass !== undefined) next.weightClass = patch.weightClass;
  if (patch.bjjBelt !== undefined) next.bjjBelt = patch.bjjBelt;
  if (patch.gymName !== undefined) next.gymName = patch.gymName;
  if (patch.trainerName !== undefined) next.trainerName = patch.trainerName;
  if (patch.nextCompetitionDate !== undefined) {
    next.nextCompetitionDate = patch.nextCompetitionDate
      ? Timestamp.fromDate(patch.nextCompetitionDate)
      : null;
  }
  if (patch.nextCompetitionName !== undefined) {
    next.nextCompetitionName = patch.nextCompetitionName;
  }

  await setDoc(ref, { athlete: next }, { merge: true });
}

/**
 * Vorbereitung für Community-Funktionen:
 * Reserviert einen eindeutigen Username. Aktuell nur ein Platzhalter.
 * Wenn später Leaderboards/Chat dazukommen, wird hier eine Uniqueness-Prüfung ergänzt.
 */
export async function reserveUsername(uid: string, username: string) {
  // TODO: Uniqueness via separate `usernames`-Collection (Transaction)
  await setDoc(profileRef(uid), { username: username.trim().toLowerCase() }, { merge: true });
}
