"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  playRoundStart,
  playRoundEnd,
  playSessionEnd,
  playCountdownTick,
  vibrateTick,
  vibrateRoundEnd,
  vibrateSessionEnd,
} from "./audio";

export type Phase = "idle" | "prep" | "work" | "rest" | "done";

export interface TimerConfig {
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  prepSeconds: number;
}

export const DEFAULT_CONFIG: TimerConfig = {
  rounds: 5,
  workSeconds: 180,
  restSeconds: 60,
  prepSeconds: 10,
};

interface UseWorkoutTimer {
  phase: Phase;
  round: number;
  remaining: number;
  running: boolean;
  totalForPhase: number;
  config: TimerConfig;
  setConfig: (c: TimerConfig) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
}

export function useWorkoutTimer(initial: TimerConfig = DEFAULT_CONFIG): UseWorkoutTimer {
  const [config, setConfig] = useState<TimerConfig>(initial);
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState(1);
  const [remaining, setRemaining] = useState(initial.workSeconds);
  const [running, setRunning] = useState(false);

  const endAtRef = useRef<number | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const roundRef = useRef(1);
  // Verhindert doppelte Countdown-Ticks: speichert die zuletzt abgespielte Sekunde
  const lastTickSecRef = useRef<number>(-1);
  const restSoundTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { roundRef.current = round; }, [round]);

  const totalForPhase =
    phase === "prep"
      ? config.prepSeconds
      : phase === "rest"
        ? config.restSeconds
        : config.workSeconds;

  const enterPhase = useCallback(
    (next: Phase, nextRound = roundRef.current) => {
      if (restSoundTimeoutRef.current !== null) {
        clearTimeout(restSoundTimeoutRef.current);
        restSoundTimeoutRef.current = null;
      }

      const seconds =
        next === "prep"
          ? config.prepSeconds
          : next === "work"
            ? config.workSeconds
            : next === "rest"
              ? config.restSeconds
              : 0;

      setPhase(next);
      setRound(nextRound);
      setRemaining(seconds);
      endAtRef.current = seconds > 0 ? Date.now() + seconds * 1000 : null;
      lastTickSecRef.current = -1; // Reset Countdown-Tracker

      if (next === "work") {
        playRoundStart();
      } else if (next === "rest") {
        playRoundEnd();
        vibrateRoundEnd();
      } else if (next === "done") {
        setRunning(false);
        endAtRef.current = null;
        playSessionEnd();
        vibrateSessionEnd();
      }
    },
    [config.prepSeconds, config.workSeconds, config.restSeconds],
  );

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (endAtRef.current === null) return;
      const now = Date.now();
      const left = Math.max(0, Math.ceil((endAtRef.current - now) / 1000));
      setRemaining(left);

      const cur = phaseRef.current;

      // ─── Countdown: genau 4 Sek. vor Kampf-Beginn — einmalig ───
      if ((cur === "rest" || cur === "prep") && left === 4) {
        if (lastTickSecRef.current !== 4) {
          lastTickSecRef.current = 4;
          playCountdownTick(1.0);
          vibrateTick();
        }
      }

      if (left === 0) {
        const r = roundRef.current;
        if (cur === "prep") {
          enterPhase("work", 1);
        } else if (cur === "work") {
          if (r >= config.rounds) enterPhase("done");
          else enterPhase("rest", r);
        } else if (cur === "rest") {
          enterPhase("work", r + 1);
        }
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [running, config.rounds, enterPhase]);

  const start = useCallback(() => {
    if (phase === "done" || phase === "idle") {
      enterPhase("prep", 1);
    } else {
      // Resume: endAt aus aktuellem remaining berechnen
      endAtRef.current = Date.now() + remaining * 1000;
    }
    setRunning(true);
  }, [phase, remaining, enterPhase]);

  const pause = useCallback(() => {
    setRunning(false);
    endAtRef.current = null;
  }, []);

  const reset = useCallback(() => {
    if (restSoundTimeoutRef.current !== null) {
      clearTimeout(restSoundTimeoutRef.current);
      restSoundTimeoutRef.current = null;
    }
    setRunning(false);
    setPhase("idle");
    setRound(1);
    setRemaining(config.workSeconds);
    endAtRef.current = null;
    lastTickSecRef.current = -1;
  }, [config.workSeconds]);

  const skip = useCallback(() => {
    if (phase === "idle" || phase === "done") return;
    if (phase === "prep") enterPhase("work", 1);
    else if (phase === "work") {
      if (round >= config.rounds) enterPhase("done");
      else enterPhase("rest", round);
    } else if (phase === "rest") enterPhase("work", round + 1);
  }, [phase, round, config.rounds, enterPhase]);

  useEffect(() => {
    if (phase === "idle") setRemaining(config.workSeconds);
  }, [config.workSeconds, phase]);

  return {
    phase, round, remaining, running, totalForPhase,
    config, setConfig, start, pause, reset, skip,
  };
}
