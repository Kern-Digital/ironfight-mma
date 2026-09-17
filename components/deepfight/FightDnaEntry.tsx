"use client";

/**
 * Der Einstieg der DeepFight-Landung — Leons Entwurf vom 12.09.2026
 * (Vorschau in D:\Tidal-Athletics\GPT\deepfight-entry, „nimm diese").
 *
 * ZWEI TEILE, DIE SO BLEIBEN, WIE LEON SIE ABGENOMMEN HAT:
 *   Überschrift   „Entschlüssle die Fight-DNA" in Silber (Barlow Condensed
 *                 900 kursiv), mit Lichtlauf und Glanzpunkt.
 *   DNA-Feld      der Strang IST der Knopf. Unter dem Zeiger erscheint in
 *                 seiner Mitte „Start" in Silber mit zwei türkisen Pfeilen;
 *                 auf Touch steht es immer da (MOTION-BRIEF §3.3).
 *
 * ─── DIE ZWEI PLATTEN SIND WEG (Etappe 2, Leon 16.09.2026) ──────────────────
 *
 * Bis dahin verwandelte ein Tipp „Start" in zwei Platten „Athleten" und
 * „Gegner" — die Frage „wen?" stand VOR dem Video. Seit der Ablauf umgedreht
 * ist (erst Upload, dann Vorlauf, dann Zuordnung auf den Karten), ist diese
 * Frage erst nach dem Upload dran. „Start" führt deshalb direkt zur Ablage;
 * die Bibliotheken bleiben über die Leiste erreichbar. Die Stile der Platten
 * (`.df-entry__choice*`) sind aus globals.css entfernt (14972ff).
 *
 * ─── DER LICHTREFLEX LÄUFT, WENN MAN IHN SEHEN KANN (Leon 12.09.) ───────────
 *
 * In der Vorschau hing der Lauf der Überschrift am ersten Style-Apply und
 * der von „Start" am ERSTEN Zeiger-Eintritt. In der App lief beides — die
 * Messung sah die Keyframes durchlaufen —, nur zur falschen Zeit: Das
 * Server-HTML startet die Uhr, bevor Schrift, Hydration und die WebGL-Schicht
 * da sind, und wenn die Seite steht, ist der Reflex vorbei. Deshalb hängt der
 * Reflex an einem ZÄHLER, nicht an einem Flag:
 *   - Beim Mounten wartet er auf `document.fonts.ready` und zwei
 *     Animationsbilder (= die Seite ist gemalt), dann läuft er einmal — auch
 *     auf Touch, wo es keinen Zeiger gibt.
 *   - Danach läuft er bei JEDEM Zeiger-Eintritt neu (nur am DNA-Feld). Der
 *     `key` am Schriftzug hängt das Pseudo-Element neu ein, sonst spielte die
 *     CSS-Animation kein zweites Mal.
 *
 * DIE FARBEN SIND FEST (Material, wie beim VS-Banner der Wettkampfseite —
 * Ausnahme von DESIGN-BRIEF §1.1). Die Stile liegen in globals.css unter
 * „DER METALL-EINSTIEG DER DEEPFIGHT-LANDUNG".
 *
 * Die Helix darunter ist `inert` und `aria-hidden`: Es sind Beispieldaten,
 * und der Knopf darüber trägt die Beschriftung „Analyse starten".
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

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
 * Eine Überschrift ist kein Bedienelement, sie lädt zu nichts ein — sie
 * glänzt beim Ankommen und ist dann ruhig. Am DNA-Feld bleibt der Anstoß,
 * DORT ist er die Einladung.
 */
export function FightDnaHeading() {
  const [glanz] = useGlanz();
  return (
    <div className="df-entry-heading" data-shone={glanz > 0 || undefined}>
      <h2>
        <Metall key={glanz} text="Entschlüssle die Fight-DNA" />
      </h2>
      {/* Nur noch die feine Linie. Der türkise Anstrich links davor ist am
          12.09. gefallen (Leon: „den blauen Balken dann entfernen"). */}
      <div className="df-entry-heading__rule" aria-hidden="true" />
    </div>
  );
}

export default function FightDnaEntry({
  children,
  onStart,
}: {
  children: ReactNode;
  /** Ein Tipp auf den Strang — führt direkt zur Ablage. */
  onStart: () => void;
}) {
  const [glanz, anstossen] = useGlanz();

  return (
    <div
      className="df-entry"
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
        type="button"
        className="df-entry__target"
        aria-label="Analyse starten"
        onClick={onStart}
      />

      <div className="df-entry__invitation" aria-hidden="true">
        <div className="df-entry__start">
          <Metall key={glanz} text="Start" />
          <svg className="df-entry__arrows" viewBox="0 0 46 50">
            <path d="M4 8 20 25 4 42M23 8 39 25 23 42" />
          </svg>
        </div>
      </div>
    </div>
  );
}
