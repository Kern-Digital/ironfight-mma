"use client";

/**
 * Eine Textfläche, die mit ihrem Inhalt wächst — kein Scrollbalken im Feld,
 * kein Ziehgriff (Leon 18.09.2026 zum Gegnerprofil: „die Schreibfelder größer,
 * angepasster an den nötigen Platz vom Text").
 *
 * Dieselbe Rechnung wie `wachsen()` in PhasenEditor und CampNotizen, hier als
 * Baustein: Höhe auf `auto`, dann auf `scrollHeight` — plus die zwei Pixel
 * Rand, denn `scrollHeight` zählt den Rand nicht mit, `height` bei
 * `box-sizing: border-box` schon. Ohne die zwei Pixel springt ein Scrollbalken
 * auf, sobald die letzte Zeile voll ist.
 *
 * Nachgerechnet wird bei jedem neuen Wert UND bei jeder neuen Breite
 * (ResizeObserver): Ein Feld, das schmaler wird, bricht öfter um und braucht
 * mehr Höhe — das passiert beim Drehen des Handys und beim Aufklappen der
 * Sidebar, ohne dass sich der Wert ändert.
 */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type TextareaHTMLAttributes,
} from "react";

// Auf dem Server gibt es kein Layout — dort genügt der normale Effekt, sonst
// warnt React bei jedem Vorrendern.
const useLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

function nachmessen(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight + 2}px`;
}

export default function WachsendesFeld({
  value,
  minZeilen = 1,
  style,
  ...rest
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "rows"> & {
  value: string;
  /** So viele Zeilen hoch ist das Feld mindestens, auch leer. */
  minZeilen?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayout(() => nachmessen(ref.current), [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let breite = el.clientWidth;
    const beobachter = new ResizeObserver(() => {
      if (el.clientWidth === breite) return;
      breite = el.clientWidth;
      nachmessen(el);
    });
    beobachter.observe(el);
    return () => beobachter.disconnect();
  }, []);

  return (
    <textarea
      ref={ref}
      rows={minZeilen}
      value={value}
      // Kein Ziehgriff und kein Scrollbalken — auch wenn der Aufrufer einen
      // Stil mit `resize` mitbringt; die Höhe gehört dem Inhalt.
      style={{ ...style, resize: "none", overflow: "hidden" }}
      {...rest}
    />
  );
}
