"use client";

import {
  ACTION_CATALOG,
  ACTION_GROUP_META,
  CAGE_ZONE_LABEL,
  actionTotals,
  hasActionData,
  statsByGroup,
  successRate,
  type ActionGroup,
  type ActionStat,
  type CageZone,
} from "@/lib/fight-stats";

const ZONE_OPTIONS: CageZone[] = ["center", "open", "cage"];

const inputStyle: React.CSSProperties = {
  background: "var(--ink-3)",
  border: "1px solid var(--ink-5)",
  color: "var(--fg-1)",
  outline: "none",
};

/**
 * §2 Action-Stats — gezählte Techniken pro Gegner.
 *
 * mode="edit"  → Tally-Tabelle: je Technik Versuche / Treffer / Zone / Setup.
 * mode="view"  → nur erfasste Techniken mit Trefferquote-Balken (Gegnerbericht).
 */
export default function FightStatsBlock({
  stats,
  mode,
  onChange,
}: {
  stats: ActionStat[];
  mode: "view" | "edit";
  onChange?: (next: ActionStat[]) => void;
}) {
  if (mode === "view") return <StatsView stats={stats} />;
  return <StatsEditor stats={stats} onChange={onChange} />;
}

// ─── Edit ────────────────────────────────────────────────────────────────────

function StatsEditor({
  stats,
  onChange,
}: {
  stats: ActionStat[];
  onChange?: (next: ActionStat[]) => void;
}) {
  const byId = new Map(stats.map((s) => [s.id, s] as const));

  function emit(next: Map<string, ActionStat>) {
    const out: ActionStat[] = [];
    for (const s of Array.from(next.values())) {
      const keep =
        (s.attempted || 0) > 0 ||
        (s.landed || 0) > 0 ||
        !!s.zone ||
        !!(s.setup && s.setup.trim());
      if (keep) out.push(s);
    }
    onChange?.(out);
  }

  function patch(id: string, p: Partial<ActionStat>) {
    const next = new Map(byId);
    const cur = next.get(id) ?? { id, attempted: 0, landed: 0 };
    const merged: ActionStat = { ...cur, ...p, id };
    // Treffer nie über Versuche.
    if ((merged.landed || 0) > (merged.attempted || 0))
      merged.landed = merged.attempted;
    next.set(id, merged);
    emit(next);
  }

  function num(raw: string): number {
    return raw === "" ? 0 : Math.max(0, Math.round(Number(raw) || 0));
  }

  const groups: ActionGroup[] = ["strike", "kick", "takedown", "ground"];

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => {
        const meta = ACTION_GROUP_META[group];
        const actions = ACTION_CATALOG.filter((a) => a.group === group);
        return (
          <div
            key={group}
            className="overflow-hidden rounded-2xl"
            style={{
              background: "linear-gradient(180deg, var(--ink-3), var(--ink-2))",
              border: "1px solid var(--ink-4)",
            }}
          >
            <div
              className="flex items-center gap-2 px-4 py-2.5"
              style={{ borderBottom: "1px solid var(--ink-4)" }}
            >
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
            </div>
            <div className="flex flex-col">
              {actions.map((a, i) => {
                const s = byId.get(a.id);
                return (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center gap-2 px-4 py-2.5"
                    style={{
                      borderTop: i === 0 ? "none" : "1px solid var(--ink-4)",
                    }}
                  >
                    <span
                      className="min-w-[96px] flex-1 text-sm"
                      style={{ color: "var(--fg-2)" }}
                    >
                      {a.label}
                    </span>
                    <label className="flex items-center gap-1">
                      <span
                        className="font-mono-ta text-[9px] uppercase"
                        style={{ letterSpacing: "0.1em", color: "var(--fg-4)" }}
                      >
                        Vers.
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={s?.attempted || ""}
                        onChange={(e) => patch(a.id, { attempted: num(e.target.value) })}
                        placeholder="0"
                        className="w-14 rounded-md px-2 py-1.5 text-sm"
                        style={inputStyle}
                      />
                    </label>
                    <label className="flex items-center gap-1">
                      <span
                        className="font-mono-ta text-[9px] uppercase"
                        style={{ letterSpacing: "0.1em", color: "var(--fg-4)" }}
                      >
                        Treff.
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={s?.landed || ""}
                        onChange={(e) => patch(a.id, { landed: num(e.target.value) })}
                        placeholder="0"
                        className="w-14 rounded-md px-2 py-1.5 text-sm"
                        style={inputStyle}
                      />
                    </label>
                    <select
                      value={s?.zone ?? ""}
                      onChange={(e) =>
                        patch(a.id, {
                          zone: (e.target.value || null) as CageZone | null,
                        })
                      }
                      className="rounded-md px-2 py-1.5 text-xs"
                      style={inputStyle}
                      aria-label={`Zone für ${a.label}`}
                    >
                      <option value="">Zone…</option>
                      {ZONE_OPTIONS.map((z) => (
                        <option key={z} value={z}>
                          {CAGE_ZONE_LABEL[z]}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={s?.setup ?? ""}
                      onChange={(e) => patch(a.id, { setup: e.target.value })}
                      placeholder="Setup…"
                      className="w-full rounded-md px-2 py-1.5 text-xs sm:w-32"
                      style={inputStyle}
                      aria-label={`Setup für ${a.label}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── View ────────────────────────────────────────────────────────────────────

function StatsView({ stats }: { stats: ActionStat[] }) {
  const grouped = statsByGroup(stats);
  if (grouped.length === 0) return null;

  return (
    <div
      className="rounded-2xl p-4 sm:p-5"
      style={{ background: "var(--ink-2)", border: "1px solid var(--ink-4)" }}
    >
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
