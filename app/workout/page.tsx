"use client";

/**
 * Workout-Runner (Detail-Ansicht) — Timer + Übungsdetails + Ablaufliste.
 * Neues Token-System (Rollout Etappe 4). Phasenfarben laufen über die
 * Semantik-Tokens (prep=warning, work=accent, rest=neutral, done=positive) —
 * keine eigenen Farbwerte. Verhalten (Timer, Logging, Shortcuts) unverändert.
 */

import AthleteTabBar from "@/components/AthleteTabBar";
import Icon, { type IconName } from "@/components/ui/Icon";
import TechniqueInlinePanel from "@/components/TechniqueInlinePanel";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
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
import { Fragment, Suspense, useEffect, useMemo, useRef, useState } from "react";

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

// Phasenfarbe = Semantik-Token; rest bleibt bewusst ruhig/neutral
const PHASE_COLOR: Record<Phase, string> = {
  idle: "var(--text-body)",
  prep: "var(--warning)",
  work: "var(--accent-text)",
  rest: "var(--text-2)",
  done: "var(--positive)",
};

const BLOCK_LABEL: Record<string, string> = {
  warmup: "Aufwärmen",
  main: "Hauptteil",
  conditioning: "Konditionierung",
  cooldown: "Cooldown",
};

// ─── Typo-Konstanten (Muster der Referenzseiten) ───────────────────────────

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const META_FONT: React.CSSProperties = {
  font: "600 10px/1.2 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

function Hairline() {
  return <div aria-hidden style={{ height: "1px", background: "var(--line)" }} />;
}

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-badge px-2 py-1"
      style={{
        ...META_FONT,
        background: "var(--surface-raised)",
        border: "1px solid var(--line)",
        color: "var(--text-2)",
      }}
    >
      {children}
    </span>
  );
}

function parseWorkoutFromUrl(payload: string | null): WorkoutDefinition | null {
  if (!payload) return null;
  try {
    return JSON.parse(decodeURIComponent(payload)) as WorkoutDefinition;
  } catch {
    return null;
  }
}

// ─── Kopfbereich (Ambient nur hier) ────────────────────────────────────────

function PageHead({
  eyebrow,
  title,
  sub,
  showThemeButton,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  showThemeButton: boolean;
}) {
  const { theme, toggleTheme } = useTheme();
  return (
    <section className="relative">
      <div className="absolute inset-0 overflow-hidden" aria-hidden>
        <div data-ambient style={{ background: "var(--ambient)" }} />
      </div>
      <div className="relative mx-auto flex w-full max-w-2xl items-start gap-3 px-4 pb-5 pt-6 lg:max-w-6xl lg:px-6 lg:pb-7 lg:pt-8">
        <div className="flex flex-1 flex-col gap-1">
          <span className="t-label">{eyebrow}</span>
          <h1
            style={{
              font: "var(--type-display)",
              letterSpacing: "var(--ls-display)",
              textTransform: "uppercase",
            }}
          >
            {title}
          </h1>
          {sub && (
            <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>{sub}</p>
          )}
        </div>
        {showThemeButton && (
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              theme === "dark"
                ? "Helles Design aktivieren"
                : "Dunkles Design aktivieren"
            }
            className="t-glass t-interactive inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-field lg:hidden"
            style={{ color: "var(--text-2)" }}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} size={20} />
          </button>
        )}
      </div>
    </section>
  );
}

function WorkoutRunner() {
  const params = useSearchParams();
  const workout = useMemo(
    () => parseWorkoutFromUrl(params.get("payload")),
    [params],
  );
  const { user, profile } = useAuth();
  const isTrainer = profile?.role === "trainer" || profile?.role === "admin";
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

  // Technik-Accordion (in der Karte der aktuellen Übung)
  const [openTechniqueId, setOpenTechniqueId] = useState<string | null>(null);

  // Übungs-Detail-Dropdown (in der Ablaufliste)
  const [openExerciseId, setOpenExerciseId] = useState<string | null>(null);

  // Auto-Scroll zur aktuellen Übung in der Ablaufliste
  const exerciseRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    const ref = exerciseRowRefs.current[currentExerciseId ?? ""];
    if (ref) ref.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [exerciseIndex, currentExerciseId]);

  // Shortcuts: Space = Pause/Weiter, → = Phase überspringen
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
      <main
        className={isTrainer ? "min-h-screen pb-12" : "min-h-screen pb-32"}
        style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
      >
        <PageHead
          eyebrow="Workout"
          title="Kein Workout geladen"
          sub="Starte eines aus dem Generator oder von einer Trainingsplan-Seite."
          showThemeButton={!isTrainer}
        />
        <div className="mx-auto w-full max-w-2xl px-4 pt-8 text-center lg:px-6">
          <Link
            href="/workout/generator"
            className="t-interactive inline-flex min-h-hit items-center justify-center gap-2 rounded-field px-5"
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
        {!isTrainer && <AthleteTabBar />}
      </main>
    );
  }

  const totalExercises = exerciseSequence.length;
  const progress = (exerciseIndex / Math.max(1, totalExercises)) * 100;
  const allDone = !nextExerciseId && t.phase === "done";
  const phaseColor = PHASE_COLOR[t.phase];

  return (
    <main
      className={isTrainer ? "min-h-screen pb-12" : "min-h-screen pb-32"}
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      <PageHead
        eyebrow={`${CATEGORY_LABEL[workout.category]} · ${DIFFICULTY_LABEL[workout.difficulty]}`}
        title={workout.label}
        sub={`Übung ${Math.min(exerciseIndex + 1, totalExercises)} / ${totalExercises}`}
        showThemeButton={!isTrainer}
      />

      <div className="mx-auto w-full max-w-2xl px-4 pt-1 lg:max-w-6xl lg:px-6">
        {!audioUnlocked && (
          <div
            className="mb-4 rounded-field px-3.5 py-2.5"
            style={{
              font: "var(--type-sub)",
              background: "color-mix(in oklab, var(--warning) 12%, transparent)",
              border: "1px solid color-mix(in oklab, var(--warning) 40%, transparent)",
              color: "var(--warning)",
            }}
          >
            Tippe einmal auf <strong>Start</strong>, damit Sound auf deinem Gerät
            funktioniert.
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[380px_1fr] lg:items-start">
          {/* ── LINKE SPALTE: Sticky Timer ───────────────────── */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-20">
            {/* Timer-Karte */}
            <div className="t-card p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="t-label" style={{ color: phaseColor }}>
                  {PHASE_LABEL[t.phase]}
                </span>
                <span style={{ ...META_FONT, color: "var(--text-3)" }}>
                  Runde {Math.min(t.round, t.config.rounds)} / {t.config.rounds}
                </span>
              </div>

              <div
                className="my-4 text-center tabular-nums"
                style={{
                  font: "800 72px/1 var(--font-archivo), system-ui, sans-serif",
                  fontSize: "clamp(4.5rem, 18vw, 7rem)",
                  color: phaseColor,
                }}
              >
                {formatTime(t.remaining)}
              </div>

              {/* Phase-Fortschrittsbalken (Phasenfarbe statt Verlauf) */}
              <div className="t-progress">
                <span
                  style={{
                    width: `${t.totalForPhase === 0 ? 0 : Math.min(100, (1 - t.remaining / t.totalForPhase) * 100)}%`,
                    background:
                      t.phase === "work" ? "var(--grad-progress)" : phaseColor,
                    transition: "width 200ms var(--ease-out)",
                  }}
                />
              </div>

              {/* Steuerung */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={t.running ? t.pause : handleStart}
                  className="t-interactive col-span-2 inline-flex min-h-hit items-center justify-center gap-2 rounded-field"
                  style={{
                    ...BTN_FONT,
                    background: "var(--accent)",
                    color: "var(--on-accent)",
                    boxShadow: "var(--accent-glow)",
                  }}
                >
                  <Icon name={t.running ? "pause" : "play"} size={13} strokeWidth={2.2} />
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
                  className="t-interactive inline-flex min-h-hit items-center justify-center rounded-field disabled:opacity-40"
                  style={{
                    ...BTN_FONT,
                    background: "var(--surface-raised)",
                    border: "1px solid var(--line)",
                    color: "var(--text-2)",
                  }}
                >
                  Phase skip
                </button>
                <button
                  type="button"
                  onClick={() => {
                    t.reset();
                    if (exerciseIndex < totalExercises - 1) {
                      setExerciseIndex((i) => i + 1);
                    }
                  }}
                  disabled={!nextExerciseId}
                  className="t-interactive inline-flex min-h-hit items-center justify-center gap-1.5 rounded-field disabled:opacity-40"
                  style={{
                    ...BTN_FONT,
                    background: "var(--surface-raised)",
                    border: "1px solid var(--line)",
                    color: "var(--text-2)",
                  }}
                >
                  Nächste
                  <Icon name="arrow-right" size={13} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  onClick={t.reset}
                  className="t-interactive col-span-2 inline-flex min-h-hit items-center justify-center rounded-field"
                  style={{ ...BTN_FONT, color: "var(--text-3)" }}
                >
                  Reset
                </button>
              </div>

              {/* Shortcut-Hinweis (nur Desktop) */}
              <div
                className="mt-3 hidden items-center justify-center gap-4 sm:flex"
                style={{ ...META_FONT, color: "var(--text-3)" }}
              >
                <span>
                  <kbd
                    className="rounded-badge px-1.5 py-0.5"
                    style={{ border: "1px solid var(--line-strong)" }}
                  >
                    Space
                  </kbd>{" "}
                  Start / Pause
                </span>
                <span>
                  <kbd
                    className="rounded-badge px-1.5 py-0.5"
                    style={{ border: "1px solid var(--line-strong)" }}
                  >
                    →
                  </kbd>{" "}
                  Skip Phase
                </span>
              </div>
            </div>

            {/* Workout-Fortschritt */}
            <div>
              <div
                className="mb-2 flex items-center justify-between"
                style={{ ...META_FONT, color: "var(--text-3)" }}
              >
                <span>Workout-Fortschritt</span>
                <span>
                  {Math.min(exerciseIndex + 1, totalExercises)} / {totalExercises}
                </span>
              </div>
              <div className="t-progress">
                <span
                  style={{
                    width: `${progress}%`,
                    transition: "width 500ms var(--ease-out)",
                  }}
                />
              </div>
            </div>

            {/* Einstellungen */}
            <div className="grid grid-cols-3 gap-2">
              <SettingToggle label="Sound" value={settings.soundOn} onChange={setSoundOn} icon="bell" />
              <SettingToggle label="Vibration" value={settings.vibrate} onChange={setVibrate} icon="vibrate" />
              <SettingToggle label="Display" value={settings.wakeLock} onChange={setWakeLock} icon="moon" />
            </div>
          </div>

          {/* ── RECHTE SPALTE: Übungsdetails ─────────────────── */}
          <div className="flex flex-col gap-4">
            {/* Aktuelle Übung — immer vollständig ausgeklappt */}
            <div
              className={`t-card p-4 transition-opacity sm:p-5 ${allDone ? "opacity-50" : ""}`}
            >
              <div className="mb-3">
                <span className="t-label" style={{ color: "var(--accent-text)" }}>
                  Aktuelle Übung
                </span>
              </div>

              {currentExercise ? (
                <div>
                  <h2
                    style={{
                      font: "var(--type-display)",
                      letterSpacing: "var(--ls-display)",
                      textTransform: "uppercase",
                    }}
                  >
                    {currentExercise.name}
                  </h2>

                  {currentExercise.notes && (
                    <p
                      className="mt-3"
                      style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
                    >
                      {currentExercise.notes}
                    </p>
                  )}

                  {currentExercise.cues && currentExercise.cues.length > 0 && (
                    <ul className="mt-4 flex flex-wrap gap-1.5">
                      {currentExercise.cues.map((c) => (
                        <li key={c}>
                          <MetaChip>{c}</MetaChip>
                        </li>
                      ))}
                    </ul>
                  )}

                  {currentExercise.focus && currentExercise.focus.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span style={{ ...META_FONT, color: "var(--text-3)" }}>
                        Fokus:
                      </span>
                      {currentExercise.focus.map((f) => (
                        <span
                          key={f}
                          style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  )}

                  {currentExercise.equipment.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span style={{ ...META_FONT, color: "var(--text-3)" }}>
                        Equipment:
                      </span>
                      {currentExercise.equipment.map((eq) => {
                        const def = EQUIPMENT[eq];
                        if (!def) return null;
                        return (
                          <span
                            key={eq}
                            className="inline-flex items-center gap-1"
                            style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
                          >
                            <Icon name={def.icon} size={14} />
                            <span>{def.label}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {currentExercise.techniqueIds &&
                    currentExercise.techniqueIds.length > 0 && (
                      <div className="mt-4 flex flex-col gap-1 pt-3" style={{ borderTop: "1px solid var(--line)" }}>
                        <span
                          className="mb-1"
                          style={{ ...META_FONT, color: "var(--text-3)" }}
                        >
                          Verlinkte Techniken
                        </span>
                        {currentExercise.techniqueIds.map((tid) => {
                          const tech = getTechniqueById(tid);
                          if (!tech) return null;
                          const isOpen = openTechniqueId === tid;
                          return (
                            <div key={tid}>
                              <button
                                type="button"
                                aria-expanded={isOpen}
                                onClick={() =>
                                  setOpenTechniqueId((prev) =>
                                    prev === tid ? null : tid,
                                  )
                                }
                                className="t-interactive flex min-h-hit w-full items-center justify-between gap-2 rounded-field px-3"
                                style={{
                                  ...BTN_FONT,
                                  background: isOpen
                                    ? "var(--accent-subtle)"
                                    : "var(--surface-raised)",
                                  border: "1px solid",
                                  borderColor: isOpen
                                    ? "var(--accent)"
                                    : "var(--line)",
                                  color: isOpen
                                    ? "var(--accent-text)"
                                    : "var(--text-2)",
                                }}
                              >
                                <span className="truncate">
                                  Technik: {tech.name}
                                </span>
                                <span
                                  aria-hidden
                                  style={{
                                    lineHeight: 0,
                                    transform: isOpen ? "rotate(180deg)" : "none",
                                    transition:
                                      "transform var(--dur-fast) var(--ease-out)",
                                  }}
                                >
                                  <Icon name="chevron-down" size={14} strokeWidth={2.2} />
                                </span>
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
                <p style={{ font: "var(--type-body)", color: "var(--text-3)" }}>
                  Keine Übung geladen.
                </p>
              )}
            </div>

            {/* Als Nächstes */}
            {nextExercise && !allDone && (
              <div className="px-1 py-2">
                <span
                  className="mb-1 block"
                  style={{ ...META_FONT, color: "var(--text-3)" }}
                >
                  Als Nächstes
                </span>
                <div className="flex items-center justify-between gap-3">
                  <span style={{ font: "var(--type-body-strong)" }}>
                    {nextExercise.name}
                  </span>
                  <span
                    className="shrink-0"
                    style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                  >
                    {nextExercise.defaultRounds}× {nextExercise.durationSeconds}s
                  </span>
                </div>
                {nextExercise.cues && nextExercise.cues.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {nextExercise.cues.slice(0, 3).map((c) => (
                      <MetaChip key={c}>{c}</MetaChip>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Fertig-Banner */}
            {allDone && (
              <div
                className="rounded-card px-4 py-6 text-center"
                style={{
                  background: "color-mix(in oklab, var(--positive) 10%, transparent)",
                  border: "1px solid color-mix(in oklab, var(--positive) 40%, transparent)",
                }}
              >
                <div
                  style={{
                    font: "var(--type-display)",
                    letterSpacing: "var(--ls-display)",
                    textTransform: "uppercase",
                    color: "var(--positive)",
                  }}
                >
                  Workout fertig!
                </div>
                {logState === "saving" && (
                  <p
                    className="mt-2"
                    style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                  >
                    Speichere Session…
                  </p>
                )}
                {logState === "saved" && (
                  <p
                    className="mt-2 inline-flex items-center gap-1.5"
                    style={{ font: "var(--type-sub)", color: "var(--positive)" }}
                  >
                    <Icon name="check" size={14} strokeWidth={2.6} />
                    Session im Dashboard gespeichert
                  </p>
                )}
                {logState === "error" && (
                  <p
                    className="mt-2"
                    style={{ font: "var(--type-sub)", color: "var(--negative)" }}
                  >
                    Speichern fehlgeschlagen
                  </p>
                )}
                <div className="mt-4 flex flex-wrap justify-center gap-2">
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

            {/* Ablaufliste — pro Block EINE Karte mit Haarlinien-Trennern */}
            <div className="flex flex-col gap-5">
              <h3
                style={{
                  font: "var(--type-h3)",
                  letterSpacing: "var(--ls-display)",
                  textTransform: "uppercase",
                }}
              >
                Alle Übungen
              </h3>
              {workout.blocks.map((block) => (
                <div key={block.phase} className="flex flex-col gap-2">
                  <span className="t-label">
                    {BLOCK_LABEL[block.phase] ?? block.phase}
                  </span>
                  <div className="t-card px-3.5 py-0.5">
                    {block.exerciseIds.map((id, i) => {
                      const ex = getExerciseById(id);
                      if (!ex) return null;
                      const globalIdx = exerciseSequence.indexOf(id);
                      const isCurrent = globalIdx === exerciseIndex;
                      const isPast = globalIdx < exerciseIndex;
                      const isOpen = openExerciseId === id && !isCurrent;

                      return (
                        <Fragment key={`${id}-${i}`}>
                          {i > 0 && <Hairline />}
                          <div
                            ref={(el) => {
                              exerciseRowRefs.current[id] = el;
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (isCurrent || isPast) return;
                                setOpenExerciseId((prev) =>
                                  prev === id ? null : id,
                                );
                              }}
                              disabled={isCurrent || isPast}
                              aria-expanded={!isCurrent && !isPast ? isOpen : undefined}
                              className="t-interactive flex min-h-hit w-full items-center gap-2.5 rounded-badge py-2 text-left"
                            >
                              <span
                                aria-hidden
                                className="shrink-0"
                                style={{
                                  lineHeight: 0,
                                  color: isCurrent
                                    ? "var(--accent-text)"
                                    : isPast
                                    ? "var(--positive)"
                                    : "var(--text-3)",
                                }}
                              >
                                <Icon
                                  name={isPast ? "check" : isCurrent ? "play" : "timer"}
                                  size={14}
                                  strokeWidth={2.2}
                                />
                              </span>
                              <span
                                className={isPast ? "line-through" : ""}
                                style={{
                                  font: isCurrent
                                    ? "var(--type-body-strong)"
                                    : "var(--type-body)",
                                  color: isCurrent
                                    ? "var(--accent-text)"
                                    : isPast
                                    ? "var(--text-3)"
                                    : "var(--text-body)",
                                }}
                              >
                                {ex.name}
                              </span>
                              <span
                                className="ml-auto shrink-0"
                                style={{ ...META_FONT, color: "var(--text-3)" }}
                              >
                                {ex.defaultRounds}× {ex.durationSeconds}s
                              </span>
                              {!isCurrent && !isPast && (
                                <span
                                  aria-hidden
                                  className="shrink-0"
                                  style={{
                                    lineHeight: 0,
                                    color: "var(--text-3)",
                                    transform: isOpen ? "rotate(180deg)" : "none",
                                    transition:
                                      "transform var(--dur-fast) var(--ease-out)",
                                  }}
                                >
                                  <Icon name="chevron-down" size={14} strokeWidth={2.2} />
                                </span>
                              )}
                            </button>

                            {/* Aufklappbare Detailansicht */}
                            {isOpen && (
                              <div className="flex flex-col gap-2 pb-3 pl-7 pr-2 pt-1">
                                {ex.notes && (
                                  <p
                                    style={{
                                      font: "var(--type-sub)",
                                      color: "var(--text-2)",
                                    }}
                                  >
                                    {ex.notes}
                                  </p>
                                )}
                                {ex.cues && ex.cues.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {ex.cues.map((c) => (
                                      <MetaChip key={c}>{c}</MetaChip>
                                    ))}
                                  </div>
                                )}
                                {ex.focus && ex.focus.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span
                                      style={{ ...META_FONT, color: "var(--text-3)" }}
                                    >
                                      Fokus:
                                    </span>
                                    {ex.focus.map((f) => (
                                      <span
                                        key={f}
                                        style={{
                                          font: "var(--type-sub)",
                                          color: "var(--text-2)",
                                        }}
                                      >
                                        {f}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {ex.equipment.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span
                                      style={{ ...META_FONT, color: "var(--text-3)" }}
                                    >
                                      Equipment:
                                    </span>
                                    {ex.equipment.map((eq) => {
                                      const def = EQUIPMENT[eq];
                                      return def ? (
                                        <span
                                          key={eq}
                                          className="inline-flex items-center gap-1"
                                          style={{
                                            font: "var(--type-sub)",
                                            color: "var(--text-2)",
                                          }}
                                        >
                                          <Icon name={def.icon} size={13} />
                                          <span>{def.label}</span>
                                        </span>
                                      ) : null;
                                    })}
                                  </div>
                                )}
                                {ex.techniqueIds && ex.techniqueIds.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {ex.techniqueIds.map((tid) => {
                                      const tech = getTechniqueById(tid);
                                      return tech ? (
                                        <Link
                                          key={tid}
                                          href={`/techniques/${tid}`}
                                          target="_blank"
                                          className="t-interactive inline-flex min-h-hit items-center gap-1.5 rounded-field px-3"
                                          style={{
                                            ...BTN_FONT,
                                            background: "var(--accent-subtle)",
                                            color: "var(--accent-text)",
                                            textDecoration: "none",
                                          }}
                                        >
                                          {tech.name}
                                          <Icon
                                            name="arrow-right"
                                            size={12}
                                            strokeWidth={2.2}
                                          />
                                        </Link>
                                      ) : null;
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </Fragment>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="text-center">
                <button
                  type="button"
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
                  className="t-interactive inline-flex min-h-hit items-center justify-center rounded-field px-4"
                  style={{ ...BTN_FONT, color: "var(--text-3)" }}
                >
                  Workout abbrechen
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!isTrainer && <AthleteTabBar />}
    </main>
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
  icon: IconName;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      aria-label={label}
      className="t-interactive flex min-h-hit flex-col items-center justify-center gap-1 rounded-field px-2 py-2.5"
      style={{
        background: value ? "var(--accent-subtle)" : "var(--surface-card)",
        border: "1px solid",
        borderColor: value ? "var(--accent)" : "var(--line)",
        color: value ? "var(--accent-text)" : "var(--text-3)",
      }}
    >
      <Icon name={icon} size={18} />
      <span style={META_FONT}>
        {label} {value ? "an" : "aus"}
      </span>
    </button>
  );
}

export default function WorkoutPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen px-4 py-32 text-center"
          style={{
            font: "var(--type-sub)",
            color: "var(--text-3)",
            background: "var(--surface-page)",
          }}
        >
          Lade Workout…
        </div>
      }
    >
      <WorkoutRunner />
    </Suspense>
  );
}
