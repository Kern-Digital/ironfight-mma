"use client";

/**
 * KALENDER — ein Tag (`Kalender`) oder ein Zeitraum (`ZeitraumKalender`).
 *
 * Leon 27.09.2026: „nutze für einen zeitraum diesen kalender version,
 * überprüfe aber ob sich da etwas eingeschlichen hat in den code". Vorlage
 * war `calendar-rac.tsx` (Origin UI, shadcn-Aufbau auf react-aria-
 * components). Die Logik — Tastatur, Bildschirmleser, Zeitraum-Auswahl mit
 * Hover-Vorschau — kommt unverändert aus react-aria-components. Angepasst
 * wurde, was in DIESER App nicht funktioniert hätte:
 *
 *   · Die Vorlage färbt mit shadcn-Farben (`bg-primary`, `bg-accent`,
 *     `text-muted-foreground`, `bg-background`, `outline-ring`,
 *     `bg-destructive`). Die gibt es hier nicht — Tailwind hätte sie STILL
 *     weggelassen, und `bg-accent` wäre hier das volle Markencyan beim
 *     Überfahren gewesen. Dazu ein fest verdrahtetes `bg-red-100`, das im
 *     dunklen Thema leuchtet. Jetzt: die Tokens der App, als CSS in
 *     globals.css (Abschnitt KALENDER), hell und dunkel.
 *   · `ChevronLeftIcon size={16} strokeWidth={2}` aus @radix-ui/react-icons:
 *     Radix-Icons kennen weder `size` noch `strokeWidth` (das sind
 *     lucide-Props) — ein Typfehler, und das Paket wäre nur dafür gekommen.
 *     Jetzt: die Icon-Registry (`chevron-left`/`chevron-right`).
 *   · `cn` aus `@/lib/utils` gibt es hier nicht (kein shadcn-Projekt).
 *   · „Heute" rechnete die Vorlage in der Zeitzone des GERÄTS. Die Pläne
 *     rechnen in deutscher Zeit (tagSchluessel) — ein Trainer im Urlaub hätte
 *     sonst einen anderen „heute"-Tag gesehen als der Server. Jetzt:
 *     Europe/Berlin.
 *   · Ohne Sprache zeigt react-aria die Sprache des Browsers. Jetzt:
 *     `de-DE` fest (Montag zuerst, deutsche Monatsnamen).
 *   · Zellen 44 × 44 px (`--hit-min`), die Vorlage hatte 36 px.
 *   · Tage außerhalb des Monats stehen nicht mehr sichtbar im Raster.
 * Schadcode fand sich keiner: keine Netzaufrufe, kein eval, kein
 * dangerouslySetInnerHTML. Die Demo verlinkte nach außen — sie ist nicht
 * übernommen. Pakete exakt gepinnt (react-aria-components 1.21.1,
 * @internationalized/date 3.12.4, beide Adobe, Registry geprüft).
 */

import Icon from "@/components/ui/Icon";
import { today, type DateValue } from "@internationalized/date";
import type { ComponentProps } from "react";
import {
  Button,
  Calendar as CalendarRac,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  Heading,
  I18nProvider,
  RangeCalendar as RangeCalendarRac,
} from "react-aria-components";

/** Die Zeitzone, in der die App ihre Tage zählt (lib/guthaben.ts, tagSchluessel). */
export const KALENDER_ZONE = "Europe/Berlin";

function KalenderKopf() {
  return (
    <header className="flex w-full items-center gap-1 pb-1">
      <Button slot="previous" className="kal-nav">
        <Icon name="chevron-left" size={18} strokeWidth={2.2} />
      </Button>
      <Heading className="grow text-center" style={{ font: "var(--type-body-strong)", color: "var(--text-1)" }} />
      <Button slot="next" className="kal-nav">
        <Icon name="chevron-right" size={18} strokeWidth={2.2} />
      </Button>
    </header>
  );
}

function KalenderRaster() {
  const heute = today(KALENDER_ZONE);
  return (
    <CalendarGrid className="kal-raster">
      <CalendarGridHeader>{(tag) => <CalendarHeaderCell className="kal-kopfzelle">{tag}</CalendarHeaderCell>}</CalendarGridHeader>
      <CalendarGridBody>
        {(datum) => (
          <CalendarCell
            date={datum}
            data-datum={datum.toString()}
            className={datum.compare(heute) === 0 ? "kal-zelle kal-heute" : "kal-zelle"}
          />
        )}
      </CalendarGridBody>
    </CalendarGrid>
  );
}

type KalenderProps = Omit<ComponentProps<typeof CalendarRac<DateValue>>, "children" | "className"> & {
  className?: string;
};
type ZeitraumKalenderProps = Omit<ComponentProps<typeof RangeCalendarRac<DateValue>>, "children" | "className"> & {
  className?: string;
};

/** Einen Tag wählen. */
export function Kalender({ className, ...props }: KalenderProps) {
  return (
    <I18nProvider locale="de-DE">
      <CalendarRac {...props} className={`kal w-fit ${className ?? ""}`}>
        <KalenderKopf />
        <KalenderRaster />
      </CalendarRac>
    </I18nProvider>
  );
}

/** Einen Zeitraum wählen: erster Tipp Beginn, zweiter Tipp Ende. */
export function ZeitraumKalender({ className, ...props }: ZeitraumKalenderProps) {
  return (
    <I18nProvider locale="de-DE">
      <RangeCalendarRac {...props} className={`kal kal-bereich w-fit ${className ?? ""}`}>
        <KalenderKopf />
        <KalenderRaster />
      </RangeCalendarRac>
    </I18nProvider>
  );
}
