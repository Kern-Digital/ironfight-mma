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

/**
 * DER GESETZTE WERT TRÄGT SEINEN PFAD MIT SICH — und genau deshalb gibt es
 * hier KEINEN Aufräum-Effekt mehr (gefunden beim Messen von Teilschritt 5,
 * 14.09.2026).
 *
 * DER FEHLER: Der Vorgänger löschte den ausdrücklich gesetzten Wert in einem
 * `useEffect` auf `pathname`. Beim ERSTEN Mounten laufen Kind-Effekte vor
 * Eltern-Effekten — die Analyse-Seite setzte „gegner", der Provider löschte
 * es unmittelbar danach, und der Rückfall aus dem Pfad sagte „leute". Wer
 * `/trainer/deepfight/analyse?modus=gegner&ziel=…` DIREKT aufrief (Lesezeichen,
 * weitergeschickter Link, F5), sah den Gegner in Tidal-Blau statt in Silber —
 * die ganze Farbidentität des Modus fiel weg. Über die Umleitung von der
 * Landung stimmte es, weil beim Pfadwechsel im laufenden Client die
 * Reihenfolge anders greift; im normalen Klickweg fiel es deshalb nie auf.
 *
 * WARUM NICHT „nur beim echten Pfadwechsel löschen": Das heilt den ersten
 * Aufruf, aber nicht den Wechsel von der Bibliothek auf `/analyse` — dort
 * setzt das Kind erst „gegner" und der Eltern-Effekt löscht es danach. Jede
 * Lösung, die auf der Reihenfolge zweier Effekte beruht, ist an dieser Stelle
 * eine Wette.
 *
 * WARUM NICHT `useSearchParams` im Rückfall: Das wäre die zweite naheliegende
 * Antwort (`?modus=` mitlesen), zieht aber den ganzen Bereich in die
 * CSR-Ausnahme von Next, weil der Provider im Layout ÜBER jeder
 * Suspense-Grenze sitzt.
 *
 * DIE LÖSUNG braucht gar keinen Effekt: Der gesetzte Wert merkt sich, für
 * WELCHEN Pfad er gilt. Stimmt der Pfad nicht mehr, wird er ignoriert und
 * der Rückfall greift — die Gegner-Bibliothek steht also weiterhin nicht im
 * Blau der zuletzt gewählten Athletin. Kein Aufräumen, keine Reihenfolge,
 * kein Rennen.
 */
export function DeepFightModusProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [gesetzt, setGesetzt] = useState<{
    pfad: string;
    modus: DeepFightModus;
  } | null>(null);

  const setModus = useCallback(
    (m: DeepFightModus) => setGesetzt({ pfad: pathname, modus: m }),
    [pathname],
  );
  const value = useMemo(
    () => ({
      modus:
        gesetzt?.pfad === pathname ? gesetzt.modus : modusAusPfad(pathname),
      setModus,
    }),
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
