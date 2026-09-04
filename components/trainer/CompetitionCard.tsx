"use client";

/**
 * Wettkampf-Karte im Übersichtsraster (`/trainer/competitions`).
 *
 * Rollout-Etappe 2a (04.09.2026): Umzug vom alten Token-System auf das neue —
 * `.t-card` statt Ink-Verlauf, Typo aus den `--type-*`-Tokens statt Barlow mit
 * inline-Pixelgrößen, Farben ausschließlich aus Tokens.
 *
 * DIE GRUPPE TRÄGT KEINE DRITTE FARBE MEHR (Leons Entscheidung 04.09.):
 * „Archiviert" war ein hartkodiertes Violett — dieselbe Farbe, die app-weit
 * DeepFight/KI bedeutet, und die auf DIESEN Karten schon am DNA-Badge hängt.
 * Zwei Bedeutungen nebeneinander in einer Ansicht. Jetzt unterscheidet die
 * FLÄCHE: Geplantes trägt den Gym-Akzent, Vergangenes und Archiviertes einen
 * neutralen Ton, und die Archiv-Karte ist zusätzlich gedimmt. Damit bleibt
 * Violett für das reserviert, was es überall sonst heißt.
 */

import Link from "next/link";
import { FIGHT_STYLE_LABEL, type FightCamp } from "@/lib/fight-camp";
import { resolveCampOpponent, type Opponent } from "@/lib/opponents";
import { dnaCompleteness } from "@/lib/gegner-dna";

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

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

/**
 * Farbe der Gruppen-Überschrift und des Zeit-Chips. Nur zwei Werte für drei
 * Gruppen — siehe Kopfkommentar.
 */
export const GROUP_ACCENT: Record<CompetitionGroup, string> = {
  upcoming: "var(--accent)",
  past: "var(--text-3)",
  archived: "var(--text-3)",
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
  const dnaPct = dnaCompleteness(profile.dna);
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
      data-press="surface"
      className="t-card t-interactive block p-4"
      style={{
        textDecoration: "none",
        color: "inherit",
        // Das Archiv ist abgelegt, nicht weg: gedimmt statt eingefärbt.
        opacity: group === "archived" ? 0.72 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* KEINE VERSALIEN (gemessen 04.09.2026): „Night of Champions" —
              18 Zeichen, ein ganz normaler Name — brach als
              „NIGHT OF CHAMPIO…" ab, auf 1440 px genauso wie auf 390 px.
              Versalien plus Sperrung kosten rund ein Viertel der Breite, und
              ein Wettkampfname ist INHALT, keine Überschrift (Typo-Regel:
              Versalien nur für Überschriften, Labels, Buttons, Badges). */}
          <div className="truncate" style={{ font: "var(--type-h3)" }}>
            {camp.competitionName}
          </div>
          <div
            className="mt-1 truncate"
            style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
          >
            {studentLabel} · vs {camp.opponent.name}
          </div>
        </div>
        <span
          className="shrink-0 rounded-badge px-2 py-1"
          style={{
            ...META_FONT,
            background: "var(--surface-raised)",
            border: `1px solid ${accent}`,
            color: accent,
          }}
        >
          {timing}
        </span>
      </div>

      <div
        className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1"
        style={{ ...META_FONT, color: "var(--text-3)" }}
      >
        <span>{formatDate(camp.competitionDate)}</span>
        <span style={{ color: "var(--text-2)" }}>
          {FIGHT_STYLE_LABEL[camp.opponent.style]}
        </span>
        <span
          className={`rounded-badge px-1.5 py-0.5${dnaPct > 0 ? " t-ai-badge" : ""}`}
          title={`${dnaPct} % des DeepFight-Fragenkatalogs beantwortet`}
          style={
            dnaPct > 0
              ? { color: "var(--ai-text)" }
              : {
                  background: "var(--surface-raised)",
                  border: "1px solid var(--line)",
                  color: "var(--text-3)",
                }
          }
        >
          DNA {dnaPct} %
        </span>
        {addedDnaCount > 0 && (
          <span
            className="rounded-badge px-1.5 py-0.5"
            title="Aus dem verknüpften DeepFight-Profil ergänzt, seit der Wettkampf angelegt wurde"
            style={{
              background: "var(--accent-2-subtle)",
              border:
                "1px solid color-mix(in oklab, var(--accent-2) 40%, transparent)",
              color: "var(--accent-2)",
            }}
          >
            +{addedDnaCount} NEU
          </span>
        )}
      </div>
    </Link>
  );
}
