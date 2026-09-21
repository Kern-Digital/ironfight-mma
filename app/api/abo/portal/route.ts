/**
 * POST /api/abo/portal — das Stripe-Kundenportal des Gyms (Schritt 3).
 *
 * Antwort: { url }
 *
 * Dort ändert die Verwaltung die Karte, lädt Rechnungen, wechselt die Stufe
 * (gilt ab der nächsten Abrechnung) oder kündigt zum Ende des bezahlten
 * Zeitraums. Wer noch nie gekauft hat, hat keinen Stripe-Kunden → 409.
 */

import { NextResponse } from "next/server";
import { AdminUnavailableError, adminDb } from "@/lib/server/firebase-admin";
import { verwaltungDesGyms } from "@/lib/server/abo";
import { StripeFehlt, portalKonfigurationId, stripe } from "@/lib/server/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const zugang = await verwaltungDesGyms(req);
  if (zugang instanceof Response) return zugang;

  try {
    const snap = await adminDb().collection("gyms").doc(zugang.gymId).get();
    const kunde = snap.get("subscription.stripeCustomerId") as string | undefined;
    if (!kunde) {
      return NextResponse.json({ error: "Ihr habt noch nichts gebucht." }, { status: 409 });
    }
    const sitzung = await stripe().billingPortal.sessions.create({
      customer: kunde,
      configuration: await portalKonfigurationId(),
      return_url: `${new URL(req.url).origin}/trainer/deepfight/abo`,
      locale: "de",
    });
    return NextResponse.json({ url: sitzung.url });
  } catch (err) {
    if (err instanceof StripeFehlt || err instanceof AdminUnavailableError) {
      return NextResponse.json({ error: "Das Kundenportal ist gerade nicht erreichbar." }, { status: 503 });
    }
    console.error("[abo/portal]", err);
    return NextResponse.json({ error: "Das Kundenportal ließ sich nicht öffnen." }, { status: 500 });
  }
}
