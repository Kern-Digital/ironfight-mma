"use client";

/**
 * Flächenkurve „Mitglieder" — das Diagramm der Verwaltungs-Übersicht
 * (Leons Vorgabe 02.09.2026: das Wachstum als echtes Diagramm, nicht als
 * Sparkline).
 *
 * ES ZEIGT DEN GESAMTSTAND, NICHT DIE BEITRITTE. Eine Kurve der monatlichen
 * Zugänge wäre für ein Gym dieser Größe fast nur Rauschen — zwei Beitritte
 * im März, keiner im April, und die Linie sähe aus wie ein Absturz, obwohl
 * niemand gegangen ist. Der Gesamtstand beantwortet die Frage, die eine
 * Verwaltung wirklich hat: Werden wir mehr? Die Zugänge stehen als Zahl in
 * der Zeile darüber und im Tooltip jedes Monats.
 *
 * BAUART WIE `components/trainer/WeeklyFeedbackChart.tsx` — bewusst dieselbe:
 * echte Pixel statt `preserveAspectRatio="none"` (ein verzerrend skaliertes
 * SVG zöge Linie und Endpunkt zu Ellipsen), ResizeObserver für die Breite,
 * Catmull-Rom-Kurve mit geklemmten Kontrollpunkten, Trefferspalten für Hover
 * UND Antippen. Zwei Diagramme mit derselben Sprache sind eines mehr wert als
 * zwei erfundene.
 *
 * WAS DIE KURVE NICHT WEISS: Wer kein Beitrittsdatum hat (Bestandsmitglieder
 * von vor dem Einladungssystem), zählt in `memberGrowth` erst im letzten
 * Monat mit. Der Anfang der Kurve ist deshalb eher zu niedrig als zu hoch —
 * die aufrufende Seite sagt das in ganzen Sätzen. Ein geratenes Datum wäre
 * die schlechtere Wahl: Es sähe genauso aus wie ein echtes.
 *
 * Farben ausschließlich aus Tokens: Linie und Punkt --accent, die Fläche
 * darunter derselbe Akzent als Deckkraft-Rampe, Gitter --line, Texte
 * --text-*. Die Einzeichnen-Animation hält bei prefers-reduced-motion an.
 */

import type { MonthPoint } from "@/lib/gym-stats";
// AUSNAHME (MOTION-BRIEF §3.1): Diagramm mit eigenen Pfad-Animationen.
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";

const HEIGHT = 190;
const PAD = { top: 28, right: 16, bottom: 24, left: 8 };

const MONTH_SHORT = new Intl.DateTimeFormat("de-DE", { month: "short" });
const MONTH_LONG = new Intl.DateTimeFormat("de-DE", {
  month: "long",
  year: "numeric",
});

/** Kleinste „runde" Obergrenze über dem Maximum — für saubere Gitterwerte. */
function niceMax(max: number): number {
  const steps = [4, 6, 8, 10, 12, 16, 20, 24, 30, 40, 50, 60, 80, 100, 120, 160, 200];
  for (const s of steps) if (max <= s) return s;
  return Math.ceil(max / 50) * 50;
}

interface Pt {
  x: number;
  y: number;
}

/**
 * Weiche Kurve durch alle Punkte (Catmull-Rom → Bezier). Die Kontrollpunkte
 * werden senkrecht auf den Zeichenbereich geklemmt: Ohne Klammer schösse die
 * Kurve an steilen Wechseln unter die Null-Linie und zeigte einen
 * Mitgliederstand, den es nie gab.
 */
function smoothPath(pts: Pt[], yMin: number, yMax: number): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  const clamp = (v: number) => Math.min(Math.max(v, yMin), yMax);
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = clamp(p1.y + (p2.y - p0.y) / 6);
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = clamp(p2.y - (p3.y - p1.y) / 6);
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

export default function MemberGrowthChart({
  months,
}: {
  months: MonthPoint[];
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0]?.contentRect.width ?? 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = months.length;
  const max = niceMax(Math.max(...months.map((m) => m.total), 0));
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  const x = (i: number) =>
    PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + (1 - v / max) * innerH;

  const pts: Pt[] = months.map((m, i) => ({ x: x(i), y: y(m.total) }));
  const linePath = smoothPath(pts, PAD.top, y(0));
  const areaPath = `${linePath} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`;

  // Dokumentweit eindeutige ID für den Verlauf: Stünden zwei Flächen-
  // diagramme auf einer Seite, gewänne sonst still die erste Definition.
  const gradientId = useId();

  const last = months[n - 1];
  // Achsen-Beschriftung: höchstens ~5 Monate, vom rechten Rand aus gezählt —
  // so trägt der JÜNGSTE Monat immer eine Beschriftung.
  const labelEvery = Math.max(1, Math.ceil(n / 5));

  const activeMonth = active !== null ? months[active] : null;

  if (n === 0) return null;

  return (
    <div
      ref={boxRef}
      className="relative w-full"
      style={{ height: `${HEIGHT}px` }}
      onPointerLeave={() => setActive(null)}
    >
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Mitglieder je Monat, zuletzt ${last.total}`}
        >
          {/* Gitter: Haarlinien, zurückhaltend — die Daten sind das Laute. */}
          {[max / 2, max].map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--line)"
                strokeWidth={1}
              />
              <text
                x={PAD.left}
                y={y(v) - 5}
                style={{ font: "var(--type-hd-label)" }}
                fill="var(--text-3)"
              >
                {v}
              </text>
            </g>
          ))}
          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={y(0)}
            y2={y(0)}
            stroke="var(--line)"
            strokeWidth={1}
          />

          {/* Monats-Beschriftung an der Unterkante */}
          {months.map((m, i) =>
            (n - 1 - i) % labelEvery === 0 ? (
              <text
                key={m.key}
                x={x(i)}
                y={HEIGHT - 6}
                textAnchor={i === n - 1 ? "end" : i === 0 ? "start" : "middle"}
                style={{ font: "var(--type-hd-label)" }}
                fill="var(--text-3)"
              >
                {MONTH_SHORT.format(m.start)}
              </text>
            ) : null,
          )}

          {/* Fläche unter der Kurve: Deckkraft-Rampe DERSELBEN Token-Farbe,
              kein zweiter Farbton. */}
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0"
                style={{ stopColor: "var(--accent)" }}
                stopOpacity={0.42}
              />
              <stop
                offset="0.65"
                style={{ stopColor: "var(--accent)" }}
                stopOpacity={0.12}
              />
              <stop
                offset="1"
                style={{ stopColor: "var(--accent)" }}
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <motion.path
            d={areaPath}
            fill={`url(#${gradientId})`}
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.45 }}
          />

          {/* Die Linie zeichnet sich von links ein */}
          <motion.path
            d={linePath}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={reduced ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />

          {/* Aktiver Monat: Haarlinie + Punkt */}
          {activeMonth && active !== null && (
            <g>
              <line
                x1={x(active)}
                x2={x(active)}
                y1={PAD.top}
                y2={y(0)}
                stroke="var(--line-strong)"
                strokeWidth={1}
              />
              <circle
                cx={x(active)}
                cy={y(activeMonth.total)}
                r={4.5}
                fill="var(--accent)"
                stroke="var(--surface-card)"
                strokeWidth={2}
              />
            </g>
          )}

          {/* Endpunkt mit dem heutigen Stand als einziges Direkt-Label —
              nie eine Zahl an jedem Punkt. */}
          <motion.circle
            cx={x(n - 1)}
            cy={y(last.total)}
            r={4.5}
            fill="var(--accent)"
            stroke="var(--surface-card)"
            strokeWidth={2}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
            initial={reduced ? false : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.25, delay: 0.85 }}
          />
          <motion.text
            x={x(n - 1) - 10}
            y={y(last.total) - 10}
            textAnchor="end"
            style={{ font: "var(--type-hd-label)" }}
            fill="var(--text-body)"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.9 }}
          >
            {last.total}
          </motion.text>

          {/* Unsichtbare Trefferflächen: eine Spalte je Monat (Hover UND
              Antippen), deutlich größer als der Punkt selbst. */}
          {months.map((m, i) => {
            const left = i === 0 ? PAD.left : (x(i - 1) + x(i)) / 2;
            const right = i === n - 1 ? width - PAD.right : (x(i) + x(i + 1)) / 2;
            return (
              <rect
                key={m.key}
                x={left}
                y={0}
                width={Math.max(0, right - left)}
                height={HEIGHT}
                fill="transparent"
                onPointerEnter={() => setActive(i)}
                onPointerDown={() => setActive(i)}
              />
            );
          })}
        </svg>
      )}

      {/* Tooltip des aktiven Monats — HTML statt SVG, damit Fläche, Rahmen
          und Schatten aus denselben Tokens kommen wie überall. */}
      {activeMonth && active !== null && width > 0 && (
        <div
          className="pointer-events-none absolute z-10 flex flex-col gap-0.5 px-3 py-2"
          style={{
            left: Math.min(Math.max(x(active), 90), width - 90),
            top: 0,
            transform: "translateX(-50%)",
            borderRadius: "var(--r-sm)",
            background: "var(--surface-raised)",
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow-pop)",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ font: "var(--type-hd-label)", color: "var(--text-3)" }}>
            {MONTH_LONG.format(activeMonth.start)}
          </span>
          <span style={{ font: "var(--type-nav-meta)", color: "var(--text-body)" }}>
            {activeMonth.total}{" "}
            {activeMonth.total === 1 ? "Mitglied" : "Mitglieder"}
            {activeMonth.joined > 0 && (
              <span style={{ color: "var(--text-3)" }}>
                {" "}
                · {activeMonth.joined} neu
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
