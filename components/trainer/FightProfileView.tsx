"use client";

/**
 * Generische DeepFight-Profilansicht — derselbe Basis-Aufbau für alle drei
 * Profilarten (Gegner, Schüler, Trainer). Seit 2026-08-22: EINE Karte (neues
 * Token-System, Muster „Liste = eine Karte mit Haarlinien") mit zwei festen,
 * IMMER sichtbaren Blöcken — Fight-DNA-Split und Käfig-Karte („Wo passiert
 * die Aktion") — und darunter aufklappbaren Punkten (Auto-Insights,
 * Technik-Statistik, Kampf-DNA) mit Kurzfazit in der Zeile. Höchstens ein
 * Punkt zugleich geöffnet, Start zugeklappt. Die Innen-Blöcke rendern
 * `frameless` (Fläche + Rahmen liefert die Karte); OpponentProfileView/
 * OpponentEditor nutzen sie weiter gerahmt im alten Look.
 */

import { Fragment, useState } from "react";
import Icon, { type IconName } from "@/components/ui/Icon";
import {
  dnaCompleteness,
  totalAnswered,
  type GegnerDnaAnswers,
} from "@/lib/gegner-dna";
import {
  actionTotals,
  deriveSuggestions,
  deriveTendencies,
  hasActionData,
  isDnaSplitEmpty,
  zoneDistribution,
  type ActionStat,
  type DnaSplit,
} from "@/lib/fight-stats";
import DnaCategoryGrid from "./DnaCategoryGrid";
import FightDnaSplit from "./FightDnaSplit";
import FightStatsBlock from "./FightStatsBlock";
import FightInsights from "./FightInsights";

// Meta-Typo der Zeilen (Muster der Kampfprofil-Listen)
const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

type Block = {
  id: string;
  icon: IconName;
  title: string;
  sub: string;
  content: React.ReactNode;
  /** undefined = fester Block (immer offen, keine Klapp-Mechanik) */
  summary?: string;
};

function BlockHeader({ block }: { block: Block }) {
  return (
    <>
      <span style={{ color: "var(--accent-2)", flexShrink: 0, lineHeight: 0 }}>
        <Icon name={block.icon} size={18} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate" style={{ font: "var(--type-body-strong)" }}>
          {block.title}
        </span>
        <span style={{ ...META_FONT, color: "var(--text-3)" }}>{block.sub}</span>
      </span>
    </>
  );
}

export default function FightProfileView({
  dna,
  dnaSplit,
  actionStats,
}: {
  dna: GegnerDnaAnswers;
  dnaSplit?: DnaSplit | null;
  actionStats?: ActionStat[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const stats = actionStats ?? [];
  const blocks: Block[] = [];

  // ── Feste Blöcke (immer sichtbar) ──────────────────────────────────────────
  if (dnaSplit && !isDnaSplitEmpty(dnaSplit)) {
    blocks.push({
      id: "split",
      icon: "chart",
      title: "Fight-DNA",
      sub: "Verteilung der Kampfbereiche",
      content: <FightDnaSplit split={dnaSplit} frameless />,
    });
  }

  const zones = zoneDistribution(stats);
  const zoneTotal = zones.center + zones.open + zones.cage;
  if (zoneTotal > 0) {
    blocks.push({
      id: "zones",
      icon: "mat",
      title: "Wo passiert die Aktion",
      sub: "Anteil der Aktionen nach Käfig-Zone",
      content: <FightInsights split={dnaSplit} stats={stats} frameless only="zones" />,
    });
  }

  // ── Aufklappbare Punkte ────────────────────────────────────────────────────
  const hintCount =
    deriveTendencies(stats).length + deriveSuggestions(dnaSplit, stats).length;
  if (hintCount > 0) {
    blocks.push({
      id: "insights",
      icon: "spark",
      title: "Auto-Insights",
      sub: "Abgeleitet aus Split und Statistik",
      summary: `${hintCount} Hinweise`,
      content: (
        <FightInsights split={dnaSplit} stats={stats} frameless only="insights" />
      ),
    });
  }

  const techCount = stats.filter(hasActionData).length;
  if (techCount > 0) {
    const totals = actionTotals(stats);
    blocks.push({
      id: "stats",
      icon: "target",
      title: "Technik-Statistik",
      sub: "Gezählt aus den KI-Video-Analysen",
      summary: `${techCount} Techniken · ${Math.round(totals.rate * 100)} %`,
      content: <FightStatsBlock stats={stats} frameless />,
    });
  }

  if (totalAnswered(dna) > 0) {
    blocks.push({
      id: "dna",
      icon: "shield",
      title: "Kampf-DNA",
      sub: "Beobachtungen in 9 Kategorien",
      summary: `${dnaCompleteness(dna)} %`,
      content: <DnaCategoryGrid answers={dna} frameless />,
    });
  }

  if (blocks.length === 0) return null;

  return (
    <div className="t-card-fight px-3.5 py-0.5">
      {blocks.map((b, i) => {
        const fixed = b.summary === undefined;
        const open = fixed || openId === b.id;
        return (
          <Fragment key={b.id}>
            {i > 0 && (
              <div aria-hidden style={{ height: "1px", background: "var(--line)" }} />
            )}
            {fixed ? (
              <div className="flex min-h-hit w-full items-center gap-3 py-3">
                <BlockHeader block={b} />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setOpenId(open ? null : b.id)}
                aria-expanded={open}
                className="t-interactive flex min-h-hit w-full items-center gap-3 rounded-badge py-3 text-left"
              >
                <BlockHeader block={b} />
                <span
                  className="shrink-0 text-right"
                  style={{ ...META_FONT, color: "var(--text-2)" }}
                >
                  {b.summary}
                </span>
                <span
                  className="shrink-0"
                  style={{
                    color: "var(--text-3)",
                    transform: open ? "rotate(180deg)" : "none",
                    transition: "transform var(--dur-fast) var(--ease-out)",
                    lineHeight: 0,
                  }}
                >
                  <Icon name="chevron-down" size={16} strokeWidth={2.4} />
                </span>
              </button>
            )}
            {open && <div className="pb-4 pt-1">{b.content}</div>}
          </Fragment>
        );
      })}
    </div>
  );
}
