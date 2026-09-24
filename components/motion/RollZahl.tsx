"use client";

import NumberFlow from "@number-flow/react";
import { useMotionCapability } from "./useMotionCapability";

/**
 * Eine Zahl, die sich beim Wechsel Ziffer für Ziffer umrollt — zuerst für
 * die Abo-Preise (monatlich ↔ jährlich, 22.09.2026, nach Leons Vorlage
 * „pricing-section-3").
 *
 * Warum in der Bewegungs-Schicht: `@number-flow/react` IST Bewegung. Hier
 * prüft EIN Ort die Reduced-Motion-Sperre; eine Seite fasst die Bibliothek
 * nie direkt an (MOTION-BRIEF, Regel 1).
 *
 * Deutsch formatiert („99 €", „117,81 €"). Glatte Beträge ohne
 * Nachkommastellen — dieselbe Regel wie `euro()` in lib/abo.ts.
 */
export function RollZahl({
  wert,
  waehrung = false,
  className,
  style,
}: {
  /** Bei `waehrung` in CENT, sonst die Zahl selbst. */
  wert: number;
  waehrung?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { reduced } = useMotionCapability();
  const glatt = !waehrung || wert % 100 === 0;
  return (
    <NumberFlow
      value={waehrung ? wert / 100 : wert}
      locales="de-DE"
      format={
        waehrung
          ? {
              style: "currency",
              currency: "EUR",
              minimumFractionDigits: glatt ? 0 : 2,
              maximumFractionDigits: glatt ? 0 : 2,
            }
          : undefined
      }
      animated={!reduced}
      className={className}
      style={style}
    />
  );
}

export default RollZahl;
