"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

export type MotionCapability = {
  /** Echter Mauszeiger vorhanden — sonst gibt es kein Hover zu bedienen. */
  canHover: boolean;
  /** Nutzer hat Bewegung im Betriebssystem abbestellt. */
  reduced: boolean;
  /** Unschärfe-Verläufe erlaubt (kostet auf Touch/WebView zu viel). */
  canBlur: boolean;
};

/**
 * Was darf sich auf DIESEM Gerät bewegen?
 *
 * Zwei Gründe für diesen Hook:
 *
 * 1. HOVER auf Touch ist eine Falle. Framer feuert `whileHover` über
 *    pointerenter — auf iOS löst der erste Tap es aus und der angehobene
 *    Zustand BLEIBT hängen, bis woanders hingetippt wird. Jedes
 *    `whileHover` in dieser App läuft deshalb durch `canHover`.
 *
 * 2. BLUR ist in WKWebView teuer (siehe lib/motion.ts, BLUR_IN). Auf
 *    Touch-Geräten fällt er weg; die Bewegung selbst bleibt vollständig.
 *
 * Der Startwert ist bewusst `false`: der Server kennt das Gerät nicht, und
 * ein Knopf, der ohne Hover startet und ihn nach dem ersten Frame bekommt,
 * ist unauffällig — umgekehrt blitzt er auf.
 */
export function useMotionCapability(): MotionCapability {
  const reduced = useReducedMotion() ?? false;
  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    const apply = () => setCanHover(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  return {
    canHover: canHover && !reduced,
    reduced,
    canBlur: canHover && !reduced,
  };
}
