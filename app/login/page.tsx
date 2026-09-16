/**
 * Die Anmeldeseite — und zwar als SERVER-Komponente, was für diese App die
 * Ausnahme ist. Der Grund ist genau eine Zeile weiter unten: `cookies()`.
 *
 * DIE BEGRÜSSUNG MUSS IM ERSTEN BYTE STEHEN (Leon 14.09.2026). Wer auf diesem
 * Gerät schon einmal angemeldet war, soll „Schön, dass du wieder da bist"
 * lesen — und zwar sofort, nicht nach einer Sekunde. Ein erster Anlauf hielt
 * den Merker im `localStorage` und tauschte den Text in einem Layout-Effekt;
 * gemessen standen dabei **38 Bilder lang** (rund eine Sekunde) die falschen
 * Worte auf dem Schirm. Das lässt sich mit keinem Effekt-Typ beheben: Der
 * Browser malt das Server-HTML, BEVOR React sich einhängt. Alles, was nur der
 * Client weiß, kommt für den ersten Anblick zu spät.
 *
 * Ein Cookie reist mit der Anfrage. Der Server weiß beim Rendern Bescheid,
 * der richtige Text steht im ausgelieferten HTML, und es funktioniert sogar
 * ohne JavaScript. Das Formular selbst bleibt eine Client-Komponente
 * (`LoginForm.tsx`) — Firebase, Zustand und Weiterleitung ändern sich nicht.
 *
 * Der `cookies()`-Aufruf macht die Route dynamisch. Für eine Anmeldeseite ist
 * das richtig: Sie hat nichts zu cachen.
 */

import { cookies } from "next/headers";
import { Suspense } from "react";
import LoginForm from "./LoginForm";
import { MERKER, waehleBegruessung } from "@/lib/login-begruessung";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const bekannt = cookies().get(MERKER)?.value === "1";
  const begruessung = waehleBegruessung(bekannt);

  /**
   * `useAfterAuthTarget` im Formular liest die Adresszeile über
   * `useSearchParams` — und das verlangt in Next 14 eine Suspense-Grenze,
   * sonst bricht der Build der statisch vorgerenderten Seite. Der Wrapper ist
   * genau dafür da; er hält nichts eigenes.
   */
  return (
    <Suspense fallback={null}>
      <LoginForm begruessung={begruessung} />
    </Suspense>
  );
}
