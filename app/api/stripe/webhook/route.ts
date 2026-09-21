/**
 * POST /api/stripe/webhook — Stripe meldet Zahlungen (Schritt 3, 21.09.2026).
 *
 * DIE EINZIGE STELLE, AN DER GEKAUFTE ANALYSEN ENTSTEHEN. Deshalb zuerst die
 * Unterschrift: Ohne gültige `stripe-signature` (Geheimnis
 * STRIPE_WEBHOOK_SECRET) gibt es 400 und nichts sonst — wer die Adresse
 * kennt, soll sich keine Analysen schreiben können.
 *
 * Braucht den ROHEN Body (`req.text()`): Die Unterschrift gilt für die Bytes,
 * wie sie kamen; ein geparster und neu geschriebener Body passt nicht mehr.
 *
 * In Stripe einzutragen (Leon, sobald das Konto steht): Endpunkt
 * https://tidal-athletics.vercel.app/api/stripe/webhook mit den Ereignissen
 * checkout.session.completed, checkout.session.async_payment_succeeded,
 * invoice.paid, invoice.payment_failed, customer.subscription.created,
 * customer.subscription.updated, customer.subscription.deleted.
 *
 * Antwortet 500 bei einem Fehler in der Verarbeitung — Stripe liefert das
 * Ereignis dann bis zu drei Tage lang erneut. Doppelte Lieferungen sind
 * harmlos (Posten-IDs aus der Stripe-Rechnung, lib/server/abo.ts).
 */

import { NextResponse } from "next/server";
import { AdminUnavailableError, adminDb } from "@/lib/server/firebase-admin";
import { verarbeiteEreignis } from "@/lib/server/abo";
import { StripeFehlt, stripe, webhookGeheimnis } from "@/lib/server/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const unterschrift = req.headers.get("stripe-signature");
  if (!unterschrift) {
    return NextResponse.json({ error: "Unterschrift fehlt." }, { status: 400 });
  }
  const roh = await req.text();

  let ereignis;
  try {
    ereignis = await stripe().webhooks.constructEventAsync(roh, unterschrift, webhookGeheimnis());
  } catch (err) {
    if (err instanceof StripeFehlt) {
      return NextResponse.json({ error: "Stripe ist nicht eingerichtet." }, { status: 503 });
    }
    return NextResponse.json({ error: "Unterschrift ungültig." }, { status: 400 });
  }

  try {
    const ergebnis = await verarbeiteEreignis(adminDb(), ereignis);
    return NextResponse.json({ ok: true, ergebnis });
  } catch (err) {
    if (err instanceof AdminUnavailableError) {
      return NextResponse.json({ error: "Server gerade nicht erreichbar." }, { status: 503 });
    }
    console.error("[stripe/webhook]", ereignis.type, ereignis.id, err);
    return NextResponse.json({ error: "Verarbeitung fehlgeschlagen." }, { status: 500 });
  }
}
