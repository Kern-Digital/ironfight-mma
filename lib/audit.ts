/**
 * Neuigkeiten & Protokoll (Multi-Gym Phase 2, Checkpoint 2) — die Leseseite
 * von `gyms/{gymId}/auditLog`.
 *
 * WARUM ES KEINE ZWEITE SAMMLUNG GIBT: Leons Wunsch war ein Bereich, in dem
 * „X ist beigetreten" auftaucht. Genau dieser Vorgang steht schon im
 * Protokoll — `/api/invites/redeem` schreibt ihn seit Checkpoint 1A. Ein
 * zweiter Schreibpfad auf denselben Vorgang würde auseinanderdriften, sobald
 * einer von beiden fehlschlägt; die Oberfläche filtert stattdessen
 * (`NEWS_TYPES`) und formuliert (`auditHeadline`).
 *
 * RECHTE: Lesen darf nur die Verwaltung (firestore.rules,
 * `canManageGymId(gymId)`) — die Einträge führen die Einladungscodes im
 * Klartext, und wer die sieht, kann einladen. Geschrieben wird
 * ausschließlich serverseitig (`write: if false`); ein Protokoll, das der
 * Betroffene ändern kann, ist keines.
 */

import {
  collection,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { getFirestoreDb } from "./firebase";
import { formatInviteCode, INVITE_ROLE_LABEL } from "./invites";
import type { IconName } from "@/components/ui/Icon";

export type AuditType =
  | "invite.create"
  | "invite.revoke"
  | "invite.redeem"
  | "invite.note"
  | "member.role"
  | "member.remove";

export interface AuditEntry {
  id: string;
  type: AuditType;
  /** Wer gehandelt hat. */
  actorUid: string;
  actorName: string;
  /** Wen es betraf (beim Beitritt dieselbe Person wie der Handelnde). */
  targetUid: string;
  /** Name des Betroffenen, wie er DAMALS war (denormalisiert beim Schreiben). */
  targetName: string;
  code: string;
  details: Record<string, string | number | boolean | null>;
  at: Date | null;
}

/**
 * Was in den „Neuigkeiten" steht: Vorgänge, die Menschen betreffen.
 * Alles Übrige (Einladung erstellt, zurückgezogen, Notiz geändert) ist
 * Verwaltungsbuchhaltung und erscheint erst unter „Alle Vorgänge".
 */
export const NEWS_TYPES: AuditType[] = [
  "invite.redeem",
  "member.role",
  "member.remove",
];

export function isNewsEntry(entry: AuditEntry): boolean {
  return NEWS_TYPES.includes(entry.type);
}

interface AuditDoc {
  type?: string;
  actorUid?: string;
  actorName?: string;
  targetUid?: string;
  targetName?: string;
  code?: string;
  details?: Record<string, string | number | boolean | null>;
  at?: Timestamp | null;
}

const KNOWN_TYPES = new Set<string>([
  "invite.create",
  "invite.revoke",
  "invite.redeem",
  "invite.note",
  "member.role",
  "member.remove",
]);

function decodeEntry(id: string, data: AuditDoc): AuditEntry {
  return {
    id,
    // Unbekannte Typen (aus einer neueren Fassung der App) landen als
    // "member.role" NICHT im Text — sie bekommen unten einen neutralen Satz.
    type: (KNOWN_TYPES.has(data.type ?? "")
      ? data.type
      : "invite.note") as AuditType,
    actorUid: data.actorUid ?? "",
    actorName: data.actorName?.trim() || "Jemand",
    targetUid: data.targetUid ?? "",
    targetName: data.targetName?.trim() || "",
    code: data.code ?? "",
    details: data.details ?? {},
    at: data.at?.toDate() ?? null,
  };
}

/**
 * Die letzten Einträge eines Gyms, neueste zuerst.
 *
 * Bewusst eine einfache Obergrenze statt Blättern: Der Bereich beantwortet
 * „was ist zuletzt passiert", nicht „durchsuche das ganze Jahr". Sortiert
 * wird nach `at` — ein einzelnes Feld, dafür legt Firestore den Index
 * automatisch an (kein Eintrag in firestore.indexes.json nötig).
 *
 * GEFILTERT WIRD IM CLIENT (`NEWS_TYPES`), nicht in der Abfrage: Ein
 * `where("type","in",…)` zusammen mit `orderBy("at")` bräuchte einen
 * zusammengesetzten Index. Der Preis: Ein Gym, das zwischen zwei Besuchen
 * mehr als `max` Vorgänge erzeugt — fast nur Einladungen —, sieht die
 * ältesten Neuigkeiten nicht mehr. Bei Gym-Größen im dreistelligen Bereich
 * ist das keine reale Grenze; wird sie es, ist der Index die Antwort.
 */
export async function listGymAuditLog(
  gymId: string,
  max = 150,
): Promise<AuditEntry[]> {
  const db = getFirestoreDb();
  const snap = await getDocs(
    query(
      collection(db, "gyms", gymId, "auditLog"),
      orderBy("at", "desc"),
      fbLimit(max),
    ),
  );
  return snap.docs.map((d) => decodeEntry(d.id, d.data() as AuditDoc));
}

// ─── Formulierung ──────────────────────────────────────────────────────────

function boolOf(v: unknown): boolean {
  return v === true;
}

/** Rechte-Kurzform aus den Protokoll-Details („Trainer · Verwaltung"). */
function rightsText(trainer: boolean, verwaltung: boolean): string {
  const parts: string[] = [];
  if (trainer) parts.push("Trainer");
  if (verwaltung) parts.push("Verwaltung");
  return parts.length ? parts.join(" · ") : "Athlet";
}

/**
 * Der Satz, der in der Liste steht — in ganzer Sprache, nicht als
 * Ereignis-Code. Er beschreibt, was passiert ist, nicht welcher Datensatz
 * geschrieben wurde.
 */
export function auditHeadline(entry: AuditEntry): string {
  const who = entry.targetName || entry.actorName;
  switch (entry.type) {
    case "invite.redeem":
      return `${who} ist deinem Gym beigetreten.`;
    case "member.remove":
      return `${entry.actorName} hat ${who} aus dem Gym entfernt.`;
    case "member.role": {
      const trainer = boolOf(entry.details.trainer);
      const verwaltung = boolOf(entry.details.verwaltung);
      const trainerBefore = boolOf(entry.details.trainerBefore);
      const verwaltungBefore = boolOf(entry.details.verwaltungBefore);
      const trainerChanged = trainer !== trainerBefore;
      const verwaltungChanged = verwaltung !== verwaltungBefore;
      // Zwei Änderungen auf einmal bekommen bewusst KEINEN verschachtelten
      // Satz: „hat ihn zum Trainer gemacht und ihr das Recht gegeben" zwingt
      // zu einem Geschlecht, das die App nicht kennt.
      if (trainerChanged && verwaltungChanged) {
        return `${entry.actorName} hat die Rechte von ${who} geändert.`;
      }
      if (trainerChanged) {
        return trainer
          ? `${entry.actorName} hat ${who} zum Trainer gemacht.`
          : `${entry.actorName} hat ${who} das Trainer-Recht abgenommen.`;
      }
      if (verwaltungChanged) {
        return verwaltung
          ? `${entry.actorName} hat ${who} in die Verwaltung geholt.`
          : `${entry.actorName} hat ${who} das Verwaltungsrecht abgenommen.`;
      }
      return `${entry.actorName} hat die Rechte von ${who} bestätigt.`;
    }
    case "invite.create":
      return `${entry.actorName} hat eine Einladung erstellt.`;
    case "invite.revoke":
      return `${entry.actorName} hat eine Einladung zurückgezogen.`;
    case "invite.note":
    default:
      return `${entry.actorName} hat die Notiz einer Einladung geändert.`;
  }
}

/** Zweite Zeile: der Sachverhalt, der den Satz belegt. Leer = keine Zeile. */
export function auditDetail(entry: AuditEntry): string {
  const code = entry.code ? `Code ${formatInviteCode(entry.code)}` : "";
  switch (entry.type) {
    case "invite.redeem": {
      const role = entry.details.role === "trainer" ? "trainer" : "user";
      return `Eingeladen als ${INVITE_ROLE_LABEL[role]}${code ? ` · ${code}` : ""}`;
    }
    case "member.role":
      return `Jetzt: ${rightsText(
        boolOf(entry.details.trainer),
        boolOf(entry.details.verwaltung),
      )}`;
    case "member.remove": {
      const shares = Number(entry.details.revokedShares) || 0;
      const was = rightsText(
        boolOf(entry.details.trainerBefore),
        boolOf(entry.details.verwaltungBefore),
      );
      // Das Konto bleibt bestehen — genau das soll hier nachlesbar sein.
      return shares > 0
        ? `War ${was} · ${shares} ${shares === 1 ? "Freigabe" : "Freigaben"} zurückgenommen · Konto bleibt bestehen`
        : `War ${was} · Konto bleibt bestehen`;
    }
    case "invite.create": {
      const role = entry.details.role === "trainer" ? "trainer" : "user";
      const uses = Number(entry.details.maxUses) || 1;
      const forWhom =
        uses === 1 ? "für eine Person" : `für bis zu ${uses} Personen`;
      return `${INVITE_ROLE_LABEL[role]} · ${forWhom}${code ? ` · ${code}` : ""}`;
    }
    default:
      return code;
  }
}

/** Symbol der Zeile — aus der Icon-Registry, nie ein Emoji. */
export function auditIcon(entry: AuditEntry): IconName {
  switch (entry.type) {
    case "invite.redeem":
      return "users";
    case "member.role":
      return "shield";
    case "member.remove":
      return "minus";
    case "invite.create":
      return "plus";
    case "invite.revoke":
      return "x";
    default:
      return "edit";
  }
}

/**
 * Tag-Überschrift einer Gruppe. „Heute"/„Gestern" statt Datum, weil genau
 * das die Frage ist, mit der jemand diesen Bereich öffnet.
 */
export function dayLabel(d: Date | null, now: Date = new Date()): string {
  if (!d) return "Ohne Datum";
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (days <= 0) return "Heute";
  if (days === 1) return "Gestern";
  return d.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

/** Uhrzeit für die Zeile („14:32"). */
export function timeLabel(d: Date | null): string {
  return d
    ? d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
    : "";
}

// ─── „Seit deinem letzten Besuch" ──────────────────────────────────────────

/**
 * Der Zeitpunkt des letzten Besuchs liegt im localStorage — pro Gerät und
 * pro Gym. Bewusst NICHT in Firestore: Es ist eine Bequemlichkeit, kein
 * Datum, das jemand später nachweisen können muss, und ein Schreibvorgang
 * pro Seitenaufruf wäre dafür zu teuer.
 */
export function newsSeenKey(gymId: string): string {
  return `ta-news-seen:${gymId}`;
}

export function readNewsSeen(gymId: string): number {
  try {
    const raw = window.localStorage.getItem(newsSeenKey(gymId));
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function writeNewsSeen(gymId: string, at: number = Date.now()): void {
  try {
    window.localStorage.setItem(newsSeenKey(gymId), String(at));
  } catch {
    /* Privater Modus o. ä. — dann gibt es eben keine Markierung. */
  }
}
