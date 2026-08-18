/**
 * POST /api/video-analysis/resolve-upload — hochgeladene Datei nachschlagen.
 *
 * Googles Upload-Endpoint liefert die finale Antwort ohne CORS-Header, der
 * Browser kann sie also nicht lesen. Der Client meldet deshalb nach dem
 * Upload nur den (einmaligen) uploadName; diese Route findet die Datei
 * serverseitig und liefert Name/URI/Status zurück.
 *
 * Body:    { uploadName }
 * Antwort: { name, uri, state, mimeType }  bzw. 404, wenn (noch) nicht da
 */

import { NextResponse } from "next/server";
import { findFileByDisplayName } from "@/lib/server/gemini";
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

  let body: { uploadName?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request." }, { status: 400 });
  }
  const uploadName = body.uploadName ?? "";
  if (!uploadName.startsWith("va-") || uploadName.length < 10) {
    return NextResponse.json({ error: "Ungültiger Upload-Name." }, { status: 400 });
  }

  try {
    const file = await findFileByDisplayName(uploadName);
    if (!file) {
      return NextResponse.json(
        { error: "Datei noch nicht auffindbar." },
        { status: 404 },
      );
    }
    return NextResponse.json({
      name: file.name,
      uri: file.uri,
      state: file.state,
      mimeType: file.mimeType,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Nachschlagen fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
