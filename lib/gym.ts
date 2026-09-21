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
 * DAS GYM, DAS ES NICHT GIBT — für Konten, die zu keinem gehören (Leon
 * 21.09.2026: „ein admin konto soll kein gym angehören").
 *
 * Warum ein Kürzel und nicht `null`: `resolveGymId` und `userGymId` werden an
 * über siebzig Stellen gelesen, fast immer als Filter einer Abfrage
 * (`where("gymId","==", …)`). Ein `null` hätte jede dieser Stellen zu einer
 * Fallunterscheidung gemacht; ein Kürzel, das auf KEIN Gym passt, beantwortet
 * dieselbe Frage von selbst — der Admin sieht überall nichts, weil er
 * nirgends Mitglied ist. Die eckigen Klammern sind in einer Gym-ID
 * ausgeschlossen (`slugifyGym` lässt nur a–z, 0–9 und Bindestriche durch),
 * die Verwechslung mit einem echten Gym also auch.
 *
 * Dieselbe Zeichenkette steht in `firestore.rules` (`userGymId()`).
 */
export const KEIN_GYM = "__kein-gym__";

/** Was in der Hülle steht, wo sonst der Gym-Name stünde. */
export const KEIN_GYM_LABEL = "Plattform";

/**
 * Analysen, die jedes neue Gym beim Anlegen geschenkt bekommt (Beschluss
 * 20.09.2026, Plan „Das zweite Gym": drei, einmalig, vollständig, ohne
 * Ablauf). Liegt als Posten in `gyms/{gymId}/guthaben` — siehe
 * lib/guthaben.ts; ein Verfallsdatum je Kauf braucht ein eigenes Dokument.
 */
export const FREIE_ANALYSEN = 3;

/**
 * Der Satz, den ein stillgelegtes Gym auf jeder Seite und aus jeder Route
 * bekommt. EINE Stelle für Client und Server — lib/server/gym-status.ts und
 * der Streifen in der Hülle lesen beide hier.
 *
 * AM 21.09.2026 NEU GESCHRIEBEN: Der alte Satz („Ihr könnt nichts ändern und
 * keine Analysen starten") stimmte nicht mehr. Stilllegen trifft seither nur
 * DeepFight — Kursplan, Mitglieder, Einladungen und Pläne laufen weiter
 * (Leon: die kostenlose Version bleibt frei verfügbar).
 */
export const GYM_GESPERRT_TEXT =
  "Dein Gym ist stillgelegt. Kursplan, Mitglieder und Pläne laufen weiter — neue DeepFight-Analysen gehen erst wieder, wenn ihr euch bei Tidal Athletics meldet.";

/**
 * Derselbe Fall, aber das Gym hat noch GEKAUFTE Analysen übrig (Leon
 * 21.09.2026: „Sie dürfen sie aufbrauchen"). Dann ist DeepFight NICHT zu —
 * der Streifen sagt, wie viel noch geht.
 */
export const GYM_GESPERRT_MIT_GUTHABEN = (rest: number): string =>
  `Dein Gym ist stillgelegt. Eure gekauften Analysen könnt ihr aufbrauchen — ${rest === 1 ? "noch eine" : `noch ${rest}`}. Danach geht DeepFight erst wieder, wenn ihr euch bei Tidal Athletics meldet.`;

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
 *
 * MIT EINER AUSNAHME (21.09.2026): Ein Konto mit Plattform-Rang und ohne
 * gymId-Claim gehört zu KEINEM Gym — es bekommt `KEIN_GYM`, nicht das
 * Default-Gym. Ohne diese Zeile wäre ein Admin nach dem Umbau stillschweigend
 * wieder Mitglied von Tidal Athletics (Falle 44: „kein Claim" ist nicht
 * „kein Gym"). Ein Admin MIT gymId-Claim behält sein Gym — den Fall soll es
 * nach der Wanderung nicht mehr geben, aber die Funktion soll ihn nicht
 * verschlucken.
 */
export function resolveGymId(profile: UserProfile | null | undefined): string {
  const claim = profile?.gymId?.trim();
  if (claim) return claim;
  return profile?.rights?.admin ? KEIN_GYM : DEFAULT_GYM_ID;
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
export interface GymInfo {
  name: string;
  status: Gym["status"];
}

/**
 * Seit dem 21.09.2026 trägt der Cache auch den ZUSTAND (aktiv/stillgelegt),
 * weil der Streifen in der Hülle ihn braucht — und er verfällt nach fünf
 * Minuten statt nie: Ein Gym, das Leon stilllegt, soll den Streifen beim
 * nächsten Seitenwechsel sehen, nicht erst nach dem nächsten Neuladen. Der
 * Name bleibt dabei so billig wie vorher: ein Lesevorgang je fünf Minuten.
 */
const GYM_INFO_TTL_MS = 5 * 60_000;
const gymInfoCache = new Map<string, { info: GymInfo; bis: number }>();

export async function getGymInfo(gymId: string): Promise<GymInfo> {
  const cached = gymInfoCache.get(gymId);
  if (cached && cached.bis > Date.now()) return cached.info;
  // Wer zu keinem Gym gehört, bekommt kein Gym-Dokument gesucht — das wäre
  // ein Lesevorgang auf eine Adresse, die es nie geben wird.
  if (gymId === KEIN_GYM) return { name: KEIN_GYM_LABEL, status: null };
  const fallback = gymId === DEFAULT_GYM_ID ? DEFAULT_GYM_LABEL : gymId;
  try {
    const { doc, getDoc } = await import("firebase/firestore");
    const { getFirestoreDb } = await import("./firebase");
    const snap = await getDoc(doc(getFirestoreDb(), "gyms", gymId));
    const data = snap.exists() ? (snap.data() as Record<string, unknown>) : {};
    const info: GymInfo = {
      name: (data.name as string | undefined)?.trim() || fallback,
      status: (data.status as Gym["status"]) ?? null,
    };
    gymInfoCache.set(gymId, { info, bis: Date.now() + GYM_INFO_TTL_MS });
    return info;
  } catch {
    return { name: fallback, status: null };
  }
}

export async function getGymName(gymId: string): Promise<string> {
  return (await getGymInfo(gymId)).name;
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
