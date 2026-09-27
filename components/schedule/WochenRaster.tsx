"use client";

/**
 * DAS WOCHENRASTER — Tagesspalte und Kurszeile, geteilt von zwei Seiten
 * (27.09.2026, aus app/schedule/page.tsx herausgelöst):
 *
 *   · Kursplan (/schedule): Antippen öffnet die Stunde dieser Woche —
 *     Techniken, Rückmeldung, Abo.
 *   · Wochenplan der Verwaltung (/verwaltung/wochenplan): Antippen öffnet
 *     den Kurs selbst — Tag, Uhrzeit, Trainer. Leon 27.09.: „in der
 *     verwaltungsebene soll der Kursplan wochenplan heißen und wenn ich
 *     darauf gehe dann soll ich kurse hinzufügen können, bearbeiten".
 *
 * Beide Seiten zeigen DIESELBE Woche im selben Raster; was sie unterscheidet,
 * kommt über `zusatz` (eine Zeile unter der Meta, z. B. der Trainer) und
 * `fuss` (unten in der Tageskarte, z. B. „Kurs anlegen").
 *
 * Maße und Umbruch der Zeilen stehen in globals.css („Wochenplan-Raster",
 * `.week-row`, `.week-grid`).
 */

import { Fragment } from "react";
import { CATEGORY_COLOR, DISCIPLINE_COLOR } from "@/lib/discipline-colors";
import type { TrainingBlock } from "@/lib/types";

const LEVEL_LABEL: Record<string, string> = {
  kids: "Kids",
  teens: "Teens",
  adult: "Adult",
  advanced: "Advanced",
  mixed: "Mixed",
};

// Farben zentral aus lib/discipline-colors.ts — eine Rubrik = app-weit eine Farbe.
export const CATEGORY_STYLE: Record<string, { label: string; color: string }> = {
  boxing:      { label: "Box",       color: CATEGORY_COLOR.boxing },
  wrestling:   { label: "Ringen",    color: CATEGORY_COLOR.wrestling },
  bjj:         { label: "BJJ",       color: CATEGORY_COLOR.bjj },
  "muay-thai": { label: "Muay Thai", color: CATEGORY_COLOR["muay-thai"] },
};

/** Kurze Kampfart-Namen für die schmale Spalte des Rasters. */
export const KAMPFART_KURZ: Record<string, string> = {
  boxing:            "Boxing",
  kickboxen:         "Kickboxen",
  "muay-thai":       "Muay Thai",
  "fitness-kickboxen": "Fitness-KB",
  wrestling:         "Wrestling",
  bjj:               "BJJ",
  mma:               "MMA",
  karate:            "Karate",
  "wing-tsung":      "Wing Tsung",
  "self-defense":    "Self-Defense",
};

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

export const MONO_TIME: React.CSSProperties = {
  font: "600 13px/1.2 var(--font-mono), ui-monospace, monospace",
};

/**
 * Meta-Zeile eines Kurses + Farbpunkt der Disziplin. Der Text trägt die
 * Information, die Farbe verstärkt nur (Multi-Gym: Rubriken sind später frei
 * konfigurierbar). Gezeigt wird NUR, was der Kurstitel nicht schon selbst
 * sagt — Titel wie „Kickboxen Adult" bekommen keine Echo-Unterzeile.
 */
export function blockMeta(block: TrainingBlock): { dotColor: string; meta: string } {
  const catStyle = block.category ? CATEGORY_STYLE[block.category] : null;
  const dotColor =
    (block.discipline ? DISCIPLINE_COLOR[block.discipline] : null) ??
    catStyle?.color ??
    "var(--text-3)";
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöüß]/g, "");
  const title = norm(block.title);
  const levelLabel = block.level ? LEVEL_LABEL[block.level] ?? block.level : null;
  const disciplineLabel = block.discipline
    ? KAMPFART_KURZ[block.discipline] ?? block.discipline
    : catStyle?.label ?? null;
  const meta = [levelLabel, disciplineLabel]
    .filter((part): part is string => Boolean(part && !title.includes(norm(part))))
    .join(" · ");
  return { dotColor, meta };
}

/**
 * Zerlegt einen Kurstitel an den Stellen, an denen er umbrechen DARF.
 *
 * Kurstitel sind keine normalen Wörter: „MMA/Kickboxen Sparring" und
 * „(Fitness-)Kickboxen" haben für den Browser keinen einzigen regulären
 * Umbruchpunkt — nach einem Schrägstrich bricht er nicht, und der Bindestrich
 * in „(Fitness-)" ist durch die Klammer dahinter blockiert. In einer 145 px
 * schmalen Tagesspalte kam deshalb erst gar kein Umbruch zustande (der Titel
 * wurde bis 02.09. am Kartenrand abgeschnitten) und danach, mit
 * `overflow-wrap: anywhere`, einer mitten im Wort: „MMA/Kickboxe | n".
 *
 * Die Rückgabe wird mit `<wbr />` verbunden — dem HTML-Element, das genau
 * das sagt: „hier darfst du trennen, musst aber nicht". Anders als ein
 * eingefügtes Nullbreiten-Leerzeichen landet es nicht im kopierten Text.
 */
function titleParts(title: string): string[] {
  // Nach Schrägstrich, Bindestrich und schließender Klammer darf getrennt
  // werden — das sind die Fugen, die ein Mensch selbst wählen würde. Echte
  // Wortzwischenräume bleiben INNERHALB der Stücke: würde man auch an ihnen
  // trennen, klebten die Wörter beim Zusammensetzen aneinander.
  const parts: string[] = [];
  let current = "";
  for (const ch of title) {
    current += ch;
    if (ch === "/" || ch === "-" || ch === ")") {
      parts.push(current);
      current = "";
    }
  }
  if (current) parts.push(current);
  return parts;
}

// ─── DayColumn ──────────────────────────────────────────────────────────────

export function DayColumn({
  blocks,
  isToday,
  onBlockClick,
  label,
  zusatz,
  fuss,
}: {
  blocks: TrainingBlock[];
  isToday: boolean;
  onBlockClick: (b: TrainingBlock) => void;
  label: string;
  /** Eine Zeile unter der Meta jeder Kurszeile (Wochenplan: der Trainer). */
  zusatz?: (b: TrainingBlock) => React.ReactNode;
  /** Unten in der Tageskarte (Wochenplan: „Kurs anlegen" für diesen Tag). */
  fuss?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span
          className="t-label"
          style={isToday ? { color: "var(--accent-text)" } : undefined}
        >
          {label}
        </span>
        {isToday && (
          <span
            className="h-[5px] w-[5px] rounded-full"
            style={{ background: "var(--accent)" }}
            aria-hidden
          />
        )}
      </div>
      <div className="t-card flex flex-1 flex-col px-3.5 py-0.5">
        {blocks.length === 0 ? (
          <div
            className="flex items-center justify-center py-5"
            style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
          >
            Frei
          </div>
        ) : (
          blocks.map((block, i) => (
            <Fragment key={block.id}>
              {/* Trennlinie als eigenes Element — läge sie als border-top auf
                  der gerundeten Zeile, würden ihre Enden mitgerundet */}
              {i > 0 && (
                <div aria-hidden style={{ height: "1px", background: "var(--line)" }} />
              )}
              <BlockRow block={block} onClick={() => onBlockClick(block)} zusatz={zusatz?.(block)} />
            </Fragment>
          ))
        )}
        {fuss && (
          <>
            <div aria-hidden className="mt-auto" style={{ height: "1px", background: "var(--line)" }} />
            {fuss}
          </>
        )}
      </div>
    </section>
  );
}

// ─── BlockRow ─────────────────────────────────────────────────────────────

function BlockRow({
  block,
  onClick,
  zusatz,
}: {
  block: TrainingBlock;
  onClick: () => void;
  zusatz?: React.ReactNode;
}) {
  const { dotColor, meta } = blockMeta(block);

  return (
    <button
      type="button"
      onClick={onClick}
      className="week-row t-interactive flex min-h-hit w-full items-start gap-3 rounded-badge py-3 text-left"
      data-kurs-zeile={block.id}
    >
      {/* Zeitspanne. In der Listen-Fassung eine schmale Spalte LINKS, im
          Wochenraster eine Zeile ÜBER dem Titel (globals.css `.week-row`) —
          die 56 px, die Spalte und Lücke dort kosten, fehlten dem Titel
          genau dort, wo er am wenigsten Platz hat. */}
      <div className="week-row-time flex w-11 shrink-0 flex-col gap-0.5">
        <span style={{ ...MONO_TIME, color: "var(--accent-text)" }}>
          {block.startTime}
        </span>
        <span
          className="week-row-dash"
          aria-hidden
          style={{ font: "var(--row-time-end)", color: "var(--text-3)" }}
        >
          –
        </span>
        <span style={{ font: "var(--row-time-end)", color: "var(--text-3)" }}>
          {block.endTime}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* `anywhere`: Kurstitel wie „MMA/Kickboxen Sparring" haben in einer
            schmalen Spalte keinen regulären Umbruchpunkt und wurden bis
            02.09. am Kartenrand ABGESCHNITTEN (gemessen: 9 von 30 Titeln bei
            1440 px). Lieber ein Umbruch mitten im Wort als ein halber Titel. */}
        <span
          style={{ font: "var(--type-body-strong)", overflowWrap: "anywhere" }}
        >
          {titleParts(block.title).map((part, i, all) => (
            <Fragment key={i}>
              {part}
              {i < all.length - 1 && <wbr />}
            </Fragment>
          ))}
        </span>
        {meta && (
          <span
            className="flex items-center gap-1.5"
            style={{ ...META_FONT, color: "var(--text-3)" }}
          >
            <span
              className="h-[5px] w-[5px] shrink-0 rounded-full"
              style={{ background: dotColor }}
              aria-hidden
            />
            <span className="min-w-0" style={{ overflowWrap: "anywhere" }}>
              {meta}
            </span>
          </span>
        )}
        {zusatz}
      </div>
    </button>
  );
}
