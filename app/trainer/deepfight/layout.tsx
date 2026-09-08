"use client";

/**
 * Bereichs-Layout von DeepFight — es färbt, es bewegt, es ordnet.
 *
 * DREI DINGE, ALLE HIER UND NIRGENDS SONST (Leons Neuaufbau, Teilschritt 2,
 * 07.09.2026):
 *
 *  1. `data-area="deepfight"` + `data-modus` — die Bereichsfärbung
 *     (globals.css, „Der DeepFight-Bereich"). Der Modus kommt aus dem
 *     Context (components/deepfight/deepfight-modus.tsx): Die Landung setzt
 *     ihn mit der Ziel-Auswahl, die Bibliotheken bekommen ihn aus der
 *     Adresse.
 *  2. Die bewegte Schicht (components/ui/Synthesis.tsx), EINMAL gemountet,
 *     fixiert hinter allem — wie `.shell-ambient`, nur für diesen Bereich.
 *     Drei Seiten mit je eigener Schicht hätten bei jedem Wechsel neu
 *     aufgebaut und geflackert.
 *  3. Die Glas-Leiste mit den drei Segmenten, auf den drei Hauptrouten. Die
 *     Detailseiten (ein Gegner, ein Athlet) tragen stattdessen ihren
 *     Zurück-Weg im Seitenkopf.
 *
 * WARUM EIN CLIENT-LAYOUT, anders als app/admin/layout.tsx: Der Modus ist
 * Zustand, und der lebt in React. Die Falle aus CLAUDE.md („redirect() unter
 * einem Client-Layout greift nicht") trifft nicht — Adressen ziehen über
 * next.config.mjs um, keine Seite hier ruft redirect() auf.
 *
 * FALLE 17 (globals.css, `.staff-content > [data-area] > main`): Mit dieser
 * Hülle ist das <main> der Seite kein direktes Kind der Stab-Hülle mehr. Die
 * Regel deckt genau diesen Fall ab und schaltet den deckenden Seitengrund
 * ab — sonst schnitte er die Schicht quer über die Inhaltsspalte ab.
 */

import DeepFightLeiste from "@/components/deepfight/DeepFightLeiste";
import {
  DeepFightModusProvider,
  useDeepFightModus,
} from "@/components/deepfight/deepfight-modus";
import Synthesis from "@/components/ui/Synthesis";
import { usePathname } from "next/navigation";

const HAUPTROUTEN = new Set([
  "/trainer/deepfight",
  "/trainer/deepfight/gegner",
  "/trainer/deepfight/athleten",
]);

function Bereich({ children }: { children: React.ReactNode }) {
  const { modus } = useDeepFightModus();
  const pathname = usePathname();
  const mitLeiste = HAUPTROUTEN.has(pathname);

  return (
    <div data-area="deepfight" data-modus={modus} className="relative flex-1">
      {/* Fixiert hinter allem (.df-schicht in globals.css, z-index −1 im
          Stapelkontext der Hülle). Synthesis selbst ist absolut und füllt
          diesen Rahmen; der Rahmen hält sie am Fenster fest. */}
      <div className="df-schicht" aria-hidden>
        <Synthesis modus={modus} />
      </div>

      {mitLeiste && (
        <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:pt-1">
          <DeepFightLeiste />
        </div>
      )}
      {children}
    </div>
  );
}

export default function DeepFightLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DeepFightModusProvider>
      <Bereich>{children}</Bereich>
    </DeepFightModusProvider>
  );
}
