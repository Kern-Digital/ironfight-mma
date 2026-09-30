"use client";

/**
 * HAKEN-KNOPF — „Aktivieren" im Wochenplan (Leon 28.09.2026).
 *
 * Leon: „der button aktivieren soll nur einen hellen rand haben und wenn ich
 * darauf hoover soll der haken so animiert werden wie der nachfolgende
 * prompt [star-button]. jedoch soll wenn ich dann darauf klicke das feld
 * komplett hellblau werden".
 *
 * Nachgebaut statt kopiert (wie TimePicker und Kalender): die Vorlage war ein
 * shadcn-Checkbox-Label mit festen Amber-Klassen und `checked=""`. Hier ist es
 * ein echter <button>, die Farben kommen aus den Tokens (Gym-Akzent), und die
 * Bewegung ist reines CSS — kein framer-motion außerhalb components/motion.
 *
 * Die Bewegung der Vorlage: beim Überfahren rückt die Schrift nach rechts,
 * das Zeichen wächst auf das Fünfzehnfache und wandert nach links — seine
 * Striche fegen als breite Bahnen durch den Knopf. Unser Zeichen ist der
 * Haken. Klick = `laeuft`: das Feld füllt sich hellblau (Gym-Akzent, hell
 * gemischt), bis der Plan aktiv ist und der Knopf „Gilt jetzt" weicht.
 */

import s from "./HakenKnopf.module.css";

export default function HakenKnopf({
  children,
  laeuft = false,
  teil = false,
  disabled,
  onClick,
  ...rest
}: {
  children: React.ReactNode;
  /** Nach dem Klick, bis die Aktion fertig ist: Feld komplett hellblau. */
  laeuft?: boolean;
  /** Linke Hälfte eines zusammengesetzten Knopfs (rechts schließt ein
   *  zweiter Teil an, z. B. „Planen" im Wochenplan). */
  teil?: boolean;
  disabled?: boolean;
  onClick?: () => void;
} & Record<`data-${string}`, string | boolean | undefined>) {
  return (
    <button
      type="button"
      data-press
      className={s.knopf}
      data-laeuft={laeuft ? "" : undefined}
      data-teil={teil ? "" : undefined}
      aria-busy={laeuft || undefined}
      disabled={disabled}
      onClick={onClick}
      {...rest}
    >
      <span className={s.text}>{children}</span>
      <svg className={s.haken} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
        <path d="M5 12.5 9.5 17 19 7.5" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
