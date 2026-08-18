/**
 * POST /api/video-analysis/upload — Videodatei zur Gemini-Files-API durchreichen.
 *
 * Der Client streamt die Datei als Raw-Body hierher; die Route reicht den
 * Stream direkt an Gemini weiter (kein Zwischenspeichern auf Disk). So bleibt
 * der GEMINI_API_KEY ausschließlich serverseitig.
 *
 * Header: authorization (Firebase-ID-Token), content-type (Video-MIME),
 *         x-file-name (URL-encodiert), x-file-size (Bytes).
 * Antwort: { fileUri, mimeType }
 */

import { NextResponse } from "next/server";
import { uploadVideoToGemini } from "@/lib/server/gemini";
import {
  bearerToken,
  isTrainerOrAdmin,
  verifyUser,
} from "@/lib/server/verify-user";

export const runtime = "nodejs";
// Vercel-Limit: Hobby-Plan erlaubt maximal 300s Funktionslaufzeit.
export const maxDuration = 300;

/** ~2 GB — Limit der Gemini-Files-API. */
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;

export async function POST(req: Request) {
  const token = bearerToken(req);
  const user = token ? await verifyUser(token) : null;
  if (!isTrainerOrAdmin(user)) {
    return NextResponse.json(
      { error: "Nur für Trainer/Admins verfügbar." },
      { status: 403 },
    );
  }

  const size = Number(req.headers.get("x-file-size") || 0);
  const mimeType = req.headers.get("content-type") || "video/mp4";
  const fileName = decodeURIComponent(
    req.headers.get("x-file-name") || "kampf-video",
  );

  if (!size || size <= 0) {
    return NextResponse.json(
      { error: "Dateigröße fehlt (x-file-size)." },
      { status: 400 },
    );
  }
  if (size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "Datei zu groß — maximal 2 GB." },
      { status: 413 },
    );
  }
  if (!mimeType.startsWith("video/")) {
    return NextResponse.json(
      { error: "Bitte eine Videodatei hochladen." },
      { status: 400 },
    );
  }
  if (!req.body) {
    return NextResponse.json({ error: "Leerer Upload." }, { status: 400 });
  }

  try {
    const file = await uploadVideoToGemini(req.body, size, mimeType, fileName);
    return NextResponse.json({ fileUri: file.uri, mimeType: file.mimeType });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
