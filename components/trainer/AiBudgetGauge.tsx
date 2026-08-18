"use client";

/**
 * Claude-Guthaben-Anzeige — Ring-Gauge im Stil „dunkler Kreis + orangener
 * Fortschrittsbogen". Zeigt das verbleibende Guthaben (geschätzt aus den
 * Token-Kosten aller bisherigen Analysen) gegen das eingestellte Budget.
 *
 * Kein echter Kontostand: Anthropic bietet keine Saldo-API — die Anzeige
 * rechnet die Listenpreise pro Analyse zusammen (EUR ≈ USD).
 */

import { useCallback, useEffect, useState } from "react";
import {
  getAiUsageSummary,
  setAiBudget,
  type AiUsageSummary,
} from "@/lib/video-analysis";

/** Orange wie in der Referenz-Anzeige. */
const ORANGE = "#F0763B";

export function formatEur(n: number): string {
  return n.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function Ring({ fraction }: { fraction: number }) {
  const size = 84;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, fraction));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      {/* Dunkler Grundring (verbrauchter Anteil) */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--ink-4)"
        strokeWidth={stroke}
      />
      {/* Orangener Bogen = verbleibendes Guthaben */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={ORANGE}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${c * f} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 0.4s ease" }}
      />
    </svg>
  );
}

export default function AiBudgetGauge({
  refreshKey = 0,
}: {
  /** Hochzählen, um die Anzeige neu zu laden (z. B. nach einer Analyse). */
  refreshKey?: number;
}) {
  const [summary, setSummary] = useState<AiUsageSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setSummary(await getAiUsageSummary());
    } catch {
      setSummary(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function editBudget() {
    if (!summary || busy) return;
    const input = prompt(
      "Aufgeladenes Claude-Guthaben in Euro (z. B. nach erneutem Aufladen anpassen):",
      String(summary.budgetEur),
    );
    if (input == null) return;
    const value = Number(input.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) return;
    setBusy(true);
    try {
      await setAiBudget(value);
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!summary) return null;

  const remaining = Math.max(0, summary.budgetEur - summary.spentEur);
  const fraction = summary.budgetEur > 0 ? remaining / summary.budgetEur : 0;
  const low = summary.budgetEur > 0 && fraction < 0.15;

  return (
    <div
      className="flex items-center gap-4 rounded-2xl px-4 py-3"
      style={{ background: "var(--ink-2)", border: "1px solid var(--ink-4)" }}
    >
      <div className="relative flex-shrink-0" style={{ width: 84, height: 84 }}>
        <Ring fraction={fraction} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-display-ta font-black leading-none"
            style={{ fontSize: "13px", color: low ? "var(--ta-pink)" : ORANGE }}
          >
            {formatEur(remaining)}
          </span>
          <span
            className="font-mono-ta mt-0.5 text-[7px] uppercase"
            style={{ letterSpacing: "0.12em", color: "var(--fg-4)" }}
          >
            übrig
          </span>
        </div>
      </div>
      <div className="min-w-0">
        <div
          className="font-mono-ta text-[9px] font-bold uppercase"
          style={{ letterSpacing: "0.18em", color: "var(--fg-3)" }}
        >
          Claude-Guthaben (geschätzt)
        </div>
        <div className="mt-1 text-[11px]" style={{ color: "var(--fg-4)" }}>
          Verbraucht: <b style={{ color: "var(--fg-2)" }}>{formatEur(summary.spentEur)}</b>{" "}
          von {formatEur(summary.budgetEur)} · {summary.analysisCount}{" "}
          {summary.analysisCount === 1 ? "Analyse" : "Analysen"}
        </div>
        <div className="mt-1.5 flex items-center gap-3">
          <button
            onClick={editBudget}
            disabled={busy}
            className="font-mono-ta text-[9px] uppercase underline-offset-2 hover:underline"
            style={{ letterSpacing: "0.12em", color: "var(--fg-4)" }}
          >
            Budget anpassen
          </button>
          {low && (
            <span
              className="font-mono-ta text-[9px] font-bold uppercase"
              style={{ letterSpacing: "0.1em", color: "var(--ta-pink)" }}
            >
              Guthaben fast aufgebraucht
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
