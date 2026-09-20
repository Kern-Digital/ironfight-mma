/**
 * Kurs-Freigaben der Trainer-Pläne für MICH nachführen — Client-Seite von
 * /api/workout-plans/sync-access (Begründung im Kopf der Route).
 *
 * Gerufen wird es vor dem Laden der „Vom Trainer"-Pläne (Workout-Übersicht,
 * Disziplin-Seite, Plan-Seite) und nach dem Buchen/Abbestellen eines Kurses.
 * Damit das Öffnen des Workout-Bereichs nicht bei jedem Seitenwechsel einen
 * Server-Aufruf kostet, läuft es höchstens alle FÜNF MINUTEN je Konto —
 * außer mit `force` (Kurs gerade gebucht/abbestellt).
 *
 * Es wirft NIE und wartet höchstens 2,5 s: Fällt die Route aus, sieht der
 * Athlet die Pläne, die er schon hat — die Seite darf daran nicht hängen.
 */

import { getFirebaseAuth } from "./firebase";

const PAUSE_MS = 5 * 60 * 1000;
const WARTEN_MS = 2500;

let letzter: { uid: string; at: number; lauf: Promise<void> } | null = null;

export function syncMyPlanAccess(options: { force?: boolean } = {}): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return Promise.resolve();
  if (
    !options.force &&
    letzter &&
    letzter.uid === user.uid &&
    Date.now() - letzter.at < PAUSE_MS
  ) {
    return letzter.lauf;
  }

  const lauf = (async () => {
    try {
      const token = await user.getIdToken();
      await fetch("/api/workout-plans/sync-access", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
    } catch {
      // bewusst still — siehe Kopf
    }
  })();
  const begrenzt = Promise.race([
    lauf,
    new Promise<void>((fertig) => setTimeout(fertig, WARTEN_MS)),
  ]);
  letzter = { uid: user.uid, at: Date.now(), lauf: begrenzt };
  return begrenzt;
}
