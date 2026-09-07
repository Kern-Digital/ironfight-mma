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
 *
 * ─── ROLLOUT-ETAPPE 3a (04.09.2026): DER `frameless`-SCHALTER IST WEG ───────
 *
 * Der Block trug zwei Fassungen: `frameless` (neue Tokens, für das Akkordeon
 * in FightProfileView) und ohne (eine `--ink-*`-Karte mit eigener Kopfzeile,
 * für die Gegner-Ansichten). Ein Schalter, zwei Fragen:
 *
 *   1. Bringt der Block seine eigene KARTENFLÄCHE mit?
 *   2. Bringt er seine eigene ÜBERSCHRIFT mit?
 *
 * Die erste ist im DESIGN-BRIEF längst beantwortet — reine Anzeige-Sektionen
 * liegen flach auf dem Seitengrund, Rahmen sind der Hervorhebung vorbehalten.
 * Die zweite gehört dem Aufrufer: Er weiß, ob über ihm schon eine Überschrift
 * steht. Beide zusammen in einem Boolean ergaben zwei Looks, die auseinander
 * liefen — der eine bekam beim Redesign neue Tokens, der andere blieb stehen.
 *
 * Jetzt: keine Fläche, keine Kopfzeile, ein Look. Die Überschrift setzt, wer
 * den Block platziert (OpponentProfileView, OpponentEditor, FightProfileView).
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
    <div>
      <StackedBar norm={norm} />
      <div className="mt-4 flex">
        {activeKeys.map((k, i) => (
          <div
            key={k}
            className="flex flex-1 flex-col items-center gap-1.5 px-1 text-center"
            style={{
              borderLeft: i > 0 ? "1px solid var(--line)" : "none",
            }}
          >
            {/* `--type-num-xl` ist genau dafür da: die große Zahl. Vorher stand
                hier ein clamp() auf der Mono-Schrift — bei fünf Spalten trägt
                die Skala das aber selbst (mobil 32 px, fünf Spalten auf 390 px
                = 78 px je Spalte), und dreistellig wird der Wert nur, wenn ein
                einziger Bereich übrig bleibt. */}
            <span
              style={{
                font: "var(--type-num-xl)",
                fontVariantNumeric: "tabular-nums",
                color: "var(--text-1)",
              }}
            >
              {norm[k]}
              <span
                style={{
                  fontSize: "0.62em",
                  color: "var(--text-2)",
                  marginLeft: 1,
                }}
              >
                %
              </span>
            </span>
            <span
              aria-hidden
              className="h-[3px] w-8 rounded-full"
              style={{
                background: DNA_SPLIT_META[k].color,
                boxShadow: `0 0 8px color-mix(in oklab, ${DNA_SPLIT_META[k].color} 40%, transparent)`,
              }}
            />
            <span
              className="truncate"
              style={{
                font: "var(--type-sub)",
                color: "var(--text-2)",
                maxWidth: "100%",
              }}
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
            background: `linear-gradient(180deg, ${DNA_SPLIT_META[k].color}, color-mix(in oklab, ${DNA_SPLIT_META[k].color} 80%, transparent))`,
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
