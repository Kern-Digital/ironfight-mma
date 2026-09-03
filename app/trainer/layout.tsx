"use client";

import TrainerRoute from "@/components/TrainerRoute";
import TrainerSubnav from "@/components/trainer/TrainerSubnav";

/**
 * Layout für den gesamten Trainerbereich: Guard + Bereichs-Navigation an
 * EINER Stelle — die einzelnen Seiten brauchen kein eigenes <TrainerRoute>.
 *
 * Die Leiste steht seit Checkpoint 3 wieder BEDINGUNGSLOS. Solange die
 * Verwaltungs-Seiten hier unten lagen, konnte eine reine Verwaltung ohne
 * Trainer-Häkchen im Trainerbereich landen — die Leiste hätte ihr dann
 * ausschließlich Ansichten angeboten, die die Firestore-Regeln ihr verwehren,
 * und musste deshalb ausgeblendet werden. Der Umzug nach `/verwaltung` hat
 * diesen Fall abgeschafft: Wer hier ankommt, ist Trainer (`TrainerRoute`).
 */
export default function TrainerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TrainerRoute>
      {/* Am Desktop ist die Leiste seit der Sidebar-Hülle überflüssig: ihre
          fünf Punkte stehen links im Menü, und dieselbe Liste zweimal auf
          einer Seite ordnet nichts mehr. Auf dem Handy bleibt sie vorerst
          stehen — Leon will erst die Schublade sehen und dann entscheiden
          (01.09.2026). Danach fällt entweder dieses `lg:hidden` weg oder die
          Leiste ganz. */}
      <div className="lg:hidden">
        <TrainerSubnav />
      </div>
      {children}
    </TrainerRoute>
  );
}
