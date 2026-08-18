/**
 * Gemini-Stufe (Stufe 1) der Video-Analyse — das „Auge" der Pipeline.
 *
 * Aufgaben:
 *   • Video-Upload zur Gemini-Files-API (resumable, bis ~2 GB)
 *   • Video-Beobachtung: Abschnitte A (Metadaten/Identifikation) + B (Zahlen)
 *     aus docs/gegner-dna-video-analyse-fragenkatalog.md als striktes JSON
 *
 * Reine REST-Aufrufe via fetch — kein SDK nötig. Der API-Key kommt aus
 * GEMINI_API_KEY (.env.local, niemals NEXT_PUBLIC_*).
 */

import { ACTION_CATALOG } from "../fight-stats";
import type {
  FighterDescription,
  GeminiTier,
  VideoObservation,
  VideoSource,
} from "../video-analysis";
import { CORNER_LABEL } from "../video-analysis";

const BASE = "https://generativelanguage.googleapis.com";

// "-latest"-Aliase zeigen immer auf die aktuelle Modellgeneration — Google
// schaltet ältere IDs (z. B. gemini-2.5-*) für neue API-Keys ab.
// Hinweis: "pro" benötigt einen kostenpflichtigen Gemini-Tarif (Free Tier: Limit 0).
export const GEMINI_MODELS: Record<GeminiTier, string> = {
  flash: process.env.GEMINI_MODEL_FLASH || "gemini-flash-latest",
  pro: process.env.GEMINI_MODEL_PRO || "gemini-pro-latest",
};

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY fehlt — bitte in Tidal-Athletics-App/.env.local eintragen.",
    );
  }
  return key;
}

// ─── Files API: Resumable Upload ────────────────────────────────────────────

export interface GeminiFile {
  uri: string;
  name: string;
  mimeType: string;
  state: string;
}

/**
 * Lädt ein Video per Resumable-Upload zur Gemini-Files-API und wartet, bis
 * die serverseitige Verarbeitung abgeschlossen ist (state=ACTIVE).
 */
export async function uploadVideoToGemini(
  body: ReadableStream<Uint8Array> | ArrayBuffer,
  sizeBytes: number,
  mimeType: string,
  displayName: string,
): Promise<GeminiFile> {
  // 1. Upload-Session starten
  const startRes = await fetch(`${BASE}/upload/v1beta/files?key=${apiKey()}`, {
    method: "POST",
    headers: {
      "x-goog-upload-protocol": "resumable",
      "x-goog-upload-command": "start",
      "x-goog-upload-header-content-length": String(sizeBytes),
      "x-goog-upload-header-content-type": mimeType,
      "content-type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  });
  if (!startRes.ok) {
    throw new Error(`Gemini-Upload-Start fehlgeschlagen (${startRes.status})`);
  }
  const uploadUrl = startRes.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Gemini-Upload-URL fehlt in der Antwort");

  // 2. Bytes hochladen + finalisieren
  const uploadInit: RequestInit & { duplex?: "half" } = {
    method: "POST",
    headers: {
      "content-length": String(sizeBytes),
      "x-goog-upload-offset": "0",
      "x-goog-upload-command": "upload, finalize",
    },
    body,
  };
  if (body instanceof ReadableStream) uploadInit.duplex = "half";
  const uploadRes = await fetch(uploadUrl, uploadInit);
  if (!uploadRes.ok) {
    throw new Error(`Gemini-Upload fehlgeschlagen (${uploadRes.status})`);
  }
  const uploaded = (await uploadRes.json()) as { file: GeminiFile };
  let file = uploaded.file;

  // 3. Auf Verarbeitung warten (Video wird serverseitig aufbereitet)
  const deadline = Date.now() + 5 * 60_000;
  while (file.state === "PROCESSING" && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000));
    const poll = await fetch(`${BASE}/v1beta/${file.name}?key=${apiKey()}`);
    if (poll.ok) file = (await poll.json()) as GeminiFile;
  }
  if (file.state !== "ACTIVE") {
    throw new Error(
      `Gemini konnte das Video nicht verarbeiten (Status: ${file.state})`,
    );
  }
  return file;
}

// ─── Beobachtungs-Prompt (Abschnitte A + B) ─────────────────────────────────

function observationPrompt(
  fighter: FighterDescription,
  mode: "opponent" | "athlete",
): string {
  const catalog = ACTION_CATALOG.map((a) => `"${a.id}" (${a.label})`).join(", ");
  const role =
    mode === "opponent"
      ? "einen gegnerischen Kämpfer für das Scouting"
      : "unseren eigenen Athleten für die Leistungsanalyse";
  return `Du bist ein professioneller Kampfsport-Videoanalyst (MMA, K1, Boxen, Grappling).
Analysiere in diesem Video ${role}.

ZIELKÄMPFER (nur dieser eine Kämpfer wird ausgewertet):
- Name: ${fighter.name}
- Ecke: ${CORNER_LABEL[fighter.corner]}
- Kleidung: ${fighter.clothing || "keine Angabe"}
- Merkmale: ${fighter.features || "keine Angabe"}
- Startposition: ${fighter.startPosition || "keine Angabe"}

Identifiziere zuerst eindeutig den Zielkämpfer und halte fest, woran du ihn
erkennst (identification: Beschreibung, idConfidence 0-1, evidence = 2-4
Timestamps, an denen er klar zu sehen ist). Alle folgenden Zählungen und
Beobachtungen beziehen sich AUSSCHLIESSLICH auf diesen Kämpfer.

REGELN:
1. Kein Raten: Was im Video nicht beobachtbar ist, bleibt null bzw. leer.
2. Zähle sorgfältig: Gehe das Video chronologisch durch. attempted = Versuche,
   landed = klare Treffer/erfolgreiche Aktionen.
3. Timestamps immer im Format "mm:ss".
4. Für Techniken NUR diese Katalog-IDs verwenden: ${catalog}.
   Techniken außerhalb des Katalogs: id "other" + otherLabel (z. B. "Spinning Back Kick").
5. damage pro Technik: 0 = wirkungslos, 1 = spürbar, 2 = deutliche Wirkung,
   3 = Wackler/Cut/Knockdown.
6. dnaSplit: prozentuale Verteilung der Kampfzeit dieses Kampfes auf
   boxing/kicking/wrestling/ground/clinch (Summe ~100).
7. Zonen: "center" (Mitte), "open" (offener Raum), "cage" (am Käfig/Seil).
8. Antworte auf Deutsch in den Freitextfeldern.

Gib AUSSCHLIESSLICH ein JSON-Objekt mit exakt dieser Struktur zurück
(keine Kommentare, kein Markdown):

{
  "identification": { "description": string, "idConfidence": number, "evidence": string[] },
  "meta": {
    "ruleset": string|null, "rounds": number|null, "roundLengthMinutes": number|null,
    "weightClass": string|null, "result": string|null, "opponentLevel": string|null,
    "coverage": string|null, "videoQuality": string|null, "estimatedAge": string|null,
    "representativeness": number|null
  },
  "actions": [{ "id": string, "otherLabel": string|null, "attempted": number, "landed": number,
                "zone": "center"|"open"|"cage"|null, "setup": string|null,
                "damage": number|null, "timestamps": string[] }],
  "dnaSplit": { "boxing": number, "kicking": number, "wrestling": number,
                "ground": number, "clinch": number } | null,
  "combos": [{ "sequence": string[], "count": number, "landedFully": number,
               "zone": "center"|"open"|"cage"|null, "openingAfter": string|null }],
  "defense": {
    "takedownsDefended": number|null, "takedownsAgainst": number|null,
    "strikesAvoided": number|null, "strikesAgainst": number|null,
    "hitLocations": { "head": number, "body": number, "legs": number } | null,
    "knockdownsReceived": number|null,
    "rockedMoments": [{ "timestamp": string, "note": string }]
  },
  "controlTime": { "clinchSeconds": number|null, "topSeconds": number|null,
                   "bottomSeconds": number|null, "cagePressureSeconds": number|null,
                   "pressedSeconds": number|null } | null,
  "movement": { "stance": string|null, "stanceSwitches": string|null,
                "forwardPct": number|null, "backwardPct": number|null,
                "lateralPct": number|null, "centerControlPct": number|null } | null,
  "rounds": [{ "round": number, "outputPerMin": number|null, "hitRate": number|null,
               "strategy": string|null, "fatigueSigns": string|null }],
  "notes": string|null
}

Zu "meta": ruleset = MMA/K1/Boxen/Grappling/…, result = Ausgang aus Sicht des
Zielkämpfers (z. B. "Sieg durch KO, Runde 2"), opponentLevel = Einschätzung des
damaligen Gegners, coverage = wie viel des Kampfes analysierbar ist
(Vollkampf/Highlight/Schnitt), representativeness = 0-1 wie repräsentativ das
Material wirkt. Zu "notes": Auffälligkeiten wie Fouls (Fence Grabs, Eye Pokes),
Reaktion auf Corner-Anweisungen, Besonderheiten.`;
}

// ─── Beobachtung ausführen ──────────────────────────────────────────────────

type GeminiPart = {
  text?: string;
  fileData?: { fileUri: string; mimeType?: string };
  videoMetadata?: { startOffset?: string; endOffset?: string };
};

function sourceParts(source: VideoSource): GeminiPart[] {
  if (source.kind === "upload") {
    return [{ fileData: { fileUri: source.fileUri, mimeType: source.mimeType } }];
  }
  const part: GeminiPart = { fileData: { fileUri: source.url } };
  const metadata: { startOffset?: string; endOffset?: string } = {};
  if (source.startSeconds != null && source.startSeconds > 0)
    metadata.startOffset = `${Math.floor(source.startSeconds)}s`;
  if (source.endSeconds != null && source.endSeconds > 0)
    metadata.endOffset = `${Math.floor(source.endSeconds)}s`;
  if (metadata.startOffset || metadata.endOffset) part.videoMetadata = metadata;
  return [part];
}

/** Entfernt ggf. Markdown-Zäune und parst das JSON der Modell-Antwort. */
export function parseModelJson<T>(raw: string): T {
  let text = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/m.exec(text);
  if (fence) text = fence[1];
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  return JSON.parse(text) as T;
}

/** Defensive Normalisierung — fehlende Felder werden null/leer aufgefüllt. */
function normalizeObservation(o: Partial<VideoObservation>): VideoObservation {
  return {
    identification: {
      description: o.identification?.description ?? "",
      idConfidence: Number(o.identification?.idConfidence ?? 0),
      evidence: o.identification?.evidence ?? [],
    },
    meta: {
      ruleset: o.meta?.ruleset ?? null,
      rounds: o.meta?.rounds ?? null,
      roundLengthMinutes: o.meta?.roundLengthMinutes ?? null,
      weightClass: o.meta?.weightClass ?? null,
      result: o.meta?.result ?? null,
      opponentLevel: o.meta?.opponentLevel ?? null,
      coverage: o.meta?.coverage ?? null,
      videoQuality: o.meta?.videoQuality ?? null,
      estimatedAge: o.meta?.estimatedAge ?? null,
      representativeness: o.meta?.representativeness ?? null,
    },
    actions: (o.actions ?? []).map((a) => ({
      id: a.id,
      otherLabel: a.otherLabel ?? null,
      attempted: Math.max(0, Math.round(Number(a.attempted) || 0)),
      landed: Math.max(0, Math.round(Number(a.landed) || 0)),
      zone: a.zone ?? null,
      setup: a.setup ?? null,
      damage: a.damage ?? null,
      timestamps: a.timestamps ?? [],
    })),
    dnaSplit: o.dnaSplit ?? null,
    combos: (o.combos ?? []).map((c) => ({
      sequence: c.sequence ?? [],
      count: Number(c.count) || 0,
      landedFully: Number(c.landedFully) || 0,
      zone: c.zone ?? null,
      openingAfter: c.openingAfter ?? null,
    })),
    defense: {
      takedownsDefended: o.defense?.takedownsDefended ?? null,
      takedownsAgainst: o.defense?.takedownsAgainst ?? null,
      strikesAvoided: o.defense?.strikesAvoided ?? null,
      strikesAgainst: o.defense?.strikesAgainst ?? null,
      hitLocations: o.defense?.hitLocations ?? null,
      knockdownsReceived: o.defense?.knockdownsReceived ?? null,
      rockedMoments: o.defense?.rockedMoments ?? [],
    },
    controlTime: o.controlTime ?? null,
    movement: o.movement ?? null,
    rounds: o.rounds ?? [],
    notes: o.notes ?? null,
  };
}

/**
 * Reiner Text→JSON-Aufruf (ohne Video) — wird von der Bewertungsstufe als
 * kostenloser Fallback genutzt, solange kein ANTHROPIC_API_KEY gesetzt ist.
 */
export async function geminiGenerateJson(
  model: string,
  prompt: string,
): Promise<string> {
  const res = await fetch(
    `${BASE}/v1beta/models/${model}:generateContent?key=${apiKey()}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 32768,
          temperature: 0.3,
        },
      }),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Gemini-Bewertung fehlgeschlagen (${res.status}): ${detail.slice(0, 300)}`,
    );
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("");
  if (!text.trim()) throw new Error("Gemini-Bewertung lieferte kein Ergebnis");
  return text;
}

/**
 * Führt die Gemini-Beobachtung aus (Stufe 1) und liefert die rohen
 * Beobachtungen (Abschnitte A + B) als normalisiertes Objekt.
 */
export async function observeVideo(args: {
  source: VideoSource;
  fighter: FighterDescription;
  tier: GeminiTier;
  mode: "opponent" | "athlete";
}): Promise<{ observation: VideoObservation; model: string }> {
  const model = GEMINI_MODELS[args.tier];
  const res = await fetch(
    `${BASE}/v1beta/models/${model}:generateContent?key=${apiKey()}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              ...sourceParts(args.source),
              { text: observationPrompt(args.fighter, args.mode) },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 32768,
          temperature: 0.2,
        },
      }),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Gemini-Analyse fehlgeschlagen (${res.status}): ${detail.slice(0, 300)}`,
    );
  }
  const data = (await res.json()) as {
    candidates?: {
      content?: { parts?: { text?: string }[] };
      finishReason?: string;
    }[];
  };
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("");
  if (!text.trim()) {
    const reason = data.candidates?.[0]?.finishReason ?? "leere Antwort";
    throw new Error(`Gemini lieferte kein Ergebnis (${reason})`);
  }
  const parsed = parseModelJson<Partial<VideoObservation>>(text);
  return { observation: normalizeObservation(parsed), model };
}
