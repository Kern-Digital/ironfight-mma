/**
 * Die Verwaltungs-Seiten (Multi-Gym Phase 2, Checkpoint 2) — eine Liste,
 * drei Leser.
 *
 * Sie liegen unter `/trainer`, gehören aber NICHT dem Trainer: Sie folgen dem
 * Verwaltungsrecht. Deshalb muss dieselbe Liste an drei Stellen bekannt sein,
 * und genau darum steht sie hier und nicht dreimal:
 *   1. `middleware.ts`            — der serverseitige Navigations-Gate
 *   2. `components/TrainerRoute`  — der Client-Guard des /trainer-Layouts
 *   3. `app/trainer/layout.tsx`   — blendet die Trainer-Bereichsnavigation aus
 * Dazu kommen die Firestore-Regeln, die den Datenzugriff erzwingen; die drei
 * hier sind Navigation, nicht Sicherheit.
 *
 * Warum die Seiten nicht einfach unter `/verwaltung` liegen: `/trainer/
 * einladungen` existiert seit Checkpoint 1B und ist bereits verlinkt und
 * verschickt worden. Ein Umzug wäre ein eigener Vorgang mit Weiterleitungen —
 * er gehört in Checkpoint 3, wenn die Rollen ohnehin umgestellt werden.
 *
 * KEINE React-/Node-Abhängigkeiten hier: middleware.ts läuft auf der Edge.
 */

export const VERWALTUNG_PREFIXES = [
  "/trainer/mitglieder",
  "/trainer/einladungen",
  "/trainer/neuigkeiten",
] as const;

/** Gehört dieser Pfad zum Verwaltungsbereich? */
export function isVerwaltungPath(pathname: string): boolean {
  return VERWALTUNG_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}
