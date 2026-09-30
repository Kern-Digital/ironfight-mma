/**
 * DER KURSPLAN EINES GYMS (Leon 26.09.2026, „Kurs bekommt Trainer", Weg 2).
 *
 * ─── WARUM ES DIESE DATEI GIBT ──────────────────────────────────────────────
 *
 * Bis zum 26.09. waren die Kurse eine Code-Konstante (`TRAINING_BLOCKS`), 24
 * Termine aus Leons Gym. JEDES Gym sah genau diese Woche — auch eines, das
 * sich seit dem 21.09. selbst anmeldet: Es fand Wing Tsung und Karate in
 * seinem Kursplan, die es nie angeboten hat. Und ein Trainer ließ sich keinem
 * Kurs zuordnen, weil die Konstante für alle Gyms dieselbe war.
 *
 * Jetzt hat jedes Gym seinen eigenen Plan:
 *
 *   gyms/{gymId}/schedulePlans/{planId}
 *     { name, aktiv, aktivAb, kurse: TrainingBlock[], raeume, angelegtAm,
 *       geaendertAm, geaendertVon }
 *
 * ─── WARUM EIN DOKUMENT MIT EINER LISTE ─────────────────────────────────────
 *
 * Jede Seite braucht die GANZE Woche — Kursplan, Kopfbalken („Jetzt: …"),
 * Dashboard, Filter. Eine Liste in einem Dokument ist EIN Lesevorgang; eine
 * Unter-Sammlung wären 24. Eine Woche mit 60 Kursen wiegt ein paar Kilobyte,
 * das Dokument fasst ein Mebibyte.
 *
 * ─── MEHRERE WOCHENPLÄNE, GENAU EINER AKTIV (Leon 27.09.2026) ───────────────
 *
 * „in der verwaltungsebene mehrere wochenpläne für ferien etc. bauen kann
 * aber immer nur einen aktiviere. den aktivierten sehen dann trainer und
 * athleten … es muss aber immer ein plan aktiv sein also soll ich nicht
 * pausieren jedoch bei allen plänen aktivieren klicken können so das ich pro
 * plan nur einen button habe". Konzept §7.
 *
 *   · Trainer und Athleten lesen NUR den Plan mit `aktiv == true` (Regel und
 *     useKursplan). Die Verwaltung liest alle (useWochenplaene).
 *   · Aktivieren löst den bisherigen Plan ab — serverseitig in EINER
 *     Transaktion, nie null und nie zwei aktive. Kein Pausieren.
 *   · Duplizieren ist der Standardweg. Die Termine behalten dabei ihre IDs
 *     (Leon 27.09.: „IDs behalten") — „MMA Teens Mi 16:00" ist im Ferienplan
 *     derselbe Termin, Kurs-Abos und Plan-Freigaben laufen weiter. IDs sind
 *     damit je PLAN eindeutig, nicht je Gym.
 *   · GRUNDPLAN UND ZEITRAUM (Leon 27.09. abends, „für einen gewissen
 *     zeitraum"): Der Grundplan gilt, wenn kein Zeitraum läuft; ein Plan mit
 *     Zeitraum gilt nur darin. Welcher Plan aktiv ist, RECHNET
 *     `planStandRechnen` aus dem Tag — unten bei `Wochenplan` erklärt.
 *   · Räume gehören dem GYM, nicht dem Plan: Sie stehen an jedem Plan-Dokument
 *     gleich, und die Raum-Aktionen ändern alle Pläne zugleich. Die Matte zieht
 *     in den Ferien nicht um.
 *
 * ─── RÄUME (Leon 27.09.2026) ────────────────────────────────────────────────
 *
 * „bedenke das es gyms gibt die verschiedene räume haben". Die Räume stehen
 * als `raeume: { id, name }[]` am selben Plan-Dokument, jeder Kurs trägt
 * höchstens eine `raumId`. Gepflegt werden sie im Wochenplan der Verwaltung.
 * Zwei Kurse zur selben Zeit im selben Raum sind ERLAUBT — Leon: „Nur
 * warnen" (zwei Gruppen teilen sich bewusst eine Matte). `ueberschneidungen`
 * liefert die Warnung, gespeichert wird trotzdem.
 *
 * ─── WER SCHREIBT ───────────────────────────────────────────────────────────
 *
 * Nur der Server (`/api/gym/kurse`, Admin-SDK). Kurse anlegen und Trainer
 * zuweisen darf die Verwaltung des Gyms (Leon 26.09.: „Nur Verwaltung" — und
 * „ein trainer der auch in der verwaltung ist darf natürlich über die
 * verwaltungsebene kurse bearbeiten": geprüft wird das Häkchen, nie „nur
 * Verwaltung"). Die Regel „mindestens ein Trainer" steht hier, damit Browser
 * und Server dieselbe Prüfung rechnen.
 */

import type { Category, Discipline, TrainingBlock } from "./types";
import { DISCIPLINE_LABEL } from "./types";

/** Name des ersten Plans, den jedes Gym bekommt. */
export const KURSPLAN_STANDARD_NAME = "Wochenplan";

/** Obergrenze je Plan — weit über jedem echten Gym, deutlich unter 1 MiB. */
export const KURSE_MAX = 200;

/** Länge eines Kursnamens. „MMA Advanced (Grappling)" hat 24 Zeichen. */
export const KURSNAME_MAX = 60;

/** Ein Raum des Gyms. Die ID bleibt, der Name darf sich ändern. */
export interface Raum {
  id: string;
  name: string;
}

export const RAEUME_MAX = 20;
export const RAUMNAME_MAX = 40;

/** Liest die Räume eines Plans; kaputte Einträge fallen still heraus. */
export function raeumeLesen(roh: unknown): Raum[] {
  if (!Array.isArray(roh)) return [];
  return roh.flatMap((r) =>
    r && typeof r === "object" && typeof (r as Raum).id === "string" && typeof (r as Raum).name === "string"
      ? [{ id: (r as Raum).id, name: (r as Raum).name }]
      : [],
  );
}

/** Bereinigt einen Raumnamen oder liefert den Satz, warum er nicht geht. */
export function raumnamePruefen(roh: unknown, andere: Raum[]): { name: string } | { fehler: string } {
  const name = typeof roh === "string" ? roh.trim().replace(/\s+/g, " ") : "";
  if (!name) return { fehler: "Gib dem Raum einen Namen." };
  if (name.length > RAUMNAME_MAX) return { fehler: `Der Name ist zu lang. Bleib unter ${RAUMNAME_MAX} Zeichen.` };
  if (andere.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
    return { fehler: `Einen Raum „${name}" gibt es schon.` };
  }
  return { name };
}

export const KURS_GRUPPEN = ["kids", "teens", "adult", "advanced", "mixed"] as const;
export type KursGruppe = (typeof KURS_GRUPPEN)[number];

export const KURS_GRUPPE_LABEL: Record<KursGruppe, string> = {
  kids: "Kinder",
  teens: "Jugend",
  adult: "Erwachsene",
  advanced: "Fortgeschritten",
  mixed: "Gemischt",
};

export const KAMPFARTEN = Object.keys(DISCIPLINE_LABEL) as Discipline[];

/**
 * Die Rubrik folgt aus der Kampfart. Sie färbt den Kurs und wählt die
 * Technik-Gruppen im Kursplan. So stand es in allen 24 Terminen der alten
 * Konstante — Kickboxen und Fitness-Kickboxen liefen unter „Box".
 * MMA, Karate, Wing Tsung und Selbstverteidigung haben keine Rubrik.
 */
export function rubrikAusKampfart(d: Discipline | undefined): Category | undefined {
  switch (d) {
    case "boxing":
    case "kickboxen":
    case "fitness-kickboxen":
      return "boxing";
    case "wrestling":
      return "wrestling";
    case "bjj":
      return "bjj";
    case "muay-thai":
      return "muay-thai";
    default:
      return undefined;
  }
}

/** "18:30" → Minuten seit Mitternacht; alles andere → NaN. */
export function minutenAus(hhmm: string): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

/** Nach Wochentag, dann Beginn — die Ordnung, die jede Ansicht zeigt. */
export function kurseSortieren(kurse: TrainingBlock[]): TrainingBlock[] {
  return kurse
    .slice()
    .sort(
      (a, b) =>
        a.weekday - b.weekday ||
        a.startTime.localeCompare(b.startTime) ||
        a.title.localeCompare(b.title, "de"),
    );
}

/**
 * EIN Termin samt Kursfeldern — das, was `kursPruefen` prüft. Von außen wird
 * ein Kurs als `KursEingabe` mit Terminliste geschickt (unten).
 */
export interface TerminKursEingabe {
  title: string;
  weekday: number;
  startTime: string;
  endTime: string;
  discipline?: Discipline | null;
  level?: KursGruppe | null;
  trainerUids: string[];
  raumId?: string | null;
}

/**
 * Prüft einen Kurs. Liefert den bereinigten Kurs oder den ersten Fehler als
 * Satz, den die Oberfläche so zeigen kann. Browser und Server rechnen damit
 * dieselbe Prüfung — der Server verlässt sich trotzdem nie auf den Browser.
 */
export function kursPruefen(
  roh: unknown,
): { kurs: Omit<TrainingBlock, "id"> } | { fehler: string } {
  if (!roh || typeof roh !== "object") return { fehler: "Der Kurs kam leer an." };
  const e = roh as Record<string, unknown>;

  const title = typeof e.title === "string" ? e.title.trim().replace(/\s+/g, " ") : "";
  if (!title) return { fehler: "Gib dem Kurs einen Namen." };
  if (title.length > KURSNAME_MAX) {
    return { fehler: `Der Name ist zu lang. Bleib unter ${KURSNAME_MAX} Zeichen.` };
  }

  const weekday = e.weekday;
  if (typeof weekday !== "number" || !Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    return { fehler: "Wähl den Wochentag." };
  }

  const startTime = typeof e.startTime === "string" ? e.startTime : "";
  const endTime = typeof e.endTime === "string" ? e.endTime : "";
  const von = minutenAus(startTime);
  const bis = minutenAus(endTime);
  if (Number.isNaN(von)) return { fehler: "Trag ein, wann der Kurs beginnt." };
  if (Number.isNaN(bis)) return { fehler: "Trag ein, wann der Kurs endet." };
  if (bis <= von) return { fehler: "Der Kurs endet nach seinem Beginn." };

  let discipline: Discipline | undefined;
  if (e.discipline !== undefined && e.discipline !== null && e.discipline !== "") {
    if (typeof e.discipline !== "string" || !KAMPFARTEN.includes(e.discipline as Discipline)) {
      return { fehler: "Wähl eine Kampfart aus der Liste." };
    }
    discipline = e.discipline as Discipline;
  }

  let level: KursGruppe | undefined;
  if (e.level !== undefined && e.level !== null && e.level !== "") {
    if (typeof e.level !== "string" || !KURS_GRUPPEN.includes(e.level as KursGruppe)) {
      return { fehler: "Wähl eine Gruppe aus der Liste." };
    }
    level = e.level as KursGruppe;
  }

  const trainerUids = Array.isArray(e.trainerUids)
    ? Array.from(
        new Set(e.trainerUids.filter((u): u is string => typeof u === "string" && u.length > 0)),
      )
    : [];
  // Leon 16.09.: „ein Kurs braucht immer einen Trainer". 26.09.: mindestens
  // einer, mehrere erlaubt (Co-Trainer, Vertretung).
  if (trainerUids.length === 0) return { fehler: "Jeder Kurs braucht einen Trainer." };
  if (trainerUids.length > 10) return { fehler: "Höchstens zehn Trainer je Kurs." };

  let raumId: string | undefined;
  if (e.raumId !== undefined && e.raumId !== null && e.raumId !== "") {
    if (typeof e.raumId !== "string") return { fehler: "Wähl einen Raum aus der Liste." };
    raumId = e.raumId;
  }

  const category = rubrikAusKampfart(discipline);
  return {
    kurs: {
      title,
      weekday: weekday as TrainingBlock["weekday"],
      startTime,
      endTime,
      ...(discipline ? { discipline } : {}),
      ...(category ? { category } : {}),
      ...(level ? { level } : {}),
      ...(raumId ? { raumId } : {}),
      trainerUids,
    },
  };
}

// ─── KURS MIT MEHREREN TERMINEN (Leon 27.09.2026) ───────────────────────────
//
// „bedenke auch das ein kurs an mehreren Tagen passieren kann … für mehrere
// tage und dann noch für unterschiedliche zeiten". Gespeichert bleibt die
// Woche als Liste von TERMINEN (ein TrainingBlock je Tag und Uhrzeit) — daran
// hängen Kurs-Abos, Rückmeldungen und Plan-Freigaben mit ihren IDs. Ein KURS
// ist die Gruppe aller Termine mit demselben NAMEN; so zählt die App schon
// seit dem 03.09. (Kurs-Filter, Plan-Zuordnung „Nach Kursen"). Name,
// Kampfart, Gruppe und Trainer gelten für den ganzen Kurs, Tag, Uhrzeit und
// Raum für jeden Termin einzeln.

/** Höchstens so viele Termine je Kurs — zweimal täglich reicht jedem Gym. */
export const TERMINE_MAX = 14;

/** Ein Termin, wie das Sheet ihn schickt. `id` nur bei bestehenden Terminen. */
export interface TerminEingabe {
  id?: string | null;
  weekday: number;
  startTime: string;
  endTime: string;
  raumId?: string | null;
}

/** Ein Kurs mit allen Terminen, wie das Sheet ihn schickt. */
export interface KursEingabe {
  title: string;
  discipline?: Discipline | null;
  level?: KursGruppe | null;
  trainerUids: string[];
  termine: TerminEingabe[];
}

const TAG_NAME = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

/**
 * Prüft einen Kurs mit Terminen. Liefert den Namen und je Termin den
 * bereinigten Eintrag (mit der alten ID, falls mitgeschickt) — oder den
 * ersten Fehler als Satz. Was für den ganzen Kurs gilt (Name, Trainer,
 * Kampfart), prüft schon der erste Termin; bei späteren Terminen kann nur
 * noch Tag oder Uhrzeit falsch sein, deshalb sagt der Satz dann, welcher.
 */
export function kursMitTerminenPruefen(
  roh: unknown,
): { title: string; termine: (Omit<TrainingBlock, "id"> & { id?: string })[] } | { fehler: string } {
  if (!roh || typeof roh !== "object") return { fehler: "Der Kurs kam leer an." };
  const e = roh as Record<string, unknown>;
  const termine = Array.isArray(e.termine) ? e.termine : [];
  if (termine.length === 0) return { fehler: "Wähl mindestens einen Tag." };
  if (termine.length > TERMINE_MAX) return { fehler: `Höchstens ${TERMINE_MAX} Termine je Kurs.` };

  const out: (Omit<TrainingBlock, "id"> & { id?: string })[] = [];
  for (let i = 0; i < termine.length; i++) {
    const t = (termine[i] ?? {}) as Record<string, unknown>;
    const geprueft = kursPruefen({
      title: e.title,
      discipline: e.discipline,
      level: e.level,
      trainerUids: e.trainerUids,
      weekday: t.weekday,
      startTime: t.startTime,
      endTime: t.endTime,
      raumId: t.raumId,
    });
    if ("fehler" in geprueft) {
      // Beim ersten Termin kann auch Name, Trainer oder Kampfart fehlen — der
      // Satz gilt dann für den ganzen Kurs. Danach geht es nur noch um Tag
      // oder Uhrzeit, und der Satz sagt, an welchem Tag.
      const nurZeit = /beginnt|endet|Wochentag/.test(geprueft.fehler);
      if (termine.length === 1 || (i === 0 && !nurZeit)) return { fehler: geprueft.fehler };
      const tag = typeof t.weekday === "number" ? TAG_NAME[t.weekday] : undefined;
      return { fehler: tag ? `${tag}: ${geprueft.fehler}` : `Termin ${i + 1}: ${geprueft.fehler}` };
    }
    const k = geprueft.kurs;
    if (out.some((o) => o.weekday === k.weekday && o.startTime === k.startTime)) {
      return { fehler: `Zwei Termine am ${TAG_NAME[k.weekday]} um ${k.startTime}. Lösch einen davon.` };
    }
    out.push({ ...(typeof t.id === "string" && t.id ? { id: t.id } : {}), ...k });
  }
  return { title: out[0].title, termine: out };
}

/** Ein Kurs = alle Termine mit demselben Namen, in der Ordnung der Woche. */
export interface KursGruppiert {
  title: string;
  termine: TrainingBlock[];
}

export function kurseGruppieren(kurse: TrainingBlock[]): KursGruppiert[] {
  const map = new Map<string, TrainingBlock[]>();
  for (const k of kurseSortieren(kurse)) {
    const liste = map.get(k.title);
    if (liste) liste.push(k);
    else map.set(k.title, [k]);
  }
  return Array.from(map, ([title, termine]) => ({ title, termine }));
}

/** „Mo 18:00 · Mi 19:30" — die Termine eines Kurses in einer Zeile. */
export function termineKurz(termine: Pick<TrainingBlock, "weekday" | "startTime">[]): string {
  const kurz = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  return termine
    .slice()
    .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime))
    .map((t) => `${kurz[t.weekday]} ${t.startTime}`)
    .join(" · ");
}

/**
 * Liest die Kursliste aus einem Plan-Dokument. Kaputte Einträge fallen still
 * heraus — eine Woche mit 23 Kursen ist besser als eine leere Seite.
 * `trainerUids` darf hier fehlen: Die aus der alten Konstante übernommenen
 * Kurse stehen ohne Trainer da, bis die Verwaltung sie zuweist.
 */
export function kurseLesen(roh: unknown): TrainingBlock[] {
  if (!Array.isArray(roh)) return [];
  const out: TrainingBlock[] = [];
  for (const k of roh) {
    if (!k || typeof k !== "object") continue;
    const e = k as Record<string, unknown>;
    if (typeof e.id !== "string" || !e.id) continue;
    if (typeof e.title !== "string" || !e.title) continue;
    if (typeof e.weekday !== "number" || e.weekday < 0 || e.weekday > 6) continue;
    if (typeof e.startTime !== "string" || typeof e.endTime !== "string") continue;
    out.push({
      id: e.id,
      weekday: e.weekday as TrainingBlock["weekday"],
      title: e.title,
      startTime: e.startTime,
      endTime: e.endTime,
      ...(typeof e.category === "string" ? { category: e.category as Category } : {}),
      ...(typeof e.discipline === "string" ? { discipline: e.discipline as Discipline } : {}),
      ...(typeof e.level === "string" ? { level: e.level as KursGruppe } : {}),
      trainerUids: Array.isArray(e.trainerUids)
        ? e.trainerUids.filter((u): u is string => typeof u === "string")
        : [],
      ...(typeof e.raumId === "string" && e.raumId ? { raumId: e.raumId } : {}),
    });
  }
  return kurseSortieren(out);
}

/**
 * Kurse, denen ein gültiger Trainer fehlt. `trainerImGym` sagt, ob eine uid
 * heute noch Trainer DIESES Gyms ist — wer das Gym verlassen oder sein
 * Trainer-Häkchen verloren hat, zählt nicht mehr.
 */
export function kurseOhneTrainer(
  kurse: TrainingBlock[],
  trainerImGym: (uid: string) => boolean,
): TrainingBlock[] {
  return kurse.filter((k) => !(k.trainerUids ?? []).some(trainerImGym));
}

/**
 * Was sich mit einem Kurs überschneidet — gleicher Tag, Zeiten überlappen
 * (17:00–18:00 und 18:00–19:00 überlappen NICHT). Zwei Arten:
 *   · `raum`: derselbe Raum ist schon belegt.
 *   · `trainer`: ein Trainer gibt zur selben Zeit schon einen anderen Kurs.
 * Beides ist eine WARNUNG, kein Verbot (Leon 27.09.: „Nur warnen").
 * `ohneId` lässt den Kurs selbst heraus, wenn er gerade bearbeitet wird.
 */
export function ueberschneidungen(
  kurse: TrainingBlock[],
  kurs: Pick<TrainingBlock, "weekday" | "startTime" | "endTime" | "raumId" | "trainerUids">,
  ohneId?: string,
): { raum: TrainingBlock[]; trainer: { uid: string; kurs: TrainingBlock }[] } {
  const von = minutenAus(kurs.startTime);
  const bis = minutenAus(kurs.endTime);
  const raum: TrainingBlock[] = [];
  const trainer: { uid: string; kurs: TrainingBlock }[] = [];
  if (Number.isNaN(von) || Number.isNaN(bis) || bis <= von) return { raum, trainer };
  for (const k of kurse) {
    if (k.id === ohneId || k.weekday !== kurs.weekday) continue;
    const kVon = minutenAus(k.startTime);
    const kBis = minutenAus(k.endTime);
    if (!(von < kBis && kVon < bis)) continue;
    if (kurs.raumId && k.raumId === kurs.raumId) raum.push(k);
    for (const uid of kurs.trainerUids ?? []) {
      if ((k.trainerUids ?? []).includes(uid)) trainer.push({ uid, kurs: k });
    }
  }
  return { raum, trainer };
}

// ─── MEHRERE WOCHENPLÄNE (Leon 27.09.2026) ──────────────────────────────────

/** Höchstens so viele Pläne je Gym — Normalbetrieb, Ferien, Feiertage … */
export const PLAENE_MAX = 12;
export const PLANNAME_MAX = 40;

/**
 * Ein Wochenplan, wie die Verwaltung ihn sieht.
 *
 * ─── GRUNDPLAN UND ZEITRAUM (Leon 27.09.2026 abends) ────────────────────────
 *
 * „das man pläne auch für einen gewissen zeitraum auswählen kann. ich möchte
 * das hierbei aber nichts passieren kann das einen fehler im ablauf hervor
 * ruft."
 *
 *   · GENAU EIN Plan ist der GRUNDPLAN: der zuletzt aktivierte. Er gilt,
 *     wann immer kein Zeitraum läuft. Er trägt nie einen Zeitraum und lässt
 *     sich nicht löschen — die Woche hat so immer etwas, wohin sie
 *     zurückfällt.
 *   · Jeder andere Plan kann EINEN Zeitraum tragen (`zeitraumVon` bis
 *     `zeitraumBis`, deutsche Kalendertage, beide eingeschlossen). In dieser
 *     Zeit ist er aktiv, danach wieder der Grundplan. Ohne Ende („ab 14.
 *     Juli") wird er an dem Tag selbst zum Grundplan.
 *   · WELCHER PLAN AKTIV IST, IST EINE RECHNUNG, KEIN EREIGNIS:
 *     `planStandRechnen` leitet aus dem heutigen Tag und den Plänen den
 *     ganzen Stand ab. Nacht-Job, jede Verwaltungs-Aktion und der tägliche
 *     Abgleich beim Öffnen der App rechnen dasselbe. Verpasst einer, holt der
 *     nächste es nach; zweimal rechnen ändert nichts.
 *   · Was den Ablauf stören könnte, lehnt `zeitraumPruefen` schon beim
 *     Speichern ab: Überschneidungen, Vergangenes, Ende vor Beginn, länger
 *     als ein Jahr, ein Zeitraum am Grundplan.
 */
export interface Wochenplan {
  id: string;
  name: string;
  /**
   * Der GESPEICHERTE Stand, den Trainer und Athleten lesen (Regel und
   * useKursplan fragen `aktiv == true`). Er folgt aus `planStandRechnen`.
   */
  aktiv: boolean;
  grundplan: boolean;
  zeitraumVon: string | null;
  /** null bei `zeitraumVon` = „ab diesem Tag dauerhaft". */
  zeitraumBis: string | null;
  /**
   * Welcher Plan nach dem Ende dauerhaft gilt (Leon 27.09.: „wenn ich ein
   * enddatum setze soll ein neues feld auftauchen mit nachfolge plan").
   * null = zurück zum Grundplan. Nur mit `zeitraumBis`.
   */
  nachfolgerId: string | null;
  kurse: TrainingBlock[];
  raeume: Raum[];
  /** Für eine feste Reihenfolge: Aktivieren soll die Pläne nicht umsortieren. */
  angelegtMs: number;
}

const TAG_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function tagAlsUtc(tag: string): Date | null {
  const m = TAG_RE.exec(tag);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  // 2026-02-31 rollt in den März — dann war es kein Tag.
  return d.getUTCDate() === Number(m[3]) && d.getUTCMonth() === Number(m[2]) - 1 ? d : null;
}

function gueltigerTag(x: unknown): string | null {
  return typeof x === "string" && tagAlsUtc(x) ? x : null;
}

/** „2026-07-14" + n Tage → „2026-07-…". */
export function tagPlus(tag: string, tage: number): string {
  const d = tagAlsUtc(tag) ?? new Date();
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

function tageZwischen(von: string, bis: string): number {
  const a = tagAlsUtc(von);
  const b = tagAlsUtc(bis);
  return a && b ? Math.round((b.getTime() - a.getTime()) / 86_400_000) : 0;
}

/** „14. Juli", in einem anderen Jahr als `heute` „14. Juli 2027". */
export function tagText(tag: string, heute?: string): string {
  const d = tagAlsUtc(tag);
  if (!d) return tag;
  const mitJahr = !heute || heute.slice(0, 4) !== tag.slice(0, 4);
  return d.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    ...(mitJahr ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

/** Liest ein Plan-Dokument. Fehlende Felder bekommen den Standard. */
export function planLesen(id: string, d: Record<string, unknown>): Wochenplan {
  const angelegt = d.angelegtAm as { toMillis?: () => number } | undefined;
  // `aktivAb` war die Fassung vom 27.09. nachmittags (ein Starttag ohne
  // Ende). Sie zählt nur, solange das Dokument noch kein `zeitraumVon` hat —
  // danach schreibt jede Aktion die neuen Felder.
  const von = "zeitraumVon" in d ? gueltigerTag(d.zeitraumVon) : gueltigerTag(d.aktivAb);
  return {
    id,
    name: typeof d.name === "string" && d.name ? d.name : KURSPLAN_STANDARD_NAME,
    aktiv: d.aktiv === true,
    grundplan: d.grundplan === true,
    zeitraumVon: von,
    zeitraumBis: von ? gueltigerTag(d.zeitraumBis) : null,
    nachfolgerId:
      von && gueltigerTag(d.zeitraumBis) && typeof d.nachfolgerId === "string" && d.nachfolgerId ? d.nachfolgerId : null,
    kurse: kurseLesen(d.kurse),
    raeume: raeumeLesen(d.raeume),
    angelegtMs: angelegt?.toMillis?.() ?? 0,
  };
}

/** Feste Reihenfolge der Pläne: nach Anlage, dann nach Name. */
export function plaeneSortieren<T extends Pick<Wochenplan, "angelegtMs" | "name">>(plaene: T[]): T[] {
  return plaene.slice().sort((a, b) => a.angelegtMs - b.angelegtMs || a.name.localeCompare(b.name, "de"));
}

/** Bereinigt einen Plannamen oder liefert den Satz, warum er nicht geht. */
export function plannamePruefen(
  roh: unknown,
  andere: Pick<Wochenplan, "name">[],
): { name: string } | { fehler: string } {
  const name = typeof roh === "string" ? roh.trim().replace(/\s+/g, " ") : "";
  if (!name) return { fehler: "Gib dem Plan einen Namen." };
  if (name.length > PLANNAME_MAX) return { fehler: `Der Name ist zu lang. Bleib unter ${PLANNAME_MAX} Zeichen.` };
  if (andere.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    return { fehler: `Einen Plan „${name}" gibt es schon.` };
  }
  return { name };
}

/** Höchstens so lang dauert ein Zeitraum. */
export const ZEITRAUM_MAX_TAGE = 365;

/** Was das Sheet für einen Zeitraum schickt. `nachfolgerId` null = Grundplan. */
export interface ZeitraumEingabe {
  von: unknown;
  bis: unknown;
  nachfolgerId?: unknown;
}

type PlanFuerPruefung = Pick<Wochenplan, "id" | "name" | "grundplan" | "zeitraumVon" | "zeitraumBis" | "nachfolgerId">;

/**
 * An welchen Tagen welcher Plan Grundplan wird: ein Start ohne Ende (am
 * Beginn) und ein Zeitraum mit Nachfolger (am Tag nach dem Ende).
 */
function grundplanWechsel(p: PlanFuerPruefung, alle: Pick<Wochenplan, "id" | "name">[]): { tag: string; ziel: string }[] {
  const out: { tag: string; ziel: string }[] = [];
  if (p.zeitraumVon && !p.zeitraumBis) out.push({ tag: p.zeitraumVon, ziel: p.name });
  if (p.zeitraumBis && p.nachfolgerId) {
    const n = alle.find((x) => x.id === p.nachfolgerId);
    if (n) out.push({ tag: tagPlus(p.zeitraumBis, 1), ziel: n.name });
  }
  return out;
}

/**
 * Prüft einen Zeitraum samt Nachfolger, bevor er gespeichert wird. Beide
 * Tage leer heißt: kein Zeitraum. Browser und Server rechnen dieselbe
 * Prüfung (Leon 27.09.: „nichts passieren kann das einen fehler im ablauf
 * hervor ruft").
 *
 *   · Der Grundplan bekommt keinen Zeitraum — er gilt ohnehin, wenn keiner
 *     läuft. Ebenso kein Plan, der einem anderen NACHFOLGT: Er soll nach
 *     dessen Ende dauerhaft gelten.
 *   · Beginn ab heute; nur ein schon LAUFENDER Zeitraum behält seinen
 *     Beginn in der Vergangenheit (sein Ende darf man verschieben).
 *   · Ende ab heute, nicht vor dem Beginn, höchstens ein Jahr danach.
 *   · Zwei Zeiträume mit Ende überschneiden sich nie.
 *   · NACHFOLGER (Leon 27.09.: „wenn ich ein enddatum setze soll ein neues
 *     feld auftauchen mit nachfolge plan"): nur mit Ende; nie der Plan
 *     selbst; nur ein Plan OHNE eigenen Zeitraum; null oder der Grundplan
 *     heißt „zurück zum Grundplan".
 *   · An keinem Tag wechselt der Grundplan zweimal (Start ohne Ende oder
 *     Tag nach einem Ende mit Nachfolger) — sonst gäbe es zwei Kandidaten.
 */
export function zeitraumPruefen(
  eingabe: ZeitraumEingabe,
  heute: string,
  plan: Pick<Wochenplan, "id" | "grundplan" | "zeitraumVon"> | null,
  andere: PlanFuerPruefung[],
): { von: string | null; bis: string | null; nachfolgerId: string | null } | { fehler: string } {
  const leer = (x: unknown) => x === null || x === undefined || x === "";
  if (leer(eingabe.von) && leer(eingabe.bis)) return { von: null, bis: null, nachfolgerId: null };
  if (plan?.grundplan) {
    return {
      fehler: "Dein Grundplan gilt immer, wenn kein Zeitraum läuft. Gib den Zeitraum dem Plan, der nur zeitweise gelten soll.",
    };
  }
  const vorgaenger = plan ? andere.find((o) => o.nachfolgerId === plan.id && o.zeitraumBis) : undefined;
  if (vorgaenger) {
    return {
      fehler: `Nach „${vorgaenger.name}“ gilt dieser Plan dauerhaft, deshalb bekommt er keinen eigenen Zeitraum. Wähl dort erst einen anderen Nachfolger.`,
    };
  }
  if (leer(eingabe.von)) return { fehler: "Wähl, ab wann der Plan gilt." };
  const von = gueltigerTag(eingabe.von);
  if (!von) return { fehler: "Wähl den Beginn aus dem Kalender." };
  let bis: string | null = null;
  if (!leer(eingabe.bis)) {
    bis = gueltigerTag(eingabe.bis);
    if (!bis) return { fehler: "Wähl das Ende aus dem Kalender." };
  }
  const laeuftSchon = plan?.zeitraumVon === von && von <= heute;
  if (von < heute && !laeuftSchon) return { fehler: "Wähl einen Beginn ab heute." };
  if (von > tagPlus(heute, 730)) return { fehler: "Wähl einen Beginn in den nächsten zwei Jahren." };
  if (bis !== null) {
    if (bis < von) return { fehler: "Das Ende liegt vor dem Beginn." };
    if (bis < heute) return { fehler: "Das Ende liegt in der Vergangenheit. Wähl ein Ende ab heute." };
    if (tageZwischen(von, bis) > ZEITRAUM_MAX_TAGE) return { fehler: "Ein Zeitraum dauert höchstens ein Jahr." };
  }

  // Nachfolger — nur mit Ende. Der Grundplan als Wahl heißt dasselbe wie keine.
  let nachfolgerId: string | null = null;
  if (bis !== null && !leer(eingabe.nachfolgerId)) {
    const n = andere.find((o) => o.id === eingabe.nachfolgerId);
    if (plan && eingabe.nachfolgerId === plan.id) return { fehler: "Ein Plan folgt nicht auf sich selbst. Wähl einen anderen." };
    if (!n) return { fehler: "Diesen Plan gibt es nicht mehr. Wähl einen anderen Nachfolger." };
    if (!n.grundplan) {
      if (n.zeitraumVon) {
        return { fehler: `„${n.name}“ hat selbst einen Zeitraum. Als Nachfolger passt ein Plan ohne Zeitraum.` };
      }
      nachfolgerId = n.id;
    }
  }

  for (const p of andere) {
    if (bis !== null && p.zeitraumVon && p.zeitraumBis !== null && von <= p.zeitraumBis && p.zeitraumVon <= bis) {
      return {
        fehler: `Vom ${tagText(p.zeitraumVon, heute)} bis ${tagText(p.zeitraumBis, heute)} gilt schon „${p.name}“. Wähl einen Zeitraum davor oder danach.`,
      };
    }
  }
  const alle = [...andere, ...(plan ? [{ id: plan.id, name: "" }] : [])];
  const meine = grundplanWechsel(
    { id: plan?.id ?? "", name: "", grundplan: false, zeitraumVon: von, zeitraumBis: bis, nachfolgerId },
    alle,
  );
  for (const p of andere) {
    for (const w of grundplanWechsel(p, alle)) {
      if (meine.some((m) => m.tag === w.tag)) {
        return { fehler: `Am ${tagText(w.tag, heute)} wird schon „${w.ziel}“ dein Grundplan. Wähl einen anderen Tag.` };
      }
    }
  }
  return { von, bis, nachfolgerId };
}

/** Der Stand eines Plans, wie ihn `planStandRechnen` für heute ableitet. */
export interface PlanStand {
  aktiv: boolean;
  grundplan: boolean;
  zeitraumVon: string | null;
  zeitraumBis: string | null;
  nachfolgerId: string | null;
}

type PlanFuerStand = Pick<
  Wochenplan,
  "id" | "name" | "aktiv" | "grundplan" | "zeitraumVon" | "zeitraumBis" | "nachfolgerId" | "angelegtMs"
>;

/**
 * DER GANZE STAND FÜR HEUTE — eine reine Rechnung aus dem Tag und den Plänen.
 * Nacht-Job, Server-Route, täglicher Abgleich und die Anzeige der Verwaltung
 * rufen sie gleich auf. Sie liefert immer genau einen aktiven Plan und genau
 * einen Grundplan, solange es überhaupt einen Plan gibt.
 *
 *   0. Ein Nachfolger, den es nicht (mehr) gibt oder der der Plan selbst
 *      ist, zählt als „zurück zum Grundplan". Ohne Ende kein Nachfolger.
 *   1. Zeiträume, deren Ende vorbei ist, fallen weg. Hatten sie einen
 *      Nachfolger, wird der am Tag nach dem Ende Grundplan.
 *   2. Ein erreichter Start ohne Ende macht seinen Plan am Beginn zum
 *      Grundplan. Aus 1 und 2 gewinnt der JÜNGSTE Wechsel; alle sind danach
 *      verbraucht.
 *   3. Sonst bleibt der Grundplan. Fehlt er (Altbestand ohne das Feld),
 *      wird es der aktive Plan ohne laufenden Zeitraum, sonst der erste.
 *   4. Aktiv ist der Plan, dessen Zeitraum heute läuft — sonst der
 *      Grundplan.
 */
export function planStandRechnen(
  plaene: PlanFuerStand[],
  heute: string,
): { aktivId: string | null; grundplanId: string | null; stand: Map<string, PlanStand> } {
  const sortiert = plaeneSortieren(plaene);
  const ids = new Set(sortiert.map((p) => p.id));
  const stand = new Map<string, PlanStand>(
    sortiert.map((p) => [
      p.id,
      {
        aktiv: p.aktiv,
        grundplan: p.grundplan,
        zeitraumVon: p.zeitraumVon,
        zeitraumBis: p.zeitraumBis,
        nachfolgerId: p.nachfolgerId,
      },
    ]),
  );
  if (sortiert.length === 0) return { aktivId: null, grundplanId: null, stand };
  const s = (id: string) => stand.get(id)!;
  const laeuft = (x: PlanStand) =>
    x.zeitraumVon !== null && x.zeitraumBis !== null && x.zeitraumVon <= heute && heute <= x.zeitraumBis;

  // 0. Nachfolger nur mit Ende, nur auf einen anderen, vorhandenen Plan
  for (const p of sortiert) {
    const x = s(p.id);
    if (x.nachfolgerId !== null && (x.zeitraumBis === null || x.nachfolgerId === p.id || !ids.has(x.nachfolgerId))) {
      x.nachfolgerId = null;
    }
  }

  // 1. + 2. Wechsel des Grundplans, die heute erreicht sind
  const wechsel: { id: string; tag: string; rang: number }[] = [];
  sortiert.forEach((p, rang) => {
    const x = s(p.id);
    if (x.zeitraumBis !== null && x.zeitraumBis < heute) {
      if (x.nachfolgerId) wechsel.push({ id: x.nachfolgerId, tag: tagPlus(x.zeitraumBis, 1), rang });
      x.zeitraumVon = null;
      x.zeitraumBis = null;
      x.nachfolgerId = null;
    } else if (x.zeitraumVon !== null && x.zeitraumBis === null && x.zeitraumVon <= heute) {
      wechsel.push({ id: p.id, tag: x.zeitraumVon, rang });
      x.zeitraumVon = null;
    }
  });
  const juengster = wechsel.sort((a, b) => b.tag.localeCompare(a.tag) || a.rang - b.rang)[0];
  let grund: PlanFuerStand | null = juengster ? (sortiert.find((p) => p.id === juengster.id) ?? null) : null;

  // 3. Grundplan
  grund ??= sortiert.find((p) => s(p.id).grundplan) ?? null;
  grund ??= sortiert.find((p) => s(p.id).aktiv && !laeuft(s(p.id))) ?? sortiert[0];
  for (const p of sortiert) s(p.id).grundplan = p.id === grund.id;
  Object.assign(s(grund.id), { zeitraumVon: null, zeitraumBis: null, nachfolgerId: null });

  // 4. Aktiv
  const laufend = sortiert
    .filter((p) => p.id !== grund!.id && laeuft(s(p.id)))
    .sort((a, b) => s(b.id).zeitraumVon!.localeCompare(s(a.id).zeitraumVon!));
  const aktivId = laufend[0]?.id ?? grund.id;
  for (const p of sortiert) s(p.id).aktiv = p.id === aktivId;

  return { aktivId, grundplanId: grund.id, stand };
}

/** Läuft der Zeitraum dieses Plans heute? */
export function zeitraumLaeuft(p: Pick<Wochenplan, "zeitraumVon" | "zeitraumBis">, heute: string): boolean {
  return p.zeitraumVon !== null && p.zeitraumBis !== null && p.zeitraumVon <= heute && heute <= p.zeitraumBis;
}
