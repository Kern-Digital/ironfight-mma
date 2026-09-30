"use client";

/**
 * Die Sidebar der Stab-Rollen — Trainer, Verwaltung, Plattform-Admin.
 *
 * BAUVORLAGE: `docs/SIDEBAR-SPEC.md`. Maße als TOKENS (`--sb-*`, `--r-nav*`,
 * `--type-nav*` in globals.css), nie als Literale. Farben und Symbole kommen
 * aus unserem System: die Vorlage war eine shadcn-Komponente mit
 * `lucide-react`, und ein zweites Farbsystem oder Icon-Set bräche
 * DESIGN-BRIEF §1.1 (EINE Variable ändern → App folgt).
 *
 * DIESELBE KOMPONENTE IST DIE SCHUBLADE. Auf dem Handy steckt sie in einem
 * Überlagerungs-Behälter (`StaffShell`), sonst wäre es dieselbe Liste zweimal
 * gebaut — und beim nächsten neuen Menüpunkt eine davon vergessen.
 *
 * ZWEITE RUNDE, 01.09.2026 nachmittags (Leon am gebauten Zustand 1):
 * „größer, die Schrift darin größer — dann wirkt sie noch etwas klobig, sie
 * soll leichter wirken." Vier Eingriffe, die Maße stehen in globals.css:
 *  1. SIE STEHT FREI. Rundung an allen Ecken, Abstand zum Bildschirmrand und
 *     zum Kopf (`--shell-gap`, `--r-shell`; gesetzt in `StaffShell`). Die
 *     Leichtigkeit kommt aus dem Abstand ringsum — kurzzeitig lag sie ganz
 *     ohne eigene Fläche auf dem Seitengrund, was für ein schwebendes Element
 *     nicht geht.
 *  2. AKTIV ALS GLEITENDES FARBFELD (Leon 30.09., nach zwei Runden mit je
 *     drei Vorschlägen: „E sieht gut aus", Schrift „noch größer"): Das Feld
 *     ist in der Bereichsfarbe getönt, läuft nach rechts aus, ragt wie die
 *     erste Lupe ein Stück über die Nachbarn hinaus, trägt die Schrift in
 *     20 px — und GLEITET beim Seitenwechsel von der alten zur neuen Zeile
 *     (components/motion/GleitMarke, Aussehen `.sb-marke` in globals.css).
 *     Vorher (02.09.–30.09.) eine Glas-Lupe mit Akzentring, Glühen und
 *     Zoom; davor kurz ein 2-px-Balken (01.09.).
 *  3. KONTO STATT GYM OBEN LINKS. Der Gym-Name steht jetzt im Header
 *     (`StaffHeader`) — Leons Entscheidung; der Sidebar-Kopf gehört dem
 *     Menschen. Klick öffnet das Panel mit Einstellungen und Abmelden.
 *  4. FUSSGRUPPE FAST LEER. Kampfprofil, Einstellungen, Hilfe und Abmelden
 *     sind ins Konto-Panel gewandert; unten bleiben ein großer, unbeschrifteter
 *     Hell/Dunkel-Schalter und die Rechtszeile.
 *  5. ÜBERSCHRIFTEN GRÖSSER ALS IHRE PUNKTE. Sie standen mit 11 px über
 *     15-px-Zeilen — eine Überschrift, die kleiner ist als ihr Inhalt, ordnet
 *     nichts (Leons Einwand). Jetzt 15 px in Versalien, halbfett.
 *
 * DER UMSCHALTER BLEIBT UNTEN SICHTBAR (Leon 01.09.: „soll man direkt in der
 * Sidebar unten ändern können"). Er lag kurz mit im Konto-Panel — ein
 * Umschalter, für den man erst ein Menü öffnen muss, ist aber keiner.
 *
 * BEREICHSFARBEN (Leon 01.09.): Die Gruppe „Verwaltung" trägt Bernstein, die
 * Gruppe „Plattform" Karminrot; alles andere den Gym-Akzent. Gesetzt wird das
 * über `data-area` am Gruppen-Behälter, die Farben stehen in globals.css.
 * Trainer bekommt bewusst KEINE eigene Farbe — er IST der Gym-Akzent, sonst
 * hätte ein Gym mit roter Marke blaue Trainerwerkzeuge (DESIGN-BRIEF §1.1).
 * Weil kein Gym in seiner Farbwahl eingeschränkt wird (Leons Entscheidung),
 * darf die Farbe nie das EINZIGE Signal sein: Überschrift, Symbol und die
 * eigene Adresse tragen die Unterscheidung mit.
 *
 * WEITERE ABWEICHUNGEN VON DER VORLAGE (Spec §5, mit Leon geklärt 01.09.):
 *  • EINKLAPPEN OHNE KNOPF (Leon 30.09.2026, vorher gar keins): Am Desktop
 *    steht die Leiste als Symbolspalte und klappt beim Überfahren aus, der
 *    Kopf zieht mit (StaffShell, `.staff-huelle` in globals.css). Hier
 *    tragen Beschriftungen deshalb `sb-text` — eingeklappt blenden genau die
 *    aus — und die Überschriften ein `sb-rail-zeichen` für die schmale
 *    Fassung. Auf dem Handy geht die Schublade auf und zu wie bisher.
 *  • KEIN GYM-WECHSLER. Ein Konto gehört genau EINEM Gym (Konzept §1).
 *  • KEIN TASTENKÜRZEL-FELD. Eine app-weite Suche (⌘K) gibt es nicht.
 *  • RECHTSZEILE UNTEN. Mit dem Footer verliert die App ihren einzigen Platz
 *    für Impressum und Datenschutz (§5 TMG: „leicht erkennbar, unmittelbar
 *    erreichbar"). Beide Seiten existieren noch nicht — deshalb stehen sie
 *    wie auf der Beitritts-Karte als Text und werden verlinkt, sobald es sie
 *    gibt.
 */

import DeepFightWordmark from "@/components/DeepFightWordmark";
import Icon from "@/components/ui/Icon";
import { useAuth, useRights } from "@/lib/auth-context";
import { rightsLabel } from "@/lib/roles";
import {
  SHELL_ACCOUNT_ITEMS,
  shellNavGroups,
  type ShellNavGroup,
  type ShellNavItem,
} from "@/lib/shell-nav";
import { useTheme } from "@/lib/theme-context";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { GleitMarke } from "@/components/motion";
import AppSuche from "./AppSuche";
import Profilbild from "@/components/ui/Profilbild";

/** Zeilenbild aller Menüpunkte — Maße ausschließlich aus den Tokens.
    Ränder und Polsterung stehen mit in der Transition, weil das AKTIVE Feld
    über genau diese Werte aufploppt (rowStyle) — mit der Feder-Kurve, damit
    es ploppt und nicht rutscht. */
const ROW_BASE: React.CSSProperties = {
  position: "relative",
  padding: "var(--sb-row-y) var(--sb-row-x)",
  borderRadius: "var(--r-nav)",
  letterSpacing: "var(--ls-nav)",
  textDecoration: "none",
  transition:
    "background-color 200ms var(--ease-out), color 200ms var(--ease-out), margin 260ms var(--ease-pop), padding 260ms var(--ease-pop), box-shadow 260ms var(--ease-pop), transform 260ms var(--ease-pop)",
};

const HEADING: React.CSSProperties = {
  font: "var(--type-nav-heading)",
  letterSpacing: "var(--ls-nav-heading)",
  textTransform: "uppercase",
  color: "var(--text-label)",
  padding: "0 var(--sb-row-x)",
  marginBottom: "6px",
};

/**
 * Hover als React-State, nicht als CSS-`:hover`.
 *
 * Aktiv und Hover teilen sich dieselbe Eigenschaft, und der aktive Punkt darf
 * beim Überfahren NICHT zusätzlich einfärben. Mit zwei CSS-Regeln ginge das
 * nur über Spezifitäts-Tricks; hier ist es eine Bedingung.
 */
function useHover() {
  const [hover, setHover] = useState(false);
  return {
    hover,
    handlers: {
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
    },
  };
}

function rowStyle(active: boolean, hover: boolean): React.CSSProperties {
  return {
    ...ROW_BASE,
    // DIE OFFENE SEITE STEHT GRÖSSER (Leon 30.09., zweite Runde: „wie am
    // Anfang so ähnlich — die aktuell ausgewählte soll schriftlich größer
    // geschrieben sein"). Wie bei der ersten Lupe ploppt das Feld über
    // negative Seitenränder ein Stück über die Nachbarn hinaus; Fläche und
    // Kante trägt die gleitende Marke (`.sb-marke`), nicht die Zeile.
    font: active ? "var(--type-nav-aktuell)" : "var(--type-nav)",
    ...(active
      ? {
          margin: "0 calc(var(--sb-pop) * -1)",
          padding:
            "calc(var(--sb-row-y) + 2px) calc(var(--sb-row-x) + var(--sb-pop))",
          borderRadius: "var(--r-nav-lg)",
        }
      : null),
    // Die Marke liegt mit z-index -1 IN der Zeile; `isolation` hält sie
    // über dem Grund der Rubrik und unter Symbol und Schrift.
    isolation: "isolate",
    background: !active && hover ? "var(--sb-hover)" : "transparent",
    color: active ? "var(--accent-text)" : "var(--text-2)",
  };
}

/** Welche gleitende Marke diese Liste benutzt — Leiste, Schublade und
    Konto-Panel haben je eine eigene, sonst flöge die Marke zwischen ihnen
    hin und her. */
const MarkeKontext = createContext("sb-marke");

/** Die Marke der offenen Seite (components/motion/GleitMarke). */
function Marke() {
  const id = useContext(MarkeKontext);
  const pathname = usePathname();
  return <GleitMarke id={id} folge={pathname} />;
}

/**
 * Symbol + Beschriftung. DeepFight trägt statt beidem die Wortmarke: Funkeln
 * und Schriftzug sind untrennbar (DESIGN-BRIEF §1.6), das Funkeln übernimmt
 * also die Symbolspalte. Der erzwungene Abstand rückt den Schriftzug auf
 * dieselbe Textkante wie alle anderen Zeilen (20 px Symbol + 10 px Abstand =
 * 30 px; Funkeln ~14 px + 16 px = 30 px).
 */
function RowFace({ item, active }: { item: ShellNavItem; active: boolean }) {
  if (item.wordmark) {
    return (
      <span className="flex min-w-0 flex-1 items-center">
        {/* Das Funkeln ist ~14 px breit, die Symbole 20: 3 px Einzug stellen
            es auf dieselbe Mitte (eingeklappt sieht man genau das), 13 px
            Abstand halten den Schriftzug auf der Textkante 30 px.
            GEKÜRZT WIRD NUR DER SCHRIFTZUG, nie die ganze Marke: Eingeklappt
            wächst das Funkeln über seine Box hinaus, und ein `truncate` an
            der Marke schnitt es ab (Leon 30.09.: „das AI-Symbol ist
            abgeschnitten"). */}
        <DeepFightWordmark
          className="sb-wortmarke min-w-0 !gap-[13px] [&>img]:ml-[3px]"
          textClassName="sb-text min-w-0 truncate"
        />
      </span>
    );
  }
  return (
    <>
      <span
        className="sb-symbol flex shrink-0 items-center"
        style={{ color: active ? "var(--accent-text)" : "var(--sb-symbol)" }}
      >
        <Icon
          name={item.icon ?? "hash"}
          size={20}
          strokeWidth={1.5}
        />
      </span>
      <span className="sb-text min-w-0 flex-1 truncate">{item.label}</span>
    </>
  );
}

/** Einfacher Punkt ohne Unterpunkte. */
function NavRow({
  item,
  pathname,
  onNavigate,
}: {
  item: ShellNavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = item.isActive(pathname);
  const { hover, handlers } = useHover();
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className="flex items-center"
      style={{ ...rowStyle(active, hover), gap: "var(--sb-gap)" }}
      {...handlers}
    >
      {active && <Marke />}
      <RowFace item={item} active={active} />
    </Link>
  );
}

/**
 * Punkt mit Unterpunkten. Das Aufklappen läuft über `grid-template-rows`
 * 0fr → 1fr (Vorlage): eine echte Höhen-Animation bräuchte eine gemessene
 * Zielhöhe und ruckelte, sobald ein Unterpunkt dazukommt.
 */
function NavGroupRow({
  item,
  pathname,
  onNavigate,
}: {
  item: ShellNavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const childActive = item.isActive(pathname);
  // Ist ein Unterpunkt aktiv, steht die Gruppe offen — wer auf einer
  // Unterseite landet, soll sehen, wo er ist.
  const [open, setOpen] = useState(childActive);
  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);
  const { hover, handlers } = useHover();

  // Die Elternzeile trägt die Marke nur, solange sie ZU ist — steht die
  // Gruppe offen, markiert der Unterpunkt selbst die Stelle, und zwei
  // Balken übereinander sagten dasselbe zweimal.
  const marked = childActive && !open;

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center text-left"
        style={{ ...rowStyle(marked, hover), gap: "var(--sb-gap)" }}
        {...handlers}
      >
        {marked && <Marke />}
        <RowFace item={item} active={childActive} />
        {/* Aufklapp-Zeichen, KEIN Pfeil: Ein „→" liest sich als „dorthin
            gehen", und die Zeile führt nirgendwohin — sie klappt auf. Der
            Winkel zeigt zu (nach rechts) auf das, was noch kommt, und offen
            (nach unten) auf das, was darunter steht. */}
        <span
          aria-hidden
          className="sb-text shrink-0"
          style={{
            color: "var(--text-3)",
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 200ms var(--ease-out)",
          }}
        >
          <Icon name="chevron-down" size={16} strokeWidth={2} />
        </span>
      </button>

      <div
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          opacity: open ? 1 : 0,
          transition:
            "grid-template-rows 300ms var(--ease-out), opacity 300ms var(--ease-out)",
        }}
      >
        <div style={{ overflow: "hidden" }}>
          {/* Führungslinie: 1 px senkrecht auf Höhe der Symbolspalte
              (Vorlage: left = Ebene*12 + 17.5; bei 18-px-Symbolen und 12 px
              Zeilenrand liegt die Mitte bei 21 px). */}
          <div
            className="mt-0.5 flex flex-col gap-0.5"
            style={{
              marginLeft: "21px",
              paddingLeft: "10px",
              borderLeft: "1px solid var(--sb-guide)",
            }}
          >
            {(item.children ?? []).map((child) => (
              <ChildRow
                key={child.href}
                href={child.href}
                label={child.label}
                active={child.isActive(pathname)}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChildRow({
  href,
  label,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  onNavigate?: () => void;
}) {
  const { hover, handlers } = useHover();
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className="flex items-center"
      style={{ ...rowStyle(active, hover), gap: "var(--sb-gap)" }}
      {...handlers}
    >
      {active && <Marke />}
      <span
        className="sb-symbol flex shrink-0 items-center"
        style={{ color: active ? "var(--accent-text)" : "var(--sb-symbol)" }}
      >
        <Icon name="hash" size={20} strokeWidth={1.5} />
      </span>
      <span className="sb-text min-w-0 flex-1 truncate">{label}</span>
    </Link>
  );
}

/**
 * Die Gruppen-Überschrift.
 *
 * DREI FÄLLE, EIN RHYTHMUS:
 *  • Persönliche Gruppen („Mein Training", „Lernen") — reiner Text, immer
 *    offen. Sie sind keine Rubriken, sondern das eigene Konto.
 *  • Rechte-Gruppe MIT Übersichtsseite (`href`) — der TITEL SELBST ist der
 *    Weg zum Bereichs-Dashboard (Leon 01.09. abends: „Übersicht" fällt als
 *    Menüpunkt weg), und der Klick klappt die Rubrik zugleich auf. Seit
 *    30.09. OHNE Pfeil und eine Stufe größer (Leon: „sieht etwas klein aus
 *    … die Pfeile weg") — die getönte Rubrik-Fläche ist Zeichen genug.
 *  • Rechte-Gruppe OHNE Übersichtsseite (Verwaltung/Plattform, bis ihre
 *    Dashboards gebaut sind) — der Klick klappt nur auf und zu (Winkel
 *    statt Pfeil: die Zeile führt noch nirgendwohin). Sobald die Seiten
 *    existieren, bekommt die Gruppe ihr `href` und rutscht in den zweiten
 *    Fall — sonst wären ihre Punkte hinter einer zugeklappten Rubrik
 *    unerreichbar.
 *
 * DIE BOX-MASSE SIND FÜR ALLE GLEICH: 6 px Polsterung als Klickfläche, der
 * negative obere Rand zieht auf dieselbe Textkante zurück, die untere
 * Polsterung ersetzt den 6-px-Abstand der Text-Variante. So springt der
 * Gruppen-Rhythmus nicht, je nachdem ob eine Überschrift klickbar ist.
 */
function GroupHeading({
  group,
  pathname,
  open,
  onPeek,
  onNavigate,
}: {
  group: ShellNavGroup;
  pathname: string;
  /** Nur für Rechte-Gruppen: ist die Rubrik gerade aufgeklappt? */
  open: boolean;
  /** Merkt eine von Hand geöffnete Rubrik (siehe Akkordeon in StaffSidebar). */
  onPeek: (id: string | null) => void;
  onNavigate?: () => void;
}) {
  const { hover, handlers } = useHover();
  if (!group.label) return null;
  // Eingeklappt steht über einer persönlichen Gruppe ein kurzer Strich statt
  // der Überschrift — er trennt, ohne einen Namen zu behaupten. Die Höhe der
  // Zeile bleibt, damit kein Symbol darunter beim Klappen springt.
  if (!group.area)
    return (
      <div style={{ ...HEADING, position: "relative" }}>
        <span className="sb-text block overflow-hidden">{group.label}</span>
        <span aria-hidden className="sb-rail-zeichen">
          <span
            style={{
              width: "16px",
              height: "1.5px",
              borderRadius: "1px",
              background: "var(--line)",
            }}
          />
        </span>
      </div>
    );

  // Eingeklappt trägt eine Rechte-Rubrik ihren Anfangsbuchstaben auf der
  // Symbolspalte — in ihrer Bereichsfarbe, aber nie NUR über die Farbe
  // unterschieden (T, V, P).
  const railZeichen = (
    <span aria-hidden className="sb-rail-zeichen" style={{ letterSpacing: 0 }}>
      {group.label.slice(0, 1)}
    </span>
  );

  const base: React.CSSProperties = {
    ...HEADING,
    // Rubrik-Titel eine Stufe über den persönlichen Überschriften (Leon
    // 30.09.: „das Textfeld Verwaltung sieht etwas klein aus").
    font: "var(--type-nav-rubrik)",
    position: "relative",
    padding: "6px var(--sb-row-x)",
    marginTop: "-6px",
    marginBottom: 0,
    borderRadius: "var(--r-nav)",
    textDecoration: "none",
    transition:
      "color 200ms var(--ease-out), margin 260ms var(--ease-pop), padding 260ms var(--ease-pop), transform 260ms var(--ease-pop)",
  };

  if (group.href) {
    const active = pathname === group.href;
    return (
      <Link
        href={group.href}
        aria-current={active ? "page" : undefined}
        onClick={() => {
          // Sofort aufklappen, nicht erst nach dem Seitenwechsel — sonst
          // fühlte sich der Klick eine Ladezeit lang wie ins Leere an.
          onPeek(group.id);
          onNavigate?.();
        }}
        className="flex items-center justify-between gap-2"
        style={{
          ...base,
          isolation: "isolate",
          color: active
            ? "var(--accent-text)"
            : hover
              ? "var(--text-body)"
              : "var(--text-label)",
          // Auf der eigenen Übersichtsseite wird der TITEL zum Feld — in der
          // Höhe einer aktiven Menüzeile (Leons Einwand 02.09.: „wenn ich
          // auf Trainer klicke, verliert der Rahmen an Höhe"). Es schließt
          // oben BÜNDIG mit der Rubrik-Box ab (-8 px = ihre obere
          // Polsterung) und seitlich mit ihren Kanten (--sb-pop ist in den
          // Boxen 0) — Leon 30.09.: „der Rahmen des Ausgewählten passt nicht
          // mit dem Rahmen darunter zusammen", als es 2 px darüber hinausragte.
          ...(active
            ? {
                margin: "-8px calc(var(--sb-pop) * -1) 0",
                padding:
                  "8px calc(var(--sb-row-x) + var(--sb-pop)) calc(var(--sb-row-y) + 2px)",
                borderRadius: "var(--r-nav-lg)",
                font: "var(--type-nav-heading-active)",
              }
            : null),
        }}
        {...handlers}
      >
        {active && <Marke />}
        <span className="sb-text min-w-0 truncate">{group.label}</span>
        {railZeichen}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => onPeek(open ? null : group.id)}
      className="flex w-full items-center justify-between gap-2 text-left"
      style={{
        ...base,
        color: hover ? "var(--text-body)" : "var(--text-label)",
      }}
      {...handlers}
    >
      <span className="sb-text min-w-0 truncate">{group.label}</span>
      <span
        aria-hidden
        className="sb-text flex shrink-0 items-center"
        style={{
          transform: open ? "rotate(0deg)" : "rotate(-90deg)",
          transition: "transform 200ms var(--ease-out)",
        }}
      >
        <Icon name="chevron-down" size={15} strokeWidth={2} />
      </span>
      {railZeichen}
    </button>
  );
}

/** Knopf-Zeile im Konto-Panel (Theme, Abmelden) — Zeilenbild wie ein Link. */
function ActionRow({
  icon,
  label,
  onClick,
}: {
  icon: "sun" | "moon" | "logout";
  label: string;
  onClick: () => void;
}) {
  const { hover, handlers } = useHover();
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center text-left"
      style={{ ...rowStyle(false, hover), gap: "var(--sb-gap)" }}
      {...handlers}
    >
      <span className="flex shrink-0 items-center" style={{ color: "var(--sb-symbol)" }}>
        <Icon name={icon} size={20} strokeWidth={1.5} />
      </span>
      <span className="sb-text min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}

/** Zwei Buchstaben aus dem Anzeigenamen — dieselbe Regel wie `gymInitials`. */
function personInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Der Konto-Block oben links samt Aufklapp-Panel.
 *
 * Maße aus der Vorlage (WorkspaceSwitcher): Panel 52 px unter der Zeile,
 * Radius `--r-nav-lg`, `--shadow-pop`, 100 ms Einblenden. Aus dem Wechsler
 * ist ein Konto-Menü geworden — ein Konto gehört genau EINEM Gym (Konzept
 * §1), es gäbe nichts zu wechseln, und der Gym-Name steht seit Leons
 * Entscheidung vom 01.09. im Header.
 */
function AccountBlock({
  onNavigate,
  onLogout,
  onPanel,
}: {
  onNavigate?: () => void;
  onLogout: () => void;
  onPanel?: (offen: boolean) => void;
}) {
  const pathname = usePathname();
  const { profile } = useAuth();
  const rights = useRights();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const { hover, handlers } = useHover();
  const markeId = useContext(MarkeKontext);

  const name = profile?.displayName?.trim() || "Fighter";

  // Ein Seitenwechsel schließt das Panel — sonst stünde es über der neuen Seite.
  useEffect(() => setOpen(false), [pathname]);

  // Solange das Panel offen ist, bleibt die Desktop-Leiste ausgeklappt —
  // sonst klappte sie unter dem Panel weg, sobald die Maus kurz über ihren
  // Rand rutscht.
  useEffect(() => {
    onPanel?.(open);
  }, [open, onPanel]);

  // Klick daneben und Escape schließen. Ohne das bliebe das Panel offen, bis
  // jemand zufällig wieder den Konto-Block trifft.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={boxRef} className="relative mb-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex w-full items-center gap-3 text-left"
        style={{
          // Links rückt das Profilbild eingeklappt auf die Mitte der
          // Symbolspalte (`--sb-konto-x`, globals.css `.staff-huelle`).
          padding: "8px 8px 8px var(--sb-konto-x, 8px)",
          borderRadius: "var(--r-nav-lg)",
          background: open || hover ? "var(--sb-hover)" : "transparent",
          transition:
            "background-color 200ms var(--ease-out), padding 260ms var(--ease-out)",
        }}
        {...handlers}
      >
        <Profilbild
          avatar={profile?.avatar}
          kuerzel={personInitials(name)}
          style={{
            borderRadius: "var(--r-nav)",
            background: "var(--accent)",
            border: "none",
            color: "var(--on-accent)",
            font: "600 15px/1 var(--font-body)",
          }}
        />
        <span className="sb-text flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className="truncate"
            style={{ font: "var(--type-nav-active)", color: "var(--text-body)" }}
          >
            {name}
          </span>
          <span
            className="truncate"
            style={{ font: "var(--type-nav-meta)", color: "var(--text-3)" }}
          >
            {rightsLabel(rights)}
          </span>
        </span>
        <span
          aria-hidden
          className="sb-text shrink-0"
          style={{
            color: "var(--text-3)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms var(--ease-out)",
          }}
        >
          <Icon name="chevron-down" size={16} strokeWidth={2} />
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="sb-pop-origin absolute left-0 right-0 z-50"
          style={{
            top: "52px",
            padding: "4px",
            borderRadius: "var(--r-nav-lg)",
            background: "var(--surface-card)",
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow-pop)",
            animation: "sb-pop 100ms var(--ease-out)",
          }}
        >
          <MarkeKontext.Provider value={`${markeId}-konto`}>
          <div className="flex flex-col gap-0.5">
            {SHELL_ACCOUNT_ITEMS.map((item) => (
              <NavRow
                key={item.href}
                item={item}
                pathname={pathname}
                onNavigate={() => {
                  setOpen(false);
                  onNavigate?.();
                }}
              />
            ))}
            <div
              aria-hidden
              style={{ height: "1px", margin: "4px 8px", background: "var(--line)" }}
            />
            {/* Hell/Dunkel steht NICHT hier, sondern unten in der Sidebar
                (Leon 01.09.): „soll man direkt in der sidebar unten ändern
                können" — ein Umschalter, den man zweimal klicken muss, ist
                keiner. */}
            <ActionRow icon="logout" label="Abmelden" onClick={onLogout} />
          </div>
          </MarkeKontext.Provider>
        </div>
      )}
    </div>
  );
}

/**
 * Liegt die offene Seite in dieser Gruppe? Entscheidet, ob eine Rubrik
 * aufgeklappt steht — die Rubrik folgt dem Ort, nicht einem gemerkten
 * Klick-Zustand (siehe Akkordeon-Kommentar unten).
 */
function groupContains(group: ShellNavGroup, pathname: string): boolean {
  if (group.href && pathname === group.href) return true;
  return group.items.some(
    (item) =>
      item.isActive(pathname) ||
      (item.children ?? []).some((c) => c.isActive(pathname)),
  );
}

export default function StaffSidebar({
  onNavigate,
  onPanel,
  angeheftet = false,
  onAnheften,
}: {
  /** Schließt die Schublade auf dem Handy. Am Desktop nicht gesetzt. */
  onNavigate?: () => void;
  /** Meldet das offene Konto-Panel — hält die Desktop-Leiste ausgeklappt. */
  onPanel?: (offen: boolean) => void;
  /** Nur am Desktop mit Maus: Leiste angeheftet? Fehlt → kein Knopf. */
  angeheftet?: boolean;
  onAnheften?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { logOut } = useAuth();
  const rights = useRights();
  const { theme, toggleTheme } = useTheme();

  const groups = useMemo(() => shellNavGroups(rights), [rights]);

  // ─── Akkordeon der Rechte-Rubriken (Leons Vorgabe 01.09. spät abends) ─────
  // Trainer, Verwaltung und Plattform sind ZUGEKLAPPT. Der Klick auf den
  // Titel öffnet die Rubrik (und ihr Dashboard, wenn es eins gibt); der
  // Klick auf irgendetwas AUSSERHALB schließt sie wieder.
  //
  // OFFEN IST, WO MAN GERADE IST — nicht, was man zuletzt angeklickt hat:
  // Jeder Seitenwechsel löscht den gemerkten Klick (`peek`), und die Rubrik
  // bleibt nur offen, wenn die neue Seite in ihr liegt (groupContains). Damit
  // ist „außerhalb klicken schließt" keine eigene Regel, die jemand pflegen
  // muss, sondern folgt von selbst: Wer die Rubrik verlässt, verlässt sie.
  // `peek` existiert nur für den Moment ZWISCHEN Klick und Seitenwechsel —
  // und für Rubriken, die noch keine eigene Übersichtsseite haben.
  //
  // Die persönlichen Gruppen („Mein Training", „Lernen") bleiben immer
  // offen — sie sind keine Rubriken, in denen man „arbeitet", sondern das
  // eigene Konto.
  const [peek, setPeek] = useState<string | null>(null);
  useEffect(() => setPeek(null), [pathname]);

  // ─── Wenn ZWEI Rubriken dieselbe Seite enthalten ──────────────────────────
  // Der Kursplan steht bei einem Cheftrainer in beiden Rechte-Rubriken (siehe
  // lib/shell-nav.ts). „Offen ist, wo man gerade ist" beantwortet dann nicht
  // mehr eindeutig, WELCHE — und ohne Regel gewinnt schlicht die erste in der
  // Liste. Genau das war Leons Einwand am 02.09.: Klick in der Verwaltung auf
  // „Kursplan", und das Akkordeon sprang zum Trainerbereich.
  //
  // DIE REGEL: Man bleibt, wo man war. Enthält die zuletzt offene Rubrik auch
  // die neue Seite, bleibt sie offen; sonst folgt die Sidebar der Seite. Das
  // ist keine Ausnahme für den Kursplan, sondern gilt für jede Seite, die
  // eines Tages in zwei Rubriken hängt.
  //
  // `openGroupId` wird beim RENDERN gerechnet und nicht in einem Effekt
  // gesetzt — sonst stünden alle Rubriken für ein Bild lang zu und klappten
  // erst danach auf. `held` merkt sich nur nachträglich, wo man zuletzt war.
  const [held, setHeld] = useState<string | null>(null);
  const openGroupId = useMemo(() => {
    const enthaltend = groups.filter(
      (g) => g.area && groupContains(g, pathname),
    );
    if (enthaltend.length === 0) return null;
    if (held && enthaltend.some((g) => g.id === held)) return held;
    return enthaltend[0].id;
  }, [groups, pathname, held]);
  useEffect(() => {
    if (openGroupId) setHeld(openGroupId);
  }, [openGroupId]);

  async function handleLogout() {
    onNavigate?.();
    await logOut();
    router.push("/");
  }

  return (
    <MarkeKontext.Provider value={onNavigate ? "sb-marke-schublade" : "sb-marke-leiste"}>
    <div
      className="flex h-full w-full flex-col"
      // KEINE eigene Fläche mehr: Das Glas sitzt am Behälter (Sidebar am
      // Desktop, Schublade auf dem Handy — beide in StaffShell). Läge hier
      // noch eine deckende Farbe, wäre die Milchscheibe darunter wirkungslos.
      style={{ padding: "var(--sb-pad)" }}
    >
      <AccountBlock onNavigate={onNavigate} onLogout={handleLogout} onPanel={onPanel} />

      {/* NUR IN DER SCHUBLADE (Handy): die Suche der ganzen App (Leon
          19.09.2026). Am Desktop sitzt sie als Lupe im Kopf der Hülle —
          die Schublade ist auf dem Handy der einzige Ort, der immer
          erreichbar ist. Die Treffer stehen hier im Fluss über dem Menü. */}
      {onNavigate && (
        <div className="mb-4">
          <AppSuche darstellung="liste" onGehen={onNavigate} />
        </div>
      )}

      {/* Menü — eigener Scroller, Balken versteckt (Vorlage) */}
      <nav
        aria-label="Bereichsnavigation"
        className="no-scrollbar sb-scroll-fade flex flex-1 flex-col gap-4 overflow-y-auto"
        // Der Scroller ist eine CLIP-KANTE — und zwar an ALLEN vier Seiten:
        // Ohne diesen ausgleichenden Innenabstand schnitte er die Glas-Lupe
        // seitlich flach ab, und die Titel-Lupe der ersten Rubrik, die sich
        // 2 px über ihre Zeile hinaus nach oben zieht, verlöre ihre
        // Oberkante (Leons Fund 02.09.). Negative Ränder gleichen die
        // Polsterung aus, sichtbar ändert sich nichts.
        style={{
          margin: "calc(var(--sb-pop-clear) * -1)",
          padding: "var(--sb-pop-clear)",
        }}
      >
        {groups.map((group) => {
          // Nur Rechte-Rubriken klappen; offen ist die Rubrik, in der man
          // gerade arbeitet (`openGroupId`, siehe oben) — plus der Moment
          // direkt nach dem Titel-Klick (peek).
          const collapsible = !!group.area;
          const open =
            !collapsible || peek === group.id || openGroupId === group.id;
          return (
            // `data-area` färbt Akzent-Balken, Symbol und Überschrift der
            // Gruppe um (Leon 01.09.). Die Farben stehen in globals.css, hier
            // steht nur WELCHER Bereich das ist — die Gruppen ohne Eintrag
            // (Mein Training, Lernen) behalten den Gym-Akzent.
            <div
              key={group.id}
              data-area={group.area}
              className="flex flex-col"
              style={{
                // Getönte Fläche hinter den RECHTE-Gruppen (Leon 01.09.). Der
                // Token existiert nur innerhalb von [data-area] — die
                // persönlichen Gruppen fallen deshalb auf `transparent` zurück
                // und bleiben ungetönt. Kein zweiter Schalter, keine Bedingung.
                background: group.area
                  ? "var(--sb-group-tint, transparent)"
                  : undefined,
                boxShadow: group.area ? "var(--sb-group-edge)" : undefined,
                borderRadius: group.area ? "var(--r-nav-lg)" : undefined,
                padding: group.area ? "8px 0 6px" : undefined,
              }}
            >
              <GroupHeading
                group={group}
                pathname={pathname}
                open={open}
                onPeek={setPeek}
                onNavigate={onNavigate}
              />
              {/* Auf- und Zuklappen wie bei den DeepFight-Unterpunkten:
                  grid-rows 0fr → 1fr statt gemessener Höhen. */}
              <div
                style={
                  collapsible
                    ? {
                        display: "grid",
                        gridTemplateRows: open ? "1fr" : "0fr",
                        opacity: open ? 1 : 0,
                        transition:
                          "grid-template-rows 300ms var(--ease-out), opacity 300ms var(--ease-out)",
                      }
                    : undefined
                }
              >
                <div
                  className="flex flex-col gap-0.5"
                  // overflow:hidden gehört zur Klapp-Animation — und ist
                  // damit die zweite Clip-Kante, die der Glas-Lupe
                  // seitlichen Freiraum lassen muss (--sb-pop-clear).
                  style={
                    collapsible
                      ? {
                          overflow: "hidden",
                          margin: "0 calc(var(--sb-pop-clear) * -1)",
                          padding: "0 var(--sb-pop-clear)",
                        }
                      : undefined
                  }
                >
                  {group.items.map((item) =>
                    item.children ? (
                      <NavGroupRow
                        key={item.href + item.label}
                        item={item}
                        pathname={pathname}
                        onNavigate={onNavigate}
                      />
                    ) : (
                      <NavRow
                        key={item.href + item.label}
                        item={item}
                        pathname={pathname}
                        onNavigate={onNavigate}
                      />
                    ),
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* Fußgruppe: der Hell/Dunkel-Umschalter direkt erreichbar (Leon
          01.09.), darunter die Rechtszeile. Sie ist der Platz, den der Footer
          hatte — noch als Text, weil /impressum und /datenschutz nicht
          existieren (Backlog „vor der ersten Zahlung fällig"). Sobald es sie
          gibt, werden aus den zwei Wörtern Links, genau wie in
          components/JoinLayout.tsx. */}
      <div className="mt-auto flex flex-col pt-4">
        {/* NUR DAS SYMBOL, dafür groß (Leon 01.09.). Ohne Beschriftung braucht
            der Knopf einen Namen für Screenreader — `aria-label` trägt ihn.
            44 px sind das kleinste Antippziel aus DESIGN-BRIEF §1.8; das
            Symbol darin ist mit 26 px bewusst deutlich größer als die 18 px
            der Menüzeilen, damit es als Schalter und nicht als Menüpunkt
            gelesen wird. */}
        {/* Der Einzug sitzt an einer Hülle und nicht am Knopf: `t-interactive`
            bringt eine eigene Transition mit, die ein Inline-Wert ersetzen
            würde. Symbolmitte = Mitte der Menü-Symbole, offen wie
            eingeklappt. */}
        <div
          className="flex items-center justify-between"
          style={{
            paddingLeft: "calc(var(--sb-row-x) - 12px)",
            // Rechts auf der Kante der Pfeile in den Rubrik-Titeln.
            paddingRight: "4px",
            transition: "padding-left 260ms var(--ease-out)",
          }}
        >
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              theme === "dark" ? "Helles Design aktivieren" : "Dunkles Design aktivieren"
            }
            className="t-interactive flex h-11 w-11 items-center justify-center"
            style={{
              borderRadius: "var(--r-nav)",
              color: "var(--text-2)",
            }}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} size={28} strokeWidth={1.6} />
          </button>
          {/* ANHEFTEN (Leon 30.09.2026): Angeheftet bleibt die Leiste offen,
              und die Seiten rücken zur Seite und nutzen den Rest — statt dass
              sie beim Überfahren über dem Inhalt liegt. Er steht nur, wenn
              die Leiste offen ist (eingeklappt blendet `sb-text` ihn aus);
              schräg heißt „lose", aufrecht und in Akzentfarbe „angeheftet". */}
          {onAnheften && (
            <button
              type="button"
              onClick={onAnheften}
              aria-pressed={angeheftet}
              aria-label={angeheftet ? "Menü lösen" : "Menü anheften"}
              title={angeheftet ? "Menü lösen" : "Menü anheften"}
              className="sb-text t-interactive flex h-9 w-9 shrink-0 items-center justify-center"
              style={{
                borderRadius: "var(--r-nav)",
                color: angeheftet ? "var(--accent-text)" : "var(--sb-symbol)",
              }}
            >
              <span
                className="flex"
                style={{
                  transform: angeheftet ? "rotate(0deg)" : "rotate(45deg)",
                  transition: "transform 260ms var(--ease-pop)",
                }}
              >
                <Icon name="pin" size={18} strokeWidth={1.8} />
              </span>
            </button>
          )}
        </div>
        <p
          className="sb-text overflow-hidden"
          style={{
            padding: "10px var(--sb-row-x) 0",
            font: "var(--type-nav-meta)",
            fontSize: "11px",
            color: "var(--text-3)",
          }}
        >
          Impressum · Datenschutz
        </p>
      </div>
    </div>
    </MarkeKontext.Provider>
  );
}
