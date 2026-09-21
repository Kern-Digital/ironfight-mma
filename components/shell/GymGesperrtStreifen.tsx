"use client";

/**
 * Der Streifen eines stillgelegten Gyms — auf jeder Seite, in beiden Hüllen
 * (Schritt 1 des Geschäftsplans, 21.09.2026; Leon: „lesen ja, ändern nein").
 *
 * Er liest den Zustand über `getGymInfo` (fünf Minuten gecacht, ein
 * Lesevorgang) und zeigt sonst nichts. Ehrlich und nicht bedrohlich: Die
 * Daten bleiben sichtbar, der Satz sagt, was geht und was nicht, und an wen
 * man sich wendet.
 *
 * SEIT DEM 21.09.2026 ZWEI SÄTZE: Ein stillgelegtes Gym mit gekauftem
 * Restguthaben darf es aufbrauchen (Leon: „Sie dürfen sie aufbrauchen") —
 * dann steht die Zahl im Streifen. Ohne bezahlten Rest ist DeepFight zu.
 * Beides trifft NUR DeepFight; Kursplan, Mitglieder und Pläne laufen weiter. Die Farbe ist nicht das einzige Signal — der Text steht
 * in der normalen Textfarbe, die Warnfarbe trägt nur Rand und Fläche
 * (--warning als Schrift fällt im Hellen unter AA, gemessen 14.09.).
 */

import { useAuth } from "@/lib/auth-context";
import { getGuthabenStand } from "@/lib/guthaben";
import {
  GYM_GESPERRT_MIT_GUTHABEN,
  GYM_GESPERRT_TEXT,
  getGymInfo,
  resolveGymId,
} from "@/lib/gym";
import { useEffect, useState } from "react";

export default function GymGesperrtStreifen({ style }: { style?: React.CSSProperties }) {
  const { profile } = useAuth();
  const gymId = resolveGymId(profile);
  // null = nicht stillgelegt (oder noch nicht geladen); sonst der bezahlte
  // Rest, den das Gym trotzdem noch aufbrauchen darf.
  const [bezahltRest, setBezahltRest] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    getGymInfo(gymId).then(async (info) => {
      if (!alive) return;
      if (info.status !== "blocked") {
        setBezahltRest(null);
        return;
      }
      // Das Guthaben wird NUR im Sonderfall gelesen. Ein Athlet darf es gar
      // nicht lesen (die Regel gibt es nur Trainer und Verwaltung) — dann
      // bleibt es bei 0, und er liest den schlichten Satz. Richtig so: Er
      // startet ohnehin keine Analyse.
      const stand = await getGuthabenStand(gymId).catch(() => null);
      if (alive) setBezahltRest(stand?.restBezahlt ?? 0);
    });
    return () => {
      alive = false;
    };
  }, [gymId]);

  if (bezahltRest === null) return null;
  return (
    <div
      role="status"
      data-gym-gesperrt
      className="rounded-field px-4 py-3"
      style={{
        font: "var(--type-sub)",
        color: "var(--text)",
        border: "1px solid color-mix(in oklab, var(--warning) 45%, transparent)",
        background: "color-mix(in oklab, var(--warning) 12%, transparent)",
        ...style,
      }}
    >
      <strong style={{ fontWeight: 600 }}>Dein Gym ist stillgelegt.</strong>{" "}
      {(bezahltRest > 0 ? GYM_GESPERRT_MIT_GUTHABEN(bezahltRest) : GYM_GESPERRT_TEXT).replace(
        /^Dein Gym ist stillgelegt\.\s*/,
        "",
      )}
    </div>
  );
}
