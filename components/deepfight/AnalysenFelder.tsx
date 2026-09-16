"use client";

/**
 * Die zwei Felder rechts auf der DeepFight-Landung (Leon 12.09.2026):
 *
 *   „Analysen in Arbeit"   NUR wenn etwas offen ist: ein gespeicherter
 *                          Zwischenstand, der auf dich wartet — ein Tipp führt direkt zurück in die
 *                          Konfiguration (weitermachen; verwerfen bleibt in
 *                          `VideoAnalysisSection`, wo der Stand zu Hause ist).
 *   „Analyse-Archiv"       deine letzten Analysen, sieben untereinander, als
 *                          ACHTE Zeile immer „Alle anzeigen". Ein Tipp auf
 *                          eine Zeile öffnet das Sheet mit ALLEN Analysen
 *                          und dieser vorgewählt; dort sitzen auch die Filter
 *                          Alle / Athleten / Gegner (Leons zweite Runde).
 *
 * ANGEPASST AN DIE APP (Leons Auftrag: „die zwei Felder rechts, die Rundung
 * der Ecken etc."): „In Arbeit" ist `.t-card` — im DeepFight-Bereich also
 * Glas mit `--r-lg` —, das Archiv steht OHNE Rahmen wie in der Vorschau;
 * Zeilen tragen `--r-md`, Farben kommen aus den Tokens.
 *
 * LEONS ZWEITE RUNDE („lass die ganzen kleinen unnötigen Dinge weg"): keine
 * Pfeile an den Zeilen, keine Zähler in den Köpfen, kein „Bereit fürs
 * Profil", keine Filter auf der Seite. Das Symbol ist IMMER die Person —
 * eigene Athleten in der Gym-Farbe, Gegner grau. Die Rolle trägt also die
 * Farbe, nicht die Form.
 */

import Icon from "@/components/ui/Icon";
import Skeleton from "@/components/ui/Skeleton";
import Link from "next/link";

export type FeldModus = "leute" | "gegner";

export interface FeldEintrag {
  key: string;
  name: string;
  meta: string;
  modus: FeldModus;
}

export interface ArbeitEintrag extends FeldEintrag {
  href: string;
}

/** Sieben Analysen plus „Alle anzeigen" = acht Zeilen. */
const ARCHIV_MAX = 7;
const ARBEIT_MAX = 4;

function Rolle({ modus }: { modus: FeldModus }) {
  return (
    <span className="df-feld__rolle" data-modus={modus} aria-hidden>
      <Icon name="user" size={18} strokeWidth={1.8} />
    </span>
  );
}

function Rumpf({ e }: { e: FeldEintrag }) {
  return (
    <span className="df-feld__rumpf">
      <strong>{e.name}</strong>
      <span className="df-feld__meta">{e.meta}</span>
    </span>
  );
}

export default function AnalysenFelder({
  arbeit,
  archiv,
  onWaehlen,
  onAlle,
}: {
  arbeit: ArbeitEintrag[];
  /** `null`, solange der Fächer läuft. */
  archiv: FeldEintrag[] | null;
  onWaehlen: (key: string) => void;
  onAlle: () => void;
}) {
  const laedt = archiv === null;
  const weitereArbeit = arbeit.length - ARBEIT_MAX;

  return (
    <div className="df-felder">
      {/* ── In Arbeit ───────────────────────────────────────────────────
          NUR, WENN ETWAS OFFEN IST (Leon 12.09.: „wenn nichts offen ist, soll
          dieses Feld einfach verschwinden") — ein Kasten mit „nichts da" wäre
          eine Zeile, die nur von sich selbst handelt. */}
      {arbeit.length > 0 && (
        <section
          className="t-card df-feld df-feld--arbeit"
          aria-labelledby="df-arbeit-titel"
        >
          <header className="df-feld__kopf">
            <span className="df-feld__signal" aria-hidden />
            <h2 id="df-arbeit-titel">Analysen in Arbeit</h2>
          </header>

          <div className="df-feld__liste">
            {arbeit.slice(0, ARBEIT_MAX).map((e) => (
              <Link
                key={e.key}
                href={e.href}
                data-press="quiet"
                className="df-feld__zeile"
                aria-label={`${e.name}, ${e.meta}: weitermachen`}
              >
                <Rolle modus={e.modus} />
                <Rumpf e={e} />
              </Link>
            ))}
            {weitereArbeit > 0 && (
              <p className="df-feld__mehr">und {weitereArbeit} weitere</p>
            )}
          </div>
        </section>
      )}

      {/* ── Archiv ────────────────────────────────────────────────────── */}
      {/* OHNE RAHMEN (Leon 12.09.: „das Archiv war auch ohne Rahmen") — wie in
          der Vorschau trägt nur „In Arbeit" die Karte. */}
      <section
        className="df-feld df-feld--archiv"
        aria-labelledby="df-archiv-titel"
      >
        {/* OHNE ZEICHEN (Leon 12.09.: „lösche das Icon von Analyse-Archiv").
            Das Klemmbrett sagte nichts, was die Überschrift daneben nicht
            schon sagt — und rahmenlos, ohne Karte, war es das einzige, was
            die Zeile noch nach Kasten aussehen ließ. */}
        <header className="df-feld__kopf">
          <h2 id="df-archiv-titel">Analyse-Archiv</h2>
        </header>

        {laedt ? (
          <div className="flex flex-col gap-2 pt-3">
            <Skeleton className="h-14 w-full rounded-field" />
            <Skeleton className="h-14 w-2/3 rounded-field" />
          </div>
        ) : (
          <div className="df-feld__liste">
            {archiv.slice(0, ARCHIV_MAX).map((e) => (
              <button
                key={e.key}
                type="button"
                data-press="quiet"
                className="df-feld__zeile"
                onClick={() => onWaehlen(e.key)}
                aria-label={`${e.name}, ${e.meta}: alle Analysen öffnen, diese vorgewählt`}
              >
                <Rolle modus={e.modus} />
                <Rumpf e={e} />
              </button>
            ))}
            {archiv.length === 0 ? (
              <p className="df-feld__leer">
                Noch nichts analysiert. Deine erste Analyse startest du am
                DNA-Strang.
              </p>
            ) : (
              <button
                type="button"
                data-press="quiet"
                className="df-feld__zeile df-feld__zeile--alle"
                onClick={onAlle}
              >
                <span className="df-feld__rumpf">
                  <strong>Alle anzeigen</strong>
                </span>
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
