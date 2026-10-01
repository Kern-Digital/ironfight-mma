/**
 * POST /api/gym/kontakt — Kontakt und Standort des eigenen Gyms setzen
 * (Etappe 2 der Gym-Suche, 01.10.2026).
 *
 * Body: { strasse, plz, ort, telefon, email, website, lat, lng, inSuche }
 * Antwort: { ok: true, kontakt: GymKontakt, sichtbar: boolean }
 *
 * WER: die Verwaltung des Gyms (`verwaltungDesGyms` — 401 ohne Token, 403
 * ohne Verwaltungsrecht oder ohne Gym). Das Gym kommt aus dem Token-Claim;
 * ein `gymId` im Body wird nicht gelesen.
 *
 * WARUM EINE ROUTE: Die Regeln lassen am Gym-Dokument nur den Plattform-Admin
 * schreiben, und das bleibt so. Außerdem rechnet der Server hier `sichtbar`
 * aus (`inSucheSichtbar`: Schalter an, Adresse vollständig, Pin gesetzt) —
 * das eine Feld, das die Gym-Suche abfragt. Der Browser kann es nicht
 * behaupten.
 *
 * KEINE STUFE, KEINE STILLLEGUNG: Kontakt und Standort gehören zur
 * kostenlosen Verwaltung (Leon 21.09.: Stilllegen trifft nur DeepFight).
 */

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { AdminUnavailableError, adminDb } from "@/lib/server/firebase-admin";
import { verwaltungDesGyms } from "@/lib/server/abo";
import { inSucheSichtbar, pruefeKontakt } from "@/lib/gym-kontakt";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const zugang = await verwaltungDesGyms(
    req,
    "Kontakt und Standort trägt die Verwaltung deines Gyms ein.",
  );
  if (zugang instanceof Response) return zugang;
  const { gymId, user } = zugang;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request." }, { status: 400 });
  }

  const ergebnis = pruefeKontakt(body);
  if ("fehler" in ergebnis) {
    return NextResponse.json({ error: ergebnis.fehler, feld: ergebnis.feld }, { status: 400 });
  }
  const { kontakt } = ergebnis;
  const sichtbar = inSucheSichtbar(kontakt);

  try {
    // `update` statt `set(merge)`: Das Feld wird als Ganzes ersetzt, und ein
    // Gym-Dokument, das es nicht gibt, entsteht hier nicht.
    await adminDb()
      .collection("gyms")
      .doc(gymId)
      .update({
        kontakt: { ...kontakt, sichtbar },
        kontaktGeaendertAm: FieldValue.serverTimestamp(),
        kontaktGeaendertVon: user.uid,
      });
    return NextResponse.json({ ok: true, kontakt, sichtbar });
  } catch (err) {
    if (err instanceof AdminUnavailableError) {
      return NextResponse.json({ error: "Server gerade nicht erreichbar." }, { status: 503 });
    }
    console.error("[gym/kontakt]", err);
    return NextResponse.json(
      { error: "Das ließ sich gerade nicht speichern. Versuch es gleich noch einmal." },
      { status: 500 },
    );
  }
}
