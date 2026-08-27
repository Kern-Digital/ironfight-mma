"use client";

/**
 * Workout Session — Geführter Trainings-Modus
 *
 * Vollbild-Ansicht für mobile Nutzung während eines echten Workouts:
 *  - Übungsanimation prominent, großer Countdown, Sprachansagen
 *  - Player füllt den Bildschirm (100dvh), Steuerung unten angepinnt
 *  - Steuerung (Leons Vorgaben 2026-08-27): Weiter/Pause (3/4) + Phasen-Skip
 *    als reines Vorspul-Symbol (1/4), darunter „Detail" in voller Breite;
 *    Übungswechsel NUR per Wischgeste (rechts = nächste, links = zurück)
 *  - Hochziehen öffnet die Übungsliste der Einheit; Tap auf eine Übung
 *    springt hin und startet mit 3-2-1. Die Geste wird per Coach-Mark
 *    angedeutet — einmal pro Session-Start, max. 2× pro GERÄT (localStorage)
 *  - Sound/Vibration/Display-Toggles bewusst entfernt — wird später
 *    app-weit gesteuert
 *  - Gleicher URL-Parameter ?payload=... wie /workout
 *
 * Neues Token-System (Rollout Etappe 4). Bewusst OHNE Tab-Bar: der Modus ist
 * ein immersiver Player — Verlassen nur gezielt über „Beenden" (mit
 * Bestätigung), nicht per versehentlichem Navigations-Tap.
 * Phasenfarben = Semantik-Tokens (prep=warning, work=accent, rest=neutral,
 * done=positive), Glows via color-mix aus denselben Tokens.
 */

import ExerciseAnimation from "@/components/ExerciseAnimation";
import Icon from "@/components/ui/Icon";
import { useAuth } from "@/lib/auth-context";
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
import { logWorkoutFull } from "@/lib/workouts";
import { CATEGORY_LABEL } from "@/lib/techniques";
import { type WorkoutDefinition } from "@/lib/types";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

// ─── Helfer ───────────────────────────────────────────────────────────────────

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

function parseWorkout(payload: string | null): WorkoutDefinition | null {
  if (!payload) return null;
  try {
    return JSON.parse(decodeURIComponent(payload)) as WorkoutDefinition;
  } catch {
    return null;
  }
}

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

// Block-Überschriften der Übungsliste (gleiches Mapping wie /workout)
const BLOCK_LABEL: Record<string, string> = {
  warmup: "Aufwärmen",
  main: "Hauptteil",
  conditioning: "Konditionierung",
  cooldown: "Cooldown",
};

// ─── Typo-Konstanten (Muster der Referenzseiten) ──────────────────────────────

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const META_FONT: React.CSSProperties = {
  font: "600 10px/1.2 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

// ─── Kern-Komponente ──────────────────────────────────────────────────────────

function SessionRunner() {
  const params   = useSearchParams();
  const workout  = useMemo(() => parseWorkout(params.get("payload")), [params]);
  const { user } = useAuth();
  // Nur noch lesen — die Toggle-UI (Sound/Vibration/Display) ist raus,
  // gesteuert wird das später app-weit (Leons Vorgabe 2026-08-27)
  const { settings } = useTimerSettings();

  // Übungs-Sequenz
  const exerciseSequence = useMemo(
    () => workout?.blocks.flatMap((b) => b.exerciseIds) ?? [],
    [workout],
  );
  const [exerciseIndex, setExerciseIndex] = useState(0);

  // Hochziehbare Übungsliste + Autostart nach Sprung daraus
  const [sheetOpen, setSheetOpen] = useState(false);
  const autoStartRef = useRef(false);
  const [autoStartTick, setAutoStartTick] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Wisch-Hinweis (Coach-Mark) statt sichtbarem Listen-Button: einmal pro
  // Session-Start kurz einblenden, insgesamt max. 2× — die Regel ist
  // GERÄTE-gebunden (localStorage, nicht Firestore; Leons Vorgabe 2026-08-27)
  const [hintVisible, setHintVisible] = useState(false);
  useEffect(() => {
    if (!workout) return;
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
  }, [workout]);

  // Zeilen der Übungsliste: Blöcke der Einheit → globale Übungs-Indizes
  const sheetBlocks = useMemo(() => {
    let i = 0;
    return (workout?.blocks ?? []).map((b) => ({
      phase: b.phase,
      items: b.exerciseIds.map((id) => ({
        index: i++,
        exercise: getExerciseById(id),
      })),
    }));
  }, [workout]);
  const currentExerciseId = exerciseSequence[exerciseIndex];
  const currentExercise   = currentExerciseId ? getExerciseById(currentExerciseId) : null;
  const nextExerciseId    = exerciseSequence[exerciseIndex + 1];
  const nextExercise      = nextExerciseId ? getExerciseById(nextExerciseId) : null;

  // Timer-Konfiguration per Übung
  const timerConfig: TimerConfig = useMemo(() => {
    if (currentExercise) {
      return {
        rounds:      currentExercise.defaultRounds,
        workSeconds: currentExercise.durationSeconds,
        restSeconds: currentExercise.restSeconds || 30,
        prepSeconds: workout?.prepSeconds ?? 10,
      };
    }
    return DEFAULT_CONFIG;
  }, [currentExercise, workout]);

  const t = useWorkoutTimer(timerConfig);
  useWakeLock(settings.wakeLock && t.running);

  // Config + Reset bei Übungswechsel. Nach einem Sprung aus der Übungsliste:
  // 3-2-1-Countdown + Autostart — der Start läuft über autoStartTick in einem
  // Folge-Effekt, weil t.start() erst NACH dem Config-Render die neue
  // Konfiguration sieht (enterPhase hängt am config-State).
  useEffect(() => {
    const jumped = autoStartRef.current;
    autoStartRef.current = false;
    t.setConfig(jumped ? { ...timerConfig, prepSeconds: 3 } : timerConfig);
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

  // Auto-Advance zur nächsten Übung
  useEffect(() => {
    if (t.phase === "done" && nextExerciseId) {
      const id = setTimeout(() => setExerciseIndex((i) => i + 1), 1500);
      return () => clearTimeout(id);
    }
  }, [t.phase, nextExerciseId]);

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

  useEffect(() => {
    if (!workout || !allDone || !user || loggedRef.current) return;
    loggedRef.current = true;
    setLogState("saving");
    const techniqueIds = exerciseSequence.flatMap(
      (id) => getExerciseById(id)?.techniqueIds ?? [],
    );
    logWorkoutFull(user.uid, {
      config:       t.config,
      label:        workout.label,
      category:     workout.category,
      difficulty:   workout.difficulty,
      status:       "completed",
      exerciseIds:  exerciseSequence,
      techniqueIds: Array.from(new Set(techniqueIds)),
    })
      .then(() => setLogState("saved"))
      .catch(() => setLogState("error"));
  }, [allDone, user, workout, exerciseSequence, t.config]);

  // ─── Audio-Unlock ─────────────────────────────────────────────────────────────

  const [audioUnlocked, setAudioUnlocked] = useState(false);
  useEffect(() => setAudioUnlocked(isAudioUnlocked()), []);

  async function handleStart() {
    if (!audioUnlocked) {
      const ok = await unlockAudio();
      setAudioUnlocked(ok);
    }
    t.start();
  }

  function handleAbort() {
    if (!confirm("Workout abbrechen? Fortschritt wird als 'abgebrochen' gespeichert.")) return;
    if (user && !loggedRef.current) {
      loggedRef.current = true;
      logWorkoutFull(user.uid, {
        config:      t.config,
        label:       workout?.label ?? null,
        category:    workout?.category ?? null,
        difficulty:  workout?.difficulty ?? null,
        status:      "aborted",
        exerciseIds: exerciseSequence.slice(0, exerciseIndex + 1),
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
    if (idx === exerciseIndex) {
      t.setConfig({ ...timerConfig, prepSeconds: 3 });
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

  if (!workout) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center"
        style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
      >
        <p style={{ font: "var(--type-body-strong)", color: "var(--text-3)" }}>
          Kein Workout geladen.
        </p>
        <Link
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
  const phaseColor = PHASE_COLOR[t.phase];

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
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
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
            {CATEGORY_LABEL[workout.category]}
          </div>
          <div style={{ font: "var(--type-sub)", fontWeight: 600 }}>
            Übung {Math.min(exerciseIndex + 1, totalExercises)}/{totalExercises}
          </div>
        </div>

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
      </div>

      {/* ── Phase-Label ──────────────────────────────────────────────────────── */}
      <div className="mb-2 text-center">
        <span className="t-label" style={{ color: phaseColor }}>
          {PHASE_LABEL[t.phase]}
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
              filter: PHASE_GLOW[t.phase],
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
            filter: PHASE_GLOW[t.phase],
          }}
          aria-live="polite"
          aria-label={`${t.remaining} Sekunden verbleibend`}
        >
          {/* Vorbereitung zählt als nackte Zahl runter (…3, 2, 1) —
              erst Übung/Pause laufen im mm:ss-Format */}
          {t.phase === "prep" ? t.remaining : formatTime(t.remaining)}
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

      {/* ── Fertig-Banner ─────────────────────────────────────────────────────── */}
      {allDone && (
        <div
          className="my-8 rounded-modal px-6 py-10 text-center"
          style={{
            background: "color-mix(in oklab, var(--positive) 10%, transparent)",
            border: "1px solid color-mix(in oklab, var(--positive) 40%, transparent)",
          }}
        >
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
          <div className="mt-3 flex justify-center" style={{ color: "var(--positive)" }}>
            <Icon name="trophy" size={36} />
          </div>
          {logState === "saving" && (
            <p className="mt-4" style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              Speichere Session…
            </p>
          )}
          {logState === "saved" && (
            <p
              className="mt-4 inline-flex items-center gap-1.5"
              style={{ font: "var(--type-sub)", color: "var(--positive)" }}
            >
              <Icon name="check" size={14} strokeWidth={2.6} />
              Im Dashboard gespeichert
            </p>
          )}
          {logState === "error" && (
            <p className="mt-4" style={{ font: "var(--type-sub)", color: "var(--negative)" }}>
              Speichern fehlgeschlagen
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
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
            <Link
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

      {/* ── Sound-Hinweis ─────────────────────────────────────────────────────── */}
      {!audioUnlocked && !t.running && !allDone && (
        <div
          className="mt-3 rounded-field px-4 py-2.5 text-center"
          style={{
            font: "var(--type-sub)",
            background: "color-mix(in oklab, var(--warning) 12%, transparent)",
            border: "1px solid color-mix(in oklab, var(--warning) 40%, transparent)",
            color: "var(--warning)",
          }}
        >
          Tippe <strong>Start</strong>, damit Sound auf deinem Gerät funktioniert.
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

          {/* Detail-Ansicht — volle Breite */}
          <Link
            href={`/workout?payload=${params.get("payload") ?? ""}`}
            className="t-interactive inline-flex min-h-hit w-full items-center justify-center rounded-field py-3"
            style={{
              ...BTN_FONT,
              background: "var(--surface-raised)",
              border: "1px solid var(--line)",
              color: "var(--text-2)",
              textDecoration: "none",
            }}
          >
            Detail
          </Link>
        </div>
      )}
    </div>

    {/* ── Wisch-Hinweis (Coach-Mark) — nur die ersten 2 Session-Starts ───────── */}
    {hintVisible && !sheetOpen && !allDone && (
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
              <div key={`${block.phase}-${bi}`} className="mb-2">
                <div
                  className="px-2.5 pb-1 pt-2"
                  style={{ ...META_FONT, color: "var(--text-3)" }}
                >
                  {BLOCK_LABEL[block.phase] ?? block.phase}
                </div>
                {block.items.map(({ index, exercise }) =>
                  exercise ? (
                    <button
                      key={`${exercise.id}-${index}`}
                      type="button"
                      onClick={() => jumpToExercise(index)}
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
