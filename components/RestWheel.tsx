"use client";

/**
 * Pausen-Rad (Leons Vorgabe 2026-08-28): Rad, in dem sich die Zeit
 * zwischen 0:00 und 9:45 in 15-Sekunden-Schritten drehen lässt. Der Wert
 * wird LIVE beim Einrasten übernommen (Scroll-Snap auf die Zeilenhöhe).
 *
 * Optik (Leons Feedback-Runden, zuletzt 2026-08-29): KEIN Panel — kein
 * Glas, kein Rahmen, kein x, kein Scrollbalken. Nur die Zeiten schweben
 * frei: der gewählte Wert in der Mitte am größten (Akzent), nach oben und
 * unten stufenweise kleiner und blasser. Dahinter ein radialer Schleier:
 * Blur + Abdunkelung am stärksten hinter den Zeiten, zu den Rändern
 * deutlich auslaufend (Maske auf dem backdrop-filter-Layer).
 *
 * Interaktion: Der Scroll-Container füllt den GANZEN Bildschirm — egal wo
 * man scrollt, dreht sich nur das Rad (die Seite dahinter ist per
 * Body-Lock eingefroren). Tippen ins Leere (neben/über/unter den Zahlen)
 * schließt, ebenso ein Tipp auf den gewählten Wert; ein Tipp auf eine
 * andere sichtbare Zeile dreht dorthin. Die Zentrier-Ränder sind echte
 * Spacer-Elemente statt Container-Padding (padding-bottom in
 * Scroll-Containern ist browserabhängig unzuverlässig).
 */

import { useEffect, useRef, useState } from "react";

/** 15-s-Raster bis 9:45 — „zwischen 0 und 9 min 59 sec" im Schrittraster */
export const REST_WHEEL_STEP = 15;
export const REST_WHEEL_MAX = 585;
const VALUES = Array.from(
  { length: REST_WHEEL_MAX / REST_WHEEL_STEP + 1 },
  (_, i) => i * REST_WHEEL_STEP,
);

/** Zeilenhöhe des Rads — Scroll-Snap rastet auf diesem Raster ein */
const ITEM_H = 44;

/** Stufen-Typo nach Abstand zur Mitte: gewählt am größten, dann treppab */
const SIZE_BY_DISTANCE = [34, 22, 18, 15];
/** Ab Abstand 4 läuft das Rad in Unsichtbarkeit aus (voller Bildschirm) */
const OPACITY_BY_DISTANCE = [1, 0.7, 0.45, 0.25, 0.1, 0];
const SUFFIX_BY_DISTANCE = [12, 10, 9, 9];

/** Halbe Breite der Zahlen-Spalte — Tipps weiter außen gelten als „Leere" */
const COLUMN_HALF_W = 130;

export function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function RestWheel({
  label,
  value,
  onChange,
  onClose,
  zIndex = 70,
}: {
  /** Beschreibung fürs Screenreader-Dialog-Label („Pause zwischen …") */
  label: string;
  value: number;
  onChange: (seconds: number) => void;
  onClose: () => void;
  /** Liegt ggf. über anderen Sheets (Detail-Sheet ist z-50/60) */
  zIndex?: number;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const clampIndex = (i: number) =>
    Math.max(0, Math.min(VALUES.length - 1, i));
  const [index, setIndex] = useState(() =>
    clampIndex(Math.round(value / REST_WHEEL_STEP)),
  );
  // Der Callback läuft aus dem Scroll-Handler — immer der aktuelle sein
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Seite dahinter einfrieren — nur das Rad darf scrollen
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Startposition: gewählter Wert steht mittig (scrollTop = Index × Zeile,
  // die dvh-Spacer zentrieren unabhängig von der Bildschirmhöhe). Mehrfach
  // nachgezogen — Einblende-Animation/Layout können den ersten Wert
  // wieder verwerfen.
  useEffect(() => {
    const idx = clampIndex(Math.round(value / REST_WHEEL_STEP));
    const apply = () => {
      const el = listRef.current;
      if (el) el.scrollTop = idx * ITEM_H;
    };
    apply();
    const raf = requestAnimationFrame(apply);
    const timer = setTimeout(apply, 80);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    const i = clampIndex(Math.round(el.scrollTop / ITEM_H));
    setIndex((prev) => {
      if (prev !== i) onChangeRef.current(VALUES[i]);
      return i;
    });
  }

  function scrollTo(i: number) {
    listRef.current?.scrollTo({ top: i * ITEM_H, behavior: "smooth" });
  }

  function handleRowClick(e: React.MouseEvent, i: number) {
    e.stopPropagation();
    const d = Math.abs(i - index);
    const dx = Math.abs(e.clientX - window.innerWidth / 2);
    // Seitlich neben den Zahlen oder außerhalb des sichtbaren Rads = Leere
    if (dx > COLUMN_HALF_W || d > 3) {
      onClose();
      return;
    }
    if (i === index) onClose();
    else scrollTo(i);
  }

  return (
    <div
      className="fixed inset-0"
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      {/* Radialer Schleier — rein visuell (Interaktion liegt auf dem
          Scroll-Container darüber): Mitte voll, Ränder deutlich reduziert */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: "var(--overlay)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          maskImage:
            "radial-gradient(ellipse 95% 85% at 50% 50%, black 45%, rgba(0,0,0,0.22) 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 95% 85% at 50% 50%, black 45%, rgba(0,0,0,0.22) 100%)",
          animation: "fade-in 0.2s ease-out both",
        }}
      />

      {/* Bildschirmfüllender Scroll-Container: egal wo gescrollt wird,
          dreht sich das Rad. Klick auf Spacer/Lücken = ins Leere = zu. */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        onClick={onClose}
        className="no-scrollbar absolute inset-0 overflow-y-auto"
        style={{
          scrollSnapType: "y mandatory",
          overscrollBehavior: "contain",
          animation: "fade-in 0.2s ease-out both",
          // Weicher Auslauf zum oberen/unteren Bildschirmrand
          maskImage:
            "linear-gradient(to bottom, transparent 0, black 18%, black 82%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0, black 18%, black 82%, transparent 100%)",
        }}
      >
        {/* Spacer statt Padding: zentrieren die erste/letzte Zeile exakt
            in der Bildschirmmitte — scrollTop bleibt Index × Zeilenhöhe */}
        <div aria-hidden style={{ height: `calc(50dvh - ${ITEM_H / 2}px)` }} />
        {VALUES.map((v, i) => {
          const d = Math.abs(i - index);
          const dSize = Math.min(d, SIZE_BY_DISTANCE.length - 1);
          const dOpacity = Math.min(d, OPACITY_BY_DISTANCE.length - 1);
          const selected = i === index;
          return (
            <button
              key={v}
              type="button"
              onClick={(e) => handleRowClick(e, i)}
              aria-label={
                selected
                  ? `${formatRest(v)} Minuten übernehmen und schließen`
                  : `${formatRest(v)} Minuten wählen`
              }
              aria-pressed={selected}
              className="flex w-full items-center justify-center gap-1 tabular-nums"
              style={{
                height: ITEM_H,
                scrollSnapAlign: "center",
                font: `700 ${SIZE_BY_DISTANCE[dSize]}px/1 var(--font-archivo), system-ui, sans-serif`,
                color: selected ? "var(--accent-text)" : "var(--text-2)",
                opacity: OPACITY_BY_DISTANCE[dOpacity],
                transition:
                  "font-size .15s ease, color .15s ease, opacity .15s ease",
              }}
            >
              {formatRest(v)}
              <span
                style={{
                  font: `600 ${SUFFIX_BY_DISTANCE[dSize]}px/1 var(--font-archivo), system-ui, sans-serif`,
                  color: selected ? "var(--accent-text)" : "var(--text-3)",
                  transition: "font-size .15s ease, color .15s ease",
                }}
              >
                min
              </span>
            </button>
          );
        })}
        <div aria-hidden style={{ height: `calc(50dvh - ${ITEM_H / 2}px)` }} />
      </div>
    </div>
  );
}
