/**
 * Serverseitige Einladungs-Logik (Admin-SDK) — der einzige Weg, auf dem
 * Einladungen entstehen, zurückgezogen und eingelöst werden.
 *
 * Warum hier und nicht im Client: In den Firestore-Regeln stehen
 * gyms/{gymId}/invites und gyms/{gymId}/auditLog auf `write: if false`.
 * Dürfte ein Trainer Einladungen selbst schreiben, könnte er sich eine mit
 * role="admin" ausstellen und einlösen — Rechteausweitung über Umwege.
 */

import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { randomInt } from "node:crypto";
import {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  type InviteRole,
} from "@/lib/invites";

export interface InviteRecord {
  code: string;
  gymId: string;
  role: InviteRole;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp | null;
  expiresAt: Timestamp | null;
  maxUses: number;
  usedCount: number;
  usedBy: { uid: string; at: Timestamp | null }[];
  revokedAt: Timestamp | null;
  note: string;
}

/** Kryptografisch zufälliger Code aus dem verwechslungsfreien Alphabet. */
function randomCode(): string {
  let out = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    out += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * Freier Code. Die Kollisionswahrscheinlichkeit ist verschwindend
 * (32^8), aber ein Zusammenstoß würde eine fremde Einladung überschreiben —
 * deshalb wird geprüft statt gehofft.
 */
export async function reserveInviteCode(db: Firestore): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomCode();
    const hit = await db
      .collectionGroup("invites")
      .where("code", "==", code)
      .limit(1)
      .get();
    if (hit.empty) return code;
  }
  throw new Error("Konnte keinen freien Einladungscode erzeugen.");
}

/**
 * Sucht eine Einladung allein am Code — das Einlösen kennt das Gym nicht.
 * Braucht den COLLECTION_GROUP-Index auf `code` (firestore.indexes.json).
 */
export async function findInviteByCode(db: Firestore, code: string) {
  const snap = await db
    .collectionGroup("invites")
    .where("code", "==", code)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0];
}

// Protokoll + Namensauflösung sind seit Checkpoint 2 gym-weit (auch die
// Rollen-API schreibt hinein) und leben deshalb in lib/server/audit.ts.
// Re-Export, damit die Einladungs-Routen ihren gewohnten Import behalten.
export {
  displayNameFor,
  writeAudit,
  type AuditType,
} from "./audit";
