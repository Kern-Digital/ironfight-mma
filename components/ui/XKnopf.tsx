"use client";

/**
 * DAS X DER APP (Leon 16.09.2026, „wende das bei allen X in der App an").
 * Jeder freistehende Schließen-/Löschen-/Entfernen-Knopf ist dieser Knopf:
 *
 *   - KEIN Kreis, kein Rahmen, keine Fläche drumherum — das X selbst ist groß
 *     und fett (Standard 36 px, Strich 4; in Zeilen 30 px).
 *   - Unter dem Zeiger (und bei Tastaturfokus) wächst ein WORT heraus
 *     („Schließen", „Löschen", „Entfernen" …).
 *   - Die Drehung folgt dem Weg des X:
 *       roll     das X steht rechtsbündig, das Wort schiebt es nach links —
 *                es rollt eine halbe Umdrehung dorthin
 *       viertel  das X steht linksbündig und bleibt, das Wort wächst nach
 *                rechts — nur 90°
 *   - Drehung, Breite und Abstand teilen Dauer und Kurve (globals.css,
 *     „DAS X MIT HERAUSWACHSENDEM WORT").
 *
 * ZWEI FALLEN, BEIDE GESEHEN:
 *   (1) Die Breite wächst über `grid-template-columns: 0fr → 1fr`, NICHT über
 *       `max-width` — mit `max-w-[8rem]` lief die Bewegung über die Wortbreite
 *       hinaus ins Leere und ruckelte.
 *   (2) KEIN `min-w-[44px]` + `justify-center`: Ein X schmaler als die
 *       Mindestbreite rutschte beim Zuklappen in die Mitte (ein kleiner
 *       Schritt nach der Drehung). Die 44-px-Tippfläche kommt aus dem
 *       Innenabstand.
 */

import Icon from "@/components/ui/Icon";

const WORT_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

export default function XKnopf({
  onClick,
  ariaLabel,
  wort,
  drehung,
  style,
  className = "",
  icon = "x",
  size = 36,
  strokeWidth = 4,
  dataAktion,
}: {
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  ariaLabel: string;
  wort: string;
  drehung: "roll" | "viertel";
  style?: React.CSSProperties;
  className?: string;
  icon?: "x" | "refresh";
  size?: number;
  strokeWidth?: number;
  dataAktion?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      data-aktion={dataAktion}
      data-drehung={drehung}
      className={`x-knopf t-interactive inline-flex min-h-hit shrink-0 items-center justify-start rounded-full ${className}`}
      style={{ ...WORT_FONT, ...style, paddingInline: Math.max(4, (44 - size) / 2) }}
    >
      <span className="x-knopf__zeichen inline-flex">
        <Icon name={icon} size={size} strokeWidth={strokeWidth} />
      </span>
      <span aria-hidden className="x-knopf__wort">
        <span className="overflow-hidden whitespace-nowrap py-1 leading-[1.5]">{wort}</span>
      </span>
    </button>
  );
}
