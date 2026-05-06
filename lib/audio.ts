/**
 * Tidal Athletics — Audio-Engine
 *
 * Wichtige Designentscheidungen:
 *  • iOS Safari erlaubt AudioContext-Wiedergabe NUR nach einer User-Geste.
 *    `unlockAudio()` spielt einen stillen Buffer und gibt damit die Pipeline frei.
 *  • MP3-Dateien aus /public/audio/ werden nach dem Unlock geladen (fetch + decodeAudioData).
 *  • Falls MP3s nicht ladbar sind, werden synthetisierte Fallback-Sounds verwendet.
 *  • `initAudio()` kann ohne User-Geste aufgerufen werden und lädt Buffers vorab.
 */

let _ctx: AudioContext | null = null;
let _unlocked = false;
let _muted = false;

// ─── MP3 Buffer Cache ──────────────────────────────────────────────────────

const BELL_URL = "/audio/cartoon-music-soundtrack-boxing-bell-hit-double-489811.mp3";
const COUNTDOWN_URL = "/audio/lesiakower-countdown-sound-effect-8-bit-151797.mp3";

let _bellBuffer: AudioBuffer | null = null;
let _countdownBuffer: AudioBuffer | null = null;
let _bufferLoadState: "idle" | "loading" | "done" | "error" = "idle";

export function setAudioMuted(value: boolean) {
  _muted = value;
}

export function isAudioUnlocked() {
  return _unlocked;
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!_ctx) {
    const Ctor = window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    _ctx = new Ctor();
  }
  if (_ctx.state === "suspended") {
    _ctx.resume().catch(() => {});
  }
  return _ctx;
}

/**
 * Lädt MP3-Buffer via fetch + decodeAudioData.
 * Kann ohne User-Geste aufgerufen werden (nur Wiedergabe braucht Geste).
 */
async function loadBuffers(): Promise<void> {
  if (_bufferLoadState !== "idle") return;
  _bufferLoadState = "loading";

  const ctx = getCtx();
  if (!ctx) {
    _bufferLoadState = "error";
    return;
  }

  try {
    const [bellRes, countdownRes] = await Promise.all([
      fetch(BELL_URL),
      fetch(COUNTDOWN_URL),
    ]);

    const [bellArr, countdownArr] = await Promise.all([
      bellRes.arrayBuffer(),
      countdownRes.arrayBuffer(),
    ]);

    [_bellBuffer, _countdownBuffer] = await Promise.all([
      ctx.decodeAudioData(bellArr),
      ctx.decodeAudioData(countdownArr),
    ]);

    _bufferLoadState = "done";
  } catch {
    _bufferLoadState = "error";
  }
}

/**
 * Eager-Initialisierung — vom Timer beim Seitenaufruf starten,
 * damit die Buffer bereit sind wenn der Nutzer auf Start drückt.
 */
export function initAudio(): void {
  if (typeof window === "undefined") return;
  loadBuffers().catch(() => {});
}

/**
 * Muss innerhalb einer User-Geste aufgerufen werden (Click/Touch).
 * Entsperrt iOS-Audiopipeline und startet Buffer-Download falls noch nicht geschehen.
 */
export async function unlockAudio(): Promise<boolean> {
  const ctx = getCtx();
  if (!ctx) return false;

  try {
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    const buffer = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start(0);
    _unlocked = true;

    loadBuffers().catch(() => {});
    return true;
  } catch {
    return false;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMaster(ctx: AudioContext, value: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = _muted ? 0 : value;
  g.connect(ctx.destination);
  return g;
}

function playBuffer(
  buffer: AudioBuffer,
  volume = 0.8,
  playbackRate = 1.0,
  delaySeconds = 0,
): void {
  const ctx = getCtx();
  if (!ctx) return;
  const master = createMaster(ctx, _muted ? 0 : volume);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = playbackRate;
  src.connect(master);
  src.start(ctx.currentTime + delaySeconds);
}

function tone(
  ctx: AudioContext,
  output: GainNode,
  freq: number,
  startTime: number,
  duration: number,
  type: OscillatorType = "sine",
  attack = 0.01,
  release = 0.05,
) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  env.gain.setValueAtTime(0, startTime);
  env.gain.linearRampToValueAtTime(1, startTime + attack);
  env.gain.setValueAtTime(1, startTime + Math.max(0, duration - release));
  env.gain.linearRampToValueAtTime(0, startTime + duration);
  osc.connect(env);
  env.connect(output);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
}

function noiseBurst(
  ctx: AudioContext,
  output: GainNode,
  startTime: number,
  duration = 0.04,
) {
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const env = ctx.createGain();
  env.gain.setValueAtTime(1, startTime);
  env.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  src.connect(env);
  env.connect(output);
  src.start(startTime);
}

function bell(ctx: AudioContext, output: GainNode, startTime: number) {
  const partials = [
    { freq: 880, gain: 0.55, decay: 1.2 },
    { freq: 1318, gain: 0.4, decay: 0.95 },
    { freq: 1760, gain: 0.3, decay: 0.7 },
    { freq: 2640, gain: 0.18, decay: 0.5 },
    { freq: 3520, gain: 0.1, decay: 0.35 },
  ];
  for (const p of partials) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(p.freq, startTime);
    env.gain.setValueAtTime(0, startTime);
    env.gain.linearRampToValueAtTime(p.gain, startTime + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + p.decay);
    osc.connect(env);
    env.connect(output);
    osc.start(startTime);
    osc.stop(startTime + p.decay + 0.05);
  }
  noiseBurst(ctx, output, startTime, 0.025);
}

// ─── PUBLIC API ────────────────────────────────────────────────────────────

/** START-SIGNAL: 3-Ton-Signal für Rundenstart (FIGHT!) */
export function playRoundStart() {
  const ctx = getCtx();
  if (!ctx) return;
  // Boxglocke via MP3 beim Rundenstart
  if (_bellBuffer) {
    playBuffer(_bellBuffer, 0.9, 1.0);
    return;
  }
  // Fallback: synthetisiertes Signal
  const master = createMaster(ctx, 0.7);
  const now = ctx.currentTime;
  tone(ctx, master, 440, now, 0.15, "square", 0.005, 0.06);
  tone(ctx, master, 554, now + 0.18, 0.15, "square", 0.005, 0.06);
  tone(ctx, master, 660, now + 0.36, 0.32, "square", 0.005, 0.18);
  tone(ctx, master, 80, now, 0.1, "sine", 0.002, 0.08);
  tone(ctx, master, 80, now + 0.18, 0.1, "sine", 0.002, 0.08);
  tone(ctx, master, 80, now + 0.36, 0.1, "sine", 0.002, 0.08);
  noiseBurst(ctx, master, now);
  noiseBurst(ctx, master, now + 0.18);
  noiseBurst(ctx, master, now + 0.36);
}

/** BOX-GLOCKE: Rundenende — klassische Doppelglocke */
export function playRoundEnd() {
  if (_bellBuffer) {
    playBuffer(_bellBuffer, 0.85, 1.0);
    return;
  }
  const ctx = getCtx();
  if (!ctx) return;
  const master = createMaster(ctx, 0.85);
  const now = ctx.currentTime;
  for (const offset of [0, 0.28]) {
    bell(ctx, master, now + offset);
  }
}

/** SESSION-ENDE: Abschluss nach letzter Runde — drei Glockenschläge */
export function playSessionEnd() {
  if (_bellBuffer) {
    playBuffer(_bellBuffer, 0.85, 1.0, 0);
    playBuffer(_bellBuffer, 0.85, 1.0, 0.8);
    return;
  }
  const ctx = getCtx();
  if (!ctx) return;
  const master = createMaster(ctx, 0.85);
  const now = ctx.currentTime;
  bell(ctx, master, now);
  bell(ctx, master, now + 0.28);
  bell(ctx, master, now + 0.62);
}

/** REST-START: Weicher Gong — Pause hat begonnen */
export function playRestStart() {
  const ctx = getCtx();
  if (!ctx) return;
  const master = createMaster(ctx, 0.5);
  const now = ctx.currentTime;
  tone(ctx, master, 220, now, 0.7, "sine", 0.01, 0.5);
  tone(ctx, master, 330, now + 0.04, 0.5, "sine", 0.01, 0.4);
}

/**
 * COUNTDOWN-TICK mit dynamischer Lautstärke
 * @param volume 0..1
 */
export function playCountdownTick(volume = 0.5) {
  const v = Math.max(0, Math.min(1, volume));
  if (_countdownBuffer) {
    playBuffer(_countdownBuffer, _muted ? 0 : v);
    return;
  }
  const ctx = getCtx();
  if (!ctx) return;
  const master = createMaster(ctx, v);
  const now = ctx.currentTime;
  tone(ctx, master, 1200, now, 0.05, "sine", 0.001, 0.025);
  noiseBurst(ctx, master, now, 0.018);
}

/** LAST-TICK: Letzter Countdown-Tick — lauter und schärfer */
export function playLastTick() {
  if (_countdownBuffer) {
    playBuffer(_countdownBuffer, _muted ? 0 : 1.0, 1.3);
    return;
  }
  const ctx = getCtx();
  if (!ctx) return;
  const master = createMaster(ctx, 1.0);
  const now = ctx.currentTime;
  tone(ctx, master, 1700, now, 0.07, "square", 0.001, 0.04);
  noiseBurst(ctx, master, now, 0.03);
}

/** PREP-BEEP: Neutrales Beep für Vorbereitungsphase */
export function playPrepBeep() {
  if (_countdownBuffer) {
    playBuffer(_countdownBuffer, _muted ? 0 : 0.4, 0.85);
    return;
  }
  const ctx = getCtx();
  if (!ctx) return;
  const master = createMaster(ctx, 0.4);
  const now = ctx.currentTime;
  tone(ctx, master, 600, now, 0.1, "sine", 0.005, 0.05);
}

// ─── Tick-Lautstärke ──────────────────────────────────────────────────────

export function tickVolumeForRemaining(remaining: number): number {
  if (remaining > 10 || remaining < 1) return 0.5;
  if (remaining <= 2) return 1.0;
  const start = 0.3;
  const end = 0.95;
  const t = (10 - remaining) / 7;
  return start + (end - start) * t;
}

// ─── Vibration ────────────────────────────────────────────────────────────

let _vibrateEnabled = true;

export function setVibrationEnabled(value: boolean) {
  _vibrateEnabled = value;
}

export function vibrate(pattern: number | number[]) {
  if (!_vibrateEnabled) return;
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  try {
    nav.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

export function vibrateTick() {
  vibrate(35);
}

export function vibrateRoundEnd() {
  vibrate([180, 80, 180]);
}

export function vibrateSessionEnd() {
  vibrate([300, 120, 300, 120, 500]);
}
