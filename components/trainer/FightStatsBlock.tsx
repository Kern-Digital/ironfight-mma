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

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

/**
 * §2 Action-Stats — gezählte Techniken pro Gegner.
 *
 * Reine Anzeige: nur erfasste Techniken, gruppiert mit Trefferquote-Balken.
 * Die Zahlen stammen ausschließlich aus der KI-Video-Analyse (Versuche/
 * Treffer werden beim Übernehmen aufsummiert, Zone/Setup ergänzt) — die
 * manuelle Tally-Eingabe wurde 2026-08-20 bewusst entfernt. Korrektur
 * falscher Zählungen: siehe Backlog „Neuberechnung aus allen Analysen".
 *
 * Rollout-Etappe 3a: `frameless` ist weg, die Kopfzeile gehört dem Aufrufer
 * (Begründung im Kopf von FightDnaSplit.tsx).
 */
export default function FightStatsBlock({ stats }: { stats: ActionStat[] }) {
  const grouped = statsByGroup(stats);
  if (grouped.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {grouped.map(({ group, stats: gs }) => {
        const meta = ACTION_GROUP_META[group];
        const totals = actionTotals(gs);
        return (
          <div key={group}>
            <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              {/* Der Farbpunkt bleibt: Er kommt aus den --cat-*-Slots und
                  bedeutet app-weit dieselbe Disziplin (Regel „Rubrik = immer
                  dieselbe Farbe", lib/discipline-colors.ts). */}
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: meta.color }}
              />
              <span
                style={{ ...META_FONT, color: "var(--text-body)" }}
              >
                {meta.label}
              </span>
              <span
                style={{
                  ...META_FONT,
                  fontVariantNumeric: "tabular-nums",
                  color: "var(--text-3)",
                }}
              >
                {totals.landed}/{totals.attempted} ·{" "}
                {Math.round(totals.rate * 100)}%
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
        {/* Stand hier bis 04.09.2026 auf einem Token namens „fg-1" — das es in
            globals.css NIE gab. Der Text trug damit schlicht die geerbte Farbe
            statt der gemeinten. Jetzt der Fließtext-Token. */}
        <span style={{ font: "var(--type-body)", color: "var(--text-1)" }}>
          {actionLabelLocal(stat.id)}
        </span>
        <span
          style={{
            font: "var(--type-sub)",
            fontVariantNumeric: "tabular-nums",
            color: "var(--text-2)",
          }}
        >
          {stat.landed}/{stat.attempted}
          <span style={{ color: "var(--text-3)" }}>
            {" "}
            · {Math.round(rate * 100)}%
          </span>
        </span>
      </div>
      <div className="t-progress mt-1">
        <span
          style={{
            width: `${Math.round(rate * 100)}%`,
            // Der Balken trägt die DISZIPLIN-Farbe, nicht den Verlauf aus
            // --grad-progress: Er steht in einer Gruppe, die genau diese Farbe
            // schon als Punkt führt, und der Gym-Akzent wäre in allen fünf
            // Gruppen derselbe.
            background: color,
            transition: "width 0.3s ease",
          }}
        />
      </div>
      {meta.length > 0 && (
        <div className="mt-1" style={{ ...META_FONT, color: "var(--text-3)" }}>
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
