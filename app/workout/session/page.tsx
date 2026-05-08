"use client";

/**
 * Workout Session — Geführter Trainings-Modus
 *
 * Vollbild-Ansicht für mobile Nutzung während eines echten Workouts:
 *  - Übungsanimation prominent
 *  - Großer Countdown
 *  - Sprachansagen (Web Speech API, Deutsch)
 *  - Minimal-UI: nur Pause + Skip
 *  - Gleicher URL-Parameter ?payload=... wie /workout
 */

import ExerciseAnimation from "@/components/ExerciseAnimation";
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

// ─── Phase-Styling ────────────────────────────────────────────────────────────

const PHASE_LABEL: Record<Phase, string> = {
  idle:  "Bereit",
  prep:  "Vorbereitung",
  work:  "Übung",
  rest:  "Pause",
  done:  "Fertig",
};

const PHASE_COLOR: Record<Phase, string> = {
  idle:  "text-fg-3",
  prep:  "text-yellow-400",
  work:  "text-blood",
  rest:  "text-blue-400",
  done:  "text-green-400",
};

const PHASE_BG: Record<Phase, string> = {
  idle:  "bg-fg-3",
  prep:  "bg-yellow-500",
  work:  "bg-blood",
  rest:  "bg-blue-500",
  done:  "bg-green-500",
};

const PHASE_GLOW: Record<Phase, string> = {
  idle:  "",
  prep:  "drop-shadow(0 0 20px rgba(234,179,8,.5))",
  work:  "drop-shadow(0 0 28px rgba(0,212,230,.6))",
  rest:  "drop-shadow(0 0 20px rgba(59,130,246,.5))",
  done:  "drop-shadow(0 0 20px rgba(34,197,94,.5))",
};

// ─── Kern-Komponente ──────────────────────────────────────────────────────────

function SessionRunner() {
  const params   = useSearchParams();
  const workout  = useMemo(() => parseWorkout(params.get("payload")), [params]);
  const { user } = useAuth();
  const { settings, setSoundOn, setVibrate, setWakeLock } = useTimerSettings();

  // Übungs-Sequenz
  const exerciseSequence = useMemo(
    () => workout?.blocks.flatMap((b) => b.exerciseIds) ?? [],
    [workout],
  );
  const [exerciseIndex, setExerciseIndex] = useState(0);
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

  // Config + Reset bei Übungswechsel
  useEffect(() => {
    t.setConfig(timerConfig);
    t.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseIndex]);

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

  // ─── Kein Workout ─────────────────────────────────────────────────────────────

  if (!workout) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
        <p className="text-lg font-bold text-fg-3">Kein Workout geladen.</p>
        <Link href="/workout/generator" className="btn-primary">
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

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-0 px-4 pb-8 pt-3 sm:px-6">

      {/* ── Top-Bar ──────────────────────────────────────────────────────────── */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={handleAbort}
          className="flex items-center gap-1.5 rounded-lg border border-carbon-400 bg-carbon-700/60 px-3 py-2 text-xs font-bold uppercase tracking-widest text-fg-3 transition-colors hover:border-pink hover:text-pink"
          aria-label="Session beenden"
        >
          <span aria-hidden="true">✕</span>
          <span>Beenden</span>
        </button>

        <div className="text-center">
          <div className="text-[10px] uppercase tracking-widest text-fg-4">
            {CATEGORY_LABEL[workout.category]}
          </div>
          <div className="text-xs font-bold text-fg-2">
            Übung {Math.min(exerciseIndex + 1, totalExercises)}/{totalExercises}
          </div>
        </div>

        {/* Gesamt-Fortschrittsbalken */}
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] uppercase tracking-widest text-fg-4">
            {Math.round(progress)}%
          </span>
          <div className="h-1 w-20 overflow-hidden rounded-full bg-ink-4">
            <div
              className="h-full bg-blood transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Phase-Label ──────────────────────────────────────────────────────── */}
      <div className={`mb-2 text-center text-xs font-black uppercase tracking-[0.2em] ${PHASE_COLOR[t.phase]}`}>
        {PHASE_LABEL[t.phase]}
        {t.phase === "work" && t.config.rounds > 1 && (
          <span className="ml-2 font-normal text-fg-4">
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
            className={`font-display font-black uppercase leading-tight tracking-tight ${PHASE_COLOR[t.phase]}`}
            style={{
              fontSize: "clamp(1.7rem, 7vw, 2.8rem)",
              filter: PHASE_GLOW[t.phase],
            }}
          >
            {currentExercise.name}
          </h1>

          {currentExercise.cues && currentExercise.cues.length > 0 && (
            <p className="mt-1 text-xs text-fg-4">
              {currentExercise.cues.slice(0, 2).join(" · ")}
            </p>
          )}
        </div>
      )}

      {/* ── Countdown ────────────────────────────────────────────────────────── */}
      {!allDone && (
        <div
          className={`my-2 text-center font-display font-black tabular-nums leading-none ${PHASE_COLOR[t.phase]}`}
          style={{
            fontSize:  "clamp(5rem, 22vw, 9rem)",
            filter:    PHASE_GLOW[t.phase],
            lineHeight: 1,
          }}
          aria-live="polite"
          aria-label={`${t.remaining} Sekunden verbleibend`}
        >
          {formatTime(t.remaining)}
        </div>
      )}

      {/* ── Phasen-Fortschrittsbalken ─────────────────────────────────────────── */}
      {!allDone && (
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-ink-4">
          <div
            className={`h-full transition-all duration-200 ${PHASE_BG[t.phase]}`}
            style={{ width: `${phaseProgress}%` }}
          />
        </div>
      )}

      {/* ── Nächste Übung ────────────────────────────────────────────────────── */}
      {nextExercise && !allDone && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-carbon-500/60 bg-carbon-700/30 px-4 py-2.5">
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-fg-4">
            Als Nächstes
          </span>
          <span className="mx-1 text-fg-4">→</span>
          <span className="text-sm font-bold text-fg-2">{nextExercise.name}</span>
          <span className="ml-auto shrink-0 text-[10px] text-fg-4">
            {nextExercise.defaultRounds}× {nextExercise.durationSeconds}s
          </span>
        </div>
      )}

      {/* ── Fertig-Banner ─────────────────────────────────────────────────────── */}
      {allDone && (
        <div className="my-8 rounded-2xl border border-green-500/30 bg-green-500/10 px-6 py-10 text-center">
          <div
            className="font-display font-black text-green-400"
            style={{ fontSize: "clamp(2rem, 8vw, 3.5rem)" }}
          >
            Workout fertig!
          </div>
          <div className="mt-1 text-3xl">🏆</div>
          {logState === "saving" && (
            <p className="mt-4 text-xs text-fg-4">Speichere Session…</p>
          )}
          {logState === "saved" && (
            <p className="mt-4 text-xs text-green-300">Im Dashboard gespeichert ✓</p>
          )}
          {logState === "error" && (
            <p className="mt-4 text-xs text-pink">Speichern fehlgeschlagen</p>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/dashboard" className="btn-secondary text-sm">
              Mein Training
            </Link>
            <Link href="/workout/generator" className="btn-primary text-sm">
              Neues Workout
            </Link>
          </div>
        </div>
      )}

      {/* ── Haupt-Steuerung ───────────────────────────────────────────────────── */}
      {!allDone && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={t.running ? t.pause : handleStart}
            className="btn-primary col-span-2 py-5 text-lg"
          >
            {t.running
              ? "⏸ Pause"
              : t.phase === "idle" || t.phase === "done"
              ? "▶ Start"
              : "▶ Weiter"}
          </button>

          <button
            onClick={t.skip}
            disabled={t.phase === "idle" || t.phase === "done"}
            className="btn-secondary py-4 text-sm disabled:opacity-30"
          >
            Phase skip →
          </button>

          <button
            onClick={() => {
              t.reset();
              if (nextExerciseId) setExerciseIndex((i) => i + 1);
            }}
            disabled={!nextExerciseId}
            className="btn-secondary py-4 text-sm disabled:opacity-30"
          >
            Nächste Übung →
          </button>
        </div>
      )}

      {/* ── Sound-Hinweis ─────────────────────────────────────────────────────── */}
      {!audioUnlocked && !t.running && !allDone && (
        <div className="mt-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2.5 text-center text-xs text-yellow-200">
          📱 Tippe <strong>Start</strong>, damit Sound auf deinem Gerät funktioniert.
        </div>
      )}

      {/* ── Einstellungen ─────────────────────────────────────────────────────── */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <ToggleChip
          icon="🔔" label="Sound"
          value={settings.soundOn} onChange={setSoundOn}
        />
        <ToggleChip
          icon="📳" label="Vibration"
          value={settings.vibrate} onChange={setVibrate}
        />
        <ToggleChip
          icon="🌓" label="Display"
          value={settings.wakeLock} onChange={setWakeLock}
        />
      </div>

      {/* ── Zur Detail-Ansicht ─────────────────────────────────────────────────── */}
      <div className="mt-6 text-center">
        <Link
          href={`/workout?payload=${params.get("payload") ?? ""}`}
          className="text-xs uppercase tracking-widest text-fg-4 transition-colors hover:text-blood"
        >
          Zur Detailansicht →
        </Link>
      </div>
    </div>
  );
}

// ─── Kleines Setting-Toggle ───────────────────────────────────────────────────

function ToggleChip({
  icon, label, value, onChange,
}: {
  icon: string; label: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all ${
        value
          ? "border-blood/60 bg-blood/10 text-blood"
          : "border-carbon-400 bg-carbon-700/40 text-fg-4"
      }`}
    >
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function SessionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-sm uppercase tracking-widest text-fg-4">
          Lade Session…
        </div>
      }
    >
      <SessionRunner />
    </Suspense>
  );
}
