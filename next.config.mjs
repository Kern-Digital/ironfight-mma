/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  /**
   * Umzug des Verwaltungsbereichs (Multi-Gym Phase 2, Checkpoint 3): Die drei
   * Seiten lagen bis dahin unter `/trainer`, folgten aber dem Verwaltungsrecht
   * — Begründung und Zielbild in `lib/verwaltung-routes.ts`.
   *
   * WARUM HIER UND NICHT IN DER MIDDLEWARE ODER IN EINER SEITE:
   * `redirects()` läuft VOR der Middleware und vor jedem Rendern. Beides
   * zählt.
   *   • Vor der Middleware, weil die alten Pfade unter `/trainer` liegen: Das
   *     Trainer-Gate würfe eine reine Verwaltung sonst auf /dashboard, bevor
   *     sie ihr neues Ziel je sähe.
   *   • Vor dem Rendern, weil ein `redirect()` in einer Seite unter einem
   *     Client-Layout NICHT greift (nachgemessen am 01.09.2026: `/verwaltung`
   *     antwortete mit 200 statt umzuleiten — `VerwaltungRoute` rendert
   *     während des Ladens einen Platzhalter, und die Seite darunter kommt
   *     gar nicht erst dran).
   * Zudem gilt diese Weiterleitung auch dann, wenn der Not-Aus
   * `MIDDLEWARE_AUTH=off` gesetzt ist — gerade dann soll eine alte Adresse
   * nicht ins Leere laufen.
   *
   * Verschickte Einladungs-LINKS sind nicht betroffen: die zeigen auf
   * `/beitreten/{code}` und bleiben, wo sie sind.
   */
  async redirects() {
    return [
      // `:pfad*` nimmt spätere Unterseiten gleich mit.
      {
        source: "/trainer/mitglieder/:pfad*",
        destination: "/verwaltung/mitglieder/:pfad*",
        permanent: true,
      },
      {
        source: "/trainer/einladungen/:pfad*",
        destination: "/verwaltung/einladungen/:pfad*",
        permanent: true,
      },
      {
        source: "/trainer/neuigkeiten/:pfad*",
        destination: "/verwaltung/neuigkeiten/:pfad*",
        permanent: true,
      },
      // FRÜHER STAND HIER `/verwaltung` → `/verwaltung/mitglieder`, weil die
      // nackte Bereichs-Adresse keinen eigenen Inhalt hatte. Seit dem
      // 02.09.2026 hat sie einen (`app/verwaltung/page.tsx`), und die Zeile
      // MUSSTE weg: `redirects()` läuft vor jedem Rendern — die neue Seite
      // wäre sonst für niemanden erreichbar gewesen, auch nicht über den
      // klickbaren Gruppentitel der Sidebar.
    ];
  },
};

export default nextConfig;
