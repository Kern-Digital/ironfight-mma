"use client";

import { Children, isValidElement } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import { BLUR_IN, STAGGER_STEP, springGentle } from "@/lib/motion";
import { useMotionCapability } from "./useMotionCapability";

/**
 * Listen, die als Welle hereinlaufen statt auf einen Schlag zu erscheinen.
 *
 * Der Versatz zwischen zwei Einträgen macht aus einem Aufblitzen eine
 * Bewegung, der das Auge folgen kann. `delayChildren` gibt der ersten
 * Zeile einen Wimpernschlag Vorsprung, damit die Welle eine Richtung hat.
 *
 * Die Unschärfe liegt bewusst auf den EINZELNEN Zeilen, aber nur mit 4px
 * und nur an der Maus — in WKWebView (Capacitor) ist animierter Blur pro
 * Bild ein Repaint, und 20 gleichzeitig laufende Zeilen ruckeln auf
 * älteren iPhones sichtbar. Auf Touch bleibt die Welle, die Unschärfe geht.
 */
export function Stagger({
  children,
  className,
  as = "div",
  ...rest
}: {
  children: ReactNode;
  /** Semantik erhalten: eine Gruppen-Ueberschrift gehoert in <section>. */
  as?: "div" | "section";
} & HTMLMotionProps<"div">) {
  const { reduced } = useMotionCapability();
  // Der Cast, weil TypeScript die Event-Handler von <div> und <section> als
  // unvereinbar sieht (HTMLDivElement vs. HTMLElement). Die durchgereichten
  // Props sind hier ausschliesslich className und Motion-Werte — beide
  // Elemente nehmen sie gleich entgegen.
  const Tag = (as === "section" ? motion.section : motion.div) as typeof motion.div;
  const Plain = as === "section" ? "section" : "div";
  if (reduced) return <Plain className={className}>{children}</Plain>;

  return (
    <Tag
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: STAGGER_STEP, delayChildren: 0.04 },
        },
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Eine Zeile in der Welle. Muss direktes Kind von <Stagger> sein. */
export function StaggerItem({
  children,
  className,
  ...rest
}: { children: ReactNode } & HTMLMotionProps<"div">) {
  const { reduced, canBlur } = useMotionCapability();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      variants={{
        hidden: {
          opacity: 0,
          y: 12,
          scale: 0.99,
          ...(canBlur ? { filter: `blur(${BLUR_IN}px)` } : null),
        },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          ...(canBlur ? { filter: "blur(0px)" } : null),
          transition: springGentle,
        },
        exit: { opacity: 0, y: -8, scale: 0.99, transition: { duration: 0.15 } },
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/**
 * Für Listen, die sich WÄHREND der Nutzung ändern — Suchtreffer, gefilterte
 * Athleten, Kursbelegungen.
 *
 * `popLayout` nimmt gehende Einträge sofort aus dem Fluss, damit die
 * bleibenden ohne Warten auf ihre neue Position rutschen. Ohne das
 * springt eine gefilterte Liste hart, statt sich zu sortieren.
 *
 * Jedes Kind braucht einen stabilen `key` (die Firestore-ID, nicht den
 * Index) — sonst hält Framer die falsche Zeile für die gebliebene.
 */
export function StaggerFlow({
  children,
  className,
  ...rest
}: { children: ReactNode } & HTMLMotionProps<"div">) {
  const { reduced } = useMotionCapability();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div className={className} layout {...rest}>
      <AnimatePresence mode="popLayout" initial={false}>
        {children}
      </AnimatePresence>
    </motion.div>
  );
}

/** Eintrag in einer <StaggerFlow>-Liste: fließt mit, statt zu springen. */
export function FlowItem({
  children,
  className,
  index = 0,
  ...rest
}: { children: ReactNode; index?: number } & HTMLMotionProps<"div">) {
  const { reduced, canBlur } = useMotionCapability();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      layout
      className={className}
      initial={{
        opacity: 0,
        y: 10,
        ...(canBlur ? { filter: `blur(${BLUR_IN}px)` } : null),
      }}
      animate={{
        opacity: 1,
        y: 0,
        ...(canBlur ? { filter: "blur(0px)" } : null),
        transition: { ...springGentle, delay: Math.min(index * STAGGER_STEP, 0.3) },
      }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.14 } }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/**
 * Auftrittswelle ohne Umbau der Liste.
 *
 * `Stagger` + `StaggerItem` verlangt, dass jedes Kind von Hand gewickelt
 * wird — bei einer `.map()` mit Block-Rumpf und `return (...)` sind das
 * zwei fummelige Eingriffe pro Liste. `StaggerList` nimmt stattdessen den
 * Container und wickelt selbst, was drinsteht: aus
 *
 *     <div className="flex flex-col gap-3">
 *
 * wird
 *
 *     <StaggerList className="flex flex-col gap-3">
 *
 * und der Rest bleibt, wie er ist. `Children.map` behaelt die Keys der
 * Kinder bei, deshalb bleibt die Listen-Identitaet fuer React intakt.
 *
 * NUR fuer Listen, die sich beim Laden AUFBAUEN. Listen, die sich unter dem
 * Nutzer aendern (Suche, Filter), brauchen <StaggerFlow> — dort muss auch
 * das Verschwinden animiert werden, und das kann diese Huelle nicht.
 */
export function StaggerList({
  children,
  className,
  as = "div",
  ...rest
}: {
  children: ReactNode;
  as?: "div" | "section";
} & HTMLMotionProps<"div">) {
  const { reduced } = useMotionCapability();
  const Plain = as === "section" ? "section" : "div";
  if (reduced) return <Plain className={className}>{children}</Plain>;

  return (
    <Stagger as={as} className={className} {...rest}>
      {Children.map(children, (child) =>
        isValidElement(child) ? <StaggerItem>{child}</StaggerItem> : child
      )}
    </Stagger>
  );
}
