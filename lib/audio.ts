/**
 * IronFight MMA — Audio-Engine
 *
 * Wichtige Designentscheidungen:
 *  • iOS Safari erlaubt AudioContext-Wiedergabe NUR nach einer User-Geste
 *    (touchstart/click). Wir bieten dafür `unlockAudio()` an, das einen
 *    stillen Buffer abspielt und damit die Audio-Pipeline freigibt.
 *  • Der AudioContext wird lazy erzeugt, um SSR-Fehler zu vermeiden.
 *  • Alle Sounds basieren auf der WebAudio-API — kein externes Asset nötig.
 *  • Lautstärke kann pro Klang dynamisch gesetzt werden (für ansteigenden
 *    Countdown in den letzten 10 Sekunden der Pause).
 *  • `playRoundEnd()` ist der prägnante Boxglocken-Sound für das Rundenende.
 */

let _ctx: AudioContext | null = null;
let _unlocked = false;

/** Globale Stummschaltung — wird vom Settings-Hook gesteuert */
let _muted = false;

export function setAudioMuted(value: boolean) {
  _muted = value;
}

export function isAudioUnlocked() {
  return _unlocked;
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!_ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    _ctx = new Ctor();
  }
  if (_ctx.state === "suspended") {
    // Versucht den Context zu reaktivieren (nach Tab-Wechsel etc.)
    _ctx.resume().catch(() => {});
  }
  return _ctx;
}

/**
 * Muss innerhalb einer User-Geste aufgerufen werden (Click/Touch).
 * Spielt einen stillen Buffer und resumiert den Context, damit auf iOS
 * danach alle weiteren Sounds funktionieren.
 */
export async function unlockAudio(): Promise<boolean> {
  const ctx = getCtx();
  if (!ctx) return false;

  try {
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    // Stiller Buffer trickst iOS-Pipeline frei
    const buffer = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start(0);
    _unlocked = true;
    return true;
  } catch {
    return false;
  }
}

// ─── Helper: Master-Gain mit globalem Mute ────────────────────────────────

function createMaster(ctx: AudioContext, value: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = _muted ? 0 : value;
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

// ─── PUBLIC API ────────────────────────────────────────────────────────────

/**
 * START-SIGNAL: 3-Ton-Signal für Rundenstart (FIGHT!)
 */
export function playRoundStart() {
  const ctx = getCtx();
  if (!ctx) return;
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

/**
 * BOX-GLOCKE: Prägnanter Rundenend-Sound — klassische Boxglocke
 *
 * Realisiert über mehrere harmonisch verschobene Sinus-Oszillatoren,
 * die gemeinsam abklingen — das erzeugt den typischen metallischen
 * Glockenklang. Anders als der Countdown-Tick. Klar und unverwechselbar.
 */
export function playRoundEnd() {
  const ctx = getCtx();
  if (!ctx) return;
  const master = createMaster(ctx, 0.85);
  const now = ctx.currentTime;

  // "DING-DING" — zweimal mit kurzer Pause
  for (const offset of [0, 0.28]) {
    bell(ctx, master, now + offset);
  }
}

/**
 * Boxglocken-Stoß — eine Glocke (DING)
 * Mehrere harmonisch leicht inharmonische Partials für metallischen Klang.
 */
function bell(ctx: AudioContext, output: GainNode, startTime: number) {
  // Glocken-Frequenzen leicht inharmonisch — typisches Glocken-Spektrum
  const partials = [
    { freq: 880, gain: 0.55, decay: 1.2 }, // Grundton
    { freq: 1318, gain: 0.4, decay: 0.95 }, // 1.5x — perfekte Quinte
    { freq: 1760, gain: 0.3, decay: 0.7 }, // 2x — Oktave
    { freq: 2640, gain: 0.18, decay: 0.5 }, // 3x — Sub-Oberton
    { freq: 3520, gain: 0.1, decay: 0.35 }, // 4x — Brillanz
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

  // Anschlagsgeräusch (Klöppel) — kurzer Noise-Burst
  noiseBurst(ctx, output, startTime, 0.025);
}

/**
 * SESSION-ENDE: Abschluss-Glocken-Sequenz nach letzter Runde
 *  Drei Glockenschläge — klar erkennbar als "fertig"
 */
export function playSessionEnd() {
  const ctx = getCtx();
  if (!ctx) return;
  const master = createMaster(ctx, 0.85);
  const now = ctx.currentTime;
  bell(ctx, master, now);
  bell(ctx, master, now + 0.28);
  bell(ctx, master, now + 0.62);
}

/**
 * REST-START: Weicher Gong — Pause hat begonnen
 */
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
 *
 * @param volume 0..1 — wird vom Timer dynamisch gesetzt:
 *   Sek. 10..3: linear ansteigend von 0.3 auf 0.85
 *   Sek. 2..1:  100 % (1.0)
 */
export function playCountdownTick(volume = 0.5) {
  const ctx = getCtx();
  if (!ctx) return;
  const v = Math.max(0, Math.min(1, volume));
  const master = createMaster(ctx, v);
  const now = ctx.currentTime;
  tone(ctx, master, 1200, now, 0.05, "sine", 0.001, 0.025);
  noiseBurst(ctx, master, now, 0.018);
}

/**
 * LAST-TICK: Lauterer/härterer Tick bei der allerletzten Sekunde (1)
 */
export function playLastTick() {
  const ctx = getCtx();
  if (!ctx) return;
  const master = createMaster(ctx, 1.0);
  const now = ctx.currentTime;
  tone(ctx, master, 1700, now, 0.07, "square", 0.001, 0.04);
  noiseBurst(ctx, master, now, 0.03);
}

/**
 * PREP-BEEP: Neutrales Beep für die Vorbereitungsphase
 */
export function playPrepBeep() {
  const ctx = getCtx();
  if (!ctx) return;
  const master = createMaster(ctx, 0.4);
  const now = ctx.currentTime;
  tone(ctx, master, 600, now, 0.1, "sine", 0.005, 0.05);
}

// ─── Berechnung der ansteigenden Tick-Lautstärke ──────────────────────────

/**
 * Berechnet die Tick-Lautstärke für den Countdown in den letzten 10 Sek.
 *
 * Verlauf:
 *   Sek. 10 → 0.30
 *   Sek.  9 → 0.39
 *   Sek.  8 → 0.49
 *   Sek.  7 → 0.58
 *   Sek.  6 → 0.67
 *   Sek.  5 → 0.77
 *   Sek.  4 → 0.86
 *   Sek.  3 → 0.95
 *   Sek.  2 → 1.00 (100%)
 *   Sek.  1 → 1.00 (100%)
 */
export function tickVolumeForRemaining(remaining: number): number {
  if (remaining > 10 || remaining < 1) return 0.5;
  if (remaining <= 2) return 1.0;
  // Linear von 0.30 (Sek. 10) bis 0.95 (Sek. 3)
  const start = 0.3;
  const end = 0.95;
  const t = (10 - remaining) / 7; // 0..1 zwischen Sek. 10 und Sek. 3
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

/** Kurze Vibration für einzelnen Countdown-Tick */
export function vibrateTick() {
  vibrate(35);
}

/** Lange Vibration für Rundenende */
export function vibrateRoundEnd() {
  vibrate([180, 80, 180]);
}

/** Endgültige Session-Ende-Vibration */
export function vibrateSessionEnd() {
  vibrate([300, 120, 300, 120, 500]);
}
