/**
 * Protokoll rechteverändernder Vorgänge (Konzept §4) — und zugleich die
 * Quelle des Neuigkeiten-Bereichs (Checkpoint 2).
 *
 * Lag bis Checkpoint 1 in lib/server/invites.ts. Mit der Rollen-API schreibt
 * nicht mehr nur das Einladungswesen hierher; ein „invites"-Modul als Heimat
 * des gym-weiten Protokolls wäre irreführend geworden.
 *
 * EIN Protokoll, ZWEI Blickwinkel — bewusst keine zweite Sammlung für die
 * Neuigkeiten: Zwei Schreibpfade auf denselben Vorgang driften auseinander,
 * sobald einer von beiden fehlschlägt. Die Oberfläche filtert stattdessen
 * (lib/audit.ts, `NEWS_TYPES`).
 *
 * Geschrieben wird ausschließlich hier, per Admin-SDK: in den Firestore-Regeln
 * steht `gyms/{gymId}/auditLog` auf `write: if false`. Ein Protokoll, das der
 * Betroffene ändern kann, ist keines.
 */

import { FieldValue, type Firestore } from "firebase-admin/firestore";

export type AuditType =
  | "invite.create"
  | "invite.revoke"
  | "invite.redeem"
  | "invite.note"
  /** Rechte eines Mitglieds geändert (Checkpoint 2, /api/members/role). */
  | "member.role"
  /** Mitgliedschaft beendet (Checkpoint 2, /api/members/remove). */
  | "member.remove";

export interface AuditEntryInput {
  type: AuditType;
  actorUid: string;
  actorName?: string;
  targetUid?: string;
  /**
   * Name des Betroffenen, denormalisiert. Ohne ihn müsste die
   * Neuigkeiten-Ansicht für jede Zeile ein fremdes users-Dokument
   * nachschlagen — und für ausgetretene Mitglieder gäbe es gar keinen Namen
   * mehr. Ein Protokoll beschreibt, wie es DAMALS war.
   */
  targetName?: string;
  code?: string;
  details?: Record<string, string | number | boolean | null>;
}

/**
 * Schreibt einen Protokolleintrag. Bewusst best-effort: ein fehlgeschlagener
 * Eintrag darf einen erfolgreichen Beitritt nicht rückgängig machen — der
 * Nutzer hätte sonst einen Claim, aber keine Einladung mehr.
 */
export async function writeAudit(
  db: Firestore,
  gymId: string,
  entry: AuditEntryInput,
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
 * Anzeigename zu einer uid für die Denormalisierung. Fällt auf einen
 * neutralen Text zurück, damit ein fehlendes Profil keinen Vorgang blockiert —
 * der Fallback gehört zum Aufrufer, weil „Trainer" bei einem beitretenden
 * Athleten schlicht falsch wäre.
 */
export async function displayNameFor(
  db: Firestore,
  uid: string,
  fallback = "Trainer",
): Promise<string> {
  try {
    const snap = await db.collection("users").doc(uid).get();
    const name = snap.get("displayName");
    if (typeof name === "string" && name.trim()) return name.trim();
    const authName = snap.get("authProviderName");
    if (typeof authName === "string" && authName.trim()) return authName.trim();
    return fallback;
  } catch {
    return fallback;
  }
}
