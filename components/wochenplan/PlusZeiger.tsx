"use client";

/**
 * DAS PLUS AM MAUSZEIGER (Leon 28.09.2026: „das plus am cursor, wenn ich im
 * wochenplan bin und damit etwas neues erstellen kann, soll etwas größer und
 * blau sein, bzw. in der gym-farbe"; zweiter Blick: „den cursor nicht durch
 * das + ersetzen, aber zusätzlich das + anzeigen … es laggt").
 *
 * Über einer FREIEN Stelle eines Tages steht dieses Plus in `--accent` (der
 * Farbe des Gyms) rechts unten NEBEN dem normalen Zeiger. Über einem Kurs
 * ist es weg.
 *
 * GEGEN DAS RUCKELN: höchstens eine Bewegung je Bildschirmbild
 * (requestAnimationFrame), das Maß der Fläche einmal je Bild statt je
 * Mausereignis, nur `transform` (Compositor), kein Filter/Schatten — ein
 * doppelter drop-shadow wurde vorher bei jeder Bewegung neu gerechnet.
 *
 * Es sitzt IN der Wochenfläche (`host`, position: relative), nicht per Portal
 * im <body>: Nur dort erbt es den Gym-Akzent der Seite.
 */

import Icon from "@/components/ui/Icon";
import { useEffect, useRef } from "react";
import s from "./plus.module.css";

/** Abstand des Plus zur Zeigerspitze — rechts unten, wie ein Kopier-Zeichen. */
const VERSATZ = 14;

export function usePlusZeiger() {
  const host = useRef<HTMLDivElement>(null);
  const plus = useRef<HTMLSpanElement>(null);
  const bild = useRef(0);
  const letzte = useRef<{ x: number; y: number; frei: boolean }>({
    x: 0,
    y: 0,
    frei: false,
  });

  useEffect(() => () => cancelAnimationFrame(bild.current), []);

  function zeichnen() {
    bild.current = 0;
    const el = plus.current;
    const h = host.current;
    if (!el || !h) return;
    const { x, y, frei } = letzte.current;
    if (!frei) {
      el.style.opacity = "0";
      return;
    }
    const r = h.getBoundingClientRect();
    el.style.opacity = "1";
    el.style.transform = `translate3d(${x - r.left + VERSATZ}px, ${y - r.top + VERSATZ}px, 0)`;
  }

  function bewegen(e: React.MouseEvent<HTMLElement>) {
    letzte.current = {
      x: e.clientX,
      y: e.clientY,
      frei: e.target === e.currentTarget,
    };
    if (!bild.current) bild.current = requestAnimationFrame(zeichnen);
  }

  function weg() {
    letzte.current.frei = false;
    if (!bild.current) bild.current = requestAnimationFrame(zeichnen);
  }

  const zeiger = (
    <span ref={plus} className={s.plus} aria-hidden>
      <Icon name="plus" size={16} strokeWidth={3} />
    </span>
  );

  return { host, bewegen, weg, zeiger };
}
