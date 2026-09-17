/**
 * POST /api/wettkampf/gameplan/scouting — „Gameplan folgt dem Scouting"
 * (Leon 17.09.2026: „Ja, mit Aufschub").
 *
 * Body:    { opponentId: string }
 * Antwort: 202 { wettkaempfe: n } — sofort, nachdem die Gameplans aller
 *          anstehenden Wettkämpfe gegen diesen Gegner die Marke dieser
 *          Änderung tragen. 200 { wettkaempfe: 0 }, wenn kein Wettkampf ansteht.
 *
 * Aufrufer: die Gegnerseite NACH dem Speichern (lib/gameplan.ts
 * `meldeScoutingAenderung`). Der Nachlauf wartet 90 s; speichert der Trainer
 * in der Zeit erneut, übernimmt der jüngere Aufruf, und nur er schreibt
 * (lib/server/gameplan.ts `gameplaeneNachScouting`). Fünf Änderungen am Stück
 * kosten so einen Claude-Lauf.
 *
 * ZUGRIFF: wer das Gegnerprofil bearbeiten darf (Trainer desselben Gyms,
 * Admin) — dasselbe Tor wie `isGymStaffFor` in den Regeln. Wie beim Nachlauf
 * nach einer Analyse schreibt der Server die Gameplans ALLER betroffenen
 * Athleten des Gyms: Der Aufrufer sieht dabei nichts, er stößt nur an, was die
 * Profile ohnehin hergeben.
 */

import { NextResponse } from "next/server";
import { nachAntwortWeiter } from "@/lib/server/nachlauf";
import { AdminUnavailableError, adminDb } from "@/lib/server/firebase-admin";
import { canAccessOpponent } from "@/lib/server/member-access";
import { gameplaeneNachScouting, merkeScoutingAenderung } from "@/lib/server/gameplan";
import { bearerToken, isTrainerOrAdmin, verifyUser } from "@/lib/server/verify-user";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Bis hierhin läuft die Funktion sicher (300 s Budget, 20 s Puffer). */
const BUDGET_MS = 280_000;

export async function POST(req: Request) {
  const start = Date.now();
  const token = bearerToken(req);
  const user = token ? await verifyUser(token) : null;
  if (!user || !isTrainerOrAdmin(user)) {
    return NextResponse.json({ error: "Nur für Trainer/Admins verfügbar." }, { status: 403 });
  }

  let body: { opponentId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }
  const opponentId = body.opponentId?.trim();
  if (!opponentId) return NextResponse.json({ error: "opponentId fehlt." }, { status: 400 });

  try {
    const db = adminDb();
    const snap = await db.collection("opponents").doc(opponentId).get();
    const gymId = snap.data()?.gymId;
    if (!snap.exists || typeof gymId !== "string" || !gymId) {
      return NextResponse.json({ error: "Gegnerprofil nicht gefunden." }, { status: 404 });
    }
    if (!canAccessOpponent(user, gymId)) {
      return NextResponse.json({ error: "Kein Zugriff auf dieses Gegnerprofil." }, { status: 403 });
    }

    const marke = await merkeScoutingAenderung(db, { opponentId, gymId });
    if (marke.betroffen.length === 0) return NextResponse.json({ wettkaempfe: 0 }, { status: 200 });
    nachAntwortWeiter(gameplaeneNachScouting(db, marke, { frist: start + BUDGET_MS }));
    return NextResponse.json({ wettkaempfe: marke.betroffen.length }, { status: 202 });
  } catch (err) {
    if (err instanceof AdminUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gameplan konnte nicht nachziehen." },
      { status: 500 },
    );
  }
}
