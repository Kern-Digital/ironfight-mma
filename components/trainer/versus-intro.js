/** Framework-independent intro. No remote assets, trackers or sound libraries. */
/*
 * Übernommen aus Leons Paket (D:/claude-projects/tidal-versus, versus-intro.js).
 * ZWEI ABWEICHUNGEN VOM PAKET (Leon 11.09.2026, nach dem ersten Einbau):
 *
 * 1. DAS INTRO BLEIBT AUF DEM BANNER. Das Paket schob die vergrößerte Anzeige
 *    in die Bildschirmmitte (dx/dy gegen innerWidth/innerHeight). Leon: „nicht
 *    bildschirmmittig, sondern mittig von dem Feld, in dem es angezeigt wird".
 *    dx und dy sind deshalb 0 — die Anzeige wächst an Ort und Stelle auf und
 *    setzt sich dort wieder ab.
 *
 * 2. DAS ZEITFENSTER FÜR DEN TON WAR ZU ENG. Das Paket startete den Sound nur,
 *    wenn der AudioContext binnen 180 ms nach Beginn lief. Nach einer
 *    Klick-Navigation in der App ist der Hauptthread aber noch mit dem Aufbau
 *    der Seite beschäftigt, und allein das Klonen und Animieren hier dauert
 *    länger — gemessen 11.09. im sichtbaren Chromium: Context „running",
 *    Status trotzdem „blocked". Das Fenster ist jetzt 1200 ms: Der Sound
 *    startet noch, solange das Intro erkennbar am Anfang ist; der Impact
 *    liegt bei 0,55 s, das Intro dauert 2,75 s. Was WEITER gilt: Ohne eine
 *    Nutzergeste im Tab sperrt der Browser den Ton, dann läuft das Intro
 *    stumm — und ein verspäteter Ton nach dem Intro wird nie abgespielt.
 *
 * 3. KEIN „ÜBERSPRINGEN"-KNOPF MEHR (Leon 12.09.): Das Overlay nimmt jetzt
 *    selbst die Zeiger-Ereignisse — ein Klick oder Tipp irgendwohin während
 *    des Intros beendet es, ohne dass der Klick die Seite darunter trifft.
 *    Escape bleibt.
 *
 * 4. EIN EREIGNIS FÜR DEN AUSKLANG: `tidal-versus:intro-settle` feuert bei
 *    62 % der Dauer — dem Moment, in dem die Anzeige zurück an ihren Platz
 *    gleitet und der Schleier sich hebt. Die Seite blendet ab da ihren Rest
 *    ein („alles soll erst smooth erscheinen, wenn die Animation anfängt zu
 *    enden"). `intro-end` kommt weiterhin am Schluss.
 */
const seenInMemory = new Set();
let activeIntro = null;
const DURATION = 2750;

/*
 * 5. LEONS TON STATT DES SYNTHETISCHEN (17.09.2026): „nimm den Sound für die
 *    Versus-Animation beim Wettkampf". Die Datei liegt in public/audio (Name
 *    behält die Herkunft wie die Timer-Töne). Sie ist rund 7 Sekunden lang,
 *    das Intro dauert 2,75 — deshalb BLENDET sie mit dem Intro aus, statt am
 *    Ende abzubrechen. Der synthetische Ton bleibt als Rückfall: Solange die
 *    Datei noch lädt oder nicht ausgeliefert wird, klingt das Intro wie bisher.
 *    Gespielt wird über denselben AudioContext wie vorher — die ganze
 *    Autoplay-Logik (Zeitfenster, „blocked", Stopper) bleibt, wie sie war.
 */
const TON_URL = '/audio/freesound_community-062864_ese-24142.mp3';
/** Pegel der Datei (der synthetische Ton hört weiter auf `volume`). */
const TON_PEGEL = 0.8;
/**
 * Erste 0,7 Sekunden der Datei überspringen (Leon 17.09.2026: „einen Ticken
 * vorne abschneiden vom Sound, ca. 0,7 Sekunden"). Der Anlauf der Datei lag
 * vor dem Bild; so setzt der Ton mit der Animation ein.
 */
const TON_START = 0.7;
let tonBytes = null;
let tonLauf = null;

/** Holt die Tondatei EINMAL je Sitzung und behält die Rohbytes. */
function holeTon() {
  if (tonBytes) return Promise.resolve(tonBytes);
  if (!tonLauf) {
    tonLauf = fetch(TON_URL)
      .then(r => (r.ok ? r.arrayBuffer() : null))
      .then(b => { tonBytes = b; return b; })
      .catch(() => { tonLauf = null; return null; });
  }
  return tonLauf;
}

/**
 * Spielt Leons Ton und blendet ihn zum Ende des Intros aus. `restMs` ist die
 * Zeit, die dem Intro noch bleibt. Liefert den Stopper.
 */
function spieleTonDatei(context, puffer, restMs) {
  const AUSKLANG = 0.42;
  const start = context.currentTime + 0.01;
  const ab = Math.min(TON_START, Math.max(0, puffer.duration - 0.6));
  const laenge = Math.max(AUSKLANG + 0.1, Math.min(puffer.duration - ab, restMs / 1000));
  const source = context.createBufferSource();
  source.buffer = puffer;
  const gain = context.createGain();
  gain.gain.setValueAtTime(TON_PEGEL, start);
  gain.gain.setValueAtTime(TON_PEGEL, start + laenge - AUSKLANG);
  gain.gain.linearRampToValueAtTime(0.0001, start + laenge);
  source.connect(gain).connect(context.destination);
  source.start(start, ab);
  source.stop(start + laenge + 0.02);
  return () => {
    try { source.stop(); } catch { /* Already finished. */ }
    try { source.disconnect(); gain.disconnect(); } catch { /* Already disconnected. */ }
  };
}

/** Original intro sound: stereo whoosh, low impact and metallic tail. */
export function scheduleVersusSound(context, volume = 0.35) {
  const start = context.currentTime + 0.015;
  const master = context.createGain();
  master.gain.value = Math.max(0, Math.min(1, volume));
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -12;
  compressor.knee.value = 15;
  compressor.ratio.value = 5;
  master.connect(compressor).connect(context.destination);
  const nodes = [master, compressor];
  const noise = context.createBuffer(1, Math.ceil(context.sampleRate * 3), context.sampleRate);
  const data = noise.getChannelData(0);
  let seed = 713;
  for (let i = 0; i < data.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    data[i] = ((seed >>> 0) / 4294967296) * 2 - 1;
  }
  function sweep(at, duration, level, reverse = false) {
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass'; filter.Q.value = 0.6;
    filter.frequency.setValueAtTime(reverse ? 2600 : 180, start + at);
    filter.frequency.exponentialRampToValueAtTime(reverse ? 180 : 3200, start + at + duration * 0.75);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start + at);
    gain.gain.exponentialRampToValueAtTime(level, start + at + duration * 0.65);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + at + duration);
    const pan = context.createStereoPanner();
    pan.pan.setValueAtTime(reverse ? 0.5 : -0.65, start + at);
    pan.pan.linearRampToValueAtTime(reverse ? -0.5 : 0.65, start + at + duration);
    source.connect(filter).connect(gain).connect(pan).connect(master);
    source.start(start + at); source.stop(start + at + duration);
    nodes.push(source, filter, gain, pan);
  }
  sweep(0, 0.63, 0.58);
  sweep(0.54, 0.24, 0.6);
  sweep(1.9, 0.66, 0.18, true);
  function tone(frequency, endFrequency, at, duration, level, type = 'sine') {
    const source = context.createOscillator(); source.type = type;
    source.frequency.setValueAtTime(frequency, start + at);
    source.frequency.exponentialRampToValueAtTime(endFrequency, start + at + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start + at);
    gain.gain.exponentialRampToValueAtTime(level, start + at + 0.009);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + at + duration);
    source.connect(gain).connect(master);
    source.start(start + at); source.stop(start + at + duration);
    nodes.push(source, gain);
  }
  tone(148, 43, 0.55, 0.78, 0.85);
  tone(72, 38, 0.56, 1.1, 0.35);
  tone(830, 790, 0.57, 0.58, 0.07, 'triangle');
  tone(1263, 1180, 0.57, 0.42, 0.045);
  return () => {
    for (const node of nodes) {
      try { if ('stop' in node) node.stop(); } catch { /* Already finished. */ }
      try { node.disconnect(); } catch { /* Already disconnected. */ }
    }
  };
}

function hasSeen(key) {
  if (seenInMemory.has(key)) return true;
  try { return sessionStorage.getItem(key) === '1'; } catch { return false; }
}
function markSeen(key) {
  seenInMemory.add(key);
  try { sessionStorage.setItem(key, '1'); } catch { /* Storage can be disabled. */ }
}

export function mountVersusIntro(host, options = {}) {
  const { onceKey = host.getAttribute('aria-label') || 'match', sound = true, volume = 0.35, autoPlay = true } = options;
  const storageKey = `tidal-versus:intro:v2:${onceKey}`;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  // Der Ton wird schon beim Einhängen geholt — beim Abspielen zählen
  // Millisekunden (Zeitfenster 1200 ms, Abweichung 2).
  if (sound) holeTon();
  let disposed = false;
  let finish = null;
  let observer = null;

  function play({ force = false } = {}) {
    if (disposed || !host.isConnected || reduced.matches || document.hidden || finish || (!force && hasSeen(storageKey))) return false;
    const rect = host.getBoundingClientRect();
    if (!rect.width || rect.bottom <= 0 || rect.top >= innerHeight) return false;
    if (activeIntro) activeIntro();
    markSeen(storageKey);
    const started = performance.now();
    const overlay = document.createElement('div');
    overlay.className = 'tidal-vs-intro';
    const backdrop = document.createElement('div');
    backdrop.className = 'tidal-vs-intro__backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    const clone = host.cloneNode(true);
    clone.removeAttribute('id');
    clone.removeAttribute('role');
    clone.removeAttribute('aria-label');
    clone.setAttribute('aria-hidden', 'true');
    clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    clone.classList.add('tidal-vs-intro__hero');
    Object.assign(clone.style, {position:'absolute',left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,margin:'0',visibility:'visible'});
    const computed = getComputedStyle(host);
    for (const property of ['--font-display','--font-inter','--vs-radius']) {
      const value = computed.getPropertyValue(property);
      if (value) clone.style.setProperty(property, value);
    }
    overlay.append(backdrop, clone);
    document.body.append(overlay);
    const oldVisibility = host.style.visibility;
    host.style.visibility = 'hidden';
    // Abweichung 1 (siehe Kopf): kein Weg zur Bildschirmmitte.
    const dx = 0;
    const dy = 0;
    // Die Vergrößerung muss um die EIGENE Mitte des Banners herum Platz
    // haben — nach links wie nach rechts, nach oben wie nach unten.
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const scale = Math.min(
      1.16,
      (2 * Math.min(cx, innerWidth - cx) - 24) / rect.width,
      (2 * Math.min(cy, innerHeight - cy) - 24) / rect.height,
    );
    const centered = `translate(${dx}px, ${dy}px)`;
    const animations = [];
    const animate = (element, frames, settings) => {
      const a = element.animate(frames, {...settings,fill:'both'});
      animations.push(a); return a;
    };
    const frames = [
      {transform:`${centered} scale(${scale * 0.93})`,opacity:0,offset:0},
      {transform:`${centered} scale(${scale})`,opacity:1,offset:0.22,easing:'ease-out'},
      {transform:`${centered} scale(${scale * 0.985})`,opacity:1,offset:0.62,easing:'cubic-bezier(.65,0,.2,1)'},
      {transform:'translate(0px, 0px) scale(1)',opacity:1,offset:1},
    ];
    animate(clone, frames, {duration:DURATION,easing:'ease-out'});
    animate(backdrop,[{opacity:0,offset:0},{opacity:1,offset:0.08},{opacity:1,offset:0.62},{opacity:0,offset:1}],{duration:DURATION});
    const plates = clone.querySelectorAll('.tidal-vs__plate');
    for (let i = 0; i < plates.length; i++) {
      const base = getComputedStyle(plates[i]).transform;
      animate(plates[i],[{transform:`translateX(${i ? 90 : -90}px) ${base === 'none' ? '' : base}`,opacity:0},{transform:base,opacity:1}],{duration:560,easing:'cubic-bezier(.16,1,.3,1)'});
    }
    const emblem = clone.querySelector('.tidal-vs__emblem');
    if (emblem) animate(emblem,[{transform:'translate(-50%, -50%) scale(1.5)',opacity:0,filter:'brightness(2)'},{transform:'translate(-50%, -50%) scale(1)',opacity:1,filter:'brightness(1)'}],{delay:240,duration:400,easing:'cubic-bezier(.2,.8,.2,1)'});

    let audioContext = null;
    let stopSound = null;
    overlay.dataset.sound = sound ? 'pending' : 'off';
    if (sound && volume > 0) {
      try {
        const Audio = window.AudioContext || window.webkitAudioContext;
        audioContext = new Audio();
        const imFenster = () => finish && audioContext.state === 'running' && performance.now() - started < 1200;
        const schedule = () => {
          // A suspended autoplay request must never trigger late, detached sound.
          if (!imFenster()) { // Abweichung 2 (siehe Kopf)
            if (overlay.isConnected) overlay.dataset.sound = 'blocked';
            return;
          }
          overlay.dataset.sound = 'playing';
          // Abweichung 5: Leons Datei, sonst der synthetische Ton.
          let abgebrochen = false;
          stopSound = () => { abgebrochen = true; };
          holeTon()
            .then(bytes => (bytes && imFenster() ? audioContext.decodeAudioData(bytes.slice(0)) : null))
            .then(puffer => {
              if (abgebrochen) return;
              // Lud die Datei zu lange, bleibt das Intro stumm — ein Ton, der
              // erst nach dem Aufschlag kommt, klingt wie ein Fehler.
              if (!imFenster()) {
                stopSound = null;
                if (overlay.isConnected) overlay.dataset.sound = 'late';
                return;
              }
              if (puffer) {
                stopSound = spieleTonDatei(audioContext, puffer, DURATION - (performance.now() - started));
              } else {
                stopSound = scheduleVersusSound(audioContext, volume);
              }
              if (abgebrochen) stopSound();
            })
            .catch(() => {
              if (abgebrochen || !imFenster()) return;
              stopSound = scheduleVersusSound(audioContext, volume);
            });
        };
        // Resolve on the next microtask so finish is ready even in a click handler.
        if (audioContext.state === 'running') queueMicrotask(schedule);
        else audioContext.resume().then(schedule).catch(() => { overlay.dataset.sound = 'blocked'; });
      } catch { overlay.dataset.sound = 'unavailable'; }
    }
    let timer;
    let settleTimer;
    const onKey = event => { if (event.key === 'Escape') finish?.(); };
    const onChange = () => finish?.();
    // Abweichung 3: Klick oder Tipp irgendwohin überspringt. Das Overlay hat
    // pointer-events: auto (globals.css), der Klick erreicht die Seite nicht.
    const onPointer = event => { event.preventDefault(); finish?.(); };
    finish = () => {
      if (!finish) return;
      const wasActive = finish;
      finish = null;
      clearTimeout(timer);
      clearTimeout(settleTimer);
      stopSound?.();
      if (audioContext && audioContext.state !== 'closed') audioContext.close().catch(() => {});
      animations.forEach(a => a.cancel());
      overlay.removeEventListener('pointerdown', onPointer);
      overlay.remove();
      host.style.visibility = oldVisibility;
      document.removeEventListener('keydown',onKey);
      document.removeEventListener('visibilitychange',onChange);
      window.removeEventListener('resize',onChange);
      window.removeEventListener('scroll',onChange);
      reduced.removeEventListener('change',onChange);
      if (activeIntro === wasActive) activeIntro = null;
      host.dispatchEvent(new CustomEvent('tidal-versus:intro-end'));
    };
    activeIntro = finish;
    overlay.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown',onKey);
    document.addEventListener('visibilitychange',onChange);
    window.addEventListener('resize',onChange);
    window.addEventListener('scroll',onChange,{passive:true});
    reduced.addEventListener('change',onChange);
    timer = setTimeout(finish,DURATION);
    // Abweichung 4: der Ausklang beginnt bei 62 % (Keyframe-Offset oben).
    settleTimer = setTimeout(() => host.dispatchEvent(new CustomEvent('tidal-versus:intro-settle')), DURATION * 0.62);
    host.dispatchEvent(new CustomEvent('tidal-versus:intro-start'));
    return true;
  }

  // Wait for the actual emblem and fonts. Safe across React Strict Mode cleanup.
  if (autoPlay) {
    const images = [...host.querySelectorAll('img')];
    Promise.allSettled([document.fonts?.ready, ...images.map(img => img.decode?.())]).then(() => {
      if (disposed || reduced.matches || hasSeen(storageKey)) return;
      observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          observer.disconnect();
          if (!disposed) play();
        }
      });
      observer.observe(host);
    });
  }
  return {play, destroy() {disposed = true; observer?.disconnect(); finish?.();}};
}
