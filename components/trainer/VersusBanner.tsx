"use client";

/**
 * Das VS-Banner — Leons Paket vom 11.09.2026
 * (D:\claude-projects\tidal-versus, dort `VsBanner.tsx`), hier um die
 * AUSWAHL ergänzt: Die zwei Platten sind Knöpfe. Die gewählte Platte ist
 * TÜRKIS und steht etwas größer, samt Namen; die andere ist Silber (Leon
 * 12.09.: „das ausgewählte Feld blau, beim eigenen Athleten muss der
 * Gegnerblock grau sein"). Die Farbe hängt also an der Wahl, nicht mehr an
 * der Seite. Die Wahl entscheidet, wessen DeepFight unter dem Banner steht.
 *
 * ZWEI MODI (seit 12.09.2026):
 *
 * `anzeige` — die Wettkampfseite. Die Platten schalten um, wessen DeepFight
 * unter dem Banner steht; türkis ist die Seite, die man gerade liest.
 *
 * `auswahl` — „Neuer Wettkampf". Dort ist das Banner das Formular: Eine
 * Platte öffnet die Auswahl, und türkis heißt nicht mehr „das liest du
 * gerade", sondern „steht fest". Deshalb dürfen hier BEIDE Platten türkis
 * sein — `aktiv` nimmt darum auch eine Liste. Die Geometrie, die Farben und
 * das Metall bleiben in beiden Modi dieselben: Es ist dasselbe Banner, das
 * einmal etwas zeigt und einmal etwas erfragt, und genau deshalb steht es
 * nicht zweimal im Code.
 *
 * DAS INTRO läuft EINMAL BEIM ÖFFNEN des Wettkampfs (Leon): Seite abgedunkelt
 * und weichgezeichnet, die Platten gleiten in die Bildmitte, das VS setzt
 * mit dem Impact auf, dann gleitet alles an seinen Platz — mit lokal
 * synthetisiertem Sound (`versus-intro.js`, Web Animations + Web Audio, keine
 * Bibliothek, kein externer Dienst). Das Paket merkt sich den Schlüssel je
 * Tab-Sitzung; damit es bei JEDEM Öffnen läuft, hängt hier eine Nonce je
 * Einhängen an den Schlüssel. React-Strict-Mode hängt zweimal ein und
 * bekommt über den Ref dieselbe Nonce — das Intro läuft trotzdem nur einmal.
 *
 * DAS BANNER BLEIBT VERDECKT, BIS DAS INTRO STARTET (Leon 12.09.2026: „es
 * zeigt mir erst kurz die Seite mit dem VS im normalen Format, danach
 * beginnt erst die Animation"). Das Skript wartet vor dem Start auf die
 * Schriften, das Emblem und darauf, dass das Banner im Bild ist — ein paar
 * hundert Millisekunden, in denen das Banner sonst schon dastünde. Eine
 * Hülle hält es deshalb ab dem ersten Bild unsichtbar (auch im Server-HTML,
 * also schon vor der Hydration) und gibt es erst frei, wenn das Skript
 * `tidal-versus:intro-start` meldet — in dem Moment hat es das Original
 * selbst versteckt und zeigt den Klon im Overlay. Startet das Intro nicht
 * (reduzierte Bewegung, Banner außerhalb des Bildes, Tab im Hintergrund),
 * gibt ein Rückfall das Banner nach zwei Sekunden frei.
 *
 * DIE SEITE WARTET MIT (Leon 12.09.): `onIntroAusklang` sagt der Seite,
 * wann sie sich zeigen darf — in dem Moment, in dem das Intro in den
 * Ausklang geht (`tidal-versus:intro-settle`, 62 % der Dauer), spätestens
 * bei seinem Ende (Überspringen), oder sofort, wenn keins läuft (aus,
 * reduzierte Bewegung) bzw. nach dem Rückfall von zwei Sekunden. Der
 * Aufrufer bekommt den Ruf genau einmal je Einhängen.
 *
 * Browser blocken Ton ohne vorherige Nutzergeste: Wer die Seite frisch lädt,
 * sieht das Intro dann stumm; wer per Klick hierher kam, hört es. Bei
 * `prefers-reduced-motion` fällt das Intro ganz aus. Escape oder
 * „Überspringen" beenden es sofort.
 *
 * Stile stehen in globals.css („DAS VS-BANNER DER WETTKAMPFSEITE"), das
 * Emblem in public/vs-emblem.svg. Die Farben sind bewusst fest (Material),
 * Begründung dort.
 */

import { useEffect, useRef, useState } from "react";
import { mountVersusIntro } from "./versus-intro.js";

export type VersusSeite = "athlet" | "gegner";
export type VersusModus = "anzeige" | "auswahl";

function nameClass(value: string): string {
  return `tidal-vs__name${Array.from(value).length > 18 ? " tidal-vs__name--long" : ""}`;
}

export default function VersusBanner({
  athletName,
  athletRolle = "Athlet",
  gegnerName,
  aktiv,
  onChange,
  introKey,
  intro = true,
  sound = true,
  volume = 0.35,
  onIntroAusklang,
  modus = "anzeige",
  pulsiert = null,
  plattenRef,
}: {
  athletName: string;
  /** „Unser Athlet" oder „Ich selbst" — nur für den zugänglichen Namen. */
  athletRolle?: string;
  gegnerName: string;
  /** Türkis. In der Auswahl dürfen beide Seiten türkis sein — siehe Kopf. */
  aktiv: VersusSeite | VersusSeite[];
  onChange: (seite: VersusSeite) => void;
  /** Stabile Wettkampf-ID; das Intro läuft je Öffnen einmal. */
  introKey: string;
  intro?: boolean;
  sound?: boolean;
  volume?: number;
  /** Ab jetzt darf die Seite sich zeigen — das Intro klingt aus. */
  onIntroAusklang?: () => void;
  /** Siehe Kopf: `anzeige` schaltet um, `auswahl` fragt. */
  modus?: VersusModus;
  /**
   * Diese Platte ist als NÄCHSTE dran und pingt leise — erst der Athlet,
   * nach seiner Wahl der Gegner, danach `null`. Immer nur eine: Zwei
   * gleichzeitig pulsende Felder sagen nichts über die Reihenfolge.
   */
  pulsiert?: VersusSeite | null;
  /**
   * Gibt die Platten nach draußen — der Aufrufer holt den Fokus dorthin
   * zurück, wenn seine Auswahl wieder zugeht. Ohne das landet der Fokus
   * nach dem Schließen am Seitenanfang, und wer mit der Tastatur wählt,
   * sucht sich die Platte jedes Mal neu.
   */
  plattenRef?: (seite: VersusSeite, el: HTMLButtonElement | null) => void;
}) {
  const links = athletName.trim() || "Athlet";
  const rechts = gegnerName.trim() || "Gegner offen";
  const auswahl = modus === "auswahl";
  const gewaehlt = (seite: VersusSeite) =>
    Array.isArray(aktiv) ? aktiv.includes(seite) : aktiv === seite;
  const root = useRef<HTMLDivElement>(null);
  const nonce = useRef(Math.random().toString(36).slice(2, 8));
  // Verdeckt, bis das Intro läuft — siehe Kopf der Datei.
  const [verdeckt, setVerdeckt] = useState(intro);
  // Über einen Ref, damit eine neue Callback-Identität je Render den Effekt
  // nicht neu anstößt (und damit das Intro nicht neu startet).
  const fertigRef = useRef(onIntroAusklang);
  fertigRef.current = onIntroAusklang;

  useEffect(() => {
    const host = root.current;
    let gemeldet = false;
    const fertig = () => {
      if (gemeldet) return;
      gemeldet = true;
      fertigRef.current?.();
    };
    if (!host || !intro) {
      setVerdeckt(false);
      fertig();
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVerdeckt(false);
      fertig();
      return;
    }
    const freigeben = () => setVerdeckt(false);
    // Rückfall: Startet das Intro nicht, zeigt sich alles nach zwei Sekunden.
    const rueckfall = window.setTimeout(() => {
      freigeben();
      fertig();
    }, 2000);
    const gestartet = () => {
      window.clearTimeout(rueckfall);
      freigeben();
    };
    host.addEventListener("tidal-versus:intro-start", gestartet);
    host.addEventListener("tidal-versus:intro-settle", fertig);
    host.addEventListener("tidal-versus:intro-end", fertig);
    const controller = mountVersusIntro(host, {
      onceKey: `${introKey}:${nonce.current}`,
      sound,
      volume,
    });
    return () => {
      window.clearTimeout(rueckfall);
      host.removeEventListener("tidal-versus:intro-start", gestartet);
      host.removeEventListener("tidal-versus:intro-settle", fertig);
      host.removeEventListener("tidal-versus:intro-end", fertig);
      controller.destroy();
    };
  }, [intro, sound, volume, introKey]);

  return (
    <div style={{ visibility: verdeckt ? "hidden" : undefined }}>
      <div
        ref={root}
        className="tidal-vs"
        role="group"
        aria-label={
          auswahl
            ? "Athlet und Gegner wählen"
            : `${links} gegen ${rechts} — wessen DeepFight angezeigt wird`
        }
      >
        <div className="tidal-vs__stage">
          <button
            type="button"
            data-motion
            ref={(el) => plattenRef?.("athlet", el)}
            onClick={() => onChange("athlet")}
            {...(auswahl
              ? { "aria-haspopup": "dialog" as const }
              : { "aria-pressed": gewaehlt("athlet") })}
            aria-label={
              auswahl
                ? gewaehlt("athlet")
                  ? `${athletRolle}: ${links} — anderen wählen`
                  : "Athlet wählen"
                : `${athletRolle}: ${links}`
            }
            className={`tidal-vs__plate${gewaehlt("athlet") ? " tidal-vs__plate--selected" : ""}${pulsiert === "athlet" ? " tidal-vs__plate--pulst" : ""}`}
          >
            <span className={nameClass(links)}>{links}</span>
          </button>
          <button
            type="button"
            data-motion
            ref={(el) => plattenRef?.("gegner", el)}
            onClick={() => onChange("gegner")}
            {...(auswahl
              ? { "aria-haspopup": "dialog" as const }
              : { "aria-pressed": gewaehlt("gegner") })}
            aria-label={
              auswahl
                ? gewaehlt("gegner")
                  ? `Gegner: ${rechts} — anderen wählen`
                  : "Gegner wählen"
                : `Gegner: ${rechts}`
            }
            className={`tidal-vs__plate tidal-vs__plate--opponent${gewaehlt("gegner") ? " tidal-vs__plate--selected" : ""}${pulsiert === "gegner" ? " tidal-vs__plate--pulst" : ""}`}
          >
            <span className={nameClass(rechts)}>{rechts}</span>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="tidal-vs__emblem"
            src="/vs-emblem.svg"
            width="260"
            height="260"
            alt=""
            aria-hidden="true"
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}
