"use client";

/**
 * DIE NAVIGATION IM KOPF DER HÜLLE (Leon 18.09.2026): „ich möchte den Balken
 * oben mehr nutzen. Das ‚Trainer › DeepFight' kann weg, stattdessen möchte ich
 * es interaktiver nutzen … die Interaktion soll sich je nach offener Seite
 * verändern und auffällige oder ‚große' Navigation anbieten."
 *
 * Bis dahin stand im Kopf (`StaffHeader`) ein Pfad aus `shellBreadcrumb` —
 * dieselbe Auskunft, die die Sidebar mit ihrem aktiven Feld schon gibt. Jetzt
 * ist der Platz zwischen Gym und Kurs ein SLOT, den die offene Seite füllt:
 *
 *   · `PageHead` mit `back` legt seinen Weg zurück hinein (Rang 1) — damit
 *     bekommt jede Detailseite ihren großen Zurück-Knopf, ohne dass eine
 *     Seite etwas davon weiß (Leon: „Zurück-Knöpfe nach oben").
 *   · Ein Bereich legt seine Segmente hinein (Rang 2) — der DeepFight-Bereich
 *     „DeepFight · Athleten · Gegner" aus seinem Layout. Er schlägt den
 *     Rückweg eines PageHead darunter: Auf der Detailseite eines Athleten
 *     steht „← Athleten" als gewähltes Segment, nicht zweimal.
 *   · Eine Seite mit eigener Absicht nimmt Rang 3.
 *
 * Es zeigt immer GENAU EINE Meldung — die mit dem höchsten Rang, bei Gleichstand
 * die jüngste. Mehrere Knöpfe nebeneinander aus verschiedenen Ebenen wären
 * wieder ein Pfad.
 *
 * WARUM EIN PORTAL UND KEIN ZUSTAND MIT JSX: Legte eine Seite ihr JSX per
 * `setState` in den Kontext, bekäme sie bei jedem Rendern ein neues Objekt,
 * der Kontext änderte sich, die Seite renderte neu — eine Schleife. So meldet
 * sich eine Navigation nur beim Einhängen an (Rang und Kennung, beides fest)
 * und rendert ihren Inhalt selbst, per Portal in den Slot. Der Inhalt bleibt
 * damit im React-Baum der Seite: Zustand, Kontext und Klicks wirken wie dort.
 *
 * NUR AB `lg`: Der Kopf ist darunter `hidden` (StaffHeader). Das Portal
 * landet dann in einem unsichtbaren Element — jede Seite behält deshalb ihren
 * Weg in der Seite und blendet ihn erst ab `lg` aus (`useHatKopf`).
 */

import DeepFightWordmark from "@/components/DeepFightWordmark";
import Icon from "@/components/ui/Icon";
import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type Meldung = { id: string; rang: number; seit: number };

interface KopfKontext {
  slot: HTMLElement | null;
  setSlot: (el: HTMLElement | null) => void;
  meldungen: Meldung[];
  melden: (id: string, rang: number) => void;
  abmelden: (id: string) => void;
}

const Kontext = createContext<KopfKontext | null>(null);

let zaehler = 0;

export function KopfNavigationProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [meldungen, setMeldungen] = useState<Meldung[]>([]);
  const melden = useCallback((id: string, rang: number) => {
    zaehler += 1;
    const seit = zaehler;
    setMeldungen((l) => [...l.filter((m) => m.id !== id), { id, rang, seit }]);
  }, []);
  const abmelden = useCallback((id: string) => {
    setMeldungen((l) => l.filter((m) => m.id !== id));
  }, []);
  const value = useMemo(
    () => ({ slot, setSlot, meldungen, melden, abmelden }),
    [slot, meldungen, melden, abmelden],
  );
  return <Kontext.Provider value={value}>{children}</Kontext.Provider>;
}

/**
 * Der Platz im Kopf. Leer ist er unsichtbar (`.kopf-slot:empty` in
 * globals.css) — dann fällt auch der Trennstrich zum Gym weg.
 */
export function KopfSlot() {
  const ctx = useContext(Kontext);
  return (
    <nav
      ref={ctx?.setSlot}
      aria-label="Seitennavigation"
      // Schrumpft nicht: Wenn der Platz knapp wird, gibt der Kurs rechts nach.
      className="kopf-slot flex shrink-0 items-center gap-3"
      data-kopf-slot
    />
  );
}

/**
 * Steht die Seite in einer Hülle mit Kopf? Dann blendet sie ihren eigenen Weg
 * zurück ab `lg` aus — dort liegt er im Kopf. Außerhalb (Athleten-Hülle,
 * Login) bleibt er in der Seite.
 */
export function useHatKopf(): boolean {
  return useContext(Kontext) !== null;
}

/** Legt `children` in den Kopf, solange keine Meldung mit höherem Rang steht. */
export function KopfNavigation({
  rang = 1,
  children,
}: {
  /** 1 = Rückweg eines PageHead · 2 = Bereich · 3 = Seite mit eigener Absicht. */
  rang?: number;
  children: ReactNode;
}) {
  const ctx = useContext(Kontext);
  const id = useId();
  const melden = ctx?.melden;
  const abmelden = ctx?.abmelden;

  useEffect(() => {
    if (!melden || !abmelden) return;
    melden(id, rang);
    return () => abmelden(id);
  }, [melden, abmelden, id, rang]);

  if (!ctx?.slot) return null;
  const gewinner = ctx.meldungen.reduce<Meldung | null>(
    (best, m) =>
      !best || m.rang > best.rang || (m.rang === best.rang && m.seit > best.seit) ? m : best,
    null,
  );
  if (gewinner?.id !== id) return null;
  return createPortal(children, ctx.slot);
}

// ─── Bausteine ───────────────────────────────────────────────────────────────
//
// LEON 18.09.2026, ZWEITE FASSUNG: „aktuell sieht es so aus wie einfach eine
// Leiste mit drei Buttons in die Navbar eingepresst. Die drei ‚Buttons' sollen
// sich in die Navbar smooth einfügen, man soll sie gar nicht so als Buttons
// wahrnehmen." Die erste Fassung trug eine Fläche mit Kante und eine
// Akzentfüllung am gewählten Eintrag — ein Bedienfeld IM Balken. Jetzt ist es
// Schrift IM Balken: dieselbe Größe wie die Navigation der Sidebar
// (`--type-nav-active`), keine Fläche, keine Kante, keine Hover-Tönung
// (`.kopf-link` in globals.css, `data-press="quiet"` — kein Anheben).
//
// DRITTE FASSUNG (Leon 19.09.2026): „der Strich, der das aktuelle Feld
// markiert, gefällt mir noch nicht — versuche da etwas wie links in der
// Navbar zu bauen, aber dezenter, es soll nicht genau gleich aussehen, aber zu
// dem Auswahlsymbol von dem linken passen." Der gewählte Eintrag liegt jetzt
// in einer GLAS-KAPSEL (`.kopf-lupe`) — dasselbe Material wie die Glas-Lupe
// der Sidebar (`.sb-loupe`: Milchglas, Lichtkante oben, Haarlinie aus Akzent
// und Glaskante), aber leiser: dünnerer Akzentanteil im Ring, kein Glühen,
// kein Zoom, kein eigener Weichzeichner (der Kopf ist schon Glas). Und die
// Form ist eine Kapsel statt des Zeilen-Radius — verwandt, nicht gleich. Die
// Kapsel GLEITET beim Wechsel zum neuen Eintrag (nur transform, width,
// height; bei reduzierter Bewegung ohne Übergang).

/**
 * Der Weg zurück — „← Gegner", „← Wettkampfbereich". Groß durch die Schrift
 * (Leon: „auffällige oder große Navigation"), nicht durch einen Kasten; der
 * Pfeil rückt unter dem Zeiger ein Stück nach links.
 */
export function KopfZurueck({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      data-press="quiet"
      data-kopf-zurueck
      className="kopf-link kopf-link--zurueck min-w-0"
    >
      <span className="kopf-pfeil" aria-hidden>
        <Icon name="arrow-left" size={18} strokeWidth={2.2} />
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

export interface KopfSegment {
  href: string;
  label: string;
  /** Der Eintrag der offenen Seite trägt Akzentschrift und liegt in der Glas-Kapsel. */
  aktiv: boolean;
  /**
   * Die Seite liegt UNTER diesem Eintrag (Detailseite): Der gewählte Eintrag
   * trägt dann einen Pfeil zurück — er IST der Weg zurück zur Liste.
   */
  zurueck?: boolean;
  /** Die Wortmarke statt des Wortes (DESIGN-BRIEF §1.6: untrennbar). */
  wortmarke?: boolean;
}

// Auf dem Server gibt es kein Layout — dort genügt der normale Effekt.
const useLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Die Einträge eines Bereichs als Textnavigation mit gleitender Glas-Kapsel.
 *
 * Die Kapsel misst den LINK des gewählten Eintrags (samt Innenabstand — sie
 * ist die Fläche, auf der das Wort steht). Nachgemessen wird bei jedem
 * Wechsel, bei jeder neuen Breite der Leiste (ResizeObserver) und wenn die
 * Schrift fertig geladen ist. Die ERSTE Messung setzt sie ohne Übergang an
 * ihren Platz; erst danach gleitet sie — sonst flöge sie beim Laden von links
 * herein.
 */
export function KopfSegmente({ label, segmente }: { label: string; segmente: KopfSegment[] }) {
  const leiste = useRef<HTMLDivElement>(null);
  const [lupe, setLupe] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [gleitet, setGleitet] = useState(false);
  const schluessel = segmente.map((s) => `${s.href}:${s.aktiv ? 1 : 0}:${s.zurueck ? 1 : 0}`).join("|");

  useLayout(() => {
    const el = leiste.current;
    if (!el) return;
    const messen = () => {
      const link = el.querySelector<HTMLElement>("[aria-current]");
      if (!link) {
        setLupe(null);
        return;
      }
      const r = link.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      setLupe({
        x: Math.round(r.left - b.left),
        y: Math.round(r.top - b.top),
        w: Math.round(r.width),
        h: Math.round(r.height),
      });
    };
    messen();
    const beobachter = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(messen);
    beobachter?.observe(el);
    let aktiv = true;
    void document.fonts?.ready.then(() => {
      if (aktiv) messen();
    });
    return () => {
      aktiv = false;
      beobachter?.disconnect();
    };
  }, [schluessel]);

  useEffect(() => {
    if (!lupe || gleitet) return;
    const id = requestAnimationFrame(() => setGleitet(true));
    return () => cancelAnimationFrame(id);
  }, [lupe, gleitet]);

  return (
    <div ref={leiste} role="group" aria-label={label} className="kopf-leiste">
      {/* Die Kapsel liegt HINTER den Einträgen (erstes Kind, z-index der
          Links darüber) — sonst fräße ihr Glas die Schrift. */}
      {lupe && (
        <span
          aria-hidden
          className="kopf-lupe"
          data-gleitet={gleitet || undefined}
          style={{
            transform: `translate(${lupe.x}px, ${lupe.y}px)`,
            width: `${lupe.w}px`,
            height: `${lupe.h}px`,
          }}
        />
      )}
      {segmente.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          data-press="quiet"
          data-kopf-segment={s.label}
          aria-current={s.aktiv ? (s.zurueck ? "location" : "page") : undefined}
          aria-label={s.aktiv && s.zurueck ? `${s.label} – zurück zur Liste` : undefined}
          className="kopf-link"
        >
          <span data-kopf-text className="inline-flex items-center gap-1.5">
            {s.aktiv && s.zurueck && (
              <span className="kopf-pfeil" aria-hidden>
                <Icon name="arrow-left" size={17} strokeWidth={2.2} />
              </span>
            )}
            {s.wortmarke ? <DeepFightWordmark /> : s.label}
          </span>
        </Link>
      ))}
    </div>
  );
}

/**
 * Der Rückweg eines `PageHead` — IN der Seite UND im Kopf. Ab `lg` steht er
 * nur noch im Kopf, groß (`KopfZurueck`); darunter gibt es keinen Kopf, dort
 * bleibt die kleine Zeile über dem Titel. Außerhalb der Stab-Hülle (kein Kopf)
 * steht die Zeile auf jeder Breite.
 */
export function SeitenZurueck({ href, label }: { href: string; label: string }) {
  const hatKopf = useHatKopf();
  return (
    <>
      <Link
        data-press
        href={href}
        className={`t-interactive -ml-2 mb-1 inline-flex w-fit items-center gap-1.5 rounded-field px-2 py-1 ${hatKopf ? "lg:hidden" : ""}`}
        style={{
          font: "var(--type-meta)",
          letterSpacing: "var(--ls-label)",
          textTransform: "uppercase",
          color: "var(--text-3)",
          textDecoration: "none",
        }}
      >
        <Icon name="arrow-left" size={14} strokeWidth={2.2} />
        {label}
      </Link>
      <KopfNavigation rang={1}>
        <KopfZurueck href={href} label={label} />
      </KopfNavigation>
    </>
  );
}
