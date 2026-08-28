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
  // Einmalige Countdown-Flag pro Phase — verhindert mehrfaches Abspielen
  const countdownFiredRef = useRef(false);

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
      countdownFiredRef.current = false; // Countdown-Guard für neue Phase zurücksetzen

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

      // Countdown: genau 4 Sek. vor Kampf-Beginn — einmalig pro Phase
      if ((cur === "rest" || cur === "prep") && left === 4 && !countdownFiredRef.current) {
        countdownFiredRef.current = true;
        playCountdownTick(1.0);
        vibrateTick();
      }

      if (left === 0) {
        const r = roundRef.current;
        if (cur === "prep") {
          enterPhase("work", 1);
        } else if (cur === "work") {
          if (r >= config.rounds) enterPhase("done");
          // Pause 0 s (Blockpause im Plan-Modell darf 0 sein): direkt in
          // die nächste Runde — eine 0-Sekunden-Rest-Phase bliebe hängen,
          // weil enterPhase dann kein Phasenende setzt (endAt = null)
          else if (config.restSeconds <= 0) enterPhase("work", r + 1);
          else enterPhase("rest", r);
        } else if (cur === "rest") {
          enterPhase("work", r + 1);
        }
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [running, config.rounds, config.restSeconds, enterPhase]);

  const start = useCallback(() => {
    if (phase === "done" || phase === "idle") {
      // Vorlauf 0 s (z. B. Auto-Durchlauf ohne Pause): direkt in die Arbeit —
      // eine 0-Sekunden-Prep-Phase bliebe hängen (endAt = null)
      if (config.prepSeconds <= 0) enterPhase("work", 1);
      else enterPhase("prep", 1);
    } else {
      endAtRef.current = Date.now() + remaining * 1000;
    }
    setRunning(true);
  }, [phase, remaining, config.prepSeconds, enterPhase]);

  const pause = useCallback(() => {
    setRunning(false);
    endAtRef.current = null;
  }, []);

  const reset = useCallback(() => {
    setRunning(false);
    setPhase("idle");
    setRound(1);
    setRemaining(config.workSeconds);
    endAtRef.current = null;
    countdownFiredRef.current = false;
  }, [config.workSeconds]);

  const skip = useCallback(() => {
    if (phase === "idle" || phase === "done") return;
    if (phase === "prep") enterPhase("work", 1);
    else if (phase === "work") {
      if (round >= config.rounds) enterPhase("done");
      // Pause 0 s → wie im Tick direkt zur nächsten Runde
      else if (config.restSeconds <= 0) enterPhase("work", round + 1);
      else enterPhase("rest", round);
    } else if (phase === "rest") enterPhase("work", round + 1);
  }, [phase, round, config.rounds, config.restSeconds, enterPhase]);

  useEffect(() => {
    if (phase === "idle") setRemaining(config.workSeconds);
  }, [config.workSeconds, phase]);

  return {
    phase, round, remaining, running, totalForPhase,
    config, setConfig, start, pause, reset, skip,
  };
}
