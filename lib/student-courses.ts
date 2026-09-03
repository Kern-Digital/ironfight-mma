/**
 * Welcher Athlet ist in welchem Kurs — die Datenquelle der Filter über der
 * Athletenliste (Leons Vorgabe 03.09.2026).
 *
 * WARUM ÜBER DIE KURSE UND NICHT ÜBER DAS PROFIL (gemessen am 03.09.2026 an
 * den echten Gym-Daten, 32 Athleten):
 *
 *   athlete.primaryDiscipline   2 von 32 gepflegt
 *   athlete.level               2 von 32 gepflegt
 *   athlete.trainerName         2 von 32 — und Freitext, vom Athleten getippt
 *   Kurs-Abos                  32 von 32, 61 Abos auf 24 Kursen
 *
 * Die Felder, die nichts kosten, sind leer; das Feld mit voller Abdeckung
 * kostet Abfragen. Ein Filter auf einem optionalen Selbstauskunfts-Feld wäre
 * eine Attrappe gewesen.
 *
 * DER KURS TRÄGT DISZIPLIN UND ALTERSGRUPPE SCHON IN SICH (`TrainingBlock` in
 * lib/types.ts: `discipline` + `level`). Aus EINER Quelle entstehen dadurch
 * drei Filter — Kurs, Disziplin, Gruppe —, ohne dass irgendjemand ein Profil
 * ausfüllen muss.
 *
 * MULTI-GYM: Die Auswahlmöglichkeiten werden AUS DEN KURSEN DES GYMS
 * abgeleitet, nie aus einer fest verdrahteten Liste. Ein reines Karate-Gym
 * sieht bei „Disziplin" genau einen Wert — und ein Filter mit einem einzigen
 * Wert blendet sich selbst aus (siehe `filterOptions`). Wenn Phase 3 die
 * Rubriken je Gym frei konfigurierbar macht, trägt derselbe Mechanismus ohne
 * Änderung.
 *
 * KOSTEN, UND WANN SIE ZU HOCH WERDEN: Abos liegen als Unter-Sammlung pro
 * Athlet, also eine Abfrage pro Person. Bei 32 Mitgliedern ist das in
 * Ordnung, bei 300 nicht mehr. Der Umbau ist vorgezeichnet und im Projekt
 * schon zweimal gegangen worden (`fightCamps`, Rückmeldungen): `gymId` an das
 * Abo-Dokument, collectionGroup-Regel, Index — dann EINE Abfrage statt N.
 * Bis dahin lädt die Seite die Abos im HINTERGRUND nach; die Liste wartet nie
 * darauf.
 */

import { collection, getDocs } from "firebase/firestore";
import { getFirestoreDb } from "./firebase";
import { TRAINING_BLOCKS } from "./schedule";
import { DISCIPLINE_LABEL, type TrainingBlock } from "./types";

/** uid → die Kurs-IDs, für die dieser Athlet ein Abo hat. */
export type CourseMemberships = Map<string, Set<string>>;

/**
 * Liest die Kurs-Abos für eine Liste von Athleten.
 *
 * Fehler einzelner Athleten werden verschluckt: Fehlt einem die Leseerlaubnis,
 * soll er in der Liste OHNE Kurse auftauchen — und nicht die Filter für alle
 * anderen mitreißen.
 */
export async function loadCourseMemberships(
  uids: string[],
): Promise<CourseMemberships> {
  const db = getFirestoreDb();
  const paare = await Promise.all(
    uids.map(async (uid): Promise<[string, Set<string>]> => {
      try {
        const snap = await getDocs(collection(db, "users", uid, "subscriptions"));
        // Die Dokument-ID IST die Kurs-ID (siehe lib/demo-seed.ts).
        return [uid, new Set(snap.docs.map((d) => d.id))];
      } catch {
        return [uid, new Set()];
      }
    }),
  );
  return new Map(paare);
}

// ─── Ableitungen für die Filter ─────────────────────────────────────────────

const BLOCK_BY_ID = new Map<string, TrainingBlock>(
  TRAINING_BLOCKS.map((b) => [b.id, b]),
);

export const COURSE_GROUP_LABEL: Record<string, string> = {
  kids: "Kinder",
  teens: "Jugend",
  adult: "Erwachsene",
  advanced: "Fortgeschritten",
  // NICHT „Alle Altersgruppen": Das Feld heißt „Alle Gruppen", und zwei
  // Einträge, die mit demselben Wort beginnen und Verschiedenes meinen,
  // stehen im Panel direkt untereinander (gesehen 03.09.2026).
  mixed: "Gemischt",
};

export type FilterOption = { value: string; label: string };

export interface StudentFilterOptions {
  courses: FilterOption[];
  disciplines: FilterOption[];
  groups: FilterOption[];
}

/**
 * Baut die Auswahllisten — AUSSCHLIESSLICH aus den Kursen, die in diesem Gym
 * tatsächlich belegt sind.
 *
 * Eine Liste mit weniger als zwei Einträgen kommt als LEER zurück: Ein Filter,
 * der nur einen Wert kennt, filtert nichts und kostet trotzdem einen Klick.
 * Genau das ist die Karate-Gym-Regel — dort bleibt „Disziplin" leer und
 * verschwindet, „Kurs" und „Gruppe" bleiben nützlich.
 */
export function filterOptions(
  memberships: CourseMemberships,
): StudentFilterOptions {
  const belegt = new Set<string>();
  memberships.forEach((set) => set.forEach((id) => belegt.add(id)));

  // `Array.from` statt Spread: Das tsconfig-Ziel liegt unter ES2015, dort
  // lässt sich ein Set nicht ausbreiten.
  const blocks = Array.from(belegt)
    .map((id) => BLOCK_BY_ID.get(id))
    .filter((b): b is TrainingBlock => Boolean(b))
    // Nach Wochentag und Startzeit — dieselbe Ordnung wie im Kursplan, damit
    // die Auswahlliste dem entspricht, was der Trainer dort gewohnt ist.
    .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));

  // EIN EINTRAG JE KURSNAME, nicht je Termin (gemessen 03.09.2026): Von den
  // 24 Kursen teilen sich ZEHN einen Titel mit einem anderen — „MMA Teens"
  // steht viermal im Plan (Mi 2×, Fr 2×), „Karate Mixed" zweimal. Als Liste
  // je Termin ergab das vier gleich beschriftete Zeilen, zwischen denen
  // niemand wählen kann (Leons Einwand: „die Listen zeigen die Inhalte
  // doppelt an").
  //
  // Ein Trainer fragt ohnehin nach dem KURS, nicht nach dem Termin — „wer ist
  // in MMA Teens" meint alle vier Slots. Der Wert des Eintrags ist deshalb
  // der Titel; `matchesCourseFilter` löst ihn wieder auf alle Kurs-IDs auf,
  // die ihn tragen. Wer zwei WIRKLICH verschiedene Gruppen trennen will,
  // braucht zwei verschiedene Titel — sonst kann sie auch im Kursplan
  // niemand auseinanderhalten.
  const courses = einmalig(blocks.map((b) => b.title)).map((t) => ({
    value: t,
    label: t,
  }));

  const disciplines = einmalig(
    blocks.flatMap((b) => (b.discipline ? [b.discipline as string] : [])),
  ).map((d) => ({
    value: d,
    label: DISCIPLINE_LABEL[d as keyof typeof DISCIPLINE_LABEL] ?? d,
  }));

  const groups = einmalig(
    blocks.flatMap((b) => (b.level ? [b.level as string] : [])),
  ).map((l) => ({ value: l, label: COURSE_GROUP_LABEL[l] ?? l }));

  return {
    courses: mindestensZwei(courses),
    disciplines: mindestensZwei(disciplines),
    groups: mindestensZwei(groups),
  };
}

function einmalig(werte: string[]): string[] {
  return Array.from(new Set(werte));
}

function mindestensZwei(o: FilterOption[]): FilterOption[] {
  return o.length >= 2 ? o : [];
}

/**
 * Passt ein Athlet auf die gewählten Filter?
 *
 * MEHRFACHAUSWAHL, UND ZWAR MIT ZWEI VERSCHIEDENEN VERKNÜPFUNGEN (Leons
 * Vorgabe 03.09.2026): INNERHALB einer Liste gilt ODER — wer „Karate" und
 * „Kickboxen" wählt, will beide sehen, nicht die Schnittmenge (die wäre bei
 * Disziplinen fast immer leer). ZWISCHEN den Listen gilt UND: „Karate" plus
 * „Kinder" heißt Karate-Kinder. Das ist die übliche Erwartung an
 * Facetten-Filter, und die andere Lesart wäre in beiden Fällen unbrauchbar.
 *
 * Eine leere Liste heißt „alles" — dieselbe Aussage wie die aktive
 * „Alle"-Zeile im Panel, deshalb braucht sie keinen eigenen Wert.
 */
export function matchesCourseFilter(
  uid: string,
  memberships: CourseMemberships,
  f: { courses: string[]; disciplines: string[]; groups: string[] },
): boolean {
  if (!f.courses.length && !f.disciplines.length && !f.groups.length) {
    return true;
  }
  const ids = memberships.get(uid);
  if (!ids || ids.size === 0) return false;

  const blocks = Array.from(ids)
    .map((id) => BLOCK_BY_ID.get(id))
    .filter((b): b is TrainingBlock => Boolean(b));

  // Kurse kommen als TITEL herein (siehe `filterOptions`) — ein Titel kann
  // mehrere Termine haben.
  if (
    f.courses.length &&
    !blocks.some((b) => f.courses.includes(b.title))
  ) {
    return false;
  }
  if (
    f.disciplines.length &&
    !blocks.some((b) => b.discipline && f.disciplines.includes(b.discipline))
  ) {
    return false;
  }
  if (
    f.groups.length &&
    !blocks.some((b) => b.level && f.groups.includes(b.level))
  ) {
    return false;
  }
  return true;
}
