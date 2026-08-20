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

// ─── Gewichtung eines Videos ────────────────────────────────────────────────

/**
 * Grobe zeitliche Einordnung des Kampfes — wird vom Trainer gewählt, nie
 * geraten. Absichtlich nur Stufen statt eines Datums: den genauen Tag kennt
 * man selten, den Zeitraum fast immer.
 */
export type FightRecency = "recent" | "mid" | "old" | "ancient" | "unknown";

export const FIGHT_RECENCY_LABEL: Record<FightRecency, string> = {
  recent: "Letzte 6 Monate",
  mid: "6–18 Monate",
  old: "1–3 Jahre",
  ancient: "Älter als 3 Jahre",
  unknown: "Unbekannt",
};

/**
 * Aktualitätsfaktor. „Unbekannt" liegt bewusst im oberen Mittelfeld: fehlendes
 * Wissen darf kein Strafabzug sein, sonst würde undatiertes Archivmaterial
 * systematisch benachteiligt.
 */
export const FIGHT_RECENCY_WEIGHT: Record<FightRecency, number> = {
  recent: 1,
  mid: 0.85,
  old: 0.65,
  ancient: 0.45,
  unknown: 0.8,
};

/**
 * Abdeckungsfaktor aus dem Freitext von `meta.coverage` (Stufe 1). Ein
 * Highlight-Zusammenschnitt zeigt nur die besten Momente und zeichnet damit
 * ein geschöntes Bild — er darf das Profil deutlich weniger bewegen als ein
 * vollständiger Kampf.
 */
export function coverageWeight(coverage: string | null): number {
  const t = (coverage ?? "").toLowerCase();
  if (!t) return 0.8;
  if (t.includes("highlight") || t.includes("best of")) return 0.45;
  if (
    t.includes("vollkampf") || t.includes("voller") || t.includes("komplett") ||
    t.includes("ganzer") || t.includes("full")
  )
    return 1;
  if (
    t.includes("schnitt") || t.includes("clip") || t.includes("teil") ||
    t.includes("auszug")
  )
    return 0.7;
  return 0.8;
}

/** Aufgeschlüsseltes Gewicht eines Videos — die Faktoren bleiben sichtbar. */
export interface VideoWeight {
  /** Gesamtgewicht 0,2–1,0: so stark zählt dieses Video im Profil. */
  value: number;
  recency: number;
  coverage: number;
  identification: number;
}

/**
 * Gewicht eines Videos aus den drei Faktoren, die wir wirklich kennen:
 * Aktualität (Trainer-Eingabe), Abdeckung und Identifikationssicherheit.
 * Bewusst NICHT enthalten: `meta.estimatedAge` und `meta.opponentLevel` —
 * beides reine Bildschätzungen des Modells ohne belastbare Grundlage.
 */
export function computeVideoWeight(a: {
  recency?: FightRecency;
  observation: VideoObservation;
}): VideoWeight {
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n || 0));
  const recency = FIGHT_RECENCY_WEIGHT[a.recency ?? "unknown"];
  const coverage = coverageWeight(a.observation.meta.coverage);
  const identification = clamp01(a.observation.identification.idConfidence);
  // Untergrenze 0,2: auch ein schwaches Video verschwindet nicht ganz.
  const value = Math.max(0.2, Math.min(1, recency * coverage * identification));
  return {
    value: Math.round(value * 100) / 100,
    recency,
    coverage,
    identification,
  };
}

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
  /** Zeitliche Einordnung des Kampfes (Trainer-Angabe) — Basis der Gewichtung. */
  recency?: FightRecency;
  models: { gemini: string; claude: string };
  /** Token-Verbrauch + Kosten der Bewertungsstufe (null beim Gratis-Fallback). */
  usage: AnalysisUsage | null;
  observation: VideoObservation;
  evaluation: VideoEvaluation;
  /** Frage-IDs, deren Befunde bereits in die DNA übernommen wurden. */
  appliedFindingIds: string[];
  /** True, wenn Split + Action-Stats übernommen wurden. */
  appliedStats: boolean;
  /**
   * Nur mode=athlete: Trainer hat das Ergebnis für den Schüler freigegeben —
   * der Athlet sieht die Auswertung dann unter „Mein DeepFight".
   */
  sharedWithAthlete?: boolean;
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
    recency: d.recency ?? "unknown",
    appliedFindingIds: d.appliedFindingIds ?? [],
    appliedStats: d.appliedStats ?? false,
    sharedWithAthlete: d.sharedWithAthlete ?? false,
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

/**
 * Gibt eine Athleten-Auswertung für den Schüler frei (oder zieht die
 * Freigabe zurück) — sichtbar unter „Mein DeepFight".
 */
export async function setAnalysisSharedWithAthlete(
  targetId: string,
  analysisId: string,
  shared: boolean,
): Promise<void> {
  await updateDoc(doc(analysesCol("athlete", targetId), analysisId), {
    sharedWithAthlete: shared,
  });
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

/** Antwort robust parsen — Vercel-Fehlerseiten (413 & Co.) sind kein JSON. */
async function apiJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: (T & { error?: string }) | null = null;
  try {
    data = JSON.parse(text) as T & { error?: string };
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg =
      data?.error ||
      (res.status === 413
        ? "Anfrage zu groß für den Server."
        : `Server-Fehler (HTTP ${res.status})`);
    throw new Error(msg);
  }
  if (data === null) throw new Error("Unerwartete Server-Antwort.");
  return data;
}

/**
 * Lädt eine Videodatei zur Gemini-Files-API hoch — DIREKT vom Browser zu
 * Google (umgeht Vercels 4,5-MB-Request-Limit). Der Server liefert nur die
 * Upload-URL (ohne API-Key) und wird danach zum Status-Polling genutzt.
 */
/**
 * Prüft, ob eine früher hochgeladene Datei bei Google noch existiert und
 * einsatzbereit (ACTIVE) ist — für die Wiederverwendung nach Fehlversuchen.
 */
export async function isUploadStillActive(name: string): Promise<boolean> {
  try {
    const token = await idToken();
    const res = await fetch("/api/video-analysis/file-status", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { state?: string };
    return data.state === "ACTIVE";
  } catch {
    return false;
  }
}

export async function uploadVideoFile(
  file: File,
  /** `fraction` ist der echte Byte-Fortschritt 0–1, sofern messbar. */
  onProgress?: (msg: string, fraction?: number) => void,
): Promise<{ fileUri: string; mimeType: string; name: string }> {
  const token = await idToken();
  const mimeType = file.type || "video/mp4";

  // 1. Upload-Session serverseitig eröffnen (Key bleibt auf dem Server)
  onProgress?.("Upload wird vorbereitet …", 0);
  const session = await apiJson<{ uploadUrl: string; uploadName: string }>(
    await fetch("/api/video-analysis/upload", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        mimeType,
      }),
    }),
  );

  // 2. Bytes direkt zu Google hochladen + finalisieren.
  // Wichtig: Googles FINALE Antwort kommt ohne CORS-Header — der Browser darf
  // sie oft nicht lesen und meldet dann fälschlich einen Netzwerkfehler,
  // obwohl der Upload durch ist. Deshalb: Antwort nur nutzen, wenn lesbar;
  // sonst bestätigt der Server den Upload über den einmaligen uploadName.
  type UploadedFile = { name: string; uri: string; state: string; mimeType?: string };
  onProgress?.("Video wird hochgeladen … 0 %", 0);
  let lastPct = 0;
  const direct = await new Promise<UploadedFile | null>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", session.uploadUrl);
    xhr.setRequestHeader("x-goog-upload-offset", "0");
    xhr.setRequestHeader("x-goog-upload-command", "upload, finalize");
    xhr.timeout = 20 * 60_000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        lastPct = Math.round((e.loaded / e.total) * 100);
        // Bis 0,9 des Upload-Bands: der Rest gehört dem Finalisieren und
        // Googles Verarbeitungs-Wartezeit (state=PROCESSING) darunter.
        onProgress?.(
          `Video wird hochgeladen … ${lastPct} %`,
          (e.loaded / e.total) * 0.9,
        );
      }
    };
    xhr.onload = () => {
      try {
        const parsed = JSON.parse(xhr.responseText) as { file?: UploadedFile };
        resolve(parsed.file ?? null);
      } catch {
        resolve(null); // Antwort nicht lesbar → Server schlägt nach
      }
    };
    xhr.onerror = () => resolve(null); // meist CORS-blockierte Erfolgs-Antwort
    xhr.ontimeout = () =>
      reject(new Error("Video-Upload dauerte zu lange (Timeout) — bitte erneut versuchen."));
    xhr.onabort = () => reject(new Error("Video-Upload wurde abgebrochen."));
    xhr.send(file);
  });

  let info: UploadedFile | null = direct;
  if (!info) {
    // 2b. Upload serverseitig bestätigen (Antwort war nicht lesbar)
    onProgress?.("Upload wird bestätigt …", 0.92);
    for (let attempt = 0; attempt < 6 && !info; attempt++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const res = await fetch("/api/video-analysis/resolve-upload", {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ uploadName: session.uploadName }),
        });
        if (res.status === 404) continue; // noch nicht sichtbar → weiter warten
        info = await apiJson<UploadedFile>(res);
      } catch {
        /* transient — nächster Versuch */
      }
    }
    if (!info) {
      throw new Error(
        lastPct >= 99
          ? "Upload war fertig, die Datei ist aber nicht auffindbar — bitte erneut versuchen."
          : `Video-Upload abgebrochen (bei ${lastPct} %) — Verbindung prüfen und erneut versuchen.`,
      );
    }
  }

  // 3. Warten, bis Google das Video verarbeitet hat (state=ACTIVE)
  onProgress?.("Video wird verarbeitet …", 0.93);
  const deadline = Date.now() + 5 * 60_000;
  while (info.state === "PROCESSING" && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000));
    info = await apiJson<typeof info>(
      await fetch("/api/video-analysis/file-status", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: info.name }),
      }),
    );
  }
  if (info.state !== "ACTIVE") {
    throw new Error(
      `Google konnte das Video nicht verarbeiten (Status: ${info.state})`,
    );
  }
  return { fileUri: info.uri, mimeType: info.mimeType || mimeType, name: info.name };
}

export type AnalysisStage = "gemini" | "claude" | "done";

/**
 * Erwartete Zeichenzahl der Bewertungs-Antwort — Nenner für den echten
 * Fortschritt der Claude-Stufe. Grober Richtwert; der Fortschritt wird bei
 * 97 % gedeckelt, damit ein längeres Ergebnis die Anzeige nicht überläuft.
 */
export const EXPECTED_EVALUATION_CHARS = 9000;

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
  /** Zeitliche Einordnung des Kampfes; bei "unknown" bleibt der Prompt unverändert. */
  recency?: FightRecency;
  /**
   * "Analyse fortsetzen": bereits vorhandene Gemini-Beobachtung aus einem
   * früheren Versuch — die Video-Stufe wird dann übersprungen (spart Token).
   */
  observation?: VideoObservation | null;
  observationModel?: string | null;
  /**
   * Nur Stufe 1 (Gemini) ausführen und die Beobachtung liefern. Beide Stufen
   * laufen als getrennte Requests, damit jede ihr eigenes Vercel-Zeitbudget
   * (300 s) bekommt — sonst reißt ein langes Video das Gesamtlimit.
   */
  observeOnly?: boolean;
}

/**
 * Führt NUR die Gemini-Beobachtung aus (Stufe 1) — eigener Request mit
 * eigenem Server-Zeitbudget. Die Bewertung folgt separat via runVideoAnalysis
 * mit gesetzter observation.
 */
export async function runVideoObservation(
  req: AnalyzeRequest,
): Promise<{ observation: VideoObservation; model: string }> {
  const token = await idToken();
  const res = await fetch("/api/video-analysis/analyze", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ ...req, observeOnly: true }),
  });
  if (!res.ok || !res.body) {
    let msg = "Video-Beobachtung fehlgeschlagen";
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) msg = data.error;
    } catch {
      /* generische Meldung */
    }
    throw new Error(msg);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let observation: { observation: VideoObservation; model: string } | null =
    null;
  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const event = JSON.parse(trimmed) as
      | { type: "stage" }
      | { type: "observation"; observation: VideoObservation; model: string }
      | { type: "error"; message: string };
    if (event.type === "observation")
      observation = { observation: event.observation, model: event.model };
    else if (event.type === "error") throw new Error(event.message);
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
  if (!observation)
    throw new Error("Video-Beobachtung lieferte kein Ergebnis");
  return observation;
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
  /** Wird gerufen, sobald die Gemini-Beobachtung fertig ist (für Resume). */
  onObservation?: (observation: VideoObservation, model: string) => void,
  /** Echter Fortschritt der Bewertung: Anteil 0–1 der erwarteten Antwortlänge. */
  onProgress?: (fraction: number) => void,
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
      | { type: "progress"; chars: number }
      | { type: "observation"; observation: VideoObservation; model: string }
      | ({ type: "result" } & AnalyzeResult)
      | { type: "error"; message: string };
    if (event.type === "stage") onStage?.(event.stage);
    else if (event.type === "progress")
      onProgress?.(Math.min(0.97, event.chars / EXPECTED_EVALUATION_CHARS));
    else if (event.type === "observation")
      onObservation?.(event.observation, event.model);
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
