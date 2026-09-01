/**
 * POST /api/invites/revoke — Einladung zurückziehen (Verwaltung).
 *
 * Body:    { code }
 * Antwort: { ok: true }
 *
 * Zurückziehen LÖSCHT nicht: der Eintrag bleibt mit `revokedAt` stehen, damit
 * in der Übersicht und im Audit-Log nachvollziehbar bleibt, dass es den Code
 * gab und wer ihn gestoppt hat.
 *
 * Rechte wie in /create: nur die Verwaltung (`canManageGym` — siehe
 * Begründung im Kopf von create/route.ts). Wer nicht einladen darf, soll
 * auch fremde Einladungen nicht stoppen können.
 */

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { AdminUnavailableError, adminDb } from "@/lib/server/firebase-admin";
import {
  displayNameFor,
  findInviteByCode,
  writeAudit,
} from "@/lib/server/invites";
import {
  bearerToken,
  canManageGym,
  isAdmin,
  userGymId,
  verifyUser,
} from "@/lib/server/verify-user";
import { normalizeInviteCode } from "@/lib/invites";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token = bearerToken(req);
  const user = token ? await verifyUser(token) : null;
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  if (!canManageGym(user)) {
    return NextResponse.json(
      { error: "Nur die Gym-Verwaltung kann Einladungen zurückziehen." },
      { status: 403 },
    );
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
        { error: "Einladung nicht gefunden." },
        { status: 404 },
      );
    }

    const gymId = (found.get("gymId") as string) ?? "";
    if (!isAdmin(user) && gymId !== userGymId(user)) {
      // Fremdes Gym: wie „nicht gefunden" behandeln — die Existenz eines
      // Codes in einem anderen Gym geht niemanden etwas an.
      return NextResponse.json(
        { error: "Einladung nicht gefunden." },
        { status: 404 },
      );
    }

    if (!found.get("revokedAt")) {
      await found.ref.update({ revokedAt: FieldValue.serverTimestamp() });
      await writeAudit(db, gymId, {
        type: "invite.revoke",
        actorUid: user.uid,
        actorName: await displayNameFor(db, user.uid),
        code,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AdminUnavailableError) {
      return NextResponse.json(
        { error: "Einladungen sind serverseitig noch nicht eingerichtet." },
        { status: 503 },
      );
    }
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
    console.error("[TidalAthletics] invite/revoke:", msg);
    return NextResponse.json(
      { error: "Einladung konnte nicht zurückgezogen werden." },
      { status: 500 },
    );
  }
}
