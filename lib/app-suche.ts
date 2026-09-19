/**
 * DIE APP-WEITE SUCHE (Leon 19.09.2026): „ein permanentes Suchsymbol, das
 * aber — soweit die Berechtigung des Benutzers langt — immer app-weit sucht
 * und nicht auf die aktuell angezeigte Seite begrenzt ist."
 *
 * ─── WIE DIE BERECHTIGUNG HÄLT ──────────────────────────────────────────────
 *
 * Diese Datei erfindet keine Abfrage. Jede Quelle ist eine Liste, die die App
 * dieser Rolle ohnehin zeigt, geholt mit demselben Leser wie auf ihrer Seite:
 * Athleten wie `/trainer/athleten` (`listAllStudents`), Wettkämpfe wie der
 * Wettkampfbereich (`listAllFightCamps` mit derselben Freigabe-Regel für
 * Kollegen), Analysen über denselben Fächer wie die DeepFight-Landung
 * (`ladeAlleAnalysen`, fragt gesperrte Ziele gar nicht erst ab). Was eine
 * Rolle nicht lesen darf, fragt die Suche nicht an — und selbst wenn, wiesen
 * die Firestore-Regeln es ab. Eine abgewiesene Quelle ist kein Fehler: Sie
 * fällt still auf „nichts" zurück, die anderen Gruppen bleiben stehen.
 *
 * ─── WIE SIE LÄDT ───────────────────────────────────────────────────────────
 *
 * Firestore kennt keine Volltextsuche. Also lädt jede Quelle beim ERSTEN
 * Öffnen der Suche einmal ihre Liste, und gesucht wird danach im Speicher —
 * ein Tastendruck kostet keine Abfrage (dasselbe Prinzip wie die
 * DeepFight-Suche, 08.09.2026). Der Speicher gilt fünf Minuten je Konto; wer
 * danach wieder sucht, bekommt einen frischen Stand (ein eben angelegter
 * Gegner soll nicht bis zum Neuladen fehlen). Seiten, Techniken und Kurse
 * stehen im Code und kosten gar nichts.
 */

import { listAllFightCamps, listFightCamps, type FightCamp } from "./fight-camp";
import {
  isGhostAccount,
  isStaffEntry,
  listAllMembers,
  listAllStudents,
  type StudentEntry,
} from "./admin";
import { ladeAlleAnalysen, nameVon } from "./deepfight-analysen";
import { listOpponentsForGym, listOpponentsSharedWith, type Opponent } from "./opponents";
import { darfSehen } from "./profile-sharing";
import type { RoleSet } from "./roles";
import { SHELL_ACCOUNT_ITEMS, shellNavGroups } from "./shell-nav";
import { TRAINING_BLOCKS, WEEKDAY_SHORT } from "./schedule";
import { ALL_TECHNIQUES, CATEGORY_LABEL } from "./techniques";
import {
  listPersonalWorkoutPlans,
  listSharedTrainerPlans,
  listTrainerWorkoutPlans,
  listWorkoutPlansForGym,
} from "./workout-plans";

/** Die Gruppen, in dieser Reihenfolge angezeigt. */
export type SuchGruppe =
  | "seiten"
  | "athleten"
  | "gegner"
  | "wettkaempfe"
  | "analysen"
  | "plaene"
  | "techniken"
  | "kurse";

export const SUCH_GRUPPEN: { id: SuchGruppe; titel: string }[] = [
  { id: "seiten", titel: "Seiten" },
  { id: "athleten", titel: "Athleten" },
  { id: "gegner", titel: "Gegner" },
  { id: "wettkaempfe", titel: "Wettkämpfe" },
  { id: "analysen", titel: "Analysen" },
  { id: "plaene", titel: "Workout-Pläne" },
  { id: "techniken", titel: "Techniken" },
  { id: "kurse", titel: "Kurse" },
];

export interface SuchTreffer {
  /** Eindeutig innerhalb der Gruppe. */
  id: string;
  gruppe: SuchGruppe;
  titel: string;
  /** Zweite Zeile — wo, wann, zu wem. */
  zusatz: string;
  href: string;
  /** Weitere Wörter, die treffen sollen (z. B. Kategorie, Dateiname). */
  auch?: string;
}

/**
 * Für den Vergleich: klein, nur Buchstaben und Ziffern, Leerzeichen
 * zusammengezogen — damit „double leg" das „Double-Leg Takedown" findet
 * (Falle 32) und „Käfig" mit und ohne Umlaut tippt, wie es dasteht. Zeichen
 * ausgeschrieben statt `\p{L}`: Das tsconfig dieser App hat kein `target`
 * (Falle 31).
 */
export function schlicht(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/g, " ")
    .trim();
}

/**
 * Wie gut passt ein Treffer? 3 = der Titel beginnt mit der Eingabe,
 * 2 = ein Wort im Titel beginnt damit, 1 = sie steckt irgendwo im Titel oder
 * im Zusatz, 0 = kein Treffer. Mehrere Wörter müssen ALLE vorkommen.
 */
export function passt(t: SuchTreffer, eingabe: string): number {
  const q = schlicht(eingabe);
  if (!q) return 0;
  const titel = schlicht(t.titel);
  const rest = schlicht(`${t.zusatz} ${t.auch ?? ""}`);
  const woerter = q.split(" ");
  if (!woerter.every((w) => titel.includes(w) || rest.includes(w))) return 0;
  if (titel.startsWith(q)) return 3;
  if (` ${titel}`.includes(` ${woerter[0]}`)) return 2;
  return 1;
}

/** Die Treffer einer Gruppe, bester zuerst, bei Gleichstand nach Titel. */
export function sucheIn(liste: SuchTreffer[], eingabe: string): SuchTreffer[] {
  return liste
    .map((t) => ({ t, p: passt(t, eingabe) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p || a.t.titel.localeCompare(b.t.titel, "de"))
    .map((x) => x.t);
}

// ─── Quellen ─────────────────────────────────────────────────────────────────

function datum(d: Date): string {
  return d.toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" });
}

/** Alle Seiten, die das Menü dieser Rolle zeigt — dieselbe Quelle wie die Sidebar. */
export function seitenTreffer(rights: RoleSet): SuchTreffer[] {
  const raus: SuchTreffer[] = [];
  const gesehen = new Set<string>();
  const dazu = (href: string, titel: string, zusatz: string) => {
    if (gesehen.has(href)) return;
    gesehen.add(href);
    raus.push({ id: href, gruppe: "seiten", titel, zusatz, href });
  };
  for (const g of shellNavGroups(rights)) {
    const bereich = g.label ?? "Mein Bereich";
    if (g.href) dazu(g.href, `${bereich} · Übersicht`, bereich);
    for (const item of g.items) {
      dazu(item.href, item.label, bereich);
      for (const c of item.children ?? []) dazu(c.href, c.label, `${bereich} · ${item.label}`);
    }
  }
  for (const item of SHELL_ACCOUNT_ITEMS) dazu(item.href, item.label, "Konto");
  return raus;
}

export function technikTreffer(): SuchTreffer[] {
  return ALL_TECHNIQUES.map((t) => ({
    id: t.id,
    gruppe: "techniken" as const,
    titel: t.name,
    zusatz: CATEGORY_LABEL[t.category],
    href: `/techniques/${t.id}`,
  }));
}

export function kursTreffer(): SuchTreffer[] {
  return TRAINING_BLOCKS.map((b) => ({
    id: b.id,
    gruppe: "kurse" as const,
    titel: b.title,
    zusatz: `${WEEKDAY_SHORT[b.weekday]} · ${b.startTime}–${b.endTime}`,
    href: "/schedule",
  }));
}

export interface SuchKonto {
  uid: string;
  gymId: string;
  rights: RoleSet;
}

/**
 * Die Quellen, die geladen werden müssen — je nach Rolle. Jede liefert ihre
 * Treffer für GENAU EINE Gruppe; die Suche wartet auf keine davon, sondern
 * zeigt jede Gruppe, sobald sie da ist.
 */
function ladeQuellen(k: SuchKonto): Partial<Record<SuchGruppe, Promise<SuchTreffer[]>>> {
  const still = <T,>(p: Promise<T[]>): Promise<T[]> => p.catch(() => [] as T[]);
  const trainer = k.rights.trainer || k.rights.admin;

  // Pläne: die des Gyms (alle), die eigenen, und je nach Rolle die der
  // Trainer — alle (Trainer) oder die für mich freigegebenen (Athlet).
  const plaene: Promise<SuchTreffer[]> = Promise.all([
    still(listWorkoutPlansForGym(k.gymId)).then((l) =>
      l.map((p) => ({ id: `gym:${p.id}`, gruppe: "plaene" as const, titel: p.name, zusatz: "Plan des Gyms", href: `/workout/plans/${p.id}` })),
    ),
    still(listPersonalWorkoutPlans(k.uid)).then((l) =>
      l.map((p) => ({ id: `eigen:${p.id}`, gruppe: "plaene" as const, titel: p.name, zusatz: "Dein eigener Plan", href: `/workout/eigene/${p.id}` })),
    ),
    trainer
      ? still(listTrainerWorkoutPlans(k.gymId)).then((l) =>
          l.map((p) => ({ id: `trainer:${p.id}`, gruppe: "plaene" as const, titel: p.name, zusatz: "Trainer-Plan", href: `/trainer/plans/${p.id}` })),
        )
      : still(listSharedTrainerPlans(k.gymId, k.uid)).then((l) =>
          l.map((p) => ({ id: `fuer-mich:${p.id}`, gruppe: "plaene" as const, titel: p.name, zusatz: "Von deinem Trainer", href: "/workout/generator" })),
        ),
  ]).then((teile) => teile.flat());

  if (!trainer) {
    // ATHLET: nur Eigenes und für ihn Freigegebenes. Wer dazu das Häkchen
    // VERWALTUNG trägt, findet die Mitglieder — sie führen auf die
    // Mitgliederliste (eine Seite je Mitglied hat die Verwaltung nicht).
    const mitgliederDerVerwaltung = k.rights.verwaltung
      ? still(listAllMembers(k.gymId)).then((l) =>
          l
            .filter((s) => !isGhostAccount(s))
            .map((s) => ({
              id: s.uid,
              gruppe: "athleten" as const,
              titel: nameVon(s),
              zusatz: "Mitglied · Verwaltung",
              href: "/verwaltung/mitglieder",
              auch: s.email ?? "",
            })),
        )
      : undefined;
    return {
      ...(mitgliederDerVerwaltung ? { athleten: mitgliederDerVerwaltung } : {}),
      plaene,
      wettkaempfe: still(listFightCamps(k.uid)).then((l) =>
        l
          .filter((c) => c.status !== "archived")
          .map((c) => ({
            id: c.id,
            gruppe: "wettkaempfe" as const,
            titel: c.competitionName,
            zusatz: `Dein Kampf · ${datum(c.competitionDate)}`,
            // Der Athlet liest seinen Wettkampf im Sheet der Dashboard-Karte.
            href: "/dashboard",
          })),
      ),
      gegner: still(listOpponentsSharedWith(k.uid)).then((l) =>
        l.map((o) => ({ id: o.id, gruppe: "gegner" as const, titel: o.name, zusatz: "Gegnerprofil für dich", href: `/deepfight/opponents/${o.id}` })),
      ),
    };
  }

  // TRAINER / ADMIN: die Listen des Trainerbereichs.
  const mitglieder = still(listAllMembers(k.gymId));
  const gegnerListe = still(listOpponentsForGym(k.gymId));

  const athleten = still(listAllStudents(k.gymId)).then((l) =>
    l
      .filter((s) => !isGhostAccount(s))
      .map((s) => ({
        id: s.uid,
        gruppe: "athleten" as const,
        titel: nameVon(s),
        zusatz: "Athletenprofil",
        href: `/trainer/athleten/${s.uid}`,
        auch: s.email ?? "",
      })),
  );

  const gegner = gegnerListe.then((l) =>
    l.map((o: Opponent) => ({
      id: o.id,
      gruppe: "gegner" as const,
      titel: o.name,
      zusatz: "DeepFight-Profil",
      href: `/trainer/deepfight/gegner/${o.id}`,
    })),
  );

  const wettkaempfe = mitglieder.then(async (m) => {
    const name = new Map(m.map((s) => [s.uid, nameVon(s)] as const));
    // Dieselbe Regel wie der Wettkampfbereich: Kollegen nur mit Freigabe
    // `wettkampf` (lib/fight-camp.ts, `CampZugriff`).
    const freigegebeneUids = m
      .filter((s) => s.uid !== k.uid && isStaffEntry(s) && darfSehen(s.profileShares, "wettkampf", k.uid, k.gymId))
      .map((s) => s.uid);
    const camps: FightCamp[] = await listAllFightCamps(k.gymId, { eigeneUid: k.uid, freigegebeneUids }).catch(() => []);
    return camps
      .filter((c) => c.status !== "archived")
      .map((c) => ({
        id: `${c.studentUid}/${c.id}`,
        gruppe: "wettkaempfe" as const,
        titel: c.competitionName,
        zusatz: `${name.get(c.studentUid) ?? "Athlet"} gegen ${c.opponent.name} · ${datum(c.competitionDate)}`,
        href: `/trainer/competitions/${c.studentUid}/${c.id}`,
        auch: c.opponent.name,
      }));
  });

  const analysen = Promise.all([mitglieder, gegnerListe]).then(([m, o]) =>
    ladeAlleAnalysen(k.gymId, k.uid, m as StudentEntry[], o as Opponent[])
      .catch(() => [])
      .then((l) =>
        l.map((e) => ({
          id: `${e.modus}:${e.zielId}:${e.analyse.id}`,
          gruppe: "analysen" as const,
          titel: e.zielName,
          zusatz: `${e.analyse.sourceLabel} · ${datum(e.analyse.createdAt)}`,
          href: `/trainer/deepfight/analyse?modus=${e.modus}&ziel=${e.zielId}&analyse=${e.analyse.id}`,
          auch: e.analyse.sourceLabel,
        })),
      ),
  );

  return { athleten, gegner, wettkaempfe, analysen, plaene };
}

// ─── Speicher je Konto ───────────────────────────────────────────────────────

const HALTBAR_MS = 5 * 60_000;
const speicher = new Map<string, { seit: number; quellen: Partial<Record<SuchGruppe, Promise<SuchTreffer[]>>> }>();

/**
 * Die geladenen Quellen dieses Kontos — oder frisch, wenn keine da sind oder
 * sie älter als fünf Minuten sind. Der Schlüssel trägt die Rechte mit: Wer
 * während der Sitzung ein Recht bekommt oder verliert, bekommt andere Quellen.
 */
export function suchQuellen(k: SuchKonto): Partial<Record<SuchGruppe, Promise<SuchTreffer[]>>> {
  const schluessel = `${k.gymId}:${k.uid}:${k.rights.trainer ? 1 : 0}${k.rights.verwaltung ? 1 : 0}${k.rights.admin ? 1 : 0}`;
  const da = speicher.get(schluessel);
  if (da && Date.now() - da.seit < HALTBAR_MS) return da.quellen;
  const quellen = ladeQuellen(k);
  speicher.set(schluessel, { seit: Date.now(), quellen });
  return quellen;
}
