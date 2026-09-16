"use client";

import type { AreaScore } from "@/lib/fight-camp-analysis";

/**
 * Waagerechte Balken der Bereichs-Abdeckung.
 *
 * ─── DREI ZUSTÄNDE, DREI ANTWORTEN (Umbau 13.09.2026) ──────────────────────
 *
 * Vorher hieß die Regel „Stärken in Cyan, Schwächen in Pink" — und das Rosa
 * trug gleich ZWEI verschiedene Dinge: einen schwach abgedeckten Bereich
 * (halbdurchsichtig) und einen ausgewählten Schwerpunkt (voll). Zwei Aussagen
 * in einer Farbe, unterschieden nur durch Deckkraft; wer den Unterschied nicht
 * kannte, sah eine Liste mit rosa Balken.
 *
 * Jetzt beantwortet jeder Zustand eine eigene Frage:
 *   • SCHWERPUNKT — „darauf arbeitest du hin": die ganze ZEILE wird markiert
 *     (getönte Fläche, Kante, Beschriftung im Akzent). Nicht nur der Balken,
 *     damit die Farbe nicht allein trägt.
 *   • SCHWACH — „hier fehlt Arbeit": der Balken steht in `--warning`. Bewusst
 *     NICHT `--negative`: eine dünne Abdeckung ist eine Lücke, kein Fehler,
 *     und die Alarmfarbe ist in dieser App für anderes reserviert.
 *   • SONST — der Balken trägt den Gym-Akzent und sagt nichts weiter; seine
 *     LÄNGE ist die Auskunft.
 *
 * Die Rinne ist `.t-progress` aus dem Token-System statt zweier `--ink`-Stufen
 * — dieselbe Rinne wie jeder andere Balken der App. Nur die FÜLLUNG wird
 * überschrieben, weil sie hier am Zustand hängt und nicht am Standard-Verlauf.
 */
export default function AreaCoverageChart({
  scores,
  highlightWeak = false,
  highlightAreas,
}: {
  scores: AreaScore[];
  highlightWeak?: boolean;
  highlightAreas?: Set<string>;
}) {
  const max = Math.max(0.0001, ...scores.map((s) => s.coverage));

  return (
    <div className="flex flex-col gap-1.5">
      {scores.map((s) => {
        const pct = (s.coverage / max) * 100;
        const isWeak = s.coverage < 0.25;
        const isHighlight = highlightAreas?.has(s.area) ?? false;
        const barColor =
          isWeak && highlightWeak && !isHighlight
            ? "var(--warning)"
            : "var(--accent)";
        return (
          <div
            key={s.area}
            className="flex items-center gap-2 rounded-badge px-2 py-1"
            style={{
              /* Nur der markierte Fall trägt eine Fläche — sonst bliebe ein
                 Inline-`transparent` stehen, wo später einmal eine Tönung
                 greifen soll. */
              ...(isHighlight ? { background: "var(--accent-subtle)" } : {}),
              border: isHighlight
                ? "1px solid color-mix(in oklab, var(--accent) 35%, transparent)"
                : "1px solid transparent",
            }}
          >
            <div
              className="w-28 truncate"
              style={{
                font: "var(--type-meta)",
                letterSpacing: "var(--ls-label)",
                textTransform: "uppercase",
                color: isHighlight ? "var(--accent-text)" : "var(--text-2)",
              }}
            >
              {s.label}
            </div>
            <div className="t-progress flex-1">
              <span
                style={{
                  width: `${Math.max(2, pct)}%`,
                  background: barColor,
                  boxShadow: `0 0 8px color-mix(in oklab, ${barColor} 45%, transparent)`,
                  transition: "width 0.4s",
                }}
              />
            </div>
            <div
              className="w-14 text-right"
              style={{
                font: "var(--type-num)",
                fontVariantNumeric: "tabular-nums",
                color: isHighlight ? "var(--accent-text)" : "var(--text-3)",
              }}
            >
              {s.workoutCount} · {s.practicedTechniqueCount}
            </div>
          </div>
        );
      })}
      <div
        className="mt-1 px-2"
        style={{
          font: "var(--type-meta)",
          letterSpacing: "var(--ls-label)",
          color: "var(--text-3)",
        }}
      >
        Workouts · Techniken (geübt)
      </div>
    </div>
  );
}
