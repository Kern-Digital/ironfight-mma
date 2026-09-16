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
 *
 * PROFIL JE KAMPFART (Etappe 2, Leon 16.09.): Beim Athleten schreibt der
 * Lauf neben `fightProfile/main` (alle Analysen, das Gesamtprofil) je
 * Kampfart ein eigenes Dokument `fightProfile/{sport}` aus NUR den Analysen
 * dieser Kampfart — dieselbe reine Rechnung, gefilterte Liste. So läuft ein
 * Sambo-Video nie in die MMA-Antworten. Kampfarten, zu denen keine zählende
 * Analyse mehr existiert (markiert, gelöscht), verlieren ihr Dokument im
 * selben Lauf. Gegner behalten EIN Profil: Ihr Dokument ist flach, und ein
 * Gegner wird für einen Kampf gescoutet, nicht über Sportarten hinweg.
 *
 * Das Gesamtprofil rechnet bis Etappe 3 weiter über alle Kampfarten — die
 * Gesamtansicht als ZUSAMMENSTELLUNG der Kampfart-Profile ist Sache des
 * Berichts (Etappe 3).
 */

import { FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore";
import { decodeFightProfile, type FightProfileDoc } from "@/lib/fight-profile";
import type { GegnerDnaAnswers } from "@/lib/gegner-dna";
import { decodeOpponent, type OpponentDoc } from "@/lib/opponents";
import {
  computeProfile,
  MANUAL_SIDE,
  type ComputedProfile,
  type ProfileEvidence,
} from "@/lib/profile-evidence";
import {
  decodeVideoAnalysis,
  isSport,
  type AnalysisMode,
  type Sport,
  type VideoAnalysis,
  type VideoAnalysisDoc,
} from "@/lib/video-analysis";

/** Sammlung der Analysen eines Ziels. */
export function analysesRef(db: Firestore, mode: AnalysisMode, targetId: string) {
  return mode === "opponent"
    ? db.collection("opponents").doc(targetId).collection("videoAnalyses")
    : db.collection("users").doc(targetId).collection("videoAnalyses");
}

/**
 * Nur der HANDTEXT eines Profils — das, was `computeProfile` als Seite
 * `manual` behandeln darf.
 *
 * GEMESSEN 16.09.2026 (scripts/check-profil-je-kampfart.mjs): Wird eine
 * Analyse als „falscher Kämpfer" markiert, fiel sie zwar aus der Rechnung,
 * ihr TEXT blieb aber im Profil stehen — die Neuberechnung las den zuvor
 * ERRECHNETEN Text als Bestand zurück und hielt ihn wie eine Handeingabe.
 * Damit wäre Leons Punkt D („Löschen rechnet zurück") ein leeres
 * Versprechen. Die gespeicherte Rechnung weiß, woher jede Antwort kam:
 * Nur Fragen, deren Sieger `manual` war (oder die vor der Automatik
 * entstanden, also ohne Rechnung), zählen als Handtext. Alles andere wird
 * aus den Analysen neu gerechnet — oder ist weg.
 */
function manuellerBestand(
  dna: GegnerDnaAnswers,
  evidence: ProfileEvidence | null | undefined,
): GegnerDnaAnswers {
  if (!evidence?.answers) return dna; // vor der Automatik: alles Handtext
  const out: GegnerDnaAnswers = {};
  for (const [q, text] of Object.entries(dna)) {
    const e = evidence.answers[q];
    if (!e || e.winner === MANUAL_SIDE) out[q] = text;
  }
  return out;
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
    // Alle Lesezugriffe VOR dem ersten Schreiben (Transaktionsregel).
    const sportCol =
      mode === "athlete"
        ? db.collection("users").doc(targetId).collection("fightProfile")
        : null;
    const [analysesSnap, profileSnap, sportSnap] = await Promise.all([
      tx.get(analysesRef(db, mode, targetId)),
      tx.get(profileRef(db, mode, targetId)),
      sportCol ? tx.get(sportCol) : Promise.resolve(null),
    ]);
    const analyses: VideoAnalysis[] = analysesSnap.docs.map((d) =>
      decodeVideoAnalysis(d.id, d.data() as VideoAnalysisDoc),
    );

    let existingDna: GegnerDnaAnswers = {};
    if (mode === "opponent") {
      if (profileSnap.exists) {
        const o = decodeOpponent(profileSnap.id, profileSnap.data() as OpponentDoc);
        existingDna = manuellerBestand(o.dna, o.evidence);
      }
    } else {
      const p = decodeFightProfile(profileSnap.data() as FightProfileDoc | undefined);
      existingDna = manuellerBestand(p.dna, p.evidence);
    }

    const abgeleitet = (c: ComputedProfile) => ({
      dna: c.dna,
      dnaSplit: c.dnaSplit,
      dnaSplitWeight: c.dnaSplitWeight,
      actionStats: c.actionStats,
      evidence: c.evidence,
      updatedBy,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const computed = computeProfile(mode, analyses, { dna: existingDna });

    if (mode === "opponent") {
      if (!profileSnap.exists) {
        // Gegnerprofil weg (gelöscht, während analysiert wurde) — nichts
        // anlegen, was niemand mehr sieht.
        return computed;
      }
      // Nur die abgeleiteten Felder — `update` lässt alles andere stehen.
      // `dna` komplett ersetzen (kein Merge in die Map), sonst blieben
      // verschwundene Antworten als Schlüssel liegen.
      tx.update(profileSnap.ref, abgeleitet(computed));
      return computed;
    }

    // Das Kampfprofil BESTEHT aus Abgeleitetem — komplett ersetzen.
    tx.set(profileSnap.ref, abgeleitet(computed));

    // ── Profil je Kampfart ───────────────────────────────────────────────
    const sportarten = new Set<Sport>();
    for (const a of analyses) {
      if (!a.wrongFighter && a.weight.identified && a.weight.value > 0 && isSport(a.sport)) {
        sportarten.add(a.sport);
      }
    }
    const vorhanden = new Map<string, FightProfileDoc>();
    for (const d of sportSnap?.docs ?? []) {
      if (d.id !== "main") vorhanden.set(d.id, d.data() as FightProfileDoc);
    }
    for (const sport of Array.from(sportarten)) {
      const eigene = analyses.filter((a) => a.sport === sport);
      const alt = decodeFightProfile(vorhanden.get(sport));
      const c = computeProfile(mode, eigene, { dna: manuellerBestand(alt.dna, alt.evidence) });
      tx.set(sportCol!.doc(sport), abgeleitet(c));
    }
    // Kampfarten ohne zählende Analyse verlieren ihr Dokument — ein Profil,
    // hinter dem nichts mehr steht, wäre eine Aussage ohne Quelle.
    for (const id of Array.from(vorhanden.keys())) {
      if (isSport(id) && !sportarten.has(id)) tx.delete(sportCol!.doc(id));
    }
    return computed;
  });
}
