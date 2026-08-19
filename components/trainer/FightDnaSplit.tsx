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
    return (
      <div>
        <div
          className="font-mono-ta mb-3 text-[10px] font-bold uppercase"
          style={{ letterSpacing: "0.2em", color: "var(--ta-pink)" }}
        >
          Fight DNA
        </div>
        <StackedBar norm={norm} />
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {DNA_SPLIT_KEYS.filter((k) => norm[k] > 0).map((k) => (
            <div key={k} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: DNA_SPLIT_META[k].color }}
              />
              <span className="text-xs" style={{ color: "var(--fg-2)" }}>
                {norm[k]}% {DNA_SPLIT_META[k].label}
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
    <div
      className="flex h-3.5 w-full overflow-hidden rounded-full"
      style={{ background: "var(--ink-4)" }}
    >
      {DNA_SPLIT_KEYS.filter((k) => norm[k] > 0).map((k) => (
        <div
          key={k}
          style={{
            width: `${norm[k]}%`,
            background: DNA_SPLIT_META[k].color,
            transition: "width 0.3s ease",
          }}
          title={`${norm[k]}% ${DNA_SPLIT_META[k].label}`}
        />
      ))}
    </div>
  );
}
