/**
 * POST /api/video-analysis/delete-upload — eine hochgeladene Datei bei Google
 * löschen (Etappe 2).
 *
 * Body:    { name: "files/…" }
 * Antwort: { ok: true }
 *
 * Bis Etappe 2 löschte /analyze die Datei selbst nach der Bewertung. Seit
 * aus EINEM Upload bis zu zwei Auswertungen werden, entscheidet der
 * Upload-Fluss, wann die Datei nicht mehr gebraucht wird — nach der letzten
 * Person. Fehler beim Löschen sind kein Fehler: Google räumt nach 48 h
 * ohnehin auf. Nur Trainer/Admins, wie jede Route dieser Familie.
 */

import { NextResponse } from "next/server";
import { deleteFile } from "@/lib/server/gemini";
import {
  bearerToken,
  isTrainerOrAdmin,
  verifyUser,
} from "@/lib/server/verify-user";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token = bearerToken(req);
  const user = token ? await verifyUser(token) : null;
  if (!isTrainerOrAdmin(user)) {
    return NextResponse.json({ error: "Nur für Trainer/Admins verfügbar." }, { status: 403 });
  }
  let body: { name?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }
  const name = body.name ?? "";
  if (!/^files\/[A-Za-z0-9._-]+$/.test(name)) {
    return NextResponse.json({ error: "Ungültiger Dateiname." }, { status: 400 });
  }
  await deleteFile(name);
  return NextResponse.json({ ok: true });
}
