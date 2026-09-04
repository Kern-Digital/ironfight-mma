"use client";

/**
 * Prüfseite: Hält die Popup-Regel, wenn ein MorphSwap MITTEN in der
 * Flex-Kette eines Panels sitzt? (Motion-System, Etappe 4, 2026-09-04)
 *
 * Das Kurs-Fenster auf /schedule ist die Stelle, an der der Wechsel
 * Detail ↔ Technik-Picker genau dort liegt: zwischen dem Panel
 * (`max-h-[90vh] overflow-hidden`) und dem einen Bereich, der scrollen darf.
 * Prüfen lässt es sich dort nur mit Trainer-Login — ohne Anmeldung läuft das
 * Fenster in den Fehler-Zweig und der geänderte Pfad wird nie erreicht.
 *
 * Diese Seite bildet deshalb DIESELBE Kette nach, mit denselben Klassen und
 * denselben zwei Zweigen, und ist ohne Login erreichbar. Ändert sich die
 * Kette im Kurs-Fenster, gehört sie hier mit geändert — sonst misst die
 * Seite etwas, das es nicht mehr gibt.
 *
 * Erwartung in BEIDEN Zweigen: Das Panel erreicht den 90-vh-Deckel, scrollt
 * selbst NICHT, und es gibt genau EINEN scrollenden Bereich darin.
 *
 * In Produktion 404; liegt bewusst außerhalb des Middleware-Matchers
 * (wie /dev/motion-sheet, /dev/auswahl-chips und /dev/helix).
 */

import { MorphSwap } from "@/components/motion";
import { notFound } from "next/navigation";
import { useState } from "react";

const ZEILEN = Array.from({ length: 60 }, (_, i) => i + 1);

export default function KursfensterPruefseite() {
  const [editMode, setEditMode] = useState(false);

  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main
      className="min-h-screen px-4 py-8"
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      <div className="mx-auto mb-4 flex max-w-3xl flex-col gap-2">
        <h1 style={{ font: "var(--type-h2)" }}>Kurs-Fenster — Flex-Kette</h1>
        <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
          Nachbau des Kurs-Fensters von /schedule, nur mit Dummy-Zeilen: Das
          echte Fenster braucht einen Trainer-Login, ohne den läuft es in den
          Fehler-Zweig. Auf &bdquo;Umschalten&ldquo; tippen und beim Wechsel Detail ↔
          Picker auf drei Dinge achten: Das weiße Panel bleibt gleich hoch und
          füllt den Bildschirm, es gibt nur EINEN Scrollbalken (im Listenteil,
          nicht am Panel), und die Zeile &bdquo;Knopfreihe bleibt unten&ldquo; steht immer
          noch unten im Panel. Springt eine davon, ist die Kette gerissen.
        </p>
      </div>

      {/* Panel — Maße und Klassen wie im Kurs-Fenster (app/schedule/page.tsx) */}
      <div
        className="t-card mx-auto flex max-h-[90vh] w-full flex-col overflow-hidden rounded-modal sm:max-w-xl lg:max-w-3xl"
        style={{ boxShadow: "var(--glass-shadow)" }}
      >
        <div className="flex min-h-0 flex-1 flex-col p-5">
          <div className="flex shrink-0 items-center justify-between gap-3">
            <h2
              style={{
                font: "var(--type-h2)",
                letterSpacing: "var(--ls-display)",
                textTransform: "uppercase",
              }}
            >
              {editMode ? "Technik-Picker" : "Kurs-Detail"}
            </h2>
            <button
              type="button"
              onClick={() => setEditMode((v) => !v)}
              className="t-interactive min-h-hit rounded-field px-4"
              style={{
                font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                border: "1px solid var(--accent)",
                color: "var(--accent-text)",
              }}
            >
              Umschalten
            </button>
          </div>

          <MorphSwap
            activeKey={editMode ? "picker" : "detail"}
            className="flex min-h-0 flex-1 flex-col"
            innerClassName="flex min-h-0 flex-1 flex-col"
          >
            {editMode ? (
              <>
                <div className="shrink-0 pt-4">
                  <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                    Kopf-Hinweis — behält seine Höhe (shrink-0).
                  </p>
                </div>
                <div className="mt-4 flex min-h-0 flex-1 flex-col">
                  <div className="mb-3 flex shrink-0 flex-wrap gap-1.5">
                    <span className="t-label">Filterreihe</span>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {ZEILEN.map((n) => (
                      <p
                        key={n}
                        style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                      >
                        Technik {n}
                      </p>
                    ))}
                  </div>
                  <div className="mt-4 flex shrink-0 gap-2">
                    <span className="t-label">Knopfreihe bleibt unten</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto pt-4">
                  {ZEILEN.map((n) => (
                    <p
                      key={n}
                      style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                    >
                      Detailzeile {n}
                    </p>
                  ))}
                </div>
                <div className="mt-5 flex shrink-0 flex-col gap-2">
                  <span className="t-label">Knopfreihe bleibt unten</span>
                </div>
              </>
            )}
          </MorphSwap>
        </div>
      </div>
    </main>
  );
}
