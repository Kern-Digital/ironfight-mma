"use client";

/**
 * Symbol mit HERAUSWACHSENDEM WORT für benannte Aktionen (Leon 20.09.:
 * „ein großes Icon, das beim Hovern ‚Freigeben‘ einblendet").
 *
 * Es ist dieselbe Mechanik wie beim X der App (components/ui/XKnopf.tsx) und
 * bewusst DIESELBEN CSS-Klassen (`.x-knopf*` in globals.css): eine Kurve, eine
 * Dauer für Breite und Abstand, Wachsen über `grid-template-columns` 0fr → 1fr.
 * Zwei Unterschiede: das Symbol ist frei wählbar, und es dreht sich nicht —
 * die Drehung gehört zum X (sie zeigt dessen Weg), ein Personen-Symbol würde
 * sich beim Drehen nur verrenken. Ohne `data-drehung` greift die Dreh-Regel
 * im CSS nicht.
 *
 * Das Wort steht rechts vom Symbol und schiebt beim Aufklappen, was rechts
 * daneben liegt — deshalb gehört der Knopf an den ANFANG einer Zeile.
 */

import Icon, { type IconName } from "@/components/ui/Icon";

const WORT_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

export default function WortKnopf({
  onClick,
  ariaLabel,
  wort,
  icon,
  size = 34,
  strokeWidth = 1.9,
  style,
  className = "",
}: {
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  ariaLabel: string;
  wort: string;
  icon: IconName;
  size?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      data-press
      className={`x-knopf t-interactive inline-flex min-h-hit shrink-0 items-center justify-start rounded-full ${className}`}
      style={{
        ...WORT_FONT,
        ...style,
        paddingInline: Math.max(4, (44 - size) / 2),
      }}
    >
      <span className="x-knopf__zeichen inline-flex">
        <Icon name={icon} size={size} strokeWidth={strokeWidth} />
      </span>
      <span aria-hidden className="x-knopf__wort">
        <span className="overflow-hidden whitespace-nowrap py-1 leading-[1.5]">
          {wort}
        </span>
      </span>
    </button>
  );
}
