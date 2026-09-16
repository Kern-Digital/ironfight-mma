/**
 * POST /api/video-analysis/rahmen — Kämpfer auf einem Standbild eingrenzen
 * (Leon 16.09. abends: „die Karten sollen den Kämpfer genauer zeigen").
 *
 * Body:    { image: "data:image/jpeg;base64,…", fighters: [{ description, clothing, features }] }
 * Antwort: { boxes: (FighterBox | null)[] }   — Reihenfolge wie `fighters`
 *
 * Der Browser zieht das Standbild aus der lokalen Datei und schickt es hier
 * hin; Gemini Flash sucht darauf die Kämpfer, die der Vorlauf beschrieben hat.
 * Eigener, kleiner Request: Ein JPEG von höchstens 960 px Breite liegt weit
 * unter Vercels 4,5 MB, und der Aufruf dauert Sekunden.
 */

import { NextResponse } from "next/server";
import { locateFighters } from "@/lib/server/gemini";
import { bearerToken, isTrainerOrAdmin, verifyUser } from "@/lib/server/verify-user";

export const runtime = "nodejs";
export const maxDuration = 60;

const PRAEFIX = "data:image/jpeg;base64,";
/** Rund 2 MB Bild — ein Standbild aus dem Fluss hat ein Zehntel davon. */
const MAX_BASE64 = 2_800_000;

export async function POST(req: Request) {
  const token = bearerToken(req);
  const user = token ? await verifyUser(token) : null;
  if (!isTrainerOrAdmin(user)) {
    return NextResponse.json({ error: "Nur für Trainer/Admins verfügbar." }, { status: 403 });
  }

  let body: { image?: unknown; fighters?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }
  if (typeof body.image !== "string" || !body.image.startsWith(PRAEFIX)) {
    return NextResponse.json({ error: "Standbild fehlt." }, { status: 400 });
  }
  const data = body.image.slice(PRAEFIX.length);
  if (data.length > MAX_BASE64) {
    return NextResponse.json({ error: "Standbild ist zu groß." }, { status: 400 });
  }
  const text = (v: unknown) => (typeof v === "string" ? v.slice(0, 400) : "");
  const fighters = (Array.isArray(body.fighters) ? body.fighters : []).slice(0, 2).map((f) => {
    const o = (f ?? {}) as Record<string, unknown>;
    return { description: text(o.description), clothing: text(o.clothing), features: text(o.features) };
  });
  if (fighters.length === 0) {
    return NextResponse.json({ error: "Keine Kämpfer beschrieben." }, { status: 400 });
  }

  try {
    return NextResponse.json({ boxes: await locateFighters(data, fighters) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Rahmen-Suche fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
