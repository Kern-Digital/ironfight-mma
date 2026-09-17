/**
 * POST /api/wettkampf/gameplan — den Gameplan EINES Wettkampfs (neu) schreiben.
 *
 * Body:    { uid: string, campId: string, erzwingen?: boolean }
 * Antwort: 202 { gestartet: true } — sofort. Die Arbeit läuft per `waitUntil`
 *          weiter (Claude braucht 1–2 Minuten); die Seite beobachtet das
 *          Gameplan-Dokument (lib/gameplan.ts `beobachteGameplan`).
 *
 * Aufrufer: Anlegen eines Wettkampfs, Kampfart nachgetragen (Bestand), Knopf
 * „Neu schreiben". Nach einer neuen Analyse schreibt die commit-Route selbst
 * (Leon 17.09.2026: „nach jeder neuen Analyse automatisch").
 *
 * ZUGRIFF (dasselbe Tor wie die Regeln, lib/server/member-access.ts): Der
 * Gameplan besteht aus dem Wettkampf UND dem DeepFight-Profil des Athleten —
 * wer ihn anstößt, braucht beide Freigaben; beim verknüpften Gegner das Gym.
 */

import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { AdminUnavailableError, adminDb } from "@/lib/server/firebase-admin";
import { canAccessMember, canAccessOpponent, readMember } from "@/lib/server/member-access";
import { schreibeGameplan } from "@/lib/server/gameplan";
import { bearerToken, isTrainerOrAdmin, verifyUser } from "@/lib/server/verify-user";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const token = bearerToken(req);
  const user = token ? await verifyUser(token) : null;
  if (!user || !isTrainerOrAdmin(user)) {
    return NextResponse.json({ error: "Nur für Trainer/Admins verfügbar." }, { status: 403 });
  }

  let body: { uid?: string; campId?: string; erzwingen?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }
  const uid = body.uid?.trim();
  const campId = body.campId?.trim();
  if (!uid || !campId) return NextResponse.json({ error: "uid und campId fehlen." }, { status: 400 });

  try {
    const db = adminDb();
    const member = await readMember(db, uid);
    if (!member) return NextResponse.json({ error: "Mitglied nicht gefunden." }, { status: 404 });
    if (!canAccessMember(user, uid, member, "wettkampf") || !canAccessMember(user, uid, member, "deepfight")) {
      return NextResponse.json({ error: "Kein Zugriff auf Wettkampf und Kampfprofil." }, { status: 403 });
    }
    const campSnap = await db.collection("users").doc(uid).collection("fightCamps").doc(campId).get();
    const camp = campSnap.data();
    if (!camp) return NextResponse.json({ error: "Wettkampf nicht gefunden." }, { status: 404 });
    const opponentId = (camp.opponentId as string | undefined) || (camp.opponent?.opponentId as string | undefined);
    if (opponentId) {
      const opp = await db.collection("opponents").doc(opponentId).get();
      const gymId = opp.data()?.gymId;
      if (opp.exists && !canAccessOpponent(user, typeof gymId === "string" ? gymId : "")) {
        return NextResponse.json({ error: "Kein Zugriff auf dieses Gegnerprofil." }, { status: 403 });
      }
    }

    waitUntil(schreibeGameplan(db, uid, campId, { erzwingen: body.erzwingen === true, campDaten: camp }));
    return NextResponse.json({ gestartet: true }, { status: 202 });
  } catch (err) {
    if (err instanceof AdminUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Gameplan konnte nicht starten." }, { status: 500 });
  }
}
