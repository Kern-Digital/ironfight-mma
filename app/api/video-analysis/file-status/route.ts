/**
 * POST /api/video-analysis/file-status — Verarbeitungs-Status eines direkt
 * zu Google hochgeladenen Videos abfragen (der Client pollt hierüber, bis
 * das Video ACTIVE ist; der GEMINI_API_KEY bleibt serverseitig).
 *
 * Body:    { name }  — Gemini-Dateiname, z. B. "files/abc123"
 * Antwort: { state, uri, mimeType, name }
 */

import { NextResponse } from "next/server";
import { getFileState } from "@/lib/server/gemini";
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
    return NextResponse.json(
      { error: "Nur für Trainer/Admins verfügbar." },
      { status: 403 },
    );
  }

  let body: { name?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request." }, { status: 400 });
  }
  const name = body.name ?? "";
  if (!/^files\/[A-Za-z0-9._-]+$/.test(name)) {
    return NextResponse.json({ error: "Ungültiger Dateiname." }, { status: 400 });
  }

  try {
    const file = await getFileState(name);
    return NextResponse.json({
      state: file.state,
      uri: file.uri,
      mimeType: file.mimeType,
      name: file.name,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Status-Abfrage fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
