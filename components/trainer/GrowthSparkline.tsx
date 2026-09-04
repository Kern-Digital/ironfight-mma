"use client";

// AUSNAHME vom „kein framer-motion außerhalb components/motion/" (MOTION-BRIEF
// §3.1): Diagramme animieren ihre eigenen Formen — hier IST die Bewegung der
// Inhalt. Dieselbe Ausnahme wie CourseLoadChart, WeeklyFeedbackChart und
// MemberGrowthChart. Bis 04.09.2026 stand dieser Code in app/trainer/page.tsx
// und damit in einer SEITE; das war die Verletzung, nicht der Import.
import { motion, useReducedMotion } from "framer-motion";

/**
 * Balken-Sparkline der Wachstums-Kachel (Leons Bento-Vorlage): ein Balken je
 * Monat, Höhe folgt den Beitritten. Kein eigenes Diagramm mit Achsen — die
 * Kachel trägt die Zahl, die Balken tragen nur die Form des Verlaufs.
 */
export default function GrowthSparkline({ values }: { values: number[] }) {
  const reduced = useReducedMotion();
  const max = Math.max(...values, 1);
  return (
    <div aria-hidden className="flex h-12 items-end gap-[3px]">
      {values.map((v, i) => {
        const h = 4 + (v / max) * 42;
        return (
          <motion.span
            key={i}
            className="w-1.5 rounded-full"
            style={{ background: "var(--accent)", opacity: v === 0 ? 0.3 : 1 }}
            initial={reduced ? false : { height: 4 }}
            animate={{ height: h }}
            transition={{
              duration: 0.5,
              delay: i * 0.05,
              ease: [0.2, 0.8, 0.2, 1],
            }}
          />
        );
      })}
    </div>
  );
}
