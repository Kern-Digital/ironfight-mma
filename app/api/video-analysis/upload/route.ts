/**
 * POST /api/video-analysis/upload — Upload-Session bei der Gemini-Files-API
 * eröffnen.
 *
 * Die Videobytes laufen NICHT über diese Route (Vercel begrenzt Request-
 * Bodies auf 4,5 MB): Der Server startet nur die Resumable-Session und gibt
 * die Upload-URL zurück; der Client lädt die Datei damit DIREKT zu Google
 * hoch. Die URL enthält keinen API-Key (Key wird beim Start per Header
 * übergeben) — der GEMINI_API_KEY bleibt ausschließlich serverseitig.
 *
 * Body:    { fileName, fileSize, mimeType }
 * Antwort: { uploadUrl }
 */

import { NextResponse } from "next/server";
import { startUploadSession } from "@/lib/server/gemini";
import {
  bearerToken,
  isTrainerOrAdmin,
  verifyUser,
} from "@/lib/server/verify-user";

export const runtime = "nodejs";

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

  let body: { fileName?: string; fileSize?: number; mimeType?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request." }, { status: 400 });
  }

  const size = Number(body.fileSize || 0);
  const mimeType = body.mimeType || "video/mp4";
  const fileName = (body.fileName || "kampf-video").slice(0, 120);

  if (!size || size <= 0) {
    return NextResponse.json({ error: "Dateigröße fehlt." }, { status: 400 });
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

  try {
    const uploadUrl = await startUploadSession(size, mimeType, fileName);
    return NextResponse.json({ uploadUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload-Start fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
