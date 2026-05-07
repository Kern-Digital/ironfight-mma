/**
 * IronFight MMA — Audio Engine (Web Audio API)
 *
 * Verwendet AudioContext statt HTMLAudioElement, um iOS-Probleme zu vermeiden:
 *  - Kein "Now Playing"-Eintrag im iOS-Lockscreen / Control Center
 *  - Keine dauerhafte AVAudioSession (war der Grund für Keep-Alive-Loop)
 *  - Spotify / externe Musik wird nur kurz unterbrochen (Dauer des Tons)
 *    und setzt danach automatisch wieder ein
 *  - Synthetische Sounds — keine externen MP3-Assets nötig
 *
 * iOS-Grenzen (technisch unvermeidbar aus Web-Apps):
 *  - Hardware-Stummschalter (silent switch) dämpft AudioContext-Töne
 *  - AVAudioSession-Ducking (30 % Lautstärke-Reduzierung externer Apps)
 *    ist aus einer Web-App nicht steuerbar — nur native iOS-Apps können das
 *  - Ganz kurze Unterbrechung anderer Musik beim Tonabspielen bleibt bestehen
 */

let _ctx: AudioContext | null = null;
let _muted = false;
let _vibrateEnabled = true;

// ─── Exports ──────────────────────────────────────────────────────────────────

export function setAudioMuted(value: boolean) { _muted = value; }
export function isAudioUnlocked(): boolean { return _ctx?.state === "running"; }

/** No-op — rückwärtskompatibel mit bestehenden Importen */
export function initAudio(): void {}
/** No-op — Keep-Alive wurde entfernt */
export function stopKeepAlive(): void {}

/**
 * Muss in einer User-Geste aufgerufen werden.
 * Resumt den AudioContext (iOS-Anforderung für Audio).
 */
export async function unlockAudio(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!_ctx) {
    _ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  if (_ctx.state === "suspended") {
    try { await _ctx.resume(); } catch { return false; }
  }
  return _ctx.state === "running";
}

// ─── AudioContext abrufen (nur wenn aktiv) ────────────────────────────────────

function getCtx(): AudioContext | null {
  if (_muted || typeof window === "undefined") return null;
  if (!_ctx) {
    _ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  if (_ctx.state === "suspended") {
    _ctx.resume().catch(() => {});
  }
  return _ctx.state === "running" ? _ctx : null;
}

// ─── Synth-Hilfsfunktionen ────────────────────────────────────────────────────

function createGain(ctx: AudioContext, value: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  g.connect(ctx.destination);
  return g;
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
  env.gain.setValueAtTime(1, startTime + duration - release);
  env.gain.linearRampToValueAtTime(0, startTime + duration);
  osc.connect(env);
  env.connect(output);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
}

function noiseBurst(ctx: AudioContext, output: GainNode, startTime: number, duration = 0.04) {
  const bufferSize = Math.ceil(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const env = ctx.createGain();
  env.gain.setValueAtTime(1, startTime);
  env.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  src.connect(env);
  env.connect(output);
  src.start(startTime);
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/** Rundenstart — aufsteigender Dreiklang + Punch (klingt wie Kampfglocke) */
export function playRoundStart(): void {
  const ctx = getCtx();
  if (!ctx) return;
  const master = createGain(ctx, 0.7);
  const now = ctx.currentTime;
  tone(ctx, master, 440, now,        0.18, "square", 0.005, 0.08);
  tone(ctx, master, 554, now + 0.20, 0.18, "square", 0.005, 0.08);
  tone(ctx, master, 660, now + 0.40, 0.35, "square", 0.005, 0.20);
  tone(ctx, master, 80,  now,        0.10, "sine",   0.002, 0.08);
  tone(ctx, master, 80,  now + 0.20, 0.10, "sine",   0.002, 0.08);
  tone(ctx, master, 80,  now + 0.40, 0.10, "sine",   0.002, 0.08);
  noiseBurst(ctx, master, now);
  noiseBurst(ctx, master, now + 0.20);
  noiseBurst(ctx, master, now + 0.40);
}

/** Rundenende — absteigende Alarm-Sequenz */
export function playRoundEnd(): void {
  const ctx = getCtx();
  if (!ctx) return;
  const master = createGain(ctx, 0.75);
  const now = ctx.currentTime;
  const freqs = [880, 660, 880, 660, 440];
  freqs.forEach((f, i) => {
    tone(ctx, master, f, now + i * 0.15, 0.12, "sawtooth", 0.005, 0.06);
    noiseBurst(ctx, master, now + i * 0.15, 0.03);
  });
  tone(ctx, master, 330, now + freqs.length * 0.15, 0.5, "square", 0.01, 0.35);
}

/** Session-Ende — lauterer Abschluss-Sound */
export function playSessionEnd(): void {
  const ctx = getCtx();
  if (!ctx) return;
  const master = createGain(ctx, 0.8);
  const now = ctx.currentTime;
  const freqs = [880, 660, 880, 660, 440, 660, 880];
  freqs.forEach((f, i) => {
    tone(ctx, master, f, now + i * 0.15, 0.14, "sawtooth", 0.005, 0.07);
    noiseBurst(ctx, master, now + i * 0.15, 0.035);
  });
  tone(ctx, master, 440, now + freqs.length * 0.15 + 0.1, 0.8, "square", 0.01, 0.6);
}

/**
 * Countdown-Tick — kurzer Klick (4 Sek. vor Kampfbeginn)
 * @param volume 0..1
 */
export function playCountdownTick(volume = 1.0): void {
  const ctx = getCtx();
  if (!ctx) return;
  const master = createGain(ctx, Math.max(0.2, Math.min(1, volume)) * 0.6);
  const now = ctx.currentTime;
  tone(ctx, master, 1200, now, 0.04, "sine", 0.001, 0.02);
  noiseBurst(ctx, master, now, 0.02);
}

// ─── Vibration ────────────────────────────────────────────────────────────────

export function setVibrationEnabled(value: boolean) { _vibrateEnabled = value; }

function vibrate(pattern: number | number[]) {
  if (!_vibrateEnabled || typeof navigator === "undefined") return;
  const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  try { nav.vibrate?.(pattern); } catch { /* ignore */ }
}

export function vibrateTick()       { vibrate(35); }
export function vibrateRoundEnd()   { vibrate([180, 80, 180]); }
export function vibrateSessionEnd() { vibrate([300, 120, 300, 120, 500]); }
