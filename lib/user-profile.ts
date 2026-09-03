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
import { NO_RIGHTS, readRoleSet } from "./roles";
import {
  DEFAULT_USER_SETTINGS,
  type AthleteProfile,
  type UserProfile,
  type UserRole,
  type UserSettings,
} from "./types";

/**
 * Firestore-Repräsentation des Athleten-Profils (Date → Timestamp).
 *
 * WO ES LIEGT (seit 03.09.2026): in `users/{uid}/athleteProfile/main` — NICHT
 * mehr als Feld `athlete` am users-Dokument. Grund ist Leons Vorgabe, dass
 * Trainer das Athletenprofil eines KOLLEGEN nur mit dessen Freigabe sehen:
 * Firestore-Regeln können keine einzelnen Felder verbergen, nur ganze
 * Dokumente — und das users-Dokument muss lesbar bleiben, sonst fehlt in
 * jeder Liste der Name. Also zieht das Persönliche eine Ebene tiefer, wo eine
 * eigene Regel greift (firestore.rules, `canAccessMemberData`).
 *
 * RÜCKFALL AUF DAS ALTE FELD: Bis `scripts/migrate-private-profile.mjs`
 * gelaufen ist, liest jeder Leser erst die Unter-Sammlung und dann das Feld.
 * So bleibt Produktion in der Minute zwischen Code-Deploy und Migration
 * heil. Der Rückfall greift NUR bei „Dokument fehlt", nie bei „Zugriff
 * verweigert" — sonst würde er das Gate unterlaufen.
 */
export type AthleteDoc = {
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
  /**
   * Abfrage-Spiegel des Rollen-Sets (siehe UserProfile.rights). Autoritativ
   * sind die Custom Claims; hier stehen die Felder nur, weil Claims nicht
   * abfragbar sind. `role` ist der Übergangs-Spiegel (lib/roles.ts).
   */
  role?: UserRole;
  trainer?: boolean;
  verwaltung?: boolean;
  admin?: boolean;
  gymId?: string | null;
  /** Beitritt zum Gym (serverseitig, /api/invites/redeem). */
  gymJoinedAt?: Timestamp | null;
  settings: UserSettings;
  onboarded: boolean;
  trainerOnboarded?: boolean;
  createdAt?: Timestamp;
  /** ALT — nur noch als Rückfall gelesen, nie mehr geschrieben. */
  athlete?: AthleteDoc;
  /**
   * Wer außer dem Inhaber das Persönliche sehen darf (uids). Nur für
   * Stab-Konten von Bedeutung: Athleten sind für alle Trainer ihres Gyms
   * sichtbar wie bisher. Fehlt oder leer = privat (deny-by-default).
   */
  profileSharedWith?: string[];
};

function profileRef(uid: string) {
  return doc(getFirestoreDb(), "users", uid);
}

/** Die neue Heimat des Athletenprofils (siehe Kopfkommentar zu AthleteDoc). */
export function athleteProfileRef(uid: string) {
  return doc(getFirestoreDb(), "users", uid, "athleteProfile", "main");
}

/**
 * Liest das Athletenprofil: zuerst die Unter-Sammlung, sonst das alte Feld
 * (`fallback`, aus dem bereits geladenen users-Dokument). Wirft bei
 * verweigertem Zugriff — das ist gewollt, siehe Kopfkommentar.
 */
export async function readAthleteProfile(
  uid: string,
  fallback?: AthleteDoc | null,
): Promise<AthleteProfile | undefined> {
  const snap = await getDoc(athleteProfileRef(uid));
  if (snap.exists()) return athleteFromDoc(snap.data() as AthleteDoc);
  return athleteFromDoc(fallback);
}

/** Liest das Profil aus Firestore. Erstellt es nicht. */
export async function getUserProfile(
  uid: string,
): Promise<UserProfile | null> {
  const snap = await getDoc(profileRef(uid));
  if (!snap.exists()) return null;
  const data = snap.data() as ProfileDoc;
  const athlete = await readAthleteProfile(uid, data.athlete);
  return {
    uid,
    email: data.email,
    authProviderName: data.authProviderName,
    displayName: data.displayName,
    username: data.username ?? null,
    // Aus dem SPIEGEL gelesen — er kann dem Claim nachhinken. Der
    // Auth-Context überschreibt das Feld direkt danach mit dem Wert aus dem
    // ID-Token; hier steht der beste Wert, den ein reiner Dokument-Leser hat.
    rights: readRoleSet(data as Record<string, unknown>),
    gymId: data.gymId ?? null,
    gymJoinedAt: data.gymJoinedAt?.toDate() ?? null,
    settings: { ...DEFAULT_USER_SETTINGS, ...(data.settings ?? {}) },
    onboarded: data.onboarded === true,
    trainerOnboarded: data.trainerOnboarded === true,
    createdAt: data.createdAt?.toDate(),
    athlete,
    profileSharedWith: data.profileSharedWith ?? [],
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
    const athlete = await readAthleteProfile(user.uid, data.athlete);
    return {
      uid: user.uid,
      email: data.email,
      authProviderName: user.displayName ?? data.authProviderName,
      displayName: data.displayName,
      username: data.username ?? null,
      rights: readRoleSet(data as Record<string, unknown>),
      gymId: data.gymId ?? null,
      gymJoinedAt: data.gymJoinedAt?.toDate() ?? null,
      settings: { ...DEFAULT_USER_SETTINGS, ...(data.settings ?? {}) },
      onboarded: data.onboarded === true,
      trainerOnboarded: data.trainerOnboarded === true,
      createdAt: data.createdAt?.toDate(),
      athlete,
      profileSharedWith: data.profileSharedWith ?? [],
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
    // Frisch angelegt heisst: noch kein Recht. Die Regeln verbieten dem
    // Client ohnehin, eines der vier Felder selbst zu setzen.
    rights: NO_RIGHTS,
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
  const ref = athleteProfileRef(uid);
  const snap = await getDoc(ref);
  // Bestand: neue Ablage, sonst das alte Feld am users-Dokument (Übergang).
  let current: AthleteDoc = {};
  if (snap.exists()) {
    current = snap.data() as AthleteDoc;
  } else {
    const alt = await getDoc(profileRef(uid));
    current = (alt.exists() ? (alt.data() as ProfileDoc).athlete : undefined) ?? {};
  }

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

  await setDoc(ref, next, { merge: true });
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
