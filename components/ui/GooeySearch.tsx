"use client";

/**
 * Die Gooey-Suche — eingeklappte Pille, die sich beim Klick zu einem Feld
 * öffnet, während das Lupen-Symbol als Tropfen daneben heraustritt.
 *
 * VORLAGE UND WAS DAVON ÜBERNOMMEN IST (Leons Vorgabe 03.09.2026): Der Aufbau
 * stammt aus einer shadcn-Komponente — Zwei-Stufen-Zustand, der SVG-Goo-Filter
 * (Blur + Schwellwert über feColorMatrix, dann das Original per feComposite
 * wieder obenauf, damit Text scharf bleibt), das Herausgleiten des Symbols und
 * die Feder-Kurven. Verhalten und Maße also 1:1.
 *
 * WAS BEWUSST ANDERS IST — dieselbe Entscheidung wie bei der Sidebar
 * (docs/SIDEBAR-SPEC.md §1):
 *
 * • KEIN shadcn, kein lucide, kein clsx. Das Projekt hat nichts davon; ein
 *   zweites Icon-Set und ein zweites Farbsystem brächen DESIGN-BRIEF §1.1 und
 *   §1.4. Die Symbole kommen aus `components/ui/Icon.tsx` (`search`,
 *   `refresh` als Lader), die Klassen-Verkettung macht ein Template-String.
 * • KEINE Hex-Werte. Die Vorlage trug ein festes Hellgrau im Lade-Symbol und
 *   ein festes Schwarz im Ausblenden der Treffer; hier kommt alles aus Tokens
 *   und folgt damit beiden Themes und jedem Gym-Akzent.
 * • GESTEUERT STATT SELBSTVERSORGT, UND OHNE EIGENE TREFFERLISTE. Die
 *   Vorlage hielt ihren Suchtext selbst und ließ gefilterte `dummyData` als
 *   Tropfen unter der Pille herabfallen. Hier kommen `value` und `onChange`
 *   von außen, und die Tropfen sind WEG — ausprobiert und wieder entfernt
 *   (03.09.2026): Auf dieser Seite ist die Athletenliste das Ergebnis, und
 *   sie beginnt 40 px unter der Pille. Die Tropfen legten sich über genau
 *   die Karten, die dieselben Namen schon zeigen (gemessen: der letzte
 *   Tropfen endete 546 px hoch, mitten im Raster). Zweimal dasselbe
 *   Ergebnis, einmal davon als Überdeckung.
 *   Der Goo-Moment bleibt trotzdem: Er sitzt im Austreten des Lupen-Tropfens
 *   aus der Pille, nicht in der Liste.
 * • TypeScript. Die Vorlage hatte implizite `any`-Props (`{ isUnsupported }`,
 *   `{ index }`) und wäre an `strict` gescheitert.
 *
 * DER FILTER LÄUFT NUR, SOLANGE SICH ETWAS BEWEGT (Leon 12.09.2026: „die
 * Suche soll nicht so hell leuchten bei den Buchstaben und Icons, es
 * schimmert so komisch").
 *
 * Das war kein Farbfehler, sondern der Filter selbst. `feComposite atop`
 * legt zwar das scharfe Original obenauf, ABER die weichgezeichnete und
 * geschwellte Fassung darunter bleibt sichtbar, wo das Original durchlässig
 * ist — also rings um jeden Buchstaben und jedes Symbol. Aus heller Schrift
 * auf dunkler Pille wird so ein heller Hof, der bei jeder Bewegung
 * mitschwimmt. Ein Hof um Schrift ist genau das, was DESIGN-BRIEF §1.4
 * ausschließt.
 *
 * Die Lösung steht schon im Kommentar zum Tropfen: „Der Goo-Moment liegt in
 * der BEWEGUNG, nicht im Endzustand." Also hängt der Filter jetzt am
 * Übergang — er wird beim Öffnen und Schließen eingeschaltet und fällt ab,
 * sobald Pille und Tropfen stehen. Das Verschmelzen sieht man weiter, die
 * Schrift steht im Ruhezustand scharf und ohne Hof. Kein Maß, keine Farbe
 * und kein Ablauf ändern sich dadurch.
 *
 * SAFARI UND CHROME AUF iOS bekommen den Goo-Filter NICHT (`.no-goo`): Dort
 * rechnet der Filter auf animierten Elementen sichtbar nach und flackert. Die
 * Erkennung stammt aus der Vorlage und bleibt — sie fällt auf eine saubere
 * Pille ohne Verschmelzen zurück, alles andere bleibt gleich.
 *
 * Maße, Flächen und Bewegungen stehen in `app/globals.css` unter
 * „Gooey-Suche" — nicht hier, damit sie nicht als Literale verstreut liegen.
 */

import Icon from "@/components/ui/Icon";
// AUSNAHME vom „kein framer-motion außerhalb components/motion/"
// (MOTION-BRIEF §3.1): Die Verwandlung Knopf → Feld IST diese Komponente.
// Ein Baustein dafür hätte genau einen Aufrufer. Die Sperren hält sie
// trotzdem ein: `whileHover` läuft durch `canHover` (siehe unten).
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMotionCapability } from "@/components/motion";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Der Goo-Filter: weichzeichnen, den Alphakanal hart schwellen (dadurch
 * fließen nahe Formen ineinander), dann das ungefilterte Original per
 * `atop` wieder darüberlegen — sonst wäre auch die Schrift verwaschen.
 *
 * DER LETZTE WERT DER MATRIX IST −9 UND NICHT −15 (Vorlage) — das ist kein
 * Geschmack, sondern Geometrie. Die Alpha-Zeile rechnet `A' = 18·A + x`; die
 * Schwelle liegt also bei `A = −x/18`. Mit −15 sind das 0,83, und der Punkt,
 * an dem die weichgezeichnete Kante diese Deckkraft erreicht, liegt bei
 * `stdDeviation 5` rund 4,8 px INNERHALB der ursprünglichen Kante
 * (5 · Φ⁻¹(0,83)). Oben und unten zusammen schrumpfte die Pille dadurch um
 * fast 10 px: im DOM 44 px hoch, gemalt 34 — sichtbar kleiner als die
 * Auswahlfelder daneben, obwohl beide dasselbe Maß tragen (Leons Einwand
 * 03.09.2026, nachgemessen).
 *
 * Mit −9 liegt die Schwelle bei 0,5, also genau auf der halben Deckkraft —
 * und damit auf der Kante selbst. Die Form behält ihre Maße. Die Stärke der
 * Verschmelzung hängt am Multiplikator 18, der unverändert bleibt.
 */
function GooeyFilter() {
  return (
    <svg aria-hidden className="pointer-events-none absolute h-0 w-0">
      <defs>
        <filter id="ta-goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -9"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </defs>
    </svg>
  );
}

/**
 * Safari und Chrome auf iOS rechnen SVG-Filter auf animierten Elementen
 * sichtbar nach. Übernommen aus der Vorlage.
 */
function isUnsupportedBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  const safari =
    ua.includes("safari") &&
    !ua.includes("chrome") &&
    !ua.includes("chromium") &&
    !ua.includes("android") &&
    !ua.includes("firefox");
  return safari || ua.includes("crios");
}

export default function GooeySearch({
  value,
  onChange,
  loading = false,
  placeholder = "Name oder E-Mail…",
  label = "Suchen",
  breiteZu = 116,
  breiteAuf = 240,
  nurSymbol = false,
  offenStart = false,
}: {
  value: string;
  onChange: (v: string) => void;
  loading?: boolean;
  placeholder?: string;
  /** Beschriftung der eingeklappten Pille. */
  label?: string;
  /**
   * Die zwei Maße der Pille in Pixeln — zugeklappt und geöffnet.
   *
   * SIE SIND PROPS, SEIT DIE DEEPFIGHT-LANDUNG EINEN GRÖSSEREN BALKEN BRAUCHT
   * (Leon 08.09.2026: „oben rechts ein größerer Suchbalken"). Dort sucht das
   * Feld über Gegner, Athleten UND Analysen und ist die Hauptsache der
   * Kopfzeile — nicht wie sonst ein Filter neben einem Knopf.
   *
   * ZWEI ZAHLEN STATT EINES „size"-SCHALTERS: Ein `size="gross"` bündelte zwei
   * Fragen in einer (Falle 35) und legte für jede neue Stelle eine dritte
   * Stufe an. Die Vorgabewerte SIND die alten Literale — die zehn
   * bestehenden Suchfelder ändern sich um kein Pixel.
   *
   * Die Höhe bleibt `--hit-min` (globals.css): Ein Touch-Ziel wächst nicht mit
   * der Wichtigkeit, und die Pille steht neben Feldern desselben Maßes.
   */
  breiteZu?: number;
  breiteAuf?: number;
  /**
   * Zugeklappt nur die Lupe statt der Beschriftung (Leon 10.09.2026).
   *
   * Für Stellen, an denen die Suche allein steht und niemand sie mit etwas
   * anderem verwechseln kann — auf der DeepFight-Landung sitzt sie ganz
   * rechts in der Kopfzeile. Die Beschriftung bleibt als `aria-label` am
   * Element: Für Screenreader ändert sich nichts, nur das Auge sieht weniger.
   * Sinnvoll nur mit einer kreisrunden Breite (`breiteZu` = Höhe).
   */
  nurSymbol?: boolean;
  /**
   * Schon geöffnet und fokussiert einhängen (Leon 19.09.2026, die Suche der
   * ganzen App im Sheet der Athleten-Leiste): Wer „Suche" antippt, will
   * tippen, nicht noch einmal die Pille öffnen. Der Fokus-Effekt unten
   * läuft beim Einhängen mit `open = true` und setzt ihn.
   */
  offenStart?: boolean;
}) {
  const [open, setOpen] = useState(offenStart);
  /** Läuft der Übergang gerade? Nur dann liegt der Goo-Filter an. */
  const [verschmilzt, setVerschmilzt] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const unsupported = useMemo(isUnsupportedBrowser, []);
  const reduced = useReducedMotion();
  const { canHover } = useMotionCapability();

  // Geöffnet wird der Fokus gesetzt; beim Schließen fällt der Suchtext weg —
  // ein eingeklapptes Feld, das unsichtbar weiterfiltert, wäre eine Liste,
  // die ohne erkennbaren Grund kurz ist.
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else if (value) {
      onChange("");
    }
    // `value`/`onChange` bewusst NICHT als Abhängigkeit: Der Effekt gehört
    // zum Auf- und Zuklappen, nicht zu jedem Tastendruck.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Klick daneben und Escape schließen — dasselbe Muster wie in ui/Select.
  // ABER: Steht Text im Feld, bleibt es bei einem Klick daneben offen. Seit
  // die Pille app-weit der Suchstandard ist (Leon 04.09.2026), sitzt sie
  // auch über Auswahllisten (Technik-Picker, Bibliothek, Zielgruppe): Wer
  // dort „Jab" sucht und den ersten Treffer antippt, verlöre sonst mit dem
  // Tipp die Suche — und die Liste spränge auf volle Länge. Escape leert
  // und schließt weiterhin.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current?.contains(e.target as Node)) return;
      if (inputRef.current?.value) return;
      setOpen(false);
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

  /* Der Filter an und wieder aus. Die Zeit deckt den längsten der drei
     Abläufe ab: Der Tropfen startet mit 0,1 s Verzögerung und braucht 0,85 s
     — zusammen 0,95 s, plus etwas Luft für das Nachschwingen der Feder.
     Ohne Bewegung (reduced motion) verschmilzt gar nichts. */
  useEffect(() => {
    if (reduced) return;
    setVerschmilzt(true);
    const t = window.setTimeout(() => setVerschmilzt(false), 1100);
    return () => window.clearTimeout(t);
  }, [open, reduced]);

  return (
    <div
      ref={rootRef}
      className={`goo-wrap${unsupported ? " no-goo" : ""}`}
      data-open={open || undefined}
    >
      <GooeyFilter />

      <motion.div
        className="goo-inner"
        data-goo={verschmilzt || undefined}
        initial={false}
        animate={{ width: open ? breiteAuf : breiteZu }}
        transition={
          reduced
            ? { duration: 0 }
            : { duration: 0.75, type: "spring", bounce: 0.15 }
        }
      >
        {/* Die Pille selbst. Eingeklappt ein Knopf, geöffnet ein Feld. */}
        <motion.div
          className="goo-pill"
          // canHover statt nur reduced: auf iOS loest der erste Tap
          // pointerenter aus und die Pille bliebe auf 1.05 stehen, bis
          // woanders hingetippt wird. Das Einsinken (whileTap) bleibt
          // auf jedem Geraet — es ist die Haelfte des Gefuehls.
          whileHover={
            canHover && !open ? { scale: 1.05 } : undefined
          }
          whileTap={reduced ? undefined : { scale: 0.95 }}
          onClick={() => !open && setOpen(true)}
          role={open ? undefined : "button"}
          tabIndex={open ? undefined : 0}
          onKeyDown={(e) => {
            if (!open && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              setOpen(true);
            }
          }}
          aria-label={open ? undefined : label}
        >
          {open ? (
            <input
              ref={inputRef}
              type="search"
              className="goo-input"
              placeholder={placeholder}
              aria-label={label}
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
          ) : nurSymbol ? (
            <span className="goo-symbol">
              <Icon name="search" size={18} strokeWidth={2.2} />
            </span>
          ) : (
            <span className="goo-label">{label}</span>
          )}
        </motion.div>

        {/* Der Tropfen: tritt beim Öffnen aus der Pille heraus. Genau hier
            wirkt der Goo-Filter — die beiden Formen hängen kurz zusammen. */}
        <AnimatePresence mode="wait">
          {open && (
            <motion.div
              key="tropfen"
              className="goo-drop"
              initial={{ x: -46, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -46, opacity: 0 }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { delay: 0.1, duration: 0.85, type: "spring", bounce: 0.15 }
              }
            >
              <span className={loading ? "goo-spin" : undefined}>
                <Icon
                  name={loading ? "refresh" : "search"}
                  size={16}
                  strokeWidth={2.2}
                />
              </span>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
}
