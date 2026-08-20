"use client";

import {
  DNA_SPLIT_KEYS,
  DNA_SPLIT_META,
  isDnaSplitEmpty,
  normalizeDnaSplit,
  type DnaSplit,
  type DnaSplitKey,
} from "@/lib/fight-stats";

/**
 * §1 Fight-DNA-Split — prozentuale Verteilung der Kampfbereiche.
 *
 * Reine Anzeige: gestapelter Balken + Legende mit Prozenten. Der Split wird
 * ausschließlich aus Video-Analysen berechnet (gewichteter Mittelwert, siehe
 * mergeDnaSplit in lib/fight-stats.ts) — die manuelle Eingabe wurde 2026-08-20
 * bewusst entfernt, damit die Gewichtung nicht von Hand-Rohwerten verzerrt wird.
 */
export default function FightDnaSplit({
  split,
}: {
  split: DnaSplit | null | undefined;
}) {
  if (!split || isDnaSplitEmpty(split)) return null;
  const norm = normalizeDnaSplit(split);
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
          title="Prozentuale Verteilung der Kampfbereiche — automatisch aus der KI-Video-Analyse berechnet."
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
