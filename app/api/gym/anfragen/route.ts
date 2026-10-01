/**
 * POST /api/gym/anfragen — die offenen Anfragen „Probetraining vereinbaren"
 * des eigenen Gyms (Etappe 4 der Gym-Suche, 01.10.2026).
 * Antwort: { anfragen: [{ uid, name, email, nachricht, erstelltAm, loeschenAm }] }
 *
 * WER: die Verwaltung des Gyms (401 / 403). Das Gym kommt aus dem Claim,
 * keine Eingabe. Trainer ohne Verwaltungsrecht sehen die Anfragen nicht —
 * wer einlädt, beantwortet sie auch (Leon 31.08.: „Einladen darf nur die
 * Verwaltung").
 *
 * Abgelaufene Anfragen (90 Tage) löscht der Abruf nebenbei.
 */

import { NextResponse } from "next/server";
import { AdminUnavailableError, adminDb } from "@/lib/server/firebase-admin";
import { verwaltungDesGyms } from "@/lib/server/abo";
import { anfragenDesGyms } from "@/lib/server/anfragen";

export const runtime = "nodejs";

const KEIN_CACHE = { "Cache-Control": "no-store" };

export async function POST(req: Request) {
  const zugang = await verwaltungDesGyms(req, "Anfragen beantwortet die Verwaltung deines Gyms.");
  if (zugang instanceof Response) return zugang;

  try {
    const anfragen = await anfragenDesGyms(adminDb(), zugang.gymId);
    return NextResponse.json({ anfragen }, { headers: KEIN_CACHE });
  } catch (err) {
    if (err instanceof AdminUnavailableError) {
      return NextResponse.json({ error: "Server gerade nicht erreichbar." }, { status: 503, headers: KEIN_CACHE });
    }
    console.error("[gym/anfragen]", err);
    return NextResponse.json(
      { error: "Die Anfragen laden gerade nicht. Versuch es gleich noch einmal." },
      { status: 500, headers: KEIN_CACHE },
    );
  }
}
