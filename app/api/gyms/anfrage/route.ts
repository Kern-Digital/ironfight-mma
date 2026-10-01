/**
 * POST /api/gyms/anfrage — „Probetraining vereinbaren": ein Konto fragt bei
 * einem Gym aus der Gym-Suche an (Etappe 4, 01.10.2026).
 *
 * Body: { gymId: string, name: string, nachricht?: string }
 * Antwort: { ok: true, anfrage: { gymId, am } }
 *
 * WAS DAS GYM BEKOMMT: Name (aus dem Formular), E-Mail-Adresse und
 * Nachricht. DIE E-MAIL KOMMT NICHT AUS DEM BODY, sondern aus dem Konto
 * (Firebase Auth) — niemand fragt im Namen einer fremden Adresse an, und das
 * Gym antwortet an eine Adresse, die es wirklich gibt.
 *
 * WAS NICHT DURCHKOMMT
 *   401  ohne gültiges Token
 *   400  Name unter 2 / über 60 Zeichen, Nachricht über 600, krumme gymId
 *   404  das Gym steht nicht in der Gym-Suche (Schalter aus, keine Adresse,
 *        gibt es nicht) — angefragt wird nur, wo die Verwaltung sich zeigt
 *   409  eigenes Gym · schon eine offene Anfrage bei diesem Gym
 *   429  schon fünf offene Anfragen (ANFRAGE_MAX_OFFEN) — die Bremse gegen
 *        ein Konto, das alle Gyms anschreibt
 *
 * EINE OFFENE ANFRAGE JE KONTO UND GYM: Die Dokument-ID ist die uid, das
 * Anlegen läuft in einer Transaktion. Eine abgelaufene Anfrage (90 Tage)
 * zählt nicht mehr und wird überschrieben.
 */

import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { AdminUnavailableError, adminAuth, adminDb } from "@/lib/server/firebase-admin";
import { bearerToken, mitgliedsGyms, verifyUser } from "@/lib/server/verify-user";
import { anfrageRef, istOffen, loeschenAm, meineAnfragen } from "@/lib/server/anfragen";
import { decodeKontakt, inSucheSichtbar } from "@/lib/gym-kontakt";
import {
  ANFRAGE_MAX_OFFEN,
  ANFRAGE_NACHRICHT_MAX,
  ANFRAGE_NAME_MAX,
  ANFRAGE_NAME_MIN,
} from "@/lib/gym-anfrage";

export const runtime = "nodejs";

const KEIN_CACHE = { "Cache-Control": "no-store" };
const fehler = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: KEIN_CACHE });

export async function POST(req: Request) {
  const token = bearerToken(req);
  const user = token ? await verifyUser(token) : null;
  if (!user) return fehler("Nicht angemeldet.", 401);

  let body: { gymId?: unknown; name?: unknown; nachricht?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return fehler("Ungültiger Request.", 400);
  }
  const gymId = typeof body.gymId === "string" ? body.gymId.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  const nachricht = typeof body.nachricht === "string" ? body.nachricht.trim() : "";
  if (!/^[a-z0-9-]{1,80}$/.test(gymId)) return fehler("Dieses Gym steht nicht in der Gym-Suche.", 404);
  if (name.length < ANFRAGE_NAME_MIN || name.length > ANFRAGE_NAME_MAX) {
    return fehler("Trag deinen Namen ein, damit das Gym weiß, wer anfragt.", 400);
  }
  if (nachricht.length > ANFRAGE_NACHRICHT_MAX) {
    return fehler(`Kürz deine Nachricht auf ${ANFRAGE_NACHRICHT_MAX} Zeichen.`, 400);
  }

  try {
    const db = adminDb();
    if (mitgliedsGyms(user).includes(gymId)) {
      return fehler("Du trainierst schon in diesem Gym.", 409);
    }
    const gym = await db.collection("gyms").doc(gymId).get();
    if (!gym.exists || !inSucheSichtbar(decodeKontakt(gym.get("kontakt")))) {
      return fehler("Dieses Gym steht nicht in der Gym-Suche.", 404);
    }

    const konto = await adminAuth().getUser(user.uid);
    if (konto.disabled || !konto.email) {
      return fehler("Dein Konto braucht eine E-Mail-Adresse, damit das Gym dir antworten kann.", 400);
    }

    // Die Bremse: offene Anfragen über alle Gyms der Suche.
    const sichtbare = await db
      .collection("gyms")
      .where("kontakt.sichtbar", "==", true)
      .select()
      .limit(500)
      .get();
    const offen = await meineAnfragen(db, user.uid, sichtbare.docs.map((d) => d.id));
    if (offen.some((a) => a.gymId === gymId)) {
      return fehler("Du hast bei diesem Gym schon angefragt. Es meldet sich per E-Mail bei dir.", 409);
    }
    if (offen.length >= ANFRAGE_MAX_OFFEN) {
      return fehler(
        `Du hast ${ANFRAGE_MAX_OFFEN} offene Anfragen. Warte auf eine Antwort, dann kannst du wieder anfragen.`,
        429,
      );
    }

    const ref = anfrageRef(db, gymId, user.uid);
    const jetzt = Timestamp.now();
    const angelegt = await db.runTransaction(async (tx) => {
      const da = await tx.get(ref);
      if (istOffen(da, jetzt.toMillis())) return false;
      tx.set(ref, {
        uid: user.uid,
        name,
        email: konto.email,
        nachricht,
        erstelltAm: jetzt,
        loeschenAm: loeschenAm(jetzt.toMillis()),
      });
      return true;
    });
    if (!angelegt) {
      return fehler("Du hast bei diesem Gym schon angefragt. Es meldet sich per E-Mail bei dir.", 409);
    }
    return NextResponse.json(
      { ok: true, anfrage: { gymId, am: jetzt.toDate().toISOString() } },
      { headers: KEIN_CACHE },
    );
  } catch (err) {
    if (err instanceof AdminUnavailableError) return fehler("Server gerade nicht erreichbar.", 503);
    console.error("[gyms/anfrage]", err);
    return fehler("Deine Anfrage ging gerade nicht raus. Versuch es gleich noch einmal.", 500);
  }
}
