/**
 * Gameplan eines Wettkampfs — dein Athlet gegen genau diesen Gegner, in der
 * Kampfart des Wettkampfs (Leon 17.09.2026).
 *
 * LEONS ENTSCHEIDUNGEN (17.09.2026, gewählte Optionen):
 *   • „Claude, nur mit Beleg" — Claude schreibt aus beiden DeepFight-Profilen;
 *     jeder Punkt nennt seinen Beleg (Videos, Zählung oder Scouting-Notiz).
 *   • „Nach jeder neuen Analyse automatisch" — die commit-Route stößt nach der
 *     Neuberechnung den Nachlauf an (lib/server/gameplan.ts). Beim Anlegen
 *     eines Wettkampfs und beim Nachtragen der Kampfart startet ihn die Seite.
 *   • „Drei Blöcke, Drills in den Plan" — Deine Waffen · Die Gefahren · So
 *     kämpfst du; die Drills erscheinen in Phase 2 (gegnerspezifisch) und
 *     Phase 3 (Sparring) des Trainingsplans.
 *   • Kampfart am Wettkampf ist Pflicht; bestehende Wettkämpfe wählen sie
 *     einmal auf der Seite („Kampfart einmal auf der Seite wählen").
 *
 * WO ER LIEGT: `users/{uid}/fightProfile/gameplan-{campId}` — NICHT am
 * Wettkampf-Dokument. Der Gameplan besteht aus dem DeepFight-Profil des
 * Athleten; am Camp (Bereich „wettkampf") läse ihn auch ein Trainer ohne
 * DeepFight-Freigabe. Die Regel für `fightProfile` passt genau: Inhaber und
 * Trainer mit DeepFight-Freigabe lesen, nur der Server schreibt.
 *
 * Datumsangaben als ISO-Text statt Timestamp: Client- und Admin-SDK lesen
 * dieselbe Form, ohne zwei Timestamp-Klassen auseinanderzuhalten.
 */

import { doc, onSnapshot } from "firebase/firestore";
import { getFirebaseAuth, getFirestoreDb } from "./firebase";
import type { AnalysisUsage, Sport } from "./video-analysis";

export type GameplanStatus = "schreibt" | "fertig" | "fehler" | "offen";

/** Warum (noch) kein Gameplan geschrieben wurde. */
export type GameplanOffen =
  | "kampfart" // Wettkampf ohne Kampfart (Bestand)
  | "athlet" // Athlet hat kein ausgewertetes Video in dieser Kampfart
  | "gegner" // Gegner ohne Video und ohne Scouting
  | "zeit"; // Nachlauf hatte kein Zeitbudget mehr — auf Knopfdruck nachholen

export interface GameplanPunkt {
  titel: string;
  text: string;
  /** Kurz: „Du: 4 von 5 Videos · Gegner: 3 Videos", „Jab 11 Versuche, 5 Treffer", „Scouting-Notiz". */
  beleg: string;
}

/** Phase 2 und 3 des Trainingsplans (lib/fight-camp.ts FightCampPhase). */
export type GameplanDrillPhase = "specific-prep" | "sparring-simulation";

export interface GameplanDrill {
  phase: GameplanDrillPhase;
  titel: string;
  text: string;
  /** Titel des Punkts, auf den der Drill einzahlt. */
  wofuer: string;
}

export interface GameplanInhalt {
  /** Ein bis zwei Sätze: Wie steht das Duell, wie belastbar sind die Belege? */
  lage: string;
  waffen: GameplanPunkt[];
  gefahren: GameplanPunkt[];
  soKaempfstDu: GameplanPunkt[];
  drills: GameplanDrill[];
}

/** Worauf der Gameplan steht — Stoff für „2 neue Analysen seit dem Gameplan". */
export interface GameplanStand {
  athletAnalysen: number;
  gegnerAnalysen: number;
  athletStaerke: number;
  gegnerStaerke: number;
  /** Trainer-Scouting am Gegner (Handeinträge, Stärken/Schwächen, Notizen). */
  gegnerScouting: boolean;
}

export interface Gameplan {
  campId: string;
  sport: Sport | null;
  status: GameplanStatus;
  /** Der zuletzt FERTIGE Inhalt — bleibt stehen, während ein neuer entsteht. */
  inhalt: GameplanInhalt | null;
  stand: GameplanStand | null;
  geschriebenAt: Date | null;
  gestartetAt: Date | null;
  offen: GameplanOffen | null;
  fehler: string | null;
  model: string | null;
  usage: AnalysisUsage | null;
}

/** Rohform in Firestore (Client- und Admin-SDK). */
export interface GameplanDoc {
  campId: string;
  sport?: Sport | null;
  status: GameplanStatus;
  inhalt?: GameplanInhalt | null;
  stand?: GameplanStand | null;
  geschriebenAt?: string | null;
  gestartetAt?: string | null;
  offen?: GameplanOffen | null;
  fehler?: string | null;
  model?: string | null;
  usage?: AnalysisUsage | null;
  /** Kennung des laufenden Schreibvorgangs — ein älterer Lauf überschreibt keinen jüngeren. */
  laufId?: string | null;
  /** Fingerabdruck der Eingabe des fertigen Inhalts — gleiche Eingabe, kein neuer Aufruf. */
  eingabeSchluessel?: string | null;
}

export const GAMEPLAN_PREFIX = "gameplan-";

export function gameplanDocId(campId: string): string {
  return `${GAMEPLAN_PREFIX}${campId}`;
}

const datum = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

export function decodeGameplan(d: GameplanDoc | undefined | null): Gameplan | null {
  if (!d) return null;
  return {
    campId: d.campId,
    sport: d.sport ?? null,
    status: d.status,
    inhalt: d.inhalt ?? null,
    stand: d.stand ?? null,
    geschriebenAt: datum(d.geschriebenAt),
    gestartetAt: datum(d.gestartetAt),
    offen: d.offen ?? null,
    fehler: d.fehler ?? null,
    model: d.model ?? null,
    usage: d.usage ?? null,
  };
}

/**
 * Ein „schreibt", das älter ist als das Zeitbudget der Funktion, ist kein
 * laufender Vorgang mehr (Funktion abgebrochen) — die Seite bietet dann
 * „Neu schreiben" an, statt ewig zu warten.
 */
export const GAMEPLAN_HAENGT_NACH_MS = 6 * 60_000;

export function gameplanHaengt(g: Gameplan | null, jetzt = Date.now()): boolean {
  return !!g && g.status === "schreibt" && !!g.gestartetAt && jetzt - g.gestartetAt.getTime() > GAMEPLAN_HAENGT_NACH_MS;
}

/** Drills einer Planphase (Phase 2 und 3). */
export function drillsFuerPhase(g: Gameplan | null, phase: string): GameplanDrill[] {
  return (g?.inhalt?.drills ?? []).filter((d) => d.phase === phase);
}

/**
 * Den Gameplan anstoßen (Client → /api/wettkampf/gameplan). Die Route antwortet
 * sofort; das Ergebnis kommt über `beobachteGameplan`. `erzwingen` schreibt
 * auch bei unveränderter Eingabe neu („Neu schreiben").
 */
export async function starteGameplan(uid: string, campId: string, erzwingen = false): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("Nicht angemeldet");
  const res = await fetch("/api/wettkampf/gameplan", {
    method: "POST",
    headers: { authorization: `Bearer ${await user.getIdToken()}`, "content-type": "application/json" },
    body: JSON.stringify({ uid, campId, erzwingen }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Gameplan konnte nicht starten (${res.status}).`);
  }
}

/**
 * Den Gameplan beobachten (Client). `onFehler` meldet z. B. eine fehlende
 * DeepFight-Freigabe (permission-denied). Liefert die Abmelde-Funktion.
 */
export function beobachteGameplan(
  uid: string,
  campId: string,
  onDaten: (g: Gameplan | null) => void,
  onFehler: (err: unknown) => void,
): () => void {
  return onSnapshot(
    doc(getFirestoreDb(), "users", uid, "fightProfile", gameplanDocId(campId)),
    (snap) => onDaten(snap.exists() ? decodeGameplan(snap.data() as GameplanDoc) : null),
    onFehler,
  );
}
