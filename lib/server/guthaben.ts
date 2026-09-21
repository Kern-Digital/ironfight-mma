/**
 * DIE SCHRANKE — Schritt 2 des Geschäftsplans (21.09.2026).
 *
 * Hier wird gezählt, und zwar BEIM START (Konzept §6, Leon 20.09.: „Beim
 * Start (Empfohlen)"): Die Analyse-Route nimmt eine Analyse aus dem Guthaben,
 * BEVOR Gemini das Video sieht — denn ab dem Moment ist das Geld weg. Geht
 * danach etwas schief, gibt die Route sie zurück („Ein Fehler der App gibt
 * die Analyse zurück").
 *
 * WAS ZÄHLT: EIN Aufruf mit Video-Beobachtung = EINE Analyse = EINE
 * ausgewertete Person. Der zweite Aufruf desselben Ablaufs (die Bewertung,
 * `body.observation` liegt bei) zählt NICHT — sonst kostete jede Analyse
 * zwei. Aus demselben Grund kostet ein Wiederholungsversuch auf einer
 * vorhandenen Beobachtung nichts.
 *
 * WAS NICHT ZÄHLT: Der Vorlauf (kurzes Reinschauen, Rahmen suchen). Leon
 * 21.09.: „frei tagesbremse 60 stk. aber das muss nicht extra irgendwo stehen
 * es soll im hintergrund passieren." Also: kein Zähler in der Oberfläche,
 * keine Anzeige — nur eine stille Bremse bei 60 Vorläufen je Gym und Tag
 * (rund 60 Cent). Sie greift im Alltag nie; sie fängt den Unfall.
 *
 * KEIN TAGESDECKEL AUF ANALYSEN (Leon 21.09.: „Kein Deckel für zahlende
 * Gyms"). Das Guthaben ist die einzige Grenze — ein Gratis-Gym hat ohnehin
 * nur drei. Der im Konzept vom 20.09. vorgesehene Deckel „drei je Gym und
 * Tag" ist damit hinfällig.
 *
 * FAIL-CLOSED, anders als beim Stilllegen: Lässt sich das Guthaben nicht
 * lesen, startet KEINE Analyse. Ein Lesefehler darf hier nicht Geld kosten.
 * (Die Ausnahme ist die Vorlauf-Bremse — die ist eine Bequemlichkeit, kein
 * Kassenhäuschen, und lässt im Zweifel durch.)
 */

import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { FREIE_ANALYSEN } from "../gym";
import {
  VORLAUF_JE_TAG,
  decodeGuthabenPosten,
  naechsterPosten,
  standAusPosten,
  tagSchluessel,
  verfallsDatum,
  type GuthabenGrund,
  type GuthabenPosten,
} from "../guthaben";

export interface Abbuchung {
  ok: true;
  /** Der Posten, aus dem sie ging — für die Rückgabe bei einem Fehler. */
  postenId: string;
  /** Was nach dieser Analyse noch übrig ist. */
  rest: number;
}

export type Buchung = Abbuchung | { ok: false; rest: number };

/**
 * Eine Analyse abziehen. Alles in EINER Transaktion, damit zwei gleichzeitige
 * Starts nicht denselben letzten Rest verbrauchen.
 */
export async function nimmEineAnalyse(
  dbHolen: () => Firestore,
  gymId: string,
  uid: string,
): Promise<Buchung> {
  const jetzt = new Date();
  try {
    const db = dbHolen();
    const gymRef = db.collection("gyms").doc(gymId);
    const postenColl = gymRef.collection("guthaben");

    return await db.runTransaction(async (tx) => {
      // ALLE Lesevorgänge zuerst — Firestore erlaubt nach dem ersten
      // Schreiben kein Lesen mehr in derselben Transaktion.
      const [gymSnap, postenSnap] = await Promise.all([tx.get(gymRef), tx.get(postenColl)]);
      const posten: GuthabenPosten[] = postenSnap.docs.map((d) =>
        decodeGuthabenPosten(d.id, d.data() as Record<string, unknown>),
      );

      // Die drei geschenkten entstehen beim ersten Mal — hier, in derselben
      // Transaktion, zusammen mit der Marke am Gym. Doppelt schenken geht so
      // nicht, auch nicht bei zwei gleichzeitigen Starts.
      const gratisOffen = !gymSnap.get("guthabenStart");
      const alle = [...posten];
      const gratisRef = gratisOffen ? postenColl.doc() : null;
      if (gratisRef) {
        alle.push({
          id: gratisRef.id,
          menge: FREIE_ANALYSEN,
          verbraucht: 0,
          grund: "gratis",
          erstelltAm: jetzt,
          verfaelltAm: null,
        });
      }

      const gewaehlt = naechsterPosten(alle, jetzt);
      const standVorher = standAusPosten(alle, false, jetzt);
      if (!gewaehlt) return { ok: false as const, rest: standVorher.rest };

      const gratisIstDran = gratisRef !== null && gewaehlt.id === gratisRef.id;
      if (gratisRef) {
        tx.create(gratisRef, {
          menge: FREIE_ANALYSEN,
          // Geht die erste Analyse gleich aus dem Geschenk, wird der Posten
          // direkt mit 1 angelegt — zweimal auf dasselbe Dokument schreiben
          // muss in einer Transaktion niemand.
          verbraucht: gratisIstDran ? 1 : 0,
          grund: "gratis" satisfies GuthabenGrund,
          erstelltAm: Timestamp.fromDate(jetzt),
          verfaelltAm: null,
          paket: null,
        });
        tx.set(gymRef, { guthabenStart: Timestamp.fromDate(jetzt) }, { merge: true });
      }
      if (!gratisIstDran) {
        tx.update(postenColl.doc(gewaehlt.id), { verbraucht: FieldValue.increment(1) });
      }
      tx.set(
        gymRef.collection("guthabenNutzung").doc(uid),
        { anzahl: FieldValue.increment(1), zuletzt: Timestamp.fromDate(jetzt) },
        { merge: true },
      );

      return { ok: true as const, postenId: gewaehlt.id, rest: standVorher.rest - 1 };
    });
  } catch {
    // Fail-closed: lieber eine Analyse verweigern als eine verschenken.
    return { ok: false, rest: 0 };
  }
}

/**
 * Die Analyse zurückgeben — wenn die App es war, nicht der Trainer (Konzept
 * §6). Wirft nie: Eine fehlgeschlagene Rückgabe darf den Fehler davor nicht
 * verdecken.
 */
export async function gibAnalyseZurueck(
  dbHolen: () => Firestore,
  gymId: string,
  postenId: string,
  uid: string,
): Promise<void> {
  try {
    const db = dbHolen();
    const gymRef = db.collection("gyms").doc(gymId);
    const postenRef = gymRef.collection("guthaben").doc(postenId);
    const nutzRef = gymRef.collection("guthabenNutzung").doc(uid);
    await db.runTransaction(async (tx) => {
      const [postenSnap, nutzSnap] = await Promise.all([tx.get(postenRef), tx.get(nutzRef)]);
      if (!postenSnap.exists) return;
      const verbraucht = Number(postenSnap.get("verbraucht") ?? 0);
      if (verbraucht <= 0) return;
      tx.update(postenRef, { verbraucht: verbraucht - 1 });
      const anzahl = Number(nutzSnap.get("anzahl") ?? 0);
      if (anzahl > 0) tx.update(nutzRef, { anzahl: anzahl - 1 });
    });
  } catch {
    /* still */
  }
}

/**
 * Die stille Tagesbremse für Vorläufe (60 je Gym und Tag, deutsche Zeit).
 * Zählt am Gym-Dokument mit — eine eigene Sammlung wäre für einen Zähler zu
 * viel. Gibt `false` zurück, wenn heute nichts mehr geht.
 */
export async function vorlaufErlaubt(
  dbHolen: () => Firestore,
  gymId: string,
): Promise<boolean> {
  try {
    const db = dbHolen();
    const gymRef = db.collection("gyms").doc(gymId);
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(gymRef);
      const heute = tagSchluessel();
      const tag = snap.get("vorlaufTag") as { tag?: string; anzahl?: number } | undefined;
      const bisher = tag?.tag === heute ? Number(tag.anzahl ?? 0) : 0;
      if (bisher >= VORLAUF_JE_TAG) return false;
      tx.set(gymRef, { vorlaufTag: { tag: heute, anzahl: bisher + 1 } }, { merge: true });
      return true;
    });
  } catch {
    // Fail-open: die Bremse ist eine Bequemlichkeit, kein Kassenhäuschen.
    return true;
  }
}

/**
 * Analysen gutschreiben — heute für Schritt 3 (Stripe) und für die Hand des
 * Plattform-Admins. Gekaufte Posten verfallen nach 24 Monaten (Leon 20.09.).
 */
export async function schreibeGut(
  dbHolen: () => Firestore,
  gymId: string,
  menge: number,
  grund: GuthabenGrund = "paket",
  paket: string | null = null,
): Promise<string> {
  const jetzt = new Date();
  const ref = dbHolen().collection("gyms").doc(gymId).collection("guthaben").doc();
  await ref.create({
    menge: Math.max(1, Math.round(menge)),
    verbraucht: 0,
    grund,
    erstelltAm: Timestamp.fromDate(jetzt),
    verfaelltAm: grund === "gratis" ? null : Timestamp.fromDate(verfallsDatum(jetzt)),
    paket,
  });
  return ref.id;
}
