"use client";

/**
 * Generische DeepFight-Profilansicht — derselbe Basis-Aufbau für alle drei
 * Profilarten (Gegner, Schüler, Trainer): Split → Auto-Insights → Technik-
 * Statistik → DNA-Kategorien. Der Kontext-Rahmen (Kopf, Framing, Aktionen)
 * kommt von der einbettenden Seite; OpponentProfileView bleibt die
 * Scouting-Variante mit Gegner-Kopf.
 */

import type { GegnerDnaAnswers } from "@/lib/gegner-dna";
import type { ActionStat, DnaSplit } from "@/lib/fight-stats";
import DnaCategoryGrid from "./DnaCategoryGrid";
import FightDnaSplit from "./FightDnaSplit";
import FightStatsBlock from "./FightStatsBlock";
import FightInsights from "./FightInsights";

export default function FightProfileView({
  dna,
  dnaSplit,
  actionStats,
}: {
  dna: GegnerDnaAnswers;
  dnaSplit?: DnaSplit | null;
  actionStats?: ActionStat[];
}) {
  const stats = actionStats ?? [];
  return (
    <div className="flex flex-col gap-4">
      <FightDnaSplit split={dnaSplit} />
      <FightInsights split={dnaSplit} stats={stats} />
      <FightStatsBlock stats={stats} />
      <DnaCategoryGrid answers={dna} />
    </div>
  );
}
