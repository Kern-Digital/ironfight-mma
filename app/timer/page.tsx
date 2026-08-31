"use client";

/**
 * Runden-Timer — freies Training ohne Plan (Redesign-Etappe 5, Referenzseite).
 *
 * Neues Token-System, Formensprache des Runners (/workout/session):
 *  - Phasenfarben = Semantik-Tokens (prep=warning, work=accent, rest=neutral,
 *    done=positive), Glows via color-mix aus denselben Tokens
 *  - Steuerung im Runner-Muster: Start/Pause (3/4) + Phasen-Skip (1/4),
 *    Reset darunter in voller Breite
 *  - Kampf- und Pausenzeit über das RestWheel (Glas-Rad, 15-s-Raster) —
 *    dieselbe Interaktion wie im Plan-Editor; Runden und Vorlauf als Stepper
 *  - Sound/Vibration/Display-Toggles bewusst NICHT hier: app-weit unter
 *    /profile (gleiche Entscheidung wie beim Runner, 2026-08-27)
 *  - Athleten-Shell (Tab-Bar, Training aktiv); Trainer behalten die Navbar
 *
 * Der Timer bleibt der FREIE Modus — für strukturierte Einheiten verweist
 * die Karte unten auf die Workout-Pläne (geführter Runner, Plan-Modell).
 * Query-Parameter ?rounds/work/rest/prep/label bleiben unterstützt
 * (alte Bookmarks/Verläufe).
 */

import AthleteTabBar from "@/components/AthleteTabBar";
import RestWheel, { formatRest } from "@/components/RestWheel";
import Icon from "@/components/ui/Icon";
import { unlockAudio, isAudioUnlocked } from "@/lib/audio";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useTimerSettings } from "@/lib/use-timer-settings";
import { useWakeLock } from "@/lib/use-wake-lock";
import {
  DEFAULT_CONFIG,
  useWorkoutTimer,
  type Phase,
  type TimerConfig,
} from "@/lib/use-workout-timer";
import { logWorkout } from "@/lib/workouts";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

// ─── Presets ──────────────────────────────────────────────────────────────────

const PRESETS: { label: string; config: TimerConfig }[] = [
  {
    label: "Boxing 3×3",
    config: { rounds: 3, workSeconds: 180, restSeconds: 60, prepSeconds: 10 },
  },
  {
    label: "MMA 5×5",
    config: { rounds: 5, workSeconds: 300, restSeconds: 60, prepSeconds: 10 },
  },
  {
    label: "HIIT Tabata",
    config: { rounds: 8, workSeconds: 20, restSeconds: 10, prepSeconds: 10 },
  },
  {
    label: "Heavy Bag",
    config: { rounds: 6, workSeconds: 120, restSeconds: 30, prepSeconds: 10 },
  },
];

function sameConfig(a: TimerConfig, b: TimerConfig) {
  return (
    a.rounds === b.rounds &&
    a.workSeconds === b.workSeconds &&
    a.restSeconds === b.restSeconds &&
    a.prepSeconds === b.prepSeconds
  );
}

// ─── Phase-Styling (Semantik-Tokens, identisch zum Runner) ────────────────────

const PHASE_LABEL: Record<Phase, string> = {
  idle: "Bereit",
  prep: "Vorbereitung",
  work: "Kampf",
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

const PHASE_GLOW: Record<Phase, string> = {
  idle: "none",
  prep: "drop-shadow(0 0 20px color-mix(in oklab, var(--warning) 50%, transparent))",
  work: "drop-shadow(0 0 28px color-mix(in oklab, var(--accent) 55%, transparent))",
  rest: "none",
  done: "drop-shadow(0 0 20px color-mix(in oklab, var(--positive) 50%, transparent))",
};

// Ring-Stroke braucht die ECHTE Phasenfarbe (accent statt accent-text, damit
// der Kreis in beiden Themes leuchtet wie die Fortschrittsbalken)
const PHASE_STROKE: Record<Phase, string> = {
  idle: "var(--line-strong)",
  prep: "var(--warning)",
  work: "var(--accent)",
  rest: "var(--text-3)",
  done: "var(--positive)",
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

// ─── Helfer ───────────────────────────────────────────────────────────────────

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

function parsePositive(v: string | null, fallback: number) {
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

// ─── Timer-Ring ───────────────────────────────────────────────────────────────

function TimerRing({
  progress,
  phase,
  remaining,
  round,
  rounds,
}: {
  progress: number;
  phase: Phase;
  remaining: number;
  round: number;
  rounds: number;
}) {
  const r = 120;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative flex h-[260px] w-[260px] items-center justify-center sm:h-[300px] sm:w-[300px]">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 280 280"
        style={{ transform: "rotate(-90deg)" }}
        aria-hidden
      >
        <circle
          cx="140"
          cy="140"
          r={r}
          fill="none"
          stroke="var(--line-strong)"
          strokeWidth="7"
        />
        <circle
          cx="140"
          cy="140"
          r={r}
          fill="none"
          stroke={PHASE_STROKE[phase]}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - Math.min(1, progress))}
          style={{
            transition: "stroke-dashoffset 300ms linear, stroke 300ms",
            filter:
              phase === "idle" || phase === "rest"
                ? undefined
                : `drop-shadow(0 0 10px color-mix(in oklab, ${PHASE_STROKE[phase]} 55%, transparent))`,
          }}
        />
      </svg>

      <div className="relative flex flex-col items-center">
        <div
          className="tabular-nums"
          style={{
            font: "800 56px/1 var(--font-archivo), system-ui, sans-serif",
            fontSize: "clamp(3rem, 14vw, 4rem)",
            letterSpacing: "0.02em",
            color: PHASE_COLOR[phase],
            filter: PHASE_GLOW[phase],
          }}
          aria-live="polite"
          aria-label={`${remaining} Sekunden verbleibend`}
        >
          {formatTime(remaining)}
        </div>
        <div className="mt-1.5" style={{ ...META_FONT, color: "var(--text-3)" }}>
          {phase === "idle" ? "Bereit" : `Runde ${Math.min(round, rounds)} / ${rounds}`}
        </div>
      </div>
    </div>
  );
}

// ─── Konfigurations-Bausteine ─────────────────────────────────────────────────

// Kachel-Beschriftung deutlich größer als META (Leon 2026-08-29: lesbarer)
const TILE_LABEL_FONT: React.CSSProperties = {
  font: "700 13px/1.2 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

/** Kachel mit Label — Inhalt ist entweder ein Stepper oder ein Rad-Feld. */
function ConfigTile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-2 rounded-field p-3"
      style={{ background: "var(--surface-raised)", border: "1px solid var(--line)" }}
    >
      <span style={{ ...TILE_LABEL_FONT, color: "var(--text-2)" }}>{label}</span>
      {children}
    </div>
  );
}

function Stepper({
  value,
  display,
  onStep,
  disabled,
  decLabel,
  incLabel,
}: {
  value: number;
  display: string;
  onStep: (dir: -1 | 1) => void;
  disabled?: boolean;
  decLabel: string;
  incLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => onStep(-1)}
        disabled={disabled}
        aria-label={decLabel}
        className="t-interactive inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-field disabled:opacity-40"
        style={{
          background: "var(--surface-card)",
          border: "1px solid var(--line)",
          color: "var(--text-2)",
        }}
      >
        <Icon name="minus" size={15} strokeWidth={2.2} />
      </button>
      <span
        className="tabular-nums"
        style={{ font: "700 20px/1 var(--font-archivo), system-ui, sans-serif" }}
        data-value={value}
      >
        {display}
      </span>
      <button
        type="button"
        onClick={() => onStep(1)}
        disabled={disabled}
        aria-label={incLabel}
        className="t-interactive inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-field disabled:opacity-40"
        style={{
          background: "var(--surface-card)",
          border: "1px solid var(--line)",
          color: "var(--text-2)",
        }}
      >
        <Icon name="plus" size={15} strokeWidth={2.2} />
      </button>
    </div>
  );
}

/** Zeit-Feld — das GANZE Feld öffnet das RestWheel (Muster ExerciseDetailSheet). */
function WheelField({
  value,
  onOpen,
  disabled,
  ariaLabel,
}: {
  value: number;
  onOpen: () => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      aria-label={ariaLabel}
      className="t-interactive flex min-h-hit items-center justify-between rounded-field px-3 disabled:opacity-40"
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--line)",
        color: "var(--text-body)",
      }}
    >
      <span
        className="tabular-nums"
        style={{ font: "700 20px/1 var(--font-archivo), system-ui, sans-serif" }}
      >
        {formatRest(value)}
      </span>
      <span aria-hidden style={{ color: "var(--text-3)", lineHeight: 0 }}>
        <Icon name="chevron-down" size={16} strokeWidth={2.2} />
      </span>
    </button>
  );
}

// ─── Seite ────────────────────────────────────────────────────────────────────

function TimerView() {
  const params = useSearchParams();
  const { user, profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { settings } = useTimerSettings();
  const isTrainer = profile?.role === "trainer" || profile?.role === "admin";

  const initial = useMemo<TimerConfig>(
    () => ({
      rounds: parsePositive(params.get("rounds"), DEFAULT_CONFIG.rounds),
      workSeconds: parsePositive(params.get("work"), DEFAULT_CONFIG.workSeconds),
      restSeconds: parsePositive(params.get("rest"), DEFAULT_CONFIG.restSeconds),
      prepSeconds: parsePositive(params.get("prep"), DEFAULT_CONFIG.prepSeconds),
    }),
    [params],
  );
  const label = params.get("label");

  const t = useWorkoutTimer(initial);
  const progress =
    t.phase === "idle" || t.totalForPhase === 0
      ? 0
      : 1 - t.remaining / t.totalForPhase;
  const isLocked = t.phase !== "idle";

  useWakeLock(settings.wakeLock && t.running);

  // RestWheel — welches Zeitfeld gerade offen ist
  const [wheelFor, setWheelFor] = useState<"work" | "rest" | null>(null);

  function updateConfig<K extends keyof TimerConfig>(key: K, value: number) {
    t.setConfig({ ...t.config, [key]: Math.max(0, Math.floor(value || 0)) });
  }

  // ── Audio-Unlock (Mobile braucht eine Nutzer-Geste) ──
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  useEffect(() => setAudioUnlocked(isAudioUnlocked()), []);

  async function handleStart() {
    if (!audioUnlocked) {
      const ok = await unlockAudio();
      setAudioUnlocked(ok);
    }
    t.start();
  }

  // ── Vollbild (mit Landscape-Lock, bestehendes Verhalten) ──
  const [isFullscreen, setIsFullscreen] = useState(false);

  const openFullscreen = useCallback(async () => {
    setIsFullscreen(true);
    try { await document.documentElement.requestFullscreen?.(); } catch { /* noop */ }
    try {
      await (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.("landscape");
    } catch { /* noop */ }
  }, []);

  const closeFullscreen = useCallback(async () => {
    setIsFullscreen(false);
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* noop */ }
    try { screen.orientation?.unlock?.(); } catch { /* noop */ }
  }, []);

  useEffect(() => {
    function onFsChange() {
      if (!document.fullscreenElement) setIsFullscreen(false);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // ── Session-Log nach der letzten Runde ──
  const [logState, setLogState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const loggedRef = useRef(false);

  useEffect(() => {
    if (t.phase !== "done") {
      if (t.phase === "idle" || t.phase === "prep") {
        loggedRef.current = false;
        setLogState("idle");
      }
      return;
    }
    if (!user || loggedRef.current) return;
    loggedRef.current = true;
    setLogState("saving");
    logWorkout(user.uid, t.config, label)
      .then(() => setLogState("saved"))
      .catch(() => {
        setLogState("error");
        loggedRef.current = false;
      });
  }, [t.phase, user, t.config, label]);

  // ── Browser-Titel zeigt die laufende Zeit ──
  useEffect(() => {
    if (typeof document === "undefined") return;
    const original = document.title;
    if (t.running || t.phase === "done") {
      document.title = `${formatTime(t.remaining)} · ${PHASE_LABEL[t.phase]} — Tidal Athletics`;
    }
    return () => { document.title = original; };
  }, [t.remaining, t.phase, t.running]);

  const phaseColor = PHASE_COLOR[t.phase];

  return (
    <main
      className={isTrainer ? "min-h-screen pb-12" : "min-h-screen pb-32"}
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      {/* ── Kopf — Muster der Disziplin-Seite (Ambient, Titel, Toggles) ── */}
      <section className="relative">
        <div
          className="absolute inset-0 overflow-hidden"
          aria-hidden
          style={{
            maskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
          }}
        >
          <div data-ambient style={{ background: "var(--ambient)" }} />
        </div>
        <div className="relative mx-auto flex w-full max-w-2xl items-start gap-3 px-4 pb-5 pt-4 lg:max-w-5xl lg:px-6 lg:pb-7 lg:pt-6">
          <div className="flex flex-1 flex-col gap-1">
            <Link
              href="/dashboard"
              className="t-interactive -ml-2 mb-1 inline-flex min-h-hit items-center gap-1.5 self-start rounded-field px-2"
              style={{ ...BTN_FONT, color: "var(--text-3)", textDecoration: "none" }}
            >
              <Icon name="arrow-left" size={14} strokeWidth={2.2} />
              Training
            </Link>
            <h1
              style={{
                font: "var(--type-display)",
                letterSpacing: "var(--ls-display)",
                textTransform: "uppercase",
              }}
            >
              Runden-Timer
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={openFullscreen}
              aria-label="Vollbild öffnen"
              className="t-glass t-interactive inline-flex h-11 w-11 items-center justify-center rounded-field"
              style={{ color: "var(--text-2)" }}
            >
              <Icon name="fullscreen" size={20} />
            </button>
            {!isTrainer && (
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={
                  theme === "dark"
                    ? "Helles Design aktivieren"
                    : "Dunkles Design aktivieren"
                }
                className="t-glass t-interactive inline-flex h-11 w-11 items-center justify-center rounded-field lg:hidden"
                style={{ color: "var(--text-2)" }}
              >
                <Icon name={theme === "dark" ? "sun" : "moon"} size={20} />
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-2 lg:px-6 lg:pt-3">

        {/* ── Timer-Kern ── */}
        <div className="flex flex-col items-center">
          <span className="t-label" style={{ color: phaseColor }}>
            {PHASE_LABEL[t.phase]}
          </span>
          <div className="mt-2">
            <TimerRing
              progress={progress}
              phase={t.phase}
              remaining={t.remaining}
              round={t.round}
              rounds={t.config.rounds}
            />
          </div>

          {/* Runden-Balken: erledigt = Akzent, aktiv = Phasenfarbe, offen = Linie */}
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {Array.from({ length: t.config.rounds }).map((_, i) => {
              const isDone = i < t.round - 1 || t.phase === "done";
              const isActive =
                i === t.round - 1 && t.phase !== "idle" && t.phase !== "done";
              return (
                <span
                  key={i}
                  className="h-1.5 w-6 rounded-full transition-all duration-300"
                  style={{
                    background: isDone
                      ? "var(--accent)"
                      : isActive
                        ? PHASE_STROKE[t.phase]
                        : "var(--line-strong)",
                    boxShadow: isDone
                      ? "0 0 8px color-mix(in oklab, var(--accent) 60%, transparent)"
                      : isActive
                        ? `0 0 8px color-mix(in oklab, ${PHASE_STROKE[t.phase]} 60%, transparent)`
                        : "none",
                  }}
                />
              );
            })}
          </div>

          {/* Log-Status nach der letzten Runde */}
          {t.phase === "done" && (
            <p className="mt-3" style={{ ...META_FONT, color: "var(--text-3)" }}>
              {!user && <span>Login, um Sessions zu speichern</span>}
              {user && logState === "saving" && <span>Speichere Session…</span>}
              {user && logState === "saved" && (
                <span
                  className="inline-flex items-center gap-1.5"
                  style={{ color: "var(--positive)" }}
                >
                  <Icon name="check" size={12} strokeWidth={2.6} />
                  Session gespeichert
                </span>
              )}
              {user && logState === "error" && (
                <span style={{ color: "var(--negative)" }}>Speichern fehlgeschlagen</span>
              )}
            </p>
          )}
        </div>

        {/* ── Steuerung (Runner-Muster) ── */}
        <div className="flex flex-col gap-3">
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
          <button
            type="button"
            onClick={t.reset}
            className="t-interactive inline-flex min-h-hit w-full items-center justify-center gap-2 rounded-field py-3"
            style={{
              ...BTN_FONT,
              background: "var(--surface-raised)",
              border: "1px solid var(--line)",
              color: "var(--text-2)",
            }}
          >
            <Icon name="refresh" size={14} strokeWidth={2.2} />
            Reset
          </button>
        </div>

        {/* ── Konfiguration ── */}
        <section className="flex flex-col gap-3">
          <span className="t-label" style={{ color: "var(--accent-text)" }}>
            Konfiguration
          </span>
          <div className="grid grid-cols-2 gap-3">
            <ConfigTile label="Runden">
              <Stepper
                value={t.config.rounds}
                display={`${t.config.rounds}×`}
                disabled={isLocked}
                decLabel="Eine Runde weniger"
                incLabel="Eine Runde mehr"
                onStep={(dir) =>
                  updateConfig(
                    "rounds",
                    Math.min(20, Math.max(1, t.config.rounds + dir)),
                  )
                }
              />
            </ConfigTile>
            <ConfigTile label="Vorlauf">
              <Stepper
                value={t.config.prepSeconds}
                display={`${t.config.prepSeconds}s`}
                disabled={isLocked}
                decLabel="Vorlauf verkürzen"
                incLabel="Vorlauf verlängern"
                onStep={(dir) =>
                  updateConfig(
                    "prepSeconds",
                    Math.min(60, Math.max(0, t.config.prepSeconds + dir * 5)),
                  )
                }
              />
            </ConfigTile>
            <ConfigTile label="Kampf">
              <WheelField
                value={t.config.workSeconds}
                disabled={isLocked}
                ariaLabel="Kampfzeit einstellen"
                onOpen={() => setWheelFor("work")}
              />
            </ConfigTile>
            <ConfigTile label="Pause">
              <WheelField
                value={t.config.restSeconds}
                disabled={isLocked}
                ariaLabel="Pausenzeit einstellen"
                onOpen={() => setWheelFor("rest")}
              />
            </ConfigTile>
          </div>
          {isLocked && (
            <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              Reset drücken, um die Konfiguration zu ändern.
            </p>
          )}

          {/* Presets als Chips — aktive Kombination leuchtet in Akzent */}
          <div className="mt-1 flex flex-wrap gap-2">
            {PRESETS.map((p) => {
              const active = sameConfig(t.config, p.config);
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    t.setConfig(p.config);
                    t.reset();
                  }}
                  disabled={isLocked}
                  aria-pressed={active}
                  className="t-interactive min-h-hit rounded-field px-4 disabled:opacity-40"
                  style={{
                    ...BTN_FONT,
                    background: active ? "var(--accent-subtle)" : "var(--surface-raised)",
                    border: "1px solid",
                    borderColor: active ? "var(--accent)" : "var(--line)",
                    color: active ? "var(--accent-text)" : "var(--text-2)",
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Brücke zu den strukturierten Plänen (Plan-Modell) ── */}
        <Link
          href="/workout/generator"
          className="t-card t-interactive flex items-center gap-3 p-4 sm:p-5"
          style={{ textDecoration: "none", color: "var(--text-body)" }}
        >
          <span
            aria-hidden
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-field"
            style={{
              background: "var(--accent-subtle)",
              color: "var(--accent-text)",
            }}
          >
            <Icon name="spark" size={22} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span
              style={{
                font: "var(--type-h2)",
                letterSpacing: "var(--ls-display)",
                textTransform: "uppercase",
              }}
            >
              Geführtes Workout
            </span>
            <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              Strukturierte Pläne mit Übungen, Ansagen und Auto-Durchlauf
            </span>
          </span>
          <span aria-hidden className="shrink-0" style={{ color: "var(--accent-text)", lineHeight: 0 }}>
            <Icon name="arrow-right" size={18} strokeWidth={2} />
          </span>
        </Link>
      </div>

      {/* ── RestWheel für Kampf-/Pausenzeit ── */}
      {wheelFor && (
        <RestWheel
          label={wheelFor === "work" ? "Kampfzeit" : "Pause zwischen den Runden"}
          value={wheelFor === "work" ? t.config.workSeconds : t.config.restSeconds}
          onChange={(seconds) =>
            wheelFor === "work"
              ? // 0:00 Kampfzeit gäbe eine hängende Phase — kleinste Stufe gilt
                updateConfig("workSeconds", Math.max(15, seconds))
              : updateConfig("restSeconds", seconds)
          }
          onClose={() => setWheelFor(null)}
        />
      )}

      {/* ── Vollbild-Overlay ── */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 px-6"
          style={{ background: "var(--surface-page)", touchAction: "none" }}
        >
          <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-6 pt-5">
            <span className="t-label" style={{ color: phaseColor }}>
              {PHASE_LABEL[t.phase]}
            </span>
            <span style={{ ...META_FONT, color: "var(--text-3)" }}>
              Runde {Math.min(t.round, t.config.rounds)} / {t.config.rounds}
            </span>
          </div>

          <div
            className="select-none tabular-nums"
            style={{
              font: "800 96px/1 var(--font-archivo), system-ui, sans-serif",
              fontSize: "clamp(6rem, 26vw, 18rem)",
              letterSpacing: "0.02em",
              color: phaseColor,
              filter: PHASE_GLOW[t.phase],
            }}
          >
            {formatTime(t.remaining)}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={t.running ? t.pause : handleStart}
              className="t-interactive inline-flex items-center justify-center gap-2 rounded-field px-8 py-4"
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
              className="t-interactive inline-flex min-h-hit items-center justify-center rounded-field px-5 disabled:opacity-40"
              style={{
                background: "var(--surface-raised)",
                border: "1px solid var(--line)",
                color: "var(--text-2)",
              }}
            >
              <Icon name="fast-forward" size={18} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={t.reset}
              aria-label="Zurücksetzen"
              className="t-interactive inline-flex min-h-hit items-center justify-center rounded-field px-5"
              style={{
                background: "var(--surface-raised)",
                border: "1px solid var(--line)",
                color: "var(--text-2)",
              }}
            >
              <Icon name="refresh" size={16} strokeWidth={2.2} />
            </button>
          </div>

          <button
            type="button"
            onClick={closeFullscreen}
            className="t-interactive absolute bottom-5 right-6 inline-flex min-h-hit items-center gap-1.5 rounded-field px-4"
            style={{
              ...BTN_FONT,
              background: "var(--surface-raised)",
              border: "1px solid var(--line)",
              color: "var(--text-3)",
            }}
          >
            <Icon name="x" size={13} strokeWidth={2.2} />
            Vollbild beenden
          </button>
        </div>
      )}

      {!isTrainer && <AthleteTabBar />}
    </main>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function TimerPage() {
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
          Lade Timer…
        </div>
      }
    >
      <TimerView />
    </Suspense>
  );
}
