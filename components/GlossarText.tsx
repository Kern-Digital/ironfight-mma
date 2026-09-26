"use client";

/**
 * Fachwörter im Fließtext erklären.
 *
 * Ein Einsteiger stolpert über „Clinch" und „Rahmen", bevor er über die
 * Übung stolpert. Markierte Wörter sind antippbar und öffnen ein kleines
 * Fenster mit zwei Sätzen Erklärung.
 *
 * Zwei Teile:
 *   • `GlossarProvider` — hält den offenen Begriff und rendert das Fenster
 *     GENAU EINMAL, ganz außen. Nötig, weil `SheetShell` ein `div` ist und
 *     ein `div` in einem `<p>` ungültiges HTML wäre. Ohne Provider fallen
 *     alle Wörter still auf reinen Text zurück.
 *   • `GlossarText` — zerlegt den Text und rendert die Wörter.
 *
 * Markierung siehe lib/glossar.ts: `{{clinch}}` oder `{{clinch|im Clinch}}`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { SheetShell, useLetzterWert } from "@/components/motion";
import XKnopf from "@/components/ui/XKnopf";
import Icon from "@/components/ui/Icon";
import { getBegriff, zerlegeText, type GlossarBegriff } from "@/lib/glossar";

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

type GlossarKontext = { oeffne: (b: GlossarBegriff) => void } | null;

const Kontext = createContext<GlossarKontext>(null);

export function GlossarProvider({ children }: { children: ReactNode }) {
  const [offen, setOffen] = useState<GlossarBegriff | null>(null);
  const oeffne = useCallback((b: GlossarBegriff) => setOffen(b), []);
  const wert = useMemo(() => ({ oeffne }), [oeffne]);

  // Beim Schließen läuft die Ausblend-Bewegung noch — der letzte Begriff
  // muss so lange stehen bleiben, sonst leert sich das Fenster ruckartig.
  const sichtbar = useLetzterWert(offen);

  // `SheetShell` bringt KEIN Escape mit (gemessen). Ein Begriffs-Fenster ist
  // ein Zwischenruf im Lesefluss — wer es öffnet, will mit einem Griff zurück.
  useEffect(() => {
    if (!offen) return;
    const zu = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOffen(null);
    };
    window.addEventListener("keydown", zu);
    return () => window.removeEventListener("keydown", zu);
  }, [offen]);

  return (
    <Kontext.Provider value={wert}>
      {children}
      <SheetShell
        open={offen !== null}
        onClose={() => setOffen(null)}
        label={sichtbar ? `Begriff: ${sichtbar.begriff}` : "Begriff"}
        zIndex={70}
        panelClassName="pointer-events-auto relative flex w-full max-h-[70vh] flex-col overflow-hidden rounded-t-[var(--r-xl)] sm:max-w-md sm:rounded-[var(--r-xl)]"
        panelStyle={{
          maxHeight: "70dvh",
          background: "var(--surface-card)",
          border: "1px solid transparent",
          boxShadow: "var(--glass-shadow)",
        }}
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-3">
          <div className="flex flex-col items-start">
            <div
              aria-hidden
              className="mb-2 h-1 w-10 rounded-full sm:invisible"
              style={{ background: "var(--line-strong)" }}
            />
            <span className="t-label">Begriff</span>
          </div>
          <XKnopf
            onClick={() => setOffen(null)}
            ariaLabel="Schließen"
            wort="Schließen"
            drehung="roll"
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-6 pt-3">
          <h2
            style={{
              font: "var(--type-title)",
              letterSpacing: "var(--ls-display)",
              textTransform: "uppercase",
            }}
          >
            {sichtbar?.begriff}
          </h2>

          {sichtbar?.auchGenannt?.length ? (
            <span style={{ ...META_FONT, color: "var(--text-3)" }}>
              Auch: {sichtbar.auchGenannt.join(" · ")}
            </span>
          ) : null}

          <p style={{ font: "var(--type-body)", color: "var(--text-2)" }}>
            {sichtbar?.kurz}
          </p>

          {sichtbar?.siehe?.length ? (
            <div className="flex flex-col gap-1.5">
              <span style={{ ...META_FONT, color: "var(--text-3)" }}>
                Passt dazu
              </span>
              <div className="flex flex-wrap gap-2">
                {sichtbar.siehe.map((id) => {
                  const b = getBegriff(id);
                  if (!b) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      data-press="quiet"
                      onClick={() => setOffen(b)}
                      className="t-glass t-interactive rounded-field px-3 py-1.5"
                      style={{
                        font: "var(--type-body)",
                        color: "var(--text-2)",
                      }}
                    >
                      {b.begriff}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {sichtbar?.techniqueId ? (
            <Link
              data-press="quiet"
              href={`/techniques/${sichtbar.techniqueId}`}
              onClick={() => setOffen(null)}
              className="inline-flex items-center gap-1.5 self-start"
              style={{
                font: "var(--type-body)",
                color: "var(--accent-text)",
                textDecoration: "none",
              }}
            >
              Ganze Technik ansehen
              <Icon name="arrow-right" size={14} strokeWidth={2.2} />
            </Link>
          ) : null}
        </div>
      </SheetShell>
    </Kontext.Provider>
  );
}

/**
 * Text mit erklärten Fachwörtern.
 *
 * Rendert ein Fragment, kein Element — der Aufrufer bestimmt also selbst,
 * ob daraus ein `<p>`, ein `<li>` oder eine Tabellenzelle wird.
 */
export function GlossarText({ children }: { children: string }) {
  const kontext = useContext(Kontext);
  const stuecke = useMemo(() => zerlegeText(children), [children]);

  return (
    <>
      {stuecke.map((s, i) =>
        s.begriff && kontext ? (
          <button
            key={`${s.begriff.id}-${i}`}
            type="button"
            data-press="quiet"
            onClick={() => kontext.oeffne(s.begriff!)}
            // Gestrichelte Linie statt Farbe allein — sonst wäre die
            // Antippbarkeit für Farbenblinde unsichtbar.
            style={{
              font: "inherit",
              color: "var(--accent-text)",
              textDecorationLine: "underline",
              textDecorationStyle: "dashed",
              textUnderlineOffset: "3px",
              textDecorationThickness: "1px",
            }}
            aria-label={`${s.text} — Begriff erklären`}
          >
            {s.text}
          </button>
        ) : (
          <span key={`t-${i}`}>{s.text}</span>
        ),
      )}
    </>
  );
}

export default GlossarText;
