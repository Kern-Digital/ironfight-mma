/**
 * Zugriffs-Tor für Mitgliederdaten — SERVERSEITIG, für Routen mit Admin-SDK.
 *
 * Das Admin-SDK umgeht die Firestore-Regeln. Wer damit schreibt, muss die
 * Frage „darf dieser Aufrufer an dieses Ziel?" selbst beantworten — und
 * zwar mit GENAU derselben Regel wie `canAccessMemberData(uid, bereich)` in
 * firestore.rules, sonst driften die beiden auseinander und die Route wird
 * zur Hintertür.
 *
 * Die Regel, wörtlich aus den Rules:
 *   admin
 *   ODER (trainer UND (ich selbst
 *                     ODER (gleiches Gym UND (kein Stab-Konto
 *                                            ODER Freigabe im Bereich))))
 *
 * `istStabKonto` liest die Spiegel-Felder am users-Dokument (trainer,
 * verwaltung, admin) — dieselben, die die Rules lesen. Die Freigabe steht
 * in `profileShares.{bereich}` (lib/profile-sharing.ts).
 */

import type { Firestore } from "firebase-admin/firestore";
import { DEFAULT_GYM_ID } from "@/lib/gym";
import type { ShareArea } from "@/lib/profile-sharing";
import { isAdmin, isTrainerOrAdmin, userGymId, type VerifiedUser } from "./verify-user";

export interface MemberDoc {
  gymId: string;
  displayName: string | null;
  isStaff: boolean;
  shares: Partial<Record<ShareArea, string[]>>;
}

/** Liest das users-Dokument in der Form, die das Tor braucht. */
export async function readMember(
  db: Firestore,
  uid: string,
): Promise<MemberDoc | null> {
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return null;
  const d = snap.data() ?? {};
  const shares = (d.profileShares ?? {}) as Partial<Record<ShareArea, string[]>>;
  return {
    gymId: typeof d.gymId === "string" && d.gymId.trim() ? d.gymId : DEFAULT_GYM_ID,
    displayName:
      typeof d.displayName === "string" && d.displayName.trim()
        ? d.displayName
        : typeof d.email === "string"
          ? d.email
          : null,
    isStaff: d.trainer === true || d.verwaltung === true || d.admin === true,
    shares,
  };
}

/** Entsprechung zu canAccessMemberData() in firestore.rules. */
export function canAccessMember(
  user: VerifiedUser,
  targetUid: string,
  member: MemberDoc,
  area: ShareArea,
): boolean {
  if (isAdmin(user)) return true;
  if (!isTrainerOrAdmin(user)) return false;
  if (user.uid === targetUid) return true;
  if (member.gymId !== userGymId(user)) return false;
  if (!member.isStaff) return true;
  return (member.shares[area] ?? []).includes(user.uid);
}

/** Entsprechung zu isGymStaffFor() für ein Gegnerprofil. */
export function canAccessOpponent(user: VerifiedUser, opponentGymId: string): boolean {
  if (isAdmin(user)) return true;
  return isTrainerOrAdmin(user) && opponentGymId === userGymId(user);
}
