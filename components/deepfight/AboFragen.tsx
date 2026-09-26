"use client";

/**
 * DIE FRAGEN VOR DEM ABO (24.09.2026).
 *
 * McFit und N26 schließen ihre Preisseiten mit einem Akkordeon. Jede Antwort
 * hier ist eine Tatsache aus dem Code (CLAUDE.md „SCHRITT 3"): 24 Monate ab
 * `abAm`, Jahr = zehn Monatspreise, nur die Verwaltung bucht, Stripe schreibt
 * die Rechnung, Stufenwechsel ab der nächsten Abrechnung. Wer eine Antwort
 * ändert, prüft zuerst, ob der Code sie noch deckt.
 */

import Icon from "@/components/ui/Icon";
import { Collapse } from "@/components/motion";
import { ABO_STUFEN, NACHKAUF } from "@/lib/abo";
import { useState } from "react";

const [team, gym] = ABO_STUFEN;

const FRAGEN: { frage: string; antwort: string }[] = [
  {
    frage: "Was ist eine Analyse?",
    antwort: `Ein Video, ein Athlet. Bis ${team.leistungen.videoMinuten} Minuten im Team-Abo, bis ${gym.leistungen.videoMinuten} Minuten ab Gym. Du bekommst die Fight-DNA, die Lücken und den Gameplan für den nächsten Gegner. Ein Gegnervideo zählt genauso als eine Analyse.`,
  },
  {
    frage: "Was passiert mit Analysen, die ich nicht nutze?",
    antwort:
      "Sie bleiben dir. Jede Analyse gilt 24 Monate ab dem Monat, in dem sie gutgeschrieben wurde. Ruhige Monate sparst du für das Fight Camp auf.",
  },
  {
    frage: "Kann ich monatlich kündigen?",
    antwort:
      "Ja, zum Ende des Monats. Im Jahresabo läuft die Laufzeit ein Jahr, du zahlst zehn statt zwölf Monate, und die Analysen kommen trotzdem Monat für Monat.",
  },
  {
    frage: "Reicht der Monat einmal nicht?",
    antwort: `Dann kaufst du ${NACHKAUF.analysen} Analysen nach. Sie gelten wie alle anderen 24 Monate.`,
  },
  {
    frage: "Kann ich die Stufe wechseln?",
    antwort:
      "Jederzeit unter „Abo verwalten“. Die neue Stufe gilt ab der nächsten Abrechnung, dein Guthaben bleibt.",
  },
  {
    frage: "Wer bucht das Abo?",
    antwort:
      "Die Verwaltung deines Gyms. Trainer sehen die Stufen und nutzen die Analysen, gebucht wird über das Verwaltungskonto.",
  },
  {
    frage: "Wie bezahle ich?",
    antwort:
      "Per Karte über Stripe. Die Rechnung stellt Stripe aus, danach liegt sie hier auf der Seite. Ein Gym im EU-Ausland mit gültiger USt-IdNr. zahlt den Nettopreis.",
  },
];

export default function AboFragen() {
  const [offen, setOffen] = useState<number | null>(0);
  return (
    <div className="abo-fragen" data-abo-fragen>
      {FRAGEN.map((f, i) => {
        const auf = offen === i;
        return (
          <div key={f.frage} className="abo-frage">
            <h3 className="m-0">
              <button
                type="button"
                className="abo-frage__knopf"
                aria-expanded={auf}
                aria-controls={`abo-frage-${i}`}
                onClick={() => setOffen(auf ? null : i)}
              >
                {f.frage}
                <span aria-hidden className="abo-frage__pfeil">
                  <Icon name="chevron-down" size={15} strokeWidth={2.2} />
                </span>
              </button>
            </h3>
            <Collapse open={auf}>
              <p id={`abo-frage-${i}`} className="abo-frage__antwort">
                {f.antwort}
              </p>
            </Collapse>
          </div>
        );
      })}
    </div>
  );
}
