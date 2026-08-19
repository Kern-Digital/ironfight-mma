/**
 * Gegner-DNA-Bibliothek — gym-weit geteilte Gegnerprofile.
 *
 * Ein "Opponent" ist das eigenständige, wiederverwendbare Gegner-DNA-Profil:
 * Grunddaten (Gegnerprofil) + strukturierte Scouting-Antworten (Gegner-DNA).
 * Trainer desselben Gyms sehen, suchen, öffnen und bearbeiten dieselben
 * Profile. Beim Anlegen eines Wettkampfs wird ein Snapshot dieses Profils in
 * den Wettkampf kopiert (siehe lib/fight-camp.ts), damit alte Wettkämpfe die
 * damalige DNA behalten.
 *
 * Firestore-Schema (top-level, gym-geteilt):
 *   opponents/{opponentId}
 *     gymId, name, style, stance, Maße, strengths/weaknesses/favoriteAttacks,
 *     notes, dna{}, createdBy, createdByName, createdAt, updatedAt, updatedBy
 *
 * Sichtbarkeit: Trainer/Admins (Firestore-Regeln). Gym-Trennung erfolgt über
 * das `gymId`-Feld + `belongsToGym` (lib/gym.ts). Aktuell ein Gym.
 */

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirestoreDb } from "./firebase";
import { belongsToGym } from "./gym";
import type { GegnerDnaAnswers } from "./gegner-dna";
import {
  cleanActionStats,
  cleanDnaSplit,
  isDnaSplitEmpty,
  type ActionStat,
  type DnaSplit,
} from "./fight-stats";
import type {
  FighterStance,
  FightStyle,
  OpponentProfile,
} from "./fight-camp";

export interface Opponent {
  id: string;
  gymId: string;
  name: string;
  style: FightStyle;
  stance: FighterStance;
  heightCm: number | null;
  weightKg: number | null;
  reachCm: number | null;
  strengths: string[];
  weaknesses: string[];
  favoriteAttacks: string[];
  notes: string | null;
  /** Strukturierte Gegner-DNA-Antworten (questionId → Freitext). */
  dna: GegnerDnaAnswers;
  /** §1 Fight-DNA-Split — prozentuale Verteilung der Kampfbereiche (optional). */
  dnaSplit?: DnaSplit | null;
  /** §2 Action-Stats — gezählte Techniken (Versuche/Treffer/Zone/Setup, optional). */
  actionStats?: ActionStat[];
  /**
   * Schüler-uids, für die der Trainer dieses Profil freigegeben hat.
   * Freigegebene Schüler sehen das Profil read-only unter „Mein DeepFight"
   * (Firestore-Regel: read via array-contains).
   */
  sharedWith: string[];
  createdBy: string;
  createdByName: string | null;
  updatedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
  isDemo?: boolean;
}

/** Eingabe zum Anlegen — alles außer den Server-/ID-Feldern. */
export type OpponentInput = Omit<
  Opponent,
  "id" | "createdAt" | "updatedAt" | "sharedWith"
> & { sharedWith?: string[] };

/** Felder, die beim Bearbeiten gepatcht werden dürfen. */
export type OpponentPatch = Partial<
  Pick<
    Opponent,
    | "name"
    | "style"
    | "stance"
    | "heightCm"
    | "weightKg"
    | "reachCm"
    | "strengths"
    | "weaknesses"
    | "favoriteAttacks"
    | "notes"
    | "dna"
    | "dnaSplit"
    | "actionStats"
    | "updatedBy"
  >
>;

type OpponentDoc = {
  gymId: string;
  name: string;
  style: FightStyle;
  stance: FighterStance;
  heightCm: number | null;
  weightKg: number | null;
  reachCm: number | null;
  strengths: string[];
  weaknesses: string[];
  favoriteAttacks: string[];
  notes: string | null;
  dna: GegnerDnaAnswers;
  dnaSplit?: DnaSplit | null;
  actionStats?: ActionStat[];
  sharedWith?: string[];
  createdBy: string;
  createdByName: string | null;
  updatedBy?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  isDemo?: boolean;
};

function opponentsCol() {
  return collection(getFirestoreDb(), "opponents");
}

function opponentDoc(id: string) {
  return doc(getFirestoreDb(), "opponents", id);
}

/** Entfernt leere Antworten — hält die gespeicherte DNA schlank & undefined-frei. */
function cleanDna(dna: GegnerDnaAnswers | undefined): GegnerDnaAnswers {
  const out: GegnerDnaAnswers = {};
  if (!dna) return out;
  for (const [k, v] of Object.entries(dna)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}

function decode(id: string, d: OpponentDoc): Opponent {
  return {
    id,
    gymId: d.gymId,
    name: d.name,
    style: d.style,
    stance: d.stance,
    heightCm: d.heightCm ?? null,
    weightKg: d.weightKg ?? null,
    reachCm: d.reachCm ?? null,
    strengths: d.strengths ?? [],
    weaknesses: d.weaknesses ?? [],
    favoriteAttacks: d.favoriteAttacks ?? [],
    notes: d.notes ?? null,
    dna: d.dna ?? {},
    dnaSplit: d.dnaSplit ?? null,
    actionStats: d.actionStats ?? [],
    sharedWith: d.sharedWith ?? [],
    createdBy: d.createdBy,
    createdByName: d.createdByName ?? null,
    updatedBy: d.updatedBy ?? null,
    createdAt: d.createdAt?.toDate() ?? new Date(),
    updatedAt: d.updatedAt?.toDate() ?? d.createdAt?.toDate() ?? new Date(),
    isDemo: d.isDemo,
  };
}

// ─── CRUD ──────────────────────────────────────────────────────────────────

export async function createOpponent(input: OpponentInput): Promise<Opponent> {
  const ref = doc(opponentsCol());
  const body: OpponentDoc = {
    gymId: input.gymId,
    name: input.name.trim() || "Unbekannter Gegner",
    style: input.style,
    stance: input.stance,
    heightCm: input.heightCm ?? null,
    weightKg: input.weightKg ?? null,
    reachCm: input.reachCm ?? null,
    strengths: input.strengths ?? [],
    weaknesses: input.weaknesses ?? [],
    favoriteAttacks: input.favoriteAttacks ?? [],
    notes: input.notes?.trim() || null,
    dna: cleanDna(input.dna),
    sharedWith: input.sharedWith ?? [],
    createdBy: input.createdBy,
    createdByName: input.createdByName ?? null,
    updatedBy: input.createdBy,
  };
  const split = cleanDnaSplit(input.dnaSplit);
  if (!isDnaSplitEmpty(split)) body.dnaSplit = split;
  const actions = cleanActionStats(input.actionStats);
  if (actions.length > 0) body.actionStats = actions;
  if (input.isDemo) body.isDemo = true;
  await setDoc(ref, {
    ...body,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const now = new Date();
  return { ...decode(ref.id, body), createdAt: now, updatedAt: now };
}

export async function updateOpponent(
  id: string,
  patch: OpponentPatch,
): Promise<void> {
  const data: Partial<OpponentDoc> = {};
  if (patch.name !== undefined) data.name = patch.name.trim() || "Unbekannter Gegner";
  if (patch.style !== undefined) data.style = patch.style;
  if (patch.stance !== undefined) data.stance = patch.stance;
  if (patch.heightCm !== undefined) data.heightCm = patch.heightCm ?? null;
  if (patch.weightKg !== undefined) data.weightKg = patch.weightKg ?? null;
  if (patch.reachCm !== undefined) data.reachCm = patch.reachCm ?? null;
  if (patch.strengths !== undefined) data.strengths = patch.strengths;
  if (patch.weaknesses !== undefined) data.weaknesses = patch.weaknesses;
  if (patch.favoriteAttacks !== undefined)
    data.favoriteAttacks = patch.favoriteAttacks;
  if (patch.notes !== undefined) data.notes = patch.notes?.trim() || null;
  if (patch.dna !== undefined) data.dna = cleanDna(patch.dna);
  if (patch.dnaSplit !== undefined) {
    const split = cleanDnaSplit(patch.dnaSplit);
    data.dnaSplit = isDnaSplitEmpty(split) ? null : split;
  }
  if (patch.actionStats !== undefined)
    data.actionStats = cleanActionStats(patch.actionStats);
  if (patch.updatedBy !== undefined) data.updatedBy = patch.updatedBy ?? null;
  await updateDoc(opponentDoc(id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function getOpponent(id: string): Promise<Opponent | null> {
  const snap = await getDoc(opponentDoc(id));
  if (!snap.exists()) return null;
  return decode(snap.id, snap.data() as OpponentDoc);
}

export async function deleteOpponent(id: string): Promise<void> {
  await deleteDoc(opponentDoc(id));
}

/**
 * Lädt alle Gegner-DNA-Profile des Gyms (neueste zuerst). Fehlt der Index für
 * die `where + orderBy`-Kombination, wird ohne orderBy geladen und sortiert.
 */
export async function listOpponentsForGym(gymId: string): Promise<Opponent[]> {
  const col = opponentsCol();
  try {
    const snap = await getDocs(
      query(col, where("gymId", "==", gymId), orderBy("updatedAt", "desc")),
    );
    return snap.docs.map((d) => decode(d.id, d.data() as OpponentDoc));
  } catch {
    const snap = await getDocs(col);
    return snap.docs
      .map((d) => decode(d.id, d.data() as OpponentDoc))
      .filter((o) => belongsToGym(o.gymId, gymId))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
}

// ─── Schüler-Freigabe ────────────────────────────────────────────────────────

/** Setzt die Schüler-Freigaben eines Profils (ersetzt die komplette Liste). */
export async function updateOpponentSharing(
  id: string,
  sharedWith: string[],
  updatedBy?: string | null,
): Promise<void> {
  await updateDoc(opponentDoc(id), {
    sharedWith,
    updatedBy: updatedBy ?? null,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Für einen Schüler freigegebene Gegnerprofile (read-only Sicht
 * „Mein DeepFight"). Bewusst ohne orderBy — kein Composite-Index nötig,
 * sortiert wird clientseitig.
 */
export async function listOpponentsSharedWith(uid: string): Promise<Opponent[]> {
  const snap = await getDocs(
    query(opponentsCol(), where("sharedWith", "array-contains", uid)),
  );
  return snap.docs
    .map((d) => decode(d.id, d.data() as OpponentDoc))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

// ─── Snapshot-Konvertierung ──────────────────────────────────────────────────

/**
 * Erzeugt aus einem geteilten Gegner-DNA-Profil den eingefrorenen Snapshot,
 * der in einen Wettkampf kopiert wird (OpponentProfile mit opponentId-Verweis).
 */
export function opponentToSnapshot(o: Opponent): OpponentProfile {
  const snap: OpponentProfile = {
    name: o.name,
    style: o.style,
    stance: o.stance,
    heightCm: o.heightCm,
    weightKg: o.weightKg,
    reachCm: o.reachCm,
    strengths: o.strengths,
    weaknesses: o.weaknesses,
    favoriteAttacks: o.favoriteAttacks,
    opponentId: o.id,
  };
  if (o.notes) snap.notes = o.notes;
  if (o.dna && Object.keys(o.dna).length > 0) snap.dna = { ...o.dna };
  if (!isDnaSplitEmpty(o.dnaSplit)) snap.dnaSplit = cleanDnaSplit(o.dnaSplit);
  const actions = cleanActionStats(o.actionStats);
  if (actions.length > 0) snap.actionStats = actions;
  return snap;
}

// ─── Suche (clientseitig) ────────────────────────────────────────────────────

/** Einfache Volltextsuche über Name, Notizen und DNA-Antworten. */
export function searchOpponents(list: Opponent[], queryStr: string): Opponent[] {
  const q = queryStr.trim().toLowerCase();
  if (!q) return list;
  return list.filter((o) => {
    if (o.name.toLowerCase().includes(q)) return true;
    if ((o.notes ?? "").toLowerCase().includes(q)) return true;
    if (o.strengths.some((s) => s.toLowerCase().includes(q))) return true;
    if (o.weaknesses.some((s) => s.toLowerCase().includes(q))) return true;
    if (o.favoriteAttacks.some((s) => s.toLowerCase().includes(q))) return true;
    if (Object.values(o.dna).some((v) => v.toLowerCase().includes(q)))
      return true;
    return false;
  });
}
