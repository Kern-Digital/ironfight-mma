/**
 * DEEPFIGHT-GUTHABEN — Schritt 2 des Geschäftsplans (21.09.2026).
 *
 * Bezahlt wird allein DeepFight, gezählt in Analysen (Konzept §6). Das
 * Guthaben liegt NICHT als eine Zahl am Gym, sondern als POSTEN in
 * `gyms/{gymId}/guthaben/{postenId}` — denn Leon hat am 20.09. „Verfall nach
 * 24 Monaten" entschieden, und ein Verfall braucht ein Datum je Kauf. Eine
 * einzelne Zahl könnte nicht sagen, WELCHE Analysen wann ablaufen.
 *
 * Ein Posten: `menge` gekauft (oder geschenkt), `verbraucht` davon weg,
 * `verfaelltAm` = null bei den drei geschenkten (Leon: „einmalig,
 * vollständig, ohne Ablauf"), sonst Kaufdatum + 24 Monate.
 *
 * DIE DREI GESCHENKTEN ENTSTEHEN ERST BEIM ERSTEN MAL. Solange am Gym kein
 * `guthabenStart` steht, gilt das Geschenk als offen — Client und Server
 * rechnen es hier an derselben Stelle dazu (`gratisOffen`). So braucht kein
 * Bestands-Gym eine Wanderung, und doppelt schenken kann sich niemand: Der
 * Server legt den Posten in derselben Transaktion an, in der er die erste
 * Analyse abzieht, und setzt dabei `guthabenStart`.
 *
 * Diese Datei ist die EINE Rechenstelle für beide Seiten. Der Server zieht ab
 * (lib/server/guthaben.ts), der Client zeigt nur an.
 */

import { FREIE_ANALYSEN } from "./gym";

/** Vorläufe (kurzes Reinschauen + Rahmen suchen) je Gym und Tag. */
export const VORLAUF_JE_TAG = 60;

/** Monate bis ein gekaufter Posten verfällt (Leon 20.09.2026). */
export const VERFALL_MONATE = 24;

/** Der Satz, wenn nichts mehr übrig ist. EINE Stelle für Client und Server. */
export const KEIN_GUTHABEN_TEXT =
  "Eure Analysen sind aufgebraucht. Holt euch neue, dann geht es sofort weiter.";

/**
 * `abo` seit Schritt 3 (21.09.2026): je bezahlter Abo-Rechnung ein Posten
 * (im Jahresabo zwölf, einer je Monat). `paket` ist seitdem der NACHKAUF.
 */
export type GuthabenGrund = "gratis" | "paket" | "abo" | "gutschrift";

export interface GuthabenPosten {
  id: string;
  /** Gekaufte oder geschenkte Analysen dieses Postens. */
  menge: number;
  /** Davon schon verbraucht. */
  verbraucht: number;
  grund: GuthabenGrund;
  erstelltAm: Date | null;
  /** null = ohne Ablauf (die drei geschenkten). */
  verfaelltAm: Date | null;
  /**
   * Ab wann der Posten zählt. null = sofort. Das Jahresabo wird einmal
   * bezahlt, die Analysen kommen trotzdem Monat für Monat (Leon 21.09.) —
   * der Webhook legt deshalb zwölf Posten an, jeden mit seinem Monat.
   */
  abAm?: Date | null;
  /** Paketgröße beim Kauf, z. B. "60" — nur zur Anzeige. */
  paket?: string | null;
}

export interface GuthabenStand {
  /** Was heute noch startbar ist. */
  rest: number;
  /**
   * Davon aus GEKAUFTEN Paketen — das, was auch ein stillgelegtes Gym noch
   * aufbrauchen darf (Leon 21.09.2026).
   */
  restBezahlt: number;
  /** Alles, was jemals gültig war und noch nicht verfallen ist. */
  gesamt: number;
  verbraucht: number;
  /** Der nächste Ablauf — für den Hinweis „X verfallen am …". */
  naechsterVerfall: { am: Date; menge: number } | null;
  /** Der nächste schon bezahlte Posten, der erst noch kommt (Jahresabo). */
  naechsteGutschrift: { am: Date; menge: number } | null;
  posten: GuthabenPosten[];
}

/**
 * Ein Posten, der wirklich BEZAHLT wurde. Wichtig seit dem 21.09.2026: Ein
 * stillgelegtes Gym darf genau das aufbrauchen, wofür es Geld gegeben hat
 * (Leon: „Bezahlt ist bezahlt"). Das Geschenk und eine Gutschrift zählen
 * dabei NICHT — wer nie gezahlt hat, hat auch nichts gut.
 */
export function istBezahlt(p: GuthabenPosten): boolean {
  return p.grund === "paket" || p.grund === "abo";
}

/** Was von einem Posten noch übrig ist (nie negativ). */
export function restVonPosten(p: GuthabenPosten): number {
  return Math.max(0, p.menge - Math.max(0, p.verbraucht));
}

function gueltig(p: GuthabenPosten, jetzt: Date): boolean {
  if (p.abAm && p.abAm.getTime() > jetzt.getTime()) return false;
  return !p.verfaelltAm || p.verfaelltAm.getTime() > jetzt.getTime();
}

/**
 * Der Stand aus den Posten. `gratisOffen` = am Gym fehlt `guthabenStart`,
 * die drei geschenkten Analysen sind also noch nicht angelegt und zählen
 * trotzdem mit.
 */
export function standAusPosten(
  posten: GuthabenPosten[],
  gratisOffen: boolean,
  jetzt: Date = new Date(),
): GuthabenStand {
  const offen = posten.filter((p) => gueltig(p, jetzt));
  let rest = offen.reduce((s, p) => s + restVonPosten(p), 0);
  let gesamt = offen.reduce((s, p) => s + Math.max(0, p.menge), 0);
  const verbraucht = gesamt - rest;
  if (gratisOffen) {
    rest += FREIE_ANALYSEN;
    gesamt += FREIE_ANALYSEN;
  }

  const ablaufend = offen
    .filter((p) => p.verfaelltAm && restVonPosten(p) > 0)
    .sort((a, b) => a.verfaelltAm!.getTime() - b.verfaelltAm!.getTime());
  const naechster = ablaufend[0];
  const kommend = posten
    .filter((p) => p.abAm && p.abAm.getTime() > jetzt.getTime())
    .sort((a, b) => a.abAm!.getTime() - b.abAm!.getTime())[0];

  return {
    rest,
    restBezahlt: offen.filter(istBezahlt).reduce((s, p) => s + restVonPosten(p), 0),
    gesamt,
    verbraucht,
    naechsterVerfall: naechster
      ? { am: naechster.verfaelltAm!, menge: restVonPosten(naechster) }
      : null,
    naechsteGutschrift: kommend ? { am: kommend.abAm!, menge: restVonPosten(kommend) } : null,
    posten: offen,
  };
}

/**
 * Der Posten, aus dem die nächste Analyse gehen soll: der, der ZUERST
 * verfällt. Geschenkte (ohne Ablauf) kommen zuletzt dran — sonst wäre ein
 * gekauftes Paket abgelaufen, während das Geschenk unberührt danebenliegt.
 */
export function naechsterPosten(
  posten: GuthabenPosten[],
  jetzt: Date = new Date(),
): GuthabenPosten | null {
  const moeglich = posten.filter((p) => gueltig(p, jetzt) && restVonPosten(p) > 0);
  if (!moeglich.length) return null;
  return moeglich.sort((a, b) => {
    const av = a.verfaelltAm?.getTime() ?? Number.POSITIVE_INFINITY;
    const bv = b.verfaelltAm?.getTime() ?? Number.POSITIVE_INFINITY;
    if (av !== bv) return av - bv;
    return (a.erstelltAm?.getTime() ?? 0) - (b.erstelltAm?.getTime() ?? 0);
  })[0];
}

/** Kaufdatum + 24 Monate. */
export function verfallsDatum(gekauftAm: Date = new Date()): Date {
  const d = new Date(gekauftAm.getTime());
  d.setMonth(d.getMonth() + VERFALL_MONATE);
  return d;
}

/**
 * Tagesschlüssel in DEUTSCHER Zeit („2026-09-21") — die Tagesbremse für
 * Vorläufe soll um Mitternacht in Deutschland umspringen, nicht in UTC.
 * `sv-SE` formatiert als Jahr-Monat-Tag; der Umweg über Intl ist der einzige
 * ohne Zeitzonen-Bibliothek.
 */
export function tagSchluessel(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(d);
}

/** Ein Firestore-Dokument → Posten. Timestamps kommen als `toDate()`. */
export function decodeGuthabenPosten(id: string, d: Record<string, unknown>): GuthabenPosten {
  const datum = (x: unknown): Date | null =>
    (x as { toDate?: () => Date } | undefined)?.toDate?.() ?? null;
  const grund = d.grund as GuthabenGrund | undefined;
  return {
    id,
    menge: Number(d.menge ?? 0),
    verbraucht: Number(d.verbraucht ?? 0),
    grund: grund === "paket" || grund === "abo" || grund === "gutschrift" ? grund : "gratis",
    erstelltAm: datum(d.erstelltAm),
    verfaelltAm: datum(d.verfaelltAm),
    abAm: datum(d.abAm),
    paket: (d.paket as string | undefined) ?? null,
  };
}

/**
 * DER STAND FÜR DIE OBERFLÄCHE (Client, Firestore-Web-SDK).
 *
 * Liest die Posten UND das Gym-Dokument — Letzteres nur wegen
 * `guthabenStart` (sind die drei geschenkten schon angelegt?). Kein Cache:
 * Wer auf den Analyse-Schirm schaut, will die Zahl von jetzt, und es sind
 * zwei bis drei Dokumente.
 */
export async function getGuthabenStand(gymId: string): Promise<GuthabenStand> {
  const { collection, doc, getDoc, getDocs } = await import("firebase/firestore");
  const { getFirestoreDb } = await import("./firebase");
  const db = getFirestoreDb();
  const [gymSnap, postenSnap] = await Promise.all([
    getDoc(doc(db, "gyms", gymId)),
    getDocs(collection(db, "gyms", gymId, "guthaben")),
  ]);
  const posten = postenSnap.docs.map((d) =>
    decodeGuthabenPosten(d.id, d.data() as Record<string, unknown>),
  );
  return standAusPosten(posten, !gymSnap.get("guthabenStart"));
}

/**
 * Wie oft welcher Trainer gestartet hat (Konzept §6: „Verwaltung sieht Stand
 * und Nutzung je Trainer"). Ein Dokument je Trainer, geschrieben vom Server.
 */
export interface GuthabenNutzung {
  uid: string;
  anzahl: number;
  zuletzt: Date | null;
}

export async function listGuthabenNutzung(gymId: string): Promise<GuthabenNutzung[]> {
  const { collection, getDocs } = await import("firebase/firestore");
  const { getFirestoreDb } = await import("./firebase");
  const snap = await getDocs(collection(getFirestoreDb(), "gyms", gymId, "guthabenNutzung"));
  return snap.docs
    .map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        uid: d.id,
        anzahl: Number(data.anzahl ?? 0),
        zuletzt:
          (data.zuletzt as { toDate?: () => Date } | undefined)?.toDate?.() ?? null,
      } satisfies GuthabenNutzung;
    })
    .sort((a, b) => b.anzahl - a.anzahl);
}
