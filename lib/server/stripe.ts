/**
 * STRIPE — Schritt 3 des Geschäftsplans (21.09.2026).
 *
 * NICHTS HIER MUSS JEMAND VON HAND IN STRIPE ANLEGEN. Produkte, Preise, der
 * Steuersatz und die Konfiguration des Kundenportals entstehen beim ersten
 * Bedarf aus `lib/abo.ts` — mit festen Kennungen, damit ein zweiter Aufruf
 * sie wiederfindet statt sie doppelt anzulegen:
 *   Produkt   `tidal_deepfight_{stufe}` / `tidal_deepfight_nachkauf` (eigene ID)
 *   Preis     `lookup_key` aus `preisSchluessel()` — der Betrag steht mit drin
 *   Steuer    Metadaten `tidal: "ust19"`
 *   Portal    Metadaten `tidal: "portal-…"` mit den Preisen darin
 * Was Leon in Stripe selbst einstellen muss, steht in CLAUDE.md
 * („Schritt 3: Abo") — Firmendaten für die Rechnung, die Mahnfrist und der
 * Webhook-Endpunkt.
 *
 * DIE ATTRAPPE: `STRIPE_API_HOST` (nur außerhalb der Produktion) lenkt jeden
 * Aufruf auf einen lokalen Nachbau um. So lässt sich der ganze Weg messen,
 * bevor es ein Stripe-Konto gibt (scripts/tmp-mess-abo.mjs).
 */

import Stripe from "stripe";
import type { Firestore } from "firebase-admin/firestore";
import {
  ABO_STUFEN,
  NACHKAUF,
  STEUERMODUS,
  UST_SATZ,
  nachkaufSchluessel,
  preisSchluessel,
  type AboIntervall,
  type AboStufe,
} from "../abo";

export class StripeFehlt extends Error {
  constructor() {
    super("Stripe ist noch nicht eingerichtet (STRIPE_SECRET_KEY fehlt).");
  }
}

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeFehlt();
  const attrappe =
    process.env.NODE_ENV !== "production" ? process.env.STRIPE_API_HOST?.trim() : undefined;
  if (attrappe) {
    const [host, port] = attrappe.split(":");
    client = new Stripe(key, { host, port: Number(port) || 80, protocol: "http", maxNetworkRetries: 0 });
  } else {
    client = new Stripe(key, { maxNetworkRetries: 2 });
  }
  return client;
}

export function webhookGeheimnis(): string {
  const s = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s) throw new StripeFehlt();
  return s;
}

// ─── Produkte und Preise ───────────────────────────────────────────────────

const preisCache = new Map<string, string>();

function produktId(stufe: AboStufe | "nachkauf"): string {
  return `tidal_deepfight_${stufe}`;
}

async function sicheresProdukt(id: string, name: string): Promise<string> {
  const s = stripe();
  try {
    return (await s.products.retrieve(id)).id;
  } catch (err) {
    if ((err as { statusCode?: number }).statusCode !== 404) throw err;
  }
  try {
    return (await s.products.create({ id, name, metadata: { tidal: "deepfight" } })).id;
  } catch (err) {
    // Zwei gleichzeitige erste Käufe: Der andere war schneller.
    if ((err as { code?: string }).code === "resource_already_exists") return id;
    throw err;
  }
}

async function sichererPreis(
  schluessel: string,
  anlegen: () => Stripe.PriceCreateParams,
): Promise<string> {
  const cached = preisCache.get(schluessel);
  if (cached) return cached;
  const s = stripe();
  const gefunden = await s.prices.list({ lookup_keys: [schluessel], active: true, limit: 1 });
  let id = gefunden.data[0]?.id;
  if (!id) {
    try {
      id = (await s.prices.create({ ...anlegen(), lookup_key: schluessel })).id;
    } catch (err) {
      const nochmal = await s.prices.list({ lookup_keys: [schluessel], active: true, limit: 1 });
      id = nochmal.data[0]?.id;
      if (!id) throw err;
    }
  }
  preisCache.set(schluessel, id);
  return id;
}

export async function aboPreisId(stufe: AboStufe, intervall: AboIntervall): Promise<string> {
  const info = ABO_STUFEN.find((s) => s.id === stufe)!;
  const produkt = await sicheresProdukt(produktId(stufe), `DeepFight ${info.name}`);
  return sichererPreis(preisSchluessel(stufe, intervall), () => ({
    product: produkt,
    currency: "eur",
    unit_amount: info.netto[intervall],
    tax_behavior: "exclusive",
    recurring: { interval: intervall === "jahr" ? "year" : "month" },
    nickname: `${info.name} · ${info.analysenJeMonat} Analysen im Monat · ${intervall === "jahr" ? "jährlich" : "monatlich"}`,
    metadata: { stufe, intervall, analysenJeMonat: String(info.analysenJeMonat) },
  }));
}

export async function nachkaufPreisId(): Promise<string> {
  const produkt = await sicheresProdukt(produktId("nachkauf"), `DeepFight Nachkauf · ${NACHKAUF.analysen} Analysen`);
  return sichererPreis(nachkaufSchluessel(), () => ({
    product: produkt,
    currency: "eur",
    unit_amount: NACHKAUF.netto,
    tax_behavior: "exclusive",
    nickname: `Nachkauf · ${NACHKAUF.analysen} Analysen`,
    metadata: { paket: NACHKAUF.id, analysen: String(NACHKAUF.analysen) },
  }));
}

/**
 * Welche Stufe hinter einem Preis steht — für den Webhook. Liest die
 * Metadaten am Preis (seit der API-Fassung 2025 trägt eine Rechnungszeile
 * nur noch die Preis-ID, nicht den Preis selbst).
 */
export async function stufeZuPreis(
  preis: string | Stripe.Price,
): Promise<{ stufe: AboStufe; intervall: AboIntervall; analysenJeMonat: number } | null> {
  const p = typeof preis === "string" ? await stripe().prices.retrieve(preis) : preis;
  const stufe = p.metadata?.stufe as AboStufe | undefined;
  const info = ABO_STUFEN.find((s) => s.id === stufe);
  if (!info) return null;
  const intervall: AboIntervall = p.recurring?.interval === "year" ? "jahr" : "monat";
  return { stufe: info.id, intervall, analysenJeMonat: info.analysenJeMonat };
}

// ─── Steuer ────────────────────────────────────────────────────────────────

let steuerCache: string | null = null;

/** Der eine Steuersatz (19 %, obendrauf). Nur im Regel-Modus gebraucht. */
export async function steuersatzId(): Promise<string> {
  if (steuerCache) return steuerCache;
  const s = stripe();
  const liste = await s.taxRates.list({ active: true, limit: 100 });
  const da = liste.data.find((t) => t.metadata?.tidal === "ust19" && t.percentage === UST_SATZ);
  steuerCache =
    da?.id ??
    (
      await s.taxRates.create({
        display_name: "USt.",
        description: `Umsatzsteuer ${UST_SATZ} %`,
        percentage: UST_SATZ,
        inclusive: false,
        country: "DE",
        jurisdiction: "DE",
        tax_type: "vat",
        metadata: { tidal: "ust19" },
      })
    ).id;
  return steuerCache;
}

/**
 * Der Steuerfall eines Kaufs. Im Kleinunternehmer-Modus gibt es keine USt.,
 * im Regel-Modus 19 % — außer bei Reverse Charge (Gym im EU-Ausland mit
 * geprüfter USt-IdNr.).
 */
export function fussText(reverseCharge: boolean): string {
  if (STEUERMODUS === "klein") return "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.";
  if (reverseCharge) {
    return "Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge, Art. 196 MwStSystRL).";
  }
  return "";
}

export async function steuersaetze(reverseCharge: boolean): Promise<string[]> {
  if (STEUERMODUS === "klein" || reverseCharge) return [];
  return [await steuersatzId()];
}

// ─── Der Kunde je Gym ──────────────────────────────────────────────────────

export interface KundenAngaben {
  gymName: string;
  email: string | null;
  /** Normalisiert, z. B. "ATU12345678" — null = keine angegeben. */
  ustId: string | null;
  reverseCharge: boolean;
}

/**
 * Der Stripe-Kunde eines Gyms: EIN Kunde je Gym, nicht je Person — die
 * Rechnung geht an das Gym. Beim ersten Kauf angelegt und am Gym-Dokument
 * vermerkt (`subscription.stripeCustomerId`); bei jedem weiteren Kauf mit den
 * Angaben von heute nachgezogen (USt-IdNr., Steuerfall, Fußzeile).
 */
export async function kundeFuerGym(
  db: Firestore,
  gymId: string,
  angaben: KundenAngaben,
): Promise<string> {
  const s = stripe();
  const gymRef = db.collection("gyms").doc(gymId);
  const snap = await gymRef.get();
  let kundeId = snap.get("subscription.stripeCustomerId") as string | undefined;

  const fuss = fussText(angaben.reverseCharge);
  const gemeinsam = {
    tax_exempt: (angaben.reverseCharge ? "reverse" : "none") as Stripe.CustomerUpdateParams.TaxExempt,
    preferred_locales: ["de"],
  };

  if (kundeId) {
    // Beim Nachziehen heißt eine leere Fußzeile „weg damit" — so fällt der
    // Reverse-Charge-Satz, wenn ein Gym seine Auslands-Nummer herausnimmt.
    await s.customers.update(kundeId, { ...gemeinsam, invoice_settings: { footer: fuss } });
  } else {
    const kunde = await s.customers.create({
      ...gemeinsam,
      ...(fuss ? { invoice_settings: { footer: fuss } } : {}),
      name: angaben.gymName,
      email: angaben.email ?? undefined,
      metadata: { gymId },
    });
    kundeId = kunde.id;
    await gymRef.set({ subscription: { stripeCustomerId: kundeId } }, { merge: true });
  }

  // Die USt-IdNr. am Kunden steht auf jeder Rechnung. Eine geänderte ersetzt
  // die alte; eine leere nimmt sie weg.
  const vorhanden = await s.customers.listTaxIds(kundeId, { limit: 10 });
  const passt = vorhanden.data.some((t) => t.value.replace(/\s/g, "") === angaben.ustId);
  if (!passt) {
    for (const t of vorhanden.data) await s.customers.deleteTaxId(kundeId, t.id);
    if (angaben.ustId) await s.customers.createTaxId(kundeId, { type: "eu_vat", value: angaben.ustId });
  }
  return kundeId;
}

// ─── Kundenportal ──────────────────────────────────────────────────────────

let portalCache: string | null = null;

/**
 * Die Marke der Portal-Konfiguration trägt die Preise mit — ändert sich einer
 * in lib/abo.ts, entsteht eine neue Konfiguration mit den neuen Preisen,
 * statt dass das Portal weiter die alten zum Wechsel anbietet.
 */
const PORTAL_MARKE = `portal-${ABO_STUFEN.map((s) => `${s.id}${s.netto.monat}.${s.netto.jahr}`).join("-")}`;

/**
 * Die Portal-Konfiguration: Karte ändern, Rechnungen sehen, kündigen (zum
 * Ende des bezahlten Zeitraums) und die Stufe wechseln. Ein Wechsel rechnet
 * NICHT anteilig ab (`proration_behavior: none`): Die neue Stufe gilt ab der
 * nächsten Abrechnung, und mit ihr kommen die neuen Analysen. Wer sofort mehr
 * braucht, nimmt den Nachkauf.
 */
export async function portalKonfigurationId(): Promise<string> {
  if (portalCache) return portalCache;
  const s = stripe();
  const liste = await s.billingPortal.configurations.list({ active: true, limit: 20 });
  const da = liste.data.find((c) => c.metadata?.tidal === PORTAL_MARKE);
  if (da) {
    portalCache = da.id;
    return da.id;
  }
  const produkte = await Promise.all(
    ABO_STUFEN.map(async (st) => ({
      product: produktId(st.id),
      prices: [await aboPreisId(st.id, "monat"), await aboPreisId(st.id, "jahr")],
    })),
  );
  const neu = await s.billingPortal.configurations.create({
    business_profile: { headline: "DeepFight-Abo von Tidal Athletics" },
    features: {
      customer_update: { enabled: true, allowed_updates: ["email", "address", "name"] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
        proration_behavior: "none",
      },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        proration_behavior: "none",
        products: produkte,
      },
    },
    metadata: { tidal: PORTAL_MARKE },
  });
  portalCache = neu.id;
  return neu.id;
}
