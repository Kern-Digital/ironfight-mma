/**
 * Gym-Zugehörigkeit — Mandanten-Trennung (Multi-Gym, Phase 1).
 *
 * Autoritativ ist der `gymId`-Custom-Claim (Auth-Token, nur Admin-SDK
 * schreibbar); `auth-context.tsx` spiegelt ihn ins Profil. Fehlender Claim =
 * Default-Gym (Bestand + Signups ohne Einladung — Phase 2 setzt Claims via
 * Invite). Die Firestore-Regeln erzwingen die Trennung serverseitig; die
 * Helfer hier sind nur die Client-Seite derselben Logik.
 *
 * Datensätze OHNE `gymId`-Feld gelten als Default-Gym — nach der Migration
 * (scripts/migrate-multi-gym.mjs) existieren solche Altbestände nicht mehr;
 * der Fallback bleibt als Sicherheitsnetz.
 */

import type { UserProfile } from "./types";

/** Gym des Bestands („Tidal Athletics") und Fallback für fehlende Claims. */
export const DEFAULT_GYM_ID = "tidal-athletics";

export const DEFAULT_GYM_LABEL = "Tidal Athletics";

/**
 * Normalisiert einen frei eingegebenen Gym-Namen zu einem stabilen Slug
 * (für das Anlegen neuer Gyms in der Admin-Konsole).
 */
export function slugifyGym(name: string): string {
  // NFKD zerlegt Akzent-Zeichen in Basis + Markierung; der [^a-z0-9]-Filter
  // entfernt die Markierungen anschließend ohnehin.
  return (
    name
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || DEFAULT_GYM_ID
  );
}

/**
 * Liefert die Gym-ID eines Nutzers. `profile.gymId` wird in auth-context aus
 * dem Token-Claim gespeist; ohne Claim gilt das Default-Gym.
 */
export function resolveGymId(profile: UserProfile | null | undefined): string {
  return profile?.gymId?.trim() || DEFAULT_GYM_ID;
}

/**
 * Sichtbarkeits-Check: Gehört ein Datensatz (mit `gymId`) zum Gym des
 * Betrachters? STRIKT (seit Phase 1): fremde Gyms sind nie sichtbar;
 * Datensätze ohne `gymId` zählen als Default-Gym (Altbestand-Sicherheitsnetz).
 */
export function belongsToGym(
  recordGymId: string | null | undefined,
  viewerGymId: string,
): boolean {
  return (recordGymId || DEFAULT_GYM_ID) === viewerGymId;
}
