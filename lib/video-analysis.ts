/**
 * KI-Video-Analyse — Datenmodell + Client-Helfer (Konzept §6).
 *
 * Zweistufige Pipeline (Spezifikation: docs/gegner-dna-video-analyse-fragenkatalog.md):
 *   Stufe 1  Gemini  → rohe Beobachtungen aus dem Video (Abschnitte A + B)
 *   Stufe 2  Claude  → Bewertung/Analyse auf DNA-Kategorien gemappt (C + D + E)
 *
 * Ein Video = ein Analyse-Beitrag (VideoAnalysis), nie eine fertige DNA.
 * Befunde tragen confidence + evidence (Timestamps) + source und werden vom
 * Trainer per Review in die Gegner-DNA übernommen — nichts wird still
 * überschrieben (Konflikte werden geflaggt).
 *
 * Firestore:
 *   opponents/{opponentId}/videoAnalyses/{analysisId}   (mode = "opponent")
 *   users/{uid}/videoAnalyses/{analysisId}              (mode = "athlete")
 *
 * Die API-Keys (Gemini + Claude) leben ausschließlich serverseitig —
 * die Aufrufe laufen über /api/video-analysis/* (siehe lib/server/).
 */

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { getFirebaseAuth, getFirestoreDb } from "./firebase";
import type { ActionStat, CageZone, DnaSplit } from "./fight-stats";

// ─── Eingabe: Modus, Quelle, Kämpfer-Beschreibung ───────────────────────────

/** Gegner-Scouting (Gegner-DNA) oder Analyse des eigenen Athleten. */
export type AnalysisMode = "opponent" | "athlete";

/** Gemini-Modellstufe: Flash (Standard) oder Pro (Detail-Analyse). */
export type GeminiTier = "flash" | "pro";

/** Maximale analysierbare Videolänge in Sekunden (15 Minuten). */
export const MAX_VIDEO_SECONDS = 15 * 60;

export type CornerColor = "red" | "blue" | "unknown";

export const CORNER_LABEL: Record<CornerColor, string> = {
  red: "Rote Ecke",
  blue: "Blaue Ecke",
  unknown: "Unbekannt",
};

/** Beschreibung, welcher Kämpfer im Video ausgewertet werden soll (A1). */
export interface FighterDescription {
  /** Name — wird aus dem Profil übernommen. */
  name: string;
  corner: CornerColor;
  /** Hose/Rashguard-Farben, z. B. „schwarze Shorts mit weißem Logo". */
  clothing: string;
  /** Freitext-Merkmale: Tattoos, Haare, Statur … */
  features: string;
  /** Optional: wo steht er zu Beginn, z. B. „bei 0:00 links im Bild". */
  startPosition: string;
}

export type VideoSource =
  | {
      kind: "upload";
      /** Gemini-Files-API-URI (nach dem Upload über /api/video-analysis/upload). */
      fileUri: string;
      mimeType: string;
      fileName: string;
      durationSeconds: number | null;
    }
  | {
      kind: "youtube";
      url: string;
      /** Optionaler Ausschnitt (Sekunden). */
      startSeconds: number | null;
      endSeconds: number | null;
    };

// ─── Stufe 1: Gemini-Beobachtung (Abschnitte A + B) ─────────────────────────

/** Beobachtete Technik — Katalog-ID oder "other" mit Freitext-Label. */
export interface ObservedAction {
  /** ACTION_CATALOG-ID oder "other". */
  id: string;
  /** Nur bei id="other": Freitext, z. B. „Spinning Back Kick". */
  otherLabel: string | null;
  attempted: number;
  landed: number;
  zone: CageZone | null;
  setup: string | null;
  /** Wirkung 0–3 (0 = wirkungslos, 3 = Wackler/Cut/Knockdown). */
  damage: number | null;
  /** Belegstellen im Video (mm:ss). */
  timestamps: string[];
}

export interface ObservedCombo {
  sequence: string[];
  count: number;
  landedFully: number;
  zone: CageZone | null;
  /** Welche Lücke entsteht nach der Sequenz. */
  openingAfter: string | null;
}

export interface ObservedRound {
  round: number;
  /** Aktionen pro Minute (Output). */
  outputPerMin: number | null;
  /** Trefferquote 0–1. */
  hitRate: number | null;
  strategy: string | null;
  fatigueSigns: string | null;
}

/** Rohes Beobachtungs-Ergebnis der Gemini-Stufe. */
export interface VideoObservation {
  /** A1 — Identifikation des Zielkämpfers. */
  identification: {
    description: string;
    idConfidence: number;
    evidence: string[];
  };
  /** A2–A8 — Kampf-Metadaten & Gewichtung. */
  meta: {
    ruleset: string | null;
    rounds: number | null;
    roundLengthMinutes: number | null;
    weightClass: string | null;
    result: string | null;
    opponentLevel: string | null;
    coverage: string | null;
    videoQuality: string | null;
    estimatedAge: string | null;
    representativeness: number | null;
  };
  /** B1 — Technik-Zähler. */
  actions: ObservedAction[];
  /** B2 — Fight-DNA-Split dieses Kampfes. */
  dnaSplit: DnaSplit | null;
  /** B3 — Kombinations-Sequenzen. */
  combos: ObservedCombo[];
  /** B4 — Defensiv-Quoten. */
  defense: {
    takedownsDefended: number | null;
    takedownsAgainst: number | null;
    strikesAvoided: number | null;
    strikesAgainst: number | null;
    hitLocations: { head: number; body: number; legs: number } | null;
    knockdownsReceived: number | null;
    rockedMoments: { timestamp: string; note: string }[];
  };
  /** B5 — Kontroll- & Positionszeiten (Sekunden). */
  controlTime: {
    clinchSeconds: number | null;
    topSeconds: number | null;
    bottomSeconds: number | null;
    cagePressureSeconds: number | null;
    pressedSeconds: number | null;
  } | null;
  /** B6 — Stance & Bewegung. */
  movement: {
    stance: string | null;
    stanceSwitches: string | null;
    forwardPct: number | null;
    backwardPct: number | null;
    lateralPct: number | null;
    centerControlPct: number | null;
  } | null;
  /** B7 — Runden-Kurve (Cardio). */
  rounds: ObservedRound[];
  /** Freie Zusatzbeobachtungen (Fouls, Corner-Coaching …). */
  notes: string | null;
}

// ─── Stufe 2: Claude-Bewertung (Abschnitte C + D + E) ───────────────────────

/** Qualitativer Befund, gemappt auf eine DNA-Frage-ID (C). */
export interface DnaFinding {
  /** Frage-ID aus DNA_CATEGORIES (lib/gegner-dna.ts). */
  questionId: string;
  /** Kategorie-ID (real-habits, entry-patterns, …). */
  categoryId: string;
  answer: string;
  confidence: number;
  /** Timestamps / Beobachtungen als Beleg. */
  evidence: string[];
}

export interface TopListEntry {
  title: string;
  reason: string;
  confidence: number;
}

/** D2 — Scores 0–100 (null = nicht bewertbar). */
export interface EvaluationScores {
  aggression: number | null;
  cageControl: number | null;
  cardio: number | null;
  damage: number | null;
  durability: number | null;
  fightIq: number | null;
  predictability: number | null;
}

export interface ContradictionFlag {
  questionId: string;
  existing: string;
  observed: string;
}

/** Bewertungs-Ergebnis der Claude-Stufe. */
export interface VideoEvaluation {
  /** Kurze Gesamteinschätzung (2–4 Sätze). */
  summary: string;
  /** D1 — Stil-Klassifikation. */
  style: {
    primaryStyle: string | null;
    approach: string | null;
    baseDiscipline: string | null;
  };
  /** C — Befunde auf die 9 DNA-Kategorien gemappt. */
  findings: DnaFinding[];
  /** D2 — Scores. */
  scores: EvaluationScores;
  /** D3 — Top-Listen. */
  topWeapons: TopListEntry[];
  topPatterns: TopListEntry[];
  topWeaknesses: TopListEntry[];
  topDangers: TopListEntry[];
  /** D4 — Gefahren- & Finish-Profil. */
  dangerProfile: {
    mostDangerousWhen: string | null;
    finishes: string | null;
    vulnerableWhen: string | null;
  };
  /** Für die DNA aufbereitete Action-Stats (nur Katalog-IDs). */
  actionStats: ActionStat[];
  /** Für die DNA aufbereiteter Split. */
  dnaSplit: DnaSplit | null;
  /** E — Merge-Vorschlag gegen die bestehende DNA. */
  merge: {
    /** Frage-IDs, deren bestehende Antworten das Video bestätigt (E1). */
    confirms: string[];
    /** Widersprüche → Trainer-Review, kein stilles Überschreiben (E2). */
    contradicts: ContradictionFlag[];
    /** Gewichtung dieses Videos 0–1 (E5: Aktualität × Niveau × Abdeckung). */
    weight: number;
  };
}

// ─── Kosten-Tracking (Claude-Guthaben) ──────────────────────────────────────

/** Token-Verbrauch + geschätzte Kosten der Bewertungsstufe einer Analyse. */
export interface AnalysisUsage {
  inputTokens: number;
  outputTokens: number;
  /** Geschätzte Kosten in EUR (USD-Listenpreis ≈ 1:1 gerechnet). */
  costEur: number;
  model: string;
}

/** Start-Budget, falls noch keines gespeichert wurde (5 € aufgeladen). */
export const DEFAULT_AI_BUDGET_EUR = 5;

/**
 * Laufende Summe über ALLE Analysen (Gegner + Athleten), als einzelnes
 * Firestore-Dokument — so braucht die Anzeige keine Collection-Group-Query.
 * Gelöschte Analysen reduzieren die Summe bewusst nicht: ausgegebenes
 * Guthaben bleibt ausgegeben.
 */
export interface AiUsageSummary {
  budgetEur: number;
  spentEur: number;
  inputTokens: number;
  outputTokens: number;
  analysisCount: number;
}

function aiUsageDoc() {
  return doc(getFirestoreDb(), "aiUsage", "summary");
}

export async function getAiUsageSummary(): Promise<AiUsageSummary> {
  const snap = await getDoc(aiUsageDoc());
  const d = (snap.data() ?? {}) as Partial<AiUsageSummary>;
  return {
    budgetEur: d.budgetEur ?? DEFAULT_AI_BUDGET_EUR,
    spentEur: d.spentEur ?? 0,
    inputTokens: d.inputTokens ?? 0,
    outputTokens: d.outputTokens ?? 0,
    analysisCount: d.analysisCount ?? 0,
  };
}

/** Addiert den Verbrauch einer abgeschlossenen Analyse auf die Gesamtsumme. */
export async function recordAiUsage(usage: AnalysisUsage): Promise<void> {
  await setDoc(
    aiUsageDoc(),
    {
      spentEur: increment(usage.costEur),
      inputTokens: increment(usage.inputTokens),
      outputTokens: increment(usage.outputTokens),
      analysisCount: increment(1),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Setzt das Budget neu (z. B. nach dem Aufladen von Guthaben). */
export async function setAiBudget(budgetEur: number): Promise<void> {
  await setDoc(
    aiUsageDoc(),
    { budgetEur: Math.max(0, budgetEur), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

// ─── Gespeicherte Analyse ───────────────────────────────────────────────────

export interface VideoAnalysis {
  id: string;
  mode: AnalysisMode;
  /** opponentId (mode=opponent) bzw. Schüler-uid (mode=athlete). */
  targetId: string;
  targetName: string;
  /** Kurzlabel der Quelle für Listen (Dateiname bzw. YouTube-URL). */
  sourceLabel: string;
  sourceKind: "upload" | "youtube";
  youtubeUrl: string | null;
  fighter: FighterDescription;
  tier: GeminiTier;
  models: { gemini: string; claude: string };
  /** Token-Verbrauch + Kosten der Bewertungsstufe (null beim Gratis-Fallback). */
  usage: AnalysisUsage | null;
  observation: VideoObservation;
  evaluation: VideoEvaluation;
  /** Frage-IDs, deren Befunde bereits in die DNA übernommen wurden. */
  appliedFindingIds: string[];
  /** True, wenn Split + Action-Stats übernommen wurden. */
  appliedStats: boolean;
  createdBy: string;
  createdByName: string | null;
  createdAt: Date;
}

export type VideoAnalysisInput = Omit<VideoAnalysis, "id" | "createdAt">;

type VideoAnalysisDoc = Omit<VideoAnalysis, "id" | "createdAt"> & {
  createdAt?: Timestamp;
};

/** Schwelle: darunter gilt die Kämpfer-Identifikation als unsicher. */
export const ID_CONFIDENCE_WARN = 0.75;

// ─── Firestore-CRUD (Client) ────────────────────────────────────────────────

function analysesCol(mode: AnalysisMode, targetId: string) {
  const db = getFirestoreDb();
  return mode === "opponent"
    ? collection(db, "opponents", targetId, "videoAnalyses")
    : collection(db, "users", targetId, "videoAnalyses");
}

function decode(id: string, d: VideoAnalysisDoc): VideoAnalysis {
  return {
    ...d,
    id,
    usage: d.usage ?? null,
    appliedFindingIds: d.appliedFindingIds ?? [],
    appliedStats: d.appliedStats ?? false,
    createdAt: d.createdAt?.toDate() ?? new Date(),
  };
}

export async function saveVideoAnalysis(
  input: VideoAnalysisInput,
): Promise<VideoAnalysis> {
  const ref = doc(analysesCol(input.mode, input.targetId));
  // Firestore verträgt kein undefined — die Pipeline liefert bereits
  // null-befüllte Objekte, JSON-Roundtrip entfernt Rest-undefined defensiv.
  const body = JSON.parse(JSON.stringify(input)) as VideoAnalysisInput;
  await setDoc(ref, { ...body, createdAt: serverTimestamp() });
  return { ...body, id: ref.id, createdAt: new Date() };
}

export async function listVideoAnalyses(
  mode: AnalysisMode,
  targetId: string,
): Promise<VideoAnalysis[]> {
  const snap = await getDocs(
    query(analysesCol(mode, targetId), orderBy("createdAt", "desc")),
  );
  return snap.docs.map((d) => decode(d.id, d.data() as VideoAnalysisDoc));
}

export async function deleteVideoAnalysis(
  mode: AnalysisMode,
  targetId: string,
  analysisId: string,
): Promise<void> {
  await deleteDoc(doc(analysesCol(mode, targetId), analysisId));
}

/** Merkt sich, welche Befunde/Stats bereits in die DNA übernommen wurden. */
export async function markAnalysisApplied(
  mode: AnalysisMode,
  targetId: string,
  analysisId: string,
  patch: { appliedFindingIds?: string[]; appliedStats?: boolean },
): Promise<void> {
  await updateDoc(doc(analysesCol(mode, targetId), analysisId), patch);
}

// ─── Pipeline-Aufrufe (Client → API-Routen) ─────────────────────────────────

async function idToken(): Promise<string> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("Nicht angemeldet");
  return user.getIdToken();
}

/** Liest die Dauer einer Videodatei clientseitig aus (Metadaten). */
export function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(video.duration) ? video.duration : null);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    video.src = url;
  });
}

/**
 * Lädt eine Videodatei über die Server-Route zur Gemini-Files-API hoch.
 * Liefert die file_uri für den Analyse-Aufruf.
 */
export async function uploadVideoFile(
  file: File,
  onProgress?: (msg: string) => void,
): Promise<{ fileUri: string; mimeType: string }> {
  onProgress?.("Video wird hochgeladen …");
  const token = await idToken();
  const res = await fetch("/api/video-analysis/upload", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": file.type || "video/mp4",
      "x-file-name": encodeURIComponent(file.name),
      "x-file-size": String(file.size),
    },
    body: file,
  });
  const data = (await res.json()) as {
    fileUri?: string;
    mimeType?: string;
    error?: string;
  };
  if (!res.ok || !data.fileUri) {
    throw new Error(data.error || "Upload fehlgeschlagen");
  }
  return { fileUri: data.fileUri, mimeType: data.mimeType || file.type };
}

export type AnalysisStage = "gemini" | "claude" | "done";

export const STAGE_LABEL: Record<AnalysisStage, string> = {
  gemini: "Video wird analysiert (Beobachtung)",
  claude: "Befunde werden bewertet (Analyse)",
  done: "Fertig",
};

export interface AnalyzeRequest {
  mode: AnalysisMode;
  source: VideoSource;
  fighter: FighterDescription;
  tier: GeminiTier;
  /** Bestehende DNA-Antworten des Gegners (für Merge-Abgleich, mode=opponent). */
  existingDna: Record<string, string>;
  /** Bestehende Stats als Kontext. */
  existingSplit: DnaSplit | null;
  existingStats: ActionStat[];
  /** Profil-Kontext (Stil, Auslage, Notizen) als Freitext. */
  profileContext: string;
}

export interface AnalyzeResult {
  observation: VideoObservation;
  evaluation: VideoEvaluation;
  models: { gemini: string; claude: string };
  usage: AnalysisUsage | null;
}

/**
 * Startet die zweistufige Analyse und meldet Fortschritt über den
 * NDJSON-Stream der API-Route.
 */
export async function runVideoAnalysis(
  req: AnalyzeRequest,
  onStage?: (stage: AnalysisStage) => void,
): Promise<AnalyzeResult> {
  const token = await idToken();
  const res = await fetch("/api/video-analysis/analyze", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(req),
  });
  if (!res.ok || !res.body) {
    let msg = "Analyse fehlgeschlagen";
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) msg = data.error;
    } catch {
      /* Text-/Streamfehler → generische Meldung */
    }
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: AnalyzeResult | null = null;

  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const event = JSON.parse(trimmed) as
      | { type: "stage"; stage: AnalysisStage }
      | ({ type: "result" } & AnalyzeResult)
      | { type: "error"; message: string };
    if (event.type === "stage") onStage?.(event.stage);
    else if (event.type === "result") {
      const { type: _t, ...rest } = event;
      result = rest;
    } else if (event.type === "error") throw new Error(event.message);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) handleLine(line);
  }
  if (buffer.trim()) handleLine(buffer);

  if (!result) throw new Error("Analyse lieferte kein Ergebnis");
  return result;
}
