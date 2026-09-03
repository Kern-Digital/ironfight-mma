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

// ─── Gym-Stammdaten ────────────────────────────────────────────────────────

/**
 * Abo-Zustand eines Gyms (Selbstbedienungs-Registrierung, Roadmap Phase 4).
 *
 * BEWUSST JETZT SCHON GESCHNITTEN, obwohl noch nichts davon gefüllt wird:
 * Das Feld später nachzurüsten hieße, jedes bestehende Gym-Dokument zu
 * migrieren. Als leeres Feld kostet es nichts.
 *
 * Geschrieben wird es AUSSCHLIESSLICH serverseitig (Stripe-Webhook per
 * Admin-SDK) — die Regeln für gyms/{gymId} erlauben Client-Schreibzugriff
 * ohnehin nur Admins.
 *
 * Der Status gehört später zusätzlich in die Custom Claims: Eine Regel, die
 * bei jeder Auswertung das Gym-Dokument nachschlägt, kostet einen
 * Lesevorgang und Latenz pro Zugriff — ein Claim kostet nichts.
 */
export interface GymSubscription {
  status: "trial" | "active" | "pastDue" | "canceled";
  /** Tarif-Kennung, z. B. "basis" | "branding". */
  plan: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: Date | null;
  /** Enthaltene KI-Analysen pro Abrechnungszeitraum (Konzept §6). */
  analysisQuota?: number;
  /** Im laufenden Zeitraum verbraucht — Prüfung erfolgt serverseitig. */
  analysisUsed?: number;
}

export interface Gym {
  id: string;
  name: string;
  /**
   * Betriebszustand (Konzept §2: „Status (aktiv/gesperrt)"). Gesetzt beim
   * Anlegen (`scripts/migrate-multi-gym.mjs`), geschrieben ausschließlich
   * serverseitig. Fehlt das Feld, gilt das Gym als aktiv — ein Gym wegen
   * eines fehlenden Feldes als gesperrt anzuzeigen wäre die teurere
   * Falschaussage.
   */
  status?: "active" | "blocked" | null;
  /** Branding-Tokens (Konzept §8) — leer = kompletter Tidal-Look. */
  branding?: Record<string, string> | null;
  subscription?: GymSubscription | null;
  createdAt?: Date | null;
}

/**
 * ALLE Gyms der Plattform — für die Plattform-Übersicht `/admin`.
 *
 * NUR DER PLATTFORM-RANG DARF DAS, und zwar nachgemessen: Ein Prüfkonto mit
 * ausschließlich `admin: true` bekam per Firestore-REST auf
 * `LIST gyms/` eine 200, dasselbe Konto mit ausschließlich `trainer: true`
 * eine 403 (02.09.2026). Die Regel dahinter ist
 * `allow read: isAdmin() || userGymId() == gymId` — der Admin-Zweig fragt
 * kein `resource` ab und ist deshalb auch für eine LISTE beweisbar, der
 * Gym-Zweig nicht. Ein Trainer, der diese Funktion aufruft, bekommt einen
 * Fehler; das ist die richtige Antwort und kein Bug.
 *
 * KEIN CACHE (anders als `getGymName`): Diese Liste steht auf genau einer
 * Seite, und wer sie öffnet, will den aktuellen Stand sehen.
 */
export async function listGyms(): Promise<Gym[]> {
  const { collection, getDocs } = await import("firebase/firestore");
  const { getFirestoreDb } = await import("./firebase");
  const snap = await getDocs(collection(getFirestoreDb(), "gyms"));
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      name: (data.name as string | undefined)?.trim() || d.id,
      status: (data.status as Gym["status"]) ?? null,
      branding: (data.branding as Gym["branding"]) ?? null,
      subscription: (data.subscription as Gym["subscription"]) ?? null,
      createdAt:
        (data.createdAt as { toDate?: () => Date } | undefined)?.toDate?.() ??
        null,
    } satisfies Gym;
  });
}

/**
 * Der ANZEIGENAME eines Gyms — für die Gym-Zeile der Sidebar-Hülle.
 *
 * WARUM MIT CACHE: Die Hülle steht auf JEDER Seite. Ohne Zwischenspeicher
 * kostete jeder Seitenwechsel einen Firestore-Lesevorgang für einen Namen,
 * der sich praktisch nie ändert. Der Cache lebt im Modul und damit genau so
 * lange wie der Tab — ein umbenanntes Gym erscheint nach dem nächsten
 * Neuladen, und das ist bei einem Namen die richtige Abwägung.
 *
 * FEHLER SIND KEIN FEHLER: Kann das Dokument nicht gelesen werden (Regeln,
 * Netz, Gym-Dokument fehlt), kommt der Slug zurück. Eine Hülle, die wegen
 * eines Namens leer bleibt, wäre schlimmer als ein technischer Name.
 */
const gymNameCache = new Map<string, string>();

export async function getGymName(gymId: string): Promise<string> {
  const cached = gymNameCache.get(gymId);
  if (cached) return cached;
  const fallback = gymId === DEFAULT_GYM_ID ? DEFAULT_GYM_LABEL : gymId;
  try {
    const { doc, getDoc } = await import("firebase/firestore");
    const { getFirestoreDb } = await import("./firebase");
    const snap = await getDoc(doc(getFirestoreDb(), "gyms", gymId));
    const name = snap.exists() ? (snap.data().name as string | undefined) : undefined;
    const value = name?.trim() || fallback;
    gymNameCache.set(gymId, value);
    return value;
  } catch {
    return fallback;
  }
}

/**
 * Zeichen für die Gym-Marke (32×32-Feld der Sidebar): ein bis zwei
 * Anfangsbuchstaben. „Tidal Athletics" → „TA", „Ironfight" → „IR".
 */
export function gymInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "TA";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
