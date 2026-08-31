/**
 * POST /api/invites/redeem — Einladung einlösen und dem Gym beitreten.
 *
 * Body:    { code }
 * Antwort: { ok: true, gymId, gymName, role }
 *
 * Das ist der Vorgang, der die Mandantentrennung überhaupt herstellt
 * (Konzept §5): Er setzt den `gymId`-Custom-Claim — serverseitig, per
 * Admin-SDK, und nirgendwo sonst.
 *
 * Reihenfolge und ihre Begründung:
 *   1. TRANSAKTION prüft und verbraucht die Nutzung. Erst danach steht fest,
 *      dass dieser Code für diesen Nutzer gilt — bei maxUses > 1 konkurrieren
 *      sonst zwei gleichzeitige Beitritte um denselben letzten Platz.
 *   2. CLAIMS setzen. Schlägt das fehl, wird die Nutzung in Schritt 1
 *      ZURÜCKGENOMMEN — sonst wäre ein Platz verbraucht, ohne dass jemand
 *      beigetreten ist.
 *   3. users-Dokument spiegeln. Damit ist die Lücke „neue Signups sind für
 *      Trainer unsichtbar" im selben Vorgang geschlossen: Claim und Feld
 *      entstehen gemeinsam, scripts/backfill-user-gym.mjs wird überflüssig.
 *
 * Der Client muss anschließend refreshRole() aufrufen — der Claim liegt im
 * ID-Token, und das wird nicht von selbst neu geholt.
 */

import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  AdminUnavailableError,
  adminAuth,
  adminDb,
} from "@/lib/server/firebase-admin";
import { findInviteByCode, writeAudit } from "@/lib/server/invites";
import { bearerToken, verifyUser } from "@/lib/server/verify-user";
import {
  inviteStatus,
  normalizeInviteCode,
  type InviteRole,
} from "@/lib/invites";
import { DEFAULT_GYM_LABEL } from "@/lib/gym";

export const runtime = "nodejs";

/**
 * Eine Einladung hebt Rechte an, senkt sie aber nie: Löst ein Trainer einen
 * Athleten-Code ein, bleibt er Trainer. Sonst könnte ein weitergereichter
 * Link jemanden versehentlich degradieren.
 */
const RANK: Record<string, number> = { user: 0, trainer: 1, admin: 2 };

function mergedRole(existing: string | null, invited: InviteRole): string {
  const current = existing ?? "user";
  return (RANK[current] ?? 0) >= (RANK[invited] ?? 0) ? current : invited;
}

export async function POST(req: Request) {
  const token = bearerToken(req);
  const user = token ? await verifyUser(token) : null;
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  let body: { code?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request." }, { status: 400 });
  }
  const code = normalizeInviteCode(body.code ?? "");
  if (!code) {
    return NextResponse.json({ error: "Kein Code angegeben." }, { status: 400 });
  }

  try {
    const db = adminDb();
    const found = await findInviteByCode(db, code);
    if (!found) {
      return NextResponse.json(
        { error: "Diesen Einladungscode gibt es nicht." },
        { status: 404 },
      );
    }

    const ref = found.ref;
    const gymId = (found.get("gymId") as string) ?? "";
    const invitedRole = ((found.get("role") as string) === "trainer"
      ? "trainer"
      : "user") as InviteRole;

    // Ein Nutzer gehört genau EINEM Gym (Konzept §1). Ein Wechsel ist ein
    // Verwaltungsvorgang, kein Selbstbedienungs-Klick. Fehlender Claim gilt
    // als „noch nicht zugeordnet" und darf beitreten.
    if (user.gymId && user.gymId !== gymId) {
      return NextResponse.json(
        {
          error:
            "Dein Konto gehört bereits zu einem anderen Gym. Ein Wechsel läuft über die Verwaltung.",
        },
        { status: 409 },
      );
    }

    // ─── 1. Nutzung verbrauchen (atomar) ────────────────────────────────
    // EIN Objekt für Hinzufügen UND Zurücknehmen: arrayRemove vergleicht
    // Werte exakt — ein zweites Timestamp.now() würde den Eintrag nie treffen.
    const use = { uid: user.uid, at: Timestamp.now() };
    let alreadyRedeemed = false;
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("invite-missing");

      const usedBy =
        (snap.get("usedBy") as { uid?: string }[] | undefined) ?? [];
      if (usedBy.some((u) => u.uid === user.uid)) {
        // Doppelklick oder Neuladen — kein zweiter Platz wird verbraucht.
        alreadyRedeemed = true;
        return;
      }

      const status = inviteStatus({
        revokedAt: (snap.get("revokedAt")?.toDate?.() as Date) ?? null,
        expiresAt: (snap.get("expiresAt")?.toDate?.() as Date) ?? null,
        usedCount: (snap.get("usedCount") as number) ?? 0,
        maxUses: (snap.get("maxUses") as number) ?? 1,
      });
      if (status !== "open") throw new Error(`invite-${status}`);

      tx.update(ref, {
        usedCount: FieldValue.increment(1),
        usedBy: FieldValue.arrayUnion(use),
      });
    });

    // ─── 2. Claims setzen (mergen!) ─────────────────────────────────────
    const role = mergedRole(user.role, invitedRole);
    try {
      const existing = (await adminAuth().getUser(user.uid)).customClaims ?? {};
      // setCustomUserClaims ERSETZT alle Claims — bestehende müssen
      // gemergt werden (gleiche Lektion wie in scripts/set-role.mjs).
      await adminAuth().setCustomUserClaims(user.uid, {
        ...existing,
        gymId,
        role,
      });
    } catch (claimErr) {
      if (!alreadyRedeemed) {
        // Platz zurückgeben — sonst ist eine Nutzung verbraucht, ohne dass
        // jemand beigetreten ist.
        await ref
          .update({
            usedCount: FieldValue.increment(-1),
            usedBy: FieldValue.arrayRemove(use),
          })
          .catch(() => {});
      }
      throw claimErr;
    }

    // ─── 3. users-Dokument spiegeln ─────────────────────────────────────
    await db
      .collection("users")
      .doc(user.uid)
      .set({ gymId, role }, { merge: true });

    const gym = await db.collection("gyms").doc(gymId).get();
    const gymName =
      (gym.get("name") as string | undefined)?.trim() || DEFAULT_GYM_LABEL;

    if (!alreadyRedeemed) {
      await writeAudit(db, gymId, {
        type: "invite.redeem",
        actorUid: user.uid,
        targetUid: user.uid,
        code,
        details: { role },
      });
    }

    return NextResponse.json({ ok: true, gymId, gymName, role });
  } catch (err) {
    if (err instanceof AdminUnavailableError) {
      return NextResponse.json(
        { error: "Einladungen sind serverseitig noch nicht eingerichtet." },
        { status: 503 },
      );
    }
    const msg = err instanceof Error ? err.message : "";
    const known: Record<string, string> = {
      "invite-revoked": "Diese Einladung wurde zurückgezogen.",
      "invite-expired": "Diese Einladung ist abgelaufen.",
      "invite-usedUp": "Diese Einladung wurde bereits vollständig eingelöst.",
      "invite-missing": "Diesen Einladungscode gibt es nicht.",
    };
    if (known[msg]) {
      return NextResponse.json({ error: known[msg] }, { status: 409 });
    }
    console.error("[TidalAthletics] invite/redeem:", msg || err);
    return NextResponse.json(
      { error: "Beitritt fehlgeschlagen. Bitte erneut versuchen." },
      { status: 500 },
    );
  }
}
