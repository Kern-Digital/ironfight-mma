"use client";

/**
 * Der Streifen eines stillgelegten Gyms — auf jeder Seite, in beiden Hüllen
 * (Schritt 1 des Geschäftsplans, 21.09.2026; Leon: „lesen ja, ändern nein").
 *
 * Er liest den Zustand über `getGymInfo` (fünf Minuten gecacht, ein
 * Lesevorgang) und zeigt sonst nichts. Ehrlich und nicht bedrohlich: Die
 * Daten bleiben sichtbar, der Satz sagt, was geht und was nicht, und an wen
 * man sich wendet. Die Farbe ist nicht das einzige Signal — der Text steht
 * in der normalen Textfarbe, die Warnfarbe trägt nur Rand und Fläche
 * (--warning als Schrift fällt im Hellen unter AA, gemessen 14.09.).
 */

import { useAuth } from "@/lib/auth-context";
import { GYM_GESPERRT_TEXT, getGymInfo, resolveGymId } from "@/lib/gym";
import { useEffect, useState } from "react";

export default function GymGesperrtStreifen({ style }: { style?: React.CSSProperties }) {
  const { profile } = useAuth();
  const gymId = resolveGymId(profile);
  const [gesperrt, setGesperrt] = useState(false);

  useEffect(() => {
    let alive = true;
    getGymInfo(gymId).then((info) => {
      if (alive) setGesperrt(info.status === "blocked");
    });
    return () => {
      alive = false;
    };
  }, [gymId]);

  if (!gesperrt) return null;
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
      {GYM_GESPERRT_TEXT.replace(/^Dein Gym ist stillgelegt\.\s*/, "")}
    </div>
  );
}
