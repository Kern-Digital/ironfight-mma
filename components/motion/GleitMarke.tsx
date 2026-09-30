"use client";

import { motion } from "framer-motion";
import { useMotionCapability } from "./useMotionCapability";

/**
 * Die Markierung der offenen Seite, die von Zeile zu Zeile GLEITET (Leon
 * 30.09.2026: „lass dir etwas Besseres einfallen" — Nachfolger der
 * Glas-Lupe in der Sidebar).
 *
 * Jede aktive Zeile rendert eine Marke mit derselben `id`. Wechselt die
 * Seite, verschwindet sie in der alten Zeile und erscheint in der neuen —
 * Framer erkennt die gemeinsame `layoutId` und lässt sie den Weg dazwischen
 * zurücklegen, statt zu springen. Die Zeile trägt `position: relative` und
 * `isolation: isolate`; die Marke liegt mit `z-index: -1` unter Symbol und
 * Schrift.
 *
 * `folge` ist der Takt, zu dem überhaupt gemessen wird (der Pfad). Ohne ihn
 * mäße Framer bei JEDEM Rendern — auch mitten im Aus- und Einklappen der
 * Leiste, deren Breite CSS bewegt, und die Marke liefe der Zeile hinterher.
 *
 * Aussehen in globals.css (`.sb-marke`), nicht hier.
 */
export function GleitMarke({
  id,
  folge,
  className,
  style,
}: {
  /** Eine pro Liste — Sidebar und Schublade dürfen sich nicht teilen. */
  id: string;
  folge: string;
  /** Zusatzklasse neben `sb-marke` — Lage und Form. */
  className?: string;
  style?: React.CSSProperties;
}) {
  const { reduced } = useMotionCapability();
  if (reduced) return <span aria-hidden className={`sb-marke ${className ?? ""}`} style={style} />;
  return (
    <motion.span
      aria-hidden
      layoutId={id}
      layoutDependency={folge}
      className={`sb-marke ${className ?? ""}`}
      style={style}
      transition={{ type: "spring", stiffness: 520, damping: 42, mass: 0.9 }}
    />
  );
}
