/**
 * GET /api/abo/rechnungen — die Rechnungen des Gyms (Schritt 3).
 *
 * Antwort: { rechnungen: [{ id, nummer, datum, betrag, pdf, seite, text }] }
 *
 * Leon 21.09.: „Stripe schreibt sie" — die Rechnungen liegen also bei
 * Stripe, nicht bei uns. Die Links holt diese Route bei JEDEM Aufruf frisch:
 * Stripes PDF-Adressen laufen nach spätestens 120 Tagen ab (Recherche
 * 21.09.2026), eine gespeicherte Adresse wäre irgendwann tot.
 */

import { NextResponse } from "next/server";
import { AdminUnavailableError, adminDb } from "@/lib/server/firebase-admin";
import { verwaltungDesGyms } from "@/lib/server/abo";
import { StripeFehlt, stripe } from "@/lib/server/stripe";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const zugang = await verwaltungDesGyms(req);
  if (zugang instanceof Response) return zugang;

  try {
    const snap = await adminDb().collection("gyms").doc(zugang.gymId).get();
    const kunde = snap.get("subscription.stripeCustomerId") as string | undefined;
    if (!kunde) return NextResponse.json({ rechnungen: [] });

    const liste = await stripe().invoices.list({ customer: kunde, limit: 24 });
    const rechnungen = liste.data
      .filter((r) => r.status === "paid" || r.status === "open")
      .map((r) => ({
        id: r.id,
        nummer: r.number,
        datum: (r.status_transitions?.paid_at ?? r.created) * 1000,
        betrag: r.total,
        offen: r.status === "open",
        pdf: r.invoice_pdf ?? null,
        seite: r.hosted_invoice_url ?? null,
        text: r.lines?.data[0]?.description ?? null,
      }));
    return NextResponse.json({ rechnungen });
  } catch (err) {
    if (err instanceof StripeFehlt || err instanceof AdminUnavailableError) {
      return NextResponse.json({ rechnungen: [], nichtBereit: true });
    }
    console.error("[abo/rechnungen]", err);
    return NextResponse.json({ error: "Die Rechnungen ließen sich nicht laden." }, { status: 500 });
  }
}
