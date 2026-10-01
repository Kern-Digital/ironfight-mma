/**
 * POST /api/gyms/suche — die Gyms, die in der Gym-Suche stehen.
 * Antwort: { gyms: SuchGym[], angefragt: MeineAnfrage[] } — je Gym genau
 * id, name, strasse, plz, ort, telefon, email, website, lat, lng.
 * `angefragt` (seit Etappe 4): bei welchen dieser Gyms der AUFRUFER eine
 * offene Anfrage „Probetraining vereinbaren" hat — nur seine eigenen, nur
 * Gym und Datum. Die Gym-Liste selbst bleibt für alle dieselbe.
 *
 * WARUM ES DIESE ROUTE GIBT (Leon 30.09.2026): Ein Konto ohne Gym soll alle
 * Gyms sehen, die Tidal Athletics nutzen. Die Regeln lassen ein Gym-Dokument
 * nur seine Mitglieder lesen, und das bleibt so — im selben Dokument stehen
 * Abo, Stripe-Kunde und Branding. Diese Route gibt genau die Felder heraus,
 * die die Verwaltung auf „Kontakt & Standort" als öffentlich eingetragen hat.
 *
 * WELCHE GYMS: `kontakt.sichtbar == true`. Das Feld rechnet der Server beim
 * Speichern aus (app/api/gym/kontakt/route.ts): Schalter „In der Gym-Suche
 * zeigen" an, Adresse vollständig, Pin gesetzt. Hier wird dieselbe Bedingung
 * noch einmal geprüft (`inSucheSichtbar`) — ein Dokument, das jemand von Hand
 * angefasst hat, erscheint nicht wegen eines stehen gebliebenen Feldes.
 * Stillgelegte Gyms bleiben drin: Stilllegen trifft nur DeepFight (Leon
 * 21.09.), die kostenlose Verwaltung läuft weiter.
 *
 * WER FRAGEN DARF: jedes angemeldete Konto (401 ohne Token). Die Liste ist
 * für alle dieselbe; die Suche nach PLZ, Ort, Standort und Radius läuft im
 * Browser — der Standort eines Athleten kommt hier nie an.
 *
 * KEINE EINGABE: kein Body, kein Parameter. `Cache-Control: no-store`.
 */

import { NextResponse } from "next/server";
import { AdminUnavailableError, adminDb } from "@/lib/server/firebase-admin";
import { bearerToken, verifyUser } from "@/lib/server/verify-user";
import { decodeKontakt, inSucheSichtbar, type SuchGym } from "@/lib/gym-kontakt";
import { meineAnfragen } from "@/lib/server/anfragen";

export const runtime = "nodejs";

const KEIN_CACHE = { "Cache-Control": "no-store" };

/** Deckel — so viele Gyms trägt eine Liste ohne Blättern. */
const MAX_GYMS = 500;

export async function POST(req: Request) {
  const token = bearerToken(req);
  const user = token ? await verifyUser(token) : null;
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401, headers: KEIN_CACHE });
  }

  try {
    const db = adminDb();
    const snap = await db
      .collection("gyms")
      .where("kontakt.sichtbar", "==", true)
      .select("name", "kontakt")
      .limit(MAX_GYMS)
      .get();

    const gyms: SuchGym[] = [];
    for (const d of snap.docs) {
      const k = decodeKontakt(d.get("kontakt"));
      if (!inSucheSichtbar(k) || k.lat == null || k.lng == null) continue;
      const name = d.get("name");
      gyms.push({
        id: d.id,
        name: typeof name === "string" && name.trim() ? name.trim() : d.id,
        strasse: k.strasse,
        plz: k.plz,
        ort: k.ort,
        telefon: k.telefon,
        email: k.email,
        website: k.website,
        lat: k.lat,
        lng: k.lng,
      });
    }
    gyms.sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));
    // Scheitert der Blick auf die eigenen Anfragen, steht die Liste trotzdem.
    const angefragt = await meineAnfragen(db, user.uid, gyms.map((g) => g.id)).catch(() => []);
    return NextResponse.json({ gyms, angefragt }, { headers: KEIN_CACHE });
  } catch (err) {
    if (err instanceof AdminUnavailableError) {
      return NextResponse.json(
        { error: "Server gerade nicht erreichbar." },
        { status: 503, headers: KEIN_CACHE },
      );
    }
    console.error("[gyms/suche]", err);
    return NextResponse.json(
      { error: "Die Gym-Suche lädt gerade nicht. Versuch es gleich noch einmal." },
      { status: 500, headers: KEIN_CACHE },
    );
  }
}
