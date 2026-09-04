"use client";

import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import { popVariants, springSoft } from "@/lib/motion";
import { useMotionCapability } from "./useMotionCapability";

/**
 * Aufklappen, das die Höhe VERWANDELT statt sie umzuschalten.
 *
 * `height: auto` kann Framer messen und animieren — das ist der
 * Unterschied zwischen einer Karte, die sich öffnet, und einer, die
 * plötzlich größer ist. `overflow: hidden` ist Pflicht, sonst quillt der
 * Inhalt während der Bewegung über die noch kleinere Hülle hinaus.
 */
export function Collapse({
  open,
  children,
  className,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  const { reduced } = useMotionCapability();
  if (reduced) return open ? <div className={className}>{children}</div> : null;

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          className={className}
          style={{ overflow: "hidden" }}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={springSoft}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Panels, Dropdowns, Popover: wachsen aus ihrem Ursprung, statt zu poppen.
 *
 * `originClass` setzt den Ankerpunkt — ein Menü unter einem Knopf soll
 * von OBEN wachsen (`origin-top`), sonst wirkt es wie hingeworfen.
 */
export function Pop({
  open,
  children,
  className,
  originClass = "origin-top",
  ...rest
}: {
  open: boolean;
  children: ReactNode;
  originClass?: string;
} & HTMLMotionProps<"div">) {
  const { reduced } = useMotionCapability();
  // Ohne Bewegung faellt die Huelle weg, aber role/aria/onKeyDown muessen
  // bleiben — sonst verliert das Panel bei reduced-motion seine Bedienung.
  if (reduced) {
    return open ? (
      <div className={className} {...(rest as object)}>
        {children}
      </div>
    ) : null;
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={[className, originClass].filter(Boolean).join(" ")}
          variants={popVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          {...rest}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Zustandswechsel am selben Platz — Knopf wird Eingabefeld, Anzeige wird
 * Formular, Liste wird Detailansicht.
 *
 * `mode="wait"` lässt den alten Zustand erst verschwinden; sonst liegen
 * beide übereinander und die Hülle zuckt. Die Hülle selbst trägt `layout`,
 * misst also ihre neue Größe und federt dorthin — das ist das Dehnen,
 * nicht das Austauschen.
 *
 * `activeKey` MUSS sich bei jedem Zustandswechsel ändern, sonst merkt
 * AnimatePresence nichts.
 */
export function MorphSwap({
  activeKey,
  children,
  className,
  ...rest
}: {
  activeKey: string;
  children: ReactNode;
} & HTMLMotionProps<"div">) {
  const { reduced } = useMotionCapability();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div layout className={className} transition={springSoft} {...rest}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeKey}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.16 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
