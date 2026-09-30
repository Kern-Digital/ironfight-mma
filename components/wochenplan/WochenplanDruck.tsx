"use client";

/**
 * DIE DRUCKFASSUNG DES WOCHENPLANS (28.09.2026) — das, was als PDF oder Bild
 * aus der App geht. Eine feste Fläche mit eigenen Hex-Farben, ohne Glas und
 * ohne App-Tokens: Sie sieht auf Papier, im Gruppenchat und in beiden Themes
 * gleich aus.
 *
 * AUFBAU
 *   · Kopf: Label „Wochenplan", groß der Planname (Leon 29.09.), darunter
 *     Zeitraum und — bei aktivem Raumfilter — der Raum. Rechts das Zeichen:
 *     Gym-Logo (bezahlt), Tidal-Zeichen (frei). Bezahlt ohne Logo steht der
 *     Gym-Name als Schriftzug in der Gym-Farbe (Leon 28.09.).
 *   · Quer (A4, Bild quer): Tage nebeneinander. Hoch (1080 × 1350): ein Tag
 *     je Zeile, die Kurse daneben.
 *   · Fuß: „Stand …", damit ein alter Aushang als alt erkennbar ist, rechts
 *     der Gym-Name. Nur der freie Tarif nennt Tidal.
 *
 * EINPASSEN: Jede Größe hängt an `--s`. `einpassen()` sucht den größten
 * Faktor, bei dem die Woche noch in die Fläche passt — ein Gym mit sechs
 * Kursen bekommt große Schrift, eines mit dreißig kleinere, keins wird
 * abgeschnitten.
 */

import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";
import type { DruckMarke, ExportFormat } from "@/lib/wochenplan-export";
import TidalZeichen, { TIDAL_PETROL } from "./TidalZeichen";
import { titelMitUmbruch } from "./useWochenplanDaten";

export interface DruckKurs {
  id: string;
  zeit: string;
  titel: string;
  trainer: string;
  raum?: string;
}

export interface DruckTag {
  label: string;
  kurse: DruckKurs[];
}

export interface WochenplanDruckProps {
  format: ExportFormat;
  marke: DruckMarke;
  planName: string | null;
  gueltig: string | null;
  raum: string | null;
  tage: DruckTag[];
  stand: string;
}

export interface WochenplanDruckGriff {
  /** Die Fläche, die aufgenommen wird. */
  knoten: HTMLDivElement | null;
  /** Nach dem Laden der Schriften erneut einpassen. */
  einpassen: () => void;
}

const SANS = "var(--font-archivo), Archivo, system-ui, sans-serif";
const MONO = "var(--font-mono), ui-monospace, SFMono-Regular, monospace";
const s = (n: number) => `calc(${n}px * var(--s, 1))`;
// Schriftgrößen auf ganze Pixel: html-to-image setzt beim Aufnehmen jede
// Größe auf floor(px) − 0,1. Bei krummen Größen wurde die Schrift in der
// Datei bis zu 1 px kleiner als in der Vorschau, Zeilen brachen dort nicht
// mehr um, und die Karten (feste Höhe aus der Vorschau) hatten unten Luft.
const fs = (n: number) => `round(down, calc(${n}px * var(--s, 1)), 1px)`;

const S_MIN = 0.45;
const S_MAX = 1.4;

function einpassenIn(wurzel: HTMLDivElement, flaeche: HTMLDivElement, inhalt: HTMLDivElement) {
  const passt = (f: number) => {
    wurzel.style.setProperty("--s", String(f));
    // Auch jeder Tagesname muss in seine Spalte passen — „DONNERSTAG" bricht nie.
    const tage = Array.from(inhalt.querySelectorAll<HTMLElement>("[data-druck-tag]"));
    return (
      inhalt.scrollHeight <= flaeche.clientHeight + 0.5 &&
      inhalt.scrollWidth <= flaeche.clientWidth + 0.5 &&
      tage.every((t) => t.scrollWidth <= t.clientWidth + 0.5)
    );
  };
  let lo = S_MIN;
  let hi = S_MAX;
  if (passt(hi)) return;
  for (let i = 0; i < 10; i++) {
    const mitte = (lo + hi) / 2;
    if (passt(mitte)) lo = mitte;
    else hi = mitte;
  }
  wurzel.style.setProperty("--s", String(lo));
}

function Kurs({ k, marke }: { k: DruckKurs; marke: DruckMarke }) {
  const f = marke.farben;
  // Ohne Farbkante links (Leon 29.09.): eine ruhige Fläche, die Uhrzeit
  // trägt die Farbe.
  return (
    <div
      style={{
        background: f.flaeche,
        borderRadius: s(10),
        padding: `${s(11)} ${s(13)} ${s(12)}`,
        display: "flex",
        flexDirection: "column",
        gap: s(3),
        breakInside: "avoid",
        minWidth: 0,
      }}
    >
      <span style={{ font: `700 ${fs(15)}/1.2 ${MONO}`, color: f.akzent, letterSpacing: "0.01em" }}>{k.zeit}</span>
      {/* Umbruch nach „/", „-", „)" wie im Kursplan — nie mitten in „Kickb|oxen" */}
      <span style={{ font: `700 ${fs(19)}/1.2 ${SANS}`, color: f.tinte, overflowWrap: "break-word" }}>
        {titelMitUmbruch(k.titel)}
      </span>
      {(k.trainer || k.raum) && (
        <span style={{ font: `500 ${fs(14)}/1.3 ${SANS}`, color: f.text2, overflowWrap: "anywhere" }}>
          {k.trainer}
          {k.trainer && k.raum && <span style={{ color: f.text3 }}>{"  ·  "}</span>}
          {k.raum && (
            <span
              style={{
                font: `700 ${fs(12)}/1.3 ${SANS}`,
                color: f.text3,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                whiteSpace: "nowrap",
              }}
            >
              {k.raum}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

const WochenplanDruck = forwardRef<WochenplanDruckGriff, WochenplanDruckProps>(function WochenplanDruck(
  { format, marke, planName, gueltig, raum, tage, stand },
  ref,
) {
  const wurzel = useRef<HTMLDivElement>(null);
  const flaeche = useRef<HTMLDivElement>(null);
  const inhalt = useRef<HTMLDivElement>(null);
  const f = marke.farben;
  const quer = format.lage === "quer";
  const pad = quer ? 72 : 64;

  const einpassen = () => {
    if (wurzel.current && flaeche.current && inhalt.current) {
      einpassenIn(wurzel.current, flaeche.current, inhalt.current);
    }
  };
  useImperativeHandle(ref, () => ({ knoten: wurzel.current, einpassen }));
  // Nach jedem Rendern neu einpassen: anderer Plan, Filter oder Format.
  useLayoutEffect(einpassen);

  // Umbrechen nur zwischen den Teilen, nie in „6. | November".
  const unterzeile = [gueltig, raum]
    .filter((x): x is string => !!x)
    .map((x) => x.replace(/ /g, "\u00a0"))
    .join(" · ");
  const schriftzug = !marke.tidal && !marke.logo;
  const belegt = tage.filter((t) => t.kurse.length > 0);
  // Groß steht der Planname (Leon 29.09.), der Gym-Name wandert in den Fuß.
  // Der Standardplan heißt selbst „Wochenplan" — dann fällt das Label weg.
  const titel = planName ?? "Wochenplan";
  // Im Fuß nur, wenn er nicht schon als Schriftzug oben steht und nicht
  // „Tidal Athletics" doppelt daneben stünde.
  const gymImFuss = !schriftzug && !(marke.tidal && /^tidal athletics$/i.test(marke.gymName.trim()));

  return (
    <div
      ref={wurzel}
      data-wochenplan-druck={format.id}
      style={{
        width: format.breite,
        height: format.hoehe,
        background: "#ffffff",
        color: f.tinte,
        fontFamily: SANS,
        display: "flex",
        flexDirection: "column",
        padding: `${quer ? 56 : 60}px ${pad}px ${quer ? 40 : 44}px`,
        boxSizing: "border-box",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Farbkante oben: die Marke auf einen Blick, auch aus drei Metern */}
      <div aria-hidden style={{ position: "absolute", left: 0, right: 0, top: 0, height: 14, background: f.akzent }} />

      {/* ── Kopf ─────────────────────────────────────────────── */}
      {/* Kopf und Fuß als <div>: globals.css färbt `[data-theme="light"] footer *`
          (alte Landung) — auf dem Aushang verschwand damit der Fuß. */}
      <div style={{ display: "flex", alignItems: "center", gap: 40, paddingBottom: quer ? 30 : 28 }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {planName && (
            <span
              style={{
                font: `700 ${quer ? 20 : 22}px/1 ${SANS}`,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: f.akzent,
              }}
            >
              Wochenplan
            </span>
          )}
          <span
            style={{
              font: `800 ${quer ? 50 : 46}px/1.05 ${SANS}`,
              textTransform: "uppercase",
              letterSpacing: "-0.005em",
              color: f.tinte,
              overflowWrap: "anywhere",
            }}
            data-druck-titel
          >
            {titel}
          </span>
          {unterzeile && (
            <span style={{ font: `600 ${quer ? 24 : 26}px/1.25 ${SANS}`, color: f.text2 }} data-druck-unterzeile>
              {unterzeile}
            </span>
          )}
        </div>
        {marke.tidal ? (
          <div data-druck-marke="tidal" style={{ flexShrink: 0 }}>
            <TidalZeichen groesse={quer ? 124 : 104} farbe={TIDAL_PETROL} />
          </div>
        ) : marke.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={marke.logo}
            alt=""
            data-druck-marke="gym"
            style={{
              flexShrink: 0,
              maxHeight: quer ? 124 : 104,
              maxWidth: quer ? 420 : 320,
              objectFit: "contain",
            }}
          />
        ) : (
          // Bezahlt ohne Logo: der Gym-Name als Schriftzug in der Gym-Farbe.
          <span
            data-druck-gym
            style={{
              flexShrink: 0,
              maxWidth: quer ? 560 : 420,
              textAlign: "right",
              font: `800 ${quer ? 34 : 30}px/1.05 ${SANS}`,
              textTransform: "uppercase",
              letterSpacing: "0.02em",
              color: f.akzent,
              overflowWrap: "anywhere",
            }}
          >
            {marke.gymName}
          </span>
        )}
      </div>

      <div aria-hidden style={{ height: 2, background: f.linie, marginBottom: quer ? 28 : 30 }} />

      {/* ── Die Woche ────────────────────────────────────────── */}
      <div ref={flaeche} style={{ flex: 1, minHeight: 0, overflow: "hidden", position: "relative" }}>
        <div ref={inhalt}>
          {belegt.length === 0 ? (
            <p style={{ font: `600 ${fs(28)}/1.3 ${SANS}`, color: f.text3 }}>In diesem Plan steht noch kein Kurs.</p>
          ) : quer ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${belegt.length}, minmax(0, 1fr))`,
                columnGap: s(18),
                alignItems: "start",
              }}
            >
              {belegt.map((t) => (
                <section key={t.label} style={{ display: "flex", flexDirection: "column", gap: s(10), minWidth: 0 }}>
                  <h2
                    data-druck-tag
                    style={{
                      font: `800 ${fs(20)}/1.1 ${SANS}`,
                      letterSpacing: "0.08em",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textTransform: "uppercase",
                      color: f.akzent,
                      paddingBottom: s(8),
                      borderBottom: `${s(3)} solid ${f.akzent}`,
                      marginBottom: s(4),
                    }}
                  >
                    {t.label}
                  </h2>
                  {t.kurse.map((k) => (
                    <Kurs key={k.id} k={k} marke={marke} />
                  ))}
                </section>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {belegt.map((t, i) => (
                <section
                  key={t.label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "max-content minmax(0, 1fr)",
                    columnGap: s(16),
                    padding: `${s(14)} 0`,
                    borderTop: i === 0 ? "none" : `2px solid ${f.linie}`,
                  }}
                >
                  {/* Alle Tagesnamen liegen unsichtbar in derselben Zelle: Die
                      Spalte ist an jedem Tag so breit wie der längste, und
                      die Kurse stehen in einer Linie (Leon 29.09.). */}
                  <h2
                    style={{
                      display: "grid",
                      font: `800 ${fs(20)}/1.2 ${SANS}`,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: f.akzent,
                      paddingTop: s(10),
                      whiteSpace: "nowrap",
                      minWidth: s(130),
                    }}
                  >
                    {belegt.map((u) => (
                      <span
                        key={u.label}
                        aria-hidden={u.label !== t.label || undefined}
                        style={{ gridArea: "1 / 1", visibility: u.label === t.label ? "visible" : "hidden" }}
                      >
                        {u.label}
                      </span>
                    ))}
                  </h2>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                      gap: s(10),
                      alignItems: "start",
                    }}
                  >
                    {t.kurse.map((k) => (
                      <Kurs key={k.id} k={k} marke={marke} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Fuß ─────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
          paddingTop: 22,
          font: `500 ${quer ? 17 : 19}px/1 ${SANS}`,
          color: f.text3,
        }}
      >
        <span data-druck-stand>{stand}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 14, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          {gymImFuss && <span data-druck-gym-fuss>{marke.gymName}</span>}
          {gymImFuss && marke.tidal && <span aria-hidden>·</span>}
          {marke.tidal && (
            <span data-druck-tidal style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <TidalZeichen groesse={quer ? 22 : 24} farbe={f.text3} />
              Tidal Athletics
            </span>
          )}
        </span>
      </div>
    </div>
  );
});

export default WochenplanDruck;
