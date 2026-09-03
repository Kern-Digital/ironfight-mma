"use client";

/**
 * Flächenkurve „Rückmeldungen pro Woche" — das erste der beiden Diagramme
 * der Trainer-Übersicht (Leons Wunsch 01.09.2026: „ein bis zwei schön
 * animierte Diagramme").
 *
 * WAS DIE KURVE ZEIGT — UND WAS NICHT: Jeder Punkt zählt Tipps auf
 * „Teilnehmen" im Kursplan. Das ist eine SELBSTAUSKUNFT der Mitglieder,
 * keine kontrollierte Anwesenheit (lib/gym-stats.ts). Jede Beschriftung
 * hier und auf der aufrufenden Seite sagt deshalb „Rückmeldungen".
 *
 * GEOMETRIE IN ECHTEN PIXELN, NICHT ÜBER preserveAspectRatio="none": Ein
 * verzerrend skaliertes SVG zöge die 2-px-Linie und den runden Endpunkt zu
 * Ellipsen. Stattdessen misst ein ResizeObserver die Breite des Behälters
 * und die Punkte werden gerechnet.
 *
 * Farben ausschließlich aus Tokens: Linie und Punkt tragen --accent, die
 * Fläche darunter ist derselbe Akzent als nach unten auslaufender Verlauf
 * (Leons Vorlage vom 01.09. spät abends — eine Deckkraft-Rampe, kein zweiter
 * Farbton), Gitter --line, jeder Text ein --text-*-Token. Die
 * Einzeichnen-Animation hält bei prefers-reduced-motion an.
 */

import type { WeekPoint } from "@/lib/gym-stats";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";

const HEIGHT = 190;
const PAD = { top: 28, right: 16, bottom: 24, left: 8 };

/** Kleinste „runde" Obergrenze über dem Maximum — für saubere Gitterwerte. */
function niceMax(max: number): number {
  const steps = [4, 6, 8, 10, 12, 16, 20, 24, 30, 40, 50, 60, 80, 100, 120, 160, 200];
  for (const s of steps) if (max <= s) return s;
  return Math.ceil(max / 50) * 50;
}

function shortDate(d: Date): string {
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

interface Pt {
  x: number;
  y: number;
}

/**
 * Weiche Kurve durch alle Punkte (Catmull-Rom → Bezier) — der Look aus
 * Leons Vorlage. Die Kontrollpunkte werden senkrecht auf den Zeichenbereich
 * geklemmt: Ohne Klammer schösse die Kurve an steilen Wechseln unter die
 * Null-Linie und zeigte Rückmeldungen, die es nie gab.
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

export default function WeeklyFeedbackChart({
  points,
}: {
  points: WeekPoint[];
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

  const n = points.length;
  const max = niceMax(Math.max(...points.map((p) => p.count), 0));
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  const x = (i: number) =>
    PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + (1 - v / max) * innerH;

  const pts: Pt[] = points.map((p, i) => ({ x: x(i), y: y(p.count) }));
  const linePath = smoothPath(pts, PAD.top, y(0));
  const areaPath = `${linePath} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`;

  // Der Verlauf braucht eine dokumentweit eindeutige ID — stünde die Karte
  // zweimal auf einer Seite (Verwaltungs-Übersicht), gewänne sonst still die
  // erste Definition.
  const gradientId = useId();

  const last = points[n - 1];
  // Achsen-Beschriftung: höchstens ~5 Wochen, vom rechten Rand aus gezählt —
  // so trägt die JÜNGSTE Woche immer ein Datum, nicht zufällig irgendeine.
  const labelEvery = Math.max(1, Math.ceil(n / 5));

  const activePoint = active !== null ? points[active] : null;

  return (
    <div
      ref={boxRef}
      className="relative w-full"
      style={{ height: `${HEIGHT}px` }}
      onPointerLeave={() => setActive(null)}
    >
      {width > 0 && n > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Rückmeldungen pro Woche, zuletzt ${last.count}`}
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

          {/* Wochen-Beschriftung an der Unterkante */}
          {points.map((p, i) =>
            (n - 1 - i) % labelEvery === 0 ? (
              <text
                key={p.weekIdentifier}
                x={x(i)}
                y={HEIGHT - 6}
                textAnchor={i === n - 1 ? "end" : i === 0 ? "start" : "middle"}
                style={{ font: "var(--type-hd-label)" }}
                fill="var(--text-3)"
              >
                {shortDate(p.weekStart)}
              </text>
            ) : null,
          )}

          {/* Fläche: Farbverlauf unter der Kurve (Leons Vorlage) — oben der
              Akzent, nach unten auslaufend. Der Verlauf ist eine Deckkraft-
              Rampe DERSELBEN Token-Farbe, kein zweiter Farbton. */}
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

          {/* Aktive Woche: Haarlinie + Punkt */}
          {activePoint && active !== null && (
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
                cy={y(activePoint.count)}
                r={4.5}
                fill="var(--accent)"
                stroke="var(--surface-card)"
                strokeWidth={2}
              />
            </g>
          )}

          {/* Endpunkt: Marker mit Ring in Flächenfarbe + der letzte Wert als
              einziges Direkt-Label — nie eine Zahl an jedem Punkt. */}
          <motion.circle
            cx={x(n - 1)}
            cy={y(last.count)}
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
            y={y(last.count) - 10}
            textAnchor="end"
            style={{ font: "var(--type-hd-label)" }}
            fill="var(--text-body)"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.9 }}
          >
            {last.count}
          </motion.text>

          {/* Unsichtbare Trefferflächen: eine Spalte je Woche (Hover UND
              Antippen), deutlich größer als der Punkt selbst. */}
          {points.map((p, i) => {
            const left = i === 0 ? PAD.left : (x(i - 1) + x(i)) / 2;
            const right = i === n - 1 ? width - PAD.right : (x(i) + x(i + 1)) / 2;
            return (
              <rect
                key={p.weekIdentifier}
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

      {/* Tooltip der aktiven Woche — HTML statt SVG, damit Fläche, Rahmen
          und Schatten aus denselben Tokens kommen wie überall. */}
      {activePoint && active !== null && width > 0 && (
        <div
          className="pointer-events-none absolute z-10 flex flex-col gap-0.5 px-3 py-2"
          style={{
            left: Math.min(Math.max(x(active), 80), width - 80),
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
            Woche vom {shortDate(activePoint.weekStart)}
          </span>
          <span style={{ font: "var(--type-nav-meta)", color: "var(--text-body)" }}>
            {activePoint.count}{" "}
            {activePoint.count === 1 ? "Rückmeldung" : "Rückmeldungen"}
          </span>
        </div>
      )}
    </div>
  );
}
