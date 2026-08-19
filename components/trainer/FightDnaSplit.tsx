"use client";

import {
  DNA_SPLIT_KEYS,
  DNA_SPLIT_META,
  EMPTY_DNA_SPLIT,
  dnaSplitTotal,
  isDnaSplitEmpty,
  normalizeDnaSplit,
  type DnaSplit,
  type DnaSplitKey,
} from "@/lib/fight-stats";

/**
 * §1 Fight-DNA-Split — prozentuale Verteilung der Kampfbereiche.
 *
 * mode="view"  → gestapelter Balken + Legende mit Prozenten (Gegnerbericht).
 * mode="edit"  → 5 Zahlenfelder (0..100) + Live-Vorschau + Summen-Hinweis.
 */
export default function FightDnaSplit({
  split,
  mode,
  onChange,
}: {
  split: DnaSplit | null | undefined;
  mode: "view" | "edit";
  onChange?: (next: DnaSplit) => void;
}) {
  const value = split ?? EMPTY_DNA_SPLIT;
  const norm = normalizeDnaSplit(value);
  const total = dnaSplitTotal(value);
  const empty = isDnaSplitEmpty(value);

  function setKey(k: DnaSplitKey, raw: string) {
    const n = raw === "" ? 0 : Math.max(0, Math.min(100, Math.round(Number(raw) || 0)));
    onChange?.({ ...value, [k]: n });
  }

  // ── View ──
  if (mode === "view") {
    if (empty) return null;
    const activeKeys = DNA_SPLIT_KEYS.filter((k) => norm[k] > 0);
    return (
      <div
        className="rounded-2xl p-4 sm:p-5"
        style={{
          background: "linear-gradient(180deg, var(--ink-2), var(--ink-1))",
          border: "1px solid var(--ink-4)",
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div
            className="font-mono-ta text-[11px] font-bold uppercase"
            style={{ letterSpacing: "0.2em", color: "var(--ta-pink)" }}
          >
            Fight DNA
          </div>
          <span
            className="font-mono-ta flex h-5 w-5 items-center justify-center rounded-full text-[10px]"
            title="Prozentuale Verteilung der Kampfbereiche — vom Trainer eingeschätzt oder aus der Video-Analyse übernommen."
            style={{ border: "1px solid var(--ink-6)", color: "var(--fg-4)" }}
          >
            i
          </span>
        </div>
        <StackedBar norm={norm} />
        <div className="mt-4 flex">
          {activeKeys.map((k, i) => (
            <div
              key={k}
              className="flex flex-1 flex-col items-center gap-1.5 px-1 text-center"
              style={{
                borderLeft: i > 0 ? "1px solid var(--ink-4)" : "none",
              }}
            >
              <span
                className="font-mono-ta font-bold leading-none"
                style={{ fontSize: "clamp(17px, 3.4vw, 24px)", color: "var(--fg)" }}
              >
                {norm[k]}
                <span
                  style={{ fontSize: "0.62em", color: "var(--fg-2)", marginLeft: 1 }}
                >
                  %
                </span>
              </span>
              <span
                aria-hidden
                className="h-[3px] w-8 rounded-full"
                style={{
                  background: DNA_SPLIT_META[k].color,
                  boxShadow: `0 0 8px ${DNA_SPLIT_META[k].color}66`,
                }}
              />
              <span
                className="truncate text-[12px]"
                style={{ color: "var(--fg-3)", maxWidth: "100%" }}
              >
                {DNA_SPLIT_META[k].label}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Edit ──
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div
          className="font-mono-ta text-[10px] font-bold uppercase"
          style={{ letterSpacing: "0.2em", color: "var(--ta-pink)" }}
        >
          Fight DNA · Split
        </div>
        <span
          className="font-mono-ta text-[10px] uppercase"
          style={{
            letterSpacing: "0.12em",
            color: total === 100 ? "#3EE06B" : "var(--fg-4)",
          }}
        >
          Summe {total}%{total !== 100 && total > 0 ? " · ≈100 anstreben" : ""}
        </span>
      </div>

      {!empty && (
        <div className="mb-4">
          <StackedBar norm={norm} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {DNA_SPLIT_KEYS.map((k) => (
          <label key={k} className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: DNA_SPLIT_META[k].color }}
              />
              <span
                className="font-mono-ta text-[10px] uppercase"
                style={{ letterSpacing: "0.1em", color: "var(--fg-3)" }}
              >
                {DNA_SPLIT_META[k].label}
              </span>
            </span>
            <div className="relative">
              <input
                type="number"
                min={0}
                max={100}
                value={value[k] || ""}
                onChange={(e) => setKey(k, e.target.value)}
                placeholder="0"
                className="w-full rounded-lg px-3 py-2 pr-7 text-sm"
                style={{
                  background: "var(--ink-3)",
                  border: "1px solid var(--ink-5)",
                  color: "var(--fg-1)",
                  outline: "none",
                }}
              />
              <span
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs"
                style={{ color: "var(--fg-4)" }}
              >
                %
              </span>
            </div>
          </label>
        ))}
      </div>
      <p className="mt-3 text-[11px]" style={{ color: "var(--fg-4)" }}>
        Optional · grobe Einschätzung reicht — die Werte werden für die Anzeige
        automatisch auf 100% normiert.
      </p>
    </div>
  );
}

/** Gestapelter Prozent-Balken aus den normierten Split-Werten. */
function StackedBar({ norm }: { norm: Record<DnaSplitKey, number> }) {
  return (
    <div className="flex h-6 w-full gap-[3px]">
      {DNA_SPLIT_KEYS.filter((k) => norm[k] > 0).map((k, i, arr) => (
        <div
          key={k}
          className="h-full"
          style={{
            width: `${norm[k]}%`,
            background: `linear-gradient(180deg, ${DNA_SPLIT_META[k].color}, ${DNA_SPLIT_META[k].color}CC)`,
            borderRadius:
              i === 0
                ? "12px 5px 5px 12px"
                : i === arr.length - 1
                  ? "5px 12px 12px 5px"
                  : "5px",
            transition: "width 0.3s ease",
          }}
          title={`${norm[k]}% ${DNA_SPLIT_META[k].label}`}
        />
      ))}
    </div>
  );
}
