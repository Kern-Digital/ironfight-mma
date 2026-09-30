/**
 * Die Wochenpläne eines Gyms INNERHALB einer Transaktion (Leon 27.09.2026:
 * mehrere Pläne, genau einer aktiv, Pläne für einen Zeitraum).
 *
 * Route (`/api/gym/kurse`), Nacht-Job (`/api/cron/wochenplan`) und der
 * tägliche Abgleich (`/api/gym/wochenplan-stand`) lesen alle Pläne des Gyms,
 * lassen `planStandRechnen` den Stand für heute ableiten und schreiben nur,
 * was davon abweicht. Weil der Stand eine RECHNUNG ist und kein Ereignis,
 * holt jeder Aufruf nach, was ein anderer verpasst hat, und ein doppelter
 * Aufruf ändert nichts. Zwei gleichzeitige Transaktionen laufen nacheinander
 * (Firestore wiederholt die zweite).
 */

import {
  FieldValue,
  type CollectionReference,
  type DocumentReference,
  type Firestore,
  type Transaction,
} from "firebase-admin/firestore";
import { kurseSortieren, planLesen, planStandRechnen, type Wochenplan } from "@/lib/kursplan";

export interface PlanImTx extends Wochenplan {
  ref: DocumentReference;
  /** Noch nicht in Firestore — wird mit `create` geschrieben. */
  neu?: boolean;
  geaendert: boolean;
}

export function plaeneSammlung(db: Firestore, gymId: string): CollectionReference {
  return db.collection("gyms").doc(gymId).collection("schedulePlans");
}

export async function plaeneLesenTx(
  tx: Transaction,
  db: Firestore,
  gymId: string,
): Promise<{ sammlung: CollectionReference; plaene: PlanImTx[] }> {
  const sammlung = plaeneSammlung(db, gymId);
  const snap = await tx.get(sammlung);
  return {
    sammlung,
    plaene: snap.docs.map((d) => ({ ...planLesen(d.id, d.data()), ref: d.ref, geaendert: false })),
  };
}

/**
 * Bringt die Pläne auf den Stand von `heute` (planStandRechnen) und merkt
 * sich, welche sich geändert haben. Liefert die ID des Plans, der dadurch NEU
 * aktiv wurde, sonst null.
 */
export function wechselAnwenden(plaene: PlanImTx[], heute: string): string | null {
  const vorher = plaene.find((p) => p.aktiv)?.id ?? null;
  const { aktivId, stand } = planStandRechnen(plaene, heute);
  for (const p of plaene) {
    const soll = stand.get(p.id);
    if (!soll) continue;
    if (
      p.aktiv !== soll.aktiv ||
      p.grundplan !== soll.grundplan ||
      p.zeitraumVon !== soll.zeitraumVon ||
      p.zeitraumBis !== soll.zeitraumBis ||
      p.nachfolgerId !== soll.nachfolgerId
    ) {
      Object.assign(p, soll);
      p.geaendert = true;
    }
  }
  return aktivId !== vorher ? aktivId : null;
}

/** Schreibt jeden geänderten Plan — ganz, damit nie ein halber Stand liegt. */
export function plaeneSchreibenTx(tx: Transaction, plaene: PlanImTx[], von: string): void {
  for (const p of plaene) {
    if (!p.geaendert) continue;
    const daten = {
      name: p.name,
      aktiv: p.aktiv,
      grundplan: p.grundplan,
      zeitraumVon: p.zeitraumVon,
      zeitraumBis: p.zeitraumBis,
      nachfolgerId: p.nachfolgerId,
      // Firestore nimmt kein `undefined` — kurseLesen und die Prüfung liefern
      // nur gesetzte Felder.
      kurse: kurseSortieren(p.kurse),
      raeume: p.raeume,
      geaendertAm: FieldValue.serverTimestamp(),
      geaendertVon: von,
    };
    if (p.neu) tx.create(p.ref, { ...daten, angelegtAm: FieldValue.serverTimestamp() });
    // `aktivAb` (Fassung vom 27.09. nachmittags) räumt jeder Schreibvorgang weg.
    else tx.set(p.ref, { ...daten, aktivAb: FieldValue.delete() }, { merge: true });
  }
}

/**
 * Gleicht die Pläne eines Gyms mit heute ab — erst ohne Transaktion (meist
 * stimmt alles, dann bleibt es bei einem Lesevorgang), sonst in einer.
 */
export async function standAbgleichen(
  db: Firestore,
  gymId: string,
  heute: string,
  von: string,
): Promise<{ geaendert: boolean; neuAktiv: string | null }> {
  const snap = await plaeneSammlung(db, gymId).get();
  const probe: PlanImTx[] = snap.docs.map((d) => ({ ...planLesen(d.id, d.data()), ref: d.ref, geaendert: false }));
  wechselAnwenden(probe, heute);
  if (!probe.some((p) => p.geaendert)) return { geaendert: false, neuAktiv: null };
  const neuAktiv = await db.runTransaction(async (tx) => {
    const { plaene } = await plaeneLesenTx(tx, db, gymId);
    const neu = wechselAnwenden(plaene, heute);
    plaeneSchreibenTx(tx, plaene, von);
    return neu;
  });
  return { geaendert: true, neuAktiv };
}
