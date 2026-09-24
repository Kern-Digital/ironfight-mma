"use client";

/**
 * DIE WERBUNG ÜBER DEN ABO-STUFEN (22.09.2026).
 *
 * Leon: „die ganze seite sollte mehr nach verkauf und anreiz schaffen
 * ausgelegt sein. versuche auch eins zwei bilder mit zu integrieren.
 * vielleicht wo man ein handy sieht das zwei kämpfer aufnimmt und dann ein
 * bild von der deepfight DNA und die passende auswertung dazu."
 *
 * Also zwei Bilder, beide aus dem, was die App WIRKLICH tut:
 *   1. Ein Handy im Querformat filmt zwei Kämpfer, mit Aufnahmepunkt und dem
 *      Rahmen um den eigenen Athleten — genau der Schirm, auf dem man im
 *      Upload die Person zuordnet.
 *   2. Der DNA-Strang neben drei Sätzen, die WÖRTLICH aus dem Demo-Profil
 *      stammen (`DEMO_FIGHT_PROFILE`). Keine erfundene Auswertung: Was hier
 *      steht, steht nach einer Analyse im Profil.
 *
 * Das Foto liegt schon in der App (`public/library-stack/coach-pads.jpg`,
 * 1200×800, genutzt auf /techniques). Kein `next/image`, wie in
 * `JoinBackdrop`: ein festes Bild braucht keinen Bildserver.
 */

import { FightDnaHeading } from "@/components/deepfight/FightDnaEntry";
import FightDnaHelix from "@/components/deepfight/FightDnaHelix";
import Icon from "@/components/ui/Icon";
import { Reveal } from "@/components/motion";
import { DEMO_FIGHT_PROFILE } from "@/lib/demo-fight-profile";

const LABEL: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
  color: "var(--text-2)",
};

const KNOPF: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

/** Die drei Schritte vom Video zum Gameplan. */
const SCHRITTE: { icon: "video" | "frame" | "chart"; titel: string; text: string }[] = [
  {
    icon: "video",
    titel: "Hochladen",
    text: "Handyvideo vom Mattenrand. Bis zu 15 Minuten, direkt aus der App.",
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

export default function AboWerbung({
  restAnalysen,
  darfKaufen,
}: {
  /** Was noch da ist — die geschenkten Analysen sind der stärkste Anreiz. */
  restAnalysen: number;
  darfKaufen: boolean;
}) {
  return (
    <div className="flex flex-col gap-10">
      {/* ── Kopf: Versprechen, Knöpfe, Handy ───────────────────────────── */}
      <section aria-label="Was DeepFight kann" className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
        {/* KEIN `items-start`: Der Fight-DNA-Titel schrumpft sonst auf
            Minimalbreite, und auf 390 px steht er Buchstabe für Buchstabe
            untereinander. */}
        <div className="flex min-w-0 flex-col gap-5">
          <FightDnaHeading />
          {/* Leons Zeile (23.09.), Muster von Adidas: Partizip ohne Subjekt,
              das Werkzeug trägt den Zweck („Designt für Tore."). */}
          <p style={{ font: "var(--type-h2)", color: "var(--text-1)" }}>Designt für maximale Performance.</p>
          <p style={{ font: "var(--type-body)", color: "var(--text-2)" }}>
            Lad ein Sparring hoch und du siehst, was dein Athlet immer wieder macht, wo er aufmacht und was der
            nächste Gegner damit anfängt. Für jeden Athleten einzeln, fertig in ein paar Minuten.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="#abo-stufen-titel"
              data-press
              data-abo-hero-cta
              className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-5"
              style={{
                ...KNOPF,
                background: "var(--accent)",
                color: "var(--on-accent)",
                boxShadow: "var(--accent-glow)",
              }}
            >
              <Icon name="spark" size={14} strokeWidth={2.4} />
              {darfKaufen ? "Jetzt durchstarten" : "Stufen ansehen"}
            </a>
            {restAnalysen > 0 && (
              <a
                href="/trainer/deepfight"
                data-press
                className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-4"
                style={{ ...KNOPF, border: "1px solid var(--line-strong)", color: "var(--text-1)" }}
              >
                <Icon name="play" size={14} strokeWidth={2.4} />
                {restAnalysen} gratis einlösen
              </a>
            )}
          </div>
          <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
            Monatlich kündbar. Ungenutztes bleibt dir.
          </p>
        </div>

        {/* Das Handy filmt — derselbe Schirm wie beim Zuordnen im Upload. */}
        <Reveal delay={0.1} className="min-w-0">
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
            <figcaption style={LABEL}>Ein Video, jeder Athlet einzeln</figcaption>
          </figure>
        </Reveal>
      </section>

      {/* ── Drei Schritte ──────────────────────────────────────────────── */}
      <section aria-labelledby="abo-schritte-titel" className="flex flex-col gap-5">
        <h2 id="abo-schritte-titel" className="t-sheet-title" style={{ color: "var(--text-1)" }}>
          So läuft&rsquo;s
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {SCHRITTE.map((s, i) => (
            <Reveal key={s.titel} delay={0.08 * i} className="flex">
              <li className="t-card flex w-full min-w-0 flex-col gap-3 p-5">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field"
                    style={{ background: "color-mix(in oklab, var(--accent) 14%, transparent)", color: "var(--accent)" }}
                  >
                    <Icon name={s.icon} size={18} strokeWidth={2} />
                  </span>
                  <span style={LABEL}>Schritt {i + 1}</span>
                </div>
                <strong style={{ font: "var(--type-body-strong)", color: "var(--text-1)" }}>{s.titel}</strong>
                <span style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>{s.text}</span>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* ── Das Ergebnis: Strang und Auswertung nebeneinander ──────────── */}
      <section aria-labelledby="abo-ergebnis-titel" className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
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
        <div className="flex min-w-0 flex-col gap-4">
          <h2 id="abo-ergebnis-titel" className="t-sheet-title" style={{ color: "var(--text-1)" }}>
            Das steht danach im Profil
          </h2>
          <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
            67 Fragen zu Gewohnheiten, Einstiegen und Lücken. Jede Analyse füllt den Strang weiter. Drei Sätze, wie
            sie nach einer Analyse im Profil stehen:
          </p>
          <ul className="flex flex-col gap-3">
            {BEFUNDE.map((b) => (
              <Reveal key={b.schluessel} className="flex">
                <li className="t-card flex w-full min-w-0 flex-col gap-1.5 p-4">
                  <span style={LABEL}>{b.frage}</span>
                  <span style={{ font: "var(--type-body)", color: "var(--text-1)" }}>
                    {DEMO_FIGHT_PROFILE.dna[b.schluessel]}
                  </span>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Gegner-Scouting ────────────────────────────────────────────────
          Leon (23.09.): „etwas, das darauf schließen lässt, dass man mit
          unserem Gegner-Scouting maximale Performance abliefern kann, weil
          man den Gegner durchleuchtet hat und alles von ihm weiß." Der Satz
          ist seiner (24.09.). Die 748: Analysepunkte je Video 374 (Zählung
          eines Parallelfensters am 24.09. — Techniken mit Versuchen,
          Treffern, Zone und Wirkung, dazu die 67 DNA-Fragen), Athlet und
          Gegner zusammen 748. Ändert sich ein Katalog, diese Zahl neu
          zählen. */}
      <section aria-labelledby="abo-scouting-titel" className="t-card flex flex-col gap-3 p-5 md:p-6">
        <h2 id="abo-scouting-titel" className="t-sheet-title" style={{ color: "var(--text-1)" }}>
          Gegner-Scouting
        </h2>
        <p style={{ font: "var(--type-h2)", color: "var(--text-1)" }}>Vorbereitet auf jeden Gegner.</p>
        <p className="max-w-3xl" style={{ font: "var(--type-body)", color: "var(--text-2)" }}>
          Analysiere die Videos von eurem Gegner und erfahre direkt: wie er kämpft, womit er reinkommt, wo du ihn
          erwischst. Mit 748 charakteristischen Parametern werden das Gegnerprofil und die Fight-DNA deines Athleten
          gegeneinander untersucht und ihr erhaltet den perfekten Trainingsplan, der bis zum Wettkampftag genau
          abgestimmt ist.
        </p>
      </section>
    </div>
  );
}
