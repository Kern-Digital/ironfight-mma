/**
 * Die Bewegungs-Grammatik der App — EIN Ort für alles, was sich bewegt.
 *
 * Warum zentral: Haptik lebt von Wiedererkennung. Ein Knopf, der sich hier
 * um 3 % hebt und dort um 8 %, fühlt sich nach zwei Apps an. Alle Werte
 * stehen deshalb hier und nirgendwo sonst.
 *
 * Die Zahlen sind KEINE Neuerfindung: `scale(.97)` beim Drücken und
 * `scale(1.02)` beim Anheben laufen seit dem Sidebar-Umbau in globals.css
 * (.btn-primary:active, Glas-Lupe). Diese Datei zieht sie nur aus dem CSS
 * heraus, damit Framer Motion dieselbe Sprache spricht.
 *
 * NATIVE-READY: Die App wird via Capacitor in WKWebView/Android-WebView
 * laufen (docs/DESIGN-BRIEF.md §8) — dort rendert framer-motion identisch
 * zum Browser. Sollte je auf React Native gewechselt werden, ist DIESE
 * Datei plus components/motion/ die einzige Stelle, die neu geschrieben
 * werden muss; die 70 aufrufenden Dateien bleiben unberührt.
 */

import type { Transition, Variants } from "framer-motion";

/* ── Federn ─────────────────────────────────────────────────────────────
   Drei Federn decken die ganze App ab. Mehr braucht es nicht, mehr macht
   die Bewegung nur uneinheitlich. */

/** Antwort auf Finger und Maus: sofort da, ohne Nachwippen. */
export const springSnappy: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 32,
  mass: 0.7,
};

/** Verwandlung von Form und Größe: weicher Bounce, sichtbar elastisch. */
export const springSoft: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 26,
  mass: 0.9,
};

/** Auftritt neuer Elemente: getragen, ohne Überschwingen. */
export const springGentle: Transition = {
  type: "spring",
  stiffness: 190,
  damping: 24,
  mass: 1,
};

/* ── Haptik-Maße ────────────────────────────────────────────────────────
   Gespiegelt aus globals.css. Ändert sich hier ein Wert, muss er dort
   mitgehen — sonst springen CSS-Buttons anders als Motion-Buttons. */

export const HOVER_LIFT = 1.02;
export const TAP_PRESS = 0.97;
/** Flächen (Karten, Listenzeilen) heben sich weniger als kleine Knöpfe —
 *  2 % auf einer breiten Karte ist optisch eine viel größere Bewegung. */
export const HOVER_LIFT_SURFACE = 1.008;
export const TAP_PRESS_SURFACE = 0.99;

/* ── Kartei-Stapel ──────────────────────────────────────────────────────
   Liegt ein zweites Sheet vor einem ersten (Übungs-Detail → Technik),
   stellt sich das hintere wie ein Ordner hinten an: ein Stück nach oben,
   etwas schmaler, damit seine Oberkante über dem vorderen hervorschaut.
   Nur die Breite schrumpft — eine Höhen-Skalierung zöge die Oberkante
   nach unten und der Stapel wäre unsichtbar. Die Werte stammen aus dem
   Kartei-Effekt vom 2026-08-28 (Leons Abnahme) und ziehen hier nur ein. */
export const STACK_LIFT = -44;
export const STACK_SHRINK = 0.92;

/* ── Auftritt ───────────────────────────────────────────────────────────
   Der Abstand zwischen zwei Listeneinträgen. 45 ms ist die Grenze, ab der
   das Auge eine Welle statt eines Rucks sieht; darüber wird das Warten
   bei langen Listen spürbar, deshalb deckelt Stagger die Gesamtdauer. */
export const STAGGER_STEP = 0.045;
export const STAGGER_MAX_TOTAL = 0.4;

/**
 * Unschärfe beim Hereinfließen.
 *
 * ACHTUNG iOS: `filter: blur()` ist in WKWebView pro Bild ein Repaint und
 * NICHT GPU-beschleunigt wie transform/opacity. Auf jedem Eintrag einer
 * 20er-Liste gleichzeitig ruckelt das auf älteren Geräten sichtbar.
 * Deshalb: kleiner Radius, und auf Touch-Geräten schaltet
 * `useMotionCapability()` ihn ganz ab (Bewegung bleibt, Unschärfe geht).
 */
export const BLUR_IN = 4;

/* ── Fertige Varianten ──────────────────────────────────────────────────
   `custom` transportiert den Index für den Stagger-Versatz. */

export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.985 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { ...springGentle, delay: staggerDelay(i) },
  }),
  exit: { opacity: 0, y: -6, scale: 0.985, transition: { duration: 0.15 } },
};

/** Wie oben, zusätzlich mit Unschärfe — nur für hover-fähige Geräte. */
export const fadeUpBlurVariants: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.985, filter: `blur(${BLUR_IN}px)` },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { ...springGentle, delay: staggerDelay(i) },
  }),
  exit: {
    opacity: 0,
    y: -6,
    scale: 0.985,
    filter: `blur(${BLUR_IN}px)`,
    transition: { duration: 0.15 },
  },
};

/** Panels, Dropdowns, Modals: wachsen aus ihrem Ursprung heraus. */
export const popVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: -4 },
  visible: { opacity: 1, scale: 1, y: 0, transition: springSoft },
  exit: { opacity: 0, scale: 0.96, y: -4, transition: { duration: 0.14 } },
};

/** Der Stagger-Versatz für Position `i`, gedeckelt auf STAGGER_MAX_TOTAL. */
export function staggerDelay(i: number): number {
  return Math.min(i * STAGGER_STEP, STAGGER_MAX_TOTAL);
}
