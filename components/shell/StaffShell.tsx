"use client";

/**
 * Die Hülle der Stab-Rollen — Trainer, Verwaltung, Plattform-Admin.
 *
 * Leons Vorgabe vom 01.09.2026: Am Desktop steht links eine Sidebar,
 * **Navbar und Footer fallen ersatzlos weg**. Auf dem Handy ist dieselbe
 * Sidebar eine Schublade von links, dazu die Bottom-Bar, die der
 * Athleten-Bereich schon hat (Leons Entscheidung 01.09.).
 *
 * DIE GRENZE LIEGT BEI `lg` (1024 px) und nicht irgendwo eigens Erfundenem:
 * Das ist die Breite, ab der die Seiten dieser App ohnehin auf ihre große
 * Fassung umschalten (`max-w-2xl` → `lg:max-w-5xl`). Zwei verschiedene
 * Umbruchpunkte hätten einen Bereich erzeugt, in dem die Seite schon breit
 * ist, die Hülle aber noch schmal — oder umgekehrt.
 *
 * INHALTSBREITE (Leons Entscheidung 01.09.): Die Seiten behalten ihre Maße
 * und stehen MITTIG im Platz rechts vom Menü. Deshalb bekommt der Inhalt hier
 * nur `flex-1` und keine eigene Breite — bei 1440 px bleiben 1180 px, in
 * denen sich `lg:max-w-5xl` von selbst zentriert. Das ist der Grund, warum
 * die 26 verbleibenden Coach-Seiten beim Rollout nur den Token-Look brauchen
 * und keine neuen Breiten.
 *
 * Der Menü-Knopf sitzt auf dem Handy IN der Bottom-Bar und nicht als
 * schwebender Knopf über dem Inhalt: Ohne Header gibt es oben keinen freien
 * Platz, und unten ist er mit dem Daumen erreichbar.
 */

import AthleteTabBar from "@/components/AthleteTabBar";
import GymGesperrtStreifen from "@/components/shell/GymGesperrtStreifen";
import StaffHeader from "@/components/shell/StaffHeader";
import { KopfNavigationProvider } from "@/components/shell/KopfNavigation";
import StaffSidebar from "@/components/shell/StaffSidebar";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const ANGEHEFTET_KEY = "ta-sidebar-angeheftet";

export default function StaffShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Ein Seitenwechsel schließt die Schublade. Ohne das bliebe sie nach jedem
  // Klick offen über der neuen Seite stehen.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Escape schließt, und der Hintergrund darf nicht mitscrollen (dasselbe
  // Muster wie das alte Vollbild-Menü der Navbar).
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [drawerOpen]);

  // ─── Ein- und Ausklappen der Leiste (Leon 30.09.2026) ─────────────────────
  // Offen ist sie, solange die Maus darauf steht, die Tastatur in ihr
  // arbeitet oder ihr Konto-Panel offen ist. Mit HOVER-ABSICHT: Sie öffnet
  // erst nach einem kurzen Verweilen und schließt mit etwas Nachlauf. Wer
  // die Maus nur über den linken Rand zieht, soll kein Menü aufreißen, und
  // wer kurz über die Kante rutscht, soll es nicht verlieren.
  const leisteRef = useRef<HTMLElement>(null);
  const [maus, setMaus] = useState(false);
  const [fokus, setFokus] = useState(false);
  const [panel, setPanel] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const absicht = useCallback((drauf: boolean) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMaus(drauf), drauf ? 110 : 260);
  }, []);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // Ohne feinen Zeiger (Tablet quer) gibt es kein Hover — die Leiste bliebe
  // für immer zu. Dort steht sie deshalb offen, wie vor dem 30.09.
  const [hatMaus, setHatMaus] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const pruefen = () => setHatMaus(mq.matches);
    pruefen();
    mq.addEventListener("change", pruefen);
    return () => mq.removeEventListener("change", pruefen);
  }, []);

  // ANHEFTEN (Leon 30.09.): Angeheftet steht die Leiste offen IM FLUSS, die
  // Seiten rücken zur Seite. Gemerkt im Browser — wer sie mag, heftet sie
  // einmal an und hat sie überall so. Die Hülle wird erst nach dem Laden
  // des Profils gezeigt (AppShell), der Server rendert sie nie: Den
  // gespeicherten Wert gleich beim ersten Rendern zu lesen, erzeugt deshalb
  // keinen Hydrations-Unterschied, und die Leiste springt nicht nach.
  const [angeheftet, setAngeheftet] = useState(() => {
    try {
      return window.localStorage.getItem(ANGEHEFTET_KEY) === "1";
    } catch {
      return false;
    }
  });
  const anheften = useCallback(() => {
    setAngeheftet((v) => {
      try {
        window.localStorage.setItem(ANGEHEFTET_KEY, v ? "0" : "1");
      } catch {
        // Ohne Speicher gilt es eben nur bis zum Neuladen.
      }
      return !v;
    });
  }, []);

  const sbZustand =
    !hatMaus || angeheftet ? "fest" : maus || fokus || panel ? "offen" : "zu";

  return (
    <>
      {/* Der Grund liegt HINTER allem und füllt das ganze Fenster (Leon
          01.09.). Er ist die Voraussetzung für das Glas von Sidebar und Kopf:
          Vor einer gleichmäßigen Fläche wäre eine Milchscheibe von einer Wand
          nicht zu unterscheiden. Maße und Bewegung stehen in globals.css unter
          `.shell-ambient`. */}
      <div aria-hidden className="shell-ambient" />

      <div className="staff-huelle relative z-10 flex flex-1" data-sb={sbZustand}>
      {/* Desktop: freistehende Sidebar (Leon 01.09.) — Rundung an allen Ecken,
          Abstand zum Bildschirmrand, eigener Scroller. FEST bleibt sie
          trotzdem: `sticky` mit demselben Abstand oben, den sie ringsum hat,
          und eine Höhe von genau einem Bildschirm minus der beiden Abstände.
          Vorher stieß sie stumpf an Rand und Kopf, und in der Ecke dazwischen
          entstand ein toter Winkel ohne Radius.

          SEIT 30.09. KLAPPT SIE EIN (Leon): Im Fluss steht nur dieser
          Platzhalter in der Breite der Symbolspalte, die Leiste selbst liegt
          absolut darin und wächst beim Überfahren ÜBER den Inhalt. Regeln
          und Maße in globals.css unter `.staff-huelle`. */}
      <div
        className="sb-platz hidden shrink-0 self-start lg:block"
        style={{
          position: "sticky",
          top: "var(--shell-gap)",
          zIndex: 40,
          width: "var(--sb-platz)",
          height: "calc(100vh - var(--shell-gap) * 2)",
          margin: "var(--shell-gap) 0 var(--shell-gap) var(--shell-gap)",
        }}
      >
        <aside
          ref={leisteRef}
          // `t-glass` bringt Milchglas, Rahmen und Schatten aus dem
          // Token-System mit (Leon 01.09.: „etwas durchsichtiger"). Radius
          // und Lage werden überschrieben, die Breite kommt aus `.sb-leiste`.
          className="sb-leiste t-glass"
          aria-label="Menü"
          onMouseEnter={() => absicht(true)}
          onMouseLeave={() => absicht(false)}
          onFocus={(e) => {
            // NUR die Tastatur klappt über den Fokus auf. Ein Mausklick
            // setzt den Fokus ebenfalls in die Leiste — hielte der sie
            // offen, bliebe sie nach jedem Klick stehen, bis man woanders
            // hinklickt.
            if ((e.target as HTMLElement).matches(":focus-visible")) setFokus(true);
          }}
          onBlur={(e) => {
            if (!leisteRef.current?.contains(e.relatedTarget as Node | null)) setFokus(false);
          }}
          style={{
            position: "absolute",
            inset: "0 auto 0 0",
            borderRadius: "var(--r-shell)",
            // Ohne das ragten die Zeilen-Hover-Flächen über die runden Ecken
            // — und eingeklappt die ausgeblendeten Beschriftungen.
            overflow: "hidden",
          }}
        >
          <StaffSidebar
            onPanel={setPanel}
            angeheftet={angeheftet}
            // Ohne Maus steht sie ohnehin offen — dort gäbe es nichts zu heften.
            onAnheften={hatMaus ? anheften : undefined}
          />
        </aside>
      </div>

      {/* Inhalt: `min-w-0`, sonst sprengt ein breites Kind (Tabelle, langes
          Wort) die Flex-Spalte statt zu schrumpfen. Der Kopf steht IN dieser
          Spalte und nicht über der ganzen Hülle — sonst wäre die Sidebar
          wieder eine Spalte unter einer Navigation (Begründung in
          components/shell/StaffHeader.tsx). */}
      {/* DIE SPALTE HAT KEINEN ABSTAND — der sitzt am Kopf (Leon 01.09.):
          „der Hintergrund der Seite soll sich trotzdem auf die ganze
          Anzeigefläche erstrecken, aber der Inhalt so zentriert bleiben wie
          jetzt." Lag der Abstand an der Spalte, endete auch der SEITENGRUND
          zwölf Pixel vor dem Fensterrand und es blieb ein Rahmen aus
          Fenstergrund stehen. Für die Lage des Inhalts ändert das nichts: Er
          zentriert sich in seiner Spalte, und ein Abstand, der links und
          rechts gleich groß ist, verschiebt eine Mitte nicht. */}
      {/* Kopf und Inhalt teilen sich EINEN Kontext: Die Seite legt ihre
          Navigation in den Kopf (components/shell/KopfNavigation.tsx). */}
      <KopfNavigationProvider>
      <div className="flex min-w-0 flex-1 flex-col">
        <StaffHeader />
        {/* Stillgelegtes Gym: der Satz steht zwischen Kopf und Inhalt, auf
            jeder Seite (Schritt 1 des Geschäftsplans, 21.09.2026). */}
        <GymGesperrtStreifen
          style={{ margin: "0 var(--shell-gap) calc(var(--shell-gap) * 2)" }}
        />
        {/* `staff-content` schaltet den deckenden Grund des Kindes ab — in der
            Hülle gehört der Grund der Hülle (Begründung in globals.css). */}
        <main className="staff-content min-w-0 flex-1 pb-[84px] lg:pb-0">
          {children}
        </main>
      </div>
      </KopfNavigationProvider>

      {/* Handy: Schublade von links */}
      <div className="lg:hidden">
        <div
          aria-hidden={!drawerOpen}
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-50"
          style={{
            background: "var(--overlay)",
            opacity: drawerOpen ? 1 : 0,
            pointerEvents: drawerOpen ? "auto" : "none",
            transition: "opacity var(--dur-med) var(--ease-out)",
          }}
        />
        <div
          role="dialog"
          aria-modal={drawerOpen}
          aria-label="Menü"
          aria-hidden={!drawerOpen}
          className="t-glass fixed inset-y-0 left-0 z-50"
          style={{
            width: "var(--sb-w)",
            maxWidth: "88vw",
            // Eckig zum Fensterrand, gerundet zur Seite hin — sie schiebt sich
            // von links herein und ist kein freistehendes Element.
            borderRadius: "0 var(--r-shell) var(--r-shell) 0",
            boxShadow: drawerOpen ? "var(--shadow-pop)" : "none",
            transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 300ms var(--ease-out)",
            // Ohne das bliebe die geschlossene Schublade für Tastatur und
            // Screenreader erreichbar, obwohl sie niemand sieht.
            visibility: drawerOpen ? "visible" : "hidden",
            paddingTop: "env(safe-area-inset-top, 0px)",
          }}
        >
          <StaffSidebar onNavigate={() => setDrawerOpen(false)} />
        </div>

        <AthleteTabBar onOpenMenu={() => setDrawerOpen(true)} />
      </div>
      </div>
    </>
  );
}
