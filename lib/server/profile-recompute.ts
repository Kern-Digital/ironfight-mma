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
 * Lauf je Kampfart ein eigenes Dokument `fightProfile/{sport}` aus NUR den
 * Analysen dieser Kampfart — dieselbe reine Rechnung, gefilterte Liste. So
 * läuft ein Sambo-Video nie in die MMA-Antworten. Kampfarten, zu denen keine
 * zählende Analyse mehr existiert (markiert, gelöscht), verlieren ihr
 * Dokument im selben Lauf. Gegner behalten EIN Profil: Ihr Dokument ist
 * flach, und ein Gegner wird für einen Kampf gescoutet, nicht über
 * Sportarten hinweg.
 *
 * DIE FIGHT-DNA ÜBER ALLE KAMPFARTEN (Etappe 3, Leon 16.09.): `fightProfile/
 * main` ist keine eigene Rechnung mehr, sondern die ZUSAMMENSTELLUNG der
 * Kampfart-Profile (`stelleZusammen`). Analysen ohne Kampfart (Bestand vor
 * Etappe 2) bilden eine Gruppe ohne Namen, die nur ins Gesamtprofil läuft.
 *
 * DIE WIRKUNG EINER ANALYSE (Etappe 3, Leon 17.09.): Mit `wirkungFuer`
 * vergleicht der Lauf das Profil, in das die Analyse lief, VOR und NACH ihr
 * und legt das Ergebnis an die Analyse (`wirkung`). Das ist der Stoff der
 * Kurzinfo — gespeichert, weil der Athlet seine Rohanalysen nicht lesen darf
 * und weil der Bericht den Stand von damals zeigen soll.
 */

import { FieldValue, type Firestore, type Transaction } from "firebase-admin/firestore";
import { decodeFightProfile, type FightProfileDoc } from "@/lib/fight-profile";
import type { DnaSplit } from "@/lib/fight-stats";
import type { GegnerDnaAnswers } from "@/lib/gegner-dna";
import { decodeOpponent, type OpponentDoc } from "@/lib/opponents";
import {
  computeProfile,
  MANUAL_SIDE,
  stelleZusammen,
  wirkungDerAnalyse,
  type AnalyseWirkung,
  type ComputedProfile,
  type KampfartProfil,
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

/** Firestore verträgt kein `undefined` — optionale Felder fallen weg. */
function ohneUndefined<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

export interface RecomputeResult {
  /** Das Gesamtprofil (Athlet: die Fight-DNA über alle Kampfarten; Gegner: sein Profil). */
  profil: ComputedProfile;
  /** Nur mit `wirkungFuer`: was diese Analyse bewegt hat (liegt jetzt auch an der Analyse). */
  wirkung: AnalyseWirkung | null;
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
  opts: { wirkungFuer?: string } = {},
): Promise<RecomputeResult> {
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
    const neue = opts.wirkungFuer ? analyses.find((a) => a.id === opts.wirkungFuer) ?? null : null;

    const abgeleitet = (c: ComputedProfile) =>
      ohneUndefined({
        dna: c.dna,
        dnaSplit: c.dnaSplit,
        dnaSplitWeight: c.dnaSplitWeight,
        actionStats: c.actionStats,
        evidence: c.evidence,
        updatedBy,
      });
    const stempel = { updatedAt: FieldValue.serverTimestamp() };
    const wirkungSchreiben = (w: AnalyseWirkung) => {
      if (!neue) return;
      tx.update(analysesRef(db, mode, targetId).doc(neue.id), { wirkung: ohneUndefined(w) });
    };

    // ── Gegner: EIN Profil ─────────────────────────────────────────────────
    if (mode === "opponent") {
      let existingDna: GegnerDnaAnswers = {};
      let vorher: { evidence: ProfileEvidence | null; dnaSplit: DnaSplit | null } | null = null;
      if (profileSnap.exists) {
        const o = decodeOpponent(profileSnap.id, profileSnap.data() as OpponentDoc);
        existingDna = manuellerBestand(o.dna, o.evidence);
        vorher = { evidence: o.evidence ?? null, dnaSplit: o.dnaSplit ?? null };
      }
      const computed = computeProfile(mode, analyses, { dna: existingDna });
      const wirkung = neue
        ? wirkungDerAnalyse({ analyse: neue, mode, profil: "gegner", vorher, nachher: computed })
        : null;
      if (!profileSnap.exists) {
        // Gegnerprofil weg (gelöscht, während analysiert wurde) — nichts
        // anlegen, was niemand mehr sieht.
        return { profil: computed, wirkung };
      }
      // Nur die abgeleiteten Felder — `update` lässt alles andere stehen.
      // `dna` komplett ersetzen (kein Merge in die Map), sonst blieben
      // verschwundene Antworten als Schlüssel liegen.
      tx.update(profileSnap.ref, { ...abgeleitet(computed), ...stempel });
      if (wirkung) wirkungSchreiben(wirkung);
      return { profil: computed, wirkung };
    }

    // ── Athlet: je Kampfart ein Profil, darüber die Zusammenstellung ───────
    const vorhanden = new Map<string, FightProfileDoc>();
    for (const d of sportSnap?.docs ?? []) {
      if (d.id !== "main") vorhanden.set(d.id, d.data() as FightProfileDoc);
    }
    const zaehlt = (a: VideoAnalysis) => !a.wrongFighter && a.weight.identified && a.weight.value > 0;

    const sportarten = new Set<Sport>();
    let ohneKampfart = false;
    for (const a of analyses) {
      if (!zaehlt(a)) continue;
      if (isSport(a.sport)) sportarten.add(a.sport);
      else ohneKampfart = true;
    }

    const gruppen: KampfartProfil[] = [];
    for (const sport of Array.from(sportarten)) {
      const alt = decodeFightProfile(vorhanden.get(sport));
      const c = computeProfile(mode, analyses.filter((a) => a.sport === sport), {
        dna: manuellerBestand(alt.dna, alt.evidence),
      });
      gruppen.push({ sport, profil: c });
      tx.set(sportCol!.doc(sport), { ...abgeleitet(c), ...stempel });
    }
    if (ohneKampfart) {
      gruppen.push({
        sport: null,
        profil: computeProfile(mode, analyses.filter((a) => !isSport(a.sport)), { dna: {} }),
      });
    }
    // Kampfarten ohne zählende Analyse verlieren ihr Dokument — ein Profil,
    // hinter dem nichts mehr steht, wäre eine Aussage ohne Quelle.
    for (const id of Array.from(vorhanden.keys())) {
      if (isSport(id) && !sportarten.has(id)) tx.delete(sportCol!.doc(id));
    }

    const hauptAlt = decodeFightProfile(profileSnap.data() as FightProfileDoc | undefined);
    const gesamt = stelleZusammen(gruppen, { dna: manuellerBestand(hauptAlt.dna, hauptAlt.evidence) });
    // Das Kampfprofil BESTEHT aus Abgeleitetem — komplett ersetzen.
    tx.set(profileSnap.ref, { ...abgeleitet(gesamt), ...stempel });

    // ── Wirkung: im Profil der Kampfart des Videos, sonst im Gesamtprofil ──
    let wirkung: AnalyseWirkung | null = null;
    if (neue) {
      if (isSport(neue.sport)) {
        const alt = vorhanden.get(neue.sport);
        const altProfil = alt ? decodeFightProfile(alt) : null;
        const nachher = gruppen.find((g) => g.sport === neue.sport)?.profil ?? gesamt;
        wirkung = wirkungDerAnalyse({
          analyse: neue,
          mode,
          profil: neue.sport,
          vorher: altProfil ? { evidence: altProfil.evidence, dnaSplit: altProfil.dnaSplit } : null,
          nachher,
        });
      } else {
        wirkung = wirkungDerAnalyse({
          analyse: neue,
          mode,
          profil: "gesamt",
          vorher: profileSnap.exists ? { evidence: hauptAlt.evidence, dnaSplit: hauptAlt.dnaSplit } : null,
          nachher: gesamt,
        });
      }
      wirkungSchreiben(wirkung);
    }
    return { profil: gesamt, wirkung };
  });
}
