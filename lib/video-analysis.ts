/**
 * KI-Video-Analyse — Datenmodell + Client-Helfer (Konzept §6).
 *
 * Zweistufige Pipeline (Spezifikation: docs/gegner-dna-video-analyse-fragenkatalog.md):
 *   Stufe 1  Gemini  → rohe Beobachtungen aus dem Video (Abschnitte A + B)
 *   Stufe 2  Claude  → Bewertung/Analyse auf DNA-Kategorien gemappt (C + D + E)
 *
 * Ein Video = ein Analyse-Beitrag (VideoAnalysis), nie eine fertige DNA.
 *
 * ─── AUTOMATIK STATT REVIEW (Leon 14./15.09.2026, gebaut ab 16.09.) ─────────
 *
 * Bis Etappe 1 dieses Umbaus übernahm der Trainer Befunde per Klick in die
 * DNA („Alle übernehmen", je Befund, „Ersetzen"). Das ist abgeschafft:
 * **Analyse fertig = Profil aktualisiert.** Der Client speichert die Analyse
 * nicht mehr selbst — er reicht sie an `POST /api/video-analysis/commit`,
 * und der Server (Admin-SDK) schreibt das Dokument UND rechnet das Profil
 * aus ALLEN gespeicherten Analysen neu (`lib/profile-evidence.ts`, rein;
 * `lib/server/profile-recompute.ts`, Schreiber). Löschen gibt es für den
 * Client nicht mehr — eine Analyse mit falsch erkanntem Kämpfer wird
 * MARKIERT (`wrongFighter`) und fällt aus der Rechnung; auch das rechnet
 * der Server neu. Damit sind Löschen, Umklassifizieren, Doppel-Upload und
 * Altern jederzeit rückrechenbar.
 *
 * Die WÄHRUNG einer Analyse ist ihr Gewicht `w = Zeitraum × Art`, ohne
 * Klemme (0,12–1,0). Die Kämpfer-Sicherheit ist KEIN Faktor, sondern ein
 * TOR: unter 0,75 zählt die Analyse gar nicht, darüber voll. Die Zahlen
 * stehen an `FIGHT_RECENCY_WEIGHT` und `VIDEO_TYPE_WEIGHT`; die
 * Begründungen im Gedächtnis `analyse-automatik-entscheidung`.
 *
 * Firestore:
 *   opponents/{opponentId}/videoAnalyses/{analysisId}   (mode = "opponent")
 *   users/{uid}/videoAnalyses/{analysisId}              (mode = "athlete")
 * Jedes Dokument trägt `gymId` und `targetIsStaff` — damit liest die
 * Landung alle Analysen des Gyms mit EINER collectionGroup-Abfrage statt
 * mit einem Fächer je Ziel (Regel mit direktem Feldzugriff, Falle 28).
 *
 * Die API-Keys (Gemini + Claude) leben ausschließlich serverseitig —
 * die Aufrufe laufen über /api/video-analysis/* (siehe lib/server/).
 */

import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
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

/**
 * Fünf Optionen — Leon 16.09.2026: „das lassen wir bei den genauen Angaben".
 * Wortwahl einfach und sportneutral; die endgültige Formulierung stimmt das
 * Design-Fenster mit Leon ab (Etappe 2).
 */
export const FIGHT_RECENCY_LABEL: Record<FightRecency, string> = {
  recent: "Kürzlich",
  mid: "Letztes Jahr",
  old: "Vor 1–3 Jahren",
  ancient: "Länger her",
  unknown: "Weiß ich nicht",
};

/**
 * Aktualitätsfaktor (Gegenprobe 14.09.2026, 10 Agenten; Leon bestätigt).
 * „Weiß ich nicht" zählt wie „1–3 Jahre": Der alte Wert 0,8 lag ÜBER dem
 * ehrlichen „1–3 Jahre" (0,65) und bestrafte damit, wer datierte.
 */
export const FIGHT_RECENCY_WEIGHT: Record<FightRecency, number> = {
  recent: 1,
  mid: 0.9,
  old: 0.6,
  ancient: 0.4,
  unknown: 0.6,
};

/**
 * Reihenfolge „jünger zuerst" für die Kipp-Regel. „Weiß ich nicht" steht
 * bei „1–3 Jahre" — dasselbe Gewicht, derselbe Platz.
 */
export const FIGHT_RECENCY_RANK: Record<FightRecency, number> = {
  recent: 0,
  mid: 1,
  old: 2,
  unknown: 2,
  ancient: 3,
};

/**
 * Art des Videos — legt die KI fest, nicht der Nutzer (Leon 14.09.: „zu
 * umständlich, der Benutzer kann das vielleicht gar nicht entscheiden").
 * Bis Etappe 2 (Vorlauf) leitet `videoTypeFromObservation` sie aus der
 * Beobachtung ab; ab Etappe 2 kommt sie vorbelegt vom Vorlauf und der
 * Trainer bestätigt sie auf dem Standbild-Schirm.
 */
export type VideoType = "full" | "excerpt" | "sparring" | "highlight";

export const VIDEO_TYPE_LABEL: Record<VideoType, string> = {
  full: "Kompletter Kampf",
  excerpt: "Teil eines Kampfs",
  sparring: "Training oder Sparring",
  highlight: "Best-of-Zusammenschnitt",
};

/**
 * Art-Faktor. Ein Highlight zeigt nur Treffer und darf deshalb NUR Text
 * liefern (Waffen, Entries, Finish), nie Zahlen, nie Split — siehe
 * `lib/profile-evidence.ts`. Sparring liefert keinen Split und beim Gegner
 * keine Zahlen.
 */
export const VIDEO_TYPE_WEIGHT: Record<VideoType, number> = {
  full: 1,
  excerpt: 0.7,
  sparring: 0.6,
  highlight: 0.3,
};

/**
 * Art aus der Beobachtung (Stufe 1) ableiten — Übergang bis zum Vorlauf.
 * Unklare Angaben landen bei „Teil eines Kampfs" (0,7): Lieber zählt ein
 * ganzer Kampf einmal zu 70 % als ein Clip zu 100 %.
 */
export function videoTypeFromObservation(
  observation: Pick<VideoObservation, "meta">,
): VideoType {
  const t = `${observation.meta.coverage ?? ""} ${observation.meta.ruleset ?? ""}`
    .toLowerCase();
  if (t.includes("sparring") || t.includes("training")) return "sparring";
  if (t.includes("highlight") || t.includes("best of") || t.includes("best-of"))
    return "highlight";
  if (
    t.includes("vollkampf") || t.includes("voller") || t.includes("komplett") ||
    t.includes("ganzer") || t.includes("full") || t.includes("gesamter")
  )
    return "full";
  return "excerpt";
}

/** Schwelle: darunter gilt die Kämpfer-Identifikation als unsicher. */
export const ID_CONFIDENCE_WARN = 0.75;

/** Aufgeschlüsseltes Gewicht eines Videos — die Faktoren bleiben sichtbar. */
export interface VideoWeight {
  /**
   * Gesamtgewicht = recency × type, OHNE Klemme (0,12–1,0). 0, wenn das Tor
   * der Kämpfer-Sicherheit zu ist — dann zählt die Analyse gar nicht.
   */
  value: number;
  recency: number;
  type: number;
  /** Kämpfer-Sicherheit aus Stufe 1 (nur Anzeige — im Wert steckt sie als Tor). */
  identification: number;
  /** Tor offen: idConfidence ≥ ID_CONFIDENCE_WARN. */
  identified: boolean;
}

/**
 * Gewicht eines Videos. Bewusst NICHT enthalten: `meta.estimatedAge` und
 * `meta.opponentLevel` — reine Bildschätzungen des Modells.
 *
 * Kämpfer-Sicherheit ist ein TOR, kein Faktor (Gegenprobe): Ein vertauschter
 * Kämpfer vergiftet alle 60 Antworten, und das lässt sich nicht mit 0,6
 * „ein bisschen" einrechnen. Unter der Schwelle zählt nichts; die Analyse
 * bleibt gespeichert und wartet auf eine neue Zuordnung (Etappe 2).
 */
export function computeVideoWeight(a: {
  recency?: FightRecency;
  videoType?: VideoType;
  observation: Pick<VideoObservation, "identification" | "meta">;
}): VideoWeight {
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n || 0));
  const recency = FIGHT_RECENCY_WEIGHT[a.recency ?? "unknown"];
  const type = VIDEO_TYPE_WEIGHT[a.videoType ?? videoTypeFromObservation(a.observation)];
  const identification = clamp01(a.observation.identification.idConfidence);
  const identified = identification >= ID_CONFIDENCE_WARN;
  const value = identified ? recency * type : 0;
  return {
    value: Math.round(value * 100) / 100,
    recency,
    type,
    identification,
    identified,
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
  /**
   * SEITEN-SCHLÜSSEL (seit Etappe 1 der Automatik): ein kurzer Slug, der die
   * AUSSAGE des Befunds benennt, nicht seinen Wortlaut — „cross", „low-kick",
   * „clinch-suchen", „rueckwaerts". Zwei Videos, die dasselbe sagen, tragen
   * denselben Schlüssel und ziehen im Tauziehen an derselben Seite
   * (`lib/profile-evidence.ts`). Vergibt Claude in Stufe 2; ältere Analysen
   * ohne Schlüssel bekommen beim Decodieren einen aus dem Antworttext.
   */
  sideKey: string;
}

/**
 * Bestätigung einer BESTEHENDEN Antwort durch dieses Video (E1). Zählt nur
 * mit Beleg: Modelle bestätigen Vorgaben bereitwillig, deshalb wiegt eine
 * Bestätigung ohne Timestamp nichts.
 */
export interface ConfirmedAnswer {
  questionId: string;
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
  /** E — Abgleich gegen die bestehende DNA. */
  merge: {
    /** Bestehende Antworten, die das Video MIT BELEG bestätigt (E1). */
    confirms: ConfirmedAnswer[];
    /**
     * Widersprüche (E2). Seit der Automatik nur noch Anzeige-Material: Was
     * gilt, entscheidet das Tauziehen der Seiten, nicht ein Klick.
     */
    contradicts: ContradictionFlag[];
    /** Selbsteinschätzung des Modells 0–1 — wird weder gerechnet noch angezeigt. */
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
 * Euro-Beträge in der Schreibweise, die die ganze App benutzt.
 *
 * Sie stand bis 08.09.2026 in `AiBudgetGauge` — dieser Guthaben-Ring ist mit
 * Teilschritt 4 des DeepFight-Neuaufbaus weggefallen (Leon: „der Ring und die
 * Anzeige, was es verbraucht hat, soll für alle entfernt werden"). Die
 * Formatierung selbst bleibt gebraucht: Die Kosten je Analyse sieht weiterhin,
 * wer Plattform-Admin ist. Sie gehört deshalb hierher, zu den anderen
 * Kosten-Werkzeugen, und nicht in eine Komponente.
 */
export function formatEur(n: number): string {
  return n.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Laufende Summe über ALLE Analysen (Gegner + Athleten), als einzelnes
 * Firestore-Dokument `aiUsage/summary`. Daneben liegt seit Etappe 1 der
 * Automatik je Gym ein Dokument `aiUsage/gym-{gymId}` (gleiche Felder plus
 * `months.{JJJJ-MM}`) — Leons Wunsch „welches Gym verursacht am meisten,
 * und was kostet ein Monat" (Backlog „KI-Kosten je Gym"). Geschrieben wird
 * beides NUR noch serverseitig in /api/video-analysis/commit; der Client
 * liest. Gelöschte Analysen reduzieren die Summe bewusst nicht: ausgegebenes
 * Guthaben bleibt ausgegeben.
 */
export interface AiUsageSummary {
  budgetEur: number;
  spentEur: number;
  inputTokens: number;
  outputTokens: number;
  analysisCount: number;
}

/** Verbrauch eines Gyms, mit Monatsverlauf. */
export interface AiUsageByGym {
  gymId: string;
  spentEur: number;
  analysisCount: number;
  /** Schlüssel „JJJJ-MM" → Kosten und Zahl der Analysen in diesem Monat. */
  months: Record<string, { spentEur: number; analysisCount: number }>;
}

/** Monatsschlüssel „JJJJ-MM" für die Kosten-Buchung. */
export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
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

/** Verbrauch je Gym (Plattform-Admin) — die Dokumente `aiUsage/gym-*`. */
export async function listAiUsageByGym(): Promise<AiUsageByGym[]> {
  const snap = await getDocs(collection(getFirestoreDb(), "aiUsage"));
  const out: AiUsageByGym[] = [];
  for (const d of snap.docs) {
    if (!d.id.startsWith("gym-")) continue;
    const data = d.data() as Partial<AiUsageByGym>;
    out.push({
      gymId: data.gymId ?? d.id.slice(4),
      spentEur: data.spentEur ?? 0,
      analysisCount: data.analysisCount ?? 0,
      months: data.months ?? {},
    });
  }
  return out.sort((a, b) => b.spentEur - a.spentEur);
}

// ─── Gespeicherte Analyse ───────────────────────────────────────────────────

export interface VideoAnalysis {
  id: string;
  mode: AnalysisMode;
  /** opponentId (mode=opponent) bzw. Schüler-uid (mode=athlete). */
  targetId: string;
  targetName: string;
  /**
   * Gym des ZIELS (nicht des Aufrufers) — setzt der Server aus dem
   * Gegnerprofil bzw. dem users-Dokument. Schlüssel der collectionGroup-
   * Abfrage und der Kosten je Gym.
   */
  gymId: string;
  /**
   * Ist das Ziel ein Stab-Konto? Materialisiert wie `ownerIsStaff` an den
   * Wettkämpfen: Die collectionGroup-Regel liefert nur Analysen zu Athleten
   * und Gegnern (`targetIsStaff == false`); Analysen zu Kollegen laufen
   * ausschließlich über den direkten Pfad und damit über die Freigabe.
   */
  targetIsStaff: boolean;
  /** Kurzlabel der Quelle für Listen (Dateiname bzw. YouTube-URL). */
  sourceLabel: string;
  sourceKind: "upload" | "youtube";
  youtubeUrl: string | null;
  /**
   * Fingerabdruck der Datei (Name, Größe, Dauer) — erkennt einen zweiten
   * Upload desselben Videos (Etappe 3: „ersetzen oder zusätzlich?"). Bei
   * YouTube die URL samt Ausschnitt.
   */
  fileFingerprint: string | null;
  fighter: FighterDescription;
  tier: GeminiTier;
  /** Zeitliche Einordnung des Kampfes (Trainer-Angabe) — Faktor der Gewichtung. */
  recency: FightRecency;
  /** Art des Videos (legt die KI fest) — zweiter Faktor der Gewichtung. */
  videoType: VideoType;
  /** Kampfmonat „JJJJ-MM", falls bekannt (Etappe 2: Datumseinblendung) — sortiert genauer als `recency`. */
  fightMonth: string | null;
  /** Gewicht zum Zeitpunkt des Speicherns, aufgeschlüsselt. Rechnet der Server. */
  weight: VideoWeight;
  models: { gemini: string; claude: string };
  /** Token-Verbrauch + Kosten der Bewertungsstufe (null beim Gratis-Fallback). */
  usage: AnalysisUsage | null;
  observation: VideoObservation;
  evaluation: VideoEvaluation;
  /**
   * Trainer hat den Kämpfer als falsch erkannt markiert: Die Analyse bleibt
   * gespeichert, zählt aber nicht mehr (ersetzt das Löschen). Umkehrbar.
   */
  wrongFighter: boolean;
  /**
   * Nur mode=athlete: Trainer hat das Ergebnis für den Athleten freigegeben —
   * der Athlet sieht die Auswertung dann unter „Mein DeepFight".
   */
  sharedWithAthlete?: boolean;
  createdBy: string;
  createdByName: string | null;
  createdAt: Date;
}

/**
 * Was der Client an /api/video-analysis/commit reicht. Alles, was der
 * Server selbst weiß oder rechnet (gymId, targetIsStaff, weight, videoType,
 * createdAt, Marken), fehlt hier absichtlich — es wird nicht vertraut.
 */
export type VideoAnalysisInput = Omit<
  VideoAnalysis,
  | "id"
  | "createdAt"
  | "gymId"
  | "targetIsStaff"
  | "weight"
  | "videoType"
  | "wrongFighter"
  | "sharedWithAthlete"
  | "createdBy"
  | "createdByName"
> & { videoType?: VideoType };

/** Rohform in Firestore — auch ältere Dokumente ohne die neuen Felder. */
export type VideoAnalysisDoc = Partial<Omit<VideoAnalysis, "id" | "createdAt">> & {
  createdAt?: Timestamp | { toDate(): Date };
  /** Altbestand: Bestätigungen als nackte Frage-IDs. */
  evaluation?: Omit<Partial<VideoEvaluation>, "merge"> & {
    merge?: Partial<Omit<VideoEvaluation["merge"], "confirms">> & {
      confirms?: (string | ConfirmedAnswer)[];
    };
  };
};

// ─── Decodieren (Client UND Server) ─────────────────────────────────────────

/**
 * Seiten-Schlüssel für Befunde OHNE Schlüssel (Bestand vor Etappe 1): aus
 * dem Antworttext, normiert und gekürzt. Zwei wortgleiche Antworten landen
 * so auf einer Seite; zwei sinngleiche nicht — dafür gibt es ab jetzt den
 * Schlüssel aus Stufe 2.
 */
export function sideKeyFromText(answer: string): string {
  const slug = answer
    .toLowerCase()
    .normalize("NFD")
    // Nach NFD sind Umlaute Grundbuchstabe + Akzentzeichen; alles außerhalb
    // von ASCII fällt weg, der Grundbuchstabe bleibt („Käfig" → „kafig").
    .replace(/[^\x00-\x7f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `text:${slug.slice(0, 40) || "leer"}`;
}

/**
 * Macht aus einem Firestore-Dokument eine vollständige VideoAnalysis —
 * gemeinsam für Client-SDK und Admin-SDK (beide Timestamps haben `toDate`).
 * Fehlende Felder des Altbestands bekommen Vorgaben; das Gewicht wird dann
 * aus den vorhandenen Angaben nachgerechnet.
 */
export function decodeVideoAnalysis(id: string, d: VideoAnalysisDoc): VideoAnalysis {
  const observation = (d.observation ?? {}) as VideoObservation;
  const rawEval = (d.evaluation ?? {}) as NonNullable<VideoAnalysisDoc["evaluation"]>;
  const findings = (rawEval.findings ?? []).map((f) => ({
    ...f,
    sideKey: f.sideKey?.trim() || sideKeyFromText(f.answer ?? ""),
  }));
  const confirms: ConfirmedAnswer[] = (rawEval.merge?.confirms ?? []).map((c) =>
    typeof c === "string" ? { questionId: c, evidence: [] } : c,
  );
  const evaluation = {
    ...(rawEval as VideoEvaluation),
    findings,
    merge: {
      confirms,
      contradicts: rawEval.merge?.contradicts ?? [],
      weight: rawEval.merge?.weight ?? 0,
    },
  } as VideoEvaluation;
  const recency: FightRecency = d.recency ?? "unknown";
  const videoType: VideoType =
    d.videoType ??
    (observation.meta ? videoTypeFromObservation(observation) : "excerpt");
  const weight =
    d.weight ??
    (observation.identification
      ? computeVideoWeight({ recency, videoType, observation })
      : { value: 0, recency: 0, type: 0, identification: 0, identified: false });
  return {
    id,
    mode: d.mode ?? "opponent",
    targetId: d.targetId ?? "",
    targetName: d.targetName ?? "",
    gymId: d.gymId ?? "",
    targetIsStaff: d.targetIsStaff === true,
    sourceLabel: d.sourceLabel ?? "",
    sourceKind: d.sourceKind ?? "upload",
    youtubeUrl: d.youtubeUrl ?? null,
    fileFingerprint: d.fileFingerprint ?? null,
    fighter: d.fighter ?? {
      name: d.targetName ?? "",
      corner: "unknown",
      clothing: "",
      features: "",
      startPosition: "",
    },
    tier: d.tier ?? "flash",
    recency,
    videoType,
    fightMonth: d.fightMonth ?? null,
    weight,
    models: d.models ?? { gemini: "", claude: "" },
    usage: d.usage ?? null,
    observation,
    evaluation,
    wrongFighter: d.wrongFighter === true,
    sharedWithAthlete: d.sharedWithAthlete ?? false,
    createdBy: d.createdBy ?? "",
    createdByName: d.createdByName ?? null,
    createdAt: d.createdAt?.toDate() ?? new Date(),
  };
}

/** Zählt diese Analyse im Profil? (Tor offen, nicht als falsch markiert.) */
export function analysisCounts(a: Pick<VideoAnalysis, "weight" | "wrongFighter">): boolean {
  return !a.wrongFighter && a.weight.identified && a.weight.value > 0;
}

// ─── Firestore-Lesen (Client) ───────────────────────────────────────────────

function analysesCol(mode: AnalysisMode, targetId: string) {
  const db = getFirestoreDb();
  return mode === "opponent"
    ? collection(db, "opponents", targetId, "videoAnalyses")
    : collection(db, "users", targetId, "videoAnalyses");
}

const decode = decodeVideoAnalysis;

/**
 * Alle Analysen eines Gyms mit EINER Abfrage — ersetzt den Fächer je Ziel
 * in `lib/deepfight-analysen.ts`. Die Regel verlangt BEIDE Filter
 * (`gymId` und `targetIsStaff == false`, direkter Feldzugriff); fehlt einer,
 * weist Firestore die Abfrage komplett ab. Analysen zu Stab-Konten fehlen
 * hier absichtlich — sie laufen über den direkten Pfad und die Freigabe.
 */
export async function listGymVideoAnalyses(gymId: string): Promise<VideoAnalysis[]> {
  const snap = await getDocs(
    query(
      collectionGroup(getFirestoreDb(), "videoAnalyses"),
      where("gymId", "==", gymId),
      where("targetIsStaff", "==", false),
      orderBy("createdAt", "desc"),
    ),
  );
  return snap.docs.map((d) => decode(d.id, d.data() as VideoAnalysisDoc));
}

export async function listVideoAnalyses(
  mode: AnalysisMode,
  targetId: string,
  opts?: {
    /**
     * Nur freigegebene Auswertungen laden (mode=athlete, Kampfprofil des
     * Schülers). PFLICHT, wenn der Athlet selbst lädt: die Firestore-Regeln
     * erlauben dem Owner ausschließlich Dokumente mit
     * `sharedWithAthlete == true` — eine ungefilterte Query würde komplett
     * abgelehnt. Trainer/Admin laden weiterhin ungefiltert.
     */
    sharedOnly?: boolean;
  },
): Promise<VideoAnalysis[]> {
  const col = analysesCol(mode, targetId);
  const q = opts?.sharedOnly
    ? query(
        col,
        where("sharedWithAthlete", "==", true),
        orderBy("createdAt", "desc"),
      )
    : query(col, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => decode(d.id, d.data() as VideoAnalysisDoc));
}

/**
 * Liest EINE Analyse frisch aus Firestore.
 *
 * Für Entscheidungen, die nicht am Anzeigestand hängen dürfen: Die
 * Übernahme-Marken (`appliedFindingIds`, `appliedStats`) können in einem
 * anderen Tab längst gesetzt sein, während der eigene sie noch als offen
 * zeigt — dasselbe Standzeit-Fenster wie bei `readTarget`.
 */
export async function getVideoAnalysis(
  mode: AnalysisMode,
  targetId: string,
  analysisId: string,
): Promise<VideoAnalysis | null> {
  const snap = await getDoc(doc(analysesCol(mode, targetId), analysisId));
  if (!snap.exists()) return null;
  return decode(snap.id, snap.data() as VideoAnalysisDoc);
}

/**
 * Gibt eine Athleten-Auswertung für den Athleten frei (oder zieht die
 * Freigabe zurück) — sichtbar unter „Mein DeepFight". Das einzige Feld, das
 * der Client an einer Analyse noch selbst schreibt (Regel: `hasOnly`).
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

// ─── Pipeline-Aufrufe (Client → API-Routen) ─────────────────────────────────

async function idToken(): Promise<string> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("Nicht angemeldet");
  return user.getIdToken();
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const token = await idToken();
  return apiJson<T>(
    await fetch(path, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );
}

/** Rohform der Antwort: das Dokument, wie es der Server gespeichert hat. */
type CommittedAnalysis = Omit<VideoAnalysisDoc, "createdAt"> & {
  id: string;
  createdAt: string;
};

function decodeCommitted(a: CommittedAnalysis): VideoAnalysis {
  const { id, createdAt, ...rest } = a;
  return decode(id, {
    ...(rest as VideoAnalysisDoc),
    createdAt: { toDate: () => new Date(createdAt) },
  });
}

/**
 * Speichert eine fertige Analyse — SERVERSEITIG. Der Server setzt gymId,
 * targetIsStaff, Art und Gewicht, bucht die Kosten und rechnet das Profil
 * aus allen Analysen neu. Zurück kommt das gespeicherte Dokument.
 */
export async function commitVideoAnalysis(
  input: VideoAnalysisInput,
): Promise<VideoAnalysis> {
  const data = await postJson<{ analysis: CommittedAnalysis }>(
    "/api/video-analysis/commit",
    { analysis: input },
  );
  return decodeCommitted(data.analysis);
}

/**
 * Markiert eine Analyse als „falscher Kämpfer" (oder nimmt die Marke
 * zurück). Ersetzt das Löschen: Das Dokument bleibt, zählt aber nicht mehr;
 * der Server rechnet das Profil neu.
 */
export async function flagVideoAnalysis(
  mode: AnalysisMode,
  targetId: string,
  analysisId: string,
  wrongFighter: boolean,
): Promise<VideoAnalysis> {
  const data = await postJson<{ analysis: CommittedAnalysis }>(
    "/api/video-analysis/flag",
    { mode, targetId, analysisId, action: "flag", wrongFighter },
  );
  return decodeCommitted(data.analysis);
}

/**
 * Löscht eine Analyse endgültig — NUR Plattform-Admin (Demo-Bestand
 * aufräumen). Trainer markieren stattdessen. Der Server rechnet neu.
 */
export async function deleteVideoAnalysisAsAdmin(
  mode: AnalysisMode,
  targetId: string,
  analysisId: string,
): Promise<void> {
  await postJson<{ ok: true }>("/api/video-analysis/flag", {
    mode,
    targetId,
    analysisId,
    action: "delete",
  });
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
      // `type` ist nur der Umschlag des NDJSON-Ereignisses, kein Teil des
      // Ergebnisses — der Rest IST der AnalyzeResult.
      const { type, ...rest } = event;
      void type;
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
