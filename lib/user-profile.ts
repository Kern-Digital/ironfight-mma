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
  type UserProfile,
  type UserSettings,
} from "./types";

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
  settings: UserSettings;
  onboarded: boolean;
  createdAt?: Timestamp;
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
    settings: { ...DEFAULT_USER_SETTINGS, ...(data.settings ?? {}) },
    onboarded: data.onboarded === true,
    createdAt: data.createdAt?.toDate(),
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
      settings: { ...DEFAULT_USER_SETTINGS, ...(data.settings ?? {}) },
      onboarded: data.onboarded === true,
      createdAt: data.createdAt?.toDate(),
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
  await updateDoc(profileRef(uid), {
    displayName: trimmed,
    onboarded: true,
  });
}

/** Markiert den Onboarding-Flow als abgeschlossen, ohne Namen zu setzen. */
export async function markOnboarded(uid: string) {
  await updateDoc(profileRef(uid), { onboarded: true });
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
  await updateDoc(ref, { settings: { ...current, ...patch } });
}

/**
 * Vorbereitung für Community-Funktionen:
 * Reserviert einen eindeutigen Username. Aktuell nur ein Platzhalter.
 * Wenn später Leaderboards/Chat dazukommen, wird hier eine Uniqueness-Prüfung ergänzt.
 */
export async function reserveUsername(uid: string, username: string) {
  // TODO: Uniqueness via separate `usernames`-Collection (Transaction)
  await updateDoc(profileRef(uid), {
    username: username.trim().toLowerCase(),
  });
}
