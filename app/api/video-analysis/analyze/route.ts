/**
 * POST /api/video-analysis/analyze — zweistufige KI-Analyse ausführen.
 *
 * Body: AnalyzeRequest (lib/video-analysis.ts) — Quelle (Gemini-file_uri oder
 * YouTube-URL), Kämpfer-Beschreibung, Modellstufe, bestehende DNA als Kontext.
 *
 * Antwort: NDJSON-Stream mit Fortschritts-Events:
 *   {"type":"stage","stage":"gemini"}   → Video-Beobachtung läuft
 *   {"type":"stage","stage":"claude"}   → Bewertung läuft
 *   {"type":"progress","chars":1234}    → Zeichen der Bewertung bisher
 *   {"type":"result", observation, evaluation, models}
 *   {"type":"error","message":"…"}
 *
 * Beide API-Keys bleiben serverseitig; Zugriff nur für Trainer/Admins.
 */

import { deleteFile, observeVideo } from "@/lib/server/gemini";
import { evaluateObservation } from "@/lib/server/claude";
import {
  bearerToken,
  isTrainerOrAdmin,
  verifyUser,
} from "@/lib/server/verify-user";
import { MAX_VIDEO_SECONDS, type AnalyzeRequest } from "@/lib/video-analysis";

export const runtime = "nodejs";
// Vercel-Limit: Hobby-Plan erlaubt maximal 300s Funktionslaufzeit.
export const maxDuration = 300;

function validate(body: AnalyzeRequest): string | null {
  if (!body || (body.mode !== "opponent" && body.mode !== "athlete"))
    return "Ungültiger Modus.";
  if (!body.fighter?.name?.trim()) return "Kämpfer-Name fehlt.";
  if (body.tier !== "flash" && body.tier !== "pro")
    return "Ungültige Modellstufe.";
  const src = body.source;
  if (!src) return "Videoquelle fehlt.";
  if (src.kind === "upload") {
    if (!src.fileUri) return "Video-Upload fehlt.";
    if (
      src.durationSeconds != null &&
      src.durationSeconds > MAX_VIDEO_SECONDS + 5
    )
      return "Video ist länger als 15 Minuten.";
  } else if (src.kind === "youtube") {
    if (!/^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(src.url))
      return "Bitte einen gültigen YouTube-Link angeben.";
    const start = src.startSeconds ?? 0;
    const end = src.endSeconds;
    if (end != null && end - start > MAX_VIDEO_SECONDS + 5)
      return "Der gewählte Ausschnitt ist länger als 15 Minuten.";
    if (end != null && end <= start)
      return "Endzeit muss nach der Startzeit liegen.";
  } else {
    return "Unbekannte Videoquelle.";
  }
  return null;
}

export async function POST(req: Request) {
  const token = bearerToken(req);
  const user = token ? await verifyUser(token) : null;
  if (!isTrainerOrAdmin(user)) {
    return Response.json(
      { error: "Nur für Trainer/Admins verfügbar." },
      { status: 403 },
    );
  }

  let body: AnalyzeRequest;
  try {
    body = (await req.json()) as AnalyzeRequest;
  } catch {
    return Response.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }
  const invalid = validate(body);
  if (invalid) return Response.json({ error: invalid }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        // "Analyse fortsetzen": liegt die Gemini-Beobachtung aus einem
        // früheren Versuch schon vor, wird die Video-Stufe übersprungen —
        // spart die (teuren) Video-Token beim Retry.
        let observation;
        let geminiModel: string;
        if (body.observation) {
          observation = body.observation;
          geminiModel = body.observationModel || "wiederverwendet";
        } else {
          send({ type: "stage", stage: "gemini" });
          const result = await observeVideo({
            source: body.source,
            fighter: body.fighter,
            tier: body.tier,
            mode: body.mode,
          });
          observation = result.observation;
          geminiModel = result.model;
          // Beobachtung sofort an den Client geben — falls die Claude-Stufe
          // oder die Verbindung scheitert, kann ohne Gemini fortgesetzt werden.
          send({ type: "observation", observation, model: geminiModel });
        }

        // Zwei-Phasen-Betrieb: Stufe 1 und Stufe 2 laufen als getrennte
        // Requests, damit jede ihr eigenes 300-s-Zeitbudget bekommt.
        // (Stream wird im finally geschlossen.)
        if (body.observeOnly) return;

        send({ type: "stage", stage: "claude" });
        // Fortschritt gedrosselt melden (alle 250 Zeichen) — sonst würde jeder
        // Token eine NDJSON-Zeile erzeugen.
        let lastReported = 0;
        const { evaluation, model: claudeModel, usage } = await evaluateObservation({
          mode: body.mode,
          fighter: body.fighter,
          tier: body.tier,
          observation,
          existingDna: body.existingDna ?? {},
          existingSplit: body.existingSplit ?? null,
          existingStats: body.existingStats ?? [],
          profileContext: body.profileContext ?? "",
          recency: body.recency ?? "unknown",
          onProgress: (chars) => {
            if (chars - lastReported < 250) return;
            lastReported = chars;
            send({ type: "progress", chars });
          },
        });

        send({ type: "stage", stage: "done" });
        send({
          type: "result",
          observation,
          evaluation,
          models: { gemini: geminiModel, claude: claudeModel },
          usage,
        });

        // Hochgeladenes Video nach erfolgreicher Analyse sofort bei Google
        // löschen (bei Fehlern bleibt es für einen Retry — Google räumt nach
        // 48 h ohnehin automatisch auf). YouTube-Quellen: nichts zu löschen.
        if (body.source.kind === "upload") {
          const match = /files\/[A-Za-z0-9._-]+$/.exec(body.source.fileUri);
          if (match) await deleteFile(match[0]);
        }
      } catch (err) {
        send({
          type: "error",
          message:
            err instanceof Error ? err.message : "Analyse fehlgeschlagen",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
