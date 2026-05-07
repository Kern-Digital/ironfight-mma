"use client";

import PageHeader from "@/components/PageHeader";
import TechniqueInlinePanel from "@/components/TechniqueInlinePanel";
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

const PHASE_BG: Record<Phase, string> = {
  idle: "bg-carbon-400",
  prep: "bg-yellow-500",
  work: "bg-blood",
  rest: "bg-blue-500",
  done: "bg-green-500",
};

const BLOCK_LABEL: Record<string, string> = {
  warmup: "Aufwärmen",
  main: "Hauptteil",
  conditioning: "Konditionierung",
  cooldown: "Cooldown",
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

  const exerciseSequence = useMemo(() => {
    if (!workout) return [];
    return workout.blocks.flatMap((b) => b.exerciseIds);
  }, [workout]);

  const [exerciseIndex, setExerciseIndex] = useState(0);
  const currentExerciseId = exerciseSequence[exerciseIndex];
  const currentExercise = currentExerciseId ? getExerciseById(currentExerciseId) : null;
  const nextExerciseId = exerciseSequence[exerciseIndex + 1];
  const nextExercise = nextExerciseId ? getExerciseById(nextExerciseId) : null;

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

  useEffect(() => {
    t.setConfig(initialConfig);
    t.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseIndex]);

  useEffect(() => {
    if (t.phase === "done" && nextExerciseId) {
      const id = setTimeout(() => setExerciseIndex((i) => i + 1), 1500);
      return () => clearTimeout(id);
    }
  }, [t.phase, nextExerciseId]);

  const [logState, setLogState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const loggedRef = useRef(false);

  useEffect(() => {
    if (!workout) return;
    if (t.phase !== "done") return;
    if (nextExerciseId) return;
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

  // Technique accordion (in current exercise card)
  const [openTechniqueId, setOpenTechniqueId] = useState<string | null>(null);

  // Exercise detail dropdown (in overview list)
  const [openExerciseId, setOpenExerciseId] = useState<string | null>(null);

  // Auto-scroll to current exercise in the overview list
  const exerciseRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    const ref = exerciseRowRefs.current[currentExerciseId ?? ""];
    if (ref) ref.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [exerciseIndex, currentExerciseId]);

  // Keyboard shortcuts: Space = pause/resume, → = skip phase
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        if (t.running) t.pause();
        else t.start();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        t.skip();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.running]);

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
            Zum Workout-Generator
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

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {!audioUnlocked && (
          <div className="mb-4 rounded-sm border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
            <strong>📱 Sound:</strong> Tippe einmal auf <strong>Start</strong>, damit Sound auf deinem Gerät funktioniert.
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[380px_1fr] lg:items-start">

          {/* ── LINKE SPALTE: Sticky Timer ───────────────────── */}
          <div className="space-y-4 lg:sticky lg:top-20">

            {/* Timer-Karte */}
            <div className="card">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold uppercase tracking-widest ${PHASE_COLOR[t.phase]}`}>
                  {PHASE_LABEL[t.phase]}
                </span>
                <span className="text-xs uppercase tracking-widest text-foreground/60">
                  Runde {Math.min(t.round, t.config.rounds)} / {t.config.rounds}
                </span>
              </div>

              <div
                className={`my-4 text-center font-display font-black leading-none tabular-nums ${PHASE_COLOR[t.phase]}`}
                style={{ fontSize: "clamp(4.5rem, 18vw, 7rem)" }}
              >
                {formatTime(t.remaining)}
              </div>

              {/* Phase-Fortschrittsbalken */}
              <div className="h-2 overflow-hidden rounded-sm bg-carbon-600">
                <div
                  className={`h-full transition-all duration-200 ${PHASE_BG[t.phase]}`}
                  style={{
                    width: `${t.totalForPhase === 0 ? 0 : Math.min(100, (1 - t.remaining / t.totalForPhase) * 100)}%`,
                  }}
                />
              </div>

              {/* Steuerung */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={t.running ? t.pause : handleStart}
                  className="btn-primary col-span-2 py-3 text-sm"
                >
                  {t.running
                    ? "Pause"
                    : t.phase === "idle" || t.phase === "done"
                    ? "Start"
                    : "Weiter"}
                </button>
                <button
                  onClick={t.skip}
                  className="btn-secondary py-3 text-sm"
                  disabled={t.phase === "idle" || t.phase === "done"}
                >
                  Phase skip
                </button>
                <button
                  onClick={() => {
                    t.reset();
                    if (exerciseIndex < totalExercises - 1) {
                      setExerciseIndex((i) => i + 1);
                    }
                  }}
                  className="btn-secondary py-3 text-sm"
                  disabled={!nextExerciseId}
                >
                  Nächste →
                </button>
                <button
                  onClick={t.reset}
                  className="btn-secondary col-span-2 py-2 text-xs"
                >
                  Reset
                </button>
              </div>

              {/* Keyboard-Hinweis (nur Desktop) */}
              <div className="mt-3 hidden items-center justify-center gap-4 text-[10px] uppercase tracking-widest text-foreground/25 sm:flex">
                <span>
                  <kbd className="rounded border border-carbon-500 px-1.5 py-0.5">Space</kbd>{" "}
                  Start / Pause
                </span>
                <span>
                  <kbd className="rounded border border-carbon-500 px-1.5 py-0.5">→</kbd>{" "}
                  Skip Phase
                </span>
              </div>
            </div>

            {/* Workout-Fortschritt */}
            <div className="card">
              <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-widest text-foreground/60">
                <span>Workout-Fortschritt</span>
                <span>{Math.min(exerciseIndex + 1, totalExercises)} / {totalExercises}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-sm bg-carbon-600">
                <div
                  className="h-full bg-blood transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Einstellungen */}
            <div className="grid grid-cols-3 gap-2">
              <SettingToggle label="Sound" value={settings.soundOn} onChange={setSoundOn} icon="🔔" />
              <SettingToggle label="Vibration" value={settings.vibrate} onChange={setVibrate} icon="📳" />
              <SettingToggle label="Display" value={settings.wakeLock} onChange={setWakeLock} icon="🌓" />
            </div>
          </div>

          {/* ── RECHTE SPALTE: Übungsdetails ─────────────────── */}
          <div className="space-y-4">

            {/* Aktuelle Übung — immer vollständig ausgeklappt */}
            <div className={`card border-blood/40 transition-opacity ${allDone ? "opacity-50" : ""}`}>
              <div className="mb-3 text-xs font-bold uppercase tracking-widest text-blood">
                Aktuelle Übung
              </div>

              {currentExercise ? (
                <div>
                  <h2 className="heading-display text-3xl font-black sm:text-4xl">
                    {currentExercise.name}
                  </h2>

                  {currentExercise.notes && (
                    <p className="mt-3 text-sm text-foreground/70">{currentExercise.notes}</p>
                  )}

                  {currentExercise.cues && currentExercise.cues.length > 0 && (
                    <ul className="mt-4 flex flex-wrap gap-2">
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

                  {currentExercise.focus && currentExercise.focus.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="font-bold uppercase tracking-widest text-foreground/50">Fokus:</span>
                      {currentExercise.focus.map((f) => (
                        <span key={f} className="rounded-sm bg-carbon-700 px-2 py-0.5 text-foreground/70">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}

                  {currentExercise.equipment.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="font-bold uppercase tracking-widest text-foreground/50">Equipment:</span>
                      {currentExercise.equipment.map((eq) => {
                        const def = EQUIPMENT[eq];
                        if (!def) return null;
                        return (
                          <span key={eq} className="inline-flex items-center gap-1 rounded-sm bg-carbon-700 px-2 py-0.5 text-foreground/70">
                            <span>{def.icon}</span>
                            <span>{def.label}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {currentExercise.techniqueIds && currentExercise.techniqueIds.length > 0 && (
                    <div className="mt-4 space-y-1 border-t border-carbon-500/60 pt-3">
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-foreground/40">
                        Verlinkte Techniken
                      </div>
                      {currentExercise.techniqueIds.map((tid) => {
                        const tech = getTechniqueById(tid);
                        if (!tech) return null;
                        const isOpen = openTechniqueId === tid;
                        return (
                          <div key={tid}>
                            <button
                              aria-expanded={isOpen}
                              onClick={() =>
                                setOpenTechniqueId((prev) => (prev === tid ? null : tid))
                              }
                              className={`flex w-full items-center justify-between gap-2 rounded-sm border px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-all ${
                                isOpen
                                  ? "border-blood/50 bg-blood/10 text-blood"
                                  : "border-blood/30 bg-blood/5 text-blood/70 hover:border-blood/50 hover:text-blood"
                              }`}
                            >
                              <span>Technik: {tech.name}</span>
                              <span>{isOpen ? "▴" : "▾"}</span>
                            </button>
                            {isOpen && (
                              <TechniqueInlinePanel
                                id={`tp-current-${tid}`}
                                techniqueId={tid}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-foreground/60">Keine Übung geladen.</p>
              )}
            </div>

            {/* Als Nächstes */}
            {nextExercise && !allDone && (
              <div className="rounded-sm border border-carbon-500/60 bg-carbon-800/40 px-4 py-3">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-foreground/50">
                  Als Nächstes
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold">{nextExercise.name}</span>
                  <span className="shrink-0 text-xs text-foreground/50">
                    {nextExercise.defaultRounds}× {nextExercise.durationSeconds}s
                  </span>
                </div>
                {nextExercise.cues && nextExercise.cues.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {nextExercise.cues.slice(0, 3).map((c) => (
                      <span
                        key={c}
                        className="rounded-sm border border-carbon-500 px-2 py-0.5 text-[10px] text-foreground/50"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Fertig-Banner */}
            {allDone && (
              <div className="rounded-sm border border-green-500/40 bg-green-500/10 px-4 py-6 text-center">
                <div className="font-display text-3xl font-black text-green-400">
                  Workout fertig! 🏆
                </div>
                {logState === "saving" && (
                  <p className="mt-2 text-xs text-foreground/60">Speichere Session…</p>
                )}
                {logState === "saved" && (
                  <p className="mt-2 text-xs text-green-300">Session im Dashboard gespeichert ✓</p>
                )}
                {logState === "error" && (
                  <p className="mt-2 text-xs text-blood">Speichern fehlgeschlagen</p>
                )}
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Link href="/dashboard" className="btn-secondary text-xs">
                    Mein Training
                  </Link>
                  <Link href="/workout/generator" className="btn-primary text-xs">
                    Neues Workout
                  </Link>
                </div>
              </div>
            )}

            {/* Alle Übungen — interaktive Accordion-Liste */}
            <div className="card">
              <h3 className="heading-display mb-4 text-lg font-black">Alle Übungen</h3>
              <div className="space-y-6">
                {workout.blocks.map((block) => (
                  <div key={block.phase}>
                    <div className="mb-2 text-xs font-bold uppercase tracking-widest text-blood">
                      {BLOCK_LABEL[block.phase] ?? block.phase}
                    </div>
                    <div className="space-y-1">
                      {block.exerciseIds.map((id, i) => {
                        const ex = getExerciseById(id);
                        if (!ex) return null;
                        const globalIdx = exerciseSequence.indexOf(id);
                        const isCurrent = globalIdx === exerciseIndex;
                        const isPast = globalIdx < exerciseIndex;
                        const isOpen = openExerciseId === id && !isCurrent;

                        return (
                          <div
                            key={`${id}-${i}`}
                            ref={(el) => {
                              exerciseRowRefs.current[id] = el;
                            }}
                          >
                            <button
                              onClick={() => {
                                if (isCurrent || isPast) return;
                                setOpenExerciseId((prev) =>
                                  prev === id ? null : id,
                                );
                              }}
                              disabled={isCurrent || isPast}
                              className={`flex w-full items-center gap-2 rounded-sm border px-3 py-2 text-left transition-all ${
                                isCurrent
                                  ? "border-blood bg-blood/10 font-bold text-blood"
                                  : isPast
                                  ? "cursor-default border-carbon-500 bg-carbon-800/40 text-foreground/40"
                                  : "cursor-pointer border-carbon-500 bg-carbon-800/60 hover:border-blood/40"
                              }`}
                            >
                              <span className="shrink-0 text-xs">
                                {isPast ? "✓" : isCurrent ? "▶" : "○"}
                              </span>
                              <span
                                className={`text-sm ${isPast ? "line-through" : ""}`}
                              >
                                {ex.name}
                              </span>
                              <span className="ml-auto shrink-0 text-[10px] uppercase tracking-widest text-foreground/50">
                                {ex.defaultRounds}× {ex.durationSeconds}s
                              </span>
                              {!isCurrent && !isPast && (
                                <span className="shrink-0 text-xs text-foreground/40">
                                  {isOpen ? "▴" : "▾"}
                                </span>
                              )}
                            </button>

                            {/* Aufklappbare Detailansicht */}
                            {isOpen && (
                              <div className="mb-1 rounded-b-sm border border-t-0 border-carbon-500/60 bg-carbon-800/40 px-3 pb-3 pt-2 text-xs">
                                {ex.notes && (
                                  <p className="mt-1 text-foreground/70">{ex.notes}</p>
                                )}
                                {ex.cues && ex.cues.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {ex.cues.map((c) => (
                                      <span
                                        key={c}
                                        className="rounded-sm border border-carbon-400 px-2 py-0.5 uppercase tracking-widest text-foreground/60"
                                      >
                                        {c}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {ex.focus && ex.focus.length > 0 && (
                                  <div className="mt-2 flex flex-wrap items-center gap-1">
                                    <span className="font-bold uppercase tracking-widest text-foreground/40">
                                      Fokus:
                                    </span>
                                    {ex.focus.map((f) => (
                                      <span
                                        key={f}
                                        className="rounded-sm bg-carbon-700 px-2 py-0.5 text-foreground/60"
                                      >
                                        {f}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {ex.equipment.length > 0 && (
                                  <div className="mt-2 flex flex-wrap items-center gap-1">
                                    <span className="font-bold uppercase tracking-widest text-foreground/40">
                                      Equipment:
                                    </span>
                                    {ex.equipment.map((eq) => {
                                      const def = EQUIPMENT[eq];
                                      return def ? (
                                        <span
                                          key={eq}
                                          className="inline-flex items-center gap-1 text-foreground/60"
                                        >
                                          <span>{def.icon}</span>
                                          <span>{def.label}</span>
                                        </span>
                                      ) : null;
                                    })}
                                  </div>
                                )}
                                {ex.techniqueIds && ex.techniqueIds.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {ex.techniqueIds.map((tid) => {
                                      const tech = getTechniqueById(tid);
                                      return tech ? (
                                        <Link
                                          key={tid}
                                          href={`/techniques/${tid}`}
                                          target="_blank"
                                          className="rounded-sm border border-blood/30 bg-blood/5 px-2 py-0.5 font-bold uppercase tracking-wider text-blood hover:bg-blood/15"
                                        >
                                          {tech.name} →
                                        </Link>
                                      ) : null;
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
                  className="text-xs uppercase tracking-widest text-foreground/40 transition-colors hover:text-blood"
                >
                  Workout abbrechen
                </button>
              </div>
            </div>
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
        <div className="mx-auto max-w-7xl px-4 py-32 text-center text-sm uppercase tracking-widest text-foreground/60 sm:px-6">
          Lade Workout…
        </div>
      }
    >
      <WorkoutRunner />
    </Suspense>
  );
}
