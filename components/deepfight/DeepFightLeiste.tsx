"use client";

/**
 * Die Glas-Leiste des DeepFight-Bereichs: Wortmarke links, rechts das Wort,
 * wo man gerade steht.
 *
 * ─── DIE SEGMENTE SIND WEG (Leons Neugestaltung 08.09.2026) ─────────────────
 *
 * Bis dahin trug sie drei Segmente — Analysieren · Gegner · Athleten. Leon
 * hat beim Entwurf der neuen Landung selbst gefragt: „macht das im Endeffekt
 * das gleiche?" Ja: Der Weg „Analyse starten → Eigene Athleten / Gegner"
 * führt auf dieselben zwei Seiten wie die Segmente. **Diese Auswahlseiten SIND
 * jetzt die Bibliotheken** — zwei Wege zum selben Ort nebeneinander sind einer
 * zu viel, und der obere sagte nicht, wofür man dort hingeht.
 *
 * Was bleibt, ist die Aufgabe, die die Leiste seit Teilschritt 3 hat: **Sie
 * IST der Kopf des Bereichs.** Die Seiten darunter tragen keinen `PageHead`
 * (Leons Entscheidung 07.09.), also muss hier stehen, wo man ist — sonst
 * beginnt die Gegner-Bibliothek mit einer Werkzeugzeile und sonst nichts.
 *
 * DIE WORTMARKE IST DER WEG ZURÜCK. Ein eigener „Zurück"-Knopf wäre ein
 * viertes Element für etwas, das die Marke ohnehin kann; auf jeder anderen
 * Seite der App führt das Zeichen oben links nach Hause. Auf der Landung ist
 * sie kein Link (man ist schon da) — ein Link auf die eigene Seite ist eine
 * Sackgasse mit Zeigefinger.
 *
 * SIE STEHT AUF GLAS, NICHT AUF DEM HINTERGRUND: Die Regel des Bereichs
 * (globals.css, „Der DeepFight-Bereich") verlangt, dass Text immer auf einer
 * Karte sitzt — die bewegte Schicht dahinter hat keine Farbe, gegen die sich
 * ein Kontrast messen ließe. Deshalb `.t-card`, das im Bereich zu Glas wird.
 *
 * Die Wortmarke ist hier kein `<h1>`: Jede Seite bringt ihre eigene
 * (`sr-only`) Überschrift mit, und zwei Hauptüberschriften ordnen nichts.
 */

import DeepFightWordmark from "@/components/DeepFightWordmark";
import Icon from "@/components/ui/Icon";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ORT_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

/**
 * Wo stehe ich? `null` heißt „auf der Landung" — dort sagt die Wortmarke
 * schon alles, und ein zweites Wort daneben wäre eine Beschriftung ohne
 * Gegenstück.
 */
function ortVon(pathname: string): string | null {
  if (pathname.startsWith("/trainer/deepfight/gegner")) return "Gegner";
  if (pathname.startsWith("/trainer/deepfight/athleten")) return "Athleten";
  if (pathname.startsWith("/trainer/deepfight/analyse")) return "Neue Analyse";
  return null;
}

export default function DeepFightLeiste() {
  const pathname = usePathname();
  const ort = ortVon(pathname);
  const aufLandung = ort === null;

  const marke = (
    <span
      className="flex min-h-hit items-center"
      style={{ font: "var(--type-h3)", color: "var(--text-1)" }}
    >
      <DeepFightWordmark />
    </span>
  );

  // SIE IST NUR NOCH SO BREIT WIE IHR INHALT. Solange drei Segmente rechts
  // standen, füllte die Leiste die Spalte sinnvoll aus; ohne sie war es eine
  // bildschirmbreite, fast leere Pille — im Screenshot sofort zu sehen, in
  // keiner Messung. `max-w-full` hält sie auf 390 px im Rahmen, wenn die
  // Ortsangabe dazukommt.
  return (
    <div className="t-card flex w-fit max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-pill px-3 py-1.5 sm:px-4">
      {aufLandung ? (
        marke
      ) : (
        <Link
          href="/trainer/deepfight"
          data-press
          className="t-interactive -mx-2 flex items-center rounded-pill px-2"
          style={{ color: "var(--text-1)", textDecoration: "none" }}
          aria-label="Zurück zur DeepFight-Landung"
        >
          {marke}
        </Link>
      )}

      {ort && (
        <>
          <span aria-hidden style={{ color: "var(--text-2)", lineHeight: 0 }}>
            <Icon name="chevron-down" size={14} strokeWidth={2.2} className="-rotate-90" />
          </span>
          <span style={{ ...ORT_FONT, color: "var(--text-2)" }}>{ort}</span>
        </>
      )}
    </div>
  );
}
