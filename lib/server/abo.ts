/**
 * DAS ABO AUF DEM SERVER — Schritt 3 (21.09.2026).
 *
 * Zwei Dinge wohnen hier: der Zugang der Verwaltungs-Routen (kaufen, Portal,
 * Rechnungen) und die Verarbeitung der Stripe-Ereignisse. Beides ohne
 * `next/server` (Falle 49) — der Webhook-Kern lässt sich so direkt prüfen.
 *
 * WAS WANN GUTGESCHRIEBEN WIRD (Konzept §6, Leon 21.09.):
 *   invoice.paid mit Abo-Zeile      → je Monat EIN Posten `abo` über die
 *                                     Analysen der Stufe; im Jahresabo zwölf,
 *                                     jeder ab seinem Monat (`abAm`). Anteilige
 *                                     Zeilen (Stufenwechsel) bringen nichts —
 *                                     das Portal rechnet ohnehin nicht anteilig.
 *   checkout.session.completed,     → EIN Posten `paket` über 10 Analysen.
 *   Nachkauf, bezahlt
 * Jeder Posten trägt eine ID aus der Stripe-Rechnung bzw. -Sitzung. Liefert
 * Stripe dasselbe Ereignis zweimal, scheitert die zweite Gutschrift am
 * vorhandenen Dokument — doppelt gibt es nichts.
 *
 * DIE FRIST (Leon 21.09.: „Nach 14 Tagen"): Platzt eine Zahlung, merkt sich
 * das Gym den Tag (`zahlungOffenSeit`). Eine neue Gutschrift gibt es ohnehin
 * erst mit einer BEZAHLTEN Rechnung; was schon bezahlt ist, bleibt nutzbar
 * („Sie dürfen sie aufbrauchen"). Kommt nach Ablauf der 14 Tage noch eine
 * geplatzte Zahlung an, beendet der Webhook das Abo selbst — auch wenn in
 * Stripe eine längere Mahnfrist eingestellt wäre.
 */

import type Stripe from "stripe";
import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { NACHKAUF, ZAHLUNGSFRIST_TAGE, type AboIntervall, type AboStufe } from "../abo";
import { KEIN_GYM } from "../gym";
import { writeAudit } from "./audit";
import { schreibeGutschriften, type Gutschrift } from "./guthaben";
import { stripe, stufeZuPreis } from "./stripe";
import { bearerToken, canManageGym, userGymId, verifyUser, type VerifiedUser } from "./verify-user";

// ─── Zugang ────────────────────────────────────────────────────────────────

/**
 * Nur die Verwaltung des eigenen Gyms (Leon 21.09.: „Nur die Verwaltung").
 * Ein Plattform-Admin hat kein Gym und kommt hier nicht durch.
 */
export async function verwaltungDesGyms(
  req: Request,
  /** Was dasteht, wenn jemand ohne Verwaltungsrecht anklopft. */
  verbotenText = "Das DeepFight-Abo bucht die Verwaltung deines Gyms.",
): Promise<{ user: VerifiedUser; gymId: string } | Response> {
  const token = bearerToken(req);
  const user = token ? await verifyUser(token) : null;
  if (!user) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
  const gymId = userGymId(user);
  if (gymId === KEIN_GYM || !canManageGym(user, gymId)) {
    return Response.json({ error: verbotenText }, { status: 403 });
  }
  return { user, gymId };
}

// ─── Hilfen ────────────────────────────────────────────────────────────────

function ts(sekunden: number | null | undefined): Timestamp | null {
  return sekunden ? Timestamp.fromMillis(sekunden * 1000) : null;
}

function plusMonate(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setMonth(x.getMonth() + n);
  return x;
}

function kundenId(k: string | { id: string } | null | undefined): string | null {
  if (!k) return null;
  return typeof k === "string" ? k : k.id;
}

/** Welches Gym? Aus den Metadaten, sonst über die Kunden-ID am Gym. */
async function gymZu(
  db: Firestore,
  metadata: Stripe.Metadata | null | undefined,
  kunde: string | null,
): Promise<string | null> {
  const ausMeta = metadata?.gymId;
  if (ausMeta) return ausMeta;
  if (!kunde) return null;
  const snap = await db
    .collection("gyms")
    .where("subscription.stripeCustomerId", "==", kunde)
    .limit(1)
    .get();
  return snap.docs[0]?.id ?? null;
}

// ─── Das Abo am Gym spiegeln ───────────────────────────────────────────────

async function spiegleAbo(db: Firestore, abo: Stripe.Subscription): Promise<string | null> {
  const gymId = await gymZu(db, abo.metadata, kundenId(abo.customer));
  if (!gymId) return null;
  const item = abo.items.data[0];
  const stufe = item ? await stufeZuPreis(item.price) : null;
  const beendet = abo.status === "canceled" || abo.status === "incomplete_expired";

  const felder: Record<string, unknown> = {
    stripeStatus: abo.status,
    stripeCustomerId: kundenId(abo.customer),
    stripeSubscriptionId: beendet ? null : abo.id,
    currentPeriodEnd: beendet ? null : ts(item?.current_period_end),
    kuendigtZum: abo.cancel_at_period_end || abo.cancel_at ? ts(abo.cancel_at ?? item?.current_period_end) : null,
    status: beendet ? "canceled" : abo.status === "past_due" || abo.status === "unpaid" ? "pastDue" : "active",
  };
  if (beendet) {
    felder.plan = "free";
    felder.intervall = null;
    felder.zahlungOffenSeit = null;
  } else if (stufe) {
    felder.plan = stufe.stufe;
    felder.intervall = stufe.intervall;
  }
  await db.collection("gyms").doc(gymId).set({ subscription: felder }, { merge: true });
  return gymId;
}

// ─── Gutschriften ──────────────────────────────────────────────────────────

/** Die Posten, die eine bezahlte Abo-Rechnung bringt. */
async function postenAusRechnung(
  rechnung: Stripe.Invoice,
): Promise<{ posten: Gutschrift[]; stufe: AboStufe | null; intervall: AboIntervall | null }> {
  const posten: Gutschrift[] = [];
  let stufe: AboStufe | null = null;
  let intervall: AboIntervall | null = null;
  const zeilen = rechnung.lines?.data ?? [];
  for (let z = 0; z < zeilen.length; z++) {
    const zeile = zeilen[z];
    const abo = zeile.parent?.subscription_item_details;
    if (!abo || abo.proration) continue;
    const preis = zeile.pricing?.price_details?.price;
    if (!preis) continue;
    const info = await stufeZuPreis(preis);
    if (!info) continue;
    stufe = info.stufe;
    intervall = info.intervall;
    const beginn = new Date(zeile.period.start * 1000);
    const monate = info.intervall === "jahr" ? 12 : 1;
    for (let m = 0; m < monate; m++) {
      posten.push({
        id: `abo_${rechnung.id}_${z}_${m}`,
        menge: info.analysenJeMonat * (zeile.quantity ?? 1),
        grund: "abo",
        paket: info.stufe,
        abAm: plusMonate(beginn, m),
        rechnungId: rechnung.id ?? null,
      });
    }
  }
  return { posten, stufe, intervall };
}

async function rechnungBezahlt(db: Firestore, rechnung: Stripe.Invoice): Promise<string> {
  const abo = rechnung.parent?.subscription_details;
  if (!abo) return "keine Abo-Rechnung";
  const gymId = await gymZu(db, abo.metadata, kundenId(rechnung.customer));
  if (!gymId) return "kein Gym";

  const { posten, stufe } = await postenAusRechnung(rechnung);
  const neu = await schreibeGutschriften(() => db, gymId, posten);

  // Die offene Zahlung ist erledigt.
  await db
    .collection("gyms")
    .doc(gymId)
    .set({ subscription: { zahlungOffenSeit: null } }, { merge: true });

  if (neu && posten.length && rechnung.billing_reason === "subscription_create") {
    await writeAudit(db, gymId, {
      type: "abo.start",
      actorUid: abo.metadata?.uid ?? "",
      actorName: abo.metadata?.name ?? "",
      details: { stufe: stufe ?? "", intervall: abo.metadata?.intervall ?? "" },
    });
  }
  return neu ? `${posten.length} Posten` : "schon gutgeschrieben";
}

async function zahlungGeplatzt(db: Firestore, rechnung: Stripe.Invoice): Promise<string> {
  const abo = rechnung.parent?.subscription_details;
  if (!abo) return "keine Abo-Rechnung";
  const gymId = await gymZu(db, abo.metadata, kundenId(rechnung.customer));
  if (!gymId) return "kein Gym";
  const ref = db.collection("gyms").doc(gymId);
  const seit = (await ref.get()).get("subscription.zahlungOffenSeit") as Timestamp | undefined;
  if (!seit) {
    await ref.set({ subscription: { zahlungOffenSeit: FieldValue.serverTimestamp() } }, { merge: true });
    return "Frist beginnt";
  }
  const abgelaufen = Date.now() - seit.toMillis() > ZAHLUNGSFRIST_TAGE * 86_400_000;
  if (abgelaufen) {
    const aboId = typeof abo.subscription === "string" ? abo.subscription : abo.subscription.id;
    await stripe().subscriptions.cancel(aboId);
    return "Frist abgelaufen, Abo beendet";
  }
  return "Frist läuft";
}

async function kaufAbgeschlossen(db: Firestore, sitzung: Stripe.Checkout.Session): Promise<string> {
  const gymId = sitzung.metadata?.gymId;
  if (!gymId) return "kein Gym";
  // Das Abo selbst schreibt `customer.subscription.created` und die Gutschrift
  // `invoice.paid` — hier bleibt für ein Abo nur die Kunden-ID.
  if (sitzung.mode === "subscription") {
    await db
      .collection("gyms")
      .doc(gymId)
      .set({ subscription: { stripeCustomerId: kundenId(sitzung.customer) } }, { merge: true });
    return "Abo-Kauf vermerkt";
  }
  if (sitzung.metadata?.art !== "nachkauf" || sitzung.payment_status !== "paid") {
    return "nichts zu tun";
  }
  const neu = await schreibeGutschriften(() => db, gymId, [
    {
      id: `kauf_${sitzung.id}`,
      menge: NACHKAUF.analysen,
      grund: "paket",
      paket: NACHKAUF.id,
      rechnungId: kundenId(sitzung.invoice),
    },
  ]);
  if (neu) {
    await writeAudit(db, gymId, {
      type: "guthaben.kauf",
      actorUid: sitzung.metadata?.uid ?? "",
      actorName: sitzung.metadata?.name ?? "",
      details: { analysen: NACHKAUF.analysen },
    });
  }
  return neu ? "Nachkauf gutgeschrieben" : "schon gutgeschrieben";
}

/**
 * Ein Stripe-Ereignis verarbeiten. Gibt zurück, was passiert ist — für das
 * Protokoll und die Messung. Wirft bei echten Fehlern; die Route antwortet
 * dann mit 500, und Stripe liefert das Ereignis später noch einmal.
 */
export async function verarbeiteEreignis(db: Firestore, ereignis: Stripe.Event): Promise<string> {
  switch (ereignis.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      return kaufAbgeschlossen(db, ereignis.data.object);
    case "invoice.paid":
      return rechnungBezahlt(db, ereignis.data.object);
    case "invoice.payment_failed":
      return zahlungGeplatzt(db, ereignis.data.object);
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const gymId = await spiegleAbo(db, ereignis.data.object);
      if (gymId && ereignis.type === "customer.subscription.deleted") {
        await writeAudit(db, gymId, { type: "abo.ende", actorUid: "", actorName: "Stripe" });
      }
      return gymId ? "Abo gespiegelt" : "kein Gym";
    }
    default:
      return "nicht gebraucht";
  }
}
