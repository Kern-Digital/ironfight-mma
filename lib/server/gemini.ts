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

import { ACTION_CATALOG, ACTION_GROUPS, type ActionGroup } from "../fight-stats";
import {
  STECKBRIEFE,
  flaecheFromText,
  isFlaeche,
  isVariante,
  type Flaeche,
  type Variante,
} from "../kampfart-steckbrief";
import type {
  CornerColor,
  FighterBox,
  FighterDescription,
  GeminiTier,
  PreviewFighter,
  Sport,
  VideoObservation,
  VideoPreview,
  VideoSource,
  VideoType,
} from "../video-analysis";
import { CORNER_LABEL, boxFromGemini, isSport, sportFromText } from "../video-analysis";

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
 * Startet eine Resumable-Upload-Session bei der Gemini-Files-API und liefert
 * die Upload-URL. Der Client lädt die Bytes DIREKT zu Google hoch — so wird
 * Vercels 4,5-MB-Request-Limit umgangen. Wichtig: Der API-Key wird per Header
 * übergeben, damit die zurückgegebene Upload-URL KEINEN Key enthält
 * (verifiziert: nur upload_id-Parameter) und gefahrlos an den Client gehen kann.
 */
export async function startUploadSession(
  sizeBytes: number,
  mimeType: string,
  displayName: string,
): Promise<string> {
  const startRes = await fetch(`${BASE}/upload/v1beta/files`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey(),
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
  if (uploadUrl.includes("key=")) {
    // Sicherheitsnetz: niemals eine URL mit eingebettetem Key herausgeben.
    throw new Error("Upload-URL enthält unerwartet einen API-Key — Abbruch.");
  }
  return uploadUrl;
}

/** Liest den Verarbeitungs-Status einer hochgeladenen Datei (files/...). */
export async function getFileState(name: string): Promise<GeminiFile> {
  const res = await fetch(`${BASE}/v1beta/${name}`, {
    headers: { "x-goog-api-key": apiKey() },
  });
  if (!res.ok) {
    throw new Error(`Gemini-Datei-Status fehlgeschlagen (${res.status})`);
  }
  return (await res.json()) as GeminiFile;
}

/**
 * Löscht eine hochgeladene Datei (files/...) sofort — sonst räumt Google sie
 * automatisch nach 48 h ab. Fehler werden bewusst geschluckt: das Löschen
 * darf eine fertige Analyse nie scheitern lassen.
 */
export async function deleteFile(name: string): Promise<void> {
  try {
    await fetch(`${BASE}/v1beta/${name}`, {
      method: "DELETE",
      headers: { "x-goog-api-key": apiKey() },
    });
  } catch {
    /* Auto-Expiry (48 h) greift als Fallback */
  }
}

/**
 * Findet eine frisch hochgeladene Datei über ihren (einmaligen) display_name.
 * Nötig, weil Googles Upload-Endpoint die finale Antwort ohne CORS-Header
 * schickt — der Browser kann sie nicht lesen, der Server schlägt die Datei
 * deshalb hier nach.
 */
export async function findFileByDisplayName(
  displayName: string,
): Promise<GeminiFile | null> {
  const res = await fetch(`${BASE}/v1beta/files?pageSize=100`, {
    headers: { "x-goog-api-key": apiKey() },
  });
  if (!res.ok) {
    throw new Error(`Gemini-Datei-Liste fehlgeschlagen (${res.status})`);
  }
  const data = (await res.json()) as {
    files?: (GeminiFile & { displayName?: string })[];
  };
  return data.files?.find((f) => f.displayName === displayName) ?? null;
}

// ─── Beobachtungs-Prompt (Abschnitte A + B) ─────────────────────────────────

/**
 * Die Gruppen-Regeln des Katalogs (docs/kampfart-steckbriefe.md 4.1, 8.1).
 * KEINE Kampfart: Die Beobachtung sieht, was passiert; welche Technik in
 * welcher Kampfart zählt, filtert der Server danach (lib/kampfart-steckbrief.ts).
 * Gemessen im Versuch „Ereignisliste" 17.09. (zwei MMA-Sparrings mit viel
 * Kickboxen, niemand geht zu Boden): Die Phantom-Takedowns kamen aus dem
 * MMA-lastigen Schema, und ein Ducken bei 31 s („stresstest 1.mp4") las
 * Gemini in 4 von 4 Läufen als Kick — daher die Abwehr-Regel.
 */
const GRUPPEN_REGEL: Record<ActionGroup, string> = {
  strike: "SCHLÄGE aus der Distanz (ohne Griff)",
  kick: "TRITTE UND KNIE aus der Distanz (ohne Griff). Ein Tritt braucht das gestreckte Bein Richtung Ziel — ein angehobenes Knie allein ist kein Tritt",
  clinch: "IM STEHENDEN GRIFFKONTAKT. Knie und Schläge bei gehaltenem Griff zählen HIER, nicht bei Schlägen oder Tritten. Fegen oder Umwerfen, nach dem KEIN Bodenkampf folgt, ist sweep-dump",
  takedown: "TAKEDOWNS UND WÜRFE, Stand → Boden. Eine Umklammerung im Stand ist eine Phase (controlTime.clinchSeconds), KEIN Takedown-Versuch. landed nur, wenn der Gegner danach WIRKLICH am Boden liegt. Folgt Bodenkampf, ist ein Fegen trip, kein sweep-dump. throw nur, wenn die Wurfart nicht erkennbar ist",
  ground: "BODENKAMPF. submission nur, wenn die Art des Aufgabegriffs nicht erkennbar ist",
  submission: "AUFGABEGRIFFE. versucht nur mit sichtbarer Abwehrreaktion des Gegners — ein Griff ohne Reaktion ist Kontrolle, kein Versuch",
};

/** Katalogtext: alle 37 IDs mit Gruppen-Regel und sichtbarer Definition. */
function katalogText(): string {
  return ACTION_GROUPS.map((g) => {
    const zeilen = ACTION_CATALOG.filter((a) => a.group === g).map(
      (a) => `     - "${a.id}" (${a.label}): versucht = ${a.versucht}; gelungen = ${a.gelungen}`,
    );
    return `   ${GRUPPEN_REGEL[g]}:\n${zeilen.join("\n")}`;
  }).join("\n");
}

function observationPrompt(
  fighter: FighterDescription,
  mode: "opponent" | "athlete",
): string {
  const role =
    mode === "opponent"
      ? "einen gegnerischen Kämpfer für das Scouting"
      : "unseren eigenen Athleten für die Leistungsanalyse";
  return `Du bist ein professioneller Kampfsport-Videoanalyst (Boxen, Kickboxen, Muay Thai, MMA, Ringen, Judo, Sambo, BJJ).
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
4. Für Techniken NUR diese Katalog-IDs verwenden, je Gruppe mit ihrer Regel.
   "versucht" und "gelungen" beschreiben, was im Bild zu sehen sein muss:
${katalogText()}
   Techniken außerhalb des Katalogs: id "other" + otherLabel.
5. ABWEHR IST KEINE AKTION: Ducken, Abtauchen, Slip, Roll, Pendeln, Sprawl,
   Beinblock und Bein hochnehmen sind Abwehr des Angegriffenen. Sie erzeugen
   NIE einen Eintrag in actions — sie gehören zu defense.
6. damage pro Technik: 0 = wirkungslos, 1 = spürbar, 2 = deutliche Wirkung,
   3 = Wackler/Cut/Knockdown. Bei Würfen statt Wirkung der Landungsgrad:
   1 = Bauch, Knie oder Gesäß, 2 = Seite, 3 = Rücken.
7. dnaSplit: Anteil der KAMPFZEIT je Phase (Summe ~100, Pausen und
   Unterbrechungen zählen nicht): boxing = Distanz, Hände · kicking = Distanz,
   Beine · clinch = beide stehen im Griffkontakt ohne laufenden Wurfansatz ·
   wrestling = Takedown- oder Wurfaktion und Scramble am Übergang zum Boden ·
   ground = mindestens einer am Boden und der andere im Kontakt.
8. Zonen: "center" (Mitte der Kampffläche), "open" (freier Raum dazwischen),
   "cage" (am Rand mit Kontakt oder Druck: Käfig, Seile oder Mattenrand).
9. Antworte auf Deutsch in den Freitextfeldern.

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

Zu "meta": ruleset = Regelwerk, wie du es siehst (Boxen, Kickboxen, Muay Thai, MMA, Ringen, Judo, Sambo, BJJ, Sparring …), result = Ausgang aus Sicht des
Zielkämpfers (z. B. "Sieg durch KO, Runde 2"), opponentLevel = Einschätzung des
damaligen Gegners, coverage = wie viel des Kampfes analysierbar ist
(Vollkampf/Highlight/Schnitt), representativeness = 0-1 wie repräsentativ das
Material wirkt. Zu "notes": Auffälligkeiten wie Fouls (Fence Grabs, Eye Pokes),
Reaktion auf Corner-Anweisungen, Besonderheiten.`;
}

// ─── Beobachtung ausführen ──────────────────────────────────────────────────

type GeminiPart = {
  inlineData?: { mimeType: string; data: string };
  text?: string;
  fileData?: { fileUri: string; mimeType?: string };
  videoMetadata?: { startOffset?: string; endOffset?: string; fps?: number };
};

/**
 * Bilder je Sekunde für die Beobachtung (Leon 17.09.2026). Ohne Angabe liest
 * Gemini nur 1 Bild/s — ein Jab (0,2–0,4 s) fällt dann durch. Gemessen an
 * zwei Handyvideos und einem UFC-Kampf: 1 Bild/s verliert die Hälfte der
 * Aktionen und ordnet Kicks falsch zu; 10 Bilder/s ist nicht besser, kostet
 * aber doppelt. Kosten: ~354 statt ~91 Video-Tokens je Sekunde.
 * Rohdaten: D:\Tidal-Athletics\tmp\versuch-ereignisliste-2026-09-17\
 */
const BEOBACHTUNG_FPS = 5;

function sourceParts(source: VideoSource): GeminiPart[] {
  if (source.kind === "upload") {
    return [
      {
        fileData: { fileUri: source.fileUri, mimeType: source.mimeType },
        videoMetadata: { fps: BEOBACHTUNG_FPS },
      },
    ];
  }
  const part: GeminiPart = { fileData: { fileUri: source.url } };
  const metadata: { startOffset?: string; endOffset?: string; fps: number } = { fps: BEOBACHTUNG_FPS };
  if (source.startSeconds != null && source.startSeconds > 0)
    metadata.startOffset = `${Math.floor(source.startSeconds)}s`;
  if (source.endSeconds != null && source.endSeconds > 0)
    metadata.endOffset = `${Math.floor(source.endSeconds)}s`;
  part.videoMetadata = metadata;
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

// ─── Robuste generateContent-Aufrufe (Retry + Modell-Kette) ─────────────────
//
// Free-Tier-Realität: "-latest"-Modelle sind unter Last öfter 503 (high
// demand), und 429-Quotas gelten PRO Modell. Deshalb: pro Stufe eine Kette
// von Modellen; 503/500 wird je Modell einmal wiederholt, bei 429 wird das
// nächste Modell der Kette probiert (eigenes Kontingent).

const FLASH_CHAIN = [
  GEMINI_MODELS.flash,
  "gemini-3.6-flash",
  "gemini-3.5-flash",
];
const PRO_CHAIN = [GEMINI_MODELS.pro, "gemini-3.1-pro-preview"];

class GeminiHttpError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(`Gemini HTTP ${status}: ${detail.slice(0, 200)}`);
  }
}

/**
 * Ein einzelner generateContent-Aufruf; liefert den Text der Antwort.
 *
 * `timeoutMs` (Etappe 2): Ein überlastetes Modell meldet nicht immer sofort
 * 503 — gemessen am 16.09.2026 hing `gemini-flash-latest` bis zu Googles
 * eigenem Limit (~300 s), bevor die Kette weiterging; der Vorlauf brauchte
 * damit fünf Minuten für zwei Minuten Video. Mit Zeitlimit gilt ein hängender
 * Aufruf als 504 und die Kette nimmt das nächste Modell.
 */
async function generateContentOnce(
  model: string,
  body: Record<string, unknown>,
  timeoutMs?: number,
): Promise<string> {
  const ctrl = timeoutMs ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  let res: Response;
  try {
    res = await fetch(`${BASE}/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey(), "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl?.signal,
    });
  } catch (err) {
    if (ctrl?.signal.aborted) {
      throw new GeminiHttpError(504, `Zeitlimit ${Math.round((timeoutMs ?? 0) / 1000)} s überschritten`);
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new GeminiHttpError(res.status, detail);
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
    throw new GeminiHttpError(502, `kein Ergebnis (${reason})`);
  }
  return text;
}

/**
 * generateContent mit Modell-Kette: 503/500/502 → kurzer Retry, dann nächstes
 * Modell; 429 → direkt nächstes Modell (eigene Quota). Liefert Text + Modell.
 */
async function generateContentResilient(
  chain: string[],
  body: Record<string, unknown>,
  timeoutMs?: number,
): Promise<{ text: string; model: string }> {
  let lastError: unknown = null;
  for (const model of chain) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return { text: await generateContentOnce(model, body, timeoutMs), model };
      } catch (err) {
        lastError = err;
        if (err instanceof GeminiHttpError) {
          if (err.status === 429) break; // Quota dieses Modells leer → nächstes
          if (err.status === 504) break; // hängt → nicht noch einmal warten, nächstes
          if (err.status >= 500) {
            await new Promise((r) => setTimeout(r, 4000));
            continue; // einmal wiederholen, dann nächstes Modell
          }
        }
        throw err; // echte 4xx-Fehler nicht maskieren
      }
    }
  }
  if (lastError instanceof GeminiHttpError && lastError.status === 429) {
    throw new Error(
      chain === PRO_CHAIN
        ? "Die Detail-Analyse (Gemini Pro) ist im kostenlosen Google-Tarif nicht enthalten. Bitte die Stufe Standard wählen — oder in Google AI Studio einen Bezahltarif aktivieren."
        : "Gemini-Kontingent vorübergehend erschöpft (Free-Tier-Limit). Bitte 1–2 Minuten warten und erneut versuchen — oder einen kürzeren Ausschnitt wählen.",
    );
  }
  throw new Error(
    "Die Gemini-Modelle sind gerade überlastet (hohe Nachfrage bei Google). Bitte in 1–2 Minuten erneut versuchen.",
  );
}

/**
 * Reiner Text→JSON-Aufruf (ohne Video) — wird von der Bewertungsstufe als
 * kostenloser Fallback genutzt, solange kein ANTHROPIC_API_KEY gesetzt ist.
 */
export async function geminiGenerateJson(
  _model: string,
  prompt: string,
): Promise<string> {
  const { text } = await generateContentResilient(FLASH_CHAIN, {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 32768,
      temperature: 0.3,
    },
  });
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
  const chain = args.tier === "pro" ? PRO_CHAIN : FLASH_CHAIN;
  const { text, model } = await generateContentResilient(chain, {
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
  });
  const parsed = parseModelJson<Partial<VideoObservation>>(text);
  return { observation: normalizeObservation(parsed), model };
}

// ─── Der Vorlauf (Etappe 2, 16.09.2026) ─────────────────────────────────────

/** Wie viel vom Video der Vorlauf sieht. */
export const PREVIEW_SECONDS = 120;
/**
 * Zeitlimit je Modell für den Vorlauf. Zwei Minuten Video in niedriger
 * Auflösung brauchen Sekunden, nicht Minuten — was länger hängt, ist
 * überlastet. Drei Modelle × 40 s bleiben unter dem 120-s-Budget der Route.
 */
const PREVIEW_TIMEOUT_MS = 40_000;

/**
 * Nur die ersten zwei Minuten — bei YouTube ab dem gewählten Start. Ein
 * Ende, das der Nutzer enger gesetzt hat, bleibt enger.
 */
function previewParts(source: VideoSource): GeminiPart[] {
  if (source.kind === "upload") {
    return [
      {
        fileData: { fileUri: source.fileUri, mimeType: source.mimeType },
        videoMetadata: { endOffset: `${PREVIEW_SECONDS}s` },
      },
    ];
  }
  const start = Math.max(0, Math.floor(source.startSeconds ?? 0));
  const endeGewuenscht =
    source.endSeconds != null && source.endSeconds > start
      ? Math.floor(source.endSeconds)
      : Infinity;
  const end = Math.min(start + PREVIEW_SECONDS, endeGewuenscht);
  const metadata: { startOffset?: string; endOffset: string } = { endOffset: `${end}s` };
  if (start > 0) metadata.startOffset = `${start}s`;
  return [{ fileData: { fileUri: source.url }, videoMetadata: metadata }];
}

const PREVIEW_PROMPT = `Du bist ein professioneller Kampfsport-Videoanalyst (MMA, K1, Boxen, Grappling, Sambo, Judo).
Du siehst die ERSTEN ZWEI MINUTEN eines Videos. Deine Aufgabe: die Hauptkämpfer finden und das Video einordnen.

REGELN:
1. Kein Raten: Was nicht sichtbar ist, bleibt null bzw. leer.
2. fighters = die Hauptpersonen, höchstens zwei: bei einem Kampf oder Sparring die zwei Kämpfer (bei Training das Paar, das am längsten im Bild ist); bei einem Einzeltraining, Drill oder Schattenboxen die EINE Person. Leer nur, wenn niemand kämpft oder trainiert. Je Kämpfer:
   corner = Ecke, falls erkennbar ("red"/"blue"), sonst "unknown";
   clothing = Hose, Rashguard, Jacke, Handschuhe MIT Farben;
   features = Tattoos, Haare, Statur, Größe im Vergleich;
   description = EIN Satz, an dem ein Trainer ihn sofort wiedererkennt;
   bestSecond = Sekunde ab Videostart (0–120), in der er frei und gut zu sehen ist. Gib sie IMMER an, sobald er irgendwo im Bild ist.
3. videoType: "full" = ganzer Wettkampf mit Ringrichter oder Anzeige, "excerpt" = Teil eines Wettkampfs, "sparring" = Training oder Sparring ohne Wettkampfrahmen, "highlight" = Zusammenschnitt aus Treffern.
4. sport nach Regeln und Ausrüstung: Käfig oder MMA-Handschuhe → "mma"; Jacke (Kurtka) MIT Schlägen oder Tritten (Kampf-Sambo) → "mma"; nur Fäuste mit Boxhandschuhen → "boxen"; Tritte oder Knie mit Handschuhen, kein Boden → "kickboxen"; Ringen ohne Jacke, keine Schläge → "ringen"; Jacke (Kurtka/Gi) mit Würfen und Standkampf, ohne Schläge → "sambo"; Bodenkampf und Aufgabegriffe ohne Schläge (mit oder ohne Gi) → "bjj"; unklar → null. sportSeen = was du siehst, in Worten.
5. variante NUR bei sport "kickboxen", sonst null: "muay-thai" oder "kickboxen". ${STECKBRIEFE.kickboxen.varianten?.erkennung ?? ""}
6. flaeche = worauf gekämpft wird, unabhängig von der Kampfart: "kaefig" = Käfig oder Zaun rund um die Kampffläche; "ring" = Ring mit Seilen; "matte" = Matten, Tatami oder Hallenboden ohne Käfig und ohne Ring (typisch für Training und Sparring im Gym); null = nicht erkennbar. Ein MMA-Sparring auf Matten ist "matte", nicht "kaefig".
7. fightMonth "JJJJ-MM" NUR bei sichtbarer Datumseinblendung, sonst null.
8. Antworte auf Deutsch in den Freitextfeldern.

Gib AUSSCHLIESSLICH ein JSON-Objekt mit exakt dieser Struktur zurück (keine Kommentare, kein Markdown):
{
  "fighters": [{ "corner": "red"|"blue"|"unknown", "clothing": string, "features": string, "description": string, "bestSecond": number|null }],
  "videoType": "full"|"excerpt"|"sparring"|"highlight",
  "sport": "mma"|"boxen"|"kickboxen"|"ringen"|"sambo"|"bjj"|null,
  "variante": "kickboxen"|"muay-thai"|null,
  "flaeche": "kaefig"|"ring"|"matte"|null,
  "sportSeen": string|null,
  "fightMonth": string|null
}`;

const VIDEO_TYPES: VideoType[] = ["full", "excerpt", "sparring", "highlight"];

function normalizePreview(
  p: Partial<{
    fighters: Partial<PreviewFighter>[];
    videoType: string;
    sport: string | null;
    variante: string | null;
    flaeche: string | null;
    sportSeen: string | null;
    fightMonth: string | null;
  }>,
  model: string,
): VideoPreview {
  const corner = (c: unknown): CornerColor =>
    c === "red" || c === "blue" ? c : "unknown";
  const text = (s: unknown) => (typeof s === "string" ? s.trim() : "");
  const fighters: PreviewFighter[] = (Array.isArray(p.fighters) ? p.fighters : [])
    .slice(0, 2)
    .map((f) => {
      const sek = Number(f?.bestSecond);
      return {
        corner: corner(f?.corner),
        clothing: text(f?.clothing),
        features: text(f?.features),
        description: text(f?.description),
        bestSecond:
          Number.isFinite(sek) && sek >= 0 && sek <= PREVIEW_SECONDS ? Math.floor(sek) : null,
      };
    });
  const videoType = (VIDEO_TYPES as string[]).includes(p.videoType ?? "")
    ? (p.videoType as VideoType)
    : "excerpt";
  // Kampf-Sambo läuft als MMA — auch wenn das Modell „sambo" sagt, aber
  // Schläge in Worten beschreibt (sportFromText erkennt „Kampf-Sambo").
  const ausText = sportFromText(p.sportSeen);
  const sport: Sport | null =
    ausText === "mma" && p.sport === "sambo" ? "mma" : isSport(p.sport) ? p.sport : ausText;
  // Die Variante gibt es nur bei Kickboxen; unklar → Kickboxen (der Trainer
  // sieht den Chip vorbelegt und tippt um).
  const variante: Variante | null =
    sport === "kickboxen" ? (isVariante(p.variante) ? p.variante : "kickboxen") : null;
  const fightMonth =
    typeof p.fightMonth === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(p.fightMonth)
      ? p.fightMonth
      : null;
  // Käfig nur, wenn einer zu sehen ist (Leon 17.09.2026) — sonst null und
  // neutrale Wörter. Nennt das Modell die Fläche nur in Worten, gilt der Text.
  const flaeche: Flaeche | null = isFlaeche(p.flaeche) ? p.flaeche : flaecheFromText(p.sportSeen);
  return { fighters, videoType, sport, variante, flaeche, fightMonth, model };
}

// ─── Kämpfer auf dem Standbild eingrenzen ────────────────────────────────────

const RAHMEN_TIMEOUT_MS = 30_000;

function rahmenPrompt(fighters: { description: string; clothing: string; features: string }[]): string {
  const liste = fighters
    .map((f, i) => {
      const teile = [f.description, f.clothing && `Kleidung: ${f.clothing}`, f.features && `Merkmale: ${f.features}`]
        .filter(Boolean)
        .join(" · ");
      return `${i + 1}. ${teile || "keine Beschreibung"}`;
    })
    .join("\n");
  return `Du siehst ein Standbild aus einem Kampfsport-Video. Finde die beschriebenen Personen:
${liste}

REGELN:
1. Jede Nummer ist eine ANDERE Person. Vergib nie dieselbe Person zweimal.
2. box_2d = Rahmen eng um den GANZEN Körper (Kopf bis Füße, ausgestreckte Arme und Beine eingeschlossen), als [ymin, xmin, ymax, xmax] auf 0–1000 normiert.
3. Findest du eine Person nicht sicher, gib für sie null zurück. Nicht raten.

Gib AUSSCHLIESSLICH dieses JSON zurück, in der Reihenfolge der Nummern:
{ "boxes": [ [ymin, xmin, ymax, xmax] | null, ... ] }`;
}

/**
 * Sucht die beschriebenen Kämpfer auf EINEM Standbild. Flash-Kette, niedrige
 * Temperatur; ein Bild in voller Auflösung braucht Sekunden.
 */
export async function locateFighters(
  imageBase64: string,
  fighters: { description: string; clothing: string; features: string }[],
): Promise<(FighterBox | null)[]> {
  const { text } = await generateContentResilient(
    FLASH_CHAIN,
    {
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
            { text: rahmenPrompt(fighters) },
          ],
        },
      ],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 1024, temperature: 0 },
    },
    RAHMEN_TIMEOUT_MS,
  );
  const roh = parseModelJson(text) as { boxes?: unknown[] };
  const boxes = Array.isArray(roh?.boxes) ? roh.boxes : [];
  return fighters.map((_, i) => boxFromGemini(boxes[i]));
}

/**
 * Der Vorlauf: Gemini Flash über die ersten zwei Minuten in NIEDRIGER
 * Auflösung — billig und schnell. Immer die Flash-Kette, unabhängig von der
 * Analyse-Stufe: Es geht ums Finden, nicht ums Zählen.
 */
export async function previewVideo(source: VideoSource): Promise<VideoPreview> {
  const { text, model } = await generateContentResilient(
    FLASH_CHAIN,
    {
      contents: [
        {
          role: "user",
          parts: [...previewParts(source), { text: PREVIEW_PROMPT }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 4096,
        temperature: 0.2,
        mediaResolution: "MEDIA_RESOLUTION_LOW",
      },
    },
    PREVIEW_TIMEOUT_MS,
  );
  return normalizePreview(parseModelJson(text), model);
}
