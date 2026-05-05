/**
 * IronFight MMA — Audio Compat-Shim
 *
 * Diese Datei existiert nur, damit bestehende Imports weiter funktionieren.
 * Die echte Audio-Engine liegt jetzt in `lib/audio.ts` und enthält:
 *  • iOS-Audio-Unlock-Pattern
 *  • Boxglocken-Sound für Rundenende
 *  • Dynamische Tick-Lautstärke (ansteigend in den letzten 10 Sek.)
 *  • Vibration-Helper
 */

export {
  playRoundStart as playStartSignal,
  playSessionEnd as playEndSignal,
  playCountdownTick,
  playLastTick,
  playRestStart,
  playPrepBeep,
  unlockAudio,
  setAudioMuted,
  isAudioUnlocked,
  tickVolumeForRemaining,
  setVibrationEnabled,
  vibrate,
  vibrateTick,
  vibrateRoundEnd,
  vibrateSessionEnd,
  playRoundEnd,
} from "./audio";

import { playPrepBeep, playSessionEnd } from "./audio";

// Legacy-Compat — alte Importe rufen `beep()` und `beepSequence()` auf
export function beep(_freq = 600, _ms = 100) {
  playPrepBeep();
}

export async function beepSequence(
  _pattern: { freq: number; ms: number; gap?: number }[],
) {
  playSessionEnd();
}
