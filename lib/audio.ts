/**
 * Tidal Athletics — Audio Engine
 *
 * HTMLAudioElement statt Web Audio API: aktiviert auf iOS die AVAudioSession
 * im Playback-Modus (ignoriert den Stummschalter), genau wie Spotify/YouTube.
 *
 * iOS-Strategie:
 *   1. initAudio()   → Audio-Objekte anlegen (kein User-Gesture nötig)
 *   2. unlockAudio() → In User-Geste aufrufen: Session aktivieren;
 *                      Keep-Alive-Loop (stille WAV) starten
 *   3. Sounds        → play() auf aktivierten Elementen → Silent Switch ignoriert
 *
 * Warum eine stille WAV statt volume=0:
 *   Auf iOS Safari ist HTMLAudioElement.volume nicht per JavaScript setzbar.
 *   Der Keep-Alive muss daher eine wirklich stille Audiodatei sein, keine
 *   echte Audiodatei bei volume=0.
 */

const BELL_URL =
  "/audio/cartoon-music-soundtrack-boxing-bell-hit-double-489811.mp3";
const COUNTDOWN_URL =
  "/audio/lesiakower-countdown-sound-effect-8-bit-151797.mp3";

// ─── State ────────────────────────────────────────────────────────────────────

let _bell: HTMLAudioElement | null = null;
let _countdown: HTMLAudioElement | null = null;
let _keepAlive: HTMLAudioElement | null = null;

let _unlocked = false;
let _muted = false;
let _inited = false;

// ─── Exports ──────────────────────────────────────────────────────────────────

export function setAudioMuted(value: boolean) { _muted = value; }
export function isAudioUnlocked()             { return _unlocked; }

// ─── Stille WAV ───────────────────────────────────────────────────────────────

/**
 * Erzeugt eine 1-Sekunde-stille-WAV-Datei als Blob-URL.
 * PCM, 8000 Hz, 8-Bit, Mono — iOS Safari spielt diese absolut lautlos ab,
 * unabhängig von den iOS-Lautstärke-Einschränkungen der Web-API.
 */
function makeSilentWavBlobUrl(): string {
  const sampleRate = 8000;
  const numSamples = sampleRate; // 1 Sekunde
  const buf = new Uint8Array(44 + numSamples);
  const dv = new DataView(buf.buffer);

  const str = (offset: number, s: string) =>
    s.split("").forEach((c, i) => (buf[offset + i] = c.charCodeAt(0)));

  str(0, "RIFF");
  dv.setUint32(4, 36 + numSamples, true);
  str(8, "WAVE");
  str(12, "fmt ");
  dv.setUint32(16, 16, true);   // fmt chunk size
  dv.setUint16(20, 1, true);    // PCM
  dv.setUint16(22, 1, true);    // mono
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate, true); // byte rate (rate × 1ch × 1byte)
  dv.setUint16(32, 1, true);    // block align
  dv.setUint16(34, 8, true);    // 8 bits per sample
  str(36, "data");
  dv.setUint32(40, numSamples, true);
  buf.fill(0x80, 44); // 0x80 = Mittelpunkt für unsigned 8-bit (Stille)

  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

// ─── Initialisierung ──────────────────────────────────────────────────────────

/**
 * Stufe 1: Audio-Objekte anlegen. Kein User-Gesture nötig.
 * Browser lädt Dateien im Hintergrund vor.
 */
export function initAudio(): void {
  if (typeof window === "undefined" || _inited) return;
  _inited = true;

  _bell = new Audio(BELL_URL);
  _bell.preload = "auto";

  _countdown = new Audio(COUNTDOWN_URL);
  _countdown.preload = "auto";

  // Keep-Alive: echte stille WAV als Blob-URL — lautlos auf allen Geräten
  const silentUrl = makeSilentWavBlobUrl();
  _keepAlive = new Audio(silentUrl);
  _keepAlive.loop = true;
}

// ─── Unlock ───────────────────────────────────────────────────────────────────

/**
 * Stufe 2: MUSS in einer User-Geste aufgerufen werden.
 * Aktiviert die iOS AVAudioSession und startet den Silent-Keep-Alive-Loop.
 */
export async function unlockAudio(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (_unlocked) return true;
  if (!_inited) initAudio();

  // Stille WAV abspielen → iOS AVAudioSession (Playback-Modus) aktivieren
  if (_keepAlive?.paused) {
    try { await _keepAlive.play(); } catch {}
  }

  // Bell und Countdown kurz anspielen+pausieren → iOS-Pre-Buffering
  // (Session ist durch Keep-Alive bereits aktiv, kein Lautstärkeproblem)
  for (const el of [_bell, _countdown]) {
    if (!el) continue;
    try {
      await el.play();
      el.pause();
      el.currentTime = 0;
    } catch {}
  }

  _unlocked = true;
  return true;
}

// ─── Keep-Alive stoppen ───────────────────────────────────────────────────────

export function stopKeepAlive(): void {
  if (_keepAlive && !_keepAlive.paused) {
    _keepAlive.pause();
    _keepAlive.currentTime = 0;
  }
}

// ─── Wiedergabe ───────────────────────────────────────────────────────────────

function playOnce(el: HTMLAudioElement | null, volume: number): void {
  if (!el || !_unlocked || _muted) return;
  try {
    el.volume = Math.max(0, Math.min(1, volume));
    el.currentTime = 0;
    el.play().catch(() => {});
  } catch {}
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/** Rundenstart — Boxing Bell (einmalig) */
export function playRoundStart(): void { playOnce(_bell, 0.9); }

/** Rundenende — Boxing Bell (einmalig) */
export function playRoundEnd(): void { playOnce(_bell, 0.85); }

/** Session-Ende — Boxing Bell (einmalig) */
export function playSessionEnd(): void { playOnce(_bell, 0.85); }

/**
 * Countdown-Ton — 4 Sek. vor Kampf-Beginn (einmalig pro Runde).
 * @param volume 0..1
 */
export function playCountdownTick(volume = 1.0): void {
  playOnce(_countdown, Math.max(0.2, Math.min(1, volume)));
}

// ─── Vibration ────────────────────────────────────────────────────────────────

let _vibrateEnabled = true;

export function setVibrationEnabled(value: boolean) { _vibrateEnabled = value; }

function vibrate(pattern: number | number[]) {
  if (!_vibrateEnabled || typeof navigator === "undefined") return;
  const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  try { nav.vibrate?.(pattern); } catch {}
}

export function vibrateTick()       { vibrate(35); }
export function vibrateRoundEnd()   { vibrate([180, 80, 180]); }
export function vibrateSessionEnd() { vibrate([300, 120, 300, 120, 500]); }
