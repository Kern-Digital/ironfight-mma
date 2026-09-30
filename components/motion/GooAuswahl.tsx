"use client";

/**
 * GOO-AUSWAHL — die gewählte Option steht in ihrer eigenen Box, alle anderen
 * zusammen in einem Rahmen daneben (Leon 27.09.2026, Raumfilter im
 * Wochenplan):
 *
 *   „ich hab die idee das die nichtausgewählten alle in einem rahmen stehen.
 *    hoover ich über einen dann wird er größer und etwas markanter, klicke ich
 *    darauf animiert es schön ähnlich wie bei der suchleiste und der neue
 *    ausgewählte text steht in seiner separaten box und die restlichen wieder
 *    zusammen"
 *
 * Leon 28.09.2026, zweimal nachgeschärft: „die rahmen zusammen in einem …
 * die helle farbe soll verblassend in den restlichen bereich strahlen" und
 * „die form noch organischer … die animation zwischen den beiden texten, die
 * wechseln von aktiv zu passiv, soll noch besser sein".
 *
 * WIE ES GEBAUT IST — ZWEI EBENEN:
 *   1. DIE FORM (hinten, `data-goo-flaechen`): Box der Wahl, Hals und Rahmen
 *      der übrigen als EIN geschlossener SVG-Pfad mit EINEM Strich — keine
 *      Nähte, überall dieselbe Strichstärke (Leon 28.09.: „bugs … unter-
 *      schiedliche strichstärken", als es noch drei Teile waren). Lage und
 *      Größe von Box und Rahmen hängen an Motion-Werten und gleiten mit
 *      derselben Feder; der Pfad wird daraus in JEDEM Bild neu gezeichnet und
 *      dehnt sich beim Wechsel mit. Der Hals: zwei lange S-Kurven oben und
 *      unten (Leon: „langgezogener"), das Hell der Wahl läuft hindurch und
 *      verblasst im Rahmen.
 *   2. SCHRIFT (vorn): Die Box der Wahl ist EIN Knopf, der vorn stehen bleibt.
 *      Wechselt die Wahl, gleitet der neue Name von rechts (aus Richtung
 *      Rahmen) weich und unscharf-zu-scharf herein, der alte blendet aus. Im
 *      Rahmen schrumpft die angeklickte Option weg, die bisherige Wahl wächst
 *      an ihrem Platz auf, die übrigen rücken per `layout` nach.
 *
 * WARUM KEIN GOO-FILTER MEHR (28.09., Bilderserie des Wechsels): Der Filter
 * der Suchleiste (Blur + Alpha-Schwelle) fraß die 1-px-Kanten — die Box
 * verlor mitten im Wechsel ihren Rand, vom Hals blieben nur Striche.
 * Und die beiden Namen flogen quer durcheinander („Raum 2" lag über „Alle
 * Räume"). Der lebende Hals IST jetzt die fließende Verbindung, und die
 * Namen kreuzen sich nicht mehr.
 *
 *   · KEIN React-State für die Flächen: Ein setState im Layout-Effekt rendert
 *     sofort ein zweites Mal, und framer misst die Knöpfe dann schon am Ziel
 *     (gemessen 27.09.). Alles läuft über Motion-Werte und direkt am DOM.
 *   · Gemessen wird die ZIELLAGE (offsetLeft/Top ohne laufende transforms).
 *   · Hover (nur mit echter Maus): die Option im Rahmen wird größer.
 *   · Bewegung abbestellt: keine Animation.
 *   · Handy: Box und Rahmen in zwei Zeilen — dann kein Hals.
 *
 * Bedienung: `role="radiogroup"` mit `role="radio"` je Option.
 */

import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  type MotionValue,
} from "framer-motion";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useMotionCapability } from "./useMotionCapability";

export interface GooOption {
  id: string;
  name: string;
}

// Weich wie die Suchleiste: Die Feder läuft rund 0,7 s, damit man sieht, wie
// Box, Hals und Rahmen sich dehnen.
const FEDER = { type: "spring" as const, stiffness: 150, damping: 21, mass: 1 };
/** Der Namenswechsel in der Box: schneller als die Feder, damit er vorn liegt. */
const NAME_REIN = { duration: 0.42, ease: [0.2, 0.8, 0.2, 1] as const };
const NAME_RAUS = { duration: 0.2, ease: [0.4, 0, 1, 1] as const };
/** Eine Option im Rahmen klappt in der Breite zu bzw. auf. */
const KLAPPEN = { duration: 0.34, ease: [0.2, 0.8, 0.2, 1] as const };
/** So lange messen Box und Rahmen nach einem Wechsel in jedem Bild nach. */
const VERFOLGEN_MS = 1100;
/** Innenabstand einer Option im Rahmen (war px-3) und Luft zur nächsten. */
const OPTION_PX = 12;
const OPTION_LUFT = 4;
/** Luft zwischen Box und Rahmen — dort liegt der Hals. Leon 28.09.: „die
 *  passage soll langgezogener sein" (vorher 22). Innenrand des Rahmens. */
const ABSTAND = 44;
const RAND = 4;
/** Rundung von Box und Rahmen — runder als die Felder, damit es fließt. */
const RADIUS_BOX = 18;
const RADIUS_RAHMEN = 16;
/** Wie tief der Hals einzieht — Anteil der Innenhöhe, gedeckelt. */
const HALS_ANTEIL = 0.24;
const HALS_MAX = 11;
/** DIE NASE (Leon 29.09.: das Räume-Zeichen „im selben Rahmen wie der
 *  Rest"): oben rechts wächst der Rahmen in einer Ausbuchtung nach oben, das
 *  Zeichen sitzt darin. Breite, Höhe über der Rahmenkante, Rundung außen und
 *  die Kehle, mit der die Kante in die Nase aufsteigt. */
const NASE_B = 44;
const NASE_H = 30;
const NASE_R = 14;
const NASE_KEHLE = 8;
/** Die Nase ragt zur Hälfte über die rechte Kante hinaus (Leon 29.09.: „noch
 *  die hälfte weiter rechts") und reicht so weit unter die Oberkante, bevor
 *  sie in die rechte Kante zurückläuft. */
const NASE_RAUS = NASE_B / 2;
const NASE_UNTER = 12;
/** Schlüssel der Box im Messregister (kein Options-Id kann so heißen). */
const BOX = "__box";
/** Die Farbe in der Mitte des Übergangs: Box-Hell, halb im Rahmen-Grau. */
const MITTE_FLAECHE =
  "color-mix(in oklab, var(--accent-subtle) 62%, var(--surface-raised))";
const MITTE_KANTE = "color-mix(in oklab, var(--accent) 45%, var(--line))";

/**
 * Der rechte Außenabstand einer Option. Die rechte Kante des Rahmens zählt
 * ihn mit (und zieht OPTION_LUFT wieder ab): Die zuklappende letzte Option
 * endet sonst 4 px rechts der vorletzten, und die Kante sprang am Ende um
 * diese 4 px plus Strich zurück (29.09. gemessen).
 */
function randRechts(e: HTMLElement) {
  return parseFloat(getComputedStyle(e).marginRight) || 0;
}

export function GooAuswahl({
  optionen,
  wert,
  onWahl,
  ariaLabel,
  nase,
  ...rest
}: {
  optionen: GooOption[];
  wert: string;
  onWahl: (id: string) => void;
  ariaLabel: string;
  /**
   * Ein Knopf in der NASE oben rechts am Rahmen — die Umrisslinie läuft um
   * ihn herum (Leon 29.09.: im Raumfilter das Räume-Zeichen, dort Räume
   * anlegen und löschen). Am Handy ausgeblendet.
   */
  nase?: React.ReactNode;
} & Record<`data-${string}`, string | boolean | undefined>) {
  const roh = useId();
  const id = `goo-auswahl-${roh.replace(/[^a-zA-Z0-9-]/g, "")}`;
  const { canHover, reduced } = useMotionCapability();
  const reihe = useRef<HTMLDivElement>(null);
  const knoepfe = useRef<Record<string, HTMLButtonElement | null>>({});
  const letzteZiele = useRef(new Map<MotionValue<number>, number>());
  const form = useRef<SVGPathElement>(null);
  const formRahmen = useRef<SVGPathElement>(null);
  const verlaufFlaeche = useRef<SVGLinearGradientElement>(null);
  const verlaufKante = useRef<SVGLinearGradientElement>(null);
  const naseRef = useRef<HTMLDivElement>(null);
  // Breite jedes Namens in der Box-Schrift (unsichtbares Maßband): Die Box
  // bekommt ihre neue Breite als ANIMATION im selben Takt wie die Optionen.
  const massband = useRef<HTMLDivElement>(null);
  const [namenBreite, setNamenBreite] = useState<Record<string, number>>({});

  // Box der Wahl
  const bLinks = useMotionValue(0);
  const bOben = useMotionValue(0);
  const bBreite = useMotionValue(0);
  const bHoehe = useMotionValue(0);
  // Rahmen der übrigen
  const rLinks = useMotionValue(0);
  const rOben = useMotionValue(0);
  const rBreite = useMotionValue(0);
  const rHoehe = useMotionValue(0);
  const rSicht = useMotionValue(0);

  const gewaehlt = optionen.find((o) => o.id === wert) ?? optionen[0];
  const uebrige = optionen.filter((o) => o.id !== gewaehlt?.id);
  const uebrigeIds = uebrige.map((o) => o.id).join("|");

  // ── Zeichnen: EINE Umrisslinie für Box, Hals und Rahmen ────────────────
  // Leon 28.09.: „beim rahmen bugs … unterschiedliche strichstärken". Vorher
  // lagen drei Teile übereinander (Box mit CSS-Rand, Rahmen mit CSS-Rand,
  // Brücke mit SVG-Strich) — an den Nähten doppelte, leicht versetzte Linien,
  // und die Brücke saß auf halben Pixeln und verschwamm. Jetzt ist die ganze
  // Form EIN geschlossener Pfad mit EINEM Strich, auf ganze Pixel gerundet
  // (Kanten auf x,5 — so trifft ein 1-px-Strich genau eine Pixelreihe).
  const zeichnen = useCallback(() => {
    const pfad = form.current;
    const pfadRahmen = formRahmen.current;
    if (!pfad || !pfadRahmen) return;
    const rund = Math.round;
    const bw = bBreite.get();
    const bl = rund(bLinks.get()) + 0.5;
    const bt = rund(bOben.get()) + 0.5;
    const br = rund(bLinks.get() + bw) - 0.5;
    const bb = rund(bOben.get() + bHoehe.get()) - 0.5;
    const fl = rund(rLinks.get()) + 0.5;
    const ft = rund(rOben.get()) + 0.5;
    const fr = rund(rLinks.get() + rBreite.get()) - 0.5;
    const fb = rund(rOben.get() + rHoehe.get()) - 0.5;
    const rb = Math.max(0, Math.min(RADIUS_BOX, (bb - bt) / 2, (br - bl) / 2));
    const rf = Math.max(
      0,
      Math.min(RADIUS_RAHMEN, (fb - ft) / 2, (fr - fl) / 2),
    );
    const rahmenDa = rSicht.get() > 0 && fr - fl > 2;
    // Die Nase nur, wenn sie zu sehen ist (am Handy display:none) und der
    // Rahmen breit genug, dass sie nicht in die Rundung links greift.
    const naseEl = naseRef.current;
    const mitNase =
      !!naseEl &&
      naseEl.offsetWidth > 0 &&
      rahmenDa &&
      fr - fl > NASE_B - NASE_RAUS + rf + NASE_KEHLE + 8 &&
      fb - ft > NASE_UNTER + NASE_KEHLE + rf;
    if (naseEl) {
      naseEl.style.visibility = mitNase ? "visible" : "hidden";
      if (mitNase) {
        naseEl.style.transform = `translate(${fr + 0.5 + NASE_RAUS - NASE_B}px, ${ft - 0.5 - NASE_H}px)`;
      }
    }
    // Obere rechte Ecke des Rahmens: gerundet — oder mit Nase: die Kante
    // steigt in einer Kehle auf, läuft rund über die Nase, rechts über die
    // Rahmenkante hinaus hinunter und in einer zweiten Kehle zurück in sie.
    const eckeOR = (fr: number, ft: number, rf: number) => {
      if (!mitNase) return `L${fr - rf} ${ft} A${rf} ${rf} 0 0 1 ${fr} ${ft + rf} `;
      const k = NASE_KEHLE;
      const nr = fr + NASE_RAUS;
      const nl = nr - NASE_B;
      const nt = ft - NASE_H;
      const nb = ft + NASE_UNTER;
      return (
        `L${nl - k} ${ft} A${k} ${k} 0 0 0 ${nl} ${ft - k} ` +
        `L${nl} ${nt + NASE_R} A${NASE_R} ${NASE_R} 0 0 1 ${nl + NASE_R} ${nt} ` +
        `L${nr - NASE_R} ${nt} A${NASE_R} ${NASE_R} 0 0 1 ${nr} ${nt + NASE_R} ` +
        `L${nr} ${nb - NASE_R} A${NASE_R} ${NASE_R} 0 0 1 ${nr - NASE_R} ${nb} ` +
        `L${fr + k} ${nb} A${k} ${k} 0 0 0 ${fr} ${nb + k} `
      );
    };
    const rahmen = (l: number, t: number, r: number, b: number, ra: number) =>
      `M${l + ra} ${t} ` + eckeOR(r, t, ra) + `L${r} ${b - ra} ` +
      `A${ra} ${ra} 0 0 1 ${r - ra} ${b} L${l + ra} ${b} A${ra} ${ra} 0 0 1 ${l} ${b - ra} ` +
      `L${l} ${t + ra} A${ra} ${ra} 0 0 1 ${l + ra} ${t} Z`;

    const rechteck = (l: number, t: number, r: number, b: number, ra: number) =>
      `M${l + ra} ${t} L${r - ra} ${t} A${ra} ${ra} 0 0 1 ${r} ${t + ra} L${r} ${b - ra} ` +
      `A${ra} ${ra} 0 0 1 ${r - ra} ${b} L${l + ra} ${b} A${ra} ${ra} 0 0 1 ${l} ${b - ra} ` +
      `L${l} ${t + ra} A${ra} ${ra} 0 0 1 ${l + ra} ${t} Z`;

    if (bw <= 0) {
      pfad.setAttribute("d", "");
      pfadRahmen.setAttribute(
        "d",
        rahmenDa ? rahmen(fl, ft, fr, fb, rf) : "",
      );
      return;
    }

    // Verbunden nur, wenn der Rahmen rechts NEBEN der Box in derselben Zeile
    // liegt (auf dem Handy steht er darunter).
    const verbunden = rahmenDa && ft < bb - 4 && fl > br + 6;
    if (!verbunden) {
      pfad.setAttribute("d", rechteck(bl, bt, br, bb, rb));
      pfad.style.fill = "var(--accent-subtle)";
      pfad.style.stroke = "var(--accent)";
      pfadRahmen.setAttribute(
        "d",
        rahmenDa ? rahmen(fl, ft, fr, fb, rf) : "",
      );
      return;
    }

    // DER HALS: Die obere Kante verlässt die Box dort, wo deren gerade Kante
    // endet (statt der Ecke), zieht in einer langen S-Kurve zur Mitte ein und
    // steigt in einer zweiten zum Rahmen auf — unten gespiegelt.
    const innen = Math.min(bb, fb) - Math.max(bt, ft);
    const tief = Math.max(0, Math.min(HALS_MAX, innen * HALS_ANTEIL));
    const x0 = br - rb;
    const x1 = fl + rf;
    const mx = (x0 + x1) / 2;
    const s1 = mx - x0;
    const s2 = x1 - mx;
    const nOben = Math.max(bt, ft) + tief;
    const nUnten = Math.min(bb, fb) - tief;
    const d =
      `M${bl + rb} ${bt} L${x0} ${bt} ` +
      `C${x0 + s1 * 0.55} ${bt} ${mx - s1 * 0.45} ${nOben} ${mx} ${nOben} ` +
      `C${mx + s2 * 0.45} ${nOben} ${x1 - s2 * 0.55} ${ft} ${x1} ${ft} ` +
      eckeOR(fr, ft, rf) + `L${fr} ${fb - rf} ` +
      `A${rf} ${rf} 0 0 1 ${fr - rf} ${fb} L${x1} ${fb} ` +
      `C${x1 - s2 * 0.55} ${fb} ${mx + s2 * 0.45} ${nUnten} ${mx} ${nUnten} ` +
      `C${mx - s1 * 0.45} ${nUnten} ${x0 + s1 * 0.55} ${bb} ${x0} ${bb} ` +
      `L${bl + rb} ${bb} A${rb} ${rb} 0 0 1 ${bl} ${bb - rb} L${bl} ${bt + rb} ` +
      `A${rb} ${rb} 0 0 1 ${bl + rb} ${bt} Z`;
    pfad.setAttribute("d", d);
    pfadRahmen.setAttribute("d", "");
    // Das Hell der Box reicht voll bis zur MITTE der Engstelle (Leon 28.09.:
    // „das blau soll nur bis hälfte der engstelle anfangen") und verblasst
    // erst von dort bis gut in die Mitte des Rahmens.
    for (const v of [verlaufFlaeche.current, verlaufKante.current]) {
      v?.setAttribute("x1", String(mx));
      v?.setAttribute("x2", String(fl + (fr - fl) * 0.55));
    }
    pfad.style.fill = `url(#${id}-flaeche)`;
    pfad.style.stroke = `url(#${id}-kante)`;
  }, [
    id,
    bLinks,
    bOben,
    bBreite,
    bHoehe,
    rLinks,
    rOben,
    rBreite,
    rHoehe,
    rSicht,
  ]);

  useEffect(() => {
    let bild = 0;
    const planen = () => {
      if (!bild) {
        bild = requestAnimationFrame(() => {
          bild = 0;
          zeichnen();
        });
      }
    };
    const werte: MotionValue<number>[] = [
      bLinks,
      bOben,
      bBreite,
      bHoehe,
      rLinks,
      rOben,
      rBreite,
      rHoehe,
      rSicht,
    ];
    const ab = werte.map((mv) => mv.on("change", planen));
    return () => {
      ab.forEach((f) => f());
      cancelAnimationFrame(bild);
    };
  }, [
    zeichnen,
    bLinks,
    bOben,
    bBreite,
    bHoehe,
    rLinks,
    rOben,
    rBreite,
    rHoehe,
    rSicht,
  ]);

  // ── Messen: Ziellage von Box und Rahmen ─────────────────────────────────
  const messen = useCallback(
    (sofort: boolean, live = false) => {
      const ziele: [MotionValue<number>, number][] = [];
      const box = knoepfe.current[BOX];
      if (box) {
        const boxZiele: [MotionValue<number>, number][] = [
          [bLinks, box.offsetLeft],
          [bOben, box.offsetTop],
          [bBreite, box.offsetWidth],
          [bHoehe, box.offsetHeight],
        ];
        if (live) {
          // Während des Wechsels animiert die Box ihre Breite selbst — der
          // Umriss folgt ihr direkt, eine zweite Feder hinkte hinterher.
          for (const [mv, zahl] of boxZiele) {
            mv.stop();
            mv.set(zahl);
            letzteZiele.current.set(mv, zahl);
          }
        } else ziele.push(...boxZiele);
      }
      const ids = uebrigeIds ? uebrigeIds.split("|") : [];
      // Über das Daten-Attribut, nicht über `ref`: framer 12.40 liest die Ref
      // jedes AnimatePresence-Kindes als `props.ref` — React 18 warnt dann.
      const alle = Array.from(
        reihe.current?.querySelectorAll<HTMLElement>("[data-goo-option]") ?? [],
      );
      const els = ids
        .map((i) => alle.find((e) => e.dataset.gooOption === i))
        .filter((e): e is HTMLElement => !!e && e.offsetWidth > 0);
      const reiheRechteck = reihe.current?.getBoundingClientRect();
      if (els.length === 0) {
        rSicht.set(0);
      } else if (live && reiheRechteck) {
        // WÄHREND des Wechsels umschließt der Rahmen die SICHTBARE Lage aller
        // Optionen (auch die gerade zu- und aufklappenden) — direkt gesetzt,
        // ohne eigene Feder. Die Knöpfe gleiten selbst; eine zweite Feder
        // hinterher ließ Namen kurz über den Rand ragen (28.09.).
        // Die MITTE aus dem sichtbaren Rechteck (so gleitet der Rahmen mit
        // der Layout-Verschiebung mit), die GRÖSSE aus dem Layout: Hover-Zoom
        // (1,05) und Ein-/Ausblend-Zoom verzerren den Rahmen nicht mehr — er
        // wurde beim Überfahren kurz größer und hüpfte am Ende um 1–2 px
        // zurück (29.09., Bild-für-Bild gemessen).
        const r = alle
          .filter((e) => e.offsetWidth > 0)
          .map((e) => {
            const q = e.getBoundingClientRect();
            const cx = (q.left + q.right) / 2 - reiheRechteck.left;
            const cy = (q.top + q.bottom) / 2 - reiheRechteck.top;
            return {
              left: cx - e.offsetWidth / 2,
              right: cx + e.offsetWidth / 2 + randRechts(e),
              top: cy - e.offsetHeight / 2,
              bottom: cy + e.offsetHeight / 2,
            };
          });
        if (r.length) {
          const links = Math.min(...r.map((q) => q.left));
          const oben = Math.min(...r.map((q) => q.top));
          const rechts = Math.max(...r.map((q) => q.right)) - OPTION_LUFT;
          const unten = Math.max(...r.map((q) => q.bottom));
          const direkt: [MotionValue<number>, number][] = [
            [rLinks, links - RAND],
            [rOben, oben - RAND],
            [rBreite, rechts - links + 2 * RAND],
            [rHoehe, unten - oben + 2 * RAND],
          ];
          for (const [mv, zahl] of direkt) {
            mv.stop();
            mv.set(zahl);
            letzteZiele.current.set(mv, zahl);
          }
        }
        rSicht.set(1);
      } else {
        const links = Math.min(...els.map((e) => e.offsetLeft));
        const oben = Math.min(...els.map((e) => e.offsetTop));
        const rechts =
          Math.max(...els.map((e) => e.offsetLeft + e.offsetWidth + randRechts(e))) -
          OPTION_LUFT;
        const unten = Math.max(...els.map((e) => e.offsetTop + e.offsetHeight));
        ziele.push(
          [rLinks, links - RAND],
          [rOben, oben - RAND],
          [rBreite, rechts - links + 2 * RAND],
          [rHoehe, unten - oben + 2 * RAND],
        );
        rSicht.set(1);
      }
      for (const [mv, zahl] of ziele) {
        if (sofort || reduced) mv.set(zahl);
        // Nur bei neuem Ziel umlenken — die Feder behält dabei ihren Schwung.
        else if (
          Math.abs((letzteZiele.current.get(mv) ?? NaN) - zahl) > 0.5 ||
          !letzteZiele.current.has(mv)
        ) {
          animate(mv, zahl, FEDER);
        }
        letzteZiele.current.set(mv, zahl);
      }
      if (sofort || reduced) zeichnen();
    },
    [
      uebrigeIds,
      reduced,
      zeichnen,
      bLinks,
      bOben,
      bBreite,
      bHoehe,
      rLinks,
      rOben,
      rBreite,
      rHoehe,
      rSicht,
    ],
  );

  const namenSchluessel = optionen.map((o) => `${o.id}:${o.name}`).join("|");
  useLayoutEffect(() => {
    const band = massband.current;
    if (!band) return;
    const lesen = () => {
      const neu: Record<string, number> = {};
      band.querySelectorAll<HTMLElement>("[data-goo-mass]").forEach((el) => {
        neu[el.dataset.gooMass ?? ""] = Math.ceil(el.getBoundingClientRect().width);
      });
      setNamenBreite((alt) => {
        const gleich =
          Object.keys(neu).length === Object.keys(alt).length &&
          Object.entries(neu).every(([k, v]) => alt[k] === v);
        return gleich ? alt : neu;
      });
    };
    lesen();
    // Archivo lädt nach — dann stimmen die Maße erst.
    let lebt = true;
    void document.fonts?.ready.then(() => {
      if (lebt) lesen();
    });
    return () => {
      lebt = false;
    };
  }, [namenSchluessel]);

  const ersteMessung = useRef(true);
  /** Bis wann ein Wechsel läuft — solange misst auch der ResizeObserver im Mitlauf. */
  const verfolgtBis = useRef(0);
  useLayoutEffect(() => {
    // Nach einem Wechsel gleich im Mitlauf messen: Die Ruhe-Messung zielte
    // auf das Endmaß ohne die zuklappende Option und warf eine Feder dorthin
    // an — ein Bild lang brach die Kante 52 px ein (29.09. gemessen).
    messen(ersteMessung.current, !ersteMessung.current && !reduced);
    ersteMessung.current = false;
  }, [messen, reduced]);

  // WÄHREND des Wechsels in jedem Bild nachmessen: Die angeklickte Option
  // schrumpft in der Breite auf null, die bisherige Wahl wächst aus null auf,
  // und die Box nimmt die Breite des neuen Namens an. Box und Rahmen folgen
  // dem fließend, statt am Ende auf die fertige Lage zu springen.
  useEffect(() => {
    if (ersteMessung.current || reduced) return;
    const ende = performance.now() + VERFOLGEN_MS;
    verfolgtBis.current = ende;
    let bild = 0;
    const schritt = () => {
      const weiter = performance.now() < ende;
      messen(false, weiter);
      if (weiter) bild = requestAnimationFrame(schritt);
    };
    bild = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(bild);
  }, [wert, messen, reduced]);

  // Fenster schmaler/breiter: Flächen ohne Animation nachziehen.
  useEffect(() => {
    const el = reihe.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // Während eines Wechsels ändert die Reihe in jedem Bild ihre Breite. Die
    // Ruhe-Messung setzte dann die ENDLAGE und überschrieb den Mitlauf — die
    // Kante brach ein und die zuklappende Option ragte hinaus (29.09.).
    const beob = new ResizeObserver(() =>
      performance.now() < verfolgtBis.current ? messen(false, true) : messen(true),
    );
    beob.observe(el);
    return () => beob.disconnect();
  }, [messen]);

  return (
    // Mit Nase: oben Platz, damit sie nicht in die Zeile darüber ragt.
    // Rechts Platz für den überstehenden Teil.
    <div className={nase ? "relative sm:mr-[22px] sm:mt-6" : "relative"} {...rest}>
      <div
        ref={reihe}
        role="radiogroup"
        aria-label={ariaLabel}
        className="relative flex flex-wrap items-center gap-y-3 py-1"
        style={{ paddingLeft: RAND, paddingRight: RAND }}
      >
        {/* ── Ebene 1: die Form — Box, Hals und Rahmen als EIN Pfad ─── */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ overflow: "visible" }}
          data-goo-flaechen
        >
          <defs>
            <linearGradient
              ref={verlaufFlaeche}
              id={`${id}-flaeche`}
              gradientUnits="userSpaceOnUse"
              x1="0"
              x2="1"
              y1="0"
              y2="0"
            >
              <stop offset="0" style={{ stopColor: "var(--accent-subtle)" }} />
              <stop offset="0.42" style={{ stopColor: MITTE_FLAECHE }} />
              <stop offset="1" style={{ stopColor: "var(--surface-raised)" }} />
            </linearGradient>
            <linearGradient
              ref={verlaufKante}
              id={`${id}-kante`}
              gradientUnits="userSpaceOnUse"
              x1="0"
              x2="1"
              y1="0"
              y2="0"
            >
              <stop offset="0" style={{ stopColor: "var(--accent)" }} />
              <stop offset="0.42" style={{ stopColor: MITTE_KANTE }} />
              <stop offset="1" style={{ stopColor: "var(--line)" }} />
            </linearGradient>
          </defs>
          {/* Rahmen allein — nur, wenn er NICHT mit der Box verbunden ist (Handy) */}
          <path
            ref={formRahmen}
            strokeWidth={1}
            style={{ fill: "var(--surface-raised)", stroke: "var(--line)" }}
            data-goo-rahmen
          />
          <path ref={form} strokeWidth={1} data-goo-box />
        </svg>

        {/* ── Ebene 2: die Schrift ─────────────────────────────────── */}
        {/* Das Maßband: jeder Name in der Box-Schrift, unsichtbar, außerhalb
            des Flusses. */}
        <div
          ref={massband}
          aria-hidden
          className="pointer-events-none invisible absolute left-0 top-0 flex whitespace-nowrap"
          style={{ font: "600 17px/1.2 var(--font-archivo), system-ui, sans-serif" }}
        >
          {optionen.map((o) => (
            <span key={o.id} data-goo-mass={o.id}>
              {o.name}
            </span>
          ))}
        </div>
        {gewaehlt && (
          <motion.button
            ref={(el: HTMLButtonElement | null) => {
              knoepfe.current[BOX] = el;
            }}
            type="button"
            role="radio"
            aria-checked
            onClick={() => onWahl(gewaehlt.id)}
            className="relative inline-flex items-center overflow-hidden whitespace-nowrap"
            // DIE BREITE (29.09.): im selben Takt wie das Auf- und Zuklappen
            // der Optionen. Vorher sprang die Box sofort auf die neue Breite,
            // die Optionen glichen das per Layout-Feder (0,7 s) aus, klappten
            // aber in 0,34 s — die rechte Kante schwang erst 20 px hinaus und
            // dann zurück. Jetzt bewegt sich alles in eine Richtung.
            initial={false}
            animate={{
              width:
                namenBreite[gewaehlt.id] != null
                  ? namenBreite[gewaehlt.id] + 48
                  : "auto",
            }}
            transition={reduced ? { duration: 0 } : KLAPPEN}
            style={{
              zIndex: 3,
              minHeight: 48,
              paddingInline: 24,
              marginRight: ABSTAND + RAND,
              borderRadius: RADIUS_BOX,
              color: "var(--accent-text)",
              font: "600 17px/1.2 var(--font-archivo), system-ui, sans-serif",
            }}
            data-goo-gewaehlt
          >
            {/* DIE BREITE bestimmt ab dem Klick allein der NEUE Name — über
                dieses unsichtbare Maßstück im Fluss. Die sichtbaren Namen
                liegen darüber (absolut) und blenden über, ohne die Breite zu
                berühren. So verschiebt sich alles im selben Render wie der
                Klick, und die Knöpfe daneben gleiten (layout) statt am Ende
                der Blende nachzuspringen (28.09., Bilderserie: 30-px-Ruck).
                KEIN mode="popLayout": framer 12.40 liest dort `props.ref` und
                wirft unter React 18 eine Warnung. */}
            <span aria-hidden className="invisible">
              {gewaehlt.name}
            </span>
            <AnimatePresence initial={false}>
              <motion.span
                key={gewaehlt.id}
                className="absolute inset-y-0 flex items-center"
                style={{ left: 24 }}
                initial={
                  reduced ? false : { opacity: 0, x: 26, filter: "blur(5px)" }
                }
                animate={{
                  opacity: 1,
                  x: 0,
                  filter: "blur(0px)",
                  transition: reduced ? { duration: 0 } : NAME_REIN,
                }}
                exit={
                  reduced
                    ? { opacity: 0, transition: { duration: 0 } }
                    : {
                        opacity: 0,
                        x: -10,
                        filter: "blur(4px)",
                        transition: NAME_RAUS,
                      }
                }
              >
                {gewaehlt.name}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        )}
        {/* Auf dem Handy steht die Wahl in einer eigenen Zeile, der Rahmen
            darunter — sonst bräche der Rahmen um und läge hinter der Box. */}
        <span aria-hidden className="h-0 basis-full sm:hidden" />

        {/* FESTE REIHENFOLGE (29.09.): Alle Optionen stehen im Rahmen, die
            gewählte ist zugeklappt. Vorher blendete AnimatePresence sie aus
            und setzte sie dabei VOR die übrigen — die angeklickte Option flog
            155 px quer durch den Rahmen, während sie zuklappte. Jetzt klappt
            sie an ihrem Platz zu, und die bisherige Wahl klappt an ihrem auf.
            content-box: Breite OHNE Innenabstand — sonst zielte „auto" auf
            die Textbreite ohne Polster, und am Ende sprang die Option um
            24 px (die zuklappende blieb bei 24 px stehen und verschwand
            dann schlagartig). */}
        {optionen.map((o) => {
          const weg = o.id === gewaehlt?.id;
          return (
            <motion.button
              key={o.id}
              data-goo-option={o.id}
              layout="position"
              type="button"
              role="radio"
              aria-checked={false}
              aria-hidden={weg || undefined}
              tabIndex={weg ? -1 : undefined}
              onClick={() => onWahl(o.id)}
              onAnimationComplete={() => messen(false)}
              initial={false}
              animate={
                weg
                  ? {
                      opacity: 0,
                      scale: 0.7,
                      width: 0,
                      paddingLeft: 0,
                      paddingRight: 0,
                      marginRight: 0,
                      transition: reduced
                        ? { duration: 0 }
                        : { ...KLAPPEN, opacity: NAME_RAUS },
                    }
                  : {
                      opacity: 1,
                      scale: 1,
                      width: "auto",
                      paddingLeft: OPTION_PX,
                      paddingRight: OPTION_PX,
                      marginRight: OPTION_LUFT,
                      transition: reduced
                        ? { duration: 0 }
                        : { ...KLAPPEN, opacity: { duration: 0.3, delay: 0.08 } },
                    }
              }
              transition={reduced ? { duration: 0 } : FEDER}
              whileHover={canHover && !weg ? { scale: 1.05 } : undefined}
              whileTap={!reduced && !weg ? { scale: 0.96 } : undefined}
              // Hover im Rahmen LEICHT statt Kasten (Leon 28.09.: „nicht so
              // einen klobigen rahmen … was anderes leichteres"): keine
              // Fläche mehr — die Schrift wird hell, wächst etwas, und unter
              // ihr läuft aus der Mitte eine feine Linie in Gym-Farbe auf.
              // Farben über Klassen, damit Hover sie überschreiben kann.
              className="group relative inline-flex min-h-[36px] items-center overflow-hidden whitespace-nowrap rounded-badge [color:var(--text-2)] after:pointer-events-none after:absolute after:bottom-[6px] after:left-1/2 after:h-[2px] after:w-0 after:-translate-x-1/2 after:rounded-full after:bg-[var(--accent)] after:opacity-0 after:transition-all after:duration-300 after:ease-out hover:[color:var(--text-1)] hover:after:w-[calc(100%-24px)] hover:after:opacity-100 focus-visible:[color:var(--text-1)] focus-visible:after:w-[calc(100%-24px)] focus-visible:after:opacity-100 motion-reduce:after:transition-none"
              style={{
                zIndex: 2,
                boxSizing: "content-box",
                pointerEvents: weg ? "none" : undefined,
                // Rand und Innenabstand setzt die Klapp-Animation (OPTION_*)
                font: "600 13px/1.2 var(--font-archivo), system-ui, sans-serif",
                transition: "color 200ms var(--ease-out)",
              }}
            >
              {o.name}
            </motion.button>
          );
        })}
        {nase && (
          // Liegt oben links in der Reihe und wird beim Zeichnen in die Nase
          // geschoben — im selben Bild wie der Umriss, sonst hinkt es nach.
          <div
            ref={naseRef}
            className="absolute left-0 top-0 hidden items-center justify-center sm:flex"
            style={{ zIndex: 3, width: NASE_B, height: NASE_H + NASE_UNTER, visibility: "hidden" }}
            data-goo-nase
          >
            {nase}
          </div>
        )}
      </div>
    </div>
  );
}
