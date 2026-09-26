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
import { decodeGymAbo, videoSekunden, VIDEO_SEKUNDEN_MAX, type AboStufe } from "../abo";
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

// ─── Die Stufe und was sie erlaubt ──────────────────────────────────────────

/**
 * Welchen Tarif dieses Gym hat. `null` heißt: nicht lesbar — NICHT „gratis".
 *
 * Seit dem 22.09.2026 hängt die Videolänge an der Stufe (Leon: „10 / 15 /
 * 15 min"), und das ist die erste Zeile, die `plan` wirklich PRÜFT statt ihn
 * nur anzuzeigen. Ein laufend nicht bezahltes Abo behält seine Stufe: Bleibt
 * die Zahlung 14 Tage aus, kündigt Stripe, der Webhook setzt `free`, und
 * damit greift die kleinste Länge von selbst.
 */
export async function stufeDesGyms(
  dbHolen: () => Firestore,
  gymId: string,
): Promise<"free" | AboStufe | null> {
  try {
    const snap = await dbHolen().collection("gyms").doc(gymId).get();
    if (!snap.exists) return null;
    return decodeGymAbo(snap.get("subscription")).plan;
  } catch {
    return null;
  }
}

/**
 * Wie lang ein Video für dieses Gym sein darf, in Sekunden.
 *
 * FAIL-OPEN wie oben: Lässt sich die Stufe nicht lesen, gilt die längste
 * Länge. Ein Lesefehler darf ein zahlendes Gym nicht auf zehn Minuten kürzen
 * — die paar Cent für fünf Minuten mehr Video sind billiger als ein Trainer,
 * der vor einer Fehlermeldung sitzt.
 *
 * KOSTEN: ein Lesevorgang. Er fällt nur beim Aufruf MIT Video an (Falle 46:
 * eine Analyse sind zwei Requests) — die zweite Runde bringt die Beobachtung
 * schon mit und braucht kein Limit mehr.
 */
export async function videoSekundenFuerGym(
  dbHolen: () => Firestore,
  gymId: string,
): Promise<number> {
  const stufe = await stufeDesGyms(dbHolen, gymId);
  return stufe ? videoSekunden(stufe) : VIDEO_SEKUNDEN_MAX;
}
