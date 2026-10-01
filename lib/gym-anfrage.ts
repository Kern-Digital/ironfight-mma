/**
 * „PROBETRAINING VEREINBAREN" — die Anfrage eines Athleten an ein Gym aus
 * der Gym-Suche (Etappe 4, 01.10.2026).
 *
 * Leon am 30.09.2026 auf die Frage, wie jemand ohne Gym beitritt: KEIN
 * Direktbeitritt, sondern Kontaktdaten des Gyms und ein Knopf
 * „Probetraining vereinbaren / Anfrage stellen zum Gespräch". Mitglied wird
 * man weiter über die Einladung, die das Gym danach schickt.
 *
 * WO SIE LIEGT: `gyms/{gymId}/anfragen/{uid}` — die Dokument-ID IST das
 * Konto. Damit gibt es je Konto und Gym höchstens EINE offene Anfrage, ohne
 * Abfrage und ohne Wettlauf. „Erledigt" löscht das Dokument; danach kann
 * dieselbe Person wieder anfragen.
 *
 * WER SIE ANFASST: nur der Server (Admin-SDK). Für `anfragen` steht in den
 * Regeln nichts — also darf im Browser niemand lesen oder schreiben. Der
 * Athlet schreibt über POST /api/gyms/anfrage, die Verwaltung liest über
 * POST /api/gym/anfragen und erledigt über POST /api/gym/anfragen/erledigt.
 *
 * LÖSCHFRIST: 90 Tage nach Eingang, egal ob beantwortet. Der Nacht-Job
 * (/api/cron/wochenplan) räumt auf; abgelaufene Anfragen zählen schon vorher
 * nirgends mehr mit. KEIN Mailweg in der App: Das Gym schreibt aus seinem
 * eigenen Postfach.
 *
 * Client UND Server lesen diese Datei.
 */

import type { User } from "firebase/auth";

export const ANFRAGE_NAME_MIN = 2;
export const ANFRAGE_NAME_MAX = 60;
export const ANFRAGE_NACHRICHT_MAX = 600;
/** Tage, nach denen eine Anfrage von selbst gelöscht wird. */
export const ANFRAGE_TAGE = 90;
/** So viele offene Anfragen darf ein Konto gleichzeitig haben. */
export const ANFRAGE_MAX_OFFEN = 5;

/** Was die Verwaltung von einer Anfrage sieht. Daten als ISO-Text. */
export interface GymAnfrage {
  uid: string;
  name: string;
  email: string;
  nachricht: string;
  erstelltAm: string | null;
  loeschenAm: string | null;
}

/** Was der Athlet von seinen eigenen Anfragen sieht. */
export interface MeineAnfrage {
  gymId: string;
  /** Eingang als ISO-Text. */
  am: string | null;
}

async function ruf<T>(user: User, pfad: string, body?: unknown): Promise<T> {
  const res = await fetch(pfad, {
    method: "POST",
    headers: {
      authorization: `Bearer ${await user.getIdToken()}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const daten = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(daten.error ?? "Das hat gerade nicht geklappt. Versuch es gleich noch einmal.");
  return daten;
}

/** Athlet → Gym. Wirft mit dem Satz des Servers, wenn es nicht geht. */
export async function sendeAnfrage(
  user: User,
  eingabe: { gymId: string; name: string; nachricht: string },
): Promise<MeineAnfrage> {
  return (await ruf<{ anfrage: MeineAnfrage }>(user, "/api/gyms/anfrage", eingabe)).anfrage;
}

/** Verwaltung: die offenen Anfragen des eigenen Gyms, neueste zuerst. */
export async function ladeAnfragen(user: User): Promise<GymAnfrage[]> {
  return (await ruf<{ anfragen: GymAnfrage[] }>(user, "/api/gym/anfragen")).anfragen ?? [];
}

/** Verwaltung: Anfrage erledigt — das Dokument wird gelöscht. */
export async function erledigeAnfrage(user: User, uid: string): Promise<void> {
  await ruf<{ ok: true }>(user, "/api/gym/anfragen/erledigt", { uid });
}

const TAG_FMT = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

/** ISO-Text → „01.10.2026". */
export function anfrageTag(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : TAG_FMT.format(d);
}
