/**
 * Anfragen „Probetraining vereinbaren" — die Server-Seite (Etappe 4 der
 * Gym-Suche, 01.10.2026). Modell und Begründung: lib/gym-anfrage.ts.
 *
 * Alles hier läuft per Admin-SDK; für `gyms/{gymId}/anfragen` gibt es keine
 * Regel, im Browser ist die Sammlung zu.
 */

import { Timestamp, type DocumentSnapshot, type Firestore } from "firebase-admin/firestore";
import { ANFRAGE_TAGE, type GymAnfrage, type MeineAnfrage } from "@/lib/gym-anfrage";

const TAG_MS = 24 * 60 * 60 * 1000;

export function anfrageRef(db: Firestore, gymId: string, uid: string) {
  return db.collection("gyms").doc(gymId).collection("anfragen").doc(uid);
}

/** Wann eine Anfrage, die JETZT eingeht, gelöscht wird. */
export function loeschenAm(jetzt = Date.now()): Timestamp {
  return Timestamp.fromMillis(jetzt + ANFRAGE_TAGE * TAG_MS);
}

function ms(v: unknown): number | null {
  return v instanceof Timestamp ? v.toMillis() : null;
}

/** Gibt es das Dokument und ist seine Frist noch nicht um? */
export function istOffen(snap: DocumentSnapshot, jetzt = Date.now()): boolean {
  if (!snap.exists) return false;
  const bis = ms(snap.get("loeschenAm"));
  return bis == null || bis > jetzt;
}

function iso(v: unknown): string | null {
  const t = ms(v);
  return t == null ? null : new Date(t).toISOString();
}

function text(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * Die offenen Anfragen EINES Kontos über die genannten Gyms — ein
 * Sammelabruf. Die Dokument-ID ist die uid, also braucht es keine Abfrage
 * und keinen Index.
 *
 * KOSTEN: ein Lesevorgang je Gym, auch wo nichts liegt. Bei einigen Dutzend
 * Gyms ist das nichts; wächst die Suche über ~200 Gyms, gehört hier eine
 * collectionGroup-Abfrage auf `uid` hin (braucht einen Index-Deploy).
 */
export async function meineAnfragen(
  db: Firestore,
  uid: string,
  gymIds: string[],
): Promise<MeineAnfrage[]> {
  if (gymIds.length === 0) return [];
  const snaps = await db.getAll(...gymIds.map((g) => anfrageRef(db, g, uid)));
  const jetzt = Date.now();
  const offen: MeineAnfrage[] = [];
  snaps.forEach((s, i) => {
    if (istOffen(s, jetzt)) offen.push({ gymId: gymIds[i], am: iso(s.get("erstelltAm")) });
  });
  return offen;
}

/** Die offenen Anfragen eines Gyms, neueste zuerst. Abgelaufene fliegen dabei raus. */
export async function anfragenDesGyms(db: Firestore, gymId: string): Promise<GymAnfrage[]> {
  const snap = await db.collection("gyms").doc(gymId).collection("anfragen").limit(300).get();
  const jetzt = Date.now();
  const offen: GymAnfrage[] = [];
  for (const d of snap.docs) {
    if (!istOffen(d, jetzt)) {
      await d.ref.delete().catch(() => {});
      continue;
    }
    offen.push({
      uid: d.id,
      name: text(d.get("name")),
      email: text(d.get("email")),
      nachricht: text(d.get("nachricht")),
      erstelltAm: iso(d.get("erstelltAm")),
      loeschenAm: iso(d.get("loeschenAm")),
    });
  }
  return offen.sort((a, b) => (b.erstelltAm ?? "").localeCompare(a.erstelltAm ?? ""));
}

/** Nacht-Job: löscht, was über die Frist ist. Gibt die Anzahl zurück. */
export async function abgelaufeneAnfragenLoeschen(db: Firestore, gymId: string): Promise<number> {
  const snap = await db
    .collection("gyms")
    .doc(gymId)
    .collection("anfragen")
    .where("loeschenAm", "<=", Timestamp.now())
    .limit(300)
    .get();
  for (const d of snap.docs) await d.ref.delete();
  return snap.size;
}
