/**
 * Tidal Athletics — Audio Engine
 *
 * Warum HTMLAudioElement statt Web Audio API:
 *   Web Audio API (AudioContext) respektiert auf iOS immer den Stummschalter.
 *   HTMLAudioElement aktiviert hingegen die AVAudioSession im "Playback"-Modus,
 *   der den Stummschalter ignoriert — genau wie Spotify oder YouTube.
 *
 * iOS-Strategie (3 Schritte):
 *   1. initAudio()   → Pool aus Audio-Objekten anlegen (kein User-Gesture nötig)
 *   2. unlockAudio() → MUSS in User-Geste aufgerufen werden:
 *                      Alle Pool-Elemente kurz abspielen → MediaSession aktivieren
 *                      Keep-Alive-Loop starten (0.001 Lautstärke, unhörbar)
 *                      → hält Playback-Session aktiv zwischen Sounds
 *   3. Sounds        → play() auf bereits aktivierten Elementen
 *                      → Silent Switch wird ignoriert ✓
 *
 * Android/Desktop: funktioniert wie gehabt.
 */

const BELL_URL =
  "/audio/cartoon-music-soundtrack-boxing-bell-hit-double-489811.mp3";
const COUNTDOWN_URL =
  "/audio/lesiakower-countdown-sound-effect-8-bit-151797.mp3";

// Pool-Größen: mehrere Elemente pro Sound für schnelle Wiedergabe
const BELL_POOL      = 3;
const COUNTDOWN_POOL = 6; // Countdown-Ticks kommen sekündlich

// ─── State ────────────────────────────────────────────────────────────────

let _bellPool: HTMLAudioElement[]      = [];
let _countdownPool: HTMLAudioElement[] = [];
let _keepAlive: HTMLAudioElement | null = null;

let _bellIdx      = 0;
let _countdownIdx = 0;

let _unlocked = false;
let _muted    = false;
let _inited   = false;

// ─── Exports ──────────────────────────────────────────────────────────────

export function setAudioMuted(value: boolean)  { _muted = value; }
export function isAudioUnlocked()              { return _unlocked; }

// ─── Pool-Erstellung ──────────────────────────────────────────────────────

function makeEl(url: string): HTMLAudioElement {
  const el = new Audio(url);
  el.preload  = "auto";
  el.volume   = 1.0;
  return el;
}

/**
 * Stufe 1: Audio-Objekte anlegen (KEIN User-Gesture nötig).
 * Browser lädt Dateien im Hintergrund vor.
 */
export function initAudio(): void {
  if (typeof window === "undefined" || _inited) return;
  _inited = true;

  _bellPool      = Array.from({ length: BELL_POOL },      () => makeEl(BELL_URL));
  _countdownPool = Array.from({ length: COUNTDOWN_POOL }, () => makeEl(COUNTDOWN_URL));

  // Keep-Alive: Countdown-Datei bei 0 Lautstärke — vollständig lautlos.
  // volume=0 hält die iOS AVAudioSession aktiv, ohne dass etwas hörbar ist.
  _keepAlive         = makeEl(COUNTDOWN_URL);
  _keepAlive.loop    = true;
  _keepAlive.volume  = 0;
}

// ─── Unlock (MUSS in User-Geste aufgerufen werden) ───────────────────────

/**
 * Stufe 2: Alle Elemente kurz abspielen → iOS MediaSession aktivieren.
 * Nur so spielen spätere Sounds auch wenn der Stummschalter aktiv ist.
 */
export async function unlockAudio(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  // Guard: bereits entsperrt — kein erneutes Unlock, keine doppelten Pool-Plays
  if (_unlocked) return true;

  // Pool anlegen falls initAudio noch nicht aufgerufen wurde
  if (!_inited) initAudio();

  // Alle Pool-Elemente kurz anspielen → iOS MediaSession (Playback-Modus) aktivieren
  const all = [..._bellPool, ..._countdownPool];
  const proms = all.map(async (el) => {
    try {
      el.volume = 0;
      await el.play();
      el.pause();
      el.currentTime = 0;
      el.volume = 1.0;
    } catch {
      // Einige Browser brauchen keine Aktivierung — ignorieren
    }
  });
  await Promise.allSettled(proms);

  // Keep-Alive starten: hält die Playback-Session zwischen Sounds aktiv.
  // Wird nur gestartet wenn noch nicht läuft (paused-Check verhindert doppelten Start).
  if (_keepAlive && _keepAlive.paused) {
    try {
      await _keepAlive.play();
    } catch {
      // Keep-Alive ist optional — kein kritischer Fehler
    }
  }

  _unlocked = true;
  return true;
}

// ─── Keep-Alive stoppen (optional beim Timer-Reset) ───────────────────────

/** Stoppt den unhörbaren Loop — z. B. wenn Timer komplett beendet wird. */
export function stopKeepAlive(): void {
  if (_keepAlive && !_keepAlive.paused) {
    _keepAlive.pause();
    _keepAlive.currentTime = 0;
  }
}

// ─── Wiedergabe-Hilfe ─────────────────────────────────────────────────────

function playEl(
  el: HTMLAudioElement,
  volume: number,
  rate = 1.0,
): void {
  if (!_unlocked || _muted) return;
  try {
    el.playbackRate = rate;
    el.volume       = Math.max(0, Math.min(1, volume));
    el.currentTime  = 0;
    el.play().catch(() => {});
  } catch {
    // Ignorieren — z. B. wenn Browser Autoplay noch nicht erlaubt
  }
}

function nextBell(): HTMLAudioElement | null {
  if (_bellPool.length === 0) return null;
  const el = _bellPool[_bellIdx % _bellPool.length];
  _bellIdx++;
  return el;
}

function nextCountdown(): HTMLAudioElement | null {
  if (_countdownPool.length === 0) return null;
  const el = _countdownPool[_countdownIdx % _countdownPool.length];
  _countdownIdx++;
  return el;
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────

/** Rundenstart — Boxing Bell */
export function playRoundStart(): void {
  const el = nextBell();
  if (el) playEl(el, 0.9);
}

/** Rundenende — Boxing Bell (Datei enthält Doppelglocke) */
export function playRoundEnd(): void {
  const el = nextBell();
  if (el) playEl(el, 0.85);
}

/** Session-Ende — Bell (Datei enthält bereits Doppelglocke) */
export function playSessionEnd(): void {
  const el = nextBell();
  if (el) playEl(el, 0.85);
}

/** Pause-Start — leiser Glocken-Hinweis */
export function playRestStart(): void {
  const el = nextBell();
  if (el) playEl(el, 0.35);
}

/**
 * Countdown-Tick — Lautstärke steigt in den letzten Sekunden
 * @param volume 0..1
 */
export function playCountdownTick(volume = 0.5): void {
  const el = nextCountdown();
  if (el) playEl(el, Math.max(0.2, Math.min(1, volume)));
}

/** Letzter Tick — lauter und etwas schneller */
export function playLastTick(): void {
  const el = nextCountdown();
  if (el) playEl(el, 1.0, 1.2);
}

/** Vorbereitungs-Beep — leiser Countdown-Ton */
export function playPrepBeep(): void {
  const el = nextCountdown();
  if (el) playEl(el, 0.3, 0.9);
}

// ─── Lautstärke-Kurve für Countdown ──────────────────────────────────────

/**
 * Lautstärke für die letzten 10 Sekunden — linear ansteigend.
 */
export function tickVolumeForRemaining(remaining: number): number {
  if (remaining > 10 || remaining < 1) return 0.5;
  if (remaining <= 2) return 1.0;
  const t = (10 - remaining) / 7;
  return 0.3 + 0.65 * t;
}

// ─── Vibration ────────────────────────────────────────────────────────────

let _vibrateEnabled = true;

export function setVibrationEnabled(value: boolean) { _vibrateEnabled = value; }

export function vibrate(pattern: number | number[]) {
  if (!_vibrateEnabled || typeof navigator === "undefined") return;
  const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  try { nav.vibrate?.(pattern); } catch { /* ignore */ }
}

export function vibrateTick()       { vibrate(35); }
export function vibrateRoundEnd()   { vibrate([180, 80, 180]); }
export function vibrateSessionEnd() { vibrate([300, 120, 300, 120, 500]); }
