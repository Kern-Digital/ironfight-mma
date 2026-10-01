/**
 * GYM-SUCHE, Client-Seite — holt die Liste von `POST /api/gyms/suche`.
 *
 * Die Liste ist für alle dieselbe. Gesucht, sortiert und nach Umkreis
 * gefiltert wird im Browser (app/gym-finden/page.tsx, lib/plz.ts): Was jemand
 * eintippt und wo er steht, kommt beim Server nie an.
 */

import type { User } from "firebase/auth";
import type { SuchGym } from "./gym-kontakt";
import type { MeineAnfrage } from "./gym-anfrage";

export interface SuchErgebnis {
  gyms: SuchGym[];
  /** Bei welchen Gyms das eigene Konto eine offene Anfrage hat. */
  angefragt: MeineAnfrage[];
}

export async function ladeSuchGyms(user: User): Promise<SuchErgebnis> {
  const res = await fetch("/api/gyms/suche", {
    method: "POST",
    headers: { authorization: `Bearer ${await user.getIdToken()}` },
  });
  if (!res.ok) throw new Error(`Gym-Suche: ${res.status}`);
  const daten = (await res.json()) as Partial<SuchErgebnis>;
  return {
    gyms: Array.isArray(daten.gyms) ? daten.gyms : [],
    angefragt: Array.isArray(daten.angefragt) ? daten.angefragt : [],
  };
}

/** Die Stufen des Umkreis-Reglers in Kilometern. */
export const UMKREIS_STUFEN = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 300] as const;

/** Womit die Suche startet, sobald eine Mitte gewählt ist. */
export const UMKREIS_START = 25;

/** „3,4 km" unter zehn, darüber ganze Kilometer. */
export function kmText(km: number): string {
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(km)} km`;
}
