/**
 * DER Seitenkopf des Coach-Bereichs — einer statt zehn Kopien.
 *
 * WARUM ES DIESEN BAUSTEIN GIBT (gemessen 03.09.2026, Rollout-Schritt 4):
 * Derselbe Kopf lag ACHTMAL von Hand nachgebaut in den Trainer- und
 * Admin-Seiten — ein radialer Schein über einem fest verdrahteten dunklen
 * Verlauf —, dazu die alte `components/PageHeader.tsx` auf `bg-carbon-*`
 * für /help, /regeln und /quiz. Zehn Kopien mit demselben Fehler:
 *
 *   Der Verlauf war DUNKEL HARTKODIERT, die Schrift darauf folgte dem Theme.
 *   Im hellen Theme stand damit dunkle Schrift auf dunklem Grund —
 *   nachgemessen per Canvas (getComputedStyle gibt oklch() unaufgelöst
 *   zurück): 1,09:1 auf /trainer/athleten, /trainer/competitions,
 *   /trainer/opponents und /trainer/deepfight/athletes. WCAG AA verlangt für
 *   große Schrift 3:1. Der Titel war schlicht unlesbar.
 *
 * Hier kommt jede Farbe aus Tokens, damit folgt der Kopf beiden Themes UND
 * jedem Gym-Akzent von selbst (DESIGN-BRIEF §1.1). Aufbau und Maße sind die
 * der vier fertigen Seiten (/trainer, /verwaltung, /admin, /schedule): eine
 * maskierte Ambient-Schicht hinter dem Titelblock, `--type-display` in
 * Versalien, Beschreibung in `--type-sub`.
 *
 * DIE AMBIENT-SCHICHT IST HIER FLÄCHE, NICHT GLOW — sie trägt deshalb KEINE
 * `[data-glow]`-Kinder. Das ist wichtig: In der Stab-Hülle blendet
 * `.staff-content [data-ambient]:not(:has([data-glow]))` genau diese Fassung
 * aus, weil dort der Schein der HÜLLE gilt (Begründung in globals.css). Außerhalb
 * der Hülle — /help, /regeln, /quiz sieht auch ein Athlet — bleibt sie stehen
 * und gibt der Seite ihren Kopf. Ein Kopf, der beides kann, ohne es zu wissen.
 */

import Icon, { type IconName } from "@/components/ui/Icon";
import { SeitenZurueck } from "./KopfNavigation";

/**
 * Die Lesespur. Drei benannte Werte statt freier Klassen — sonst driften die
 * Seiten wieder auseinander, und genau das war der Ausgangszustand.
 *
 * `standard` ist die Spalte der vier fertigen Seiten. `wide` tragen Listen,
 * die am Desktop drei Spalten brauchen (Athleten, Gegner, Nutzer). `narrow`
 * gehört zu Formularen — ein Eingabefeld über die volle Breite liest sich
 * schlecht, egal wie viel Platz da ist.
 *
 * Bis zum 11.09.2026 gab es hier ein viertes, `detail` auf `max-w-4xl` —
 * ein Erbstück allein für die Wettkampf-Detailseite. Mit ihrem Umbau steht
 * ihr Rumpf auf `standard`, und der Eintrag ist weg.
 */
const LANES = {
  standard: "max-w-2xl lg:max-w-5xl",
  wide: "max-w-7xl",
  narrow: "max-w-3xl",
} as const;

export type PageHeadLane = keyof typeof LANES;

export default function PageHead({
  eyebrow,
  eyebrowIcon,
  title,
  description,
  back,
  initials,
  aside,
  children,
  lane = "standard",
}: {
  /** Kleine Versal-Zeile über dem Titel — der Bereich, in dem man steht. */
  eyebrow?: string;
  /** Symbol davor. Zweite, FARBUNABHÄNGIGE Kennzeichnung des Bereichs:
      Farbe steht nie allein (globals.css, Bereichsfarben). */
  eyebrowIcon?: IconName;
  /** Text oder Knoten — manche Seiten tragen hier die DeepFight-Wortmarke,
      die als untrennbare Einheit hereingereicht wird (DESIGN-BRIEF §1.6). */
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Weg zurück in die Liste, aus der man kam. */
  back?: { href: string; label: string };
  /** Initialen-Kachel vor dem Titel (Athleten- und Analyse-Detailseiten). */
  initials?: string;
  /** Rechte Seite: Kennzahl-Karte, Knöpfe oder was die Seite dort braucht. */
  aside?: React.ReactNode;
  /**
   * Unter der Beschreibung, noch IN der Titelspalte: Badge-Reihen und
   * Einstiege, die zum Titel gehören (Disziplin und Level eines Athleten,
   * der Zustand eines Wettkampfs). Sie stehen hier und nicht als erster
   * Block der Seite, weil sie den Titel beschreiben — fielen sie unter die
   * Ambient-Schicht, läsen sie sich als Inhalt statt als Kopfzeile.
   */
  children?: React.ReactNode;
  lane?: PageHeadLane;
}) {
  return (
    <section className="relative">
      {/* Der Clip-Behälter umschließt NUR die Ambient-Ebene. Läge er auf der
          Sektion, schnitte er den weichen Schatten einer Glas-Karte im
          `aside` ab (dieselbe Falle wie auf /trainer). */}
      <div
        className="absolute inset-0 overflow-hidden"
        aria-hidden
        style={{
          maskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, black 55%, transparent 100%)",
        }}
      >
        <div data-ambient style={{ background: "var(--ambient)" }} />
      </div>

      <div
        className={`relative mx-auto flex w-full flex-col gap-4 px-4 pb-5 pt-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8 lg:px-6 lg:pb-7 lg:pt-7 ${LANES[lane]}`}
      >
        <div className="flex min-w-0 flex-col gap-1 lg:flex-1">
          {/* Der Weg zurück: in der Seite UND ab lg groß im Kopf der Hülle
              (Leon 18.09.2026, components/shell/KopfNavigation.tsx). */}
          {back && <SeitenZurueck href={back.href} label={back.label} />}

          {eyebrow && (
            <span
              className="flex items-center gap-2 t-label"
              style={{ color: "var(--text-label)" }}
            >
              {eyebrowIcon && (
                <Icon name={eyebrowIcon} size={15} strokeWidth={2.2} />
              )}
              {eyebrow}
            </span>
          )}

          <div className="flex min-w-0 items-center gap-3">
            {initials && (
              <span
                aria-hidden
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-card"
                style={{
                  font: "var(--type-h2)",
                  letterSpacing: "var(--ls-label)",
                  background: "var(--accent-subtle)",
                  border:
                    "1px solid color-mix(in oklab, var(--accent) 40%, transparent)",
                  color: "var(--accent-text)",
                }}
              >
                {initials}
              </span>
            )}
            <h1
              className="min-w-0"
              style={{
                font: "var(--type-display)",
                letterSpacing: "var(--ls-display)",
                textTransform: "uppercase",
              }}
            >
              {title}
            </h1>
          </div>

          {description && (
            <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              {description}
            </p>
          )}

          {children && <div className="mt-1.5">{children}</div>}
        </div>

        {aside && (
          <div className="flex flex-wrap gap-2.5 lg:w-[380px] lg:shrink-0 lg:justify-end">
            {aside}
          </div>
        )}
      </div>
    </section>
  );
}
