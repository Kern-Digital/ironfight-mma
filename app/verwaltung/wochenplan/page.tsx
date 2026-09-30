"use client";

/**
 * WOCHENPLAN — die Trainingswoche des Gyms, mit Trainer je Kurs.
 *
 * Leon 26.09.2026: „Kurs bekommt Trainer" (Weg 2, Kursplan je Gym).
 * Leon 27.09.2026: „in der verwaltungsebene soll der Kursplan wochenplan
 * heißen und wenn ich darauf gehe dann soll ich kurse hinzufügen können,
 * bearbeiten etc." — deshalb ist das hier EINE Seite im selben Raster wie der
 * Kursplan (components/schedule/WochenRaster), nur dass ein Tipp auf den Kurs
 * den KURS öffnet (Tag, Uhrzeit, Trainer) und nicht die Stunde dieser Woche.
 * Die kurze Zwischenfassung als Liste unter /verwaltung/kurse gibt es nicht
 * mehr.
 *
 * WAS HIER PASSIERT UND WAS NICHT:
 *   · Hier: Kurs anlegen, Tag und Uhrzeit, Kampfart, Gruppe, Trainer.
 *   · Im Kursplan (/schedule): was in der Stunde dieser Woche geübt wird —
 *     das pflegen Trainer UND Verwaltung wie bisher.
 *
 * DER TRAINER IST PFLICHT (Leon 16.09.: „ein Kurs braucht immer einen
 * Trainer"). Die aus der alten Konstante übernommenen Kurse stehen ohne da;
 * die Seite zählt sie oben und sagt es in jeder Zeile in Worten, nicht nur in
 * Farbe. Wer das Gym verlassen oder sein Trainer-Häkchen verloren hat, zählt
 * nicht mehr als Trainer — sein Kurs steht dann wieder offen da.
 *
 * MEHRERE WOCHENPLÄNE (Leon 27.09.2026: „in der verwaltungsebene mehrere
 * wochenpläne für ferien etc. bauen kann aber immer nur einen aktiviere …
 * pro plan nur einen button"). Oben die Leiste mit allen Plänen; ein Tipp
 * auf den Namen zeigt den Plan im Raster darunter, ohne ihn zu aktivieren.
 * Rechts an jedem Plan steht genau EIN Knopf: „Aktivieren", beim aktiven
 * „Aktiv" (nicht drückbar). Kein Pausieren — wer einen anderen aktiviert,
 * löst den bisherigen ab. Trainer und Athleten sehen nur den aktiven Plan
 * (useKursplan + Regel), diese Seite liest alle (useWochenplaene).
 *
 * NEUGESTALTUNG (Leon 28.09.2026: „besser verständlich … organischer,
 * intuitiver … alles gleich groß, die Überschrift Wochenplan noch einmal dick
 * … zu viele einzelne Rahmen"). Drei Entwürfe, Leon wählte B:
 *   · Pläne links als ruhige Liste (Punkt = gilt jetzt, atmet leise), der
 *     Name des gewählten Plans ist der einzige Titel — „Wochenplan" steht
 *     schon in der Sidebar.
 *   · „Aktivieren" steht beim Plan, den man ansieht (components/ui/HakenKnopf),
 *     danach dasselbe Hellblau als „Gilt jetzt". Seit 29.09. öffnet der Tipp
 *     das Popup „Ab sofort · Ab einem Tag · Von – Bis" (PlanSheet „planen");
 *     nur der Grundplan aktiviert direkt, für ihn gibt es nichts zu planen.
 *   · Die Meldung „N Kurse ohne Trainer" steht rechts auf Höhe von
 *     „Aktivieren", über „Kurs anlegen" (Leon 29.09.).
 *   · Umschalter „Ansicht": Kalender (Uhrzeit-Achse, leere Stunden gefaltet)
 *     oder Zeilen (components/wochenplan/WocheZeilen, ein Tag je Zeile). Die
 *     Wahl merkt sich der Browser.
 *   · Fehlendes trägt ein oranges Dreieck; „N Kurse ohne Trainer" ist ein
 *     Schalter, der alle anderen Kurse zurücktreten lässt.
 *   · Über freien Stellen ein Plus in Gym-Farbe neben dem Zeiger
 *     (components/wochenplan/PlusZeiger) — Klick legt dort einen Kurs an.
 *   · Raumfilter = GooAuswahl (Box, Hals und Rahmen als eine Form).
 *
 * RECHTE: nur mit Verwaltungs-Häkchen — auch für einen Trainer, der es trägt
 * (Leon 26.09.). Middleware und VerwaltungRoute lassen niemanden sonst
 * herein, der Server prüft beim Schreiben noch einmal.
 */

import { GooAuswahl } from "@/components/motion";
import { blockMeta } from "@/components/schedule/WochenRaster";
import { SeitenZurueck } from "@/components/shell/KopfNavigation";
import HakenKnopf from "@/components/ui/HakenKnopf";
import Icon from "@/components/ui/Icon";
import { getBlocksForDay, WEEKDAY_LABELS, WEEKDAY_SHORT } from "@/lib/schedule";
import type { TrainingBlock } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";
import { usePlusZeiger } from "@/components/wochenplan/PlusZeiger";
import WocheZeilen from "@/components/wochenplan/WocheZeilen";
import WochenplanExport from "@/components/wochenplan/WochenplanExport";
import s from "@/components/wochenplan/wochenplan.module.css";
import {
  titelMitUmbruch,
  useWochenplanDaten,
} from "@/components/wochenplan/useWochenplanDaten";

/** Pixel je Stunde: 45 Minuten reichen so für Zeit, zwei Zeilen Titel und Trainer. */
const PX_STUNDE = 96;
/** Mehrere Stunden ohne einen einzigen Kurs werden zu diesem Streifen gefaltet. */
const PX_LUECKE = 26;

type Ansicht = "kalender" | "zeilen";
const ANSICHTEN: {
  id: Ansicht;
  name: string;
  icon: "calendar" | "layout";
  hilfe: string;
}[] = [
  {
    id: "kalender",
    name: "Kalender",
    icon: "calendar",
    hilfe: "Tage nebeneinander, die Uhrzeit läuft nach unten",
  },
  {
    id: "zeilen",
    name: "Zeilen",
    icon: "layout",
    hilfe: "Ein Tag je Zeile, die ganze Woche auf einen Blick",
  },
];
const ANSICHT_SCHLUESSEL = "ta-wochenplan-ansicht";

const minuten = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Ein Stück der Achse: eine volle Stunde oder eine gefaltete Lücke. */
interface Stueck {
  von: number;
  bis: number;
  y: number;
  px: number;
  luecke: boolean;
}

/**
 * DIE GEFALTETE ZEITACHSE. Stunden, in denen an keinem Tag ein Kurs liegt,
 * schrumpfen ab zwei am Stück zu einem schmalen Streifen — sonst stünde
 * zwischen dem Samstagvormittag und den Abendkursen ein halber Bildschirm
 * leeres Raster.
 */
function zeitachseBauen(kurse: TrainingBlock[]) {
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
  const stuecke: Stueck[] = [];
  let y = 0;
  let h = vonStd;
  while (h < bisStd) {
    let ende = h;
    while (ende < bisStd && !belegt(ende)) ende++;
    if (ende - h >= 2) {
      stuecke.push({
        von: h * 60,
        bis: ende * 60,
        y,
        px: PX_LUECKE,
        luecke: true,
      });
      y += PX_LUECKE;
      h = ende;
    } else {
      stuecke.push({
        von: h * 60,
        bis: (h + 1) * 60,
        y,
        px: PX_STUNDE,
        luecke: false,
      });
      y += PX_STUNDE;
      h++;
    }
  }
  const yVon = (min: number) => {
    const st =
      stuecke.find((x) => min >= x.von && min <= x.bis) ??
      stuecke[stuecke.length - 1];
    if (!st) return 0;
    return st.y + ((min - st.von) / (st.bis - st.von)) * st.px;
  };
  return { stuecke, hoehe: y, yVon };
}

/** Wer innerhalb dieser Zeit nach einem anderen beginnt, gilt als „gleichzeitig". */
const GLEICHZEITIG_MIN = 30;
/** So weit rückt ein später hineinstartender Kurs ein — höchstens zweimal. */
const EINZUG = 40;
const EINZUG_MAX = 60;

interface Lage {
  links: number;
  breite: number;
  ebene: number;
}

/**
 * ÜBERSCHNEIDUNGEN im Kalender (28.09.2026, zwei Fälle):
 *   · GLEICHZEITIG (Beginn höchstens 30 min auseinander, z. B. zwei Kurse
 *     18:30–20:00 in zwei Räumen): NEBENEINANDER, jeder mit gleicher Breite.
 *     Versetzt übereinander blieb vom unteren nur ein Streifen — im
 *     Oberflächentest ließ er sich nicht einmal anklicken.
 *   · SPÄTER HINEIN (ein Kurs startet mitten in einem langen): rückt 40 %
 *     ein und legt sich darüber. So behält sein Titel fast die volle Breite,
 *     statt auf die Hälfte gequetscht zu werden („Karat|e…" am 28.09.).
 * Kurse, die sich zeitlich berühren, bilden eine Gruppe; darin eine „Welle"
 * je gleichzeitigem Beginn.
 */
function spurenLegen(bloecke: TrainingBlock[]) {
  const aus = new Map<string, Lage>();
  let gruppe: TrainingBlock[] = [];
  let gruppenEnde = -1;
  const schliessen = () => {
    const wellen: TrainingBlock[][] = [];
    for (const b of gruppe) {
      const letzte = wellen[wellen.length - 1];
      if (
        letzte &&
        minuten(b.startTime) - minuten(letzte[0].startTime) < GLEICHZEITIG_MIN
      )
        letzte.push(b);
      else wellen.push([b]);
    }
    wellen.forEach((welle, w) => {
      const einzug = Math.min(w * EINZUG, EINZUG_MAX);
      const breite = (100 - einzug) / welle.length;
      welle.forEach((b, i) =>
        aus.set(b.id, { links: einzug + i * breite, breite, ebene: w }),
      );
    });
    gruppe = [];
  };
  for (const b of bloecke) {
    const von = minuten(b.startTime);
    const bis = Math.max(von + 15, minuten(b.endTime));
    if (von >= gruppenEnde && gruppe.length) schliessen();
    gruppe.push(b);
    gruppenEnde = Math.max(gruppenEnde, bis);
  }
  if (gruppe.length) schliessen();
  return aus;
}

export default function VerwaltungWochenplanPage() {
  const d = useWochenplanDaten();
  const [nurOffen, setNurOffen] = useState(false);
  // Herunterladen als PDF/PNG/JPG (Leon 28.09.; gebaut im Fenster 3e)
  const [exportOffen, setExportOffen] = useState(false);
  const [tagWahl, setTagWahl] = useState(d.heute);
  const plusZeiger = usePlusZeiger();

  /**
   * Räume anlegen und löschen (Leon 28.09.: „das Icon mit den mehreren
   * Schichten bei der Anzeige integriert … dort hinzufügen sowie löschen").
   * Mit Raumfilter sitzt es in der Nase oben rechts am Filterrahmen, die
   * Linie läuft um es herum; das Plus erscheint erst beim Überfahren (Leon
   * 29.09.); solange es keine
   * zwei Räume gibt (dann gibt es keinen Filter), steht es allein mit Wort.
   */
  function raeumeKnopf(allein: boolean) {
    const n = d.raeume.length;
    return (
      <button
        type="button"
        data-press
        className={allein ? s.leise : s.raumKnopf}
        onClick={() => d.setRaeumeOffen(true)}
        aria-label={allein ? undefined : "Räume anlegen und löschen"}
        title="Räume anlegen und löschen"
        data-raeume-knopf
      >
        {allein ? (
          <Icon name="mat" size={18} strokeWidth={2} aria-hidden />
        ) : (
          <span className={s.raumZeichen} aria-hidden>
            <Icon name="mat" size={24} strokeWidth={2} />
            <span className={s.raumPlus}>
              <Icon name="plus" size={9} strokeWidth={3.4} />
            </span>
          </span>
        )}
        {allein && (n === 0 ? "Raum anlegen" : `Räume · ${n}`)}
      </button>
    );
  }
  // Erst nach dem Laden lesen — der Server kennt den Browser-Speicher nicht.
  const [ansicht, setAnsicht] = useState<Ansicht>("kalender");
  useEffect(() => {
    try {
      if (localStorage.getItem(ANSICHT_SCHLUESSEL) === "zeilen")
        setAnsicht("zeilen");
    } catch {}
  }, []);
  function ansichtWaehlen(a: Ansicht) {
    setAnsicht(a);
    try {
      localStorage.setItem(ANSICHT_SCHLUESSEL, a);
    } catch {}
  }
  const plan = d.plan;
  // Zeitraum und Nachfolger gibt es nur für Pläne neben dem Grundplan.
  const planbar = !!plan && !d.standVon(plan).grundplan;
  const zeigeOffen = nurOffen && d.offeneKurse > 0;

  // Die Achse richtet sich nach ALLEN Kursen des Plans, nicht nach dem
  // Raumfilter — sonst springt das Raster beim Filtern.
  const achse = useMemo(() => zeitachseBauen(d.kurse), [d.kurse]);
  const jetztMin = (() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  })();
  const jetztSichtbar = achse.stuecke.some(
    (x) => !x.luecke && jetztMin >= x.von && jetztMin < x.bis,
  );

  function block(k: TrainingBlock, lage: Lage | undefined) {
    const { dotColor: roh, meta } = blockMeta(k);
    // Ohne Kampfart gäbe blockMeta das Grau der Schrift — als Fläche zu schwer.
    const dotColor = roh === "var(--text-3)" ? "var(--line-strong)" : roh;
    const fehlt = d.offenIds.has(k.id);
    const namen = d.trainerVon(k);
    const raum = d.raumVon(k);
    const oben = achse.yVon(minuten(k.startTime));
    const h = Math.max(22, achse.yVon(minuten(k.endTime)) - oben - 2);
    const links = lage?.links ?? 0;
    const breite = lage?.breite ?? 100;
    return (
      <button
        key={k.id}
        type="button"
        data-press
        className={s.block}
        data-offen={fehlt ? "" : undefined}
        data-gedimmt={zeigeOffen && !fehlt ? "" : undefined}
        style={
          {
            "--farbe": dotColor,
            top: oben + 1,
            height: h,
            left: `calc(${links}% + 3px)`,
            width: `calc(${breite}% - 6px)`,
            zIndex: 1 + (lage?.ebene ?? 0),
          } as React.CSSProperties
        }
        onClick={() => d.setZiel({ art: "kurs", titel: k.title })}
        title={`${k.title}, ${k.startTime}–${k.endTime}${meta ? ` · ${meta}` : ""}`}
        data-kurs-zeile={k.id}
      >
        <span className={s.bZeit}>
          {k.startTime}–{k.endTime}
        </span>
        <span className={s.bTitel} style={{ WebkitLineClamp: h >= 66 ? 2 : 1 }}>
          {titelMitUmbruch(k.title)}
        </span>
        {d.trainer !== null && (
          <span className={s.bZeile} data-fehlt={fehlt ? "" : undefined}>
            {/* Was fehlt, trägt das orange Dreieck (Leon 28.09.) */}
            <span className={fehlt ? s.dreieck : undefined}>
              <Icon
                name={fehlt ? "warn" : "user"}
                size={fehlt ? 12 : 11}
                strokeWidth={2.2}
              />
            </span>
            {fehlt ? "Trainer fehlt" : namen.join(", ")}
          </span>
        )}
        {raum && h >= 80 && (
          <span className={s.bZeile}>
            <Icon name="mat" size={11} strokeWidth={2.2} />
            {raum}
          </span>
        )}
      </button>
    );
  }

  // Beobachtung: Kurse ohne Trainer. Ein Schalter, der den Rest dimmt.
  const offenKnopf = (
    <button
      type="button"
      data-press
      className={s.leise}
      aria-pressed={zeigeOffen}
      onClick={() => setNurOffen((v) => !v)}
      data-kurse-offen={d.offeneKurse}
    >
      <span className={s.dreieck}>
        <Icon name="warn" size={16} strokeWidth={2.2} />
      </span>
      {d.offeneKurse === 1
        ? "1 Kurs ohne Trainer"
        : `${d.offeneKurse} Kurse ohne Trainer`}
    </button>
  );

  return (
    <main className={s.seite}>
      <div className="px-4 pt-3 lg:hidden">
        <SeitenZurueck href="/verwaltung" label="Verwaltung" />
      </div>

      {!d.istVerwaltung ? (
        <p className={s.leer}>
          {d.profileLoading
            ? ""
            : "Den Wochenplan legt die Verwaltung deines Gyms an."}
        </p>
      ) : !d.geladen ? null : (
        <div className={s.aufbau}>
          {/* ── Die Pläne ─────────────────────────────────────────────── */}
          <nav aria-label="Wochenpläne" data-plan-leiste>
            <div className={s.plaeneTitel}>Deine Pläne</div>
            <div className={s.plaene}>
              {d.plaene.map((p) => {
                const wann = d.wannText(p);
                return (
                  <button
                    key={p.id}
                    type="button"
                    data-press
                    className={s.plan}
                    aria-pressed={p.id === plan?.id}
                    onClick={() => d.setGewaehltId(p.id)}
                    data-plan={p.id}
                    data-plan-aktiv={p.aktiv ? "" : undefined}
                  >
                    <span
                      className={s.planPunkt}
                      data-aktiv={p.aktiv ? "" : undefined}
                      aria-hidden
                    />
                    <span className={s.planName} data-plan-name>
                      {p.name}
                    </span>
                    <span
                      className={s.planUnter}
                      data-aktiv={p.aktiv ? "" : undefined}
                    >
                      {p.aktiv
                        ? `Gilt jetzt${wann ? ` · ${wann}` : ""}`
                        : (wann ?? d.kursZahlText(p))}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                data-press
                className={s.planNeu}
                onClick={() =>
                  d.setPlanZiel({ art: "neu", vorlageId: plan?.id ?? null })
                }
                data-plan-neu
              >
                <Icon name="plus" size={14} strokeWidth={2.4} />
                Neuer Plan
              </button>
            </div>
          </nav>

          <div className="min-w-0">
            {/* ── Der gewählte Plan ─────────────────────────────────── */}
            {plan && (
              <div className={s.kopf} data-plan-gewaehlt={plan.id}>
                <div className={s.kopfText}>
                  <div className={s.kopfNameZeile}>
                    <h1 className={s.kopfName}>{plan.name}</h1>
                    <button
                      type="button"
                      data-press
                      className={s.iconKnopf}
                      onClick={() =>
                        d.setPlanZiel({ art: "plan", planId: plan.id })
                      }
                      aria-label={`${plan.name} bearbeiten`}
                      data-plan-bearbeiten
                    >
                      <Icon name="edit" size={16} strokeWidth={2.2} />
                    </button>
                    {/* Aktivieren öffnet das Popup (Leon 29.09.): ab sofort,
                        ab einem Tag oder von – bis. Der Grundplan gilt immer —
                        für ihn gibt es nichts zu planen, er aktiviert direkt.
                        Läuft ein Zeitraum, öffnet „Gilt jetzt" dasselbe Popup,
                        dort verschiebst du das Ende. */}
                    <div className={s.aktivGruppe} data-plan-aktionen>
                      {plan.aktiv ? (
                        planbar ? (
                          <button
                            type="button"
                            data-press
                            className={s.giltJetzt}
                            onClick={() =>
                              d.setPlanZiel({ art: "planen", planId: plan.id })
                            }
                            title="Zeitraum ändern"
                            data-plan-knopf="aktiv"
                          >
                            <Icon name="check" size={14} strokeWidth={2.8} />
                            Gilt jetzt
                          </button>
                        ) : (
                          <span className={s.giltJetzt} data-plan-knopf="aktiv">
                            <Icon name="check" size={14} strokeWidth={2.8} />
                            Gilt jetzt
                          </span>
                        )
                      ) : (
                        <HakenKnopf
                          laeuft={d.aktiviert === plan.id}
                          disabled={d.aktiviert !== null}
                          onClick={() =>
                            planbar
                              ? d.setPlanZiel({ art: "planen", planId: plan.id })
                              : void d.aktivieren(plan)
                          }
                          data-plan-knopf="aktivieren"
                        >
                          {d.aktiviert === plan.id ? "Aktiviere…" : "Aktivieren"}
                        </HakenKnopf>
                      )}
                    </div>
                    {d.offeneKurse > 0 && (
                      <div className={s.meldungen}>{offenKnopf}</div>
                    )}
                  </div>
                  <p className={s.kopfSatz} data-plan-hinweis>
                    {d.kursZahl === 0
                      ? ""
                      : `${d.kursZahl} ${d.kursZahl === 1 ? "Kurs" : "Kurse"}, ${d.kurse.length} ${d.kurse.length === 1 ? "Termin" : "Termine"} die Woche. `}
                    {d.hinweis(plan)}
                  </p>
                </div>
              </div>
            )}
            {d.aktivFehler && (
              <p role="alert" className={s.fehler}>
                {d.aktivFehler}
              </p>
            )}

            {/* ── Filter und Werkzeuge ──────────────────────────────── */}
            <div className={s.werkzeug}>
              <div className={s.werkzeugLinks}>
                {d.mitRaeumen ? (
                  <GooAuswahl
                    ariaLabel="Nach Raum filtern"
                    data-raum-filter
                    wert={d.filter}
                    onWahl={d.setRaumFilter}
                    optionen={d.raumOptionen}
                    nase={raeumeKnopf(false)}
                  />
                ) : (
                  raeumeKnopf(true)
                )}
                {/* Am Handy steht das Zeichen nicht im Filter (kein Platz),
                    sondern als Knopf mit Wort darunter. */}
                {d.mitRaeumen && (
                  <span className="sm:hidden">{raeumeKnopf(true)}</span>
                )}
              </div>
              <div className={s.werkzeugRechts}>
                {/* Ansicht (Leon 28.09.): Kalender = B, Zeilen = C. Die Wahl merkt
                    sich der Browser; die Pläne links bleiben in beiden stehen. */}
                <div
                  className={s.ansicht}
                  role="radiogroup"
                  aria-label="Ansicht"
                  data-ansicht-wahl
                >
                  {ANSICHTEN.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      role="radio"
                      data-press
                      aria-checked={ansicht === a.id}
                      className={s.ansichtKnopf}
                      onClick={() => ansichtWaehlen(a.id)}
                      title={a.hilfe}
                      data-ansicht={a.id}
                    >
                      <Icon name={a.icon} size={14} strokeWidth={2.2} />
                      {a.name}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  data-press
                  className={s.voll}
                  onClick={() => d.setZiel({ art: "neu" })}
                  data-kurs-anlegen
                >
                  <Icon name="plus" size={14} strokeWidth={2.4} />
                  Kurs anlegen
                </button>
              </div>
            </div>

            {d.kurse.length === 0 && (
              <p className={s.leer} data-kurse-leer>
                Leg deinen ersten Kurs an: Name, Tag, Uhrzeit und wer ihn gibt.
                Danach steht er im Kursplan, und deine Athleten melden sich
                direkt zurück.
              </p>
            )}

            {ansicht === "kalender" ? (
              <>
                {/* ── Tageswahl (nur schmal) ────────────────────────────── */}
                <div className={s.tagWahl} role="group" aria-label="Tag wählen">
                  {WEEKDAY_SHORT.map((kurz, i) => {
                    const n = getBlocksForDay(d.sichtbar, i).length;
                    return (
                      <button
                        key={i}
                        type="button"
                        data-press
                        className={s.tagWahlKnopf}
                        aria-pressed={i === tagWahl}
                        aria-label={`${WEEKDAY_LABELS[i]}, ${n === 1 ? "1 Kurs" : `${n} Kurse`}`}
                        onClick={() => setTagWahl(i)}
                      >
                        {kurz}
                        <small>{n === 0 ? "frei" : n}</small>
                      </button>
                    );
                  })}
                </div>

                {/* ── Der Kalender ──────────────────────────────────────── */}
                <div className={s.kalender}>
                  <div className={s.kalKopf}>
                    <div />
                    {WEEKDAY_LABELS.map((label, i) => (
                      <div
                        key={i}
                        className={s.kopfZelle}
                        data-heute={i === d.heute ? "" : undefined}
                        data-gewaehlt={i === tagWahl ? "" : undefined}
                      >
                        <span className={s.kopfTag}>
                          {label}
                          {i === d.heute && (
                            <span className="sr-only"> (heute)</span>
                          )}
                        </span>
                        <button
                          type="button"
                          data-press
                          className={s.kopfPlus}
                          onClick={() => d.setZiel({ art: "neu", weekday: i })}
                          aria-label={`Kurs am ${label} anlegen`}
                          data-kurs-anlegen-tag={i}
                        >
                          <Icon name="plus" size={14} strokeWidth={2.4} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div
                    ref={plusZeiger.host}
                    className={s.kalKoerper}
                    style={{ height: achse.hoehe }}
                    onMouseLeave={plusZeiger.weg}
                  >
                    {plusZeiger.zeiger}
                    <div className={s.achse} aria-hidden>
                      {achse.stuecke.map((st, i) =>
                        i === 0 ? null : (
                          <span
                            key={st.von}
                            className={s.stunde}
                            style={{ top: st.y }}
                          >
                            {String(Math.floor(st.von / 60)).padStart(2, "0")}
                            :00
                          </span>
                        ),
                      )}
                    </div>
                    {WEEKDAY_LABELS.map((label, i) => {
                      const bloecke = getBlocksForDay(d.sichtbar, i);
                      const lagen = spurenLegen(bloecke);
                      return (
                        <section
                          key={i}
                          className={s.spalte}
                          aria-label={label}
                          data-heute={i === d.heute ? "" : undefined}
                          data-gewaehlt={i === tagWahl ? "" : undefined}
                          onMouseMove={plusZeiger.bewegen}
                          onClick={(e) => {
                            if (e.target === e.currentTarget)
                              d.setZiel({ art: "neu", weekday: i });
                          }}
                        >
                          {bloecke.map((k) => block(k, lagen.get(k.id)))}
                          {i === d.heute && jetztSichtbar && (
                            <span
                              className={s.jetzt}
                              style={{ top: achse.yVon(jetztMin) }}
                              aria-hidden
                            />
                          )}
                        </section>
                      );
                    })}
                    {/* Stundenlinien und gefaltete Lücken über alle Tage, hinter den Kursen */}
                    <div className={s.linien} aria-hidden>
                      {achse.stuecke.map((st, i) =>
                        st.luecke ? (
                          <span
                            key={st.von}
                            className={s.luecke}
                            style={{ top: st.y, height: st.px }}
                          />
                        ) : i === 0 || achse.stuecke[i - 1].luecke ? null : (
                          <span
                            key={st.von}
                            className={s.linie}
                            style={{ top: st.y }}
                          />
                        ),
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <WocheZeilen d={d} zeigeOffen={zeigeOffen} />
            )}

            {/* Herunterladen rechts unter dem Plan (Leon 28.09.) — der
                Aushang ist das Ergebnis der Woche, er steht am Ende. */}
            <div className={s.unten}>
              <button
                type="button"
                data-press
                className={s.leise}
                onClick={() => setExportOffen(true)}
                disabled={d.kurse.length === 0}
                data-export-knopf
              >
                <Icon name="download" size={15} strokeWidth={2.2} />
                Herunterladen
              </button>
            </div>
          </div>
        </div>
      )}
      {d.sheets}
      <WochenplanExport
        offen={exportOffen}
        onClose={() => setExportOffen(false)}
        gymId={d.gymId}
        plan={d.plan}
        plaene={d.plaene}
        kurse={d.sichtbar}
        raumFilter={
          d.filter
            ? (d.raumOptionen.find((o) => o.id === d.filter)?.name ?? null)
            : null
        }
        trainerVon={d.trainerVon}
        raumVon={d.raumVon}
        trainerGeladen={d.trainer !== null}
      />
    </main>
  );
}
