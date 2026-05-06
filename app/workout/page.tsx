"use client";

import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/lib/auth-context";
import { unlockAudio, isAudioUnlocked } from "@/lib/audio";
import { getExerciseById } from "@/lib/exercises";
import { getTechniqueById, CATEGORY_LABEL } from "@/lib/techniques";
import { EQUIPMENT } from "@/lib/equipment";
import {
  DEFAULT_CONFIG,
  useWorkoutTimer,
  type TimerConfig,
  type Phase,
} from "@/lib/use-workout-timer";
import { useTimerSettings } from "@/lib/use-timer-settings";
import { useWakeLock } from "@/lib/use-wake-lock";
import { logWorkoutFull } from "@/lib/workouts";
import { DIFFICULTY_LABEL, type WorkoutDefinition } from "@/lib/types";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

const PHASE_LABEL: Record<Phase, string> = {
  idle: "Bereit",
  prep: "Vorbereitung",
  work: "Übung",
  rest: "Pause",
  done: "Fertig!",
};

const PHASE_COLOR: Record<Phase, string> = {
  idle: "text-foreground",
  prep: "text-yellow-400",
  work: "text-blood",
  rest: "text-blue-400",
  done: "text-green-400",
};

function parseWorkoutFromUrl(payload: string | null): WorkoutDefinition | null {
  if (!payload) return null;
  try {
    return JSON.parse(decodeURIComponent(payload)) as WorkoutDefinition;
  } catch {
    return null;
  }
}

function WorkoutRunner() {
  const params = useSearchParams();
  const workout = useMemo(
    () => parseWorkoutFromUrl(params.get("payload")),
    [params],
  );
  const { user } = useAuth();
  const { settings, setSoundOn, setVibrate, setWakeLock } = useTimerSettings();

  // Übungs-Sequenz: alle exerciseIds in Reihenfolge der Blocks
  const exerciseSequence = useMemo(() => {
    if (!workout) return [];
    return workout.blocks.flatMap((b) => b.exerciseIds);
  }, [workout]);

  const [exerciseIndex, setExerciseIndex] = useState(0);
  const currentExerciseId = exerciseSequence[exerciseIndex];
  const currentExercise = currentExerciseId ? getExerciseById(currentExerciseId) : null;
  const nextExerciseId = exerciseSequence[exerciseIndex + 1];
  const nextExercise = nextExerciseId ? getExerciseById(nextExerciseId) : null;

  // Timer-Config wird pro Übung gesetzt
  const initialConfig: TimerConfig = useMemo(() => {
    if (currentExercise) {
      return {
        rounds: currentExercise.defaultRounds,
        workSeconds: currentExercise.durationSeconds,
        restSeconds: currentExercise.restSeconds || 30,
        prepSeconds: workout?.prepSeconds ?? 10,
      };
    }
    return DEFAULT_CONFIG;
  }, [currentExercise, workout]);

  const t = useWorkoutTimer(initialConfig);
  useWakeLock(settings.wakeLock && t.running);

  // Wenn neue Übung kommt: Timer-Config setzen + reset
  useEffect(() => {
    t.setConfig(initialConfig);
    t.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseIndex]);

  // Wenn Timer auf "done" geht und es noch eine nächste Übung gibt → automatisch weiter
  useEffect(() => {
    if (t.phase === "done" && nextExerciseId) {
      // Kurze Pause für die Sound-Wiedergabe, dann weiter
      const id = setTimeout(() => setExerciseIndex((i) => i + 1), 1500);
      return () => clearTimeout(id);
    }
  }, [t.phase, nextExerciseId]);

  // Workout-Logging am Ende der Sequenz
  const [logState, setLogState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const loggedRef = useRef(false);

  useEffect(() => {
    if (!workout) return;
    if (t.phase !== "done") return;
    if (nextExerciseId) return; // erst beim allerletzten Block loggen
    if (!user || loggedRef.current) return;
    loggedRef.current = true;
    setLogState("saving");

    const techniqueIds = exerciseSequence.flatMap((id) => {
      const ex = getExerciseById(id);
      return ex?.techniqueIds ?? [];
    });

    logWorkoutFull(user.uid, {
      config: t.config,
      label: workout.label,
      category: workout.category,
      difficulty: workout.difficulty,
      status: "completed",
      exerciseIds: exerciseSequence,
      techniqueIds: Array.from(new Set(techniqueIds)),
    })
      .then(() => setLogState("saved"))
      .catch(() => setLogState("error"));
  }, [t.phase, nextExerciseId, user, workout, exerciseSequence, t.config]);

  const [audioUnlocked, setAudioUnlocked] = useState(false);
  useEffect(() => setAudioUnlocked(isAudioUnlocked()), []);

  async function handleStart() {
    if (!audioUnlocked) {
      const ok = await unlockAudio();
      setAudioUnlocked(ok);
    }
    t.start();
  }

  function abortWorkout() {
    if (!user) return;
    if (loggedRef.current) return;
    loggedRef.current = true;
    logWorkoutFull(user.uid, {
      config: t.config,
      label: workout?.label ?? null,
      category: workout?.category ?? null,
      difficulty: workout?.difficulty ?? null,
      status: "aborted",
      exerciseIds: exerciseSequence.slice(0, exerciseIndex + 1),
    }).catch(() => {});
  }

  if (!workout) {
    return (
      <>
        <PageHeader
          eyebrow="Workout"
          title="Kein Workout geladen"
          description="Starte eines aus dem Generator oder von einer Trainingsplan-Seite."
        />
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <Link href="/workout/generator" className="btn-primary">
            Zum Workout
          </Link>
        </div>
      </>
    );
  }

  const totalExercises = exerciseSequence.length;
  const progress = (exerciseIndex / Math.max(1, totalExercises)) * 100;
  const allDone = !nextExerciseId && t.phase === "done";

  return (
    <>
      <PageHeader
        eyebrow={`${CATEGORY_LABEL[workout.category]} · ${DIFFICULTY_LABEL[workout.difficulty]}`}
        title={workout.label}
        description={`Übung ${Math.min(exerciseIndex + 1, totalExercises)} / ${totalExercises}`}
      />

      <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12 sm:px-6 space-y-6">
        {/* Sound-Unlock-Hinweis */}
        {!audioUnlocked && (
          <div className="rounded-sm border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
            <strong>📱 Sound-Hinweis:</strong> Tippe einmal auf{" "}
            <strong>Start</strong>, damit der Sound auf deinem Handy
            funktioniert.
          </div>
        )}

        {/* Aktuelle Übung */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div className={`text-xs font-bold uppercase tracking-widest ${PHASE_COLOR[t.phase]}`}>
              {PHASE_LABEL[t.phase]}
            </div>
            <div className="text-xs uppercase tracking-widest text-foreground/60">
              Runde {Math.min(t.round, t.config.rounds)} / {t.config.rounds}
            </div>
          </div>

          {currentExercise ? (
            <div className="mt-4">
              <h2 className="heading-display text-3xl font-black sm:text-4xl">
                {currentExercise.name}
              </h2>
              {currentExercise.notes && (
                <p className="mt-2 text-sm text-foreground/70">
                  {currentExercise.notes}
                </p>
              )}
              {currentExercise.cues && currentExercise.cues.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {currentExercise.cues.map((c) => (
                    <li
                      key={c}
                      className="rounded-sm border border-carbon-400 bg-carbon-800 px-2 py-1 text-xs uppercase tracking-widest text-foreground/70"
                    >
                      {c}
                    </li>
                  ))}
                </ul>
              )}
              {currentExercise.equipment.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1 text-xs text-foreground/60">
                  <span className="uppercase tracking-widest">Benötigt:</span>
                  {currentExercise.equipment.map((eq) => {
                    const def = EQUIPMENT[eq];
                    if (!def) return null;
                    return (
                      <span key={eq} className="inline-flex items-center gap-1">
                        <span>{def.icon}</span>
                        <span>{def.label}</span>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Technik-Verlinkung */}
              {currentExercise.techniqueIds && currentExercise.techniqueIds.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-carbon-500/60 pt-3">
                  {currentExercise.techniqueIds.map((tid) => {
                    const tech = getTechniqueById(tid);
                    if (!tech) return null;
                    return (
                      <Link
                        key={tid}
                        href={`/techniques/${tid}`}
                        target="_blank"
                        className="rounded-sm border border-blood/40 bg-blood/10 px-2 py-1 text-xs font-bold uppercase tracking-wider text-blood hover:bg-blood/20"
                      >
                        Technik: {tech.name} →
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <p className="mt-4 text-foreground/60">Keine Übung geladen.</p>
          )}

          {/* Timer */}
          <div className="my-6 sm:my-8 text-center">
            <div
              className={`font-display font-black leading-none ${PHASE_COLOR[t.phase]}`}
              style={{
                fontVariantNumeric: "tabular-nums",
                fontSize: "clamp(4rem, 18vw, 8rem)",
              }}
            >
              {formatTime(t.remaining)}
            </div>
          </div>

          {/* Phase-Progress */}
          <div className="h-2 overflow-hidden rounded-sm bg-carbon-600">
            <div
              className={`h-full transition-all duration-200 ${
                t.phase === "work"
                  ? "bg-blood"
                  : t.phase === "rest"
                    ? "bg-blue-500"
                    : t.phase === "prep"
                      ? "bg-yellow-500"
                      : t.phase === "done"
                        ? "bg-green-500"
                        : "bg-carbon-400"
              }`}
              style={{
                width: `${
                  t.totalForPhase === 0
                    ? 0
                    : Math.min(100, (1 - t.remaining / t.totalForPhase) * 100)
                }%`,
              }}
            />
          </div>

          {/* Buttons */}
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {!t.running ? (
              <button
                onClick={handleStart}
                className="btn-primary col-span-2 sm:col-span-1 py-4 text-base"
              >
                {t.phase === "idle" || t.phase === "done" ? "Start" : "Weiter"}
              </button>
            ) : (
              <button
                onClick={t.pause}
                className="btn-primary col-span-2 sm:col-span-1 py-4 text-base"
              >
                Pause
              </button>
            )}
            <button
              onClick={t.skip}
              className="btn-secondary py-4 text-base"
              disabled={t.phase === "idle" || t.phase === "done"}
            >
              Skip Phase
            </button>
            <button
              onClick={() => {
                t.reset();
                if (exerciseIndex < totalExercises - 1) {
                  setExerciseIndex((i) => i + 1);
                }
              }}
              className="btn-secondary py-4 text-base"
              disabled={!nextExerciseId}
            >
              Nächste Übung →
            </button>
            <button
              onClick={() => {
                t.reset();
              }}
              className="btn-secondary py-4 text-base"
            >
              Reset
            </button>
          </div>

          {/* Workout-Progress */}
          <div className="mt-6 space-y-2">
            <div className="flex items-baseline justify-between text-xs uppercase tracking-widest text-foreground/60">
              <span>Workout-Fortschritt</span>
              <span>
                {exerciseIndex + 1} / {totalExercises}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-sm bg-carbon-600">
              <div
                className="h-full bg-blood transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Nächste Übung Vorschau */}
          {nextExercise && (
            <div className="mt-6 rounded-sm border border-carbon-500/60 bg-carbon-800/40 px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-foreground/50">
                Als Nächstes
              </div>
              <div className="mt-1 font-bold">{nextExercise.name}</div>
            </div>
          )}

          {/* Done-State */}
          {allDone && (
            <div className="mt-6 rounded-sm border border-green-500/40 bg-green-500/10 px-4 py-4 text-center">
              <div className="font-display text-2xl font-black text-green-400">
                Workout fertig!
              </div>
              {logState === "saving" && (
                <div className="mt-1 text-xs text-foreground/60">
                  Speichere Session…
                </div>
              )}
              {logState === "saved" && (
                <div className="mt-1 text-xs text-green-300">
                  Session im Dashboard gespeichert ✓
                </div>
              )}
              {logState === "error" && (
                <div className="mt-1 text-xs text-blood">
                  Speichern fehlgeschlagen — Firestore aktiv?
                </div>
              )}
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Link href="/dashboard" className="btn-secondary text-xs">
                  Mein Training
                </Link>
                <Link href="/workout/generator" className="btn-primary text-xs">
                  Neues Workout
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="grid grid-cols-3 gap-2">
          <SettingToggle
            label="Sound"
            value={settings.soundOn}
            onChange={setSoundOn}
            icon="🔔"
          />
          <SettingToggle
            label="Vibration"
            value={settings.vibrate}
            onChange={setVibrate}
            icon="📳"
          />
          <SettingToggle
            label="Display"
            value={settings.wakeLock}
            onChange={setWakeLock}
            icon="🌓"
          />
        </div>

        {/* Workout-Übersicht */}
        <div className="card">
          <h3 className="heading-display text-xl font-black">Übersicht</h3>
          <div className="mt-4 space-y-4">
            {workout.blocks.map((block) => (
              <div key={block.phase}>
                <div className="text-xs font-bold uppercase tracking-widest text-blood">
                  {block.phase === "warmup"
                    ? "Aufwärmen"
                    : block.phase === "main"
                      ? "Hauptteil"
                      : block.phase === "conditioning"
                        ? "Konditionierung"
                        : "Cooldown"}
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {block.exerciseIds.map((id, i) => {
                    const ex = getExerciseById(id);
                    if (!ex) return null;
                    const globalIdx = exerciseSequence.indexOf(id);
                    const isCurrent = globalIdx === exerciseIndex;
                    const isPast = globalIdx < exerciseIndex;
                    return (
                      <li
                        key={`${id}-${i}`}
                        className={`flex items-center gap-2 rounded-sm border px-2 py-1 ${
                          isCurrent
                            ? "border-blood bg-blood/10 text-blood font-bold"
                            : isPast
                              ? "border-carbon-500 bg-carbon-800/40 text-foreground/40 line-through"
                              : "border-carbon-500 bg-carbon-800/60"
                        }`}
                      >
                        <span>{isPast ? "✓" : isCurrent ? "▶" : "○"}</span>
                        <span>{ex.name}</span>
                        <span className="ml-auto text-[10px] uppercase tracking-widest text-foreground/50">
                          {ex.defaultRounds}× {ex.durationSeconds}s
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                if (
                  confirm(
                    "Workout wirklich abbrechen? Fortschritt wird als 'abgebrochen' gespeichert.",
                  )
                ) {
                  abortWorkout();
                  window.location.href = "/dashboard";
                }
              }}
              className="text-xs uppercase tracking-widest text-foreground/50 hover:text-blood"
            >
              Workout abbrechen
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function SettingToggle({
  label,
  value,
  onChange,
  icon,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  icon: string;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`flex flex-col items-center gap-1 rounded-sm border px-3 py-3 transition-all ${
        value
          ? "border-blood/60 bg-blood/10 text-blood"
          : "border-carbon-500 bg-carbon-700/40 text-foreground/40"
      }`}
    >
      <span className="text-base">{icon}</span>
      <span className="text-[10px] font-bold tracking-widest">
        {label} {value ? "an" : "aus"}
      </span>
    </button>
  );
}

export default function WorkoutPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-32 text-center text-sm uppercase tracking-widest text-foreground/60 sm:px-6">
          Lade Workout…
        </div>
      }
    >
      <WorkoutRunner />
    </Suspense>
  );
}
