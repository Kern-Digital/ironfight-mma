"use client";

import { motion } from "framer-motion";
import { useMotionCapability } from "./useMotionCapability";

/**
 * Ein Abschnitt fließt herein, sobald er in den Blick scrollt — das dritte
 * Prinzip des MOTION-BRIEFs („Auftreten in Wellen") auf Abschnittsebene,
 * während `Stagger` es innerhalb einer Liste macht.
 *
 * Lag bis 04.09.2026 unter `components/dashboard/` und fasste framer-motion
 * direkt an. Der Baustein gehört aber in die Schicht: Er IST Bewegung, und
 * hier prüft ein Ort die Reduced-Motion-Sperre für alle vier Aufrufer
 * (Start, Dashboard, Admin-Nutzer).
 *
 * `once: true` ist Absicht — ein Abschnitt, der bei jedem Vorbeiscrollen neu
 * hereinfließt, wird auf der langen Startseite zur Zappelei.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  /** Sekunden Vorsprung für den nächsten Abschnitt (Wellen-Effekt). */
  delay?: number;
  className?: string;
}) {
  const { reduced } = useMotionCapability();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 0.8, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default Reveal;
