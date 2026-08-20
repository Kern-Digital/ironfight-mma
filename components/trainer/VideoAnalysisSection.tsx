"use client";

/**
 * KI-Video-Analyse — komplette Sektion (Konzept §6).
 *
 * Wird auf der Gegner-Detailseite (mode="opponent") und der Schüler-Detailseite
 * (mode="athlete") eingebunden. Ablauf:
 *   1. Formular: Videoquelle (Datei ≤15 Min oder YouTube-Link) + Beschreibung,
 *      welcher Kämpfer ausgewertet werden soll + Modellstufe (Flash/Pro).
 *   2. Pipeline: Upload → Gemini-Beobachtung → Claude-Bewertung (Streaming-
 *      Fortschritt über /api/video-analysis/analyze).
 *   3. Ergebnis wird in Firestore gespeichert; Befunde können per
 *      Trainer-Review übernommen werden — im Gegner-Modus in die Gegner-DNA
 *      (opponents/{id}), im Athleten-Modus in das Kampfprofil des Nutzers
 *      (users/{uid}.fightProfile, siehe lib/fight-profile.ts).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import { useWakeLock } from "@/lib/use-wake-lock";
import VideoAnalysisResult from "./VideoAnalysisResult";
import AiBudgetGauge, { formatEur } from "./AiBudgetGauge";
import { useAuth } from "@/lib/auth-context";
import { updateOpponent, type Opponent } from "@/lib/opponents";
import {
  getFightProfile,
  updateFightProfile,
  type FightProfile,
} from "@/lib/fight-profile";
import {
  cleanActionStats,
  mergeDnaSplit,
  type ActionStat,
  type DnaSplit,
} from "@/lib/fight-stats";
import { FIGHTER_STANCE_LABEL, FIGHT_STYLE_LABEL } from "@/lib/fight-camp";
import {
  CORNER_LABEL,
  FIGHT_RECENCY_LABEL,
  ID_CONFIDENCE_WARN,
  MAX_VIDEO_SECONDS,
  computeVideoWeight,
  deleteVideoAnalysis,
  listVideoAnalyses,
  isUploadStillActive,
  markAnalysisApplied,
  readVideoDuration,
  recordAiUsage,
  runVideoAnalysis,
  runVideoObservation,
  saveVideoAnalysis,
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

const VIOLET = "var(--ta-violet)";

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
  background: "var(--ink-3)",
  border: "1px solid var(--ink-5)",
  color: "var(--fg-2)",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span
        className="font-mono-ta text-[9px] font-bold uppercase"
        style={{ letterSpacing: "0.15em", color: "var(--fg-4)" }}
      >
        {label}
      </span>
      {children}
    </label>
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
}) {
  const { user, profile } = useAuth();

  const [analyses, setAnalyses] = useState<VideoAnalysis[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Formular
  const [formOpen, setFormOpen] = useState(false);
  const [sourceKind, setSourceKind] = useState<"upload" | "youtube">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  const [pendingObservation, setPendingObservation] =
    useState<PendingObservation | null>(null);
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
  const hydratedRef = useRef(false);

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
      }
    } catch {
      /* defekter Eintrag → ignorieren */
    }
    hydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!hydratedRef.current) return; // nicht mit Defaults überschreiben
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
        }),
      );
    } catch {
      /* Speicher voll/blockiert → Feature ist optional */
    }
  }, [
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
  ]);
  /** Zähler, damit die Guthaben-Anzeige nach jeder Analyse neu lädt. */
  const [usageRefresh, setUsageRefresh] = useState(0);

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
      const saved = await saveVideoAnalysis({
        mode,
        targetId,
        targetName,
        sourceKind: source.kind,
        sourceLabel:
          source.kind === "upload" ? source.fileName : source.url,
        youtubeUrl: source.kind === "youtube" ? source.url : null,
        fighter: {
          name: targetName,
          corner,
          clothing: clothing.trim(),
          features: features.trim(),
          startPosition: startPosition.trim(),
        },
        tier,
        recency,
        models: result.models,
        usage: result.usage,
        observation: result.observation,
        evaluation: result.evaluation,
        appliedFindingIds: [],
        appliedStats: false,
        createdBy: user?.uid ?? "",
        createdByName: profile?.displayName ?? user?.email ?? null,
      });

      // Kosten auf das laufende Claude-Budget buchen (nur wenn Claude lief).
      if (result.usage) {
        try {
          await recordAiUsage(result.usage);
          setUsageRefresh((n) => n + 1);
        } catch {
          /* Anzeige-Feature — darf die Analyse nie scheitern lassen */
        }
      }

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

  // ─── Übernahme in Gegner-DNA bzw. Kampfprofil ────────────────────────────

  function isConflict(a: VideoAnalysis, questionId: string): boolean {
    if (a.appliedFindingIds.includes(questionId)) return false;
    const finding = a.evaluation.findings.find((f) => f.questionId === questionId);
    const existing = targetDna[questionId]?.trim();
    return !!finding && !!existing && existing !== finding.answer.trim();
  }

  /**
   * Liest das Merge-Ziel frisch: Gegner aus dem Prop (Seite hält den Stand),
   * Kampfprofil direkt aus Firestore (verhindert stale Merges).
   */
  async function readTarget(): Promise<{
    dna: Record<string, string>;
    dnaSplit: DnaSplit | null;
    dnaSplitWeight: number;
    actionStats: ActionStat[];
  }> {
    if (mode === "opponent") {
      return {
        dna: opponent?.dna ?? {},
        dnaSplit: opponent?.dnaSplit ?? null,
        dnaSplitWeight: opponent?.dnaSplitWeight ?? 0,
        actionStats: opponent?.actionStats ?? [],
      };
    }
    const fresh = await getFightProfile(targetId);
    return {
      dna: fresh.dna,
      dnaSplit: fresh.dnaSplit,
      dnaSplitWeight: fresh.dnaSplitWeight,
      actionStats: fresh.actionStats,
    };
  }

  async function writeTarget(patch: {
    dna: Record<string, string>;
    dnaSplit?: DnaSplit | null;
    dnaSplitWeight?: number;
    actionStats?: ActionStat[];
  }): Promise<void> {
    if (mode === "opponent") {
      if (!opponent) throw new Error("Kein Gegnerprofil geladen");
      await updateOpponent(opponent.id, {
        ...patch,
        updatedBy: user?.uid ?? null,
      });
    } else {
      await updateFightProfile(targetId, {
        ...patch,
        updatedBy: user?.uid ?? null,
      });
    }
  }

  function notifyTargetUpdated() {
    if (mode === "opponent") onOpponentUpdated?.();
    else onFightProfileUpdated?.();
  }

  async function applyFindings(a: VideoAnalysis, ids: string[]) {
    if (busy) return;
    if (mode === "opponent" && !opponent) return;
    setBusy(true);
    setError(null);
    try {
      const target = await readTarget();
      const dna = { ...target.dna };
      for (const id of ids) {
        const finding = a.evaluation.findings.find((f) => f.questionId === id);
        if (finding) dna[id] = finding.answer;
      }
      await writeTarget({ dna });
      const appliedFindingIds = Array.from(
        new Set([...a.appliedFindingIds, ...ids]),
      );
      await markAnalysisApplied(mode, targetId, a.id, { appliedFindingIds });
      setAnalyses((prev) =>
        (prev ?? []).map((x) => (x.id === a.id ? { ...x, appliedFindingIds } : x)),
      );
      notifyTargetUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Übernahme fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  /** Alle konfliktfreien Befunde + Zahlen (Split/Stats) auf einmal übernehmen. */
  async function applyAll(a: VideoAnalysis) {
    if (busy) return;
    if (mode === "opponent" && !opponent) return;
    setBusy(true);
    setError(null);
    try {
      const target = await readTarget();
      const ids = a.evaluation.findings
        .filter(
          (f) => !a.appliedFindingIds.includes(f.questionId) && !isConflict(a, f.questionId),
        )
        .map((f) => f.questionId);

      const dna = { ...target.dna };
      for (const id of ids) {
        const finding = a.evaluation.findings.find((f) => f.questionId === id);
        if (finding) dna[id] = finding.answer;
      }

      // Stats mergen: Versuche/Treffer aufsummieren, Zone/Setup behalten bzw. ergänzen.
      const merged = new Map<string, ActionStat>(
        cleanActionStats(target.actionStats).map((s) => [s.id, { ...s }]),
      );
      for (const stat of cleanActionStats(a.evaluation.actionStats)) {
        const existing = merged.get(stat.id);
        if (existing) {
          existing.attempted += stat.attempted;
          existing.landed += stat.landed;
          if (!existing.zone && stat.zone) existing.zone = stat.zone;
          if (!existing.setup && stat.setup) existing.setup = stat.setup;
        } else {
          merged.set(stat.id, { ...stat });
        }
      }

      // Split: gewichteter laufender Mittelwert. Das Video bekommt nur seinen
      // Anteil an der bisherigen Gewichtssumme — nicht pauschal die Hälfte.
      const { split: dnaSplit, weight: dnaSplitWeight } = mergeDnaSplit(
        target.dnaSplit,
        target.dnaSplitWeight,
        a.evaluation.dnaSplit,
        computeVideoWeight(a).value,
      );

      await writeTarget({
        dna,
        actionStats: Array.from(merged.values()),
        dnaSplit,
        dnaSplitWeight,
      });
      const appliedFindingIds = Array.from(
        new Set([...a.appliedFindingIds, ...ids]),
      );
      await markAnalysisApplied(mode, targetId, a.id, {
        appliedFindingIds,
        appliedStats: true,
      });
      setAnalyses((prev) =>
        (prev ?? []).map((x) =>
          x.id === a.id ? { ...x, appliedFindingIds, appliedStats: true } : x,
        ),
      );
      notifyTargetUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Übernahme fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(a: VideoAnalysis) {
    if (!confirm("Diese Analyse wirklich löschen?")) return;
    setBusy(true);
    try {
      await deleteVideoAnalysis(mode, targetId, a.id);
      setAnalyses((prev) => (prev ?? []).filter((x) => x.id !== a.id));
      if (expandedId === a.id) setExpandedId(null);
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

  // ─── Render ───────────────────────────────────────────────────────────────

  const running = stage !== "idle";
  const visibleSteps = RUN_STEPS.filter(
    ([s]) => sourceKind === "upload" || s !== "upload",
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Kopf */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div
            className="font-mono-ta text-[10px] font-bold uppercase"
            style={{ letterSpacing: "0.2em", color: VIOLET }}
          >
            KI-Video-Analyse
          </div>
          <p className="mt-0.5 text-[11px]" style={{ color: "var(--fg-4)" }}>
            Kampf-Video (max. 15 Min) hochladen oder verlinken — die KI zählt,
            beobachtet und bewertet {mode === "opponent" ? "den Gegner" : "deinen Athleten"}.
          </p>
        </div>
        {!formOpen && !running && (
          <button
            onClick={() => setFormOpen(true)}
            className="font-mono-ta flex items-center gap-1.5 rounded-lg px-4 py-2 text-[10px] font-bold uppercase"
            style={{ letterSpacing: "0.12em", background: VIOLET, color: "#fff" }}
          >
            <Icon name="video" size={14} /> Neue Analyse
          </button>
        )}
      </div>

      {/* Claude-Guthaben-Ring (geschätzt aus den Token-Kosten aller Analysen) */}
      <AiBudgetGauge refreshKey={usageRefresh} />

      {error && (
        <div
          className="rounded-lg px-3 py-2 text-xs"
          style={{
            background: "rgba(255,79,168,0.1)",
            border: "1px solid rgba(255,79,168,0.4)",
            color: "var(--ta-pink)",
          }}
        >
          {error}
        </div>
      )}

      {/* Formular */}
      {formOpen && !running && (
        <div
          className="flex flex-col gap-3 rounded-2xl p-4"
          style={{
            background:
              "radial-gradient(400px 200px at 0% 0%, rgba(157,123,250,0.1), transparent 60%), var(--ink-2)",
            border: "1px solid rgba(157,123,250,0.35)",
          }}
        >
          {/* Quelle */}
          <div className="flex gap-1 self-start rounded-lg p-1" style={{ background: "var(--ink-3)" }}>
            {(
              [
                ["upload", "Datei-Upload"],
                ["youtube", "YouTube-Link"],
              ] as const
            ).map(([kind, label]) => (
              <button
                key={kind}
                onClick={() => setSourceKind(kind)}
                className="font-mono-ta rounded-md px-3 py-1.5 text-[10px] font-bold uppercase"
                style={{
                  letterSpacing: "0.1em",
                  background: sourceKind === kind ? VIOLET : "transparent",
                  color: sourceKind === kind ? "#fff" : "var(--fg-4)",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {sourceKind === "upload" ? (
            pendingUpload ? (
              <div
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2.5"
                style={{
                  background: "rgba(157,123,250,0.1)",
                  border: "1px solid rgba(157,123,250,0.35)",
                }}
              >
                <div className="flex min-w-0 items-center gap-2 text-xs">
                  <span style={{ color: VIOLET, flexShrink: 0 }}>
                    <Icon name="check" size={14} />
                  </span>
                  <span className="min-w-0 truncate" style={{ color: "var(--fg-2)" }}>
                    <b>{pendingUpload.fileName}</b> ist bereits hochgeladen und
                    wird wiederverwendet.
                  </span>
                </div>
                <button
                  onClick={() => {
                    setPendingUpload(null);
                    setPendingObservation(null);
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="font-mono-ta rounded px-2 py-1 text-[9px] font-bold uppercase"
                  style={{
                    letterSpacing: "0.1em",
                    border: "1px solid var(--ink-5)",
                    color: "var(--fg-3)",
                    background: "transparent",
                  }}
                >
                  Anderes Video wählen
                </button>
              </div>
            ) : (
              <Field label="Videodatei (MP4, MOV … — max. 15 Minuten)">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="rounded-lg px-3 py-2 text-xs"
                  style={inputStyle}
                />
              </Field>
            )
          ) : (
            <>
              <Field label="YouTube-Link">
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                  className="rounded-lg px-3 py-2 text-xs"
                  style={inputStyle}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start (mm:ss, optional)">
                  <input
                    value={ytStart}
                    onChange={(e) => setYtStart(e.target.value)}
                    placeholder="z. B. 2:30"
                    className="rounded-lg px-3 py-2 text-xs"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Ende (mm:ss, optional)">
                  <input
                    value={ytEnd}
                    onChange={(e) => setYtEnd(e.target.value)}
                    placeholder="z. B. 17:30"
                    className="rounded-lg px-3 py-2 text-xs"
                    style={inputStyle}
                  />
                </Field>
              </div>
            </>
          )}

          {/* Kämpfer-Beschreibung */}
          <div
            className="font-mono-ta mt-1 text-[9px] font-bold uppercase"
            style={{ letterSpacing: "0.18em", color: "var(--fg-3)" }}
          >
            Wer ist {targetName} im Video?
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Ecke">
              <div className="flex gap-1">
                {(Object.keys(CORNER_LABEL) as CornerColor[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCorner(c)}
                    className="font-mono-ta flex-1 rounded-lg px-2 py-2 text-[10px] font-bold uppercase"
                    style={{
                      letterSpacing: "0.08em",
                      background:
                        corner === c
                          ? c === "red"
                            ? "var(--ta-pink)"
                            : c === "blue"
                              ? "var(--ta-cyan)"
                              : "var(--ink-5)"
                          : "var(--ink-3)",
                      color: corner === c ? "#fff" : "var(--fg-4)",
                      border: "1px solid var(--ink-5)",
                    }}
                  >
                    {CORNER_LABEL[c]}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Hose / Rashguard">
              <input
                value={clothing}
                onChange={(e) => setClothing(e.target.value)}
                placeholder="z. B. schwarze Shorts, weißes Logo"
                className="rounded-lg px-3 py-2 text-xs"
                style={inputStyle}
              />
            </Field>
            <Field label="Merkmale (Tattoos, Haare, Statur …)">
              <input
                value={features}
                onChange={(e) => setFeatures(e.target.value)}
                placeholder="z. B. Tattoo rechter Unterarm, der Größere"
                className="rounded-lg px-3 py-2 text-xs"
                style={inputStyle}
              />
            </Field>
            <Field label="Startposition (optional)">
              <input
                value={startPosition}
                onChange={(e) => setStartPosition(e.target.value)}
                placeholder="z. B. steht bei 0:00 links im Bild"
                className="rounded-lg px-3 py-2 text-xs"
                style={inputStyle}
              />
            </Field>
            <Field label="Wann fand der Kampf statt?">
              <select
                value={recency}
                onChange={(e) => setRecency(e.target.value as FightRecency)}
                className="rounded-lg px-3 py-2 text-xs"
                style={inputStyle}
              >
                {(
                  ["unknown", "recent", "mid", "old", "ancient"] as FightRecency[]
                ).map((r) => (
                  <option key={r} value={r}>
                    {FIGHT_RECENCY_LABEL[r]}
                  </option>
                ))}
              </select>
              <span className="mt-1 text-[10px]" style={{ color: "var(--fg-4)" }}>
                Bestimmt mit, wie stark dieses Video das Profil gewichtet.
                &bdquo;Unbekannt&ldquo; ist in Ordnung — es zählt fast voll.
              </span>
            </Field>
          </div>

          {/* Modellstufe */}
          <Field label="Analyse-Stufe">
            <div className="flex gap-1">
              {(
                [
                  ["flash", "Standard", "schnell & günstig"],
                  ["pro", "Detail-Analyse", "genauer — braucht Gemini-Bezahltarif"],
                ] as const
              ).map(([t, label, hint]) => (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  className="flex-1 rounded-lg px-3 py-2 text-left"
                  style={{
                    background: tier === t ? "rgba(157,123,250,0.18)" : "var(--ink-3)",
                    border: `1px solid ${tier === t ? VIOLET : "var(--ink-5)"}`,
                  }}
                >
                  <div
                    className="font-mono-ta text-[10px] font-bold uppercase"
                    style={{
                      letterSpacing: "0.1em",
                      color: tier === t ? VIOLET : "var(--fg-3)",
                    }}
                  >
                    {label}
                  </div>
                  <div className="text-[10px]" style={{ color: "var(--fg-4)" }}>
                    {hint}
                  </div>
                </button>
              ))}
            </div>
          </Field>

          {runError && (
            <div
              className="rounded-lg px-3 py-2 text-xs"
              style={{
                background: "rgba(255,79,168,0.1)",
                border: "1px solid rgba(255,79,168,0.4)",
                color: "var(--ta-pink)",
              }}
            >
              {runError}
            </div>
          )}

          {pendingObservation && (
            <div
              className="flex items-start gap-2 rounded-lg px-3 py-2 text-[11px]"
              style={{
                background: "rgba(62,224,107,0.08)",
                border: "1px solid rgba(62,224,107,0.35)",
                color: "var(--fg-3)",
              }}
            >
              <span style={{ color: "var(--ta-mint)", flexShrink: 0, marginTop: "1px" }}>
                <Icon name="check" size={13} />
              </span>
              <span>
                Die Video-Auswertung aus dem letzten Versuch ist gespeichert —
                die Analyse setzt direkt bei der Bewertung fort (keine erneute
                Video-Auswertung, keine doppelten Kosten). Gilt, solange Video
                und Beschreibung unverändert bleiben.
              </span>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleStart}
              className="btn-primary px-5 py-2 text-xs"
              style={{ background: VIOLET }}
            >
              {pendingObservation ? "Analyse fortsetzen" : "Analyse starten"}
            </button>
            <button
              onClick={() => {
                setFormOpen(false);
                setRunError(null);
              }}
              className="btn-secondary px-4 py-2 text-xs"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Fortschritt — Vollbild-Overlay: KI-Loader mittig, Schritte darunter */}
      {running && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6"
          style={{
            background: "rgba(7,4,13,0.92)",
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
            className="font-mono-ta mt-4 text-3xl font-bold tabular-nums"
            style={{ color: VIOLET, letterSpacing: "0.05em" }}
            aria-live="polite"
          >
            {progress.percent} %
          </div>
          <div
            className="mt-2 h-1 w-full max-w-xs overflow-hidden rounded-full"
            style={{ background: "var(--ink-3)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress.percent}%`,
                background: VIOLET,
                transition: "width 200ms linear",
              }}
            />
          </div>
          <p
            className="mt-4 max-w-xs text-center text-[11px]"
            style={{ color: "var(--fg-4)" }}
          >
            Das kann einige Minuten dauern — bitte die App im Vordergrund
            lassen, der Bildschirm bleibt automatisch an.
          </p>
          <div className="mt-5 flex w-full max-w-xs flex-col gap-2">
            {visibleSteps.map(([s, label]) => {
              const order = visibleSteps.findIndex(([x]) => x === s);
              const current = visibleSteps.findIndex(([x]) => x === stage);
              const done = order < current;
              const active = s === stage;
              return (
                <div key={s} className="flex items-center gap-2 text-xs">
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full"
                    style={{
                      background: done
                        ? "rgba(62,224,107,0.15)"
                        : active
                          ? "rgba(157,123,250,0.2)"
                          : "var(--ink-3)",
                      color: done ? "var(--ta-mint)" : active ? VIOLET : "var(--fg-4)",
                    }}
                  >
                    {done ? (
                      <Icon name="check" size={11} />
                    ) : active ? (
                      <span
                        className="h-2 w-2 animate-pulse rounded-full"
                        style={{ background: VIOLET }}
                      />
                    ) : (
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: "var(--ink-5)" }}
                      />
                    )}
                  </span>
                  <span
                    style={{
                      color: active ? "var(--fg-2)" : done ? "var(--fg-3)" : "var(--fg-4)",
                      fontWeight: active ? 700 : 400,
                    }}
                  >
                    {label}
                    {active && stageDetail && (
                      <span
                        className="font-mono-ta ml-2 text-[10px]"
                        style={{ color: VIOLET }}
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
        <div
          className="h-20 animate-pulse rounded-2xl"
          style={{ background: "var(--ink-2)" }}
        />
      ) : analyses.length === 0 && !formOpen && !running ? (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ border: "1px dashed var(--ink-5)", background: "var(--ink-2)" }}
        >
          <p className="text-sm font-bold" style={{ color: "var(--fg-3)" }}>
            Noch keine Video-Analysen.
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs" style={{ color: "var(--fg-4)" }}>
            Jedes analysierte Video wird zu einem eigenen Beitrag — die
            {mode === "opponent" ? " DeepFight-Analyse" : " Auswertung"} wird mit jedem
            Video präziser.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {analyses.map((a) => {
            const open = expandedId === a.id;
            const idWarn =
              a.observation.identification.idConfidence < ID_CONFIDENCE_WARN;
            return (
              <div key={a.id}>
                <button
                  onClick={() => setExpandedId(open ? null : a.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-left"
                  style={{
                    background: open ? "rgba(157,123,250,0.1)" : "var(--ink-2)",
                    border: `1px solid ${open ? "rgba(157,123,250,0.4)" : "var(--ink-4)"}`,
                  }}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span style={{ color: VIOLET, flexShrink: 0 }}>
                      <Icon name="video" size={16} />
                    </span>
                    <div className="min-w-0">
                      <div
                        className="truncate text-xs font-bold"
                        style={{ color: "var(--fg-2)" }}
                      >
                        {a.sourceLabel}
                      </div>
                      <div
                        className="font-mono-ta text-[9px] uppercase"
                        style={{ letterSpacing: "0.1em", color: "var(--fg-4)" }}
                      >
                        {formatDate(a.createdAt)} ·{" "}
                        {a.sourceKind === "youtube" ? "YouTube" : "Upload"} ·{" "}
                        {a.tier === "pro" ? "Detail" : "Standard"}
                        {a.usage
                          ? ` · ca. ${formatEur(a.usage.costEur)}`
                          : " · Gratis-Analyse"}
                        {a.appliedStats &&
                          (mode === "opponent"
                            ? " · In DeepFight übernommen"
                            : " · Ins Kampfprofil übernommen")}
                        {mode === "athlete" &&
                          a.sharedWithAthlete &&
                          " · Für Schüler freigegeben"}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {idWarn && (
                      <span style={{ color: "var(--ta-pink)" }} title="Unsichere Identifikation">
                        <Icon name="warn" size={14} />
                      </span>
                    )}
                    <span
                      style={{
                        color: "var(--fg-4)",
                        transform: open ? "rotate(90deg)" : "none",
                        transition: "transform 0.15s",
                        lineHeight: 0,
                      }}
                    >
                      <Icon name="arrow-right" size={13} />
                    </span>
                  </div>
                </button>
                {open && (
                  <div className="mt-2">
                    {mode === "athlete" && (
                      <div
                        className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2.5"
                        style={{
                          background: a.sharedWithAthlete
                            ? "rgba(62,224,107,0.08)"
                            : "var(--ink-2)",
                          border: `1px solid ${a.sharedWithAthlete ? "rgba(62,224,107,0.35)" : "var(--ink-4)"}`,
                        }}
                      >
                        <span
                          className="text-[11px]"
                          style={{ color: "var(--fg-3)" }}
                        >
                          {a.sharedWithAthlete
                            ? "Der Schüler sieht diese Auswertung in seinem Kampfprofil."
                            : "Nur für Trainer sichtbar — bei Freigabe sieht der Schüler das Ergebnis in seinem Kampfprofil."}
                        </span>
                        <button
                          onClick={() => toggleSharedWithAthlete(a)}
                          disabled={busy}
                          className="font-mono-ta rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase"
                          style={{
                            letterSpacing: "0.12em",
                            background: a.sharedWithAthlete
                              ? "transparent"
                              : "var(--ta-mint)",
                            border: a.sharedWithAthlete
                              ? "1px solid var(--ink-5)"
                              : "none",
                            color: a.sharedWithAthlete
                              ? "var(--fg-3)"
                              : "#06121a",
                            opacity: busy ? 0.6 : 1,
                          }}
                        >
                          {a.sharedWithAthlete
                            ? "Freigabe zurückziehen"
                            : "Für Schüler freigeben"}
                        </button>
                      </div>
                    )}
                    <VideoAnalysisResult
                      analysis={a}
                      mode={mode}
                      existingDna={targetDna}
                      busy={busy}
                      onApplyFindings={(ids) => applyFindings(a, ids)}
                      onApplyAll={() => applyAll(a)}
                      onDelete={() => handleDelete(a)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
