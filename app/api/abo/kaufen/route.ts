/**
 * POST /api/abo/kaufen — Stripe Checkout für das DeepFight-Abo oder den
 * Nachkauf (Schritt 3, 21.09.2026).
 *
 * Body:    { art: "abo", stufe: "team"|"gym"|"saison", intervall: "monat"|"jahr", ustId?: string }
 *        | { art: "nachkauf", ustId?: string }
 * Antwort: { url }  — die Adresse der Stripe-Kasse
 *
 * Wer: nur die Verwaltung des eigenen Gyms (Leon 21.09.: „Nur die
 * Verwaltung"). 401 ohne Anmeldung, 403 ohne Verwaltungsrecht.
 *
 * Der Reihe nach: Stilllegung (423) → Lage des Abos (409: schon eins da /
 * Nachkauf ohne Abo / offene Zahlung) → USt-IdNr. prüfen (400 mit
 * `feld: "ustId"`, 503 wenn die Prüfstelle schweigt) → Stripe-Kunde des Gyms
 * anlegen oder nachziehen → Prüfergebnis am Gym ablegen (der Beleg für
 * Reverse Charge) → Checkout-Sitzung.
 *
 * GUTGESCHRIEBEN WIRD HIER NICHTS. Das tut allein der Webhook, wenn Stripe
 * die Zahlung meldet — wer die Kasse abbricht, hat nichts gekauft.
 */

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  STEUERMODUS,
  aboLage,
  decodeGymAbo,
  istAboIntervall,
  istAboStufe,
} from "@/lib/abo";
import { AdminUnavailableError, adminAuth, adminDb } from "@/lib/server/firebase-admin";
import { verwaltungDesGyms } from "@/lib/server/abo";
import {
  StripeFehlt,
  aboPreisId,
  fussText,
  kundeFuerGym,
  nachkaufPreisId,
  steuersaetze,
  stripe,
} from "@/lib/server/stripe";
import { pruefeUstId } from "@/lib/server/ust-id";

export const runtime = "nodejs";

const NICHT_BEREIT =
  "Der Kauf ist noch nicht freigeschaltet. Tidal Athletics richtet die Zahlung gerade ein.";

export async function POST(req: Request) {
  const zugang = await verwaltungDesGyms(req);
  if (zugang instanceof Response) return zugang;
  const { user, gymId } = zugang;

  let body: { art?: unknown; stufe?: unknown; intervall?: unknown; ustId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request." }, { status: 400 });
  }
  const art = body.art === "nachkauf" ? "nachkauf" : body.art === "abo" ? "abo" : null;
  if (!art) return NextResponse.json({ error: "Was willst du kaufen?" }, { status: 400 });
  if (art === "abo" && (!istAboStufe(body.stufe) || !istAboIntervall(body.intervall))) {
    return NextResponse.json({ error: "Wähl eine Stufe und die Laufzeit." }, { status: 400 });
  }

  try {
    const db = adminDb();
    const gymRef = db.collection("gyms").doc(gymId);
    const gymSnap = await gymRef.get();
    if (!gymSnap.exists) {
      return NextResponse.json({ error: "Dein Gym ist nicht auffindbar." }, { status: 404 });
    }
    if (gymSnap.get("status") === "blocked") {
      return NextResponse.json(
        { error: "Dein Gym ist stillgelegt. Melde dich bei Tidal Athletics, dann geht es weiter." },
        { status: 423 },
      );
    }

    const abo = decodeGymAbo(gymSnap.get("subscription"));
    const lage = aboLage(abo);
    if (art === "abo" && lage !== "keins") {
      return NextResponse.json(
        { error: "Ihr habt schon ein Abo. Stufe und Laufzeit wechselst du unter „Abo verwalten“." },
        { status: 409 },
      );
    }
    if (art === "nachkauf" && lage === "keins") {
      return NextResponse.json(
        { error: "Den Nachkauf gibt es zum Abo dazu. Buch zuerst eine Stufe." },
        { status: 409 },
      );
    }
    if (art === "nachkauf" && lage === "zahlung-offen") {
      return NextResponse.json(
        { error: "Eure letzte Zahlung ist noch offen. Aktualisier zuerst die Karte unter „Abo verwalten“." },
        { status: 409 },
      );
    }

    // ── USt-IdNr. ────────────────────────────────────────────────────────
    const roh = typeof body.ustId === "string" ? body.ustId : "";
    const pruefung = await pruefeUstId(roh, STEUERMODUS === "klein");
    if (pruefung && !pruefung.ok) {
      return NextResponse.json(
        { error: pruefung.text, feld: "ustId" },
        { status: pruefung.grund === "nicht-erreichbar" ? 503 : 400 },
      );
    }
    const reverseCharge = STEUERMODUS === "regel" && pruefung?.ok === true && pruefung.reverseCharge;

    // ── Kunde ───────────────────────────────────────────────────────────
    const konto = await adminAuth().getUser(user.uid);
    const kunde = await kundeFuerGym(db, gymId, {
      gymName: (gymSnap.get("name") as string | undefined)?.trim() || gymId,
      email: konto.email ?? null,
      ustId: pruefung?.ok ? pruefung.ustId : null,
      reverseCharge,
    });

    // Der Beleg: Welche Nummer, wie geprüft, wann — und damit, warum auf
    // der Rechnung keine deutsche USt. steht. Am Gym, nicht bei Stripe allein.
    await gymRef.set(
      {
        rechnung: {
          ustId: pruefung?.ok ? pruefung.ustId : null,
          reverseCharge,
          quelle: pruefung?.ok ? pruefung.quelle : null,
          kennung: pruefung?.ok ? pruefung.kennung : null,
          geprueftAm: FieldValue.serverTimestamp(),
        },
      },
      { merge: true },
    );

    // ── Kasse ───────────────────────────────────────────────────────────
    const zurueck = `${new URL(req.url).origin}/trainer/deepfight/abo`;
    const meta = { gymId, uid: user.uid, name: konto.displayName ?? "", art };
    const steuer = await steuersaetze(reverseCharge);
    const gemeinsam = {
      customer: kunde,
      client_reference_id: gymId,
      locale: "de" as const,
      payment_method_types: ["card" as const],
      billing_address_collection: "required" as const,
      customer_update: { address: "auto" as const, name: "auto" as const },
      success_url: `${zurueck}?kauf=ok`,
      cancel_url: `${zurueck}?kauf=abgebrochen`,
    };

    const sitzung =
      art === "abo"
        ? await stripe().checkout.sessions.create({
            ...gemeinsam,
            mode: "subscription",
            line_items: [{ price: await aboPreisId(body.stufe as never, body.intervall as never), quantity: 1 }],
            // Eine LEERE Steuerliste nicht mitschicken: Das SDK machte daraus
            // ein leeres Feld, und beim Anlegen lehnt Stripe das ab.
            subscription_data: {
              ...(steuer.length ? { default_tax_rates: steuer } : {}),
              metadata: { ...meta, stufe: String(body.stufe), intervall: String(body.intervall) },
            },
            metadata: meta,
          })
        : await stripe().checkout.sessions.create({
            ...gemeinsam,
            mode: "payment",
            line_items: [
              {
                // Der Nachkauf kostet je Stufe anders (Leon 22.09.: 35 / 30 /
                // 25 €). Ein Gym ohne Abo kommt hier nicht an — der Riegel
                // oben schickt es mit 409 zurück, lange bevor die Kasse aufgeht.
                price: await nachkaufPreisId(abo.plan === "free" ? "team" : abo.plan),
                quantity: 1,
                ...(steuer.length ? { tax_rates: steuer } : {}),
              },
            ],
            invoice_creation: {
              enabled: true,
              invoice_data: {
                metadata: { gymId },
                ...(fussText(reverseCharge) ? { footer: fussText(reverseCharge) } : {}),
              },
            },
            metadata: meta,
          });

    if (!sitzung.url) throw new Error("Stripe hat keine Kassen-Adresse geliefert.");
    return NextResponse.json({ url: sitzung.url });
  } catch (err) {
    if (err instanceof StripeFehlt) {
      return NextResponse.json({ error: NICHT_BEREIT, nichtBereit: true }, { status: 503 });
    }
    if (err instanceof AdminUnavailableError) {
      return NextResponse.json({ error: "Server gerade nicht erreichbar." }, { status: 503 });
    }
    console.error("[abo/kaufen]", err);
    return NextResponse.json(
      { error: "Die Kasse ließ sich gerade nicht öffnen. Versuch es gleich noch einmal." },
      { status: 500 },
    );
  }
}
