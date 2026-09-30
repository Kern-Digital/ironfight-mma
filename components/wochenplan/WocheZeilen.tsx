"use client";

/**
 * DIE WOCHE IN ZEILEN — ein Tag je Zeile, die Kurse als Kapseln auf einer
 * quer liegenden Uhrzeit-Achse (aus Entwurf C, 28.09.2026).
 *
 * Leon 28.09.: „ich finde B am besten jedoch C hat auch seine vorteile …
 * einen Button mit ansicht wechseln … zwischen b und c … nur was das feld
 * angeht, die seite links von b mit deine pläne bleiben bestehen". Deshalb
 * als eigenes Bauteil: Entwurf B schaltet zwischen seinem Kalender und
 * diesen Zeilen um. Stile: zeilen.module.css, die Hülle `.wocheHuelle`
 * gibt den Container für die Umbrüche.
 *
 * Breit: Uhrzeit-Achse, Stunden ohne Kurs ab zwei am Stück gefaltet,
 * Überschneidungen bekommen eine eigene Spur darunter. Schmal: jeder Tag
 * als Liste.
 */

import { blockMeta } from "@/components/schedule/WochenRaster";
import Icon from "@/components/ui/Icon";
import { getBlocksForDay, WEEKDAY_LABELS } from "@/lib/schedule";
import type { TrainingBlock } from "@/lib/types";
import { useMemo } from "react";
import { usePlusZeiger } from "./PlusZeiger";
import s from "./zeilen.module.css";
import { titelMitUmbruch, type WochenplanDaten } from "./useWochenplanDaten";

/** Höhe einer Kapsel und Luft zwischen zwei Spuren eines Tages. */
const KAPSEL_H = 58;
const SPUR_LUFT = 6;
/** Gewicht einer gefalteten Lücke gegenüber einer vollen Stunde. */
const LUECKE_GEWICHT = 0.35;

const minuten = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

interface Stueck {
  von: number;
  bis: number;
  x: number;
  w: number;
  luecke: boolean;
}

/** Quer liegende Uhrzeit-Achse; Stunden ohne Kurs ab zwei am Stück gefaltet. */
function achseBauen(kurse: TrainingBlock[]) {
  const vonStd = kurse.length
    ? Math.floor(Math.min(...kurse.map((k) => minuten(k.startTime))) / 60)
    : 16;
  const bisStd = kurse.length
    ? Math.ceil(Math.max(...kurse.map((k) => minuten(k.endTime))) / 60)
    : 21;
  // Ohne Kurse wird NICHTS gefaltet (Leon 28.09.: ein leer angelegter Plan
  // zeigte nur einen schmalen Streifen) — die leere Woche steht in voller Höhe.
  const belegt = (h: number) =>
    kurse.length === 0 ||
    kurse.some(
      (k) => minuten(k.startTime) < (h + 1) * 60 && minuten(k.endTime) > h * 60,
    );
  const roh: Omit<Stueck, "x" | "w">[] = [];
  const gewichte: number[] = [];
  let h = vonStd;
  while (h < bisStd) {
    let ende = h;
    while (ende < bisStd && !belegt(ende)) ende++;
    if (ende - h >= 2) {
      roh.push({ von: h * 60, bis: ende * 60, luecke: true });
      gewichte.push(LUECKE_GEWICHT);
      h = ende;
    } else {
      roh.push({ von: h * 60, bis: (h + 1) * 60, luecke: false });
      gewichte.push(1);
      h++;
    }
  }
  const summe = gewichte.reduce((a, b) => a + b, 0) || 1;
  let x = 0;
  const stuecke: Stueck[] = roh.map((r, i) => {
    const w = (gewichte[i] / summe) * 100;
    const st = { ...r, x, w };
    x += w;
    return st;
  });
  const xVon = (min: number) => {
    const st =
      stuecke.find((q) => min >= q.von && min <= q.bis) ??
      stuecke[stuecke.length - 1];
    if (!st) return 0;
    return st.x + ((min - st.von) / (st.bis - st.von)) * st.w;
  };
  return { stuecke, xVon };
}

/** Überschneidende Kurse eines Tages bekommen je eine eigene Spur (Zeile). */
function spurenLegen(bloecke: TrainingBlock[]) {
  const enden: number[] = [];
  const spur = new Map<string, number>();
  for (const b of bloecke) {
    const von = minuten(b.startTime);
    let i = enden.findIndex((e) => e <= von);
    if (i === -1) i = enden.length;
    enden[i] = minuten(b.endTime);
    spur.set(b.id, i);
  }
  return { spur, spuren: Math.max(1, enden.length) };
}

export default function WocheZeilen({
  d,
  zeigeOffen,
}: {
  d: WochenplanDaten;
  zeigeOffen: boolean;
}) {
  // Die Achse folgt ALLEN Kursen des Plans, nicht dem Raumfilter — sonst
  // springt sie beim Filtern.
  const achse = useMemo(() => achseBauen(d.kurse), [d.kurse]);
  const plusZeiger = usePlusZeiger();

  function kapsel(k: TrainingBlock, spur: number) {
    const { dotColor: roh, meta } = blockMeta(k);
    const dotColor = roh === "var(--text-3)" ? "var(--line-strong)" : roh;
    const fehlt = d.offenIds.has(k.id);
    const namen = d.trainerVon(k);
    const raum = d.raumVon(k);
    const x = achse.xVon(minuten(k.startTime));
    const w = achse.xVon(minuten(k.endTime)) - x;
    return (
      <button
        key={k.id}
        type="button"
        data-press
        className={s.kapsel}
        data-offen={fehlt ? "" : undefined}
        data-gedimmt={zeigeOffen && !fehlt ? "" : undefined}
        style={
          {
            "--farbe": dotColor,
            "--x": `${x}%`,
            "--w": `calc(${w}% - 4px)`,
            "--y": `${spur * (KAPSEL_H + SPUR_LUFT)}px`,
            "--kh": `${KAPSEL_H}px`,
          } as React.CSSProperties
        }
        onClick={() => d.setZiel({ art: "kurs", titel: k.title })}
        title={[
          `${k.title}, ${k.startTime}–${k.endTime}`,
          meta,
          raum,
          fehlt ? "ohne Trainer" : namen.join(", "),
        ]
          .filter(Boolean)
          .join(" · ")}
        data-kurs-zeile={k.id}
      >
        <span className={s.kZeile}>
          {k.startTime}
          {d.trainer !== null && (
            <span className={s.kTrainer} data-fehlt={fehlt ? "" : undefined}>
              <span className={fehlt ? s.dreieck : undefined}>
                <Icon
                  name={fehlt ? "warn" : "user"}
                  size={fehlt ? 12 : 10}
                  strokeWidth={2.2}
                />
              </span>
              <span className={s.kTrainerText}>
                {fehlt ? "Trainer fehlt" : namen.join(", ")}
              </span>
            </span>
          )}
        </span>
        <span className={s.kTitel}>{titelMitUmbruch(k.title)}</span>
      </button>
    );
  }

  return (
    <div className={s.wocheHuelle}>
      <div
        ref={plusZeiger.host}
        className={s.woche}
        data-ansicht="zeilen"
        onMouseLeave={plusZeiger.weg}
      >
        {plusZeiger.zeiger}
        <div className={s.achsZeile} aria-hidden>
          <div />
          <div className={s.achse}>
            {achse.stuecke.map((st) =>
              st.luecke ? null : (
                <span
                  key={st.von}
                  className={s.stunde}
                  style={{ left: `${st.x}%` }}
                >
                  {String(Math.floor(st.von / 60)).padStart(2, "0")}:00
                </span>
              ),
            )}
          </div>
        </div>
        {WEEKDAY_LABELS.map((label, i) => {
          const bloecke = getBlocksForDay(d.sichtbar, i);
          const { spur, spuren } = spurenLegen(bloecke);
          return (
            <section
              key={i}
              className={s.tag}
              data-heute={i === d.heute ? "" : undefined}
              aria-label={label}
            >
              <div className={s.tagKopf}>
                <span className={s.tagName}>
                  {label}
                  {i === d.heute && <span className="sr-only"> (heute)</span>}
                </span>
                <span className={s.tagZahl}>
                  {bloecke.length === 0
                    ? ""
                    : bloecke.length === 1
                      ? "1 Kurs"
                      : `${bloecke.length} Kurse`}
                </span>
                <button
                  type="button"
                  data-press
                  className={s.tagPlus}
                  onClick={() => d.setZiel({ art: "neu", weekday: i })}
                  aria-label={`Kurs am ${label} anlegen`}
                  data-kurs-anlegen-tag={i}
                >
                  <Icon name="plus" size={11} strokeWidth={2.6} />
                  Kurs
                </button>
              </div>
              <div
                className={s.bahn}
                style={
                  {
                    "--bahn-h": `${spuren * (KAPSEL_H + SPUR_LUFT) - SPUR_LUFT}px`,
                  } as React.CSSProperties
                }
                onMouseMove={plusZeiger.bewegen}
                onClick={(e) => {
                  if (e.target === e.currentTarget)
                    d.setZiel({ art: "neu", weekday: i });
                }}
              >
                {achse.stuecke.map((st, j) =>
                  st.luecke ? (
                    <span
                      key={st.von}
                      className={s.lueckeStreifen}
                      style={{ left: `${st.x}%`, width: `${st.w}%` }}
                    />
                  ) : j === 0 ? null : (
                    <span
                      key={st.von}
                      className={s.linie}
                      style={{ left: `${st.x}%` }}
                    />
                  ),
                )}
                {bloecke.length === 0 ? (
                  <span className={s.frei}>Frei</span>
                ) : (
                  bloecke.map((k) => kapsel(k, spur.get(k.id) ?? 0))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
