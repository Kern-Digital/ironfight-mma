/**
 * Stillgelegte Gyms — Schritt 1 des Geschäftsplans (21.09.2026). Leon:
 * „lesen ja, ändern nein". Der Zustand steht am Gym-Dokument
 * (`status: "blocked"`, gesetzt vom Plattform-Admin auf /admin). Bis zum
 * 21.09. wurde er nur angezeigt und nirgends geprüft — ein stillgelegtes Gym
 * arbeitete ungehindert weiter.
 *
 * Diese Stelle ist die Bremse für die SERVER-Routen, die etwas verändern oder
 * Geld kosten: Analyse, Vorlauf, Rahmen, Übernehmen, Markieren, Gameplan,
 * Einladungen, Rechte. Die Client-Schreibwege (Kursplan, Pläne, Wettkämpfe,
 * Gegner) laufen über die Firestore-Regeln — dort fehlt die Prüfung noch
 * (Schritt 1b, siehe CLAUDE.md).
 *
 * FAIL-OPEN: Lässt sich das Gym-Dokument nicht lesen oder ist das Admin-SDK
 * nicht da, gilt das Gym als aktiv. Ein Notfallhebel darf nicht durch einen
 * Lesefehler alle Trainer aussperren. Ein Lesevorgang je Aufruf — bei Routen,
 * die Sekunden bis Minuten laufen, fällt er nicht ins Gewicht.
 */

import { NextResponse } from "next/server";
import type { Firestore } from "firebase-admin/firestore";
import { GYM_GESPERRT_TEXT } from "../gym";

export async function gymIstGesperrt(dbHolen: () => Firestore, gymId: string): Promise<boolean> {
  try {
    const snap = await dbHolen().collection("gyms").doc(gymId).get();
    return snap.exists && snap.get("status") === "blocked";
  } catch {
    return false;
  }
}

/**
 * 423 Locked, wenn das Gym stillgelegt ist — sonst null. Steht in den Routen
 * direkt hinter der Rollenprüfung und VOR der Prüfung des Bodys, damit die
 * Antwort auch ohne gültige Eingabe kommt (und sich so billig messen lässt).
 */
export async function antwortWennGesperrt(
  dbHolen: () => Firestore,
  gymId: string,
): Promise<NextResponse | null> {
  if (!(await gymIstGesperrt(dbHolen, gymId))) return null;
  return NextResponse.json({ error: GYM_GESPERRT_TEXT, gesperrt: true }, { status: 423 });
}
