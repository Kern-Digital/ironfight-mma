"use client";

/**
 * Der MODUS des DeepFight-Bereichs — wen die Werkbank gerade analysiert.
 *
 * Zwei Werte, nicht drei (Leons Brainstorm 05.09.2026): „Ich selbst" ist
 * kein eigener Fall, ein Trainer analysiert sich exakt wie einen Athleten.
 * Also „unsere Leute" gegen „Gegner". Der Modus entscheidet über genau zwei
 * Dinge, beide in globals.css: die Farbe der bewegten Schicht (Tidal-Blau
 * gegen Silber) und ob die Akzent-Familie neutral wird
 * (`[data-area="deepfight"][data-modus="gegner"]`).
 *
 * WARUM EIN CONTEXT UND KEIN PROP: Das Attribut sitzt am Bereichs-Layout,
 * weil dort die Schicht EINMAL gemountet ist — der Wert entsteht aber auf der
 * Landung, in der Ziel-Auswahl. Das Layout kennt seine Seiten nicht; der
 * Context ist der Draht dazwischen. Die Bibliotheken setzen nichts: Für sie
 * leitet das Layout den Modus aus der Adresse ab (/gegner → Gegner).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type { SynthesisModus } from "@/components/ui/Synthesis";

export type DeepFightModus = SynthesisModus;

interface ModusContext {
  modus: DeepFightModus;
  /** Setzt den Modus ausdrücklich — die Landung tut das mit der Ziel-Auswahl. */
  setModus: (m: DeepFightModus) => void;
}

const Ctx = createContext<ModusContext | null>(null);

/** Was die Adresse über den Modus sagt, solange keine Seite etwas setzt. */
function modusAusPfad(pathname: string): DeepFightModus {
  return pathname.startsWith("/trainer/deepfight/gegner") ? "gegner" : "leute";
}

export function DeepFightModusProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Ausdrücklich gesetzter Wert. Er gilt nur für die Seite, die ihn gesetzt
  // hat — ein Seitenwechsel löscht ihn, sonst stünde die Gegner-Bibliothek
  // im Blau der zuletzt gewählten Athletin.
  const [gesetzt, setGesetzt] = useState<DeepFightModus | null>(null);
  useEffect(() => setGesetzt(null), [pathname]);

  const setModus = useCallback((m: DeepFightModus) => setGesetzt(m), []);
  const value = useMemo(
    () => ({ modus: gesetzt ?? modusAusPfad(pathname), setModus }),
    [gesetzt, pathname, setModus],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDeepFightModus(): ModusContext {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error(
      "useDeepFightModus braucht das Layout des DeepFight-Bereichs (app/trainer/deepfight/layout.tsx).",
    );
  }
  return ctx;
}
