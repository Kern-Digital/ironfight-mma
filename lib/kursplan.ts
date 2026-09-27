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
 *     { name, aktiv: true, kurse: TrainingBlock[], geaendertAm, geaendertVon }
 *
 * ─── WARUM EIN DOKUMENT MIT EINER LISTE ─────────────────────────────────────
 *
 * Jede Seite braucht die GANZE Woche — Kursplan, Kopfbalken („Jetzt: …"),
 * Dashboard, Filter. Eine Liste in einem Dokument ist EIN Lesevorgang; eine
 * Unter-Sammlung wären 24. Eine Woche mit 60 Kursen wiegt ein paar Kilobyte,
 * das Dokument fasst ein Mebibyte.
 *
 * ─── WARUM SCHON „schedulePlans" (MEHRZAHL) ─────────────────────────────────
 *
 * Konzept §7: mehrere benannte Wochenpläne („Sommerferien"), genau einer
 * aktiv. Leon hat das am 20.09. auf später gelegt — die Oberfläche dafür
 * kommt nicht jetzt. Die DATEN stehen aber schon so, dass ein zweiter Plan
 * nur dazukommt: Gelesen wird immer der Plan mit `aktiv == true`.
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
