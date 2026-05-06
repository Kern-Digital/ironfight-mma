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
import { unlockAudio, isAudioUnlocked, initAudio } from "@/lib/audio";
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

const PHASE_COLOR: Record<Phase, string> = {
  idle: "text-foreground",
  prep: "text-yellow-400",
  work: "text-blood",
  rest: "text-blue-400",
  done: "text-green-400",
};

const PHASE_BG: Record<Phase, string> = {
  idle: "bg-carbon-600",
  prep: "bg-yellow-500",
  work: "bg-blood",
  rest: "bg-blue-500",
  done: "bg-green-500",
};

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

  // Wake-Lock immer aktiv wenn Timer läuft
  useWakeLock(t.running);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenRef = useRef<HTMLDivElement>(null);

  const openFullscreen = useCallback(async () => {
    setIsFullscreen(true);
    // Versuche native Fullscreen API (funktioniert auf Android/Desktop, nicht auf iOS)
    try {
      await document.documentElement.requestFullscreen?.();
    } catch { /* nicht unterstützt */ }
    // Versuche Querformat zu sperren
    try {
      await (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.("landscape");
    } catch { /* Orientation Lock nicht unterstützt */ }
  }, []);

  const closeFullscreen = useCallback(async () => {
    setIsFullscreen(false);
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch { /* ignorieren */ }
    try {
      screen.orientation?.unlock?.();
    } catch { /* ignorieren */ }
  }, []);

  // Synchronisiert mit nativem Fullscreen (z. B. Escape-Taste)
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

  // Audio vorab initialisieren (Buffer laden ohne User-Geste nötig)
  useEffect(() => {
    initAudio();
  }, []);

  // Audio-Unlock-Status (nur initial gesetzt — wird beim Start aktualisiert)
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  useEffect(() => {
    setAudioUnlocked(isAudioUnlocked());
  }, []);

  const [logState, setLogState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const loggedRef = useRef<symbol | null>(null);

  useEffect(() => {
    if (t.phase !== "done") {
      if (t.phase === "idle" || t.phase === "prep") {
        loggedRef.current = null;
        setLogState("idle");
      }
      return;
    }
    if (!user) {
      setLogState("idle");
      return;
    }
    const sessionToken = Symbol("session");
    if (loggedRef.current) return;
    loggedRef.current = sessionToken;
    setLogState("saving");
    logWorkout(user.uid, t.config, label)
      .then(() => setLogState("saved"))
      .catch(() => {
        setLogState("error");
        loggedRef.current = null;
      });
  }, [t.phase, user, t.config, label]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const original = document.title;
    if (t.running || t.phase === "done") {
      document.title = `${formatTime(t.remaining)} · ${PHASE_LABEL[t.phase]} — Tidal Athletics`;
    }
    return () => {
      document.title = original;
    };
  }, [t.remaining, t.phase, t.running]);

  function updateConfig<K extends keyof TimerConfig>(key: K, value: number) {
    t.setConfig({ ...t.config, [key]: Math.max(1, Math.floor(value || 0)) });
  }

  /** Audio-Unlock + Timer-Start in einem Click — kritisch für iOS! */
  async function handleStart() {
    if (!audioUnlocked) {
      const ok = await unlockAudio();
      setAudioUnlocked(ok);
    }
    t.start();
  }

  const isLocked = t.phase !== "idle";

  return (
    <>
      {/* ── Vollbild-Overlay ── */}
      {isFullscreen && (
        <div
          ref={fullscreenRef}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050505]"
          style={{ touchAction: "none" }}
        >
          {/* Oben: Phase + Runde */}
          <div className="absolute top-6 left-0 right-0 flex items-center justify-between px-8">
            <div className={`text-sm font-bold uppercase tracking-widest ${PHASE_COLOR[t.phase]}`}>
              {PHASE_LABEL[t.phase]}
            </div>
            <div className="text-sm uppercase tracking-widest text-foreground/50">
              Runde {Math.min(t.round, t.config.rounds)} / {t.config.rounds}
            </div>
          </div>

          {/* Große Timer-Anzeige — für Querformat optimiert */}
          <div
            className={`font-display font-black leading-none ${PHASE_COLOR[t.phase]} select-none`}
            style={{
              fontVariantNumeric: "tabular-nums",
              fontSize: "clamp(6rem, 28vw, 22rem)",
            }}
          >
            {formatTime(t.remaining)}
          </div>

          {/* Fortschrittsbalken */}
          <div className="mt-6 w-full max-w-lg px-8">
            <div className="h-2 overflow-hidden rounded-full bg-carbon-700">
              <div
                className={`h-full transition-all duration-200 ${PHASE_BG[t.phase]}`}
                style={{ width: `${Math.min(100, progress * 100)}%` }}
              />
            </div>
          </div>

          {/* Steuerung */}
          <div className="mt-8 flex gap-4">
            {!t.running ? (
              <button
                onClick={handleStart}
                className="btn-primary px-10 py-5 text-xl"
              >
                {t.phase === "idle" || t.phase === "done" ? "Start" : "Weiter"}
              </button>
            ) : (
              <button
                onClick={t.pause}
                className="btn-primary px-10 py-5 text-xl"
              >
                Pause
              </button>
            )}
            <button
              onClick={t.skip}
              className="btn-secondary px-8 py-5 text-xl"
              disabled={t.phase === "idle" || t.phase === "done"}
            >
              Skip
            </button>
            <button onClick={t.reset} className="btn-secondary px-8 py-5 text-xl">
              Reset
            </button>
          </div>

          {/* Vollbild beenden */}
          <button
            onClick={closeFullscreen}
            className="absolute bottom-6 right-8 rounded-lg border border-carbon-400 bg-carbon-800/80 px-4 py-2 text-xs font-bold uppercase tracking-widest text-foreground/60 hover:text-foreground"
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

      <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12 sm:px-6">
        {/* Sound-Unlock-Hinweis für Mobile, vor erstem Start */}
        {!audioUnlocked && t.phase === "idle" && (
          <div className="mb-4 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
            <div className="font-bold">📱 Sound-Hinweis</div>
            <p className="mt-1 text-xs text-yellow-100/80">
              Auf Handys muss der Sound einmal pro Sitzung freigegeben werden.
              Tippe auf <strong>Start</strong> oder den Button unten —
              danach hörst du Glocke, Ticks und Sounds.
            </p>
            <button
              onClick={async () => {
                const ok = await unlockAudio();
                setAudioUnlocked(ok);
              }}
              className="mt-3 rounded-lg border border-yellow-500 bg-yellow-500/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-yellow-100 hover:bg-yellow-500/30"
            >
              🔔 Sound jetzt aktivieren
            </button>
          </div>
        )}

        <div className="card">
          <div className="flex items-center justify-between">
            <div className={`text-xs font-bold uppercase tracking-widest ${PHASE_COLOR[t.phase]}`}>
              {PHASE_LABEL[t.phase]}
            </div>
            <div className="text-xs uppercase tracking-widest text-foreground/60">
              Runde {Math.min(t.round, t.config.rounds)} / {t.config.rounds}
            </div>
          </div>

          <div className="my-6 sm:my-8 text-center">
            <div
              className={`font-display font-black leading-none ${PHASE_COLOR[t.phase]}`}
              style={{
                fontVariantNumeric: "tabular-nums",
                fontSize: "clamp(5rem, 22vw, 10rem)",
              }}
            >
              {formatTime(t.remaining)}
            </div>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-carbon-600">
            <div
              className={`h-full transition-all duration-200 ${PHASE_BG[t.phase]}`}
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </div>

          {/* Große Touch-Buttons — auch mit verschwitzten Händen treffbar */}
          <div className="mt-6 sm:mt-8 grid grid-cols-3 gap-2 sm:gap-3">
            {!t.running ? (
              <button
                onClick={handleStart}
                className="btn-primary col-span-3 sm:col-span-1 py-4 text-base"
              >
                {t.phase === "idle" || t.phase === "done" ? "Start" : "Weiter"}
              </button>
            ) : (
              <button
                onClick={t.pause}
                className="btn-primary col-span-3 sm:col-span-1 py-4 text-base"
              >
                Pause
              </button>
            )}
            <button
              onClick={t.skip}
              className="btn-secondary py-4 text-base"
              disabled={t.phase === "idle" || t.phase === "done"}
            >
              Skip
            </button>
            <button onClick={t.reset} className="btn-secondary py-4 text-base">
              Reset
            </button>
          </div>

          {t.phase === "done" && (
            <div className="mt-6 text-center text-xs uppercase tracking-widest">
              {!user && (
                <span className="text-foreground/50">
                  Login, um Sessions zu speichern
                </span>
              )}
              {user && logState === "saving" && (
                <span className="text-foreground/60">Speichere Session…</span>
              )}
              {user && logState === "saved" && (
                <span className="text-green-400">Session gespeichert ✓</span>
              )}
              {user && logState === "error" && (
                <span className="text-blood">
                  Speichern fehlgeschlagen — Firestore aktiviert?
                </span>
              )}
            </div>
          )}
        </div>

        {/* Settings: Sound, Vibration, Vollbild */}
        <div className="mt-6 grid grid-cols-3 gap-2 text-center text-xs uppercase tracking-widest">
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
          <button
            onClick={openFullscreen}
            className="flex flex-col items-center gap-1 rounded-lg border border-carbon-500 bg-carbon-700/40 px-3 py-3 transition-all hover:border-blood/60 hover:text-blood"
          >
            <span className="text-base">⛶</span>
            <span className="text-[10px] font-bold tracking-widest">Vollbild</span>
          </button>
        </div>

        <div className="mt-8">
          <div className="mb-3 text-xs font-bold uppercase tracking-widest text-foreground/60">
            Presets
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => {
                  t.setConfig(p.config);
                  t.reset();
                }}
                disabled={isLocked}
                className="rounded-lg border border-carbon-400 bg-carbon-700/60 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors hover:border-blood hover:text-blood disabled:cursor-not-allowed disabled:opacity-40"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 card">
          <div className="mb-4 text-xs font-bold uppercase tracking-widest text-blood">
            Konfiguration
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ConfigField
              label="Runden"
              value={t.config.rounds}
              onChange={(v) => updateConfig("rounds", v)}
              disabled={isLocked}
              suffix="×"
            />
            <ConfigField
              label="Kampf (Sek.)"
              value={t.config.workSeconds}
              onChange={(v) => updateConfig("workSeconds", v)}
              disabled={isLocked}
              suffix="s"
            />
            <ConfigField
              label="Pause (Sek.)"
              value={t.config.restSeconds}
              onChange={(v) => updateConfig("restSeconds", v)}
              disabled={isLocked}
              suffix="s"
            />
            <ConfigField
              label="Vorlauf (Sek.)"
              value={t.config.prepSeconds}
              onChange={(v) => updateConfig("prepSeconds", v)}
              disabled={isLocked}
              suffix="s"
            />
          </div>
          {isLocked && (
            <p className="mt-4 text-xs text-foreground/60">
              Reset drücken, um die Konfiguration zu ändern.
            </p>
          )}
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
      className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-3 transition-all ${
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
      <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-foreground/70">
        {label}
      </label>
      <div className="flex">
        <input
          type="number"
          min={1}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="w-full rounded-lg border border-carbon-400 bg-carbon-800 px-3 py-2 text-sm focus:border-blood focus:outline-none disabled:opacity-50"
        />
        {suffix && (
          <span className="ml-2 self-center text-xs text-foreground/60">
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
        <div className="mx-auto max-w-4xl px-4 py-32 text-center text-sm uppercase tracking-widest text-foreground/60 sm:px-6">
          Lade Timer…
        </div>
      }
    >
      <TimerView />
    </Suspense>
  );
}
