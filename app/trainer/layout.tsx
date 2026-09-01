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
      <TrainerSubnav />
      {children}
    </TrainerRoute>
  );
}
