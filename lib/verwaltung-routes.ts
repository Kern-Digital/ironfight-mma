/**
 * Der Verwaltungsbereich — eine Liste, mehrere Leser.
 *
 * Seit Checkpoint 3 liegt er unter einer EIGENEN Adresse (`/verwaltung`)
 * statt unter `/trainer`. Das ist kein Umbenennen, sondern die Auflösung
 * einer Falle: Solange die Seiten unter `/trainer` lagen, mussten drei
 * Türsteher (Middleware, `components/TrainerRoute`, das `/trainer`-Layout)
 * jeweils eine Ausnahme kennen — und eine reine Verwaltung ohne
 * Trainer-Häkchen kam durch die Middleware, um eine Zehntelsekunde später
 * clientseitig auf `/dashboard` zu fliegen. Getrennte Adressen brauchen keine
 * Ausnahmen: `/trainer` gehört dem Trainer, `/verwaltung` der Verwaltung.
 *
 * Gelesen wird das hier von:
 *   1. `middleware.ts`                  — serverseitiger Navigations-Gate
 *   2. `components/VerwaltungRoute.tsx` — Client-Guard des Bereichs-Layouts
 * Dazu kommen die Firestore-Regeln, die den DATENzugriff erzwingen; die zwei
 * hier sind Navigation, nicht Sicherheit.
 *
 * KEINE React-/Node-Abhängigkeiten hier: middleware.ts läuft auf der Edge.
 */

/** Wurzel des Bereichs. Alles darunter folgt dem Verwaltungsrecht. */
export const VERWALTUNG_ROOT = "/verwaltung";

/** Gehört dieser Pfad zum Verwaltungsbereich? */
export function isVerwaltungPath(pathname: string): boolean {
  return (
    pathname === VERWALTUNG_ROOT || pathname.startsWith(VERWALTUNG_ROOT + "/")
  );
}

/**
 * Die alten Adressen aus Checkpoint 1B/2 — `/trainer/mitglieder`,
 * `/trainer/einladungen`, `/trainer/neuigkeiten` — leiten auf die neuen
 * weiter. Diese Weiterleitung steht in `next.config.mjs` (`redirects()`),
 * NICHT hier und nicht in der Middleware.
 *
 * Der Grund steht dort ausführlich; kurz: `redirects()` läuft vor der
 * Middleware (sonst würfe das Trainer-Gate eine reine Verwaltung auf
 * /dashboard, bevor sie ihr neues Ziel sähe), vor jedem Rendern (ein
 * `redirect()` in einer Seite unter einem Client-Layout greift nicht) und
 * auch bei gesetztem Not-Aus `MIDDLEWARE_AUTH=off`.
 *
 * Verschickte Einladungs-LINKS sind nicht betroffen — die zeigen auf
 * `/beitreten/{code}`.
 */
