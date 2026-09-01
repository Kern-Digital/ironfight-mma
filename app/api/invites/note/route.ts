/**
 * POST /api/invites/note — Notiz einer Einladung ändern (Verwaltung).
 *
 * Body:    { code, note }
 * Antwort: { ok: true, note }
 *
 * Warum eine eigene Route und kein Client-Schreibzugriff: Einladungen sind in
 * den Firestore-Regeln komplett `write: if false`. Das ist Absicht — dürfte
 * der Client das Dokument anfassen, wäre auch `role`, `maxUses` und
 * `revokedAt` erreichbar. Deshalb geht selbst eine harmlose Notiz über das
 * Admin-SDK, das genau EIN Feld schreibt.
 *
 * Rechte wie in /create und /revoke: nur die Verwaltung (`canManageGym`,
 * Begründung im Kopf von create/route.ts).
 *
 * Die Notiz ist reine Innensicht (Übersicht der Verwaltung); der Eingeladene
 * sieht sie nie — /preview gibt sie nicht aus. Änderbar bleibt sie auch bei
 * abgelaufenen und zurückgezogenen Einladungen: sie beschreibt, wofür der
 * Code gedacht war, und das will man gerade im Nachhinein nachtragen können.
 */

import { NextResponse } from "next/server";
import { AdminUnavailableError, adminDb } from "@/lib/server/firebase-admin";
import { displayNameFor, findInviteByCode, writeAudit } from "@/lib/server/invites";
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
      { error: "Nur die Gym-Verwaltung kann Einladungen bearbeiten." },
      { status: 403 },
    );
  }

  let body: { code?: string; note?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request." }, { status: 400 });
  }

  const code = normalizeInviteCode(body.code ?? "");
  if (!code) {
    return NextResponse.json({ error: "Kein Code angegeben." }, { status: 400 });
  }
  // Gleiche Grenze wie beim Erstellen — die Notiz steht in einer Listenzeile.
  const note = (body.note ?? "").toString().slice(0, 120).trim();

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
      // Fremdes Gym: wie „nicht gefunden" behandeln (Muster /revoke).
      return NextResponse.json(
        { error: "Einladung nicht gefunden." },
        { status: 404 },
      );
    }

    if ((found.get("note") as string | undefined) !== note) {
      await found.ref.update({ note });
      await writeAudit(db, gymId, {
        type: "invite.note",
        actorUid: user.uid,
        actorName: await displayNameFor(db, user.uid),
        code,
        details: { note },
      });
    }

    return NextResponse.json({ ok: true, note });
  } catch (err) {
    if (err instanceof AdminUnavailableError) {
      return NextResponse.json(
        { error: "Einladungen sind serverseitig noch nicht eingerichtet." },
        { status: 503 },
      );
    }
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
    console.error("[TidalAthletics] invite/note:", msg);
    return NextResponse.json(
      { error: "Notiz konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }
}
