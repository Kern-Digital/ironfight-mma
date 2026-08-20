"use client";

import {
  ACTION_CATALOG,
  ACTION_GROUP_META,
  CAGE_ZONE_LABEL,
  actionTotals,
  hasActionData,
  statsByGroup,
  successRate,
  type ActionStat,
} from "@/lib/fight-stats";

/**
 * §2 Action-Stats — gezählte Techniken pro Gegner.
 *
 * Reine Anzeige: nur erfasste Techniken, gruppiert mit Trefferquote-Balken.
 * Die Zahlen stammen ausschließlich aus der KI-Video-Analyse (Versuche/
 * Treffer werden beim Übernehmen aufsummiert, Zone/Setup ergänzt) — die
 * manuelle Tally-Eingabe wurde 2026-08-20 bewusst entfernt. Korrektur
 * falscher Zählungen: siehe Backlog "Neuberechnung aus allen Analysen".
 */
export default function FightStatsBlock({ stats }: { stats: ActionStat[] }) {
  const grouped = statsByGroup(stats);
  if (grouped.length === 0) return null;

  return (
    <div>
      <div
        className="font-mono-ta mb-3 text-[10px] font-bold uppercase"
        style={{ letterSpacing: "0.2em", color: "var(--ta-pink)" }}
      >
        Technik-Statistik
      </div>
      <div className="flex flex-col gap-4">
        {grouped.map(({ group, stats: gs }) => {
          const meta = ACTION_GROUP_META[group];
          const totals = actionTotals(gs);
          return (
            <div key={group}>
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ background: meta.color }}
                />
                <span
                  className="font-display-ta font-black uppercase"
                  style={{ fontSize: "12px", letterSpacing: "0.08em", color: "var(--fg-2)" }}
                >
                  {meta.label}
                </span>
                <span
                  className="font-mono-ta text-[10px] uppercase"
                  style={{ letterSpacing: "0.1em", color: "var(--fg-4)" }}
                >
                  {totals.landed}/{totals.attempted} · {Math.round(totals.rate * 100)}%
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {gs
                  .filter(hasActionData)
                  .sort((a, b) => b.attempted - a.attempted)
                  .map((s) => (
                    <StatRow key={s.id} stat={s} color={meta.color} />
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatRow({ stat, color }: { stat: ActionStat; color: string }) {
  const rate = successRate(stat);
  const meta: string[] = [];
  if (stat.zone) meta.push(CAGE_ZONE_LABEL[stat.zone]);
  if (stat.setup) meta.push(`Setup: ${stat.setup}`);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm" style={{ color: "var(--fg-1)" }}>
          {actionLabelLocal(stat.id)}
        </span>
        <span
          className="font-mono-ta text-[11px]"
          style={{ color: "var(--fg-3)" }}
        >
          {stat.landed}/{stat.attempted}
          <span style={{ color: "var(--fg-4)" }}> · {Math.round(rate * 100)}%</span>
        </span>
      </div>
      <div
        className="mt-1 h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: "var(--ink-4)" }}
      >
        <div
          style={{
            width: `${Math.round(rate * 100)}%`,
            height: "100%",
            background: color,
            transition: "width 0.3s ease",
          }}
        />
      </div>
      {meta.length > 0 && (
        <div
          className="font-mono-ta mt-1 text-[10px]"
          style={{ letterSpacing: "0.08em", color: "var(--fg-4)" }}
        >
          {meta.join(" · ")}
        </div>
      )}
    </div>
  );
}

// Lokaler Label-Lookup (vermeidet zusätzlichen Import in der Render-Hot-Path).
function actionLabelLocal(id: string): string {
  return ACTION_CATALOG.find((a) => a.id === id)?.label ?? id;
}
