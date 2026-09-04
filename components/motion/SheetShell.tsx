"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { STACK_LIFT, STACK_SHRINK, springSoft } from "@/lib/motion";
import { useMotionCapability } from "./useMotionCapability";

/**
 * Die Huelle aller Sheets und Modals — Schleier plus Panel.
 *
 * Warum es diese Komponente braucht: Die sieben Sheets der App wuchsen
 * bisher per CSS-Keyframe herein (`animate-slide-up`, `fade-in`) und
 * verschwanden dann OHNE Uebergang, weil der Aufrufer sie mit
 * `{offen && <Sheet/>}` sofort aus dem Baum nahm. Ein Panel, das
 * hereingleitet und wegblinkt, ist halb animiert — und das Wegblinken ist
 * genau der Moment, in dem der Nutzer hinsieht.
 *
 * AnimatePresence kann nur animieren, was es selbst entfernt. Deshalb
 * wandert die Bedingung vom Aufrufer HIER hinein: statt
 * `{offen && <Sheet/>}` heisst es `<Sheet open={offen} …/>`, und das Sheet
 * gibt `open` an diese Huelle weiter.
 *
 * Auf dem Handy sitzt das Panel an der Unterkante und faehrt von dort
 * heraus; ab `sm` steht es mittig und waechst aus seiner Mitte. Deshalb
 * zwei Bewegungen, ausgewaehlt ueber dieselbe Bruchstelle wie das Layout.
 *
 * KARTEI-STAPEL (`stacked`): Liegt ein zweites Sheet vor diesem, stellt
 * es sich wie ein Ordner hinten an — ein Stueck nach oben und etwas
 * schmaler, damit seine Oberkante ueber dem vorderen hervorschaut. Das ist
 * dieselbe Feder wie beim Ein- und Austritt, nur mit anderer Ruhelage:
 * Framer federt von wo auch immer das Panel gerade steht dorthin. Vorher
 * lag der Versatz als CSS-Transition auf einer Extra-Huelle, weil die
 * Keyframe-Einblendung eine Panel-Transform ueberschrieben haette; hier
 * ist beides EINE Bewegung auf EINEM Element.
 */
export function SheetShell({
  open,
  onClose,
  children,
  label,
  panelClassName,
  panelStyle,
  zIndex = 50,
  stacked = false,
  placement = "adaptive",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** aria-label des Dialogs — beschreibt, was hier bearbeitet wird. */
  label: string;
  panelClassName?: string;
  panelStyle?: React.CSSProperties;
  /** Ueber anderen Sheets (Uebungs-Picker ist z-50 → Detail dort 60). */
  zIndex?: number;
  /** Ein weiteres Sheet liegt davor → hinten anstellen (Kartei-Look). */
  stacked?: boolean;
  /**
   * `adaptive` (Standard): mobil Bottom-Sheet, ab `sm` zentriertes Fenster.
   * `bottom`: auf JEDER Breite an der Unterkante in voller Breite — fuer
   * Listen-Popups wie „Meine Workouts", die Leon bewusst so festgelegt hat.
   * Die Bewegung ist dieselbe; nur die Ruhelage im Fenster unterscheidet sich.
   */
  placement?: "adaptive" | "bottom";
}) {
  const { reduced } = useMotionCapability();

  // Ruhelage des Panels: normal oder hinten angestellt. `scaleX` statt
  // `scale`, damit nur die Breite schrumpft — eine Hoehen-Skalierung zoege
  // die Oberkante nach unten und der Stapel waere unsichtbar.
  const ruhe = {
    y: stacked ? STACK_LIFT : 0,
    scaleX: stacked ? STACK_SHRINK : 1,
    opacity: 1,
    scale: 1,
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className={
            placement === "bottom"
              ? "fixed inset-0 flex flex-col justify-end"
              : "fixed inset-0 flex flex-col justify-end sm:items-center sm:justify-center sm:p-6"
          }
          style={{ zIndex }}
          role="dialog"
          aria-modal="true"
          aria-label={label}
        >
          <motion.button
            type="button"
            aria-label="Schließen"
            className="absolute inset-0"
            style={{ background: "var(--overlay)" }}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
          />
          <motion.div
            className={panelClassName}
            style={panelStyle}
            initial={reduced ? false : { y: 24, opacity: 0, scale: 0.985 }}
            animate={ruhe}
            exit={
              reduced
                ? { opacity: 0 }
                : { y: 16, opacity: 0, scale: 0.985 }
            }
            transition={reduced ? { duration: 0 } : springSoft}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/**
 * Haelt den letzten echten Wert fest, waehrend ein Sheet ausfaehrt.
 *
 * Sheets, die ein Detail zeigen (`member`, `invite`, `entry`), bekommen es
 * vom Aufrufer als `X | null`: beim Schliessen setzt der Aufrufer null, und
 * das Panel waere fuer die Dauer der Austritts-Feder LEER — es faehrt als
 * weisser Kasten hinaus. Dieser Haken gibt waehrenddessen den letzten Wert
 * zurueck, sodass der Inhalt bis zum Schluss steht.
 *
 *     const zeigen = useLetzterWert(member);
 *     <SheetShell open={!!member}>{zeigen && <Inhalt member={zeigen} />}</SheetShell>
 */
export function useLetzterWert<T>(wert: T | null | undefined): T | null {
  const letzter = useRef<T | null>(null);
  if (wert != null) letzter.current = wert;
  return wert ?? letzter.current;
}
