/**
 * Gameplan schreiben — Firestore und Claude (Server, Admin-SDK). Die reine
 * Rechnung (Voraussetzungen, Prompt, Schema) liegt in ./gameplan-prompt.ts,
 * Leons Entscheidungen und die Ablage stehen im Kopf von lib/gameplan.ts.
 *
 * DREI EINSTIEGE:
 *   • `schreibeGameplan` — EIN Wettkampf. Ruft die Route
 *     /api/wettkampf/gameplan (Anlegen, Kampfart nachgetragen, „Neu schreiben").
 *   • `gameplaeneNachAnalyse` — der Nachlauf der commit-Route (Leon: „nach
 *     jeder neuen Analyse automatisch"). Sucht die anstehenden Wettkämpfe, die
 *     diese Analyse berührt, und schreibt ihre Gameplans neu.
 *   • `merkeScoutingAenderung` + `gameplaeneNachScouting` — die Route
 *     /api/wettkampf/gameplan/scouting nach einer Hand-Änderung am
 *     Gegnerprofil (Leon: „Ja, mit Aufschub"): markieren, 90 s warten, nur
 *     der jüngste Nachlauf schreibt.
 *
 * ZEITBUDGET (abgestimmt mit Etappe 3): Der Nachlauf läuft per `waitUntil` im
 * selben 300-s-Budget wie die Route, und Etappe 3 hängt die Profilsätze davor.
 * Deshalb bekommt er eine FRIST (Epoch-ms): Reicht die Zeit für einen weiteren
 * Claude-Aufruf nicht mehr, markiert er den Wettkampf „offen · zeit" — die Seite
 * bietet „Jetzt schreiben" an —, statt nach 300 s hart abgeschnitten zu werden.
 *
 * GLEICHZEITIGE LÄUFE: Jeder Lauf trägt eine `laufId`. Fertig schreibt nur,
 * wessen laufId noch am Dokument steht — ein älterer Lauf überschreibt keinen
 * jüngeren. Gleiche Eingabe (Fingerabdruck) wie beim letzten fertigen Stand →
 * kein neuer Aufruf.
 */

import { randomUUID } from "node:crypto";
import {
  Timestamp,
  type DocumentData,
  type DocumentReference,
  type Firestore,
} from "firebase-admin/firestore";
import { FIGHTER_STANCE_LABEL, FIGHT_STYLE_LABEL, type OpponentProfile } from "../fight-camp";
import { decodeFightProfile, type FightProfileDoc } from "../fight-profile";
import { decodeOpponent, type Opponent, type OpponentDoc } from "../opponents";
import { gameplanDocId, type GameplanDoc, type GameplanOffen } from "../gameplan";
import { isSport, type AnalysisMode, type Sport } from "../video-analysis";
import { flaecheDesWettkampfs, isFlaeche, type Flaeche } from "../kampfart-steckbrief";
import { hatClaudeSchluessel, rufeClaude } from "./claude-aufruf";
import { bucheKiKosten } from "./ki-kosten";
import {
  GAMEPLAN_SCHEMA,
  gameplanLeer,
  gameplanPrompt,
  gameplanSchluessel,
  gameplanStand,
  gameplanVoraussetzung,
  normalisiereGameplan,
  type GameplanEingabe,
} from "./gameplan-prompt";
import { parseModelJson } from "./gemini";

/** So lange darf ein Claude-Aufruf für einen Gameplan höchstens brauchen (Schätzung mit Puffer). */
export const GAMEPLAN_AUFRUF_MS = 150_000;
/** Höchstens so viele Wettkämpfe je Nachlauf — der Rest wird „offen · zeit". */
export const GAMEPLAENE_JE_NACHLAUF = 2;

/** Die Felder eines Wettkampfs, die der Gameplan braucht (Admin-SDK-Rohform). */
interface CampRoh {
  id: string;
  studentUid: string;
  gymId: string | null;
  competitionName: string;
  competitionDate: Date;
  status: string;
  sport: Sport | null;
  /** Gespeicherte Wahl des Trainers — null heißt Vorbelegung der Kampfart. */
  flaeche: Flaeche | null;
  opponentId: string | null;
  opponent: OpponentProfile;
}

function campAusDoc(id: string, studentUid: string, d: DocumentData): CampRoh {
  const opponent = (d.opponent ?? {}) as OpponentProfile;
  return {
    id,
    studentUid,
    gymId: typeof d.gymId === "string" ? d.gymId : null,
    competitionName: typeof d.competitionName === "string" ? d.competitionName : "Wettkampf",
    competitionDate: d.competitionDate instanceof Timestamp ? d.competitionDate.toDate() : new Date(0),
    status: typeof d.status === "string" ? d.status : "active",
    sport: isSport(d.sport) ? d.sport : null,
    flaeche: isFlaeche(d.flaeche) ? d.flaeche : null,
    opponentId: (typeof d.opponentId === "string" && d.opponentId) || opponent.opponentId || null,
    opponent,
  };
}

function gameplanRef(db: Firestore, uid: string, campId: string) {
  return db.collection("users").doc(uid).collection("fightProfile").doc(gameplanDocId(campId));
}

/** Liest alles, was der Prompt braucht. */
async function leseEingabe(db: Firestore, camp: CampRoh, sport: Sport): Promise<{ eingabe: GameplanEingabe; gegner: Opponent | null }> {
  const userRef = db.collection("users").doc(camp.studentUid);
  const [userSnap, profilSnap, gegnerSnap] = await Promise.all([
    userRef.get(),
    userRef.collection("fightProfile").doc(sport).get(),
    camp.opponentId ? db.collection("opponents").doc(camp.opponentId).get() : Promise.resolve(null),
  ]);
  const u = userSnap.data() ?? {};
  const athletName =
    (typeof u.displayName === "string" && u.displayName.trim()) ||
    (typeof u.authProviderName === "string" && u.authProviderName.trim()) ||
    "Athlet";
  const athlet = profilSnap.exists ? decodeFightProfile(profilSnap.data() as FightProfileDoc) : null;
  const gegner = gegnerSnap?.exists ? decodeOpponent(gegnerSnap.id, gegnerSnap.data() as OpponentDoc) : null;

  // Das LEBENDE Gegnerprofil zählt (Gedächtnis „gegner-bearbeiten-immer-fuer-alle");
  // der Snapshot am Wettkampf ist nur Rückfall.
  const quelle = gegner ?? camp.opponent;
  const eckdaten = [
    quelle.style ? `Stil (Trainer-Einschätzung): ${FIGHT_STYLE_LABEL[quelle.style] ?? quelle.style}` : "",
    quelle.stance ? `Auslage: ${FIGHTER_STANCE_LABEL[quelle.stance] ?? quelle.stance}` : "",
    [
      quelle.heightCm ? `${quelle.heightCm} cm` : "",
      quelle.weightKg ? `${quelle.weightKg} kg` : "",
      quelle.reachCm ? `Reichweite ${quelle.reachCm} cm` : "",
    ]
      .filter(Boolean)
      .join(", "),
  ].filter(Boolean);

  const eingabe: GameplanEingabe = {
    sport,
    flaeche: flaecheDesWettkampfs({ sport, flaeche: camp.flaeche }),
    wettkampf: { name: camp.competitionName, datum: camp.competitionDate },
    athlet: {
      name: athletName,
      profil: athlet ? { dna: athlet.dna, dnaSplit: athlet.dnaSplit, actionStats: athlet.actionStats, evidence: athlet.evidence } : null,
    },
    gegner: {
      name: quelle.name || "Gegner",
      profil: gegner
        ? { dna: gegner.dna, dnaSplit: gegner.dnaSplit ?? null, actionStats: gegner.actionStats ?? [], evidence: gegner.evidence ?? null }
        : {
            dna: camp.opponent.dna ?? {},
            dnaSplit: camp.opponent.dnaSplit ?? null,
            actionStats: camp.opponent.actionStats ?? [],
            evidence: null,
          },
      eckdaten,
      staerken: quelle.strengths ?? [],
      schwaechen: quelle.weaknesses ?? [],
      lieblingsangriffe: quelle.favoriteAttacks ?? [],
      notizen: quelle.notes ?? null,
      nurSnapshot: !gegner,
    },
  };
  return { eingabe, gegner };
}

export type GameplanErgebnis = "geschrieben" | "unveraendert" | "offen" | "fehler" | "ueberholt" | "kein-wettkampf";

/** Einen Zustand ohne neuen Inhalt setzen — der letzte fertige Inhalt bleibt stehen. */
async function setzeZustand(
  db: Firestore,
  camp: CampRoh,
  patch: Pick<GameplanDoc, "status"> & Partial<GameplanDoc>,
) {
  await gameplanRef(db, camp.studentUid, camp.id).set(
    { campId: camp.id, sport: camp.sport, offen: null, fehler: null, ...patch },
    { merge: true },
  );
}

export async function markiereOffen(db: Firestore, camp: CampRoh, offen: GameplanOffen) {
  await setzeZustand(db, camp, { status: "offen", offen });
}

/**
 * Schreibt den Gameplan EINES Wettkampfs. Wirft nie — das Ergebnis sagt, was
 * passiert ist (der Nachlauf läuft ohne Zuhörer).
 */
export async function schreibeGameplan(
  db: Firestore,
  uid: string,
  campId: string,
  opts: { erzwingen?: boolean; campDaten?: DocumentData } = {},
): Promise<GameplanErgebnis> {
  const daten = opts.campDaten ?? (await db.collection("users").doc(uid).collection("fightCamps").doc(campId).get()).data();
  if (!daten) return "kein-wettkampf";
  const camp = campAusDoc(campId, uid, daten);
  const ref = gameplanRef(db, uid, campId);

  try {
    if (!camp.sport) {
      await markiereOffen(db, camp, "kampfart");
      return "offen";
    }
    const { eingabe } = await leseEingabe(db, camp, camp.sport);
    const offen = gameplanVoraussetzung(eingabe);
    if (offen) {
      await markiereOffen(db, camp, offen);
      return "offen";
    }

    const prompt = gameplanPrompt(eingabe);
    const schluessel = gameplanSchluessel(prompt);
    const vorher = (await ref.get()).data() as GameplanDoc | undefined;
    // Gleiche Eingabe wie beim letzten fertigen Inhalt: kein Aufruf. Stand der
    // Gameplan zwischendurch auf „offen" (z. B. Zeitbudget), gilt er wieder.
    if (!opts.erzwingen && vorher?.inhalt && vorher.eingabeSchluessel === schluessel) {
      if (vorher.status !== "fertig") await setzeZustand(db, camp, { status: "fertig" });
      return "unveraendert";
    }
    if (!hatClaudeSchluessel()) {
      await setzeZustand(db, camp, { status: "fehler", fehler: "Claude ist auf diesem Server nicht eingerichtet." });
      return "fehler";
    }

    const laufId = randomUUID();
    await setzeZustand(db, camp, { status: "schreibt", gestartetAt: new Date().toISOString(), laufId });

    let antwort: Awaited<ReturnType<typeof rufeClaude>>;
    try {
      antwort = await rufeClaude({ ...prompt, schema: GAMEPLAN_SCHEMA, maxTokens: 16000 });
    } catch (err) {
      await beendeLauf(db, ref, laufId, {
        status: "fehler",
        fehler: err instanceof Error ? err.message : "Claude konnte den Gameplan nicht schreiben.",
      });
      return "fehler";
    }

    const inhalt = normalisiereGameplan(parseModelJson<unknown>(antwort.text));
    const geschrieben = await beendeLauf(
      db,
      ref,
      laufId,
      gameplanLeer(inhalt)
        ? { status: "fehler", fehler: "Claude lieferte einen leeren Gameplan." }
        : {
            status: "fertig",
            inhalt,
            stand: gameplanStand(eingabe),
            geschriebenAt: new Date().toISOString(),
            model: antwort.model,
            usage: antwort.usage,
            eingabeSchluessel: schluessel,
          },
    );
    // Kosten fallen an, auch wenn ein jüngerer Lauf das Ergebnis überholt hat.
    if (camp.gymId) {
      await bucheKiKosten(db, camp.gymId, antwort.usage, new Date(), "gameplan").catch(() => {});
    }
    if (!geschrieben) return "ueberholt";
    return gameplanLeer(inhalt) ? "fehler" : "geschrieben";
  } catch (err) {
    await setzeZustand(db, camp, {
      status: "fehler",
      fehler: err instanceof Error ? err.message : "Gameplan konnte nicht geschrieben werden.",
    }).catch(() => {});
    return "fehler";
  }
}

/** Schreibt das Ende eines Laufs — nur, wenn kein jüngerer Lauf begonnen hat. */
async function beendeLauf(
  db: Firestore,
  ref: DocumentReference,
  laufId: string,
  patch: Partial<GameplanDoc>,
): Promise<boolean> {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if ((snap.data() as GameplanDoc | undefined)?.laufId !== laufId) return false;
    tx.set(ref, { offen: null, fehler: null, ...patch, laufId: null }, { merge: true });
    return true;
  });
}

// ─── Nachlauf nach einer Analyse ─────────────────────────────────────────────

/** Anstehend: Datum ab gestern (Zeitzone, Kampf am selben Abend), Status aktiv, Kampfart gesetzt. */
function steht(camp: CampRoh, jetzt: number): boolean {
  return camp.status === "active" && camp.competitionDate.getTime() >= jetzt - 86_400_000;
}

/**
 * Die Wettkämpfe, die eine Analyse berührt:
 *   • Athlet: seine Wettkämpfe in der Kampfart des Videos (ein Sambo-Video
 *     ändert das MMA-Profil nicht).
 *   • Gegner: Wettkämpfe des Gyms gegen diesen Gegner — über den vorhandenen
 *     collectionGroup-Index (gymId + competitionDate), der Gegner wird im
 *     Speicher gefiltert. Kein neuer Index, kein Deploy.
 */
export async function betroffeneWettkaempfe(
  db: Firestore,
  a: { mode: AnalysisMode; targetId: string; sport: Sport | null; gymId: string },
  jetzt = Date.now(),
): Promise<{ camp: CampRoh; daten: DocumentData }[]> {
  const liste: { camp: CampRoh; daten: DocumentData }[] = [];
  if (a.mode === "athlete") {
    if (!a.sport) return [];
    const snap = await db.collection("users").doc(a.targetId).collection("fightCamps").get();
    for (const d of snap.docs) {
      const camp = campAusDoc(d.id, a.targetId, d.data());
      if (steht(camp, jetzt) && camp.sport === a.sport) liste.push({ camp, daten: d.data() });
    }
  } else {
    const snap = await db
      .collectionGroup("fightCamps")
      .where("gymId", "==", a.gymId)
      .orderBy("competitionDate", "desc")
      .limit(300)
      .get();
    for (const d of snap.docs) {
      const uid = d.ref.parent.parent?.id;
      if (!uid) continue;
      const camp = campAusDoc(d.id, uid, d.data());
      if (steht(camp, jetzt) && camp.sport && camp.opponentId === a.targetId) liste.push({ camp, daten: d.data() });
    }
  }
  return liste.sort((x, y) => x.camp.competitionDate.getTime() - y.camp.competitionDate.getTime());
}

export interface NachlaufErgebnis {
  wettkampf: string;
  ergebnis: GameplanErgebnis | "offen-zeit";
}

/**
 * Schreibt die Gameplans einer Liste nacheinander — höchstens
 * GAMEPLAENE_JE_NACHLAUF, und nur, solange die Zeit bis `frist` für einen
 * Aufruf reicht; der Rest wird „offen · zeit". `darf` prüft je Wettkampf, ob
 * dieser Lauf überhaupt noch dran ist (Scouting-Aufschub). Ohne `daten` liest
 * `schreibeGameplan` den Wettkampf frisch.
 */
async function schreibeReihe(
  db: Firestore,
  liste: { camp: CampRoh; daten?: DocumentData }[],
  frist: number,
  darf?: (camp: CampRoh) => Promise<boolean>,
): Promise<NachlaufErgebnis[]> {
  const ergebnisse: NachlaufErgebnis[] = [];
  let geschrieben = 0;
  for (const { camp, daten } of liste) {
    if (darf && !(await darf(camp).catch(() => false))) {
      ergebnisse.push({ wettkampf: camp.id, ergebnis: "ueberholt" });
      continue;
    }
    const zeitReicht = frist - Date.now() >= GAMEPLAN_AUFRUF_MS;
    if (geschrieben >= GAMEPLAENE_JE_NACHLAUF || !zeitReicht) {
      await markiereOffen(db, camp, "zeit").catch(() => {});
      ergebnisse.push({ wettkampf: camp.id, ergebnis: "offen-zeit" });
      continue;
    }
    geschrieben++;
    ergebnisse.push({ wettkampf: camp.id, ergebnis: await schreibeGameplan(db, camp.studentUid, camp.id, { campDaten: daten }) });
  }
  return ergebnisse;
}

/**
 * Der Nachlauf der commit-Route. `frist` = Epoch-ms, bis zu der die Funktion
 * sicher läuft. Wirft nie.
 */
export async function gameplaeneNachAnalyse(
  db: Firestore,
  a: { mode: AnalysisMode; targetId: string; sport: Sport | null; gymId: string; frist: number },
): Promise<NachlaufErgebnis[]> {
  let betroffen: Awaited<ReturnType<typeof betroffeneWettkaempfe>>;
  try {
    betroffen = await betroffeneWettkaempfe(db, a);
  } catch {
    return [];
  }
  return schreibeReihe(db, betroffen, a.frist);
}

// ─── Nachlauf nach einer Hand-Änderung am Gegnerprofil ───────────────────────

/**
 * So lange wartet der Scouting-Nachlauf nach dem LETZTEN Speichern (Leon
 * 17.09.2026: „Ja, mit Aufschub"). 90 s Warten + 150 s Claude passen ins
 * 300-s-Budget der Route; eine weitere Änderung in dieser Zeit übernimmt.
 */
export const SCOUTING_AUFSCHUB_MS = 90_000;

export interface ScoutingMarke {
  aufschubId: string;
  betroffen: { camp: CampRoh }[];
}

/**
 * Schritt 1 — sofort in der Route: die anstehenden Wettkämpfe gegen diesen
 * Gegner finden und an JEDEM Gameplan die Marke dieser Änderung setzen. Eine
 * spätere Änderung überschreibt die Marke; der ältere Nachlauf sieht das nach
 * seiner Wartezeit und tritt zurück. So kosten fünf Änderungen am Stück EINEN
 * Lauf. Nur Gameplan-Dokumente, nichts am Gegner (dessen abgeleitete Felder
 * gehören der Profilrechnung).
 */
export async function merkeScoutingAenderung(
  db: Firestore,
  a: { opponentId: string; gymId: string; aufschubMs?: number },
  jetzt = Date.now(),
): Promise<ScoutingMarke> {
  const betroffen = await betroffeneWettkaempfe(db, { mode: "opponent", targetId: a.opponentId, sport: null, gymId: a.gymId }, jetzt);
  const aufschubId = randomUUID();
  const aufschubBis = new Date(jetzt + (a.aufschubMs ?? SCOUTING_AUFSCHUB_MS)).toISOString();
  await Promise.all(
    betroffen.map(({ camp }) =>
      gameplanRef(db, camp.studentUid, camp.id).set({ campId: camp.id, aufschubId, aufschubBis }, { merge: true }),
    ),
  );
  return { aufschubId, betroffen: betroffen.map(({ camp }) => ({ camp })) };
}

/**
 * Schritt 2 — per `nachAntwortWeiter`: warten, dann schreiben, was noch diese
 * Marke trägt. Die Marke wird in einer Transaktion abgenommen; gleiche
 * Eingabe wie beim letzten Inhalt (z. B. nur gespeichert, nichts geändert)
 * kostet keinen Aufruf. Wirft nie.
 */
export async function gameplaeneNachScouting(
  db: Firestore,
  marke: ScoutingMarke,
  a: { frist: number; aufschubMs?: number },
): Promise<NachlaufErgebnis[]> {
  if (marke.betroffen.length === 0) return [];
  await new Promise((r) => setTimeout(r, a.aufschubMs ?? SCOUTING_AUFSCHUB_MS));
  try {
    return await schreibeReihe(db, marke.betroffen, a.frist, (camp) =>
      db.runTransaction(async (tx) => {
        const ref = gameplanRef(db, camp.studentUid, camp.id);
        const snap = await tx.get(ref);
        if ((snap.data() as GameplanDoc | undefined)?.aufschubId !== marke.aufschubId) return false;
        tx.set(ref, { aufschubId: null, aufschubBis: null }, { merge: true });
        return true;
      }),
    );
  } catch {
    return [];
  }
}
