/**
 * Einladungen — der Beitritts-Mechanismus des Multi-Gym-Ausbaus
 * (Phase 2, Konzept §5; docs/MULTI-GYM-KONZEPT.md).
 *
 * WARUM ES DAS GIBT: Beim Signup verbieten die Firestore-Regeln bewusst,
 * `gymId` selbst zu setzen — sonst könnte sich jeder in jedes Gym schreiben.
 * Ohne Einladung fehlt neuen Nutzern deshalb die Gym-Zuordnung, und sie sind
 * für Trainer unsichtbar (Backlog-Punkt „Neue Signups"). Das Einlösen einer
 * Einladung setzt den `gymId`-Claim SERVERSEITIG und schließt genau das.
 *
 * SICHERHEITSMODELL (wichtig):
 *   • Einladungs-Dokumente sind in den Regeln `write: if false` — erzeugt,
 *     zurückgezogen und eingelöst wird ausschließlich über die Server-Routen
 *     unter /api/invites (Admin-SDK). Könnte ein Trainer selbst schreiben,
 *     könnte er sich eine Einladung mit role="admin" ausstellen und einlösen.
 *   • Gelesen werden sie nur von Trainern/Admins des eigenen Gyms.
 *   • Der Code IST die Dokument-ID (stabiler Deep-Link ohne Suche); das Feld
 *     `code` existiert zusätzlich, weil das Einlösen den Code kennt, aber
 *     nicht das Gym — es sucht per collectionGroup über alle Gyms
 *     (Index: firestore.indexes.json, COLLECTION_GROUP auf `code`).
 *
 * Der Status wird BERECHNET, nicht gespeichert: „abgelaufen" ist eine Frage
 * der aktuellen Uhrzeit, und ein gespeicherter Status müsste von einem
 * Hintergrundjob nachgezogen werden, den es nicht gibt.
 */

import {
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { getFirestoreDb } from "./firebase";

/**
 * Vorbelegte Rolle einer Einladung. `admin` ist bewusst NICHT möglich —
 * Plattform-Rechte werden nie über einen Link vergeben.
 */
export type InviteRole = "user" | "trainer";

export interface InviteUse {
  uid: string;
  at: Date | null;
}

export interface GymInvite {
  /** Zugleich die Dokument-ID. */
  code: string;
  gymId: string;
  role: InviteRole;
  createdBy: string;
  /**
   * Name des Erstellers, denormalisiert — gleiches Muster wie
   * trainerPlans.createdByName: fremde users-Dokumente sind für viele
   * Betrachter per Regeln nicht lesbar, die uid wäre also nicht auflösbar.
   */
  createdByName: string;
  createdAt: Date | null;
  expiresAt: Date | null;
  /** Wie oft der Code eingelöst werden darf (1 = persönliche Einladung). */
  maxUses: number;
  usedCount: number;
  usedBy: InviteUse[];
  revokedAt: Date | null;
  /** Freitext für die Übersicht, z. B. „Anfängerkurs September". */
  note: string;
}

export type InviteStatus = "open" | "usedUp" | "expired" | "revoked";

export const INVITE_STATUS_LABEL: Record<InviteStatus, string> = {
  open: "Offen",
  usedUp: "Aufgebraucht",
  expired: "Abgelaufen",
  revoked: "Zurückgezogen",
};

export const INVITE_ROLE_LABEL: Record<InviteRole, string> = {
  user: "Athlet",
  trainer: "Trainer",
};

/** Standard-Gültigkeit einer neuen Einladung. */
export const INVITE_DEFAULT_DAYS = 14;
export const INVITE_MAX_DAYS = 90;
export const INVITE_MAX_USES = 200;

/**
 * Verwechslungsfreies Alphabet: ohne 0/O und 1/I/L — ein am Telefon
 * durchgegebener oder abgetippter Code darf nicht an der Schriftart scheitern.
 * 32 Zeichen ^ 8 Stellen ≈ 1,1 Billionen Möglichkeiten.
 */
export const INVITE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 8;

/** Normalisiert eine Nutzereingabe (Kleinschreibung, Leerzeichen, Bindestriche). */
export function normalizeInviteCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Grobprüfung vor dem Server-Aufruf — spart einen Roundtrip bei Tippfehlern. */
export function isPlausibleInviteCode(raw: string): boolean {
  const code = normalizeInviteCode(raw);
  if (code.length !== INVITE_CODE_LENGTH) return false;
  return code.split("").every((c) => INVITE_CODE_ALPHABET.includes(c));
}

/** Anzeigeform mit Trenner: ABCD-2345 liest und diktiert sich leichter. */
export function formatInviteCode(code: string): string {
  const c = normalizeInviteCode(code);
  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

/** Der berechnete Status. Reihenfolge = Vorrang der Gründe. */
export function inviteStatus(
  invite: Pick<GymInvite, "revokedAt" | "expiresAt" | "usedCount" | "maxUses">,
  now: Date = new Date(),
): InviteStatus {
  if (invite.revokedAt) return "revoked";
  if (invite.usedCount >= invite.maxUses) return "usedUp";
  if (invite.expiresAt && invite.expiresAt.getTime() <= now.getTime()) {
    return "expired";
  }
  return "open";
}

export function isInviteUsable(invite: GymInvite, now: Date = new Date()): boolean {
  return inviteStatus(invite, now) === "open";
}

/** Der Link, der geteilt wird. */
export function inviteJoinPath(code: string): string {
  return `/beitreten/${normalizeInviteCode(code)}`;
}

export function inviteJoinUrl(code: string, origin?: string): string {
  const base =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}${inviteJoinPath(code)}`;
}

// ─── Lesen (Client) ────────────────────────────────────────────────────────

interface InviteDoc {
  code?: string;
  gymId?: string;
  role?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt?: Timestamp | null;
  expiresAt?: Timestamp | null;
  maxUses?: number;
  usedCount?: number;
  usedBy?: { uid?: string; at?: Timestamp | null }[];
  revokedAt?: Timestamp | null;
  note?: string;
}

function decodeInvite(id: string, data: InviteDoc): GymInvite {
  return {
    code: data.code ?? id,
    gymId: data.gymId ?? "",
    role: data.role === "trainer" ? "trainer" : "user",
    createdBy: data.createdBy ?? "",
    createdByName: data.createdByName ?? "",
    createdAt: data.createdAt?.toDate() ?? null,
    expiresAt: data.expiresAt?.toDate() ?? null,
    maxUses: typeof data.maxUses === "number" ? data.maxUses : 1,
    usedCount: typeof data.usedCount === "number" ? data.usedCount : 0,
    usedBy: (data.usedBy ?? []).map((u) => ({
      uid: u.uid ?? "",
      at: u.at?.toDate() ?? null,
    })),
    revokedAt: data.revokedAt?.toDate() ?? null,
    note: data.note ?? "",
  };
}

/**
 * Alle Einladungen eines Gyms, neueste zuerst. Nur Trainer/Admin des Gyms
 * dürfen das lesen (Firestore-Regel) — für Athleten wirft der Aufruf.
 */
export async function listGymInvites(gymId: string): Promise<GymInvite[]> {
  const db = getFirestoreDb();
  const snap = await getDocs(
    query(
      collection(db, "gyms", gymId, "invites"),
      orderBy("createdAt", "desc"),
    ),
  );
  return snap.docs.map((d) => decodeInvite(d.id, d.data() as InviteDoc));
}
