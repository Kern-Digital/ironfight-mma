/**
 * Bereichs-Layout der Plattform-Konsole — es färbt, sonst nichts.
 *
 * Leons Vorgabe 01.09.2026: „alle reinen Admin-Bereiche sollen rot sein …
 * so dass ich gleich sehe, was zu Admin gehört." `/admin/*` ist der einzige
 * Bereich, der GANZFLÄCHIG umgefärbt wird — er ist gym-übergreifend, dort hat
 * eine Gym-Marke nichts verloren. `/verwaltung/*` bleibt dagegen im
 * Gym-Akzent und trägt Bernstein nur als Marke in der Sidebar: Diese Seiten
 * gehören dem Gym, und ihm dort die Farbe zu nehmen, für die es beim
 * Branding-Kit bezahlt hat, wäre verkehrt.
 *
 * DIESE DATEI IST BEWUSST EIN SERVER-BAUSTEIN (kein "use client"): Ein
 * Client-Layout hier würde das `redirect()` in `app/admin/page.tsx`
 * wirkungslos machen — der Guard darüber rendert während des Ladens einen
 * Platzhalter, und die Seite käme nie dran (nachgemessen 2026-09-01, in
 * CLAUDE.md unter „Route-Schutz" notiert). Das Umfärben braucht ohnehin kein
 * JavaScript: `data-area` ist ein reines Attribut, den Rest macht CSS.
 *
 * KEIN GUARD HIER. Der Zugang zu `/admin/*` hängt an `middleware.ts` (404 für
 * alle ohne Plattform-Rang, die Existenz bleibt verborgen) und an den
 * Firestore-Regeln. Ein UI-Guard an dieser Stelle würde daran nichts
 * verbessern und diese Datei zu einem Client-Baustein machen — siehe oben.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div data-area="admin">{children}</div>;
}
