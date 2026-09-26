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
import { bucheGeminiKosten } from "@/lib/server/gemini-kosten";
import { antwortWennDeepFightZu, videoSekundenFuerGym } from "@/lib/server/gym-status";
import { vorlaufErlaubt } from "@/lib/server/guthaben";
import { adminDb } from "@/lib/server/firebase-admin";
import {
  bearerToken,
  isTrainerOrAdmin,
  userGymId,
  verifyUser,
} from "@/lib/server/verify-user";
import { type VideoSource } from "@/lib/video-analysis";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * `maxSekunden` ist die Länge, die DIESES Gym in seiner Stufe darf (Leon
 * 22.09.: 10 / 15 / 15 min). Der Vorlauf sieht zwar nur die ersten zwei
 * Minuten — er hält die Grenze trotzdem, damit der Trainer sie vor dem
 * Hochladen erfährt und nicht erst am Startknopf.
 */
function validate(src: VideoSource | undefined, maxSekunden: number): string | null {
  if (!src) return "Videoquelle fehlt.";
  if (src.kind === "upload") {
    if (!src.fileUri) return "Video-Upload fehlt.";
    if (src.durationSeconds != null && src.durationSeconds > maxSekunden + 5)
      return `Nimm einen Ausschnitt bis ${Math.round(maxSekunden / 60)} Minuten.`;
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
  if (!user || !isTrainerOrAdmin(user)) {
    return NextResponse.json({ error: "Nur für Trainer/Admins verfügbar." }, { status: 403 });
  }
  // Stillgelegtes Gym → 423, bevor Gemini auch nur einen Token sieht.
  const gesperrt = await antwortWennDeepFightZu(adminDb, userGymId(user));
  if (gesperrt) return gesperrt;

  // Die stille Tagesbremse (Leon 21.09.: „frei, Tagesbremse 60 Stk., … es soll
  // im Hintergrund passieren"). Kein Zähler in der Oberfläche — sie fängt nur
  // den Unfall, im Alltag greift sie nie.
  if (!(await vorlaufErlaubt(adminDb, userGymId(user)))) {
    return NextResponse.json(
      { error: "Für heute sind genug Vorläufe gelaufen. Morgen geht es weiter." },
      { status: 429 },
    );
  }

  let body: { source?: VideoSource };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }
  // Die Videolänge hängt an der Abo-Stufe (Leon 22.09.).
  const invalid = validate(body.source, await videoSekundenFuerGym(adminDb, userGymId(user)));
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  try {
    const { preview, usage } = await previewVideo(body.source!);
    // Der Vorlauf kostet Video-Token — seit 20.09.2026 gebucht (Schritt 0).
    await bucheGeminiKosten(adminDb, userGymId(user), usage);
    return NextResponse.json({ preview });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Vorlauf fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
