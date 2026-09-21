/**
 * DAS DEEPFIGHT-ABO — Schritt 3 des Geschäftsplans (21.09.2026).
 *
 * Leon am 21.09. spät (Fenster f1): „wie kann man das geschäftsmodel auf eine
 * monatlich wiederkehrende summe umbauen ich finde das als die beste optoin".
 * Damit sind die Pakete vom 20.09. überholt; sie leben nur als NACHKAUF
 * weiter (Konzept §6).
 *
 * Diese Datei ist die EINE Stelle für Stufen, Preise und Steuer — die Seite
 * rechnet damit, der Server legt damit die Stripe-Preise an, und der Webhook
 * liest daraus, wie viele Analysen eine bezahlte Rechnung bringt. Wer hier
 * einen Preis ändert, ändert ihn überall; Stripe bekommt dafür einen NEUEN
 * Preis (siehe `preisSchluessel`), der alte bleibt für laufende Abos stehen.
 *
 * Leons Antworten (wörtlich, 21.09.2026): Stufen „Ja, als Startwerte
 * (Empfohlen)" · Ungenutzte Analysen „Unbegrenzt ansammeln" · Laufzeit
 * „Beides, Jahr mit zwei Monaten geschenkt (Empfohlen)" · Stufenwahl „Drei
 * Karten nebeneinander (Empfohlen)" · Frist „Nach 14 Tagen (Empfohlen)" ·
 * Nachkauf „10 Analysen für 35 € (Empfohlen)" · Preis „Netto groß, brutto
 * klein (Empfohlen)" · Wer kauft „Nur die Verwaltung (Empfohlen)" · Steuer
 * „Noch kein Gewerbe" · Rechnung „Stripe schreibt sie (Empfohlen)".
 */

export type AboStufe = "team" | "gym" | "saison";
export type AboIntervall = "monat" | "jahr";

export interface AboStufeInfo {
  id: AboStufe;
  name: string;
  /** Analysen, die jeden Monat dazukommen — auch im Jahresabo. */
  analysenJeMonat: number;
  /** Netto in Cent. */
  netto: Record<AboIntervall, number>;
}

/** Jährlich zwei Monate geschenkt: Jahrespreis = zehn Monatspreise. */
export const ABO_STUFEN: readonly AboStufeInfo[] = [
  { id: "team", name: "Team", analysenJeMonat: 15, netto: { monat: 4900, jahr: 49000 } },
  { id: "gym", name: "Gym", analysenJeMonat: 40, netto: { monat: 9900, jahr: 99000 } },
  { id: "saison", name: "Saison", analysenJeMonat: 100, netto: { monat: 21900, jahr: 219000 } },
] as const;

/** Vorgewählt (Konzept §6: „Gym 40 zu 99 € (vorgewählt)"). */
export const ABO_VORWAHL: AboStufe = "gym";

/**
 * Der Nachkauf, wenn der Monat nicht reicht (Leon 21.09.: „10 Analysen für
 * 35 €"). Einmalig, gilt 24 Monate, nur für Gyms MIT Abo.
 */
export const NACHKAUF = { id: "nachkauf-10", analysen: 10, netto: 3500 } as const;

/**
 * DIE STEUER — MIT EINER ZEILE UMSTELLBAR. Leon hat am 21.09. „Noch kein
 * Gewerbe" geantwortet. Solange das so ist, verkauft Tidal nichts; sobald es
 * feststeht, gilt:
 *   "regel" — Regelbesteuerung: 19 % obendrauf, Reverse Charge für Gyms im
 *             EU-Ausland mit geprüfter USt-IdNr.
 *   "klein" — Kleinunternehmer nach § 19 UStG: keine USt., der Nettopreis IST
 *             der Endpreis, auf jeder Rechnung der Hinweis.
 */
export const STEUERMODUS: "regel" | "klein" = "regel";
export const UST_SATZ = 19;

/** Leon 21.09.: „Nach 14 Tagen" — dann endet ein Abo mit offener Zahlung. */
export const ZAHLUNGSFRIST_TAGE = 14;

export function stufeInfo(id: AboStufe): AboStufeInfo {
  return ABO_STUFEN.find((s) => s.id === id) ?? ABO_STUFEN[1];
}

export function istAboStufe(x: unknown): x is AboStufe {
  return x === "team" || x === "gym" || x === "saison";
}

export function istAboIntervall(x: unknown): x is AboIntervall {
  return x === "monat" || x === "jahr";
}

/** Brutto in Cent — nur im Regel-Modus höher als netto. */
export function brutto(nettoCent: number): number {
  return STEUERMODUS === "regel" ? Math.round((nettoCent * (100 + UST_SATZ)) / 100) : nettoCent;
}

/**
 * „49 €", „58,31 €", „1.178,10 €" — glatte Beträge ohne Nachkommastellen,
 * alles andere mit zwei.
 */
export function euro(cent: number): string {
  const glatt = cent % 100 === 0;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: glatt ? 0 : 2,
    maximumFractionDigits: glatt ? 0 : 2,
  }).format(cent / 100);
}

/** Was eine Analyse in dieser Stufe netto kostet, in Cent. */
export function stueckpreis(stufe: AboStufe, intervall: AboIntervall): number {
  const s = stufeInfo(stufe);
  const analysen = s.analysenJeMonat * (intervall === "jahr" ? 12 : 1);
  return Math.round(s.netto[intervall] / analysen);
}

/**
 * Der Stripe-Schlüssel eines Preises (`lookup_key`). Der Betrag steht MIT
 * drin: Ändert sich ein Preis in dieser Datei, sucht der Server einen neuen
 * Schlüssel, findet keinen und legt einen neuen Stripe-Preis an. Laufende
 * Abos behalten ihren alten Preis — so will es auch das Gesetz.
 */
export function preisSchluessel(stufe: AboStufe, intervall: AboIntervall): string {
  return `tidal_deepfight_${stufe}_${intervall}_${stufeInfo(stufe).netto[intervall]}`;
}

export function nachkaufSchluessel(): string {
  return `tidal_deepfight_${NACHKAUF.id}_${NACHKAUF.netto}`;
}

// ─── Der Abo-Zustand am Gym ────────────────────────────────────────────────

/**
 * Was am Gym-Dokument unter `subscription` steht, sobald ein Gym ein Abo hat.
 * Geschrieben ausschließlich vom Webhook (Admin-SDK). `plan: "free"` ist der
 * Gratis-Tarif aus Schritt 1a.
 */
export interface GymAbo {
  plan: "free" | AboStufe;
  intervall: AboIntervall | null;
  /** Stripe-Zustand, wie er kommt (active, past_due, canceled, …). */
  stripeStatus: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  /** Ende des bezahlten Zeitraums = nächste Abbuchung. */
  currentPeriodEnd: Date | null;
  /** Gekündigt, endet zu diesem Datum. */
  kuendigtZum: Date | null;
  /** Erste geplatzte Zahlung — ab hier läuft die Frist von 14 Tagen. */
  zahlungOffenSeit: Date | null;
}

export type AboLage = "keins" | "aktiv" | "zahlung-offen" | "gekuendigt";

/** Die Lage, aus der die Seite ihre Sätze wählt. */
export function aboLage(abo: GymAbo | null): AboLage {
  if (!abo || abo.plan === "free" || !abo.stripeSubscriptionId) return "keins";
  const s = abo.stripeStatus;
  if (s === "canceled" || s === "incomplete_expired" || s === "unpaid") return "keins";
  if (s === "past_due" || s === "incomplete") return "zahlung-offen";
  if (abo.kuendigtZum) return "gekuendigt";
  return "aktiv";
}

/** Bis wann eine offene Zahlung nachgeholt sein muss. */
export function fristEnde(abo: GymAbo): Date | null {
  if (!abo.zahlungOffenSeit) return null;
  return new Date(abo.zahlungOffenSeit.getTime() + ZAHLUNGSFRIST_TAGE * 86_400_000);
}

/** Gym-Dokument → Abo. Fehlt etwas, gilt der Gratis-Tarif. */
export function decodeGymAbo(sub: unknown): GymAbo {
  const d = (sub ?? {}) as Record<string, unknown>;
  const datum = (x: unknown): Date | null =>
    (x as { toDate?: () => Date } | undefined)?.toDate?.() ?? null;
  const text = (x: unknown): string | null => (typeof x === "string" && x ? x : null);
  return {
    plan: istAboStufe(d.plan) ? d.plan : "free",
    intervall: istAboIntervall(d.intervall) ? d.intervall : null,
    stripeStatus: text(d.stripeStatus),
    stripeCustomerId: text(d.stripeCustomerId),
    stripeSubscriptionId: text(d.stripeSubscriptionId),
    currentPeriodEnd: datum(d.currentPeriodEnd),
    kuendigtZum: datum(d.kuendigtZum),
    zahlungOffenSeit: datum(d.zahlungOffenSeit),
  };
}

/** Liest das Abo eines Gyms (Client). Wirft bei Lesefehlern. */
export async function getGymAbo(gymId: string): Promise<GymAbo> {
  const { doc, getDoc } = await import("firebase/firestore");
  const { getFirestoreDb } = await import("./firebase");
  const snap = await getDoc(doc(getFirestoreDb(), "gyms", gymId));
  return decodeGymAbo(snap.get("subscription"));
}

/** „21. Oktober 2026" */
export function datumLang(d: Date): string {
  return d.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
}
