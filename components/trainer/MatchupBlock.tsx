"use client";

import Link from "next/link";
import {
  FIGHTER_STANCE_LABEL,
  FIGHT_STYLE_LABEL,
  type FightCamp,
} from "@/lib/fight-camp";
import { DISCIPLINE_LABEL, type AthleteProfile } from "@/lib/types";
import {
  deriveSuggestions,
  deriveTendencies,
} from "@/lib/fight-stats";
import { totalAnswered } from "@/lib/gegner-dna";

// ─── Helfer ──────────────────────────────────────────────────────────────────

function fmt(value: number | null | undefined, unit: string): string {
  return typeof value === "number" && value > 0 ? `${value} ${unit}` : "—";
}

/** Vorzeichenbehaftete Differenz Gegner − Athlet (nur wenn beide Werte da sind). */
function diff(
  athlete: number | null | undefined,
  opponent: number | null | undefined,
  unit: string,
): { text: string; advantage: "athlete" | "opponent" } | null {
  if (
    typeof athlete !== "number" ||
    athlete <= 0 ||
    typeof opponent !== "number" ||
    opponent <= 0 ||
    athlete === opponent
  )
    return null;
  const d = opponent - athlete;
  return {
    text: `${d > 0 ? "+" : "−"}${Math.abs(d)} ${unit}`,
    advantage: d > 0 ? "opponent" : "athlete",
  };
}

function CompareRow({
  label,
  left,
  right,
  delta,
}: {
  label: string;
  left: string;
  right: string;
  delta?: { text: string; advantage: "athlete" | "opponent" } | null;
}) {
  return (
    <div
      className="grid items-center gap-2 rounded-md px-3 py-2"
      style={{
        gridTemplateColumns: "1fr auto 1fr",
        background: "var(--ink-3)",
      }}
    >
      <div className="truncate text-[12px] font-bold" style={{ color: "var(--fg-2)" }}>
        {left}
      </div>
      <div className="text-center">
        <div
          className="font-mono-ta text-[9px] uppercase"
          style={{ letterSpacing: "0.12em", color: "var(--fg-4)" }}
        >
          {label}
        </div>
        {delta && (
          <div
            className="font-mono-ta text-[9px]"
            style={{
              color:
                delta.advantage === "opponent" ? "var(--ta-pink)" : "var(--ta-cyan)",
            }}
          >
            {delta.text}
          </div>
        )}
      </div>
      <div
        className="truncate text-right text-[12px] font-bold"
        style={{ color: "var(--fg-2)" }}
      >
        {right}
      </div>
    </div>
  );
}

// ─── Komponente ──────────────────────────────────────────────────────────────

/**
 * Matchup: eigener Athlet vs. Gegner-DNA des nächsten Wettkampfs.
 * Nutzt den eingefrorenen Opponent-Snapshot des Camps (inkl. Split/Stats) und
 * leitet daraus Bedrohungen + Vorbereitungs-Vorschläge ab (lib/fight-stats).
 */
export default function MatchupBlock({
  athleteName,
  athlete,
  camp,
}: {
  athleteName: string;
  athlete?: AthleteProfile;
  camp: FightCamp;
}) {
  const opp = camp.opponent;
  const stats = opp.actionStats ?? [];
  const tendencies = deriveTendencies(stats).slice(0, 3);
  const suggestions = deriveSuggestions(opp.dnaSplit, stats).slice(0, 3);
  const dnaCount = totalAnswered(opp.dna ?? {});

  const days = Math.ceil(
    (camp.competitionDate.getTime() - Date.now()) / (24 * 3600 * 1000),
  );
  const timing = days <= 0 ? "Heute" : `in ${days} ${days === 1 ? "Tag" : "Tagen"}`;

  const athleteStyle = athlete?.primaryDiscipline
    ? DISCIPLINE_LABEL[athlete.primaryDiscipline]
    : "—";

  const missingAthleteData =
    !athlete ||
    (athlete.heightCm ?? 0) <= 0 ||
    (athlete.weightKg ?? 0) <= 0 ||
    (athlete.reachCm ?? 0) <= 0 ||
    !athlete.stance;

  return (
    <div>
      {/* Kopf */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className="font-mono-ta text-[9px] uppercase"
          style={{ letterSpacing: "0.2em", color: "var(--fg-4)" }}
        >
          Matchup · {camp.competitionName}
        </div>
        <span
          className="font-mono-ta rounded-md px-2 py-1 text-[9px] font-bold uppercase"
          style={{
            letterSpacing: "0.12em",
            background: "var(--ink-4)",
            border: "1px solid var(--ta-cyan)",
            color: "var(--ta-cyan)",
          }}
        >
          {timing}
        </span>
      </div>

      {/* Namen */}
      <div
        className="mt-3 grid items-center gap-2"
        style={{ gridTemplateColumns: "1fr auto 1fr" }}
      >
        <div
          className="font-display-ta truncate font-black uppercase"
          style={{ fontSize: "16px", letterSpacing: "0.03em", color: "var(--ta-cyan)" }}
        >
          {athleteName}
        </div>
        <div
          className="font-display-ta font-black"
          style={{ fontSize: "13px", color: "var(--fg-4)" }}
        >
          VS
        </div>
        <div
          className="font-display-ta truncate text-right font-black uppercase"
          style={{ fontSize: "16px", letterSpacing: "0.03em", color: "var(--ta-pink)" }}
        >
          {opp.name}
        </div>
      </div>

      {/* Vergleich */}
      <div className="mt-3 flex flex-col gap-1.5">
        <CompareRow
          label="Stil"
          left={athleteStyle}
          right={FIGHT_STYLE_LABEL[opp.style]}
        />
        <CompareRow
          label="Auslage"
          left={athlete?.stance ? FIGHTER_STANCE_LABEL[athlete.stance] : "—"}
          right={FIGHTER_STANCE_LABEL[opp.stance]}
        />
        <CompareRow
          label="Größe"
          left={fmt(athlete?.heightCm, "cm")}
          right={fmt(opp.heightCm, "cm")}
          delta={diff(athlete?.heightCm, opp.heightCm, "cm")}
        />
        <CompareRow
          label="Gewicht"
          left={fmt(athlete?.weightKg, "kg")}
          right={fmt(opp.weightKg, "kg")}
          delta={diff(athlete?.weightKg, opp.weightKg, "kg")}
        />
        <CompareRow
          label="Reichweite"
          left={fmt(athlete?.reachCm, "cm")}
          right={fmt(opp.reachCm, "cm")}
          delta={diff(athlete?.reachCm, opp.reachCm, "cm")}
        />
      </div>

      {missingAthleteData && (
        <p
          className="mt-2 text-[11px]"
          style={{ color: "var(--fg-4)" }}
        >
          Größe, Gewicht, Reichweite und Auslage des Schülers im
          Athleten-Profil pflegen, um den Vergleich zu vervollständigen.
        </p>
      )}

      {/* Bedrohungen & Vorbereitung aus der Gegner-DNA */}
      {tendencies.length === 0 && suggestions.length === 0 ? (
        <p className="mt-4 text-[11px]" style={{ color: "var(--fg-4)" }}>
          Noch keine Technik-Statistik zum Gegner erfasst — Bedrohungen und
          Drill-Vorschläge erscheinen, sobald das DeepFight-Profil Zahlen enthält.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {tendencies.length > 0 && (
            <div>
              <div
                className="font-mono-ta mb-1.5 text-[9px] font-bold uppercase"
                style={{ letterSpacing: "0.18em", color: "var(--ta-pink)" }}
              >
                Hauptgefahren
              </div>
              <ul className="flex flex-col gap-1 text-[12px]" style={{ color: "var(--fg-2)" }}>
                {tendencies.map((t) => (
                  <li key={t.id} className="flex gap-1.5">
                    <span style={{ color: "var(--ta-pink)" }}>›</span>
                    {t.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {suggestions.length > 0 && (
            <div>
              <div
                className="font-mono-ta mb-1.5 text-[9px] font-bold uppercase"
                style={{ letterSpacing: "0.18em", color: "var(--ta-cyan)" }}
              >
                Vorbereitung
              </div>
              <ul className="flex flex-col gap-1 text-[12px]" style={{ color: "var(--fg-2)" }}>
                {suggestions.map((s) => (
                  <li key={s.id} className="flex gap-1.5">
                    <span style={{ color: "var(--ta-cyan)" }}>›</span>
                    {s.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Aktionen */}
      <div
        className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3"
        style={{ borderColor: "var(--ink-4)" }}
      >
        <Link
          href={`/trainer/competitions/${camp.studentUid}/${camp.id}`}
          className="btn-secondary px-3 py-1.5 text-[11px]"
        >
          Wettkampf öffnen
        </Link>
        {camp.opponentId && (
          <Link
            href={`/trainer/opponents/${camp.opponentId}`}
            className="btn-secondary px-3 py-1.5 text-[11px]"
          >
            DeepFight-Profil öffnen
          </Link>
        )}
        <span
          className="font-mono-ta ml-auto text-[9px] uppercase"
          style={{ letterSpacing: "0.12em", color: "var(--fg-4)" }}
        >
          DNA {dnaCount} {dnaCount === 1 ? "Eintrag" : "Einträge"} · Snapshot
        </span>
      </div>
    </div>
  );
}
