"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/**
 * DIE WURZEL IST KEINE SEITE MEHR, SONDERN EINE WEICHE
 * (Leons Entscheidung 14.09.2026).
 *
 * Hier standen 806 Zeilen Werbeseite: Hero mit „Train Hard. Fight Smart.",
 * Disziplinen-Raster, Feature-Karten, Zahlen-Streifen, CTA-Abschnitt — und
 * darunter eine ZWEITE Fassung für Eingeloggte. Eine Datei mit zwei Jobs.
 *
 * WARUM SIE WEG IST: Die Werbeseite hat ein eigenes Zuhause. Sie ist ein
 * eigenständiges Next-Projekt (`../Tidal-Athletics-Landing`, angelegt am
 * 11.05.2026) und läuft später auf der eigenen Adresse — die Anwendung
 * bekommt eine Subdomain. Eine App, die man nur mit Konto benutzt, braucht
 * keine Startseite, die für sich wirbt: Wer hier ankommt, will entweder
 * hinein oder ist schon drin.
 *
 * BEIDE RICHTUNGEN, NICHT NUR EINE: Ein Eingeloggter darf NICHT auf der
 * Anmeldeseite landen — er wäre dort sofort wieder weitergeworfen. Deshalb
 * führt die Weiche nach OBEN ins Dashboard und nach UNTEN zur Anmeldung.
 *
 * IM NORMALFALL KOMMT HIER NIEMAND AN. `middleware.ts` entscheidet dasselbe
 * schon auf dem Server, bevor auch nur ein Byte gerendert wird — sonst
 * blitzte für einen Moment die Navigationsleiste samt „Training/Lernen/
 * Profil" auf, bevor die Seite wegspringt. Diese Datei ist der Rückfall für
 * den einen Fall, in dem die Middleware NICHT läuft: den Not-Aus
 * `MIDDLEWARE_AUTH=off`. Next braucht für `/` ohnehin eine Route, sonst
 * antwortet die Wurzel mit 404.
 */
export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/dashboard" : "/login");
  }, [loading, user, router]);

  // Bewusst leer: Was hier stünde, sähe man nur für den Bruchteil einer
  // Sekunde, und ein Platzhalter-Gerüst für eine Seite, die es nicht gibt,
  // wäre eine Behauptung. Die Höhe hält den Sprung der Seitenhöhe klein.
  return <div className="min-h-screen" aria-hidden />;
}
