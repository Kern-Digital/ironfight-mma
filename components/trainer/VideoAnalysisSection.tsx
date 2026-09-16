"use client";

/**
 * KI-Video-Analyse — die Ablage der Werkbank (Konzept §6).
 *
 * WEN sie analysiert, entscheidet sie nicht selbst: `mode` und `targetId`
 * kommen von außen. Seit dem DeepFight-Neuaufbau (Teilschritt 2, 07.09.2026)
 * ist das die Werkbank auf `/trainer/deepfight`; die Detailseiten tragen seit
 * Teilschritt 4 (08.09.2026) keine eigene Sektion mehr, sondern einen Weg
 * dorthin. Der Ablauf ist unverändert:
 *   1. Ablage: Videoquelle (Datei ≤15 Min oder YouTube-Link) + Beschreibung,
 *      welcher Kämpfer ausgewertet werden soll + Modellstufe (Flash/Pro).
 *   2. Pipeline: Upload → Gemini-Beobachtung → Claude-Bewertung (Streaming-
 *      Fortschritt über /api/video-analysis/analyze).
 *   3. Das Ergebnis geht an `POST /api/video-analysis/commit`: Der Server
 *      speichert es und rechnet das Profil aus ALLEN Analysen neu
 *      (Gegner-DNA in opponents/{id}, Kampfprofil in users/{uid}/fightProfile).
 *
 * ─── AUTOMATIK STATT REVIEW — ETAPPE 1 (16.09.2026) ───────────────────────
 *
 * Leon 14.09.: „Analyse fertig = Profil aktualisiert." Aus dieser Datei sind
 * deshalb `readTarget`, `writeTarget`, `isConflict`, `applyFindings` und
 * `applyAll` verschwunden — samt der Doppelzählungs-Sperre vom 14.09., die
 * genau diesen Klick absicherte. Die Rechnung liegt jetzt serverseitig
 * (`lib/profile-evidence.ts` + `lib/server/profile-recompute.ts`) und läuft
 * bei jedem Speichern und jeder Marke. Der Bericht bekommt darum KEINE
 * Übernehmen-Rückrufe mehr und keine `existingDna` — die Knöpfe und der
 * Konflikt-Vergleich verschwinden von selbst (`canApply` false); der Umbau
 * des Berichts auf Kurzinfo + „Details anzeigen" ist Etappe 3.
 *
 * LÖSCHEN GIBT ES NICHT MEHR — außer für den Plattform-Admin. Ein Trainer
 * markiert eine Analyse als „falscher Kämpfer" (`wrongFighter`); sie bleibt
 * gespeichert, zählt nicht mehr, und der Server rechnet neu. Die Zeile in
 * der Liste sagt „Zählt nicht", wenn eine Analyse aus der Rechnung fällt
 * (Marke ODER Kämpfer-Tor zu).
 *
 * ─── WAS TEILSCHRITT 4 GEÄNDERT HAT (08.09.2026) ──────────────────────────
 *
 * AN DER PIPELINE NICHTS. Zwei-Phasen-Betrieb, die Wortmarken „überlastet"
 * und „kein Ergebnis" für den Auto-Neustart, `readTarget` frisch aus
 * Firestore, `isConflict` gegen den frischen Stand, die Fortschritts-Schätzer
 * und der Direkt-Upload zu Google stehen Zeile für Zeile wie vorher.
 *
 * 1. TOKEN-LOOK STATT VIOLETT. Das feste `--ta-violet` ist weg; die Sektion
 *    nimmt die Akzent-Familie, und die färbt im Bereich schon der Modus
 *    (Gym-Akzent bei „Unsere Leute", Silber beim Gegner). Ein violetter Knopf
 *    im silbernen Gegner-Modus wäre genau der Fremdkörper, den Leon am
 *    06.09. abgeschafft hat.
 *
 *    KEINE `.t-card` HIER DRIN: Die Sektion sitzt in der Werkbank bereits in
 *    einer — und im Bereich ist jede `.t-card` Glas. Ihre eigenen Flächen
 *    laufen deshalb über `--surface-raised` + `--line`, die im Bereich
 *    halbdurchsichtig sind (globals.css, „Der DeepFight-Bereich"). Wer hier
 *    eine Karte einführt, baut Glas auf Glas.
 *
 * 2. DIE ABLAGE STEHT SOFORT DA. Leons Ansage zum Neuaufbau war „ich habe
 *    dort direkt mein Upload-Fenster" — der Zwischenklick auf „Neue Analyse"
 *    ist weg, sobald ein Ziel gewählt ist. Die Fläche nimmt gezogene Dateien
 *    und Eingefügtes aus der Zwischenablage (Videodatei ODER YouTube-Link,
 *    der Link schaltet die Quelle selbst um) und bleibt gleichzeitig ein
 *    normaler Knopf: Auf Touch gibt es kein Ziehen, und Hover trägt nie
 *    (MOTION-BRIEF §3.3).
 *
 * 3. ANGEFANGENES IST SICHTBAR. `pendingUpload`/`pendingObservation` retten
 *    seit jeher eine halbe Analyse über einen Abbruch — nur steckte der
 *    Hinweis IM Formular, und wer es zuklappte, sah nichts davon. Jetzt steht
 *    oben eine Zeile mit dem, was schon geschafft ist, wie lange es noch
 *    gilt und zwei Wegen: fortsetzen oder verwerfen. Dafür kommt EIN Feld in
 *    den gespeicherten Zustand (`pendingSavedAt`); die beiden Pipeline-
 *    Objekte selbst bleiben unangetastet, damit der Fingerprint-Vergleich
 *    exakt bleibt.
 *
 * 4. DER GUTHABEN-RING IST WEG (Leon 08.09.: „der Ring und die Anzeige, was
 *    es verbraucht hat, soll für alle entfernt werden"). Was eine Analyse
 *    gekostet hat, sieht weiterhin, wer Plattform-Admin ist — die Zahl steht
 *    an der Analyse selbst. Damit ist auch `AiBudgetGauge` samt ihrem
 *    `window.prompt()` gelöscht: der letzte native Dialog der App.
 */

import { Collapse, FlowItem, MorphSwap, StaggerFlow } from "@/components/motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import Select from "@/components/ui/Select";
import Skeleton from "@/components/ui/Skeleton";
import { useWakeLock } from "@/lib/use-wake-lock";
import VideoAnalysisResult from "./VideoAnalysisResult";
import { useRights } from "@/lib/auth-context";
import type { Opponent } from "@/lib/opponents";
import type { FightProfile } from "@/lib/fight-profile";
import { FIGHTER_STANCE_LABEL, FIGHT_STYLE_LABEL } from "@/lib/fight-camp";
import {
  CORNER_LABEL,
  FIGHT_RECENCY_LABEL,
  ID_CONFIDENCE_WARN,
  MAX_VIDEO_SECONDS,
  VIDEO_TYPE_LABEL,
  analysisCounts,
  commitVideoAnalysis,
  deleteVideoAnalysisAsAdmin,
  flagVideoAnalysis,
  formatEur,
  listVideoAnalyses,
  isUploadStillActive,
  readVideoDuration,
  runVideoAnalysis,
  runVideoObservation,
  setAnalysisSharedWithAthlete,
  uploadVideoFile,
  type AnalysisMode,
  type CornerColor,
  type FightRecency,
  type GeminiTier,
  type VideoAnalysis,
  type VideoObservation,
  type VideoSource,
} from "@/lib/video-analysis";

/** Schnitte, wie sie im ganzen DeepFight-Bereich stehen. */
const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};
const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

/** Feld- und Zeilenflächen. Im Bereich ist --surface-raised halbdurchsichtig. */
const FLAECHE: React.CSSProperties = {
  background: "var(--surface-raised)",
  border: "1px solid var(--line)",
};

// ─── Helfer ─────────────────────────────────────────────────────────────────

/** "mm:ss" oder Sekunden-Zahl → Sekunden (null bei leerem/ungültigem Input). */
function parseTimecode(input: string): number | null {
  const t = input.trim();
  if (!t) return null;
  const mmss = /^(\d{1,3}):([0-5]?\d)$/.exec(t);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type RunStage = "idle" | "upload" | "gemini" | "claude" | "save";

/** Erfolgreicher Upload, der bei Fehlversuchen wiederverwendet wird (48 h gültig). */
interface PendingUpload {
  name: string;
  fileUri: string;
  mimeType: string;
  fileName: string;
  fileSize: number;
  durationSeconds: number | null;
}

/**
 * Fertige Gemini-Beobachtung aus einem früheren Versuch — "Analyse
 * fortsetzen" überspringt damit die (teure) Video-Stufe. Der Fingerprint
 * stellt sicher, dass Video + Kämpferbeschreibung unverändert sind.
 */
interface PendingObservation {
  observation: VideoObservation;
  model: string;
  fingerprint: string;
}

const RUN_STEPS: [Exclude<RunStage, "idle">, string][] = [
  ["upload", "Video hochladen"],
  ["gemini", "Video-Beobachtung (Gemini)"],
  ["claude", "Bewertung & Analyse"],
  ["save", "Speichern"],
];

// ─── Fortschritt (0–100 %) ──────────────────────────────────────────────────

type PhaseKey = Exclude<RunStage, "idle">;

/**
 * Anteil jeder Phase an der Gesamtanzeige — nach realistischer Laufzeit
 * gewichtet, nicht gleichmäßig. Übersprungene Phasen (YouTube-Quelle ohne
 * Upload, fortgesetzte Analyse ohne Gemini) fallen raus, der Rest wird
 * proportional auf 100 % gestreckt.
 */
const PHASE_SHARE: Record<PhaseKey, number> = {
  upload: 30,
  gemini: 42,
  claude: 25,
  save: 3,
};

/**
 * Zeitkonstante je Phase in Sekunden für die Schätzung `1 − e^(−t/τ)`.
 * Sie überbrückt die Phasen, in denen es objektiv nichts zu melden gibt —
 * Gemini liest das Video minutenlang ein, bevor überhaupt etwas zurückkommt.
 * Der Schätzer wird gedeckelt und kann den echten Wert daher nie überholen.
 */
const PHASE_TAU: Record<PhaseKey, number> = {
  upload: 45,
  gemini: 75,
  claude: 30,
  save: 3,
};

/** Obergrenze des Zeitschätzers je Phase — der Rest gehört dem echten Signal. */
const TIME_ESTIMATE_CAP = 0.92;

interface ProgressController {
  /** Angezeigter Wert 0–100, geglättet und monoton steigend. */
  percent: number;
  /** Legt fest, welche Phasen überhaupt laufen (bestimmt die Bänder). */
  begin: (phases: PhaseKey[]) => void;
  /** Wechselt in eine Phase — startet deren Zeitschätzer neu. */
  enter: (phase: PhaseKey) => void;
  /** Meldet echten Fortschritt 0–1 innerhalb der aktuellen Phase. */
  report: (fraction: number) => void;
  /** Setzt hart auf 100 % — das Ergebnis liegt vor. */
  complete: () => void;
  reset: () => void;
}

/**
 * Führt zwei Schätzer parallel und zeigt immer den höheren: den echten
 * Fortschritt (Bytes bzw. empfangene Zeichen) und einen Zeitschätzer als
 * Boden. Der angezeigte Wert fällt nie — auch nicht beim automatischen
 * Neustart nach einer Überlastung.
 */
function useAnalysisProgress(running: boolean): ProgressController {
  const [percent, setPercent] = useState(0);
  const phasesRef = useRef<PhaseKey[]>([]);
  const phaseRef = useRef<PhaseKey | null>(null);
  const startedAtRef = useRef(0);
  const realRef = useRef(0); // echtes Signal als Gesamtanteil 0–1
  const shownRef = useRef(0); // zuletzt angezeigter Wert 0–1

  const band = useCallback((phase: PhaseKey): [number, number] => {
    const active = phasesRef.current;
    const total = active.reduce((sum, p) => sum + PHASE_SHARE[p], 0);
    if (total <= 0) return [0, 1];
    let start = 0;
    for (const p of active) {
      const span = PHASE_SHARE[p] / total;
      if (p === phase) return [start, start + span];
      start += span;
    }
    return [start, 1];
  }, []);

  const reset = useCallback(() => {
    phasesRef.current = [];
    phaseRef.current = null;
    realRef.current = 0;
    shownRef.current = 0;
    setPercent(0);
  }, []);

  const begin = useCallback((phases: PhaseKey[]) => {
    phasesRef.current = phases;
  }, []);

  const enter = useCallback(
    (phase: PhaseKey) => {
      phaseRef.current = phase;
      startedAtRef.current = Date.now();
      const [start] = band(phase);
      realRef.current = Math.max(realRef.current, start);
    },
    [band],
  );

  const report = useCallback(
    (fraction: number) => {
      const phase = phaseRef.current;
      if (!phase) return;
      const [start, end] = band(phase);
      const value = start + (end - start) * Math.max(0, Math.min(1, fraction));
      realRef.current = Math.max(realRef.current, value);
    },
    [band],
  );

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const phase = phaseRef.current;
      let target = realRef.current;
      if (phase) {
        const [start, end] = band(phase);
        const elapsed = (Date.now() - startedAtRef.current) / 1000;
        const estimate =
          (1 - Math.exp(-elapsed / PHASE_TAU[phase])) * TIME_ESTIMATE_CAP;
        target = Math.max(target, start + (end - start) * estimate);
      }
      // Sanft nachziehen statt springen; nie rückwärts.
      const next = Math.max(
        shownRef.current,
        shownRef.current + (target - shownRef.current) * 0.25,
      );
      if (Math.round(next * 100) !== Math.round(shownRef.current * 100)) {
        setPercent(Math.round(next * 100));
      }
      shownRef.current = next;
    }, 150);
    return () => clearInterval(id);
  }, [running, band]);

  const complete = useCallback(() => {
    phaseRef.current = null;
    realRef.current = 1;
    shownRef.current = 1;
    setPercent(100);
  }, []);

  return { percent, begin, enter, report, complete, reset };
}

const inputStyle: React.CSSProperties = {
  ...FLAECHE,
  color: "var(--text-body)",
  font: "var(--type-sub)",
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  /** Erklärt in einem Satz, was das Feld ist und was daraus folgt. */
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="t-label">{label}</span>
      {children}
      {hint && (
        <span style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
          {hint}
        </span>
      )}
    </label>
  );
}

/**
 * Wie lange ein gemerkter Zwischenstand etwas wert ist: Google löscht ein
 * hochgeladenes Video nach 48 Stunden von selbst. Danach ist der Upload leer
 * und die Beobachtung kann nur noch mit einem neuen Video weiterlaufen.
 */
const PENDING_GUELTIG_MS = 48 * 60 * 60 * 1000;

/** „Noch 41 Stunden" / „Noch 25 Minuten" — null, wenn abgelaufen. */
function restzeitText(savedAt: number | null): string | null {
  if (!savedAt) return null;
  const rest = savedAt + PENDING_GUELTIG_MS - Date.now();
  if (rest <= 0) return null;
  const stunden = Math.floor(rest / 3_600_000);
  if (stunden >= 1) return `Noch ${stunden} ${stunden === 1 ? "Stunde" : "Stunden"} gültig`;
  const minuten = Math.max(1, Math.round(rest / 60_000));
  return `Noch ${minuten} ${minuten === 1 ? "Minute" : "Minuten"} gültig`;
}

/** Ein erledigter Schritt in der Fortsetzen-Zeile. */
function Erledigt({ text }: { text: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
    >
      <span style={{ color: "var(--positive)", lineHeight: 0 }}>
        <Icon name="check" size={13} strokeWidth={2.6} />
      </span>
      {text}
    </span>
  );
}

// ─── Sektion ────────────────────────────────────────────────────────────────

export default function VideoAnalysisSection({
  mode,
  targetId,
  targetName,
  opponent = null,
  onOpponentUpdated,
  fightProfile = null,
  onFightProfileUpdated,
  onAnalysesLoaded,
  expandId = null,
}: {
  mode: AnalysisMode;
  /** opponentId bzw. Schüler-uid. */
  targetId: string;
  targetName: string;
  /** Nur mode="opponent": aktuelles Profil (Kontext + Merge-Ziel). */
  opponent?: Opponent | null;
  /** Nach Übernahme in die DNA aufrufen (Profil neu laden). */
  onOpponentUpdated?: () => void;
  /** Nur mode="athlete": aktuelles Kampfprofil (Kontext + Merge-Ziel). */
  fightProfile?: FightProfile | null;
  /** Nach Übernahme ins Kampfprofil aufrufen (Profil neu laden). */
  onFightProfileUpdated?: () => void;
  /**
   * Meldet die Zahl der gespeicherten Analysen — die Werkbank auf
   * /trainer/deepfight zeigt sie in ihrer Ziel-Zeile („3 Videos"), ohne die
   * Liste ein zweites Mal zu laden. Rein informativ, nichts an der Pipeline.
   */
  onAnalysesLoaded?: (count: number) => void;
  /**
   * Klappt diese Analyse auf, sobald der Wert sich ändert — der Weg aus
   * „Meine Analysen" auf der Landung direkt zum Ergebnis.
   */
  expandId?: string | null;
}) {
  // Was eine Analyse gekostet hat und wer endgültig löschen darf, ist
  // Betreiber-Sache (Leon 08.09.2026). Wer gespeichert hat, trägt der Server
  // ein — ein Konto braucht die Sektion hier nicht mehr.
  const rights = useRights();

  const [analyses, setAnalyses] = useState<VideoAnalysis[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Der Aufrufer bekommt die Zahl bei JEDER Änderung der Liste — Laden,
  // Speichern, Löschen — über einen Ref, damit eine neue Callback-Identität
  // pro Render den Effekt nicht dauerfeuern lässt.
  const analysesLoadedRef = useRef(onAnalysesLoaded);
  analysesLoadedRef.current = onAnalysesLoaded;
  useEffect(() => {
    if (analyses) analysesLoadedRef.current?.(analyses.length);
  }, [analyses]);
  useEffect(() => {
    if (expandId) setExpandedId(expandId);
  }, [expandId]);

  // Die Ablage steht offen, sobald ein Ziel gewählt ist — kein Zwischenklick
  // (Leon zum Neuaufbau: „ich habe dort direkt mein Upload-Fenster"). Nach
  // einer fertigen Analyse klappt sie zu, damit das Ergebnis den Platz hat.
  const [formOpen, setFormOpen] = useState(true);
  const [sourceKind, setSourceKind] = useState<"upload" | "youtube">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  const [pendingObservation, setPendingObservation] =
    useState<PendingObservation | null>(null);
  /**
   * Wann der Zwischenstand gemerkt wurde — allein für die Anzeige „noch X
   * Stunden gültig". Bewusst ein EIGENES Feld und keins in `pendingUpload`
   * oder `pendingObservation`: Diese beiden Objekte gehen in die Pipeline und
   * in den Fingerprint-Vergleich; an ihnen wird nichts angefasst.
   */
  const [pendingSavedAt, setPendingSavedAt] = useState<number | null>(null);
  /** Liegt eine Datei über der Ablage? (Nur Zeiger-Geräte kennen das.) */
  const [ueberAblage, setUeberAblage] = useState(false);
  const ablageTiefe = useRef(0);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [ytStart, setYtStart] = useState("");
  const [ytEnd, setYtEnd] = useState("");
  const [corner, setCorner] = useState<CornerColor>("unknown");
  const [clothing, setClothing] = useState("");
  const [features, setFeatures] = useState("");
  const [startPosition, setStartPosition] = useState("");
  const [tier, setTier] = useState<GeminiTier>("flash");
  // Zeitliche Einordnung des Kampfes — optional, Standard "unbekannt".
  const [recency, setRecency] = useState<FightRecency>("unknown");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pipeline-Status
  const [stage, setStage] = useState<RunStage>("idle");
  const [stageDetail, setStageDetail] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const progress = useAnalysisProgress(stage !== "idle");
  // Display anlassen, solange die Pipeline läuft — verhindert, dass mobile
  // Browser den Upload beim Sperren des Bildschirms abbrechen.
  useWakeLock(stage !== "idle");

  // ── Formular-Persistenz: Kämpferbeschreibung überlebt Fehlversuche und
  //    Seiten-Reloads; erst eine ERFOLGREICHE Analyse löscht sie wieder. ──
  const storageKey = `ta-video-analysis-form:${mode}:${targetId}`;
  /**
   * ES MUSS EIN STATE SEIN, KEIN REF (gemessen und behoben 08.09.2026).
   *
   * Vorher stand hier ein `useRef`, und der Schreib-Effekt darunter prüfte
   * ihn. Ein Ref wird SOFORT wahr — der Schreib-Effekt lief also noch im
   * ersten Durchgang, mit den Werten aus dem Render VOR der Hydration, und
   * legte die Vorgaben über den gerade gelesenen Zwischenstand.
   *
   * Sichtbar wurde das an einer Merkwürdigkeit: Kleidung und Merkmale kamen
   * zurück, Ecke, Stufe und Zeitpunkt nicht. Der Grund ist die Vorgabe selbst
   * — `if (s.clothing)` überspringt einen leeren Text und lässt den bereits
   * gesetzten Wert stehen, `if (s.corner)` dagegen sieht in „unknown" einen
   * gültigen Wert und schreibt ihn drüber. Im Entwicklungs-Modus führt React
   * jeden Effekt doppelt aus, dort trat es bei JEDEM Laden auf; in Produktion
   * war es das Fenster zwischen zwei Rendern.
   *
   * Als State liegt die Marke im selben Bündel wie die gelesenen Werte: Der
   * Schreib-Effekt läuft erst, wenn sie wirklich da sind.
   *
   * SIE MERKT SICH DEN SCHLÜSSEL, nicht nur ein Ja: Wechselt das Ziel, zeigt
   * eine bloße Ja-Marke weiter auf den alten Stand — und der Schreib-Effekt
   * legte die Werte des vorigen Ziels in den Speicher des neuen. Genau der
   * Fall, den dieser Teilschritt ausschließen soll.
   */
  const [hydriertFuer, setHydriertFuer] = useState<string | null>(null);
  const hydriert = hydriertFuer === storageKey;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const s = JSON.parse(raw) as Partial<{
          corner: CornerColor;
          clothing: string;
          features: string;
          startPosition: string;
          tier: GeminiTier;
          recency: FightRecency;
          sourceKind: "upload" | "youtube";
          youtubeUrl: string;
          ytStart: string;
          ytEnd: string;
          pendingUpload: PendingUpload | null;
          pendingObservation: PendingObservation | null;
          pendingSavedAt: number | null;
        }>;
        if (s.corner) setCorner(s.corner);
        if (s.clothing) setClothing(s.clothing);
        if (s.features) setFeatures(s.features);
        if (s.startPosition) setStartPosition(s.startPosition);
        if (s.tier) setTier(s.tier);
        if (s.recency) setRecency(s.recency);
        if (s.sourceKind) setSourceKind(s.sourceKind);
        if (s.youtubeUrl) setYoutubeUrl(s.youtubeUrl);
        if (s.ytStart) setYtStart(s.ytStart);
        if (s.ytEnd) setYtEnd(s.ytEnd);
        if (s.pendingUpload?.name) setPendingUpload(s.pendingUpload);
        if (s.pendingObservation?.fingerprint)
          setPendingObservation(s.pendingObservation);
        // Einträge von vor dem 08.09.2026 tragen den Zeitpunkt nicht — dann
        // steht der Zwischenstand ohne Restzeit da, statt zu verschwinden.
        if (typeof s.pendingSavedAt === "number")
          setPendingSavedAt(s.pendingSavedAt);
      }
    } catch {
      /* defekter Eintrag → ignorieren */
    }
    setHydriertFuer(storageKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!hydriert) return; // nicht mit den Vorgaben überschreiben
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          corner,
          clothing,
          features,
          startPosition,
          tier,
          recency,
          sourceKind,
          youtubeUrl,
          ytStart,
          ytEnd,
          pendingUpload,
          pendingObservation,
          pendingSavedAt,
        }),
      );
    } catch {
      /* Speicher voll/blockiert → Feature ist optional */
    }
  }, [
    hydriert,
    storageKey,
    corner,
    clothing,
    features,
    startPosition,
    tier,
    recency,
    sourceKind,
    youtubeUrl,
    ytStart,
    ytEnd,
    pendingUpload,
    pendingObservation,
    pendingSavedAt,
  ]);

  const load = useCallback(async () => {
    setError(null);
    try {
      setAnalyses(await listVideoAnalyses(mode, targetId));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Analysen konnten nicht geladen werden",
      );
      setAnalyses([]);
    }
  }, [mode, targetId]);

  useEffect(() => {
    load();
  }, [load]);

  const profileContext = useMemo(() => {
    if (mode === "opponent" && opponent) {
      const parts = [
        `Stil: ${FIGHT_STYLE_LABEL[opponent.style]}`,
        `Auslage: ${FIGHTER_STANCE_LABEL[opponent.stance]}`,
      ];
      if (opponent.heightCm) parts.push(`Größe: ${opponent.heightCm} cm`);
      if (opponent.reachCm) parts.push(`Reichweite: ${opponent.reachCm} cm`);
      if (opponent.strengths.length)
        parts.push(`Bekannte Stärken: ${opponent.strengths.join(", ")}`);
      if (opponent.weaknesses.length)
        parts.push(`Bekannte Schwächen: ${opponent.weaknesses.join(", ")}`);
      if (opponent.notes) parts.push(`Notizen: ${opponent.notes}`);
      return parts.join(" · ");
    }
    return `Eigener Athlet des Gyms: ${targetName}`;
  }, [mode, opponent, targetName]);

  // Merge-Ziel vereinheitlicht: Gegner-DNA (opponents/{id}) bzw. Kampfprofil
  // (users/{uid}.fightProfile) — gleiche Form, unterschiedlicher Speicherort.
  const targetDna =
    mode === "opponent" ? (opponent?.dna ?? {}) : (fightProfile?.dna ?? {});
  const targetSplit =
    mode === "opponent"
      ? (opponent?.dnaSplit ?? null)
      : (fightProfile?.dnaSplit ?? null);
  const targetStats =
    mode === "opponent"
      ? (opponent?.actionStats ?? [])
      : (fightProfile?.actionStats ?? []);

  // ─── Pipeline starten ─────────────────────────────────────────────────────

  async function handleStart() {
    setRunError(null);
    progress.reset();
    // Bänder nur über die Phasen, die tatsächlich laufen — bei einem
    // YouTube-Link gibt es keinen Upload, also auch kein Upload-Band.
    progress.begin(
      sourceKind === "upload"
        ? ["upload", "gemini", "claude", "save"]
        : ["gemini", "claude", "save"],
    );

    let source: VideoSource;
    try {
      if (sourceKind === "upload") {
        // Token-/Zeit-Ersparnis: ein bereits hochgeladenes Video (48 h gültig)
        // wird wiederverwendet, statt es erneut hochzuladen — außer der
        // Nutzer hat inzwischen eine andere Datei gewählt.
        const matchesSelected =
          !!file &&
          !!pendingUpload &&
          pendingUpload.fileName === file.name &&
          pendingUpload.fileSize === file.size;
        let reuse: PendingUpload | null = null;
        if (pendingUpload && (!file || matchesSelected)) {
          setStage("upload");
          progress.enter("upload");
          setStageDetail("Bereits hochgeladenes Video wird geprüft …");
          if (await isUploadStillActive(pendingUpload.name)) {
            reuse = pendingUpload;
            progress.report(1); // Upload ist wirklich fertig
          } else {
            setPendingUpload(null); // abgelaufen/gelöscht → Neuupload nötig
          }
          setStageDetail(null);
        }

        if (reuse) {
          source = {
            kind: "upload",
            fileUri: reuse.fileUri,
            mimeType: reuse.mimeType,
            fileName: reuse.fileName,
            durationSeconds: reuse.durationSeconds,
          };
        } else {
          if (!file) {
            throw new Error(
              pendingUpload
                ? "Das zuvor hochgeladene Video ist nicht mehr gültig — bitte die Datei erneut auswählen."
                : "Bitte eine Videodatei auswählen.",
            );
          }
          const duration = await readVideoDuration(file);
          if (duration != null && duration > MAX_VIDEO_SECONDS + 5) {
            throw new Error(
              `Video ist ${Math.round(duration / 60)} Minuten lang — maximal 15 Minuten.`,
            );
          }
          setStage("upload");
          progress.enter("upload");
          const uploaded = await uploadVideoFile(file, (msg, fraction) => {
            setStageDetail(msg);
            if (fraction != null) progress.report(fraction);
          });
          setStageDetail(null);
          // Upload sofort merken — überlebt Fehlversuche und Reloads.
          setPendingUpload({
            name: uploaded.name,
            fileUri: uploaded.fileUri,
            mimeType: uploaded.mimeType,
            fileName: file.name,
            fileSize: file.size,
            durationSeconds: duration,
          });
          // Ab hier läuft Googles 48-Stunden-Uhr (nur für die Anzeige).
          setPendingSavedAt(Date.now());
          source = {
            kind: "upload",
            fileUri: uploaded.fileUri,
            mimeType: uploaded.mimeType,
            fileName: file.name,
            durationSeconds: duration,
          };
        }
      } else {
        if (!youtubeUrl.trim()) throw new Error("Bitte einen YouTube-Link angeben.");
        const startSeconds = parseTimecode(ytStart);
        const endSeconds = parseTimecode(ytEnd);
        if (
          startSeconds != null &&
          endSeconds != null &&
          endSeconds - startSeconds > MAX_VIDEO_SECONDS
        ) {
          throw new Error("Der Ausschnitt darf maximal 15 Minuten lang sein.");
        }
        source = {
          kind: "youtube",
          url: youtubeUrl.trim(),
          startSeconds,
          endSeconds,
        };
      }

      // Fingerprint: Beobachtung nur fortsetzen, wenn Video UND
      // Kämpferbeschreibung unverändert sind.
      const fingerprint = JSON.stringify({
        mode,
        tier,
        corner,
        clothing: clothing.trim(),
        features: features.trim(),
        startPosition: startPosition.trim(),
        src:
          source.kind === "upload"
            ? source.fileUri
            : `${source.url}|${source.startSeconds}|${source.endSeconds}`,
      });
      let cachedObs: PendingObservation | null =
        pendingObservation && pendingObservation.fingerprint === fingerprint
          ? pendingObservation
          : null;

      // Analyse mit Auto-Neustart: Bei Google-Überlastung (503) warten wir
      // kurz und starten automatisch neu — erst nach 3 Gesamtversuchen
      // bekommt der Nutzer die "später erneut versuchen"-Meldung. Sobald die
      // Gemini-Beobachtung vorliegt, wird sie gemerkt — jeder weitere Versuch
      // (auch nach Reload/Verbindungsabbruch) startet direkt bei Claude.
      const baseRequest = {
        mode,
        source,
        fighter: {
          name: targetName,
          corner,
          clothing: clothing.trim(),
          features: features.trim(),
          startPosition: startPosition.trim(),
        },
        tier,
        existingDna: targetDna,
        existingSplit: targetSplit,
        existingStats: targetStats,
        profileContext,
        recency,
      };
      const MAX_ATTEMPTS = 3;
      let result: Awaited<ReturnType<typeof runVideoAnalysis>> | null = null;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          // Phase 1 — Video-Beobachtung (eigener Request mit eigenem
          // 300-s-Budget), nur wenn noch keine Beobachtung vorliegt.
          if (!cachedObs) {
            setStage("gemini");
            progress.enter("gemini");
            const observed = await runVideoObservation(baseRequest);
            cachedObs = {
              observation: observed.observation,
              model: observed.model,
              fingerprint,
            };
            setPendingObservation(cachedObs);
          }
          // Phase 2 — Bewertung (eigener Request, Gemini wird übersprungen).
          setStage("claude");
          progress.enter("claude");
          result = await runVideoAnalysis(
            {
              ...baseRequest,
              observation: cachedObs.observation,
              observationModel: cachedObs.model,
            },
            (s) => {
              if (s === "claude") setStage(s);
            },
            undefined,
            (fraction) => progress.report(fraction),
          );
          break;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "";
          // Wiederholbar: Überlastung (Gemini/Claude) sowie abgerissene
          // Streams / Server-Timeouts ("kein Ergebnis").
          const retryable =
            msg.includes("überlastet") || msg.includes("kein Ergebnis");
          if (!retryable) throw err;
          if (attempt >= MAX_ATTEMPTS) {
            throw new Error(
              "Die KI-Dienste sind gerade stark ausgelastet — wir haben es automatisch 3× versucht. Bitte in ein paar Minuten auf Analyse fortsetzen tippen; Beschreibung, Upload und Zwischenstand bleiben gespeichert.",
            );
          }
          for (let s = 20; s > 0; s--) {
            setStageDetail(
              `KI-Dienst überlastet — automatischer Neustart in ${s} s (Versuch ${attempt + 1}/${MAX_ATTEMPTS})`,
            );
            await new Promise((r) => setTimeout(r, 1000));
          }
          setStageDetail(null);
        }
      }
      if (!result) throw new Error("Analyse lieferte kein Ergebnis");

      setStage("save");
      progress.enter("save");
      // Fingerabdruck der Quelle — erkennt denselben Upload beim zweiten
      // Mal (Etappe 3: „ersetzen oder zusätzlich?").
      const fileFingerprint =
        source.kind === "upload"
          ? `file:${source.fileName}|${file?.size ?? pendingUpload?.fileSize ?? 0}|${source.durationSeconds ?? ""}`
          : `yt:${source.url}|${source.startSeconds ?? ""}|${source.endSeconds ?? ""}`;
      // Der Server speichert, bucht die Kosten und rechnet das Profil aus
      // allen Analysen neu — hier fällt kein Klick mehr an.
      const saved = await commitVideoAnalysis({
        mode,
        targetId,
        targetName,
        sourceKind: source.kind,
        sourceLabel:
          source.kind === "upload" ? source.fileName : source.url,
        youtubeUrl: source.kind === "youtube" ? source.url : null,
        fileFingerprint,
        fighter: {
          name: targetName,
          corner,
          clothing: clothing.trim(),
          features: features.trim(),
          startPosition: startPosition.trim(),
        },
        tier,
        recency,
        fightMonth: null,
        models: result.models,
        usage: result.usage,
        observation: result.observation,
        evaluation: result.evaluation,
      });
      notifyTargetUpdated();

      progress.complete();
      setAnalyses((prev) => [saved, ...(prev ?? [])]);
      setExpandedId(saved.id);
      setFormOpen(false);
      setFile(null);
      setYoutubeUrl("");
      setYtStart("");
      setYtEnd("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      // Erfolg → gespeicherte Kämpferbeschreibung, gemerkten Upload und
      // Zwischenstand löschen (das Video wurde serverseitig entfernt).
      setPendingUpload(null);
      setPendingObservation(null);
      setPendingSavedAt(null);
      setCorner("unknown");
      setClothing("");
      setFeatures("");
      setStartPosition("");
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* optionales Feature */
      }
    } catch (err) {
      setRunError(
        err instanceof Error ? err.message : "Analyse fehlgeschlagen",
      );
    } finally {
      setStage("idle");
      setStageDetail(null);
    }
  }

  // ─── Nach der Rechnung: Profil neu laden, Marken setzen ─────────────────

  function notifyTargetUpdated() {
    if (mode === "opponent") onOpponentUpdated?.();
    else onFightProfileUpdated?.();
  }

  /**
   * „Falscher Kämpfer": nimmt die Analyse aus der Rechnung (oder wieder
   * hinein). Der Server rechnet das Profil neu und liefert das Dokument
   * zurück; die Liste zeigt danach „Zählt nicht".
   */
  async function toggleWrongFighter(a: VideoAnalysis) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await flagVideoAnalysis(mode, targetId, a.id, !a.wrongFighter);
      setAnalyses((prev) => (prev ?? []).map((x) => (x.id === a.id ? updated : x)));
      notifyTargetUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Markieren fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  // Endgültig löschen darf nur der Plattform-Admin (Demo-Bestand). Die
  // Rueckfrage steht im VideoAnalysisResult, direkt am Knopf.
  async function handleDelete(a: VideoAnalysis) {
    setBusy(true);
    try {
      await deleteVideoAnalysisAsAdmin(mode, targetId, a.id);
      setAnalyses((prev) => (prev ?? []).filter((x) => x.id !== a.id));
      if (expandedId === a.id) setExpandedId(null);
      notifyTargetUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  /** mode=athlete: Auswertung für den Schüler freigeben / Freigabe zurückziehen. */
  async function toggleSharedWithAthlete(a: VideoAnalysis) {
    setBusy(true);
    try {
      const next = !a.sharedWithAthlete;
      await setAnalysisSharedWithAthlete(targetId, a.id, next);
      setAnalyses((prev) =>
        (prev ?? []).map((x) =>
          x.id === a.id ? { ...x, sharedWithAthlete: next } : x,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Freigabe fehlgeschlagen",
      );
    } finally {
      setBusy(false);
    }
  }

  // ─── Die Ablage: ziehen, einfügen, wählen ────────────────────────────────

  /**
   * Nimmt eine Videodatei an, egal woher sie kommt — Dateidialog, gezogen
   * oder eingefügt. Der gemerkte Upload bleibt bewusst stehen: `handleStart`
   * vergleicht Name und Größe und lädt nur neu hoch, wenn es wirklich eine
   * andere Datei ist.
   */
  const nimmDatei = useCallback((f: File | null | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      setRunError(
        `„${f.name}" ist kein Video. Leg eine Videodatei ab — MP4, MOV und was dein Handy sonst aufnimmt.`,
      );
      return;
    }
    setSourceKind("upload");
    setFile(f);
    setRunError(null);
  }, []);

  const istYoutube = (t: string) => /(?:youtube\.com|youtu\.be)\//i.test(t);

  /**
   * Einfügen aus der Zwischenablage (UX-Punkt 4 des Brainstorms): eine
   * kopierte Videodatei ODER ein YouTube-Link. Der Link schaltet die Quelle
   * selbst um — wer einen Link einfügt, meint keinen Datei-Upload.
   *
   * Der Lauscher hängt am Fenster, weil ein Ziel-Element den Fokus haben
   * müsste, das es hier nicht gibt. Steht der Cursor in einem Eingabefeld,
   * hält er sich heraus: Dort gehört das Eingefügte hin.
   */
  useEffect(() => {
    if (!formOpen || stage !== "idle") return;
    function onPaste(e: ClipboardEvent) {
      const ziel = e.target as HTMLElement | null;
      if (
        ziel &&
        (ziel.tagName === "INPUT" ||
          ziel.tagName === "TEXTAREA" ||
          ziel.isContentEditable)
      ) {
        return;
      }
      const datei = Array.from(e.clipboardData?.files ?? []).find((f) =>
        f.type.startsWith("video/"),
      );
      if (datei) {
        e.preventDefault();
        nimmDatei(datei);
        return;
      }
      const text = e.clipboardData?.getData("text")?.trim() ?? "";
      if (istYoutube(text)) {
        e.preventDefault();
        setSourceKind("youtube");
        setYoutubeUrl(text);
        setRunError(null);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [formOpen, stage, nimmDatei]);

  /**
   * Beim Ziehen feuert `dragleave` auch, wenn der Zeiger von der Fläche auf
   * eines ihrer Kinder wechselt. Ein Zähler hält den Zustand ruhig — sonst
   * flackert der Rahmen unter dem Finger.
   */
  function ablageEnter(e: React.DragEvent) {
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    ablageTiefe.current += 1;
    setUeberAblage(true);
  }
  function ablageLeave() {
    ablageTiefe.current = Math.max(0, ablageTiefe.current - 1);
    if (ablageTiefe.current === 0) setUeberAblage(false);
  }
  function ablageDrop(e: React.DragEvent) {
    e.preventDefault();
    ablageTiefe.current = 0;
    setUeberAblage(false);
    nimmDatei(e.dataTransfer.files?.[0]);
  }

  /** Zwischenstand wegwerfen und mit einem neuen Video anfangen. */
  function verwirfZwischenstand() {
    setPendingUpload(null);
    setPendingObservation(null);
    setPendingSavedAt(null);
    setFile(null);
    setRunError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const running = stage !== "idle";
  const visibleSteps = RUN_STEPS.filter(
    ([s]) => sourceKind === "upload" || s !== "upload",
  );
  /** Etwas Angefangenes liegt bereit — Upload, Beobachtung oder beides. */
  const hatZwischenstand = !!pendingUpload || !!pendingObservation;
  const restzeit = restzeitText(pendingSavedAt);

  return (
    <div className="flex flex-col gap-4">
      {/* Kopf */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="t-label">KI-Video-Analyse</div>
          <p
            className="mt-0.5"
            style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
          >
            Leg ein Kampf-Video ab (max. 15 Minuten) oder verlink eins — die KI
            zählt, beobachtet und bewertet{" "}
            {mode === "opponent" ? "den Gegner" : "deinen Athleten"}.
          </p>
        </div>
        {/* Der Knopf schrumpft weg, statt zu verschwinden — die Ablage
            darunter wächst zeitgleich auf (Collapse). */}
        <MorphSwap activeKey={!formOpen && !running ? "knopf" : "leer"}>
          {!formOpen && !running && (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="t-interactive inline-flex min-h-hit shrink-0 items-center gap-2 rounded-field px-4"
              style={{
                ...BTN_FONT,
                background: "var(--accent)",
                color: "var(--on-accent)",
                boxShadow: "var(--accent-glow)",
              }}
            >
              <Icon name="video" size={13} strokeWidth={2.4} /> Neue Analyse
            </button>
          )}
        </MorphSwap>
      </div>

      {error && (
        <div className="t-danger rounded-field px-3 py-2" style={{ font: "var(--type-sub)" }}>
          {error}
        </div>
      )}

      {/* ── Angefangenes (UX-Punkt 5) ────────────────────────────────────────
          Bis 08.09.2026 steckte diese Auskunft IM Formular: Wer es zuklappte,
          sah nicht, dass ein hochgeladenes Video und eine fertige Beobachtung
          auf ihn warten — und startete unter Umständen alles neu, auf eigene
          Kosten. Jetzt steht sie oben und trägt beide Wege. */}
      <Collapse open={hatZwischenstand && !running}>
        <div
          className="flex flex-col gap-3 rounded-card p-4"
          style={{
            background: "color-mix(in oklab, var(--positive) 12%, transparent)",
            border: "1px solid color-mix(in oklab, var(--positive) 40%, transparent)",
          }}
        >
          <div>
            <div className="t-label" style={{ color: "var(--positive)" }}>
              Angefangene Analyse
            </div>
            <p className="mt-0.5" style={{ font: "var(--type-body-strong)" }}>
              {pendingUpload
                ? `${pendingUpload.fileName} wartet auf dich.`
                : "Ein Zwischenstand wartet auf dich."}
            </p>
            <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
              Du machst da weiter, wo du warst — das spart die teure
              Video-Stufe und läuft direkt in die Bewertung.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {pendingUpload && <Erledigt text="Video liegt bei Google" />}
            {pendingObservation && <Erledigt text="Video ist ausgewertet" />}
            {restzeit && (
              <span style={{ ...META_FONT, color: "var(--text-2)" }}>
                {restzeit}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setFormOpen(true);
                void handleStart();
              }}
              className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-5"
              style={{
                ...BTN_FONT,
                background: "var(--accent)",
                color: "var(--on-accent)",
                boxShadow: "var(--accent-glow)",
              }}
            >
              <Icon name="play" size={13} strokeWidth={2.4} />
              Analyse fortsetzen
            </button>
            <button
              type="button"
              onClick={verwirfZwischenstand}
              className="t-interactive inline-flex min-h-hit items-center rounded-field px-4"
              style={{ ...BTN_FONT, color: "var(--text-2)", ...FLAECHE }}
            >
              Verwerfen und neu anfangen
            </button>
          </div>
        </div>
      </Collapse>

      {/* Ablage */}
      <Collapse open={formOpen && !running}>
        <div className="flex flex-col gap-4 rounded-card p-4" style={FLAECHE}>
          {/* Quelle */}
          <div className="flex gap-2" role="group" aria-label="Videoquelle">
            {(
              [
                ["upload", "Datei"],
                ["youtube", "YouTube-Link"],
              ] as const
            ).map(([kind, label]) => {
              const aktiv = sourceKind === kind;
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setSourceKind(kind)}
                  aria-pressed={aktiv}
                  className="t-interactive inline-flex min-h-hit items-center rounded-field px-4"
                  style={{
                    ...BTN_FONT,
                    background: aktiv ? "var(--accent)" : "var(--surface-card)",
                    color: aktiv ? "var(--on-accent)" : "var(--text-2)",
                    border: `1px solid ${aktiv ? "var(--accent)" : "var(--line)"}`,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {sourceKind === "upload" ? (
            /* DIE ABLAGE (UX-Punkt 4): ziehen, einfügen oder wählen — drei
               Wege auf eine Fläche. Sie ist zugleich ein Knopf, weil es auf
               Touch kein Ziehen gibt und Hover nie allein trägt
               (MOTION-BRIEF §3.3). Das Dateifeld liegt versteckt darunter. */
            <div
              onDragEnter={ablageEnter}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={ablageLeave}
              onDrop={ablageDrop}
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                data-press="surface"
                className="t-interactive flex w-full flex-col items-center gap-2 rounded-card px-4 py-8 text-center"
                style={{
                  background: ueberAblage
                    ? "var(--accent-subtle)"
                    : "var(--surface-card)",
                  border: `1.5px dashed ${ueberAblage ? "var(--accent)" : "var(--line-strong)"}`,
                }}
              >
                <span
                  style={{
                    color: ueberAblage ? "var(--accent-text)" : "var(--text-2)",
                    lineHeight: 0,
                  }}
                >
                  <Icon name="video" size={26} strokeWidth={1.8} />
                </span>
                {file ? (
                  <>
                    <span
                      className="max-w-full truncate"
                      style={{ font: "var(--type-body-strong)" }}
                    >
                      {file.name}
                    </span>
                    <span style={{ ...META_FONT, color: "var(--text-2)" }}>
                      {(file.size / 1_048_576).toFixed(0)} MB · Tipp hier für
                      ein anderes Video
                    </span>
                  </>
                ) : pendingUpload ? (
                  <>
                    <span
                      className="max-w-full truncate"
                      style={{ font: "var(--type-body-strong)" }}
                    >
                      {pendingUpload.fileName}
                    </span>
                    <span style={{ ...META_FONT, color: "var(--text-2)" }}>
                      Liegt schon oben · Tipp hier für ein anderes Video
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ font: "var(--type-body-strong)" }}>
                      {ueberAblage
                        ? "Lass los"
                        : "Zieh dein Video hierher"}
                    </span>
                    <span style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                      Oder tipp hier und such es aus. Kopiertes fügst du mit
                      Strg+V ein — auch einen YouTube-Link. Bis 15 Minuten,
                      MP4, MOV und was dein Handy sonst aufnimmt.
                    </span>
                  </>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="sr-only"
                onChange={(e) => nimmDatei(e.target.files?.[0])}
              />
            </div>
          ) : (
            <>
              <Field
                label="YouTube-Link"
                hint="Die KI liest das Video direkt von YouTube — hochladen musst du nichts."
              >
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                  className="min-h-hit rounded-field px-3"
                  style={inputStyle}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start (mm:ss, optional)">
                  <input
                    value={ytStart}
                    onChange={(e) => setYtStart(e.target.value)}
                    placeholder="z. B. 2:30"
                    className="min-h-hit rounded-field px-3"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Ende (mm:ss, optional)">
                  <input
                    value={ytEnd}
                    onChange={(e) => setYtEnd(e.target.value)}
                    placeholder="z. B. 17:30"
                    className="min-h-hit rounded-field px-3"
                    style={inputStyle}
                  />
                </Field>
              </div>
            </>
          )}

          {/* Kämpfer-Beschreibung */}
          <div>
            <div className="t-label">Wer ist {targetName} im Video?</div>
            <p
              className="mt-0.5"
              style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
            >
              Je genauer du ihn beschreibst, desto sicherer erkennt ihn die KI
              — bei zwei ähnlichen Kämpfern entscheidet genau das.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Ecke">
              {/* ROT UND BLAU SIND DIE SACHE, NICHT DER SCHMUCK (Leon
                  08.09.2026): Wer das Video vor sich hat, sucht nach genau
                  diesen zwei Farben. Sie stehen als feste Tokens in
                  globals.css — der Punkt zeigt sie auch im nicht gewählten
                  Zustand, damit die Farbe nie allein das Signal ist. */}
              <div className="flex gap-1.5">
                {(Object.keys(CORNER_LABEL) as CornerColor[]).map((c) => {
                  const aktiv = corner === c;
                  const farbe =
                    c === "red"
                      ? "var(--corner-red)"
                      : c === "blue"
                        ? "var(--corner-blue)"
                        : null;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCorner(c)}
                      aria-pressed={aktiv}
                      className="t-interactive flex min-h-hit flex-1 items-center justify-center gap-1.5 rounded-field px-2"
                      style={{
                        ...META_FONT,
                        background: aktiv
                          ? (farbe ?? "var(--accent)")
                          : "var(--surface-card)",
                        color: aktiv
                          ? farbe
                            ? "var(--on-corner)"
                            : "var(--on-accent)"
                          : "var(--text-2)",
                        border: `1px solid ${aktiv ? (farbe ?? "var(--accent)") : "var(--line)"}`,
                      }}
                    >
                      {farbe && !aktiv && (
                        <span
                          aria-hidden
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: farbe }}
                        />
                      )}
                      {CORNER_LABEL[c]}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Hose / Rashguard">
              <input
                value={clothing}
                onChange={(e) => setClothing(e.target.value)}
                placeholder="z. B. schwarze Shorts, weißes Logo"
                className="min-h-hit rounded-field px-3"
                style={inputStyle}
              />
            </Field>
            <Field label="Merkmale (Tattoos, Haare, Statur …)">
              <input
                value={features}
                onChange={(e) => setFeatures(e.target.value)}
                placeholder="z. B. Tattoo rechter Unterarm, der Größere"
                className="min-h-hit rounded-field px-3"
                style={inputStyle}
              />
            </Field>
            <Field label="Startposition (optional)">
              <input
                value={startPosition}
                onChange={(e) => setStartPosition(e.target.value)}
                placeholder="z. B. steht bei 0:00 links im Bild"
                className="min-h-hit rounded-field px-3"
                style={inputStyle}
              />
            </Field>
            {/* DER TEXT FOLGT DER AUSWAHL: Die Beruhigung „Unbekannt ist in
                Ordnung" gehört zu genau einem Zustand — unter „Letzte 6
                Monate" beantwortet sie eine Frage, die niemand mehr hat. */}
            <Field
              label="Wann fand der Kampf statt?"
              hint={
                recency === "unknown"
                  ? "Bestimmt mit, wie stark dieses Video das Profil gewichtet. Weißt du es nicht, ist das in Ordnung — dann zählt es fast voll."
                  : "Bestimmt mit, wie stark dieses Video das Profil gewichtet: Je frischer der Kampf, desto mehr Gewicht bekommt er."
              }
            >
              <Select
                value={recency}
                onChange={(v) => setRecency(v as FightRecency)}
                options={(
                  ["unknown", "recent", "mid", "old", "ancient"] as FightRecency[]
                ).map((r) => ({ value: r, label: FIGHT_RECENCY_LABEL[r] }))}
              />
            </Field>
          </div>

          {/* Modellstufe */}
          <Field label="Analyse-Stufe">
            <div className="flex flex-col gap-1.5 sm:flex-row">
              {(
                [
                  ["flash", "Standard", "Schnell und günstig — die Stufe für den Alltag."],
                  [
                    "pro",
                    "Detail-Analyse",
                    "Genauer, dafür braucht sie den Gemini-Bezahltarif.",
                  ],
                ] as const
              ).map(([t, label, hint]) => {
                const aktiv = tier === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTier(t)}
                    aria-pressed={aktiv}
                    data-press="surface"
                    className="t-interactive flex-1 rounded-field px-3 py-2.5 text-left"
                    style={{
                      background: aktiv
                        ? "var(--accent-subtle)"
                        : "var(--surface-card)",
                      border: `1px solid ${aktiv ? "var(--accent)" : "var(--line)"}`,
                    }}
                  >
                    <div
                      style={{
                        ...META_FONT,
                        color: aktiv ? "var(--accent-text)" : "var(--text-body)",
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
                    >
                      {hint}
                    </div>
                  </button>
                );
              })}
            </div>
          </Field>

          {runError && (
            <div className="t-danger rounded-field px-3 py-2" style={{ font: "var(--type-sub)" }}>
              {runError}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleStart}
              className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-5"
              style={{
                ...BTN_FONT,
                background: "var(--accent)",
                color: "var(--on-accent)",
                boxShadow: "var(--accent-glow)",
              }}
            >
              <Icon name="spark" size={13} strokeWidth={2.4} />
              {pendingObservation ? "Analyse fortsetzen" : "Analyse starten"}
            </button>
            {analyses !== null && analyses.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false);
                  setRunError(null);
                }}
                className="t-interactive inline-flex min-h-hit items-center rounded-field px-4"
                style={{ ...BTN_FONT, color: "var(--text-2)" }}
              >
                Zuklappen
              </button>
            )}
          </div>
        </div>
      </Collapse>

      {/* Fortschritt — Vollbild-Overlay: KI-Loader mittig, Schritte darunter */}
      {running && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6"
          style={{
            // NICHT `--overlay`: Der Token deckt ein Sheet ab, hinter dem die
            // Seite ruhig steht. Hier liegt eine BEWEGTE Schicht dahinter, und
            // bei 68 % las man die Sektion durch den Loader hindurch (gemessen
            // am Bild, 08.09.2026). Der Seitengrund mit 92 % deckt wirklich zu
            // und folgt trotzdem beiden Themes.
            background: "color-mix(in oklab, var(--surface-page) 92%, transparent)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          <div className="ai-loader-wrapper" aria-label="Analyse läuft">
            <div className="ai-loader" />
            {"Analysiere".split("").map((ch, i) => (
              <span
                key={i}
                className="ai-loader-letter"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                {ch}
              </span>
            ))}
          </div>
          {/* Gesamtfortschritt: echtes Signal, wo vorhanden — sonst Schätzung.
              Der Wert läuft nie rückwärts und springt nicht stufenweise. */}
          <div
            className="mt-4 tabular-nums"
            style={{ font: "var(--type-num-xl)", color: "var(--accent-text)" }}
            aria-live="polite"
          >
            {progress.percent} %
          </div>
          <div className="t-progress mt-2 w-full max-w-xs">
            <span
              style={{
                width: `${progress.percent}%`,
                transition: "width 200ms linear",
              }}
            />
          </div>
          <p
            className="mt-4 max-w-xs text-center"
            style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
          >
            Das dauert ein paar Minuten. Lass die App im Vordergrund — der
            Bildschirm bleibt von selbst an.
          </p>
          <div className="mt-5 flex w-full max-w-xs flex-col gap-2">
            {visibleSteps.map(([s, label]) => {
              const order = visibleSteps.findIndex(([x]) => x === s);
              const current = visibleSteps.findIndex(([x]) => x === stage);
              const done = order < current;
              const active = s === stage;
              return (
                <div
                  key={s}
                  className="flex items-start gap-2"
                  style={{ font: "var(--type-sub)" }}
                >
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: done
                        ? "color-mix(in oklab, var(--positive) 18%, transparent)"
                        : active
                          ? "var(--accent-subtle)"
                          : "var(--surface-raised)",
                      color: done
                        ? "var(--positive)"
                        : active
                          ? "var(--accent-text)"
                          : "var(--text-2)",
                    }}
                  >
                    {done ? (
                      <Icon name="check" size={11} strokeWidth={2.6} />
                    ) : active ? (
                      <span
                        className="h-2 w-2 animate-pulse rounded-full"
                        style={{ background: "var(--accent)" }}
                      />
                    ) : (
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: "var(--line-strong)" }}
                      />
                    )}
                  </span>
                  {/* Der Detailtext steht UNTER dem Schritt, nicht daneben:
                      Sätze wie „Bereits hochgeladenes Video wird geprüft …"
                      sprengten die 320 px der Liste und schoben sich über die
                      nächste Zeile (gemessen am Bild, 08.09.2026). */}
                  <span
                    className="min-w-0"
                    style={{
                      color: active ? "var(--text-1)" : "var(--text-2)",
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {label}
                    {active && stageDetail && (
                      <span
                        className="block"
                        style={{ font: "var(--type-sub)", color: "var(--accent-text)" }}
                      >
                        {stageDetail}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Analysen-Liste */}
      {analyses === null ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full rounded-field" />
          <Skeleton className="h-16 w-full rounded-field" />
        </div>
      ) : analyses.length === 0 ? (
        !formOpen && !running && (
          <div className="rounded-card p-8 text-center" style={FLAECHE}>
            <p style={{ font: "var(--type-body-strong)" }}>
              Noch kein Video ausgewertet.
            </p>
            <p
              className="mx-auto mt-1 max-w-md"
              style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
            >
              Jedes analysierte Video wird ein eigener Beitrag
              {mode === "opponent"
                ? " — mit jedem wird der Gegner schärfer."
                : " — mit jedem wird das Kampfprofil genauer."}
            </p>
          </div>
        )
      ) : (
        // Die Liste ändert sich unter dem Trainer: Eine neue Analyse legt sich
        // oben drauf, eine gelöschte geht. Beide Bewegungen gehören dazu
        // (MOTION-BRIEF §1.1) — Schlüssel ist die Firestore-ID, nie der Index.
        <StaggerFlow className="flex flex-col gap-2">
          {analyses.map((a, i) => {
            const open = expandedId === a.id;
            const idWarn =
              a.observation.identification.idConfidence < ID_CONFIDENCE_WARN;
            // Zählt diese Analyse im Profil? Nein bei zu enger Kämpfer-
            // Sicherheit (Tor) oder gesetzter Marke „falscher Kämpfer".
            const zaehlt = analysisCounts(a);
            return (
              <FlowItem key={a.id} index={i}>
                <button
                  type="button"
                  onClick={() => setExpandedId(open ? null : a.id)}
                  aria-expanded={open}
                  data-press="quiet"
                  className="t-interactive flex min-h-hit w-full items-center gap-3 rounded-field px-3 py-2.5 text-left"
                  style={{
                    background: open
                      ? "var(--accent-subtle)"
                      : "var(--surface-raised)",
                    border: `1px solid ${open ? "var(--accent)" : "var(--line)"}`,
                  }}
                >
                  <span
                    className="shrink-0"
                    style={{
                      color: open ? "var(--accent-text)" : "var(--text-2)",
                      lineHeight: 0,
                    }}
                  >
                    <Icon name="video" size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate"
                      style={{
                        font: "var(--type-body-strong)",
                        color: open ? "var(--accent-text)" : "var(--text-body)",
                      }}
                    >
                      {a.sourceLabel}
                    </span>
                    <span
                      className="block truncate"
                      style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
                    >
                      {formatDate(a.createdAt)} ·{" "}
                      {VIDEO_TYPE_LABEL[a.videoType]} ·{" "}
                      {a.tier === "pro" ? "Detail" : "Standard"}
                      {/* Was eine Analyse gekostet hat, ist Betreiber-Sache
                          (Leon 08.09.2026) — im Gym steht keine Zahl mehr. */}
                      {rights.admin &&
                        (a.usage
                          ? ` · ca. ${formatEur(a.usage.costEur)}`
                          : " · gratis gelaufen")}
                      {mode === "athlete" &&
                        a.sharedWithAthlete &&
                        " · für den Athleten freigegeben"}
                    </span>
                  </span>
                  {/* Der ZUSTAND färbt: drin oder draußen. Text steht
                      daneben — Farbe ist nie das alleinige Signal. */}
                  <span
                    className="hidden shrink-0 rounded-badge px-2 py-0.5 sm:inline"
                    style={{
                      ...META_FONT,
                      color: zaehlt ? "var(--positive)" : "var(--warning)",
                      border: `1px solid color-mix(in oklab, ${zaehlt ? "var(--positive)" : "var(--warning)"} 40%, transparent)`,
                    }}
                  >
                    {zaehlt ? "Im Profil" : "Zählt nicht"}
                  </span>
                  {idWarn && (
                    <span
                      className="shrink-0"
                      style={{ color: "var(--warning)", lineHeight: 0 }}
                      title="Unsichere Identifikation"
                    >
                      <Icon name="warn" size={15} />
                    </span>
                  )}
                  <span
                    aria-hidden
                    className="shrink-0"
                    style={{
                      color: "var(--text-2)",
                      transform: open ? "rotate(180deg)" : "none",
                      transition: "transform var(--dur-fast) var(--ease-out)",
                      lineHeight: 0,
                    }}
                  >
                    <Icon name="chevron-down" size={16} strokeWidth={2.2} />
                  </span>
                </button>

                {/* Das Ergebnis klappt auf und wieder zu, statt zu poppen. */}
                <Collapse open={open}>
                  <div className="mt-2 flex flex-col gap-2">
                    {mode === "athlete" && (
                      <div
                        className="flex flex-wrap items-center justify-between gap-2 rounded-field px-3 py-2.5"
                        style={
                          a.sharedWithAthlete
                            ? {
                                background:
                                  "color-mix(in oklab, var(--positive) 12%, transparent)",
                                border:
                                  "1px solid color-mix(in oklab, var(--positive) 40%, transparent)",
                              }
                            : FLAECHE
                        }
                      >
                        <span
                          style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
                        >
                          {a.sharedWithAthlete
                            ? `${targetName} sieht diese Auswertung im eigenen Kampfprofil.`
                            : "Diese Auswertung sehen bisher nur Trainer. Gib sie frei, und sie steht im Kampfprofil des Athleten."}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleSharedWithAthlete(a)}
                          disabled={busy}
                          className="t-interactive inline-flex min-h-hit items-center rounded-field px-4 disabled:opacity-60"
                          style={
                            a.sharedWithAthlete
                              ? { ...BTN_FONT, color: "var(--text-2)", ...FLAECHE }
                              : {
                                  ...BTN_FONT,
                                  background: "var(--accent)",
                                  color: "var(--on-accent)",
                                }
                          }
                        >
                          {a.sharedWithAthlete
                            ? "Freigabe zurückziehen"
                            : "Für den Athleten freigeben"}
                        </button>
                      </div>
                    )}
                    {/* Falscher Kämpfer: raus aus der Rechnung, umkehrbar. */}
                    <div
                      className="flex flex-wrap items-center justify-between gap-2 rounded-field px-3 py-2.5"
                      style={
                        a.wrongFighter
                          ? {
                              background:
                                "color-mix(in oklab, var(--warning) 12%, transparent)",
                              border:
                                "1px solid color-mix(in oklab, var(--warning) 40%, transparent)",
                            }
                          : FLAECHE
                      }
                    >
                      <span
                        style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
                      >
                        {a.wrongFighter
                          ? "Du hast diese Analyse als falschen Kämpfer markiert — sie zählt nicht im Profil."
                          : !a.weight.identified
                            ? "Die KI war sich beim Kämpfer nicht sicher genug — diese Analyse zählt nicht im Profil."
                            : `Diese Analyse zählt im Profil zu ${Math.round(a.weight.value * 100)} Prozent: ${VIDEO_TYPE_LABEL[a.videoType]}, ${FIGHT_RECENCY_LABEL[a.recency]}.`}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleWrongFighter(a)}
                        disabled={busy}
                        className="t-interactive inline-flex min-h-hit items-center rounded-field px-4 disabled:opacity-60"
                        style={{ ...BTN_FONT, color: "var(--text-2)", ...FLAECHE }}
                      >
                        {a.wrongFighter ? "Zählt doch" : "Falscher Kämpfer"}
                      </button>
                    </div>
                    {/* Keine Übernehmen-Rückrufe, keine existingDna mehr:
                        Das Profil ist schon gerechnet (Etappe 1). Löschen
                        bleibt Betreiber-Sache. */}
                    <VideoAnalysisResult
                      analysis={a}
                      mode={mode}
                      existingDna={null}
                      busy={busy}
                      onDelete={rights.admin ? () => handleDelete(a) : undefined}
                    />
                  </div>
                </Collapse>
              </FlowItem>
            );
          })}
        </StaggerFlow>
      )}
    </div>
  );
}
