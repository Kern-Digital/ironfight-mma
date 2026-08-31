/**
 * Serverseitige Einladungs-Logik (Admin-SDK) — der einzige Weg, auf dem
 * Einladungen entstehen, zurückgezogen und eingelöst werden.
 *
 * Warum hier und nicht im Client: In den Firestore-Regeln stehen
 * gyms/{gymId}/invites und gyms/{gymId}/auditLog auf `write: if false`.
 * Dürfte ein Trainer Einladungen selbst schreiben, könnte er sich eine mit
 * role="admin" ausstellen und einlösen — Rechteausweitung über Umwege.
 */

import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
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

export type AuditType =
  | "invite.create"
  | "invite.revoke"
  | "invite.redeem"
  | "invite.note";

/**
 * Protokolliert Vorgänge, die Rechte verändern (Konzept §4). Bewusst
 * best-effort: ein fehlgeschlagener Protokolleintrag darf einen erfolgreichen
 * Beitritt nicht rückgängig machen — der Nutzer hätte sonst einen Claim,
 * aber keine Einladung mehr.
 */
export async function writeAudit(
  db: Firestore,
  gymId: string,
  entry: {
    type: AuditType;
    actorUid: string;
    actorName?: string;
    targetUid?: string;
    code?: string;
    details?: Record<string, string | number | boolean | null>;
  },
): Promise<void> {
  try {
    await db.collection("gyms").doc(gymId).collection("auditLog").add({
      ...entry,
      actorName: entry.actorName ?? "",
      at: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn("[TidalAthletics] Audit-Eintrag fehlgeschlagen:", err);
  }
}

/**
 * Anzeigename des Aufrufers für die Denormalisierung. Fällt auf einen
 * neutralen Text zurück, damit ein fehlendes Profil keine Einladung blockiert.
 */
export async function displayNameFor(
  db: Firestore,
  uid: string,
): Promise<string> {
  try {
    const snap = await db.collection("users").doc(uid).get();
    const name = snap.get("displayName");
    return typeof name === "string" && name.trim() ? name.trim() : "Trainer";
  } catch {
    return "Trainer";
  }
}
