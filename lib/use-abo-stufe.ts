"use client";

/**
 * DIE STUFE DES GYMS IM CLIENT — Leon 22.09.2026: „außer der größeren anzahl
 * der analysen … auch einen mehrwehrt".
 *
 * Seit dem 22.09. entscheidet die Abo-Stufe, was ein Gym darf: wie lang ein
 * Video sein darf (10 / 15 / 15 min), ob es Logo und Farbe setzen kann, was
 * zehn nachgekaufte Analysen kosten. Die Oberfläche fragt hier nach, der
 * Server prüft trotzdem selbst — ein Client-Wert ist eine Anzeige, keine
 * Schranke (`lib/server/gym-status.ts`).
 *
 * SOLANGE GELADEN WIRD, steht `plan` auf `null`. Wer eine Zahl braucht,
 * nimmt bis dahin die Obergrenze: Lieber zeigt die Seite kurz 15 Minuten und
 * der Server schickt ein zu langes Video zurück, als dass sie ein zahlendes
 * Gym ohne Grund kürzt.
 */

import { useEffect, useState } from "react";
import {
  VIDEO_SEKUNDEN_MAX,
  getGymAbo,
  leistungenFuer,
  videoSekunden,
  type AboLeistungen,
  type AboStufe,
} from "./abo";

export interface AboStufeStand {
  /** Der Tarif — `null`, solange geladen wird oder das Lesen scheitert. */
  plan: "free" | AboStufe | null;
  /**
   * Was das Gym damit darf — `null`, solange der Tarif unbekannt ist. Wer
   * hier eine Zeile aufhängt (z. B. das Branding-Kit), zeigt beim `null` noch
   * nichts, statt zu raten und gleich darauf umzuspringen.
   */
  leistungen: AboLeistungen | null;
  /** Videolänge in Sekunden — bis der Tarif da ist: die Obergrenze. */
  videoSekunden: number;
}

export function useAboStufe(gymId: string | null | undefined): AboStufeStand {
  const [plan, setPlan] = useState<"free" | AboStufe | null>(null);

  useEffect(() => {
    if (!gymId) return;
    let lebt = true;
    getGymAbo(gymId)
      .then((abo) => {
        if (lebt) setPlan(abo.plan);
      })
      .catch(() => {
        // Lesefehler: bei der Obergrenze bleiben. Der Server entscheidet.
        if (lebt) setPlan(null);
      });
    return () => {
      lebt = false;
    };
  }, [gymId]);

  return {
    plan,
    leistungen: plan ? leistungenFuer(plan) : null,
    videoSekunden: plan ? videoSekunden(plan) : VIDEO_SEKUNDEN_MAX,
  };
}
