"use client";

import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  type AnimationPlaybackControls,
  type ValueAnimationTransition,
} from "framer-motion";
import { useEffect, useRef } from "react";
import { useMotionCapability } from "./useMotionCapability";

const ZAHL_FMT = new Intl.NumberFormat("de-DE");

/**
 * Eine Zahl, die beim Erscheinen hochzählt — zuerst für die Kennzahlen der
 * Mitglieder-Seite (29.09.2026, nach Leons Vorlage „counting-number").
 *
 * Unterschied zu `RollZahl`: RollZahl rollt Ziffer für Ziffer um, wenn sich
 * ein Wert ÄNDERT (Preis monatlich ↔ jährlich). Diese hier zählt beim ersten
 * Auftritt von null hoch; ändert sich der Wert danach (jemand bekommt das
 * Trainer-Häkchen), zählt sie vom alten zum neuen Wert statt wieder bei null
 * anzufangen.
 *
 * Aus der Vorlage übernommen: MotionValue + `animate`, gerundet, tabellarische
 * Ziffern. Anders als dort:
 * • `framer-motion` statt des Pakets `motion` — dasselbe Werk (framer-motion
 *   12 IST motion), ein zweites Paket wäre dieselbe Bibliothek doppelt.
 * • Reduced Motion zeigt sofort den Endwert (MOTION-BRIEF, Regel 1).
 * • Deutsch formatiert („1.250"), und die Breite steht ab dem ersten Bild auf
 *   der Stellenzahl des Ziels — sonst wächst der Block beim Zählen von „9" auf
 *   „10" und schiebt seine Nachbarn.
 */
export function CountingNumber({
  target,
  from = 0,
  transition = { duration: 1.1, ease: [0.16, 1, 0.3, 1] },
  className,
  style,
}: {
  target: number;
  /** Startwert beim ersten Auftritt. */
  from?: number;
  transition?: ValueAnimationTransition<number>;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { reduced } = useMotionCapability();
  const count = useMotionValue(reduced ? target : from);
  const text = useTransform(count, (v) => ZAHL_FMT.format(Math.round(v)));
  const controls = useRef<AnimationPlaybackControls | null>(null);

  useEffect(() => {
    controls.current?.stop();
    if (reduced) {
      count.set(target);
      return;
    }
    // Vom AKTUELLEN Stand aus: beim ersten Mal ist das `from`, danach der
    // alte Wert — eine Zahl, die bei jeder Änderung auf null fällt, blinkt.
    controls.current = animate(count, target, transition);
    return () => controls.current?.stop();
    // `transition` bewusst nicht als Abhängigkeit: ein Objekt-Literal des
    // Aufrufers wäre bei jedem Rendern neu und startete die Zählung neu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduced, count]);

  return (
    <motion.span
      className={className}
      style={{
        fontVariantNumeric: "tabular-nums",
        display: "inline-block",
        minWidth: `${ZAHL_FMT.format(target).length}ch`,
        ...style,
      }}
    >
      {text}
    </motion.span>
  );
}

export default CountingNumber;
