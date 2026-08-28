"use client";

/**
 * Pausen-Rad (Leons Vorgabe 2026-08-28): statt Stepper ein von unten
 * aufschiebendes Rad, in dem sich die Pause zwischen 0:00 und 9:45 in
 * 15-Sekunden-Schritten drehen lässt. Der Wert wird LIVE beim Einrasten
 * übernommen (Scroll-Snap auf die Zeilenhöhe); „Fertig" oder ein Klick
 * aufs Overlay schließen. Mobil Bottom-Sheet, am Desktop ein zentriertes
 * schmales Fenster.
 *
 * Optik (Leons Feedback-Runden 2+3): mittig zentriertes Glas-Panel mit
 * backdrop-blur, sonst NICHTS — kein Kopftext, kein Fertig-Button, keine
 * Auslauf-Verläufe, kein Band um den gewählten Wert. Der aktuelle Wert
 * ist einfach deutlich größer (≥1/3) und leuchtet in Akzent; übernommen
 * wird live beim Einrasten, geschlossen per Klick auf den Hintergrund
 * (oder das kleine x). Die Zentrier-Ränder sind echte Spacer-Elemente
 * statt Container-Padding (padding-bottom in Scroll-Containern ist
 * browserabhängig unzuverlässig).
 */

import Icon from "@/components/ui/Icon";
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
/** Sichtbare Zeilen (ungerade, damit eine Zeile exakt mittig steht) */
const VISIBLE = 5;
const PAD = ((VISIBLE - 1) / 2) * ITEM_H;

/** Durchsichtiger Glas-Grund des Panels — auch die Auslauf-Verläufe des
    Rads müssen in GENAU diese Farbe münden. Bewusst SEHR transparent
    (Leon 2026-08-28: „viel durchsichtiger"), der Blur hält es lesbar. */
const GLASS_BG = "color-mix(in srgb, var(--surface-card) 32%, transparent)";

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
  /** Kopfzeile („Pause zwischen den Rubriken", …) */
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

  // Startposition: gewählter Wert steht mittig. Mehrfach nachgezogen —
  // Einblende-Animation/Snap können den ersten Wert wieder verwerfen.
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

  return (
    // Immer MITTIG zentriert (Leon 2026-08-28) — kein Bottom-Sheet-Modus
    <div
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <button
        type="button"
        aria-label="Pausen-Rad schließen"
        className="absolute inset-0"
        style={{
          background: "var(--overlay)",
          animation: "fade-in 0.2s ease-out both",
        }}
        onClick={onClose}
      />
      {/* pointer-events-Muster wie bei den Detail-Sheets: neben dem
          zentrierten Fenster (Desktop) trifft der Klick das Overlay */}
      <div className="pointer-events-none relative flex w-full justify-center">
        <div
          className="pointer-events-auto animate-slide-up relative flex w-full max-w-xs flex-col overflow-hidden rounded-[var(--r-xl)]"
          style={{
            background: GLASS_BG,
            backdropFilter: "blur(18px) saturate(140%)",
            WebkitBackdropFilter: "blur(18px) saturate(140%)",
            border: "1px solid color-mix(in srgb, var(--line) 55%, transparent)",
            boxShadow: "var(--glass-shadow)",
          }}
        >
          {/* Kein Kopftext, kein Fertig-Button (Leon 2026-08-28): der Wert
              gilt immer live, geschlossen wird über den Hintergrund — das
              kleine x bleibt als expliziter Ausweg */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="t-interactive absolute right-1.5 top-1.5 z-30 inline-flex h-9 w-9 items-center justify-center rounded-field"
            style={{ color: "var(--text-3)" }}
          >
            <Icon name="x" size={15} strokeWidth={2.2} />
          </button>

          {/* ── Das Rad — ohne Auslauf-Schleier und ohne Einrast-Band: der
              gewählte Wert ist einfach deutlich größer und leuchtet ────── */}
          <div className="relative mx-5 my-3">
            <div
              ref={listRef}
              onScroll={handleScroll}
              className="relative overflow-y-auto"
              style={{
                height: VISIBLE * ITEM_H,
                scrollSnapType: "y mandatory",
                overscrollBehavior: "contain",
              }}
            >
              {/* Spacer statt Padding: erste/letzte Zeile können mittig
                  stehen, zuverlässig in allen Browsern */}
              <div aria-hidden style={{ height: PAD }} />
              {VALUES.map((v, i) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => scrollTo(i)}
                  aria-label={`Pause ${formatRest(v)} Minuten`}
                  aria-pressed={i === index}
                  className="flex w-full items-center justify-center gap-1 tabular-nums"
                  style={{
                    height: ITEM_H,
                    scrollSnapAlign: "center",
                    // Gewählter Wert ≥ 1/3 größer als die übrigen
                    font: `700 ${i === index ? 30 : 21}px/1 var(--font-archivo), system-ui, sans-serif`,
                    color: i === index ? "var(--accent-text)" : "var(--text-3)",
                    opacity: i === index ? 1 : 0.5,
                    transition:
                      "font-size .15s ease, color .15s ease, opacity .15s ease",
                  }}
                >
                  {formatRest(v)}
                  <span
                    style={{
                      font: "600 11px/1 var(--font-archivo), system-ui, sans-serif",
                      color: "var(--text-3)",
                    }}
                  >
                    min
                  </span>
                </button>
              ))}
              <div aria-hidden style={{ height: PAD }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
