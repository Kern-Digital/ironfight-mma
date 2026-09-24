"use client";

import { motion } from "framer-motion";
import { useMotionCapability } from "./useMotionCapability";

/**
 * Eine Überschrift, deren Wörter nacheinander von oben in ihre Zeile
 * gleiten — wie durch einen Schlitz. Zuerst für „Wähl euer Abo"
 * (22.09.2026, nach Leons Vorlage „pricing-section-3", dort
 * `VerticalCutReveal`).
 *
 * Startet, sobald die Überschrift in den Blick scrollt, und nur einmal —
 * wie `Reveal`. Vorleser bekommen den ganzen Satz am Stück; die einzelnen
 * Wörter sind für sie stumm. Bei abbestellter Bewegung steht der Text
 * einfach da.
 *
 * Das kleine Polster oben und unten fängt Umlaut-Punkte und Unterlängen ab,
 * die das `overflow: hidden` des Schlitzes sonst abschneiden würde.
 */
export function WortReveal({ text, className }: { text: string; className?: string }) {
  const { reduced } = useMotionCapability();
  if (reduced) return <span className={className}>{text}</span>;
  const woerter = text.split(" ");
  return (
    <motion.span
      className={`inline-flex flex-wrap ${className ?? ""}`}
      initial="aus"
      whileInView="an"
      viewport={{ once: true, margin: "-40px" }}
      variants={{ aus: {}, an: { transition: { staggerChildren: 0.12 } } }}
    >
      <span className="sr-only">{text}</span>
      {woerter.map((wort, i) => (
        <span key={`${i}-${wort}`} aria-hidden className="-my-[0.12em] inline-flex overflow-hidden py-[0.12em]">
          <motion.span
            className="inline-block"
            variants={{
              aus: { y: "-110%" },
              an: { y: 0, transition: { type: "spring", stiffness: 250, damping: 40 } },
            }}
          >
            {wort}
            {i < woerter.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}

export default WortReveal;
