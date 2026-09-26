"use client";

/**
 * DIE VERGLEICHSTABELLE UNTER DEN KARTEN (24.09.2026).
 *
 * Das N26-Muster („Konten vergleichen"): Nach den Karten eine Tabelle, in der
 * jede Zeile eine Leistung ist und jede Spalte eine Stufe. Was hier steht,
 * kommt aus `lib/abo.ts` — dieselbe Quelle, aus der Server und Stripe rechnen.
 * Kein Punkt, der nicht greift (Konzept §6: „kommt bald" ist in einer
 * Preistabelle irreführend).
 */

import Icon from "@/components/ui/Icon";
import { ABO_STUFEN, ABO_VORWAHL, euro, type AboIntervall } from "@/lib/abo";

type Wert = string | boolean;

interface Zeile {
  name: string;
  werte: (stufe: (typeof ABO_STUFEN)[number], intervall: AboIntervall) => Wert;
}

const ZEILEN: Zeile[] = [
  {
    name: "Analysen im Monat",
    werte: (s) => String(s.analysenJeMonat),
  },
  {
    name: "Analysen im Jahr",
    werte: (s) => (s.analysenJeMonat * 12).toLocaleString("de-DE"),
  },
  {
    name: "Videolänge",
    werte: (s) => `bis ${s.leistungen.videoMinuten} Minuten`,
  },
  { name: "Fight-DNA für jeden Athleten", werte: () => true },
  { name: "Gegner-Scouting", werte: () => true },
  { name: "Gameplan für den nächsten Gegner", werte: () => true },
  { name: "Dein Logo und deine Farbe in der App", werte: (s) => s.leistungen.branding },
  {
    name: "Nachkauf, 10 Analysen",
    werte: (s) => euro(s.leistungen.nachkaufNetto),
  },
  { name: "Ungenutztes sammelt sich an, 24 Monate", werte: () => true },
  { name: "Monatlich kündbar", werte: (_, i) => (i === "monat" ? true : "Ein Jahr Laufzeit") },
];

function Zelle({ wert }: { wert: Wert }) {
  if (wert === true)
    return (
      <span className="abo-haken" aria-label="enthalten">
        <Icon name="check" size={13} strokeWidth={2.6} />
      </span>
    );
  if (wert === false) return <span className="abo-fehlt" aria-label="nicht enthalten" />;
  return <strong>{wert}</strong>;
}

export default function AboVergleich({ intervall }: { intervall: AboIntervall }) {
  return (
    <div className="abo-vergleich" data-abo-vergleich>
      <table>
        <caption className="sr-only">Die drei Stufen im Vergleich</caption>
        <thead>
          <tr>
            <th scope="col">Leistung</th>
            {ABO_STUFEN.map((s) => (
              <th key={s.id} scope="col" data-empfohlen={s.id === ABO_VORWAHL || undefined}>
                {s.name}
                <small>
                  {euro(s.netto[intervall])} / {intervall === "jahr" ? "Jahr" : "Monat"}
                </small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ZEILEN.map((z) => (
            <tr key={z.name}>
              <th scope="row">{z.name}</th>
              {ABO_STUFEN.map((s) => (
                <td key={s.id} data-empfohlen={s.id === ABO_VORWAHL || undefined}>
                  <Zelle wert={z.werte(s, intervall)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
