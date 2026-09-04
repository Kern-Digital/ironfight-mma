"use client";

/**
 * Workout Session — Geführter Trainings-Modus
 *
 * Vollbild-Ansicht für mobile Nutzung während eines echten Workouts:
 *  - Übungsanimation prominent, großer Countdown, Sprachansagen
 *  - Player füllt den Bildschirm (100dvh), Steuerung unten angepinnt
 *  - Steuerung (Leons Vorgaben 2026-08-27): Weiter/Pause (3/4) + Phasen-Skip
 *    als reines Vorspul-Symbol (1/4), darunter „Detail" in voller Breite —
 *    öffnet ein Sheet mit der Übungs-Erklärung (Ausführung, Cues, Fokus,
 *    Equipment, Technik-Links), KEIN Seitenwechsel: die Session läuft weiter;
 *    Übungswechsel NUR per Wischgeste (rechts = nächste, links = zurück)
 *  - Hochziehen öffnet die Übungsliste der Einheit; Tap auf eine Übung
 *    springt hin und startet mit 3-2-1. Die Geste wird per Coach-Mark
 *    angedeutet — einmal pro Session-Start, max. 2× pro GERÄT (localStorage)
 *  - Sound/Vibration/Display-Toggles bewusst entfernt — wird später
 *    app-weit gesteuert
 *  - Gleicher URL-Parameter ?payload=... wie /workout — trägt seit der
 *    Runner-Umstellung (Schritt 5) das Plan-JSON: der Runner läuft NATIV
 *    auf WorkoutPlan-Blöcken, die Pause zwischen den Runden ist die
 *    BLOCKPAUSE des jeweiligen Blocks (nicht mehr der Übungs-Default).
 *    Alte WorkoutDefinition-Payloads (Bookmarks/Verläufe) hebt
 *    parseSessionPayload beim Einlesen in die Plan-Form.
 *
 * Neues Token-System (Rollout Etappe 4). Bewusst OHNE Tab-Bar: der Modus ist
 * ein immersiver Player — Verlassen nur gezielt über „Beenden" (mit
 * Bestätigung), nicht per versehentlichem Navigations-Tap.
 * Phasenfarben = Semantik-Tokens (prep=warning, work=accent, rest=neutral,
 * done=positive), Glows via color-mix aus denselben Tokens.
 */

import DoneAnimation from "@/components/DoneAnimation";
import ExerciseAnimation from "@/components/ExerciseAnimation";
import ExerciseDetailSheet from "@/components/ExerciseDetailSheet";
import Icon from "@/components/ui/Icon";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { unlockAudio, isAudioUnlocked } from "@/lib/audio";
import { getExerciseById } from "@/lib/exercises";
import {
  setSpeechEnabled,
  speakExerciseName,
  speakRest,
  speakDone,
  cancelSpeech,
} from "@/lib/speech";
import {
  DEFAULT_CONFIG,
  useWorkoutTimer,
  type TimerConfig,
  type Phase,
} from "@/lib/use-workout-timer";
import { useTimerSettings } from "@/lib/use-timer-settings";
import { useWakeLock } from "@/lib/use-wake-lock";
import { logWorkoutFull, setWorkoutSavedPlan } from "@/lib/workouts";
import {
  DISCIPLINE_CATEGORY,
  deletePersonalWorkoutPlan,
  exerciseRestSeconds,
  parseSessionPayload,
  upsertPersonalWorkoutPlan,
} from "@/lib/workout-plans";
import { DISCIPLINE_LABEL, GENDER_HEART_COLOR } from "@/lib/types";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

// ─── Helfer ───────────────────────────────────────────────────────────────────

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

/** Vorlauf vor der ersten Runde — das Plan-Modell kennt kein prepSeconds,
    der Wert war auch vorher überall fix 10 (Generator wie Brücke). */
const PREP_SECONDS = 10;

// ─── Phase-Styling (Semantik-Tokens statt fester Farben) ──────────────────────

const PHASE_LABEL: Record<Phase, string> = {
  idle: "Bereit",
  prep: "Vorbereitung",
  work: "Übung",
  rest: "Pause",
  done: "Fertig",
};

const PHASE_COLOR: Record<Phase, string> = {
  idle: "var(--text-3)",
  prep: "var(--warning)",
  work: "var(--accent-text)",
  rest: "var(--text-2)",
  done: "var(--positive)",
};

// Weicher Schein hinter Countdown/Übungsname — aus demselben Token gemischt
const PHASE_GLOW: Record<Phase, string> = {
  idle: "none",
  prep: "drop-shadow(0 0 20px color-mix(in oklab, var(--warning) 50%, transparent))",
  work: "drop-shadow(0 0 28px color-mix(in oklab, var(--accent) 55%, transparent))",
  rest: "none",
  done: "drop-shadow(0 0 20px color-mix(in oklab, var(--positive) 50%, transparent))",
};

// ─── Typo-Konstanten (Muster der Referenzseiten) ──────────────────────────────

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

// Rubrik-Überschriften der Übungsliste — groß und in Akzentfarbe mit
// Trennlinie, gleiche Optik wie im Übungs-Picker (Leons Vorgabe 2026-08-28);
// die Titel kommen aus den Plan-Blöcken (block.title), nicht aus der Phase
const GROUP_FONT: React.CSSProperties = {
  font: "700 16px/1.2 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

// ─── Kern-Komponente ──────────────────────────────────────────────────────────

function SessionRunner() {
  const params   = useSearchParams();
  const plan     = useMemo(
    () => parseSessionPayload(params.get("payload")),
    [params],
  );
  const { user, profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  // Nur noch lesen — die Toggle-UI (Sound/Vibration/Display) ist raus,
  // gesteuert wird das später app-weit (Leons Vorgabe 2026-08-27)
  const { settings } = useTimerSettings();

  // Übungs-Sequenz — jede Position kennt ihren Block, denn dessen
  // Blockpause gilt für die Pausen zwischen den Runden dieser Übung
  const sequence = useMemo(
    () =>
      plan?.blocks.flatMap((b, blockIndex) =>
        b.exerciseIds.map((id) => ({ id, blockIndex })),
      ) ?? [],
    [plan],
  );
  const exerciseSequence = useMemo(() => sequence.map((s) => s.id), [sequence]);
  const [exerciseIndex, setExerciseIndex] = useState(0);

  // Hochziehbare Übungsliste + Autostart nach Sprung daraus
  const [sheetOpen, setSheetOpen] = useState(false);
  // Übungs-Detail-Sheet („Detail"-Button): erklärt die AKTUELLE Übung
  const [detailOpen, setDetailOpen] = useState(false);
  const autoStartRef = useRef(false);
  // Auto-Durchlauf (Leons Wahl 2026-08-28): nach einer Übung läuft die
  // Pause automatisch und die nächste Übung startet von selbst. Die Pause
  // fährt als „prep" der Folge-Übung — autoRestRef trägt ihre Länge,
  // autoPause stellt die Anzeige von „Vorbereitung" auf „Pause" um.
  const autoRestRef = useRef<number | null>(null);
  const [autoPause, setAutoPause] = useState(false);
  const [autoStartTick, setAutoStartTick] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  // Wann die Session gestartet wurde — landet im Log („Letzte Workouts")
  const startedAtRef = useRef<Date | null>(null);

  // Wisch-Hinweis (Coach-Mark) statt sichtbarem Listen-Button: einmal pro
  // Session-Start kurz einblenden, insgesamt max. 2× — die Regel ist
  // GERÄTE-gebunden (localStorage, nicht Firestore; Leons Vorgabe 2026-08-27)
  const [hintVisible, setHintVisible] = useState(false);
  useEffect(() => {
    if (!plan) return;
    let seen = 0;
    try {
      seen = Number(localStorage.getItem("ta-session-swipe-hint")) || 0;
    } catch {}
    if (seen >= 2) return;
    try {
      localStorage.setItem("ta-session-swipe-hint", String(seen + 1));
    } catch {}
    setHintVisible(true);
    const id = setTimeout(() => setHintVisible(false), 7000);
    return () => clearTimeout(id);
  }, [plan]);

  // Zeilen der Übungsliste: Plan-Blöcke → globale Übungs-Indizes; leere
  // Blöcke (Editor erlaubt sie) tauchen in der Liste nicht auf
  const sheetBlocks = useMemo(() => {
    let i = 0;
    return (plan?.blocks ?? [])
      .map((b) => ({
        title: b.title,
        items: b.exerciseIds.map((id) => ({
          index: i++,
          exercise: getExerciseById(id),
        })),
      }))
      .filter((b) => b.items.length > 0);
  }, [plan]);
  const currentExerciseId = exerciseSequence[exerciseIndex];
  const currentExercise   = currentExerciseId ? getExerciseById(currentExerciseId) : null;
  const currentBlock      = plan?.blocks[sequence[exerciseIndex]?.blockIndex ?? -1];
  const nextExerciseId    = exerciseSequence[exerciseIndex + 1];
  const nextExercise      = nextExerciseId ? getExerciseById(nextExerciseId) : null;

  // Timer-Konfiguration per Übung — die Pause zwischen den Runden ist die
  // RUNDENPAUSE dieser Übung (restOverrides des Plans, sonst der Standard
  // der Rubrik; 0 s erlaubt — der Timer überspringt die Rest-Phase dann)
  const timerConfig: TimerConfig = useMemo(() => {
    if (currentExercise) {
      return {
        rounds:      currentExercise.defaultRounds,
        workSeconds: currentExercise.durationSeconds,
        restSeconds:
          plan && currentBlock
            ? exerciseRestSeconds(plan, currentBlock, currentExercise.id)
            : currentExercise.restSeconds,
        prepSeconds: PREP_SECONDS,
      };
    }
    return DEFAULT_CONFIG;
  }, [currentExercise, currentBlock, plan]);

  const t = useWorkoutTimer(timerConfig);
  useWakeLock(settings.wakeLock && t.running);

  // Config + Reset bei Übungswechsel. Nach einem Sprung aus der Übungsliste:
  // 3-2-1-Countdown + Autostart; beim Auto-Durchlauf läuft stattdessen die
  // Pause als Vorlauf. Der Start läuft über autoStartTick in einem
  // Folge-Effekt, weil t.start() erst NACH dem Config-Render die neue
  // Konfiguration sieht (enterPhase hängt am config-State).
  useEffect(() => {
    const jumped = autoStartRef.current;
    autoStartRef.current = false;
    const autoRest = autoRestRef.current;
    autoRestRef.current = null;
    if (jumped && autoRest !== null) {
      t.setConfig({ ...timerConfig, prepSeconds: autoRest });
      setAutoPause(true);
    } else {
      t.setConfig(jumped ? { ...timerConfig, prepSeconds: 3 } : timerConfig);
      setAutoPause(false);
    }
    t.reset();
    if (jumped) setAutoStartTick((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseIndex]);

  // Autostart nach Sprung — feuert erst, wenn die neue Config durchgerendert ist
  useEffect(() => {
    if (autoStartTick === 0) return;
    t.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartTick]);

  // Auto-Advance zur nächsten Übung — MIT automatischer Pause und
  // Autostart (Leons Wahl 2026-08-28): innerhalb einer Rubrik gilt die
  // Rundenpause, beim Rubrikwechsel die Zwischen-Rubrik-Pause; 0 s
  // bedeutet direkt weiter (der Timer springt dann sofort in die Arbeit)
  useEffect(() => {
    if (t.phase === "done" && nextExerciseId) {
      const id = setTimeout(() => {
        const cur = sequence[exerciseIndex];
        const nxt = sequence[exerciseIndex + 1];
        const curBlock = cur ? plan?.blocks[cur.blockIndex] : undefined;
        autoRestRef.current =
          cur && nxt && plan && curBlock
            ? cur.blockIndex === nxt.blockIndex
              ? // gleiche Rubrik: Rundenpause der eben beendeten Übung
                exerciseRestSeconds(plan, curBlock, cur.id)
              : curBlock.restAfterSeconds ?? 0
            : 0;
        autoStartRef.current = true;
        setExerciseIndex((i) => i + 1);
      }, 1500);
      return () => clearTimeout(id);
    }
  }, [t.phase, nextExerciseId, exerciseIndex, sequence, plan]);

  // ─── Sprachansagen ───────────────────────────────────────────────────────────

  // Sprache mit Sound-Setting synchron halten
  useEffect(() => {
    setSpeechEnabled(settings.soundOn);
  }, [settings.soundOn]);

  // Neue Übung: Name ankündigen (nach Bell-Ton)
  const prevExerciseIndexRef = useRef(-1);
  useEffect(() => {
    if (!settings.soundOn) return;
    if (exerciseIndex === prevExerciseIndexRef.current) return;
    prevExerciseIndexRef.current = exerciseIndex;
    if (!currentExercise) return;
    const id = setTimeout(() => speakExerciseName(currentExercise.name), 700);
    return () => clearTimeout(id);
  }, [exerciseIndex, currentExercise, settings.soundOn]);

  // Übung beendet: nächste ankündigen oder Fertig
  const prevPhaseDoneRef = useRef(false);
  useEffect(() => {
    if (t.phase === "done" && !prevPhaseDoneRef.current) {
      prevPhaseDoneRef.current = true;
      if (settings.soundOn) {
        if (nextExercise) {
          speakRest(nextExercise.name);
        } else {
          setTimeout(() => speakDone(), 900);
        }
      }
    }
    if (t.phase !== "done") {
      prevPhaseDoneRef.current = false;
    }
  }, [t.phase, nextExercise, settings.soundOn]);

  // Cleanup beim Verlassen
  useEffect(() => () => cancelSpeech(), []);

  // ─── Workout-Logging ─────────────────────────────────────────────────────────

  const [logState, setLogState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const loggedRef = useRef(false);
  const allDone   = !nextExerciseId && t.phase === "done";

  // Herz auf dem Fertig-Screen: speichert das GANZE Workout (den Plan) als
  // persönliche Kopie — der Zustand hängt wie im Hub am savedPlanId des Logs
  const [loggedWorkoutId, setLoggedWorkoutId] = useState<string | null>(null);
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);
  const [heartBusy, setHeartBusy] = useState(false);
  const heartColor = GENDER_HEART_COLOR[profile?.athlete?.gender ?? "unset"];

  useEffect(() => {
    if (!plan || !allDone || !user || loggedRef.current) return;
    loggedRef.current = true;
    setLogState("saving");
    const techniqueIds = exerciseSequence.flatMap(
      (id) => getExerciseById(id)?.techniqueIds ?? [],
    );
    logWorkoutFull(user.uid, {
      config:       t.config,
      label:        plan.name,
      // Logs/Statistik rechnen weiter im Category-Raster
      category:     DISCIPLINE_CATEGORY[plan.discipline],
      difficulty:   plan.difficulty,
      status:       "completed",
      startedAt:    startedAtRef.current,
      exerciseIds:  exerciseSequence,
      techniqueIds: Array.from(new Set(techniqueIds)),
      plan,
    })
      .then((id) => {
        setLoggedWorkoutId(id);
        setLogState("saved");
      })
      .catch(() => setLogState("error"));
  }, [allDone, user, plan, exerciseSequence, t.config]);

  async function toggleFinishFavorite() {
    if (!user || !plan || !loggedWorkoutId || heartBusy) return;
    setHeartBusy(true);
    try {
      if (savedPlanId) {
        await deletePersonalWorkoutPlan(user.uid, savedPlanId);
        await setWorkoutSavedPlan(user.uid, loggedWorkoutId, null);
        setSavedPlanId(null);
      } else {
        const planId = await upsertPersonalWorkoutPlan(
          user.uid,
          {
            ...plan,
            id: "",
            slug: "",
            gymId: "personal",
            short: "",
            description: "Als Favorit gespeichertes Workout.",
          },
          { sourcePlanId: null },
        );
        await setWorkoutSavedPlan(user.uid, loggedWorkoutId, planId);
        setSavedPlanId(planId);
      }
    } catch {
      // Fehlgeschlagen — Herz bleibt im alten Zustand
    } finally {
      setHeartBusy(false);
    }
  }

  // ─── Audio-Unlock ─────────────────────────────────────────────────────────────

  const [audioUnlocked, setAudioUnlocked] = useState(false);
  useEffect(() => setAudioUnlocked(isAudioUnlocked()), []);

  async function handleStart() {
    if (!audioUnlocked) {
      const ok = await unlockAudio();
      setAudioUnlocked(ok);
    }
    startedAtRef.current ??= new Date();
    t.start();
  }

  function handleAbort() {
    if (!confirm("Workout abbrechen? Was du bis hier geschafft hast, bleibt als abgebrochenes Workout gespeichert.")) return;
    if (user && !loggedRef.current) {
      loggedRef.current = true;
      logWorkoutFull(user.uid, {
        config:      t.config,
        label:       plan?.name ?? null,
        category:    plan ? DISCIPLINE_CATEGORY[plan.discipline] : null,
        difficulty:  plan?.difficulty ?? null,
        status:      "aborted",
        startedAt:   startedAtRef.current,
        exerciseIds: exerciseSequence.slice(0, exerciseIndex + 1),
        plan:        plan ?? null,
      }).catch(() => {});
    }
    cancelSpeech();
    window.location.href = "/dashboard";
  }

  // ─── Übungs-Navigation (Wischgesten + Übungsliste) ───────────────────────────

  // Übungswechsel NUR per Wischgeste — der frühere „Nächste Übung"-Button
  // ist entfernt (Leons Vorgabe 2026-08-27: rechts = nächste, links = zurück)
  function goToExercise(idx: number) {
    if (idx < 0 || idx >= exerciseSequence.length || idx === exerciseIndex) return;
    t.reset();
    setExerciseIndex(idx);
  }

  // Sprung aus der Übungsliste: Ziel-Übung startet automatisch mit 3-2-1
  function jumpToExercise(idx: number) {
    setSheetOpen(false);
    if (!audioUnlocked) {
      // noch innerhalb der User-Geste — Audio direkt mit freischalten
      unlockAudio().then((ok) => setAudioUnlocked(ok));
    }
    startedAtRef.current ??= new Date();
    if (idx === exerciseIndex) {
      t.setConfig({ ...timerConfig, prepSeconds: 3 });
      setAutoPause(false);
      t.reset();
      setAutoStartTick((n) => n + 1);
    } else {
      autoStartRef.current = true;
      setExerciseIndex(idx);
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    const p = e.touches[0];
    touchStartRef.current = { x: p.clientX, y: p.clientY };
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || allDone) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - start.x;
    const dy = p.clientY - start.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      // horizontal: rechts = nächste, links = zurück
      goToExercise(exerciseIndex + (dx > 0 ? 1 : -1));
    } else if (dy < -60 && Math.abs(dy) > Math.abs(dx) * 1.5) {
      // hochziehen: Übungsliste der Einheit; Geste verstanden → Hinweis weg
      setHintVisible(false);
      setSheetOpen(true);
    }
  }

  // ─── Kein Workout ─────────────────────────────────────────────────────────────

  if (!plan) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center"
        style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
      >
        <p style={{ font: "var(--type-body-strong)", color: "var(--text-3)" }}>
          Kein Workout geladen.
        </p>
        <Link data-press
          href="/workout/generator"
          className="t-interactive inline-flex min-h-hit items-center justify-center rounded-field px-5"
          style={{
            ...BTN_FONT,
            background: "var(--accent)",
            color: "var(--on-accent)",
            boxShadow: "var(--accent-glow)",
            textDecoration: "none",
          }}
        >
          Zum Workout-Generator
        </Link>
      </div>
    );
  }

  // ─── Berechnungen ─────────────────────────────────────────────────────────────

  const totalExercises  = exerciseSequence.length;
  const progress        = Math.min(100, (exerciseIndex / Math.max(1, totalExercises)) * 100);
  const phaseProgress   = t.totalForPhase > 0
    ? Math.min(100, ((t.totalForPhase - t.remaining) / t.totalForPhase) * 100)
    : 0;
  // Auto-Pause läuft technisch als prep — angezeigt wird sie als „Pause"
  // im Rest-Stil (mm:ss statt nackter Zahl)
  const isAutoPause = autoPause && t.phase === "prep";
  const phaseColor  = isAutoPause ? PHASE_COLOR.rest : PHASE_COLOR[t.phase];
  const phaseGlow   = isAutoPause ? PHASE_GLOW.rest : PHASE_GLOW[t.phase];
  const phaseLabel  = isAutoPause ? "Pause" : PHASE_LABEL[t.phase];

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    // Player deckt den ganzen Bildschirm ab: h-screen als Fallback, 100dvh
    // überschreibt inline, wo Browser dynamische Viewport-Höhen kennen
    <main
      className="relative flex h-screen flex-col overflow-hidden"
      style={{
        background: "var(--surface-page)",
        color: "var(--text-body)",
        height: "100dvh",
      }}
    >
    <div
      className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-0 overflow-y-auto px-4 pt-3 sm:px-6"
      style={{
        // Platz für den Kartei-Peek der Übungsliste am unteren Rand
        paddingBottom: allDone
          ? "calc(env(safe-area-inset-bottom, 0px) + 16px)"
          : "calc(env(safe-area-inset-bottom, 0px) + 40px)",
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >

      {/* ── Top-Bar ──────────────────────────────────────────────────────────── */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleAbort}
          aria-label="Session beenden"
          className="t-interactive flex min-h-hit items-center gap-1.5 rounded-field px-3"
          style={{
            ...BTN_FONT,
            background: "var(--surface-raised)",
            border: "1px solid var(--line)",
            color: "var(--text-3)",
          }}
        >
          <Icon name="x" size={13} strokeWidth={2.2} />
          <span>Beenden</span>
        </button>

        <div className="text-center">
          <div style={{ ...META_FONT, color: "var(--text-3)" }}>
            {DISCIPLINE_LABEL[plan.discipline]}
          </div>
          <div style={{ font: "var(--type-sub)", fontWeight: 600 }}>
            Übung {Math.min(exerciseIndex + 1, totalExercises)}/{totalExercises}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Gesamt-Fortschritt */}
          <div className="flex flex-col items-end gap-1">
            <span style={{ ...META_FONT, color: "var(--text-3)" }}>
              {Math.round(progress)}%
            </span>
            <div className="t-progress w-20" style={{ height: "4px" }}>
              <span
                style={{ width: `${progress}%`, transition: "width 500ms var(--ease-out)" }}
              />
            </div>
          </div>
          {/* Theme-Umschalter — der Runner hat weder Tab-Bar noch den
              Toggle der anderen Seiten (Leons Vorgabe 2026-08-27) */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              theme === "dark"
                ? "Helles Design aktivieren"
                : "Dunkles Design aktivieren"
            }
            className="t-glass t-interactive inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-field"
            style={{ color: "var(--text-2)" }}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
          </button>
        </div>
      </div>

      {/* ── Phase-Label ──────────────────────────────────────────────────────── */}
      <div className="mb-2 text-center">
        <span className="t-label" style={{ color: phaseColor }}>
          {phaseLabel}
        </span>
        {t.phase === "work" && t.config.rounds > 1 && (
          <span className="ml-2" style={{ ...META_FONT, color: "var(--text-3)" }}>
            Runde {Math.min(t.round, t.config.rounds)}/{t.config.rounds}
          </span>
        )}
      </div>

      {/* ── Animation ────────────────────────────────────────────────────────── */}
      {currentExercise && !allDone && (
        <ExerciseAnimation
          kind={currentExercise.kind}
          category={currentExercise.category}
          className="mb-4 h-[160px] w-full sm:h-[200px]"
        />
      )}

      {/* ── Übungsname ───────────────────────────────────────────────────────── */}
      {currentExercise && !allDone && (
        <div className="mb-1 text-center">
          <h1
            style={{
              font: "800 28px/1.15 var(--font-archivo), system-ui, sans-serif",
              fontSize: "clamp(1.7rem, 7vw, 2.8rem)",
              letterSpacing: "var(--ls-display)",
              textTransform: "uppercase",
              color: phaseColor,
              filter: phaseGlow,
            }}
          >
            {currentExercise.name}
          </h1>

          {currentExercise.cues && currentExercise.cues.length > 0 && (
            <p
              className="mt-1"
              style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
            >
              {currentExercise.cues.slice(0, 2).join(" · ")}
            </p>
          )}
        </div>
      )}

      {/* ── Countdown ────────────────────────────────────────────────────────── */}
      {!allDone && (
        <div
          className="my-2 text-center tabular-nums"
          style={{
            font: "800 96px/1 var(--font-archivo), system-ui, sans-serif",
            fontSize: "clamp(5rem, 22vw, 9rem)",
            color: phaseColor,
            filter: phaseGlow,
          }}
          aria-live="polite"
          aria-label={`${t.remaining} Sekunden verbleibend`}
        >
          {/* Vorbereitung zählt als nackte Zahl runter (…3, 2, 1) —
              Übung, Pause und AUTO-Pause laufen im mm:ss-Format */}
          {t.phase === "prep" && !autoPause ? t.remaining : formatTime(t.remaining)}
        </div>
      )}

      {/* ── Phasen-Fortschrittsbalken ─────────────────────────────────────────── */}
      {!allDone && (
        <div className="t-progress mb-3">
          <span
            style={{
              width: `${phaseProgress}%`,
              background: t.phase === "work" ? "var(--grad-progress)" : phaseColor,
              transition: "width 200ms var(--ease-out)",
            }}
          />
        </div>
      )}

      {/* ── Nächste Übung — Label oben, Übung in der Zeile darunter ──────────── */}
      {nextExercise && !allDone && (
        <div className="mb-4 mt-1 flex flex-col items-center gap-0.5 text-center">
          <span style={{ ...META_FONT, color: "var(--text-3)" }}>
            Als Nächstes
          </span>
          <span className="max-w-full truncate px-2">
            <span style={{ font: "var(--type-body-strong)", color: "var(--text-2)" }}>
              {nextExercise.name}
            </span>
            <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              {" "}· {nextExercise.defaultRounds}× {nextExercise.durationSeconds}s
            </span>
          </span>
        </div>
      )}

      {/* ── Fertig-Screen (Leons Vorgaben 2026-08-28): KEIN Kasten — die
          Inhalte verteilen sich über die freie Bildschirmfläche. Oben rechts
          das GROSSE Herz (speichert das ganze Workout als eigenen Plan,
          gleicher Mechanismus wie im Hub), zentriert der Titel, das einmal
          abgespielte Häkchen (bleibt im letzten Bild stehen) mittig in der
          Resthöhe mit der Speicher-Anmerkung, die zwei Buttons unten
          angepinnt wie sonst die Steuerung. ─────────────────────────────── */}
      {allDone && (
        <div className="flex flex-1 flex-col text-center">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void toggleFinishFavorite()}
              disabled={!loggedWorkoutId || heartBusy}
              aria-pressed={Boolean(savedPlanId)}
              aria-label={
                savedPlanId
                  ? "Workout aus den Favoriten entfernen"
                  : "Workout als eigenen Plan speichern"
              }
              className="t-interactive flex h-14 w-14 items-center justify-center rounded-field disabled:opacity-40"
              style={{
                color: savedPlanId ? heartColor : "var(--text-3)",
                opacity: heartBusy ? 0.5 : undefined,
              }}
            >
              <Icon
                name="heart"
                size={32}
                strokeWidth={2}
                style={savedPlanId ? { fill: "currentColor" } : undefined}
              />
            </button>
          </div>
          <div
            style={{
              font: "800 40px/1.1 var(--font-archivo), system-ui, sans-serif",
              fontSize: "clamp(2rem, 8vw, 3.5rem)",
              letterSpacing: "var(--ls-display)",
              textTransform: "uppercase",
              color: "var(--positive)",
            }}
          >
            Workout fertig!
          </div>
          <div className="flex flex-1 flex-col items-center justify-center">
            <DoneAnimation className="h-48 w-48 sm:h-56 sm:w-56" />
            {logState === "saving" && (
              <p className="mt-2" style={{ ...META_FONT, color: "var(--text-3)" }}>
                Speichere Session…
              </p>
            )}
            {logState === "saved" && (
              <p
                className="mt-2 inline-flex items-center gap-1.5"
                style={{ ...META_FONT, color: "var(--positive)" }}
              >
                <Icon name="check" size={12} strokeWidth={2.6} />
                In deinen Workouts gespeichert
              </p>
            )}
            {logState === "error" && (
              <p className="mt-2" style={{ ...META_FONT, color: "var(--negative)" }}>
                Speichern fehlgeschlagen
              </p>
            )}
          </div>
          <div className="mt-auto flex flex-wrap justify-center gap-3 pt-4">
            <Link data-press
              href="/dashboard"
              className="t-interactive inline-flex min-h-hit items-center justify-center rounded-field px-4"
              style={{
                ...BTN_FONT,
                background: "var(--surface-raised)",
                border: "1px solid var(--line)",
                color: "var(--text-2)",
                textDecoration: "none",
              }}
            >
              Mein Training
            </Link>
            <Link data-press
              href="/workout/generator"
              className="t-interactive inline-flex min-h-hit items-center justify-center rounded-field px-4"
              style={{
                ...BTN_FONT,
                background: "var(--accent)",
                color: "var(--on-accent)",
                boxShadow: "var(--accent-glow)",
                textDecoration: "none",
              }}
            >
              Neues Workout
            </Link>
          </div>
        </div>
      )}

      {/* ── Steuerung — unten angepinnt (mt-auto) ─────────────────────────────── */}
      {!allDone && (
        <div className="mt-auto flex flex-col gap-3 pt-4">
          {/* Weiter (3/4 Breite) + Phasen-Skip (1/4, nur Vorspul-Symbol) */}
          <div className="grid grid-cols-4 gap-3">
            <button
              type="button"
              onClick={t.running ? t.pause : handleStart}
              className="t-interactive col-span-3 inline-flex items-center justify-center gap-2 rounded-field py-4"
              style={{
                ...BTN_FONT,
                fontSize: "15px",
                background: "var(--accent)",
                color: "var(--on-accent)",
                boxShadow: "var(--accent-glow)",
              }}
            >
              <Icon name={t.running ? "pause" : "play"} size={15} strokeWidth={2.2} />
              {t.running
                ? "Pause"
                : t.phase === "idle" || t.phase === "done"
                ? "Start"
                : "Weiter"}
            </button>
            <button
              type="button"
              onClick={t.skip}
              disabled={t.phase === "idle" || t.phase === "done"}
              aria-label="Phase überspringen"
              className="t-interactive inline-flex min-h-hit items-center justify-center rounded-field py-3.5 disabled:opacity-40"
              style={{
                background: "var(--surface-raised)",
                border: "1px solid var(--line)",
                color: "var(--text-2)",
              }}
            >
              <Icon name="fast-forward" size={18} strokeWidth={2} />
            </button>
          </div>

          {/* Detail — volle Breite; öffnet das Übungs-Detail-Sheet
              (Leon 2026-08-27: „wie geht die Übung, was ist zu beachten"
              als Popup, kein Seitenwechsel) */}
          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            disabled={!currentExercise}
            className="t-interactive inline-flex min-h-hit w-full items-center justify-center rounded-field py-3 disabled:opacity-40"
            style={{
              ...BTN_FONT,
              background: "var(--surface-raised)",
              border: "1px solid var(--line)",
              color: "var(--text-2)",
            }}
          >
            Detail
          </button>
        </div>
      )}
    </div>

    {/* ── Wisch-Hinweis (Coach-Mark) — nur die ersten 2 Session-Starts ───────── */}
    {hintVisible && !sheetOpen && !detailOpen && !allDone && (
      <div
        aria-hidden
        className="animate-fade-in pointer-events-none absolute inset-x-0 z-30 flex justify-center"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 172px)" }}
      >
        <div
          className="flex flex-col items-center gap-0.5 rounded-field px-5 py-3"
          style={{
            background: "color-mix(in oklab, var(--surface-raised) 85%, transparent)",
            border: "1px solid var(--line)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
        >
          <span className="animate-swipe-hint" style={{ color: "var(--accent-text)", lineHeight: 0 }}>
            <Icon name="chevron-up" size={22} strokeWidth={2.2} />
          </span>
          <span style={{ ...META_FONT, color: "var(--text-2)" }}>
            Nach oben wischen — alle Übungen
          </span>
        </div>
      </div>
    )}

    {/* ── Kartei-Peek: angedeuteter Anfang der Übungsliste am unteren Rand
        (halbe Button-Höhe, Leons Vorgabe 2026-08-28) — Tippen öffnet die
        Liste, Hochwischen funktioniert weiter ───────────────────────────── */}
    {!allDone && !sheetOpen && (
      <button
        type="button"
        onClick={() => {
          setHintVisible(false);
          setSheetOpen(true);
        }}
        aria-label="Alle Übungen dieser Einheit öffnen"
        className="t-interactive fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-lg items-start justify-center"
        style={{
          height: "calc(env(safe-area-inset-bottom, 0px) + 22px)",
          background: "var(--surface-card)",
          borderRadius: "var(--r-xl) var(--r-xl) 0 0",
          boxShadow: "var(--glass-shadow)",
        }}
      >
        <span
          aria-hidden
          className="mt-2 h-1 w-10 rounded-full"
          style={{ background: "var(--line-strong)" }}
        />
      </button>
    )}

    {/* ── Übungsliste — hochziehbares Sheet ──────────────────────────────────── */}
    {sheetOpen && (
      <div
        className="fixed inset-0 z-50 flex flex-col justify-end"
        role="dialog"
        aria-modal="true"
        aria-label="Alle Übungen dieser Einheit"
      >
        <button
          type="button"
          aria-label="Übungsliste schließen"
          className="absolute inset-0"
          style={{
            background: "var(--overlay)",
            animation: "fade-in 0.2s ease-out both",
          }}
          onClick={() => setSheetOpen(false)}
        />
        <div
          className="animate-slide-up relative flex max-h-[75vh] flex-col overflow-hidden"
          style={{
            maxHeight: "75dvh",
            background: "var(--surface-card)",
            borderRadius: "var(--r-xl) var(--r-xl) 0 0",
            boxShadow: "var(--glass-shadow)",
          }}
        >
          <div className="flex items-center justify-between gap-3 px-5 pt-3">
            <div className="flex flex-col items-start">
              <div
                aria-hidden
                className="mb-2 h-1 w-10 rounded-full"
                style={{ background: "var(--line-strong)" }}
              />
              <span className="t-label">Alle Übungen</span>
            </div>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              aria-label="Schließen"
              className="t-interactive inline-flex h-10 w-10 items-center justify-center rounded-field"
              style={{ color: "var(--text-3)" }}
            >
              <Icon name="x" size={16} strokeWidth={2.2} />
            </button>
          </div>
          <div
            className="overflow-y-auto px-3 pt-1"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
          >
            {sheetBlocks.map((block, bi) => (
              <div key={`${block.title}-${bi}`} className="mb-2">
                {/* Rubrik-Überschrift — gleiche Optik wie im Übungs-Picker */}
                <div
                  className="flex items-center gap-3 px-2.5 pb-2 pt-5"
                  style={{ ...GROUP_FONT, color: "var(--accent-text)" }}
                >
                  {block.title}
                  <span
                    aria-hidden
                    className="h-px flex-1"
                    style={{
                      background:
                        "color-mix(in oklab, var(--accent) 35%, transparent)",
                    }}
                  />
                </div>
                {block.items.map(({ index, exercise }) =>
                  exercise ? (
                    <button
                      key={`${exercise.id}-${index}`}
                      type="button"
                      onClick={() => jumpToExercise(index)}
                      data-press="quiet"
                      className="t-interactive flex min-h-hit w-full items-center gap-3 rounded-field px-2.5 py-2 text-left"
                      style={{
                        background:
                          index === exerciseIndex
                            ? "var(--accent-subtle)"
                            : undefined,
                        color:
                          index === exerciseIndex
                            ? "var(--accent-text)"
                            : "var(--text-body)",
                      }}
                    >
                      <span
                        className="w-6 shrink-0 text-right tabular-nums"
                        style={{
                          font: "var(--type-num)",
                          color:
                            index === exerciseIndex
                              ? "var(--accent-text)"
                              : "var(--text-3)",
                        }}
                      >
                        {index + 1}
                      </span>
                      <span
                        className="min-w-0 flex-1 truncate"
                        style={{ font: "var(--type-body-strong)" }}
                      >
                        {exercise.name}
                      </span>
                      <span
                        className="shrink-0"
                        style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                      >
                        {exercise.defaultRounds}× {exercise.durationSeconds}s
                      </span>
                    </button>
                  ) : null,
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    )}

    {/* ── Übungs-Detail — Sheet zum „Detail"-Button (gemeinsame Komponente,
        auch im Übungs-Picker und Plan-Editor im Einsatz) ─────────────────── */}
    {/* Immer gerendert, `exercise={null}` heißt geschlossen — so hat auch
        das Schließen eine Bewegung (components/motion/SheetShell). */}
    <ExerciseDetailSheet
      exercise={detailOpen ? (currentExercise ?? null) : null}
      onClose={() => setDetailOpen(false)}
    />
    </main>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function SessionPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen items-center justify-center"
          style={{
            font: "var(--type-sub)",
            color: "var(--text-3)",
            background: "var(--surface-page)",
          }}
        >
          Lade Session…
        </div>
      }
    >
      <SessionRunner />
    </Suspense>
  );
}
