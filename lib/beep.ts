/**
 * IronFight MMA — Audio Compat-Shim
 *
 * Diese Datei existiert nur, damit bestehende Imports weiter funktionieren.
 * Die echte Audio-Engine liegt jetzt in `lib/audio.ts`.
 */

// ── Re-Exporte aus audio.ts ────────────────────────────────────
export {
  playRoundStart as playStartSignal,
  playSessionEnd as playEndSignal,
  playCountdownTick,
  unlockAudio,
  setAudioMuted,
  isAudioUnlocked,
  setVibrationEnabled,
  vibrateTick,
  vibrateRoundEnd,
  vibrateSessionEnd,
  playRoundEnd,
} from "./audio";

import { playCountdownTick, playRoundEnd as _roundEnd, playSessionEnd } from "./audio";

// ── Compat-Wrapper für umbenannte / entfernte Funktionen ───────
export function playLastTick(): void  { playCountdownTick(1.0); }
export function playRestStart(): void { _roundEnd(); }
export function playPrepBeep(): void  { playCountdownTick(0.8); }

export function tickVolumeForRemaining(remaining: number): number {
  if (remaining >= 10) return 0;
  return Math.max(0.2, Math.min(1, 1 - remaining / 10));
}

export function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  try { nav.vibrate?.(pattern); } catch { /* ignore */ }
}

// ── Legacy API ─────────────────────────────────────────────────
export function beep(_freq = 600, _ms = 100): void {
  playPrepBeep();
}

export async function beepSequence(
  _pattern: { freq: number; ms: number; gap?: number }[],
): Promise<void> {
  playSessionEnd();
}
