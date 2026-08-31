/**
 * POST /api/invites/preview — Was steckt hinter diesem Code?
 *
 * Body:    { code }
 * Antwort: { valid, gymName?, role?, reason? }
 *
 * BEWUSST NUR FÜR ANGEMELDETE NUTZER: Ohne diese Hürde wäre die Route ein
 * Orakel, an dem sich Codes durchprobieren lassen, bis einer „gültig" meldet.
 * Wer eingeloggt ist, ist identifizierbar — das genügt als Bremse, ohne den
 * Beitritt zu verkomplizieren.
 *
 * Die Antwort enthält bewusst nur Gym-Name und Rolle: alles, was für die
 * Entscheidung „will ich beitreten?" nötig ist, und nichts darüber hinaus.
 */

import { NextResponse } from "next/server";
import { AdminUnavailableError, adminDb } from "@/lib/server/firebase-admin";
import { findInviteByCode } from "@/lib/server/invites";
import { bearerToken, verifyUser } from "@/lib/server/verify-user";
import {
  inviteStatus,
  normalizeInviteCode,
  type InviteRole,
} from "@/lib/invites";
import { DEFAULT_GYM_LABEL } from "@/lib/gym";

export const runtime = "nodejs";

const STATUS_REASON: Record<string, string> = {
  revoked: "Diese Einladung wurde zurückgezogen.",
  expired: "Diese Einladung ist abgelaufen.",
  usedUp: "Diese Einladung wurde bereits vollständig eingelöst.",
};

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
      return NextResponse.json({
        valid: false,
        reason: "Diesen Einladungscode gibt es nicht.",
      });
    }

    const status = inviteStatus({
      revokedAt: (found.get("revokedAt")?.toDate?.() as Date) ?? null,
      expiresAt: (found.get("expiresAt")?.toDate?.() as Date) ?? null,
      usedCount: (found.get("usedCount") as number) ?? 0,
      maxUses: (found.get("maxUses") as number) ?? 1,
    });
    if (status !== "open") {
      return NextResponse.json({ valid: false, reason: STATUS_REASON[status] });
    }

    const gymId = (found.get("gymId") as string) ?? "";
    const role = ((found.get("role") as string) === "trainer"
      ? "trainer"
      : "user") as InviteRole;

    // Bereits Mitglied eines ANDEREN Gyms: hier schon melden, damit der
    // Nutzer es vor dem Klick erfährt und nicht erst nach dem Einlösen.
    if (user.gymId && user.gymId !== gymId) {
      return NextResponse.json({
        valid: false,
        reason:
          "Dein Konto gehört bereits zu einem anderen Gym. Ein Wechsel läuft über die Verwaltung.",
      });
    }

    const gym = await db.collection("gyms").doc(gymId).get();
    const gymName =
      (gym.get("name") as string | undefined)?.trim() || DEFAULT_GYM_LABEL;

    return NextResponse.json({ valid: true, gymName, role });
  } catch (err) {
    if (err instanceof AdminUnavailableError) {
      return NextResponse.json(
        { error: "Einladungen sind serverseitig noch nicht eingerichtet." },
        { status: 503 },
      );
    }
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
    console.error("[TidalAthletics] invite/preview:", msg);
    return NextResponse.json(
      { error: "Einladung konnte nicht geprüft werden." },
      { status: 500 },
    );
  }
}
