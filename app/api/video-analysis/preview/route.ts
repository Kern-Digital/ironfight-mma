/**
 * POST /api/video-analysis/preview — der Vorlauf (Etappe 2, 16.09.2026).
 *
 * Body:    { source: VideoSource }   (lib/video-analysis.ts)
 * Antwort: { preview: VideoPreview }
 *
 * Gemini Flash schaut sich die ersten zwei Minuten in niedriger Auflösung an
 * und liefert die Kämpfer für den Zuordnungs-Schirm sowie einen Vorschlag
 * für Art und Kampfart des Videos. Kein Streaming: Die Antwort ist klein,
 * und der Aufruf dauert Sekunden, nicht Minuten.
 *
 * Der Vorlauf ist ein EIGENER Request mit eigenem Zeitbudget — dieselbe
 * Begründung wie beim Zwei-Phasen-Betrieb der Analyse (Vercel kappt nach
 * 300 s). Die Wortmarke „überlastet" der Gemini-Kette bleibt erhalten, damit
 * der Client wie bei der Analyse automatisch neu starten kann.
 */

import { NextResponse } from "next/server";
import { previewVideo } from "@/lib/server/gemini";
import {
  bearerToken,
  isTrainerOrAdmin,
  verifyUser,
} from "@/lib/server/verify-user";
import { MAX_VIDEO_SECONDS, type VideoSource } from "@/lib/video-analysis";

export const runtime = "nodejs";
export const maxDuration = 120;

function validate(src: VideoSource | undefined): string | null {
  if (!src) return "Videoquelle fehlt.";
  if (src.kind === "upload") {
    if (!src.fileUri) return "Video-Upload fehlt.";
    if (src.durationSeconds != null && src.durationSeconds > MAX_VIDEO_SECONDS + 5)
      return "Video ist länger als 15 Minuten.";
    return null;
  }
  if (src.kind === "youtube") {
    if (!/^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(src.url))
      return "Bitte einen gültigen YouTube-Link angeben.";
    const start = src.startSeconds ?? 0;
    if (src.endSeconds != null && src.endSeconds <= start)
      return "Endzeit muss nach der Startzeit liegen.";
    return null;
  }
  return "Unbekannte Videoquelle.";
}

export async function POST(req: Request) {
  const token = bearerToken(req);
  const user = token ? await verifyUser(token) : null;
  if (!isTrainerOrAdmin(user)) {
    return NextResponse.json({ error: "Nur für Trainer/Admins verfügbar." }, { status: 403 });
  }

  let body: { source?: VideoSource };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }
  const invalid = validate(body.source);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  try {
    const preview = await previewVideo(body.source!);
    return NextResponse.json({ preview });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Vorlauf fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
