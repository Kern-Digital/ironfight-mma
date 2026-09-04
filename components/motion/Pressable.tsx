"use client";

import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { motion } from "framer-motion";
import {
  HOVER_LIFT,
  HOVER_LIFT_SURFACE,
  TAP_PRESS,
  TAP_PRESS_SURFACE,
  springSnappy,
} from "@/lib/motion";
import { useMotionCapability } from "./useMotionCapability";

/**
 * Alles, was man anfassen kann — Knöpfe, Karten, Listenzeilen.
 *
 * Es gibt zwei Kräfte, weil eine Fläche anders reagieren muss als ein
 * Knopf: 2 % Anheben sind auf einem 90px-Knopf ein Nicken, auf einer
 * 700px-Karte ein Sprung. `tone="surface"` nimmt sich deshalb zurück.
 *
 * TAP wirkt IMMER, auch auf Touch — das Einsinken unter dem Finger ist
 * der halbe Grund für diese Komponente. HOVER wirkt nur an der Maus
 * (siehe useMotionCapability: sonst bleibt der Zustand auf iOS hängen).
 *
 * Das `data-motion`-Attribut sagt globals.css Bescheid, dass hier bereits
 * eine Feder am Werk ist — die CSS-Regeln `.btn-*:active { scale(.97) }`
 * halten sich dann heraus, statt sich auf 0.94 aufzumultiplizieren.
 */

type Tone = "control" | "surface";

type PressableProps = {
  children: ReactNode;
  /** "control" = Knopf (kräftig), "surface" = Karte/Zeile (zurückhaltend). */
  tone?: Tone;
  /** Nimmt einem einzelnen Element die Haptik, ohne es umzubauen. */
  still?: boolean;
} & ComponentPropsWithoutRef<typeof motion.button>;

export const Pressable = forwardRef<HTMLButtonElement, PressableProps>(
  function Pressable({ children, tone = "control", still, ...rest }, ref) {
    const { canHover, reduced } = useMotionCapability();
    const lift = tone === "surface" ? HOVER_LIFT_SURFACE : HOVER_LIFT;
    const press = tone === "surface" ? TAP_PRESS_SURFACE : TAP_PRESS;
    const off = still || reduced;

    return (
      <motion.button
        ref={ref}
        data-motion="press"
        whileHover={off || !canHover ? undefined : { scale: lift }}
        whileTap={off ? undefined : { scale: press }}
        transition={springSnappy}
        {...rest}
      >
        {children}
      </motion.button>
    );
  }
);

/** Dieselbe Haptik für alles, was kein <button> sein darf (Karten, <li>). */
export const PressableBox = forwardRef<
  HTMLDivElement,
  Omit<PressableProps, keyof ComponentPropsWithoutRef<typeof motion.button>> &
    ComponentPropsWithoutRef<typeof motion.div>
>(function PressableBox({ children, tone = "surface", still, ...rest }, ref) {
  const { canHover, reduced } = useMotionCapability();
  const lift = tone === "surface" ? HOVER_LIFT_SURFACE : HOVER_LIFT;
  const press = tone === "surface" ? TAP_PRESS_SURFACE : TAP_PRESS;
  const off = still || reduced;

  return (
    <motion.div
      ref={ref}
      data-motion="press"
      whileHover={off || !canHover ? undefined : { scale: lift }}
      whileTap={off ? undefined : { scale: press }}
      transition={springSnappy}
      {...rest}
    >
      {children}
    </motion.div>
  );
});
