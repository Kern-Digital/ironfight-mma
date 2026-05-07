"use client";

import PageHeader from "@/components/PageHeader";
import {
  DEFAULT_CONFIG,
  useWorkoutTimer,
  type Phase,
  type TimerConfig,
} from "@/lib/use-workout-timer";
import { useAuth } from "@/lib/auth-context";
import { logWorkout } from "@/lib/workouts";
import { unlockAudio, isAudioUnlocked } from "@/lib/audio";
import { useTimerSettings } from "@/lib/use-timer-settings";
import { useWakeLock } from "@/lib/use-wake-lock";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

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

const PHASE_LABEL: Record<Phase, string> = {
  idle: "Bereit",
  prep: "Vorbereitung",
  work: "Kampf",
  rest: "Pause",
  done: "Fertig!",
};

function phaseAccent(phase: Phase) {
  if (phase === "prep") return {
    color: "rgb(255,140,0)",
    border: "rgba(255,140,0,.4)",
    bg: "rgba(255,140,0,.06)",
    glow: "rgba(255,140,0,.4)",
    shadow: "rgba(255,140,0,.5)",
    bigShadow: "rgba(255,140,0,.6)",
  };
  if (phase === "work") return {
    color: "rgb(220,38,38)",
    border: "rgba(220,38,38,.4)",
    bg: "rgba(220,38,38,.06)",
    glow: "rgba(220,38,38,.4)",
    shadow: "rgba(220,38,38,.5)",
    bigShadow: "rgba(220,38,38,.6)",
  };
  if (phase === "rest") return {
    color: "rgb(59,130,246)",
    border: "rgba(59,130,246,.4)",
    bg: "rgba(59,130,246,.06)",
    glow: "rgba(59,130,246,.4)",
    shadow: "rgba(59,130,246,.5)",
    bigShadow: "rgba(59,130,246,.6)",
  };
  return {
    color: "var(--fg-3)",
    border: "rgba(136,147,161,.2)",
    bg: "rgba(136,147,161,.03)",
    glow: "transparent",
    shadow: "transparent",
    bigShadow: "transparent",
  };
}

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

// SVG circular progress ring
function TimerRing({
  progress,
  phase,
  remaining,
}: {
  progress: number;
  phase: Phase;
  remaining: number;
}) {
  const r = 120;
  const circ = 2 * Math.PI * r;
  const accent = phaseAccent(phase);
  const pulseClass =
    phase === "prep" ? "phase-prep-pulse" :
    phase === "work" ? "phase-work-pulse" :
    phase === "rest" ? "phase-rest-pulse" : "";

  return (
    <div className={`relative flex h-[280px] w-[280px] items-center justify-center ${pulseClass}`}>
      <svg
        className="absolute inset-0"
        viewBox="0 0 280 280"
        style={{ transform: "rotate(-90deg)" }}
      >
        {/* Track */}
        <circle
          cx="140"
          cy="140"
          r={r}
          fill="none"
          stroke="var(--ink-4)"
          strokeWidth="8"
        />
        {/* Progress */}
        <circle
          cx="140"
          cy="140"
          r={r}
          fill="none"
          stroke={accent.color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - Math.min(1, progress))}
          style={{ transition: "stroke-dashoffset .3s linear, stroke .3s" }}
        />
      </svg>

      {/* Center content */}
      <div className="relative flex flex-col items-center">
        <div
          className="font-display-ta font-black leading-none"
          style={{
            fontSize: "78px",
            letterSpacing: "0.02em",
            color: "var(--fg)",
            textShadow: pulseClass ? `0 0 30px ${accent.shadow}` : "none",
          }}
        >
          {formatTime(remaining)}
        </div>
        <div
          className="font-mono-ta mt-1.5 text-[10px] uppercase"
          style={{ letterSpacing: "0.25em", color: "var(--fg-3)" }}
        >
          {PHASE_LABEL.work === PHASE_LABEL[phase] ? "Kampf" : "verbleibend"}
        </div>
      </div>
    </div>
  );
}

function TimerView() {
  const params = useSearchParams();
  const { user } = useAuth();
  const { settings, setSoundOn, setVibrate } = useTimerSettings();

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

  useWakeLock(t.running);

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenRef = useRef<HTMLDivElement>(null);

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
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, []);

  const [audioUnlocked, setAudioUnlocked] = useState(false);
  useEffect(() => { setAudioUnlocked(isAudioUnlocked()); }, []);

  const [vibrateSupported, setVibrateSupported] = useState(false);
  useEffect(() => {
    setVibrateSupported(typeof navigator !== "undefined" && typeof navigator.vibrate === "function");
  }, []);

  const [logState, setLogState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const loggedRef = useRef<symbol | null>(null);

  useEffect(() => {
    if (t.phase !== "done") {
      if (t.phase === "idle" || t.phase === "prep") {
        loggedRef.current = null;
        setLogState("idle");
      }
      return;
    }
    if (!user) { setLogState("idle"); return; }
    const sessionToken = Symbol("session");
    if (loggedRef.current) return;
    loggedRef.current = sessionToken;
    setLogState("saving");
    logWorkout(user.uid, t.config, label)
      .then(() => setLogState("saved"))
      .catch(() => { setLogState("error"); loggedRef.current = null; });
  }, [t.phase, user, t.config, label]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const original = document.title;
    if (t.running || t.phase === "done") {
      document.title = `${formatTime(t.remaining)} · ${PHASE_LABEL[t.phase]} — Tidal Athletics`;
    }
    return () => { document.title = original; };
  }, [t.remaining, t.phase, t.running]);

  function updateConfig<K extends keyof TimerConfig>(key: K, value: number) {
    t.setConfig({ ...t.config, [key]: Math.max(1, Math.floor(value || 0)) });
  }

  async function handleStart() {
    if (!audioUnlocked) {
      const ok = await unlockAudio();
      setAudioUnlocked(ok);
    }
    t.start();
  }

  const isLocked = t.phase !== "idle";
  const accent = phaseAccent(t.phase);

  // Icon helpers
  const IconPlay = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <path d="M8 5.14v14l11-7-11-7z" />
    </svg>
  );
  const IconPause = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
  const IconSkip = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
    </svg>
  );
  const IconReset = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4.95" />
    </svg>
  );

  return (
    <>
      {/* ── Vollbild-Overlay ── */}
      {isFullscreen && (
        <div
          ref={fullscreenRef}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          style={{ background: "var(--ink-0)", touchAction: "none" }}
        >
          <div className="absolute left-0 right-0 top-6 flex items-center justify-between px-8">
            <span
              className="font-mono-ta text-sm uppercase"
              style={{
                letterSpacing: "0.25em",
                color: accent.color,
              }}
            >
              {PHASE_LABEL[t.phase]}
            </span>
            <span
              className="font-mono-ta text-sm uppercase"
              style={{ letterSpacing: "0.2em", color: "var(--fg-3)" }}
            >
              Runde {Math.min(t.round, t.config.rounds)} / {t.config.rounds}
            </span>
          </div>
          <div
            className="font-display-ta font-black leading-none select-none"
            style={{
              fontSize: "clamp(6rem, 28vw, 22rem)",
              letterSpacing: "0.02em",
              color: "var(--fg)",
              textShadow: `0 0 40px ${accent.bigShadow}`,
            }}
          >
            {formatTime(t.remaining)}
          </div>
          <div className="mt-8 flex gap-4">
            {!t.running ? (
              <button onClick={handleStart} className="btn-primary px-10 py-5 text-xl">
                {t.phase === "idle" || t.phase === "done" ? "Start" : "Weiter"}
              </button>
            ) : (
              <button onClick={t.pause} className="btn-primary px-10 py-5 text-xl">
                Pause
              </button>
            )}
            <button onClick={t.skip} className="btn-secondary px-8 py-5 text-xl" disabled={t.phase === "idle" || t.phase === "done"}>Skip</button>
            <button onClick={t.reset} className="btn-secondary px-8 py-5 text-xl">Reset</button>
          </div>
          <button
            onClick={closeFullscreen}
            className="absolute bottom-6 right-8 rounded-xl px-4 py-2 text-xs font-bold uppercase transition-colors"
            style={{
              border: "1px solid var(--ink-5)",
              background: "var(--ink-3)",
              color: "var(--fg-3)",
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.15em",
            }}
          >
            ✕ Vollbild beenden
          </button>
        </div>
      )}

      <PageHeader
        eyebrow={label ? `Workout · ${label}` : "Workout"}
        title="Runden-Timer"
        description="Konfiguriere Runden, Pausen und Vorbereitung — dann auf die Glocke."
      />

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">

        {/* Audio unlock hint */}
        {!audioUnlocked && t.phase === "idle" && (
          <div
            className="mb-6 rounded-xl px-4 py-3 text-sm"
            style={{
              border: "1px solid rgba(0,212,230,.3)",
              background: "rgba(0,212,230,.06)",
              color: "var(--fg-2)",
            }}
          >
            <div className="font-bold" style={{ color: "var(--ta-cyan)" }}>📱 Sound-Hinweis</div>
            <p className="mt-1 text-xs" style={{ color: "var(--fg-3)" }}>
              Auf Handys muss der Sound einmal pro Sitzung freigegeben werden.
              Tippe auf <strong>Start</strong> oder den Button unten.
            </p>
            <button
              onClick={async () => { const ok = await unlockAudio(); setAudioUnlocked(ok); }}
              className="mt-3 rounded-xl px-4 py-2 text-xs font-bold uppercase transition-all"
              style={{
                border: "1px solid rgba(0,212,230,.5)",
                background: "rgba(0,212,230,.1)",
                color: "var(--ta-cyan)",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.15em",
              }}
            >
              🔔 Sound aktivieren
            </button>
          </div>
        )}

        {/* Phase pill */}
        <div className="mb-4 flex justify-center">
          <span
            className="font-mono-ta text-[11px] uppercase px-4 py-1.5 rounded-full"
            style={{
              letterSpacing: "0.25em",
              color: accent.color,
              border: `1px solid ${accent.border}`,
              background: accent.bg,
              transition: "all .3s",
            }}
          >
            {PHASE_LABEL[t.phase]}
          </span>
        </div>

        {/* Main timer ring */}
        <div className="flex justify-center">
          <TimerRing progress={progress} phase={t.phase} remaining={t.remaining} />
        </div>

        {/* Round dots */}
        <div className="mt-4 flex justify-center gap-1.5">
          {Array.from({ length: t.config.rounds }).map((_, i) => (
            <div
              key={i}
              className="h-1.5 w-6 rounded-sm transition-all duration-300"
              style={{
                background:
                  i < t.round - 1
                    ? "var(--ta-cyan)"
                    : i === t.round - 1 && t.phase !== "idle" && t.phase !== "done"
                    ? accent.color
                    : "var(--ink-5)",
                boxShadow:
                  i < t.round - 1
                    ? "0 0 8px var(--ta-cyan)"
                    : i === t.round - 1 && t.phase !== "idle" && t.phase !== "done"
                    ? `0 0 10px ${accent.color}`
                    : "none",
              }}
            />
          ))}
        </div>

        {/* Round counter */}
        <div
          className="mt-3 text-center font-mono-ta text-xs uppercase"
          style={{ letterSpacing: "0.2em", color: "var(--fg-3)" }}
        >
          Runde {Math.min(t.round, t.config.rounds)} von {t.config.rounds}
        </div>

        {/* Controls: skip | play/pause | reset */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <button
            onClick={t.skip}
            disabled={t.phase === "idle" || t.phase === "done"}
            className="flex h-14 items-center justify-center rounded-xl transition-all"
            style={{
              background: "var(--ink-3)",
              border: "1px solid var(--ink-5)",
              color: "var(--fg)",
            }}
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--ta-cyan)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--ta-cyan)";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--ink-5)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--fg)";
            }}
          >
            <IconSkip />
          </button>

          {/* Primary play/pause */}
          <button
            onClick={t.running ? t.pause : handleStart}
            className="col-span-1 flex h-14 items-center justify-center rounded-xl transition-all"
            style={{
              background: "var(--ta-cyan)",
              color: "#001417",
              boxShadow:
                "0 0 0 1px rgba(0,212,230,.6), 0 0 24px rgba(0,212,230,.4)",
            }}
          >
            {t.running ? <IconPause /> : <IconPlay />}
          </button>

          <button
            onClick={t.reset}
            className="flex h-14 items-center justify-center rounded-xl transition-all"
            style={{
              background: "var(--ink-3)",
              border: "1px solid var(--ink-5)",
              color: "var(--fg)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--ta-cyan)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--ta-cyan)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--ink-5)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--fg)";
            }}
          >
            <IconReset />
          </button>
        </div>

        {/* Presets */}
        <div className="mt-8">
          <div
            className="font-mono-ta mb-3 text-[10px] uppercase"
            style={{ letterSpacing: "0.2em", color: "var(--fg-3)" }}
          >
            Presets
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => { t.setConfig(p.config); t.reset(); }}
                disabled={isLocked}
                className="font-mono-ta rounded-xl px-3 py-2 text-[11px] uppercase transition-all disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  letterSpacing: "0.12em",
                  background: "var(--ink-3)",
                  border: "1px solid var(--ink-5)",
                  color: "var(--fg-2)",
                }}
                onMouseEnter={(e) => {
                  if (!isLocked) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--ta-cyan)";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--ta-cyan)";
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--ink-5)";
                  (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-2)";
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Settings row */}
        <div className={`mt-6 grid ${vibrateSupported ? "grid-cols-3" : "grid-cols-2"} gap-2`}>
          <SettingToggle label="Sound" value={settings.soundOn} onChange={setSoundOn} icon="🔔" />
          {vibrateSupported && (
            <SettingToggle label="Vibration" value={settings.vibrate} onChange={setVibrate} icon="📳" />
          )}
          <button
            onClick={openFullscreen}
            className="flex flex-col items-center gap-1 rounded-xl px-3 py-3 transition-all"
            style={{
              border: "1px solid var(--ink-5)",
              background: "var(--ink-3)",
              color: "var(--fg-3)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--ta-cyan)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--ta-cyan)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--ink-5)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-3)";
            }}
          >
            <span className="text-base">⛶</span>
            <span className="font-mono-ta text-[10px] font-bold uppercase" style={{ letterSpacing: "0.15em" }}>Vollbild</span>
          </button>
        </div>

        {/* Config */}
        <div
          className="mt-8 rounded-2xl p-5"
          style={{
            background: "linear-gradient(180deg, var(--ink-3), var(--ink-2))",
            border: "1px solid var(--ink-4)",
          }}
        >
          <div
            className="font-mono-ta mb-4 text-[10px] uppercase"
            style={{ letterSpacing: "0.25em", color: "var(--ta-cyan)" }}
          >
            Konfiguration
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ConfigField label="Runden" value={t.config.rounds} onChange={(v) => updateConfig("rounds", v)} disabled={isLocked} suffix="×" />
            <ConfigField label="Kampf (Sek.)" value={t.config.workSeconds} onChange={(v) => updateConfig("workSeconds", v)} disabled={isLocked} suffix="s" />
            <ConfigField label="Pause (Sek.)" value={t.config.restSeconds} onChange={(v) => updateConfig("restSeconds", v)} disabled={isLocked} suffix="s" />
            <ConfigField label="Vorlauf (Sek.)" value={t.config.prepSeconds} onChange={(v) => updateConfig("prepSeconds", v)} disabled={isLocked} suffix="s" />
          </div>
          {isLocked && (
            <p className="mt-4 text-xs" style={{ color: "var(--fg-4)" }}>
              Reset drücken, um die Konfiguration zu ändern.
            </p>
          )}
        </div>

        {/* Session log state */}
        {t.phase === "done" && (
          <div className="mt-6 text-center font-mono-ta text-xs uppercase" style={{ letterSpacing: "0.15em" }}>
            {!user && <span style={{ color: "var(--fg-4)" }}>Login, um Sessions zu speichern</span>}
            {user && logState === "saving" && <span style={{ color: "var(--fg-3)" }}>Speichere Session…</span>}
            {user && logState === "saved" && <span style={{ color: "var(--ta-cyan)" }}>Session gespeichert ✓</span>}
            {user && logState === "error" && <span style={{ color: "var(--ta-pink)" }}>Speichern fehlgeschlagen</span>}
          </div>
        )}
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
      className="flex flex-col items-center gap-1 rounded-xl px-3 py-3 transition-all"
      style={{
        border: value
          ? "1px solid rgba(0,212,230,.5)"
          : "1px solid var(--ink-5)",
        background: value ? "rgba(0,212,230,.08)" : "var(--ink-3)",
        color: value ? "var(--ta-cyan)" : "var(--fg-4)",
      }}
    >
      <span className="text-base">{icon}</span>
      <span className="font-mono-ta text-[10px] font-bold uppercase" style={{ letterSpacing: "0.15em" }}>
        {label} {value ? "an" : "aus"}
      </span>
    </button>
  );
}

function ConfigField({
  label,
  value,
  onChange,
  disabled,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  suffix?: string;
}) {
  return (
    <div>
      <label
        className="font-mono-ta mb-1.5 block text-[10px] uppercase"
        style={{ letterSpacing: "0.2em", color: "var(--fg-3)" }}
      >
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="w-full rounded-xl px-3 py-2 text-sm font-mono-ta transition-all disabled:opacity-50"
          style={{
            background: "var(--ink-2)",
            border: "1px solid var(--ink-5)",
            color: "var(--fg)",
            outline: "none",
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLInputElement).style.borderColor = "var(--ta-cyan)";
            (e.currentTarget as HTMLInputElement).style.boxShadow = "0 0 0 3px rgba(0,212,230,.18)";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLInputElement).style.borderColor = "var(--ink-5)";
            (e.currentTarget as HTMLInputElement).style.boxShadow = "none";
          }}
        />
        {suffix && (
          <span className="font-mono-ta text-xs flex-shrink-0" style={{ color: "var(--fg-4)" }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

export default function TimerPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-4 py-32 text-center font-mono-ta text-sm uppercase tracking-widest" style={{ color: "var(--fg-4)" }}>
          Lade Timer…
        </div>
      }
    >
      <TimerView />
    </Suspense>
  );
}
