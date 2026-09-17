"use client";

/**
 * TECHNIKEN UND ÜBUNGEN EINER PHASE TAUSCHEN (Leon 17.09.2026, Stufe 3:
 * „Techniken tauschen", Deckel „Höchstens 12").
 *
 * Eine Liste, zwei Wege hinein und hinaus: Was drin ist, steht als Kachel mit
 * dem X der App daneben (components/ui/XKnopf — Leon 16.09.: „wende das bei
 * allen X in der App an"). Was dazukommt, kommt über die Gooey-Suche
 * (components/ui/GooeySearch, der Standard für JEDES Suchfeld).
 *
 * WARUM DIE TREFFER ERST MIT DER SUCHE ERSCHEINEN: Ein Boxkampf hat 26
 * wählbare Techniken, MMA 58. Eine offene Liste stünde als Wand unter jeder
 * Phase und schöbe Speichern aus dem Bild; die Suche hält den Editor so hoch
 * wie in Stufe 1 und wird erst groß, wenn der Trainer sie braucht.
 *
 * DIE REIHENFOLGE DER GEWÄHLTEN BLEIBT: Neues hängt sich hinten an, statt sich
 * einzusortieren. Der Trainer soll sehen, was er gerade getan hat — und der
 * Plan liest sich von oben nach unten wie der Generator ihn schrieb.
 */

import { useMemo, useState } from "react";
import GooeySearch from "@/components/ui/GooeySearch";
import Icon from "@/components/ui/Icon";
import XKnopf from "@/components/ui/XKnopf";
import { PHASE_GRENZEN } from "@/lib/fight-camp";

export interface WahlEintrag {
  id: string;
  name: string;
  /** Kurze Einordnung neben dem Namen, z. B. „Boxing" oder „Kondition". */
  meta: string;
}

/** Höchstens so viele Treffer stehen unter der Suche — der Rest kommt über Tippen. */
const TREFFER_MAX = 8;

/**
 * Für den Vergleich zählen nur Buchstaben und Ziffern: Wer „double leg" tippt,
 * findet das „Double-Leg Takedown", und „Wing Tsung" trifft auch „Wing-Tsung".
 * Ein Trainer schreibt die Bindestriche der Bibliothek nicht mit.
 *
 * Bewusst OHNE `\p{L}` und Flag `u`: Das tsconfig-Ziel dieser App ist ES5, und
 * TypeScript lehnt Unicode-Eigenschaften dort ab (TS1501). Die Bibliothek
 * schreibt deutsch und englisch — die Umlaute stehen darum in der Klasse.
 */
function schlicht(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9äöüß]+/g, " ").trim();
}

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

export default function InhaltsWahl({
  titel,
  feld,
  katalog,
  gewaehlt,
  onChange,
  suchLabel,
  platzhalter,
  leerText,
}: {
  titel: string;
  /** Marke für Messung und Tests: „techniken" bzw. „uebungen". */
  feld: string;
  katalog: WahlEintrag[];
  gewaehlt: string[];
  onChange: (ids: string[]) => void;
  suchLabel: string;
  platzhalter: string;
  /** Steht da, solange die Phase hier nichts trägt. */
  leerText: string;
}) {
  const [suche, setSuche] = useState("");
  const nachId = useMemo(() => new Map(katalog.map((e) => [e.id, e])), [katalog]);
  const voll = gewaehlt.length >= PHASE_GRENZEN.inhalteMax;

  const treffer = useMemo(() => {
    const nadel = schlicht(suche);
    if (!nadel) return [];
    return katalog
      .filter(
        (e) =>
          !gewaehlt.includes(e.id) &&
          (schlicht(e.name).includes(nadel) || schlicht(e.meta).includes(nadel)),
      )
      .slice(0, TREFFER_MAX);
  }, [suche, katalog, gewaehlt]);

  function dazu(id: string) {
    if (voll || gewaehlt.includes(id)) return;
    onChange([...gewaehlt, id]);
    setSuche("");
  }

  return (
    <div className="flex flex-col gap-2" data-wahl={feld}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="t-label">{titel}</span>
        <span
          data-anzahl={gewaehlt.length}
          style={{ ...META_FONT, color: voll ? "var(--accent-text)" : "var(--text-3)" }}
        >
          {gewaehlt.length} von {PHASE_GRENZEN.inhalteMax}
        </span>
      </div>

      {gewaehlt.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {gewaehlt.map((id) => (
            <span
              key={id}
              data-gewaehlt={id}
              className="inline-flex items-center gap-0.5 rounded-pill py-0.5 pl-3 pr-0.5"
              style={{
                font: "var(--type-sub)",
                background: "var(--surface-raised)",
                border: "1px solid var(--line)",
                color: "var(--text-body)",
              }}
            >
              {nachId.get(id)?.name ?? id}
              <XKnopf
                onClick={() => onChange(gewaehlt.filter((x) => x !== id))}
                ariaLabel={`${nachId.get(id)?.name ?? id} aus der Phase nehmen`}
                wort="Raus"
                drehung="viertel"
                dataAktion={`wahl-raus-${feld}`}
                size={20}
                strokeWidth={3}
                style={{ color: "var(--text-3)" }}
              />
            </span>
          ))}
        </div>
      ) : (
        <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>{leerText}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <GooeySearch
          value={suche}
          onChange={setSuche}
          label={suchLabel}
          placeholder={platzhalter}
          breiteZu={168}
          breiteAuf={260}
        />
        {voll && (
          <span data-wahl-voll={feld} style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
            Zwölf ist das Maximum — nimm erst eine raus.
          </span>
        )}
      </div>

      {!voll && suche.trim().length > 0 && (
        <div className="flex flex-wrap gap-1.5" data-treffer-liste={feld}>
          {treffer.length > 0 ? (
            treffer.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => dazu(e.id)}
                data-press
                data-treffer={e.id}
                className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-pill px-3"
                style={{
                  font: "var(--type-sub)",
                  background: "var(--accent-subtle)",
                  border: "1px solid color-mix(in oklab, var(--accent) 40%, transparent)",
                  color: "var(--accent-text)",
                }}
              >
                <Icon name="plus" size={14} strokeWidth={2.6} />
                {e.name}
                <span style={{ ...META_FONT, opacity: 0.7 }}>{e.meta}</span>
              </button>
            ))
          ) : (
            <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              Dazu hat die Bibliothek nichts — probier einen anderen Namen.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
