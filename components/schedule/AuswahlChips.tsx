"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import { getTechniqueById } from "@/lib/techniques";

/** Zeilen im Ruhezustand und nach dem Aufklappen. */
const ZEILEN_ZU = 2;
const ZEILEN_OFFEN = 6;

/**
 * Die gewählten Techniken als Chips unter der Liste — ein Tipp entfernt einen.
 *
 * Die Reihe SCROLLT NIE (Leon 04.09.): Vorher stand hier `max-h-32` mit
 * eigenem Scrollbalken, und bei 51 gewählten Techniken hatte das Kurs-Fenster
 * damit zwei verschachtelte Scrollbereiche — genau das, was der MOTION-BRIEF
 * §4 verbietet. Jetzt füllt die Reihe zwei Zeilen, der Rest steht hinter einem
 * Zähler-Chip.
 *
 * Auch das Aufklappen hat eine Grenze, und die ist keine Vorsicht, sondern
 * Rechnung: Die Reihe sitzt im Fenster zwischen Liste und Speichern-Zeile und
 * darf nicht schrumpfen. 51 Chips sind auf dem Handy 33 Zeilen — das Fenster
 * schneidet bei 90vh ab, und der Speichern-Knopf läge außerhalb. Sechs Zeilen
 * passen auf jedem Gerät; bleibt dann noch etwas übrig, bleibt auch der
 * Zähler stehen.
 *
 * Gemessen statt geraten: Wie viele Chips in eine Zeile passen, hängt an der
 * Fensterbreite und an der Länge der Technik-Namen. Der Effekt liest deshalb
 * `offsetTop` jedes Chips. Gemessen wird in `useLayoutEffect`, also vor dem
 * Bild — der kurze Moment, in dem alle Chips stehen, wird nie sichtbar.
 */
export default function AuswahlChips({
  ids,
  onToggle,
}: {
  ids: string[];
  onToggle: (id: string) => void;
}) {
  const [maxZeilen, setMaxZeilen] = useState(ZEILEN_ZU);
  // `messen` rendert für einen Layout-Durchgang ALLE Chips — nur so lässt
  // sich ablesen, wo die erste Zeile zu viel beginnt.
  const [messen, setMessen] = useState(true);
  const [grenze, setGrenze] = useState(ids.length);
  const reiheRef = useRef<HTMLDivElement>(null);

  // Andere Auswahl, andere Breite, anderes Zeilen-Limit → neu messen.
  useEffect(() => setMessen(true), [ids.length, maxZeilen]);
  useEffect(() => {
    const el = reiheRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setMessen(true));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = reiheRef.current;
    if (!el) return;
    const kinder = Array.from(el.children) as HTMLElement[];

    if (messen) {
      const zeilen: number[] = [];
      let ende = kinder.length;
      for (let i = 0; i < kinder.length; i++) {
        const top = kinder[i].offsetTop;
        if (!zeilen.includes(top)) zeilen.push(top);
        if (zeilen.length > maxZeilen) {
          ende = i;
          break;
        }
      }
      // Ein Platz geht an den Zähler-Chip, sobald überhaupt gekürzt wird.
      setGrenze(ende < kinder.length ? Math.max(1, ende - 1) : ende);
      setMessen(false);
      return;
    }

    // Nachkontrolle: Der Zähler-Chip ist breiter als der Chip, den er ersetzt
    // hat, und hat die Reihe doch eine Zeile zu tief gedrückt.
    const zeilen = new Set(kinder.map((k) => k.offsetTop));
    if (zeilen.size > maxZeilen && grenze > 1) setGrenze(grenze - 1);
  }, [messen, maxZeilen, grenze, ids]);

  if (ids.length === 0) return null;

  const gekuerzt = !messen && grenze < ids.length;
  const sichtbar = gekuerzt ? ids.slice(0, grenze) : ids;
  const versteckt = ids.length - sichtbar.length;

  return (
    <div className="mt-3 flex shrink-0 flex-col gap-1.5">
      <span className="t-label">Auswahl</span>
      <div ref={reiheRef} className="flex flex-wrap gap-1.5">
        {sichtbar.map((id) => {
          const t = getTechniqueById(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onToggle(id)}
              data-press="quiet"
              className="t-interactive inline-flex min-h-hit items-center gap-1.5 rounded-pill px-3.5"
              style={{
                font: "var(--type-sub)",
                background: "var(--accent-subtle)",
                color: "var(--accent-text)",
              }}
              title="Entfernen"
            >
              {t?.name ?? id}
              <Icon name="x" size={12} strokeWidth={2.4} />
            </button>
          );
        })}
        {gekuerzt && maxZeilen === ZEILEN_ZU && (
          <button
            key="mehr"
            type="button"
            onClick={() => setMaxZeilen(ZEILEN_OFFEN)}
            data-press="quiet"
            className="t-interactive inline-flex min-h-hit items-center rounded-pill px-3.5"
            style={{
              font: "var(--type-sub)",
              border: "1px solid var(--line)",
              color: "var(--text-2)",
            }}
          >
            +{versteckt} weitere
          </button>
        )}
        {/* Aufgeklappt und immer noch gekürzt: Der Zähler sagt es, ohne einen
            weiteren Klick anzubieten, der nichts mehr zeigen könnte. */}
        {gekuerzt && maxZeilen !== ZEILEN_ZU && (
          <span
            className="inline-flex min-h-hit items-center rounded-pill px-3.5"
            style={{
              font: "var(--type-sub)",
              border: "1px solid var(--line)",
              color: "var(--text-3)",
            }}
          >
            +{versteckt} weitere in der Liste oben
          </span>
        )}
        {maxZeilen !== ZEILEN_ZU && (
          <button
            key="weniger"
            type="button"
            onClick={() => setMaxZeilen(ZEILEN_ZU)}
            data-press="quiet"
            className="t-interactive inline-flex min-h-hit items-center rounded-pill px-3.5"
            style={{
              font: "var(--type-sub)",
              border: "1px solid var(--line)",
              color: "var(--text-2)",
            }}
          >
            Weniger zeigen
          </button>
        )}
      </div>
    </div>
  );
}
