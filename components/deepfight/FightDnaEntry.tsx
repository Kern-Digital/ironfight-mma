"use client";

/**
 * Der Einstieg der DeepFight-Landung — Leons Entwurf vom 12.09.2026
 * (Vorschau in D:\Tidal-Athletics\GPT\deepfight-entry, „nimm diese").
 *
 * DREI TEILE, DIE SO BLEIBEN, WIE LEON SIE ABGENOMMEN HAT:
 *   Überschrift   „Entschlüssle die Fight-DNA" in Silber (Barlow Condensed
 *                 900 kursiv), mit Lichtlauf und Glanzpunkt.
 *   DNA-Feld      der Strang IST der Knopf. Unter dem Zeiger erscheint in
 *                 seiner Mitte „Start" in Silber mit zwei türkisen Pfeilen;
 *                 auf Touch steht es immer da (MOTION-BRIEF §3.3).
 *   Auswahl       ein Tipp verwandelt „Start" am selben Ort in zwei Platten,
 *                 Silber „Athleten" und Türkis „Gegner". Escape oder ein Klick
 *                 daneben nimmt sie zurück, der Fokus geht auf den Strang
 *                 zurück — kein Abbrechen-Knopf (Leon 10.09.).
 *
 * ─── DER LICHTREFLEX LÄUFT, WENN MAN IHN SEHEN KANN (Leon 12.09.: „der
 * Lichtreflex fehlt sowohl bei der Überschrift als auch beim Start") ────────
 *
 * In der Vorschau hing der Lauf der Überschrift am ersten Style-Apply und
 * der von „Start" am ERSTEN Zeiger-Eintritt. In der App lief beides — die
 * Messung sah die Keyframes durchlaufen —, nur zur falschen Zeit: Das
 * Server-HTML startet die Uhr, bevor Schrift, Hydration und die WebGL-Schicht
 * da sind, und wenn die Seite steht, ist der Reflex vorbei. „Start" traf es
 * genauso, weil Chrome `pointerenter` auch für einen RUHENDEN Zeiger
 * auslöst, sobald das Element unter ihm auftaucht — der eine Lauf verpuffte
 * beim Laden, danach kam keiner mehr.
 *
 * Deshalb hängt der Reflex jetzt an einem ZÄHLER, nicht an einem Flag:
 *   - Beim Mounten wartet er auf `document.fonts.ready` und zwei
 *     Animationsbilder (= die Seite ist gemalt), dann läuft er einmal — auch
 *     auf Touch, wo es keinen Zeiger gibt.
 *   - Danach läuft er bei JEDEM Zeiger-Eintritt neu (Überschrift: über die
 *     Überschrift; „Start": über das DNA-Feld). Der `key` am Schriftzug
 *     hängt das Pseudo-Element neu ein, sonst spielte die CSS-Animation kein
 *     zweites Mal.
 *
 * DIE FARBEN SIND FEST (Material, wie beim VS-Banner der Wettkampfseite —
 * Ausnahme von DESIGN-BRIEF §1.1). Die Stile liegen in globals.css unter
 * „DER METALL-EINSTIEG DER DEEPFIGHT-LANDUNG".
 *
 * Die Helix darunter ist `inert` und `aria-hidden`: Es sind Beispieldaten,
 * und der Knopf darüber trägt die Beschriftung „Analyse starten".
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export type EinstiegsModus = "leute" | "gegner";

/** Silberner Schriftzug: Verlauf in der Schrift, Lichtlauf und Glanzpunkt als Kinder. */
function Metall({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={`df-metal ${className}`} data-text={text}>
      {text}
      <span className="df-metal__glint" aria-hidden="true" />
    </span>
  );
}

/**
 * Der Reflex-Zähler: einmal, sobald Schrift und erstes Bild da sind, danach
 * auf Anstoß (Zeiger-Eintritt, Fokus) — ABER ENTPRELLT.
 *
 * GEMESSEN 12.09.: Ohne Entprellung feuerte `pointerenter` 27-mal je
 * Überfahren. Das Neu-Einhängen des Schriftzugs (`key`) tauscht das Element
 * unter dem ruhenden Zeiger, Chrome meldet dafür neue Grenz-Ereignisse, die
 * setzen den Zähler erneut, und die Animation startete endlos neu — sie kam
 * nie aus ihrer Verzögerung heraus (Spitze 0,00). Solange ein Lauf läuft,
 * zählt deshalb kein Anstoß.
 */
const REFLEX_DAUER_MS = 1800;

function useGlanz(): [number, () => void] {
  const [glanz, setGlanz] = useState(0);
  const zuletzt = useRef(-Infinity);
  const anstossen = useCallback(() => {
    const jetzt = performance.now();
    if (jetzt - zuletzt.current < REFLEX_DAUER_MS) return;
    zuletzt.current = jetzt;
    setGlanz((n) => n + 1);
  }, []);
  useEffect(() => {
    let alive = true;
    let frame = 0;
    const schrift =
      typeof document !== "undefined" && "fonts" in document
        ? document.fonts.ready
        : Promise.resolve();
    schrift.then(() => {
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (alive) anstossen();
        });
      });
    });
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
    };
  }, [anstossen]);
  return [glanz, anstossen];
}

/**
 * DIE ÜBERSCHRIFT GLÄNZT GENAU EINMAL (Leon 12.09.2026: „außerdem wird es
 * jedes Mal ausgelöst, wenn ich mit der Maus über die Überschrift ziehe").
 *
 * Der Zeiger-Anstoß war ein Behelf aus der Zeit, als der Lauf beim Laden
 * verpuffte — er sollte ihn überhaupt einmal sichtbar machen. Seit der
 * Zähler auf `document.fonts.ready` plus zwei Bilder wartet, kommt der eine
 * Lauf verlässlich, und der Anstoß hat nur noch eine Wirkung: Er lässt eine
 * Überschrift bei jedem Vorbeifahren neu aufblitzen. Eine Überschrift ist
 * kein Bedienelement, sie lädt zu nichts ein — sie glänzt beim Ankommen und
 * ist dann ruhig. Am DNA-Feld bleibt der Anstoß, DORT ist er die Einladung.
 */
export function FightDnaHeading() {
  const [glanz] = useGlanz();
  return (
    <div className="df-entry-heading" data-shone={glanz > 0 || undefined}>
      <h2>
        <Metall key={glanz} text="Entschlüssle die Fight-DNA" />
      </h2>
      {/* Nur noch die feine Linie. Der türkise Anstrich links davor ist am
          12.09. gefallen (Leon: „den blauen Balken dann entfernen") — er kam
          aus der Vorschau mit, bedeutete nichts und war die einzige Stelle
          des Einstiegs mit einem FESTEN Türkis statt der Gym-Farbe. */}
      <div className="df-entry-heading__rule" aria-hidden="true" />
    </div>
  );
}

export default function FightDnaEntry({
  children,
  onSelect,
}: {
  children: ReactNode;
  onSelect: (modus: EinstiegsModus) => void;
}) {
  const [offen, setOffen] = useState(false);
  const [glanz, anstossen] = useGlanz();
  const host = useRef<HTMLDivElement>(null);
  const ziel = useRef<HTMLButtonElement>(null);
  const erste = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!offen) return;
    erste.current?.focus({ preventScroll: true });
    // `pointerdown` statt `click`: Ein Tipp auf eine der Platten navigiert
    // ohnehin, und bei `click` käme das Schließen dem Navigieren zuvor.
    const daneben = (event: PointerEvent) => {
      if (event.target instanceof Node && !host.current?.contains(event.target)) {
        setOffen(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOffen(false);
        ziel.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("pointerdown", daneben);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", daneben);
      document.removeEventListener("keydown", escape);
    };
  }, [offen]);

  return (
    <div
      ref={host}
      className="df-entry"
      data-open={offen || undefined}
      data-shone={glanz > 0 || undefined}
      onPointerEnter={anstossen}
      onFocus={anstossen}
    >
      <div
        className="df-entry__dna"
        aria-hidden="true"
        ref={(element) => {
          if (element) element.inert = true;
        }}
      >
        {children}
      </div>

      <button
        ref={ziel}
        type="button"
        className="df-entry__target"
        aria-label="Analyse starten"
        aria-expanded={offen}
        aria-controls="df-entry-choices"
        onClick={() => setOffen(true)}
        tabIndex={offen ? -1 : 0}
      />

      {!offen && (
        <div className="df-entry__invitation" aria-hidden="true">
          <div className="df-entry__start">
            <Metall key={glanz} text="Start" />
            <svg className="df-entry__arrows" viewBox="0 0 46 50">
              <path d="M4 8 20 25 4 42M23 8 39 25 23 42" />
            </svg>
          </div>
        </div>
      )}

      <div id="df-entry-choices" className="df-entry__choices" hidden={!offen}>
        <button
          ref={erste}
          type="button"
          className="df-entry__choice df-entry__choice--athlete"
          onClick={() => onSelect("leute")}
        >
          <strong>Athleten</strong>
        </button>
        <button
          type="button"
          className="df-entry__choice df-entry__choice--opponent"
          onClick={() => onSelect("gegner")}
        >
          <strong>Gegner</strong>
        </button>
      </div>
    </div>
  );
}
