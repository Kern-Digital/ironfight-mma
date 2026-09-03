/**
 * Kampfprofil (FightProfile) — die DeepFight-Daten eines eigenen Nutzers.
 *
 * Dieselbe Grundform wie beim Gegner (`opponents/{id}`: dna + dnaSplit +
 * actionStats). Damit haben Schüler, Trainer und Gegner denselben Aufbau:
 *   • Gegner  → opponents/{id} (flach auf dem Dokument)
 *   • Nutzer  → users/{uid}/fightProfile/main (dieses Modul)
 *
 * WARUM EINE UNTER-SAMMLUNG UND KEIN FELD MEHR (seit 03.09.2026): Das
 * Kampfprofil ist die AUSWERTUNG der DeepFight-Analysen — und die soll ein
 * Trainer bei einem KOLLEGEN nur mit dessen Freigabe sehen (Leon). Regeln
 * können keine Felder verbergen, nur Dokumente; das users-Dokument muss aber
 * für die Namensliste lesbar bleiben. Also eine Ebene tiefer, mit eigener
 * Regel (firestore.rules, `canAccessMemberData`). Bis die Migration
 * (`scripts/migrate-private-profile.mjs`) gelaufen ist, fällt `getFightProfile`
 * auf das alte Feld zurück — NUR wenn das neue Dokument fehlt, nie bei
 * verweigertem Zugriff.
 *
 * Das Kampfprofil ist das MERGE-ZIEL der KI-Video-Analysen im Athleten-Modus
 * (mode="athlete") — jede übernommene Analyse präzisiert es. Gepflegt wird es
 * ausschließlich von Trainern/Admins (Firestore-Regel: Trainer-Update nur auf
 * das Feld `fightProfile`; der Owner selbst darf es nicht schreiben, wohl aber
 * lesen — der Schüler sieht sein volles Profil unter /kampfprofil).
 */

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { getFirestoreDb } from "./firebase";
import { pruneAnswers, type GegnerDnaAnswers } from "./gegner-dna";
import {
  cleanActionStats,
  cleanDnaSplit,
  isDnaSplitEmpty,
  type ActionStat,
  type DnaSplit,
} from "./fight-stats";

export interface FightProfile {
  /** Qualitative DNA-Antworten (questionId → Freitext), gleiche IDs wie beim Gegner. */
  dna: GegnerDnaAnswers;
  /** §1 Fight-DNA-Split — prozentuale Verteilung der Kampfbereiche. */
  dnaSplit: DnaSplit | null;
  /**
   * Summe der Video-Gewichte, die bereits in `dnaSplit` eingeflossen sind.
   * Nötig, damit ein neues Video nur seinen Anteil bekommt statt pauschal der
   * Hälfte (siehe mergeDnaSplit in lib/fight-stats.ts). 0 = noch nichts gezählt.
   */
  dnaSplitWeight: number;
  /** §2 Action-Stats — gezählte Techniken (Versuche/Treffer/Zone/Setup). */
  actionStats: ActionStat[];
  updatedBy: string | null;
  updatedAt: Date | null;
}

export type FightProfilePatch = Partial<
  Pick<
    FightProfile,
    "dna" | "dnaSplit" | "dnaSplitWeight" | "actionStats" | "updatedBy"
  >
>;

type FightProfileDoc = {
  dna?: GegnerDnaAnswers;
  dnaSplit?: DnaSplit | null;
  dnaSplitWeight?: number;
  actionStats?: ActionStat[];
  updatedBy?: string | null;
  updatedAt?: Timestamp;
};

export function emptyFightProfile(): FightProfile {
  return {
    dna: {},
    dnaSplit: null,
    dnaSplitWeight: 0,
    actionStats: [],
    updatedBy: null,
    updatedAt: null,
  };
}

export function isFightProfileEmpty(p: FightProfile | null | undefined): boolean {
  if (!p) return true;
  return (
    Object.keys(p.dna).length === 0 &&
    isDnaSplitEmpty(p.dnaSplit) &&
    cleanActionStats(p.actionStats).length === 0
  );
}

function decode(data: FightProfileDoc | undefined | null): FightProfile {
  if (!data) return emptyFightProfile();
  return {
    dna: data.dna ?? {},
    dnaSplit: data.dnaSplit ?? null,
    dnaSplitWeight: data.dnaSplitWeight ?? 0,
    actionStats: data.actionStats ?? [],
    updatedBy: data.updatedBy ?? null,
    updatedAt: data.updatedAt?.toDate() ?? null,
  };
}

function userRef(uid: string) {
  return doc(getFirestoreDb(), "users", uid);
}

/** Die Heimat des Kampfprofils (siehe Kopfkommentar). */
export function fightProfileRef(uid: string) {
  return doc(getFirestoreDb(), "users", uid, "fightProfile", "main");
}

/** Liest das Kampfprofil eines Nutzers (leer, wenn noch keins existiert). */
export async function getFightProfile(uid: string): Promise<FightProfile> {
  const snap = await getDoc(fightProfileRef(uid));
  if (snap.exists()) return decode(snap.data() as FightProfileDoc);
  // Übergang: altes Feld am users-Dokument (bis zur Migration).
  const alt = await getDoc(userRef(uid));
  if (!alt.exists()) return emptyFightProfile();
  return decode(alt.data().fightProfile as FightProfileDoc | undefined);
}

/**
 * Patcht das Kampfprofil (Trainer/Admin). Nicht übergebene Felder bleiben
 * erhalten; übergebene werden bereinigt gespeichert (keine leeren Antworten,
 * undefined-frei — analog zu lib/opponents.ts).
 */
export async function updateFightProfile(
  uid: string,
  patch: FightProfilePatch,
): Promise<void> {
  const current = await getFightProfile(uid);
  const dna = pruneAnswers(patch.dna ?? current.dna);
  const split = cleanDnaSplit(patch.dnaSplit ?? current.dnaSplit);
  const actionStats = cleanActionStats(patch.actionStats ?? current.actionStats);
  const body: FightProfileDoc = {
    dna,
    dnaSplit: isDnaSplitEmpty(split) ? null : split,
    dnaSplitWeight: Math.max(
      0,
      patch.dnaSplitWeight ?? current.dnaSplitWeight ?? 0,
    ),
    actionStats,
    updatedBy: patch.updatedBy ?? current.updatedBy ?? null,
  };
  // Dokument komplett ersetzen (kein Merge) — sonst blieben gelöschte
  // Antworten als Firestore-Map-Keys stehen.
  await setDoc(fightProfileRef(uid), { ...body, updatedAt: serverTimestamp() });
}
