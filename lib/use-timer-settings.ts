"use client";

import { useEffect, useState } from "react";
import { setAudioMuted, setVibrationEnabled } from "./audio";

/**
 * Persistente Timer-Settings (Sound, Vibration, Wake-Lock).
 * Wird im localStorage gespeichert, damit es auf Mobile zwischen
 * Sessions erhalten bleibt.
 */
export interface TimerSettings {
  soundOn: boolean;
  vibrate: boolean;
  wakeLock: boolean;
}

const STORAGE_KEY = "ironfight.timer.settings.v1";

const DEFAULT: TimerSettings = {
  soundOn: true,
  vibrate: true,
  wakeLock: true,
};

function readStorage(): TimerSettings {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<TimerSettings>;
    return { ...DEFAULT, ...parsed };
  } catch {
    return DEFAULT;
  }
}

export function useTimerSettings() {
  const [settings, setSettings] = useState<TimerSettings>(DEFAULT);

  useEffect(() => {
    const next = readStorage();
    setSettings(next);
    setAudioMuted(!next.soundOn);
    setVibrationEnabled(next.vibrate);
  }, []);

  function update(patch: Partial<TimerSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
      setAudioMuted(!next.soundOn);
      setVibrationEnabled(next.vibrate);
      return next;
    });
  }

  return {
    settings,
    setSoundOn: (v: boolean) => update({ soundOn: v }),
    setVibrate: (v: boolean) => update({ vibrate: v }),
    setWakeLock: (v: boolean) => update({ wakeLock: v }),
  };
}
