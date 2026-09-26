"use client";

/**
 * DIE WERBUNG ÜBER DEN ABO-STUFEN (22.09.2026, Konzern-Aufbau 24.09.2026).
 *
 * Leon 22.09.: „die ganze seite sollte mehr nach verkauf und anreiz schaffen
 * ausgelegt sein. versuche auch eins zwei bilder mit zu integrieren."
 * Leon 24.09.: „muss viel schöner gestaltet werden … wie die [McFit, N26,
 * Nike, Adidas, Snocks] es machen, texte bilder aufbau … dass wir uns wie
 * ein großer konzern präsentieren."
 *
 * Der Aufbau folgt dem, was alle fünf Vorbilder gemeinsam haben:
 *   1. POSTER-HERO: Foto unter Schleier, Label, die Metall-Überschrift,
 *      Leons Kernzeile, ein Nutzensatz, zwei Knöpfe — rechts das Handy als
 *      Produktbild. Darunter eine Kennzahlen-Leiste, jede Zahl im Code
 *      gezählt (748 Analysepunkte, 67 DNA-Fragen, 3 gratis, 24 Monate).
 *   2. SO LÄUFT'S: drei Schritte mit großen Ziffern.
 *   3. DAS ERGEBNIS: der Strang neben drei Sätzen WÖRTLICH aus dem
 *      Demo-Profil (`DEMO_FIGHT_PROFILE`) — echte Inhalte statt Sprüche.
 *   4. GEGNER-SCOUTING als Foto-Band mit Leons Absatz und der 748 groß.
 *
 * Alle Sätze nach dem Skill `tidal-stimme`; Leons eigene stehen wörtlich.
 * Fotos: `public/abo/` (Pexels, 2000 px, Herkunft in docs/abo-bilder-herkunft.md —
 * die 52 Fotos in `public/join-stack` sind nur 320 px breit) und das Handy-Bild
 * aus `public/library-stack`. Kein `next/image` — wie in `JoinBackdrop`.
 */

import { FightDnaHeading } from "@/components/deepfight/FightDnaEntry";
import FightDnaHelix from "@/components/deepfight/FightDnaHelix";
import Icon from "@/components/ui/Icon";
import { Reveal } from "@/components/motion";
import { DEMO_FIGHT_PROFILE } from "@/lib/demo-fight-profile";
import { DNA_TOTAL_QUESTIONS } from "@/lib/gegner-dna";

const KNOPF: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

/**
 * Analysepunkte je Video (Zählung eines Parallelfensters, 24.09.2026:
 * Techniken mit Versuchen, Treffern, Zone und Wirkung, dazu die DNA-Fragen).
 * Athlet und Gegner zusammen = 748. Ändert sich ein Katalog: neu zählen.
 */
const PUNKTE_JE_VIDEO = 374;
const PUNKTE_VERGLEICH = PUNKTE_JE_VIDEO * 2;
const DNA_FRAGEN = DNA_TOTAL_QUESTIONS;

/** Die drei Schritte vom Video zum Gameplan. */
const SCHRITTE: { icon: "video" | "frame" | "chart"; titel: string; text: string }[] = [
  {
    icon: "video",
    titel: "Hochladen",
    text: "Handyvideo vom Mattenrand, direkt aus der App.",
  },
  {
    icon: "frame",
    titel: "Antippen",
    text: "Ein Tipp auf deinen Athleten. Der Sparringpartner bleibt außen vor.",
  },
  {
    icon: "chart",
    titel: "Auswerten",
    text: "Fight-DNA und Lücken deines Athleten, dazu der Gameplan für den nächsten Gegner.",
  },
];

/**
 * Drei Befunde aus dem Demo-Profil, wörtlich. Die Überschriften sagen, welche
 * Frage der Katalog gestellt hat (`DNA_CATEGORIES`).
 */
const BEFUNDE: { frage: string; schluessel: keyof typeof DEMO_FIGHT_PROFILE.dna }[] = [
  { frage: "Was wiederholt er?", schluessel: "real-habits_repeats" },
  { frage: "Was macht er nach einem Treffer?", schluessel: "real-habits_after-hit" },
  { frage: "Wie kommt er rein?", schluessel: "entry-patterns_start" },
];

/** Label (Versalien) über Kernzeile, darunter der Nutzensatz — die Etage der Vorbilder. */
export function Etage({
  label,
  zeile,
  nutzen,
  id,
}: {
  label: string;
  zeile: string;
  nutzen?: React.ReactNode;
  id?: string;
}) {
  return (
    <div className="abo-etage">
      <span className="abo-etage__label">{label}</span>
      <h2 id={id} className="abo-etage__zeile">
        {zeile}
      </h2>
      {nutzen && <p className="abo-etage__nutzen">{nutzen}</p>}
    </div>
  );
}

export default function AboWerbung({
  restAnalysen,
  restBezahlt,
  darfKaufen,
}: {
  /** Was noch da ist — die geschenkten Analysen sind der stärkste Anreiz. */
  restAnalysen: number;
  /** Davon bezahlt (Nachkauf aus der Zeit vor dem Abo) — dann ist es kein Geschenk mehr. */
  restBezahlt: number;
  darfKaufen: boolean;
}) {
  return (
    <div className="flex flex-col">
      {/* ── 1. Das Poster ─────────────────────────────────────────────── */}
      <section aria-label="Was DeepFight kann" className="abo-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/abo/hero.jpg"
          alt=""
          aria-hidden
          decoding="async"
          fetchPriority="high"
          className="abo-hero__bild"
        />
        <span aria-hidden className="abo-hero__schleier" />
        <span aria-hidden className="abo-hero__glut" />

        <div className="abo-spalte abo-hero__inhalt">
          <div className="abo-hero__text">
            <span className="abo-hero__label">
              <i aria-hidden />
              DeepFight · Videoanalyse
            </span>
            <FightDnaHeading />
            {/* Leons Zeile (23.09.), Muster von Adidas: Partizip ohne Subjekt,
                das Werkzeug trägt den Zweck („Designt für Tore."). */}
            <p className="abo-hero__zeile">Designt für maximale Performance.</p>
            <p className="abo-hero__nutzen">
              Lad ein Sparring hoch und du siehst, was dein Athlet immer wieder macht, wo er aufmacht und was der
              nächste Gegner damit anfängt. Für jeden Athleten einzeln, fertig in ein paar Minuten.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="#abo-stufen-titel"
                data-press
                data-abo-hero-cta
                className="abo-hero__knopf abo-hero__knopf--primaer t-interactive inline-flex min-h-[52px] items-center gap-2 rounded-field px-6"
                style={KNOPF}
              >
                <Icon name="spark" size={14} strokeWidth={2.4} />
                {darfKaufen ? "Jetzt durchstarten" : "Stufen ansehen"}
              </a>
              {restAnalysen > 0 && (
                <a
                  href="/trainer/deepfight"
                  data-press
                  className="abo-hero__knopf t-interactive inline-flex min-h-[52px] items-center gap-2 rounded-field px-5"
                  style={KNOPF}
                >
                  <Icon name="play" size={14} strokeWidth={2.4} />
                  {restAnalysen} gratis einlösen
                </a>
              )}
            </div>
            {/* Leons Satz (23.09.), wörtlich. `data-abo-stand` liest die Messung. */}
            {restAnalysen > 0 && (
              <p className="abo-hero__stand" data-abo-stand={restAnalysen}>
                <span aria-hidden className="abo-haken">
                  <Icon name="check" size={12} strokeWidth={2.8} />
                </span>
                {restBezahlt === 0 ? (
                  <span>
                    Überzeug dich selbst mit{" "}
                    <strong>
                      {restAnalysen} gratis {restAnalysen === 1 ? "Analyse" : "Analysen"}
                    </strong>
                    .
                  </span>
                ) : (
                  <span>
                    <strong>
                      {restAnalysen} {restAnalysen === 1 ? "Analyse" : "Analysen"}
                    </strong>{" "}
                    hast du noch. Mit dem Abo kommen jeden Monat neue dazu.
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Das Handy filmt — derselbe Schirm wie beim Zuordnen im Upload. */}
          <Reveal delay={0.15} className="abo-hero__handy">
            <figure className="m-0 flex flex-col gap-3">
              <div className="abo-phone">
                <span aria-hidden className="abo-phone__lautsprecher" />
                <div className="abo-phone__screen">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/library-stack/coach-pads.jpg"
                    decoding="async"
                    alt="Zwei Kämpfer beim Pratzentraining, gefilmt mit dem Handy vom Mattenrand."
                    width={1200}
                    height={800}
                  />
                  <span aria-hidden className="abo-phone__rec">
                    <span className="abo-phone__punkt" />
                    02:14
                  </span>
                  <span aria-hidden className="abo-phone__rahmen" />
                  <span aria-hidden className="abo-phone__marke">Dein Athlet</span>
                </div>
              </div>
              <figcaption
                style={{ font: "var(--type-meta)", letterSpacing: "var(--ls-label)", textTransform: "uppercase" }}
              >
                Ein Video, jeder Athlet einzeln
              </figcaption>
            </figure>
          </Reveal>
        </div>

        {/* Die Kennzahlen-Leiste. Jede Zahl ist gezählt, keine geschätzt. */}
        <dl className="abo-spalte abo-kennzahlen" aria-label="DeepFight in Zahlen">
          <div>
            <dt>Analysepunkte je Vergleich</dt>
            <dd>{PUNKTE_VERGLEICH}</dd>
          </div>
          <div>
            <dt>Fragen an die Fight-DNA</dt>
            <dd>{DNA_FRAGEN}</dd>
          </div>
          <div>
            <dt>Analysen zum Start gratis</dt>
            <dd>3</dd>
          </div>
          <div>
            <dt>Monate gilt jede Analyse</dt>
            <dd>24</dd>
          </div>
        </dl>
      </section>

      {/* ── 2. Drei Schritte ──────────────────────────────────────────── */}
      <section aria-labelledby="abo-schritte-titel" className="abo-band abo-band--durchsichtig">
        <div className="abo-spalte flex flex-col gap-7">
        <Etage id="abo-schritte-titel" label="So läuft's" zeile="Hochladen, antippen, durchstarten." />
        <ol className="abo-schritte m-0 list-none p-0">
          {SCHRITTE.map((s, i) => (
            <Reveal key={s.titel} delay={0.08 * i} className="flex">
              <li className="abo-schritt t-card w-full rounded-card">
                <div className="flex items-center justify-between gap-3">
                  <span aria-hidden className="abo-schritt__ziffer">
                    0{i + 1}
                  </span>
                  <span aria-hidden className="abo-schritt__icon">
                    <Icon name={s.icon} size={18} strokeWidth={2} />
                  </span>
                </div>
                <span className="sr-only">Schritt {i + 1}</span>
                <strong className="abo-schritt__titel">{s.titel}</strong>
                <span className="abo-schritt__text">{s.text}</span>
              </li>
            </Reveal>
          ))}
        </ol>
        </div>
      </section>

      {/* ── 3. Das Ergebnis: Strang und Auswertung nebeneinander ──────── */}
      <section aria-labelledby="abo-ergebnis-titel" className="abo-band abo-band--flaeche">
        <div className="abo-spalte abo-band__inhalt abo-band__inhalt--zwei">
          <div className="flex min-w-0 flex-col gap-6">
            <Etage
              id="abo-ergebnis-titel"
              label="Das Ergebnis"
              zeile="Das steht danach im Profil."
              nutzen={
                <>
                  {DNA_FRAGEN} Fragen zu Gewohnheiten, Einstiegen und Lücken. Jede Analyse füllt den Strang weiter.
                  Drei Sätze, wie sie nach einer Analyse im Profil stehen:
                </>
              }
            />
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {BEFUNDE.map((b, i) => (
                <Reveal key={b.schluessel} delay={0.06 * i} className="flex">
                  <li className="abo-befund w-full min-w-0">
                    <span
                      style={{
                        font: "var(--type-meta)",
                        letterSpacing: "var(--ls-label)",
                        textTransform: "uppercase",
                        color: "var(--text-2)",
                      }}
                    >
                      {b.frage}
                    </span>
                    <span style={{ font: "var(--type-body)", color: "var(--text-1)" }}>
                      {DEMO_FIGHT_PROFILE.dna[b.schluessel]}
                    </span>
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>
          {/* Beispieldaten, stumm und nicht anfassbar — wie auf der Landung.
              `inert` per Ref: React 18 kennt das Attribut noch nicht (Falle 53). */}
          <div
            className="abo-helix hidden min-w-0 lg:block"
            aria-hidden="true"
            ref={(el) => {
              if (el) el.inert = true;
            }}
          >
            <FightDnaHelix profile={DEMO_FIGHT_PROFILE} variant="athlete" size="md" kennzahlZeigen={false} />
          </div>
        </div>
      </section>

      {/* ── 4. Gegner-Scouting ──────────────────────────────────────────
          Leon (23.09.): „etwas, das darauf schließen lässt, dass man mit
          unserem Gegner-Scouting maximale Performance abliefern kann, weil
          man den Gegner durchleuchtet hat und alles von ihm weiß." Der
          Absatz ist seiner (24.09.), wörtlich. */}
      <section aria-labelledby="abo-scouting-titel" className="abo-band abo-band--dunkel">
        <div className="abo-spalte abo-band__inhalt abo-band__inhalt--zwei">
          <Etage
            id="abo-scouting-titel"
            label="Gegner-Scouting"
            zeile="Vorbereitet auf jeden Gegner."
            nutzen={
              <>
                Analysiere die Videos von eurem Gegner und erfahre direkt: wie er kämpft, womit er reinkommt, wo du
                ihn erwischst. Mit {PUNKTE_VERGLEICH} charakteristischen Parametern werden das Gegnerprofil und die
                Fight-DNA deines Athleten gegeneinander untersucht und ihr erhaltet den perfekten Trainingsplan, der
                bis zum Wettkampftag genau abgestimmt ist.
              </>
            }
          />
          {/* Der Gegner als Bild-Text-Block (N26/Nike-Muster), die 748 auf dem Foto. */}
          <Reveal delay={0.1} className="abo-foto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/abo/gegner.jpg"
              alt="Ein Boxer in Deckung, die Fäuste vor dem Gesicht, der Blick in die Kamera."
              decoding="async"
              loading="lazy"
              className="abo-foto__bild"
            />
            <span aria-hidden className="abo-foto__schleier" />
            <span className="abo-foto__marke">Gegner</span>
            <div className="abo-grosszahl">
              <strong>{PUNKTE_VERGLEICH}</strong>
              <span>Parameter je Gegnervergleich</span>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
