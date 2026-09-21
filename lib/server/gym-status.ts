/**
 * Stillgelegte Gyms — Schritt 1 des Geschäftsplans (21.09.2026).
 *
 * ─── WAS STILLLEGEN HEISST, IN DREI SCHRITTEN GEWACHSEN ─────────────────────
 *
 * 20.09., Leon: „lesen ja ändern nein" — der Notfallhebel für ein Gym, das
 * nicht zahlt.
 *
 * 21.09., Leon, auf die Frage nach den Firestore-Regeln: „man legt ja ein gym
 * hauptsächlich still, wenn es seine Beiträge nicht zahlt, und die kostenlose
 * Version soll weiterhin frei verfügbar sein." Damit trifft Stilllegen NUR
 * DEEPFIGHT. Kursplan, Mitglieder, Einladungen, Rechte, Pläne laufen weiter —
 * `invites/create` und `members/role` haben ihre Sperre an dem Tag wieder
 * verloren.
 *
 * 21.09., Leon, auf die Frage nach dem Restguthaben: **„Sie dürfen sie
 * aufbrauchen."** Bezahlt ist bezahlt. Ein stillgelegtes Gym, das noch
 * gekaufte Analysen übrig hat, arbeitet in DeepFight ganz normal weiter, bis
 * sie verbraucht sind — erst dann ist zu. Das Geschenk zählt dabei NICHT:
 * Wer nie gezahlt hat, hat auch nichts gut.
 *
 * ─── WAS DAS FÜR DIE ROUTEN HEISST ──────────────────────────────────────────
 *
 * Diese Stelle ist die Bremse für die DeepFight-Routen: Analyse, Vorlauf,
 * Rahmen, Übernehmen, Markieren, Gameplan, Scouting. Sie antwortet **423
 * Locked** — aber nur, wenn das Gym stillgelegt ist UND kein bezahltes
 * Guthaben mehr übrig hat.
 *
 * KOSTEN: ein Lesevorgang je Aufruf im Normalfall. Die Guthaben-Sammlung
 * wird NUR gelesen, wenn das Gym wirklich stillgelegt ist — der Alltag zahlt
 * für den Sonderfall nichts.
 *
 * FAIL-OPEN: Lässt sich das Gym-Dokument nicht lesen oder ist das Admin-SDK
 * nicht da, gilt das Gym als aktiv. Ein Notfallhebel darf nicht durch einen
 * Lesefehler alle Trainer aussperren.
 *
 * KEIN `next/server` IN DIESER DATEI (Falle 49): Der Ladeweg der Messskripte
 * (`scripts/lib/ts-loader.mjs`) kann `next/server` nicht auflösen — wer es
 * hier importiert, macht jede direkte Prüfung dieser Logik unmöglich.
 * `Response.json` aus dem Web-Standard tut dasselbe, und eine Route darf sie
 * genauso zurückgeben.
 */

import type { Firestore } from "firebase-admin/firestore";
import { GYM_GESPERRT_TEXT, GYM_GESPERRT_MIT_GUTHABEN } from "../gym";
import { restBezahlt } from "./guthaben";

export async function gymIstGesperrt(dbHolen: () => Firestore, gymId: string): Promise<boolean> {
  try {
    const snap = await dbHolen().collection("gyms").doc(gymId).get();
    return snap.exists && snap.get("status") === "blocked";
  } catch {
    return false;
  }
}

export interface DeepFightZustand {
  /** Ist das Gym stillgelegt? */
  gesperrt: boolean;
  /** Gekaufte Analysen, die es trotzdem noch aufbrauchen darf. */
  bezahltRest: number;
  /** Ist DeepFight damit zu? */
  zu: boolean;
}

/**
 * Der Zustand von DeepFight für dieses Gym. Ein Lesevorgang, im Sonderfall
 * zwei.
 */
export async function deepfightZustand(
  dbHolen: () => Firestore,
  gymId: string,
): Promise<DeepFightZustand> {
  if (!(await gymIstGesperrt(dbHolen, gymId))) {
    return { gesperrt: false, bezahltRest: 0, zu: false };
  }
  const bezahlt = await restBezahlt(dbHolen, gymId);
  return { gesperrt: true, bezahltRest: bezahlt, zu: bezahlt <= 0 };
}

/**
 * 423 Locked, wenn DeepFight für dieses Gym zu ist — sonst null. Steht in den
 * Routen direkt hinter der Rollenprüfung und VOR der Prüfung des Bodys, damit
 * die Antwort auch ohne gültige Eingabe kommt (und sich so billig messen
 * lässt).
 *
 * Hieß bis zum 21.09.2026 `antwortWennGesperrt`. Der Name wurde mit der
 * Bedeutung falsch: Stillgelegt ist nicht mehr dasselbe wie zu.
 */
export async function antwortWennDeepFightZu(
  dbHolen: () => Firestore,
  gymId: string,
): Promise<Response | null> {
  const zustand = await deepfightZustand(dbHolen, gymId);
  if (!zustand.zu) return null;
  return Response.json({ error: GYM_GESPERRT_TEXT, gesperrt: true }, { status: 423 });
}

/** Der Satz für den Streifen — mit Restguthaben ein anderer. */
export function gesperrtText(bezahltRest: number): string {
  return bezahltRest > 0 ? GYM_GESPERRT_MIT_GUTHABEN(bezahltRest) : GYM_GESPERRT_TEXT;
}
