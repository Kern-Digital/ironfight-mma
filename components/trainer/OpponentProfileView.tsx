"use client";

import {
  FIGHTER_STANCE_LABEL,
  FIGHT_STYLE_LABEL,
  type FighterStance,
  type FightStyle,
} from "@/lib/fight-camp";
import type { GegnerDnaAnswers } from "@/lib/gegner-dna";
import type { ActionStat, DnaSplit } from "@/lib/fight-stats";
import DnaCategoryGrid from "./DnaCategoryGrid";
import FightDnaSplit from "./FightDnaSplit";
import FightStatsBlock from "./FightStatsBlock";
import FightInsights from "./FightInsights";

// ── Kleine Marker-Icons (keine Emoji) ──────────────────────────────────────
function MarkUp() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 19V6" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}
function MarkDown() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5v13" />
      <path d="M5 12l7 7 7-7" />
    </svg>
  );
}
function MarkStar() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden>
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" />
    </svg>
  );
}

function MarkerRow({
  icon,
  color,
  text,
}: {
  icon: React.ReactNode;
  color: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-1.5">
      <span style={{ color, flexShrink: 0, marginTop: "2px", lineHeight: 0 }}>
        {icon}
      </span>
      <span style={{ color: "var(--fg-2)" }}>{text}</span>
    </div>
  );
}

export interface OpponentView {
  name: string;
  style: FightStyle;
  stance: FighterStance;
  heightCm?: number | null;
  weightKg?: number | null;
  reachCm?: number | null;
  strengths?: string[];
  weaknesses?: string[];
  favoriteAttacks?: string[];
  notes?: string | null;
  dna?: GegnerDnaAnswers;
  dnaSplit?: DnaSplit | null;
  actionStats?: ActionStat[];
}

/** Teilansicht des Gegnerberichts (für die Tab-Darstellung im Gegner-Detail). */
export type OpponentViewSection = "all" | "overview" | "dna" | "stats";

/**
 * Read-only Gegnerbericht: Gegnerprofil-Zusammenfassung + Gegner-DNA in der
 * Profilansicht (nur beantwortete Fragen). Wird im Bibliotheks-Profil und in
 * der Wettkampf-Detailansicht (Snapshot) genutzt.
 *
 * `section` steuert, welcher Teil gerendert wird:
 *   • "all"      — kompletter Bericht (Snapshot-Ansicht im Wettkampf)
 *   • "overview" — Grunddaten + DNA-Split + Auto-Insights (Cockpit)
 *   • "dna"      — qualitativer Gegner-DNA-Accordion
 *   • "stats"    — Technik-Statistik
 */
export default function OpponentProfileView({
  opponent,
  showBasics = true,
  section = "all",
}: {
  opponent: OpponentView;
  /** Grunddaten-Kopf anzeigen (in der Wettkampf-Ansicht oft schon vorhanden). */
  showBasics?: boolean;
  section?: OpponentViewSection;
}) {
  const measures = [
    opponent.heightCm ? `${opponent.heightCm} cm` : null,
    opponent.weightKg ? `${opponent.weightKg} kg` : null,
    opponent.reachCm ? `Reach ${opponent.reachCm} cm` : null,
  ].filter(Boolean);

  const strengths = opponent.strengths ?? [];
  const weaknesses = opponent.weaknesses ?? [];
  const favorites = opponent.favoriteAttacks ?? [];

  const showOverview = section === "all" || section === "overview";
  const showDna = section === "all" || section === "dna";
  const showStats = section === "all" || section === "stats";

  return (
    <div className="flex flex-col gap-4">
      {showOverview && showBasics && (
        <div
          className="rounded-2xl p-4 sm:p-5"
          style={{
            background:
              "radial-gradient(400px 200px at 100% 0%, rgba(255,79,168,0.12), transparent 60%), linear-gradient(160deg, var(--ink-3), var(--ink-2))",
            border: "1px solid rgba(255,79,168,0.3)",
          }}
        >
          <div
            className="font-mono-ta text-[9px] uppercase"
            style={{ letterSpacing: "0.2em", color: "var(--ta-pink)" }}
          >
            Gegner
          </div>
          <div
            className="font-display-ta mt-1 font-black uppercase"
            style={{ fontSize: "20px", letterSpacing: "0.03em" }}
          >
            {opponent.name}
          </div>
          <div
            className="font-mono-ta mt-1 text-[11px]"
            style={{ color: "var(--fg-3)" }}
          >
            {FIGHT_STYLE_LABEL[opponent.style]} ·{" "}
            {FIGHTER_STANCE_LABEL[opponent.stance]}
          </div>
          {measures.length > 0 && (
            <div
              className="font-mono-ta mt-1 text-[11px]"
              style={{ color: "var(--fg-4)" }}
            >
              {measures.join(" · ")}
            </div>
          )}

          {(strengths.length > 0 ||
            weaknesses.length > 0 ||
            favorites.length > 0 ||
            opponent.notes) && (
            <div className="mt-3 flex flex-col gap-1.5 text-xs">
              {strengths.length > 0 && (
                <MarkerRow
                  icon={<MarkUp />}
                  color="var(--ta-cyan)"
                  text={strengths.join(", ")}
                />
              )}
              {weaknesses.length > 0 && (
                <MarkerRow
                  icon={<MarkDown />}
                  color="var(--ta-pink)"
                  text={weaknesses.join(", ")}
                />
              )}
              {favorites.length > 0 && (
                <MarkerRow
                  icon={<MarkStar />}
                  color="#8A63E8"
                  text={favorites.join(", ")}
                />
              )}
              {opponent.notes && (
                <div
                  className="mt-1 italic"
                  style={{ color: "var(--fg-4)", fontSize: "11px" }}
                >
                  &bdquo;{opponent.notes}&ldquo;
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showOverview && (
        <>
          {/* §1 Fight-DNA-Split */}
          <FightDnaSplit split={opponent.dnaSplit} mode="view" />

          {/* §3/§4/§5 Auto-Insights aus den Zahlen */}
          <FightInsights
            split={opponent.dnaSplit}
            stats={opponent.actionStats ?? []}
          />
        </>
      )}

      {/* §2 Technik-Statistik (Detailzahlen) */}
      {showStats && (
        <FightStatsBlock stats={opponent.actionStats ?? []} mode="view" />
      )}

      {showDna && <DnaCategoryGrid answers={opponent.dna ?? {}} />}
    </div>
  );
}
