"use client";

/**
 * Mehrfach-Filter mit „Alle"-Zeile — die Auswahlfelder über der Athletenliste
 * (Leons Vorgaben 03.09.2026).
 *
 * WARUM NICHT `ui/Select`: Select ist der app-weite Ersatz für ein natives
 * `<select>` — EINE Auswahl, Panel schließt beim Klick. Hier ist alles anders:
 * mehrere Werte gleichzeitig, eine „Alle"-Zeile IM Panel, und das Panel bleibt
 * beim Wählen offen. Das in Select hineinzuschalten hätte aus einer schlanken
 * Komponente eine mit zwei Betriebsarten gemacht, von denen jede die andere
 * hätte kaputtgehen lassen können. Select bleibt unangetastet.
 *
 * DIE REGELN DER AUSWAHL:
 * • Eine leere Auswahl und „alles" sind dieselbe Aussage — das spart einen
 *   Sonderzustand, den sonst jeder Leser mitdenken müsste.
 * • SOLANGE „ALLE" GILT, STEHT ES OBEN UND NICHT IN DER LISTE. Es zweimal zu
 *   zeigen wäre dieselbe Aussage doppelt; und als Listenzeile wäre es ein
 *   Schalter, der nichts umschaltet, weil er schon an ist.
 * • Sobald etwas gewählt ist, KOMMT die „Alle"-Zeile dazu — jetzt ist sie ein
 *   Weg zurück, und jetzt hat sie eine Aufgabe.
 * • Dann trägt das Feld oben nur noch den KURZNAMEN („Gruppe"). Welche Werte
 *   gewählt sind, steht in der offenen Liste; ein Feld, das sie aufzählt,
 *   müsste sie abschneiden und wäre bei jedem Klick anders breit.
 * • Mehrfachauswahl innerhalb einer Liste ist möglich; „Alle" lässt sich mit
 *   nichts kombinieren — ein Klick darauf räumt die Liste leer.
 *
 * OHNE PFEIL UND OHNE HÄKCHEN. Beide waren Zierrat: Der Pfeil sagte „hier
 * klappt etwas auf" — das sagt eine Liste, die aufklappt, bereits selbst. Das
 * Häkchen doppelte die Markierung, die die Akzentfläche ohnehin trägt.
 *
 * DAS X IST KEIN ZIERRAT (Leon 03.09.2026): Es steht NUR am zugeklappten Feld
 * und NUR, wenn dort etwas gewählt ist — dann ist es der einzige Weg, diesen
 * einen Filter zurückzunehmen, ohne ihn erst wieder aufzuklappen.
 *
 * ES IST EIN GESCHWISTER, KEIN KIND: Ein Knopf im Knopf wäre ungültiges HTML.
 * Deshalb liegt es absolut über der rechten Kante des Feldes — dasselbe
 * Muster, das `.t-row-card`/`.t-row-target` in globals.css schon nutzt. Der
 * Klick erreicht das Feld dadurch gar nicht erst, und die Liste bleibt zu.
 * Seine Fläche ist volle 44 px (DESIGN-BRIEF §1.8), sichtbar ist nur der
 * kleine Kreis darin.
 *
 * ─── DIAGONAL AUFKLAPPEN (Leons Vorgaben 03.09.2026, zwei Runden) ──────────
 *
 * Erste Runde: „Die Liste ist unten schon angezeigt, aber oben schiebt sie
 * sich noch auf die neue Breite." Ursache war die Bauweise — die Breite lief
 * über Framer-Motions `layout`, das Panel über `AnimatePresence`: zwei
 * Animationen ohne gemeinsame Uhr. Das Panel stand in voller Breite, während
 * das Feld darüber noch wuchs.
 *
 * Zweite Runde: Eine KETTE (erst breit, dann auf) behob das, dauerte aber
 * doppelt so lange. Leons Vorgabe: „starte es diagonal — je mehr es nach
 * rechts geht, geht es auch schon nach unten, sodass sie beide zeitgleich
 * max rechts und max unten ankommen."
 *
 * Jetzt laufen beide Wege PARALLEL AUF EINER UHR: dieselbe Dauer, dieselbe
 * Kurve (`DAUER` / `KURVE` weiter unten). Die Breite animiert das Feld, die
 * Höhe animiert das Panel — und weil das Panel `inset-inline: 0` am Feld
 * hängt, wächst es in der Breite automatisch mit. Der Punkt unten rechts
 * bewegt sich damit auf einer Diagonalen und kommt in beiden Richtungen
 * gleichzeitig an.
 *
 * DIE HÖHE GEHT AUF `auto`, NICHT AUF EINEN PIXELWERT: Wie hoch die Liste
 * wird, hängt an Einträgen, Spaltenzahl und Schriftgröße — jede feste Zahl
 * wäre irgendwann falsch. Framer misst das selbst; der Rahmen clippt während
 * des Wachsens (`.mf-panel` ist `overflow: hidden`, der Scroller sitzt eine
 * Ebene tiefer in `.mf-panel-inner`). Ohne diese zwei Ebenen blitzte
 * mitten in der Bewegung ein Rollbalken auf.
 *
 * Die Ruhebreite steht deshalb als GEMESSENE Zahl statt als `max-content`:
 * Animieren lässt sich nur, was einen Wert hat.
 *
 * ─── ZWEISPALTIG AB NEUN EINTRÄGEN (Leon 03.09.2026) ───────────────────────
 *
 * Lange Listen — die Kurse sind achtzehn — werden sonst zur Rolltreppe. Ab
 * neun Einträgen wird das Panel zweispaltig, und das ganze Feld wächst mit.
 * Die Spalten kommen aus `auto-fit`/`minmax` und NICHT aus einer festen Zwei:
 * Auf einem schmalen Bildschirm bleibt so von selbst EINE Spalte übrig, statt
 * zwei unlesbar schmale.
 *
 * DER INHALT LIEGT VON ANFANG AN IN SEINER ENDBREITE — der Rahmen gibt ihn
 * nur frei. Ohne das sprang das Raster MITTEN in der Bewegung von einer auf
 * zwei Spalten (gemessen: bei 77 % der Breite), und die halb sichtbare Liste
 * ordnete sich vor den Augen neu. Deshalb wird die Zielbreite EINMAL beim
 * Öffnen bestimmt (`offenBreite`, gedeckelt auf den vorhandenen Platz) und
 * dann an zwei Stellen benutzt: als Ziel der Breiten-Animation und als feste
 * Breite des Inhalts. Was wächst, ist ausschließlich das Fenster davor.
 *
 * ─── PLATZNOT: DIE ANDEREN RÜCKEN ZUSAMMEN ─────────────────────────────────
 *
 * Ist eines der Felder offen und damit breit, tragen die übrigen nur noch
 * ihren Kurznamen — „Kurs" statt „Alle Kurse". Das ist die Antwort auf „lass
 * die anderen Suchleisten schmaler poppen, solange die große geöffnet ist":
 * Sie schrumpfen sichtbar, bleiben aber lesbar. Gesteuert wird das von der
 * Seite — sie weiß als Einzige, ob ein Geschwister offen ist — über
 * `gedraengt`.
 */

import Icon from "@/components/ui/Icon";
// AUSNAHME vom „kein framer-motion außerhalb components/motion/"
// (MOTION-BRIEF §3.1): Das Aufklappen der Filter-Matrix IST diese
// Komponente — `layout` plus `AnimatePresence` sind ihr Inhalt, nicht ihr
// Schmuck. Ein Baustein dafür hätte genau einen Aufrufer.
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type MultiFilterOption = { value: string; label: string };

/** Ab hier lohnen zwei Spalten (Leons Vorgabe: „mehr wie acht"). */
const ZWEISPALTIG_AB = 9;
/** EINE Uhr für Breite und Höhe — sonst kommen sie nicht gemeinsam an. */
const DAUER = 0.28;
const KURVE = [0.2, 0.8, 0.2, 1] as const;
/** Breite des offenen Feldes — einspaltig und zweispaltig. */
const BREITE_OFFEN = 260;
const BREITE_OFFEN_ZWEISPALTIG = 470;

export default function MultiFilter({
  label,
  kurzname,
  options,
  value,
  onChange,
  gedraengt = false,
  onOpenChange,
}: {
  /** „Alle Kurse", „Alle Disziplinen" … — solange nichts gewählt ist. */
  label: string;
  /** „Kurs", „Disziplin", „Gruppe" — sobald etwas gewählt ist. */
  kurzname: string;
  options: MultiFilterOption[];
  value: string[];
  onChange: (v: string[]) => void;
  /** Ein Geschwister-Feld ist offen — dieses hier macht sich schmal. */
  gedraengt?: boolean;
  /** Meldet der Seite, ob dieses Feld gerade offen ist. */
  onOpenChange?: (offen: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [ruheBreite, setRuheBreite] = useState<number | null>(null);
  // Beim Öffnen einmal festgelegt und danach unverändert — siehe Kopf.
  const [offenBreite, setOffenBreite] = useState(BREITE_OFFEN);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const alleAktiv = value.length === 0;
  const zweispaltig = options.length >= ZWEISPALTIG_AB;
  const zielBreite = zweispaltig ? BREITE_OFFEN_ZWEISPALTIG : BREITE_OFFEN;

  // Solange „alles" gilt, die volle Beschriftung — außer ein anderes Feld ist
  // offen und braucht den Platz.
  const anzeige = alleAktiv ? (gedraengt ? kurzname : label) : kurzname;
  // Das X gehört zum RUHENDEN Feld mit Auswahl — offen führt die „Alle"-Zeile
  // im Panel zurück, dort wäre es ein zweiter Weg für dieselbe Sache.
  const zeigeX = !alleAktiv && !open;

  /**
   * Die Ruhebreite MESSEN statt zu raten: Das Feld ist genau so breit wie
   * seine Beschriftung, und die wechselt (Label ↔ Kurzname). `max-content`
   * kurz setzen, ablesen, zurücksetzen — in einem Layout-Effekt, also vor dem
   * nächsten Bild und damit ohne sichtbares Zucken.
   */
  useLayoutEffect(() => {
    if (open) return;
    const el = rootRef.current;
    if (!el) return;
    const vorher = el.style.width;
    el.style.width = "max-content";
    const gemessen = Math.ceil(el.getBoundingClientRect().width);
    el.style.width = vorher;
    setRuheBreite((v) => (v === gemessen ? v : gemessen));
    // `zeigeX` gehört in die Abhängigkeiten: Das X bringt eigene Polsterung
    // mit, und die zählt zur Ruhebreite.
  }, [anzeige, open, zeigeX]);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  /**
   * Wie breit darf das Feld offen werden? So breit wie gewünscht — höchstens
   * aber so breit wie die Zeile, in der es steht. Einmal beim Öffnen
   * bestimmt, damit der Inhalt dahinter nicht umbricht.
   */
  useLayoutEffect(() => {
    if (!open) return;
    const platz = rootRef.current?.parentElement?.clientWidth ?? zielBreite;
    setOffenBreite(Math.min(zielBreite, platz));
  }, [open, zielBreite]);

  // Klick daneben und Escape schließen — dasselbe Muster wie in ui/Select.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /**
   * Pfeiltasten im Panel — dasselbe Muster wie in `ui/Select`. Ein
   * `role="listbox"` ohne Pfeilnavigation wäre eine Rolle, die etwas
   * verspricht, das die Tastatur nicht einlöst; die Zeilen sind echte Knöpfe,
   * Enter und Leertaste tun also ohnehin das Richtige.
   */
  function panelTasten(e: React.KeyboardEvent) {
    const zeilen = Array.from(
      panelRef.current?.querySelectorAll<HTMLButtonElement>(".mf-row") ?? [],
    );
    if (zeilen.length === 0) return;
    const jetzt = zeilen.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      zeilen[Math.min(zeilen.length - 1, jetzt + 1)]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      zeilen[Math.max(0, jetzt - 1)]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      zeilen[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      zeilen[zeilen.length - 1]?.focus();
    }
  }

  function umschalten(v: string) {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  }

  return (
    <motion.div
      ref={rootRef}
      className="mf-root"
      data-open={open || undefined}
      data-aktiv={!alleAktiv || undefined}
      initial={false}
      animate={{ width: open ? offenBreite : (ruheBreite ?? 160) }}
      transition={
        reduced ? { duration: 0 } : { duration: DAUER, ease: [...KURVE] }
      }
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="mf-trigger"
        data-mit-x={zeigeX || undefined}
      >
        <span className="mf-trigger-text">{anzeige}</span>
      </button>

      {zeigeX && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="mf-clear"
          aria-label={`${kurzname}-Filter zurücksetzen`}
          title={`${kurzname}-Filter zurücksetzen`}
        >
          <span aria-hidden className="mf-clear-kreis">
            <Icon name="x" size={13} strokeWidth={2.6} />
          </span>
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            className="mf-panel"
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={
              reduced ? { duration: 0 } : { duration: DAUER, ease: [...KURVE] }
            }
          >
            {/* FESTE BREITE, damit das Raster während des Aufklappens nicht
                umbricht (siehe Kopf). −2 px für die beiden Rahmenlinien des
                Fensters, in dem dieser Block sitzt. */}
            <div
              role="listbox"
              aria-multiselectable
              aria-label={label}
              ref={panelRef}
              onKeyDown={panelTasten}
              className="mf-panel-inner"
              data-zweispaltig={zweispaltig || undefined}
              style={{ width: offenBreite - 2 }}
            >
            {/* Die „Alle"-Zeile erscheint ERST, wenn etwas gewählt ist —
                vorher steht sie oben im Feld und wäre hier eine Wiederholung.
                Sie räumt die Auswahl leer, statt einen eigenen Wert zu setzen:
                „nichts gewählt" IST „alles". Über beide Spalten, weil sie
                keine Kategorie ist, sondern deren Aus-Schalter. */}
            {!alleAktiv && (
              <>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => onChange([])}
                  className="mf-row mf-row-voll"
                >
                  <span className="truncate">{label}</span>
                </button>
                <span aria-hidden className="mf-trenner mf-row-voll" />
              </>
            )}

            {options.map((o) => {
              const gewaehlt = value.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={gewaehlt}
                  onClick={() => umschalten(o.value)}
                  className="mf-row"
                  data-gewaehlt={gewaehlt || undefined}
                >
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
