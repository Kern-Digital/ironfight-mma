"use client";

import Link from "next/link";
import { FIGHT_STYLE_LABEL, type FightCamp } from "@/lib/fight-camp";
import { resolveCampOpponent, type Opponent } from "@/lib/opponents";
import { totalAnswered } from "@/lib/gegner-dna";

function formatDate(d: Date): string {
  return d.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Zeitlicher/Status-Bezug eines Wettkampfs — für Karten & Gruppierung. */
export type CompetitionGroup = "upcoming" | "past" | "archived";

export function competitionGroup(camp: FightCamp): CompetitionGroup {
  if (camp.status === "archived") return "archived";
  const isPast = camp.competitionDate.getTime() < Date.now();
  if (camp.status === "completed" || isPast) return "past";
  return "upcoming";
}

const GROUP_ACCENT: Record<CompetitionGroup, string> = {
  upcoming: "var(--ta-cyan)",
  past: "var(--fg-4)",
  archived: "#9D7BFA",
};

export default function CompetitionCard({
  camp,
  studentLabel,
  href,
  opponent,
}: {
  camp: FightCamp;
  studentLabel: string;
  href: string;
  /**
   * Verknüpftes DeepFight-Profil (falls geladen). Damit zeigt die Karte den
   * aktuellen Scouting-Stand statt nur den eingefrorenen Snapshot — später
   * ergänzte Antworten zählen mit.
   */
  opponent?: Opponent | null;
}) {
  const group = competitionGroup(camp);
  const accent = GROUP_ACCENT[group];
  const { profile, addedDnaCount } = resolveCampOpponent(camp.opponent, opponent);
  const dnaCount = totalAnswered(profile.dna ?? {});
  const days = Math.ceil(
    (camp.competitionDate.getTime() - Date.now()) / (24 * 3600 * 1000),
  );
  const timing =
    group === "upcoming"
      ? days <= 0
        ? "Heute"
        : `in ${days} ${days === 1 ? "Tag" : "Tagen"}`
      : group === "archived"
        ? "Archiviert"
        : "Vergangen";

  return (
    <Link
      href={href}
      className="block rounded-2xl p-4 transition-colors"
      style={{
        background: "linear-gradient(180deg, var(--ink-3), var(--ink-2))",
        border: "1px solid var(--ink-4)",
        textDecoration: "none",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div
            className="font-display-ta truncate font-black uppercase"
            style={{ fontSize: "15px", letterSpacing: "0.03em", color: "var(--fg)" }}
          >
            {camp.competitionName}
          </div>
          <div
            className="font-mono-ta mt-1 truncate text-[10px]"
            style={{ letterSpacing: "0.12em", color: "var(--fg-4)" }}
          >
            {studentLabel} · vs {camp.opponent.name}
          </div>
        </div>
        <span
          className="font-mono-ta shrink-0 rounded-md px-2 py-1 text-[9px] font-bold uppercase"
          style={{
            letterSpacing: "0.12em",
            background: "var(--ink-4)",
            border: `1px solid ${accent}`,
            color: accent,
          }}
        >
          {timing}
        </span>
      </div>

      <div
        className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono-ta text-[10px]"
        style={{ letterSpacing: "0.1em", color: "var(--fg-4)" }}
      >
        <span>{formatDate(camp.competitionDate)}</span>
        <span style={{ color: "var(--fg-3)" }}>
          {FIGHT_STYLE_LABEL[camp.opponent.style]}
        </span>
        <span
          className="rounded px-1.5 py-0.5"
          title={`${dnaCount} beantwortete DeepFight-Fragen`}
          style={{
            background: dnaCount > 0 ? "rgba(35,196,206,0.1)" : "var(--ink-4)",
            border: `1px solid ${dnaCount > 0 ? "rgba(35,196,206,0.35)" : "var(--ink-5)"}`,
            color: dnaCount > 0 ? "var(--ta-cyan)" : "var(--fg-4)",
          }}
        >
          DNA {dnaCount}
        </span>
        {addedDnaCount > 0 && (
          <span
            className="rounded px-1.5 py-0.5"
            title="Aus dem verknüpften DeepFight-Profil ergänzt, seit der Wettkampf angelegt wurde"
            style={{
              background: "rgba(157,123,250,0.12)",
              border: "1px solid rgba(157,123,250,0.35)",
              color: "#9D7BFA",
            }}
          >
            +{addedDnaCount} NEU
          </span>
        )}
      </div>
    </Link>
  );
}
