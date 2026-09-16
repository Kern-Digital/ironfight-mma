/**
 * Profil-Neuberechnung — der SCHREIBER zur reinen Rechnung in
 * `lib/profile-evidence.ts`. Läuft nur hier, mit dem Admin-SDK.
 *
 * Warum eine Transaktion: Zwei Trainer können in derselben Minute je eine
 * Analyse zum selben Gegner speichern. Ohne Transaktion läse jeder den
 * Bestand, rechnete für sich und schriebe sein Ergebnis über das des
 * anderen — genau das Standzeit-Fenster, das `readTarget` im Client früher
 * schließen musste. In der Transaktion liest jeder Lauf alle Analysen UND
 * das Profil, rechnet, schreibt; kollidieren zwei, wiederholt Firestore den
 * zweiten mit frischem Stand.
 *
 * Was geschrieben wird, sind ausschließlich die ABGELEITETEN Felder (dna,
 * dnaSplit, dnaSplitWeight, actionStats, evidence). Stammdaten des Gegners
 * (Name, Maße, Notizen, Freigaben) bleiben unangetastet; beim Kampfprofil
 * wird das Dokument komplett ersetzt, weil es nur aus Abgeleitetem besteht.
 */

import { FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore";
import { decodeFightProfile, type FightProfileDoc } from "@/lib/fight-profile";
import { decodeOpponent, type OpponentDoc } from "@/lib/opponents";
import { computeProfile, type ComputedProfile } from "@/lib/profile-evidence";
import {
  decodeVideoAnalysis,
  type AnalysisMode,
  type VideoAnalysis,
  type VideoAnalysisDoc,
} from "@/lib/video-analysis";

/** Sammlung der Analysen eines Ziels. */
export function analysesRef(db: Firestore, mode: AnalysisMode, targetId: string) {
  return mode === "opponent"
    ? db.collection("opponents").doc(targetId).collection("videoAnalyses")
    : db.collection("users").doc(targetId).collection("videoAnalyses");
}

/** Das Profil-Dokument eines Ziels. */
export function profileRef(db: Firestore, mode: AnalysisMode, targetId: string) {
  return mode === "opponent"
    ? db.collection("opponents").doc(targetId)
    : db.collection("users").doc(targetId).collection("fightProfile").doc("main");
}

/**
 * Rechnet das Profil aus allen gespeicherten Analysen neu und schreibt es.
 * Liefert die Rechnung zurück (für die Antwort der Route).
 */
export async function recomputeProfile(
  db: Firestore,
  mode: AnalysisMode,
  targetId: string,
  updatedBy: string,
): Promise<ComputedProfile> {
  return db.runTransaction(async (tx: Transaction) => {
    const [analysesSnap, profileSnap] = await Promise.all([
      tx.get(analysesRef(db, mode, targetId)),
      tx.get(profileRef(db, mode, targetId)),
    ]);
    const analyses: VideoAnalysis[] = analysesSnap.docs.map((d) =>
      decodeVideoAnalysis(d.id, d.data() as VideoAnalysisDoc),
    );

    const existingDna =
      mode === "opponent"
        ? profileSnap.exists
          ? decodeOpponent(profileSnap.id, profileSnap.data() as OpponentDoc).dna
          : {}
        : decodeFightProfile(profileSnap.data() as FightProfileDoc | undefined).dna;

    const computed = computeProfile(mode, analyses, { dna: existingDna });
    const derived = {
      dna: computed.dna,
      dnaSplit: computed.dnaSplit,
      dnaSplitWeight: computed.dnaSplitWeight,
      actionStats: computed.actionStats,
      evidence: computed.evidence,
      updatedBy,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (mode === "opponent") {
      if (!profileSnap.exists) {
        // Gegnerprofil weg (gelöscht, während analysiert wurde) — nichts
        // anlegen, was niemand mehr sieht.
        return computed;
      }
      // Nur die abgeleiteten Felder — `update` lässt alles andere stehen.
      // `dna` komplett ersetzen (kein Merge in die Map), sonst blieben
      // verschwundene Antworten als Schlüssel liegen.
      tx.update(profileSnap.ref, derived);
    } else {
      // Das Kampfprofil BESTEHT aus Abgeleitetem — komplett ersetzen.
      tx.set(profileSnap.ref, derived);
    }
    return computed;
  });
}
