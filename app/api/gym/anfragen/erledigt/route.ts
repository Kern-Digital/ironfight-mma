/**
 * POST /api/gym/anfragen/erledigt — eine Anfrage ist beantwortet und wird
 * gelöscht (Etappe 4 der Gym-Suche, 01.10.2026).
 *
 * Body: { uid: string } — das Konto, das angefragt hat.
 * Antwort: { ok: true }
 *
 * WER: die Verwaltung des Gyms. Das Gym kommt aus dem Claim; mit der uid
 * eines Kontos, das bei einem ANDEREN Gym angefragt hat, trifft man hier
 * nichts (404) — der Pfad hängt am eigenen Gym.
 *
 * LÖSCHEN STATT ABHAKEN: Name, E-Mail und Nachricht eines Menschen, der nie
 * Mitglied wurde, bleiben nicht länger liegen als nötig. Danach kann dieselbe
 * Person wieder anfragen.
 */

import { NextResponse } from "next/server";
import { AdminUnavailableError, adminDb } from "@/lib/server/firebase-admin";
import { verwaltungDesGyms } from "@/lib/server/abo";
import { anfrageRef } from "@/lib/server/anfragen";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const zugang = await verwaltungDesGyms(req, "Anfragen beantwortet die Verwaltung deines Gyms.");
  if (zugang instanceof Response) return zugang;

  let body: { uid?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request." }, { status: 400 });
  }
  const uid = typeof body.uid === "string" ? body.uid.trim() : "";
  if (!uid || uid.length > 128 || uid.includes("/")) {
    return NextResponse.json({ error: "Diese Anfrage gibt es nicht mehr." }, { status: 404 });
  }

  try {
    const ref = anfrageRef(adminDb(), zugang.gymId, uid);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Diese Anfrage gibt es nicht mehr." }, { status: 404 });
    }
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AdminUnavailableError) {
      return NextResponse.json({ error: "Server gerade nicht erreichbar." }, { status: 503 });
    }
    console.error("[gym/anfragen/erledigt]", err);
    return NextResponse.json(
      { error: "Das ließ sich gerade nicht speichern. Versuch es gleich noch einmal." },
      { status: 500 },
    );
  }
}
