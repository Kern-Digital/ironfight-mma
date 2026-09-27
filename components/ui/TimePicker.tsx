"use client";

/**
 * UHRZEIT WÄHLEN — EIN Feld, darin Stunde und Minute nebeneinander.
 *
 * Leon 27.09.2026, in zwei Schritten:
 *   1. „ich möchte wenn ich zeit ändern kann dass das menü so aussieht. nur
 *      ohne am pm" (Vorlage: shadcn-„time-picker", Stunde : Minute).
 *   2. Nach dem ersten Bau mit zwei getrennten Auswahlfeldern: „ich will bei
 *      einer uhrzeit nur einen bereich zum klicken haben, also std und min
 *      zsm auswählen und die ausgewählte uhrzeit soll einfach hinterlegt sein
 *      und nicht ein haken."
 *
 * Deshalb: EIN Knopf zeigt „18:30". Er öffnet ein Fenster mit zwei Spalten —
 * Stunden links, Minuten rechts. Die gewählte Stunde und Minute sind
 * HINTERLEGT (Akzentfläche), es gibt keinen Haken. Ein Tipp auf die Stunde
 * lässt das Fenster offen, ein Tipp auf die Minute schließt es — wer nur die
 * Stunde ändert, schließt mit Klick daneben oder Escape.
 *
 * WARUM NICHT DIE VORLAGE SELBST: Sie bringt Radix-Select, cva,
 * `motion/react` und eigene `--hu-*`-Farben mit. Hier gilt das Token-System,
 * `motion` nur über components/motion (MOTION-BRIEF) — das Fenster klappt
 * deshalb mit `Pop` auf, wie das Panel von components/ui/Select.tsx.
 *
 * ANDERS ALS DIE VORLAGE: 24 Stunden, kein AM/PM · Minuten in 5er-Schritten
 * (eine schon gespeicherte andere Minute wie 17:01 bleibt wählbar) · kein
 * „Set Current Time" — für einen Wochenplan ergibt „jetzt" nichts.
 *
 * Wert rein und raus als "HH:MM" (wie `<input type="time">`), damit die
 * Prüfung in lib/kursplan.ts unverändert bleibt.
 */

import Icon from "@/components/ui/Icon";
import { Pop } from "@/components/motion";
import { useCallback, useEffect, useRef, useState } from "react";

const STUNDEN = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
const MINUTEN = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

function Spalte({
  werte,
  gewaehlt,
  onWahl,
  label,
  offen,
}: {
  werte: string[];
  gewaehlt: string;
  onWahl: (wert: string) => void;
  label: string;
  offen: boolean;
}) {
  const liste = useRef<HTMLDivElement>(null);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Beim Öffnen steht der gewählte Wert in der Mitte der Spalte.
  useEffect(() => {
    if (!offen) return;
    requestAnimationFrame(() => {
      const el = refs.current[gewaehlt];
      const box = liste.current;
      if (el && box) box.scrollTop = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2;
    });
    // nur beim Öffnen, nicht bei jeder Wahl — sonst springt die Spalte unter dem Finger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offen]);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <span
        className="px-2 pb-1 pt-2 text-center"
        style={{ font: "var(--type-meta)", letterSpacing: "var(--ls-label)", textTransform: "uppercase", color: "var(--text-3)" }}
      >
        {label}
      </span>
      <div
        ref={liste}
        role="listbox"
        aria-label={label}
        className="relative overflow-y-auto px-1 pb-1"
        style={{ maxHeight: "min(232px, 40vh)" }}
      >
        {werte.map((w) => {
          const an = w === gewaehlt;
          return (
            <button
              key={w}
              ref={(el) => {
                refs.current[w] = el;
              }}
              type="button"
              role="option"
              aria-selected={an}
              onClick={() => onWahl(w)}
              className="t-interactive flex min-h-[40px] w-full items-center justify-center rounded-badge tabular-nums"
              style={{
                font: "var(--type-body)",
                // Hinterlegt statt Haken (Leon 27.09.). `background` nur beim
                // gewählten Wert setzen — sonst schlüge der Inline-Stil den
                // Hover-Zustand aus .t-interactive.
                background: an ? "var(--accent-subtle)" : undefined,
                color: an ? "var(--accent-text)" : "var(--text-body)",
                fontWeight: an ? 600 : undefined,
              }}
              data-wert={w}
            >
              {w}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function TimePicker({
  value,
  onChange,
  ariaLabel,
}: {
  /** "HH:MM" */
  value: string;
  onChange: (value: string) => void;
  /** Wofür die Uhrzeit steht, z. B. „Beginn am Mittwoch". */
  ariaLabel: string;
}) {
  const [offen, setOffen] = useState(false);
  const wurzel = useRef<HTMLDivElement>(null);
  const knopf = useRef<HTMLButtonElement>(null);

  const gueltig = /^\d{2}:\d{2}$/.test(value);
  const [h, m] = gueltig ? value.split(":") : ["18", "00"];
  const minuten = MINUTEN.includes(m) ? MINUTEN : [...MINUTEN, m].sort();

  const schliessen = useCallback((fokusZurueck: boolean) => {
    setOffen(false);
    if (fokusZurueck) knopf.current?.focus();
  }, []);

  // Klick daneben schließt; Escape schließt NUR das Fenster (nicht das Sheet
  // drumherum) und gibt den Fokus an das Feld zurück.
  useEffect(() => {
    if (!offen) return;
    const weg = (e: PointerEvent) => {
      if (!wurzel.current?.contains(e.target as Node)) schliessen(false);
    };
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        schliessen(true);
      }
    };
    window.addEventListener("pointerdown", weg);
    window.addEventListener("keydown", taste, true);
    return () => {
      window.removeEventListener("pointerdown", weg);
      window.removeEventListener("keydown", taste, true);
    };
  }, [offen, schliessen]);

  return (
    <div ref={wurzel} className="relative" data-uhrzeit={value}>
      <button
        ref={knopf}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={offen}
        aria-label={`${ariaLabel}: ${gueltig ? value : "keine Uhrzeit"}`}
        onClick={() => setOffen((v) => !v)}
        className="t-interactive flex min-h-hit w-[96px] items-center justify-between gap-1.5 px-3 tabular-nums"
        style={{
          font: "var(--type-body)",
          background: offen ? "var(--bg-2)" : "var(--surface-raised)",
          border: `1px solid ${offen ? "var(--line-strong)" : "var(--line)"}`,
          borderRadius: "var(--r-md)",
          color: "var(--text-body)",
          transform: offen ? "none" : undefined,
        }}
        data-uhrzeit-knopf
      >
        <span>{gueltig ? value : "--:--"}</span>
        <span
          aria-hidden
          style={{
            color: "var(--text-3)",
            transform: offen ? "rotate(180deg)" : "none",
            transition: "transform var(--dur-fast) var(--ease-out)",
            lineHeight: 0,
          }}
        >
          <Icon name="chevron-down" size={14} strokeWidth={2.2} />
        </span>
      </button>

      <Pop
        open={offen}
        role="dialog"
        aria-label={ariaLabel}
        className="absolute left-0 top-full z-40 mt-1 flex w-[176px]"
        style={{
          background: "var(--bg-2)",
          border: "1px solid var(--line-strong)",
          borderRadius: "var(--r-md)",
          boxShadow: "var(--glass-shadow)",
        }}
        data-uhrzeit-fenster
      >
        <Spalte werte={STUNDEN} gewaehlt={h} label="Std" offen={offen} onWahl={(neu) => onChange(`${neu}:${m}`)} />
        <div aria-hidden className="my-2 w-px" style={{ background: "var(--line)" }} />
        <Spalte
          werte={minuten}
          gewaehlt={m}
          label="Min"
          offen={offen}
          onWahl={(neu) => {
            onChange(`${h}:${neu}`);
            schliessen(true);
          }}
        />
      </Pop>
    </div>
  );
}
