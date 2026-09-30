/**
 * Die Trainer-Auswahl für das Freigabe-Sheet — Client-Seite von
 * `POST /api/gym/trainer-auswahl` (Begründung und Sicherheitsmodell im
 * Kopf der Route).
 *
 * Ein Athlet darf die Mitgliederliste seines Gyms nicht lesen (firestore.rules,
 * so gewollt). Für die namentliche DeepFight-Freigabe braucht er aber die
 * Trainer — die liefert die Route: uid, Name, Profilbild, sonst nichts.
 */

import type { User } from "firebase/auth";
import { readProfilbild, type ProfilbildId } from "./profilbilder";

export interface AuswahlTrainer {
  uid: string;
  name: string;
  avatar: ProfilbildId | null;
}

export interface AuswahlGym {
  gymId: string;
  name: string;
  trainer: AuswahlTrainer[];
}

/**
 * Lädt die Auswahl. WIRFT bei jedem Fehler — der Aufrufer muss „nicht
 * geladen" von „keine Trainer" unterscheiden. Genau diese Verwechslung war
 * der Fehler, den es vorher gab („In deinem Gym gibt es gerade keinen
 * Trainer", obwohl drei da waren).
 */
export async function ladeTrainerAuswahl(user: User): Promise<AuswahlGym[]> {
  const res = await fetch("/api/gym/trainer-auswahl", {
    method: "POST",
    headers: { authorization: `Bearer ${await user.getIdToken()}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`trainer-auswahl ${res.status}`);
  const data = (await res.json()) as { gyms?: unknown };
  if (!Array.isArray(data.gyms)) throw new Error("trainer-auswahl: Antwort ohne gyms");
  return data.gyms.map((g) => {
    const gym = g as Record<string, unknown>;
    const trainer = Array.isArray(gym.trainer) ? gym.trainer : [];
    return {
      gymId: String(gym.gymId ?? ""),
      name: String(gym.name ?? ""),
      trainer: trainer.map((t) => {
        const e = t as Record<string, unknown>;
        return {
          uid: String(e.uid ?? ""),
          name: String(e.name ?? "Trainer"),
          avatar: readProfilbild(e.avatar),
        };
      }).filter((t) => t.uid),
    };
  });
}
