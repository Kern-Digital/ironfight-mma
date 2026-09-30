"use client";

import Link from "next/link";
import Icon, { type IconName } from "@/components/ui/Icon";
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
import { dnaCompleteness } from "@/lib/gegner-dna";
import { resolveCampOpponent, type Opponent } from "@/lib/opponents";

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

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

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
      className="grid items-center gap-3 px-4 py-2.5"
      style={{ gridTemplateColumns: "1fr auto 1fr" }}
    >
      <div className="min-w-0 break-words" style={{ font: "var(--type-body-strong)", fontSize: "14px" }}>
        {left}
      </div>
      <div className="text-center">
        <div style={{ ...META_FONT, color: "var(--text-3)" }}>{label}</div>
        {delta && (
          <div className="mt-0.5" style={{ font: "var(--type-num)", color: "var(--text-2)" }}>
            {delta.text}
          </div>
        )}
      </div>
      <div
        className="min-w-0 break-words text-right"
        style={{ font: "var(--type-body-strong)", fontSize: "14px" }}
      >
        {right}
      </div>
    </div>
  );
}

function Punkte({
  titel,
  icon,
  punkte,
}: {
  titel: string;
  icon: IconName;
  punkte: { id: string; text: string }[];
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center gap-2">
        <span aria-hidden style={{ color: "var(--text-3)", lineHeight: 0 }}>
          <Icon name={icon} size={16} />
        </span>
        <span className="t-label">{titel}</span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {punkte.map((p) => (
          <li key={p.id} style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
            {p.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

const PILL_CLASS =
  "t-interactive inline-flex min-h-hit items-center gap-2 rounded-pill px-3.5";
const PILL_STYLE: React.CSSProperties = {
  ...META_FONT,
  border: "1px solid var(--line)",
  color: "var(--text-body)",
  textDecoration: "none",
};

// ─── Komponente ──────────────────────────────────────────────────────────────

/**
 * Matchup: eigener Athlet vs. Gegner-DNA des nächsten Wettkampfs.
 * Nutzt den eingefrorenen Opponent-Snapshot des Camps (inkl. Split/Stats) und
 * leitet daraus Bedrohungen + Vorbereitungs-Vorschläge ab (lib/fight-stats).
 *
 * Neue Tokens seit 28.09.2026 (vorher `--ink-*`/`--ta-*`/`font-mono-ta` — das
 * Lila auf der Athletenseite). Farbregel wie im ganzen Wettkampfbereich: die
 * Seite (Athlet/Gegner) trägt keine Farbe, beide Namen stehen in `--text-body`.
 * Farbe trägt nur der Zustand: der Zeit-Chip im Gym-Akzent wie auf der
 * CompetitionCard, die DNA-Anzeige als `.t-ai-badge`. Der Vergleich ist EINE
 * Fläche mit Haarlinien statt fünf gestapelter Balken.
 */
export default function MatchupBlock({
  athleteName,
  athlete,
  camp,
  opponent,
}: {
  athleteName: string;
  athlete?: AthleteProfile;
  camp: FightCamp;
  /** Verknüpftes DeepFight-Profil — ergänzt den Snapshot um neueres Scouting. */
  opponent?: Opponent | null;
}) {
  const { profile: opp, linked, addedDnaCount } = resolveCampOpponent(
    camp.opponent,
    opponent,
  );
  const stats = opp.actionStats ?? [];
  const tendencies = deriveTendencies(stats).slice(0, 3);
  const suggestions = deriveSuggestions(opp.dnaSplit, stats).slice(0, 3);
  const dnaPct = dnaCompleteness(opp.dna);

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
    <div className="t-card p-5">
      {/* Kopf */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 truncate" style={{ ...META_FONT, color: "var(--text-3)" }}>
          Matchup · {camp.competitionName}
        </div>
        <span
          className="shrink-0 rounded-badge px-2 py-1"
          style={{
            ...META_FONT,
            background: "var(--surface-raised)",
            border: "1px solid var(--accent)",
            color: "var(--accent)",
          }}
        >
          {timing}
        </span>
      </div>

      {/* Namen */}
      <div
        className="mt-3 grid items-center gap-3"
        style={{ gridTemplateColumns: "1fr auto 1fr" }}
      >
        <div className="truncate" style={{ font: "var(--type-h3)" }}>
          {athleteName}
        </div>
        <div style={{ ...META_FONT, color: "var(--text-3)" }}>vs</div>
        <div className="truncate text-right" style={{ font: "var(--type-h3)" }}>
          {opp.name}
        </div>
      </div>

      {/* Vergleich */}
      <div
        className="mt-3 overflow-hidden rounded-field"
        style={{ background: "var(--surface-raised)", border: "1px solid var(--line)" }}
      >
        {[
          <CompareRow
            key="stil"
            label="Stil"
            left={athleteStyle}
            right={FIGHT_STYLE_LABEL[opp.style]}
          />,
          <CompareRow
            key="auslage"
            label="Auslage"
            left={athlete?.stance ? FIGHTER_STANCE_LABEL[athlete.stance] : "—"}
            right={FIGHTER_STANCE_LABEL[opp.stance]}
          />,
          <CompareRow
            key="groesse"
            label="Größe"
            left={fmt(athlete?.heightCm, "cm")}
            right={fmt(opp.heightCm, "cm")}
            delta={diff(athlete?.heightCm, opp.heightCm, "cm")}
          />,
          <CompareRow
            key="gewicht"
            label="Gewicht"
            left={fmt(athlete?.weightKg, "kg")}
            right={fmt(opp.weightKg, "kg")}
            delta={diff(athlete?.weightKg, opp.weightKg, "kg")}
          />,
          <CompareRow
            key="reichweite"
            label="Reichweite"
            left={fmt(athlete?.reachCm, "cm")}
            right={fmt(opp.reachCm, "cm")}
            delta={diff(athlete?.reachCm, opp.reachCm, "cm")}
          />,
        ].map((row, i) => (
          <div key={i} style={i > 0 ? { borderTop: "1px solid var(--line)" } : undefined}>
            {row}
          </div>
        ))}
      </div>

      {missingAthleteData && (
        <p className="mt-2" style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
          Größe, Gewicht, Reichweite und Auslage des Athleten im
          Athleten-Profil pflegen, um den Vergleich zu vervollständigen.
        </p>
      )}

      {/* Bedrohungen & Vorbereitung aus der Gegner-DNA */}
      {tendencies.length === 0 && suggestions.length === 0 ? (
        <p className="mt-4" style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
          Noch keine Technik-Statistik zum Gegner erfasst — Bedrohungen und
          Drill-Vorschläge erscheinen, sobald das DeepFight-Profil Zahlen enthält.
        </p>
      ) : (
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {tendencies.length > 0 && (
            <Punkte titel="Hauptgefahren" icon="shield" punkte={tendencies} />
          )}
          {suggestions.length > 0 && (
            <Punkte titel="Vorbereitung" icon="target" punkte={suggestions} />
          )}
        </div>
      )}

      {/* Aktionen */}
      <div
        className="mt-5 flex flex-wrap items-center gap-2 border-t pt-4"
        style={{ borderColor: "var(--line)" }}
      >
        <Link
          href={`/trainer/competitions/${camp.studentUid}/${camp.id}`}
          data-press
          className={PILL_CLASS}
          style={PILL_STYLE}
        >
          Wettkampf öffnen
        </Link>
        {camp.opponentId && (
          <Link
            href={`/trainer/deepfight/gegner/${camp.opponentId}`}
            data-press
            className={PILL_CLASS}
            style={PILL_STYLE}
          >
            DeepFight-Profil öffnen
          </Link>
        )}
        <span
          className={`ml-auto rounded-badge px-1.5 py-0.5${dnaPct > 0 ? " t-ai-badge" : ""}`}
          style={{
            ...META_FONT,
            ...(dnaPct > 0
              ? { color: "var(--ai-text)" }
              : {
                  background: "var(--surface-raised)",
                  border: "1px solid var(--line)",
                  color: "var(--text-3)",
                }),
          }}
        >
          DNA {dnaPct} % ·{" "}
          {linked
            ? addedDnaCount > 0
              ? `Profil verknüpft (+${addedDnaCount})`
              : "Profil verknüpft"
            : "Snapshot"}
        </span>
      </div>
    </div>
  );
}
