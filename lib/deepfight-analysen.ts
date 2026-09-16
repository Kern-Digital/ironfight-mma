/**
 * Alle für mich sichtbaren DeepFight-Analysen — EINMAL je Sitzung geladen.
 *
 * ─── WARUM ES DIESE DATEI GIBT ──────────────────────────────────────────────
 *
 * Analysen liegen verstreut: `users/{uid}/videoAnalyses` für unsere Leute,
 * `opponents/{id}/videoAnalyses` für Gegner. Bis zum 16.09.2026 gab es keinen
 * Leser über alle — ein FÄCHER fragte je Ziel einzeln, rund 38 Abfragen.
 *
 * ─── SEIT ETAPPE 1 DER AUTOMATIK: EINE ABFRAGE + EIN FÄCHER ────────────────
 *
 * Jedes Analyse-Dokument trägt `gymId`, `targetIsStaff` und `mode`. Damit
 * liest `listGymVideoAnalyses` alle GEGNER-Analysen des Gyms mit EINER
 * collectionGroup-Abfrage (Regel mit direktem Feldzugriff, Falle 28;
 * Composite-Index gymId/mode/createdAt in firestore.indexes.json).
 *
 * ─── SEIT ETAPPE 2 (16.09.2026): DEEPFIGHT-FREIGABE FÜR ALLE ───────────────
 *
 * Jeder Athlet entscheidet selbst, welche Trainer seine Analysen sehen — und
 * eine Query kann diese Freigabe nicht prüfen (kein get() aufs Eltern-
 * Dokument). Athleten-Analysen kommen deshalb über einen Fächer je
 * SICHTBARER Person (direkter Pfad, `sichtbareMitglieder`): ich selbst, dazu
 * jeder, der mich namentlich oder über „alle Trainer des Gyms" freigegeben
 * hat. Der Fächer wächst mit den Freigaben, nicht mit dem Gym; bei „alle
 * Trainer" für jeden Athleten ist er so groß wie die Mitgliederliste — einmal
 * je Sitzung, das ist der Preis dafür, dass die Regel serverseitig hält.
 *
 * ─── DIE ENTSCHEIDUNG (Leon 08.09.2026) — gilt weiter ───────────────────────
 *
 * Zwei Stellen wollen dieselben Daten: die Suche über alles auf der Landung
 * und „Meine Analysen". Beide bekommen sie aus EINEM Lauf, und der läuft
 * **genau einmal je Sitzung** — nicht je Tastendruck, nicht je Seitenaufruf.
 * Was zuerst kommt, löst ihn aus; alles danach liest aus dem Speicher.
 *
 * ─── DER CACHE IST BEWUSST EIN MODUL-ZUSTAND ────────────────────────────────
 *
 * Kein React-State, kein Context: Die Landung, die Suche und jede spätere
 * Stelle sollen denselben Lauf teilen, auch über einen Seitenwechsel hinweg.
 * Ein Reload leert ihn (Sitzung zu Ende) — das ist gewollt, denn danach
 * könnten neue Analysen dazugekommen sein.
 *
 * Der Schlüssel trägt Gym UND Betrachter: Nach einem Gym-Wechsel oder einem
 * Kontowechsel im selben Tab wären die alten Daten fremde Daten.
 *
 * GLEICHZEITIGE AUFRUFE TEILEN SICH DEN LAUF: Gecacht wird das PROMISE, nicht
 * erst sein Ergebnis. Mounten Landung und Suche im selben Moment, läuft der
 * Fächer trotzdem nur einmal. Schlägt er fehl, fliegt der Eintrag raus —
 * sonst wäre ein einmaliger Netzfehler für die ganze Sitzung eingefroren.
 */

import { isGhostAccount, type StudentEntry } from "./admin";
import type { Opponent } from "./opponents";
import { darfSehen } from "./profile-sharing";
import {
  listGymVideoAnalyses,
  listVideoAnalyses,
  type VideoAnalysis,
} from "./video-analysis";

/** Wen eine Analyse betrifft — die Landung braucht beides für ihre Wege. */
export interface AnalyseEintrag {
  analyse: VideoAnalysis;
  /** Der Modus des Ziels: „leute" (users/{uid}) oder „gegner" (opponents/{id}). */
  modus: "leute" | "gegner";
  zielId: string;
  zielName: string;
}

const cache = new Map<string, Promise<AnalyseEintrag[]>>();

/**
 * Wer in den Fächer kommt: ich selbst und jeder — Athlet wie Kollege — mit
 * Freigabe im Bereich `deepfight` (namentlich oder über mein Gym); keine
 * Ghost-Konten.
 *
 * DIESE ZEILE IST NICHT KOSMETIK, SIE IST DIE RECHTE-PRÜFUNG: Eine Abfrage
 * auf jemanden ohne Freigabe liefe in `permission-denied` (firestore.rules,
 * `canAccessMemberData`). Sie würde zwar aufgefangen, kostete aber jedes Mal
 * einen abgewiesenen Aufruf — und die Liste soll gar nicht erst fragen, wo sie
 * nicht fragen darf. Wortgleich zur Ziel-Auswahl und zur Athleten-Bibliothek.
 */
export function sichtbareMitglieder(
  members: StudentEntry[],
  eigeneUid: string,
  gymId: string,
): StudentEntry[] {
  return members.filter(
    (s) =>
      s.uid === eigeneUid ||
      (!isGhostAccount(s) && darfSehen(s.profileShares, "deepfight", eigeneUid, gymId)),
  );
}

/**
 * Lädt alles Sichtbare — oder gibt den laufenden bzw. fertigen Lauf zurück.
 *
 * EINE collectionGroup-Abfrage für die Gegner des Gyms, dazu der Fächer über
 * jede sichtbare Person (siehe Kopf). Eine einzelne fehlgeschlagene Abfrage
 * nimmt die Liste NICHT mit: Ein Ziel, das gerade nicht lesbar ist, darf
 * nicht die Analysen aller anderen verschlucken.
 */
export function ladeAlleAnalysen(
  gymId: string,
  eigeneUid: string,
  members: StudentEntry[],
  opponents: Opponent[],
): Promise<AnalyseEintrag[]> {
  const key = `${gymId}:${eigeneUid}`;
  const vorhanden = cache.get(key);
  if (vorhanden) return vorhanden;

  const lauf = (async () => {
    const gegnerName = new Map(opponents.map((o) => [o.id, o.name] as const));
    const leuteName = new Map(members.map((s) => [s.uid, nameVon(s)] as const));
    const eintrag = (analyse: VideoAnalysis): AnalyseEintrag =>
      analyse.mode === "opponent"
        ? {
            analyse,
            modus: "gegner",
            zielId: analyse.targetId,
            zielName: gegnerName.get(analyse.targetId) ?? analyse.targetName,
          }
        : {
            analyse,
            modus: "leute",
            zielId: analyse.targetId,
            zielName: leuteName.get(analyse.targetId) ?? analyse.targetName,
          };

    const abfragen: Promise<AnalyseEintrag[]>[] = [
      // Gegner: eine Abfrage fürs Gym.
      listGymVideoAnalyses(gymId)
        .then((liste) => liste.map(eintrag))
        .catch(() => [] as AnalyseEintrag[]),
      // Athleten und Kollegen: nur die, die mich freigegeben haben — direkter Pfad.
      ...sichtbareMitglieder(members, eigeneUid, gymId).map((s) =>
        listVideoAnalyses("athlete", s.uid)
          .then((liste) => liste.map(eintrag))
          .catch(() => [] as AnalyseEintrag[]),
      ),
    ];
    const alle = (await Promise.all(abfragen)).flat();
    // Ein Stab-Konto mit `targetIsStaff` falsch (Bestand) käme doppelt —
    // die Dokument-ID entscheidet.
    const gesehen = new Set<string>();
    const eindeutig = alle.filter((e) => {
      if (gesehen.has(e.analyse.id)) return false;
      gesehen.add(e.analyse.id);
      return true;
    });
    return eindeutig.sort(
      (a, b) => b.analyse.createdAt.getTime() - a.analyse.createdAt.getTime(),
    );
  })();

  // Ein Fehlschlag darf sich nicht für die ganze Sitzung einbrennen.
  lauf.catch(() => cache.delete(key));
  cache.set(key, lauf);
  return lauf;
}

/** Nur meine eigenen — „Meine Analysen" auf der Landung. */
export function nurMeine(
  liste: AnalyseEintrag[],
  eigeneUid: string,
): AnalyseEintrag[] {
  return liste.filter((e) => e.analyse.createdBy === eigeneUid);
}

/**
 * Die Suche über Analysen: Zielname und Quelle (Dateiname bzw. YouTube-Link).
 *
 * SIE SUCHT ÜBER ALLE SICHTBAREN, NICHT NUR ÜBER MEINE: Wer „Paul" tippt,
 * sucht die Analyse zu Paul — nicht die Frage, wer sie hochgeladen hat. Für
 * „was habe ICH gemacht" gibt es die eigene Liste darunter.
 */
export function sucheAnalysen(
  liste: AnalyseEintrag[],
  begriff: string,
): AnalyseEintrag[] {
  const q = begriff.trim().toLowerCase();
  if (!q) return [];
  return liste.filter(
    (e) =>
      e.zielName.toLowerCase().includes(q) ||
      e.analyse.sourceLabel.toLowerCase().includes(q),
  );
}

/** Der Anzeigename eines Mitglieds — dieselbe Reihenfolge wie überall sonst. */
export function nameVon(s: StudentEntry): string {
  return s.displayName ?? s.authProviderName ?? s.email ?? s.uid;
}
