/**
 * KONTAKT & STANDORT EINES GYMS — das, was in der Gym-Suche steht (Etappe 2
 * der Gym-Suche, 01.10.2026; Leons Antworten vom 30.09. in CLAUDE.md „KONTEN
 * OHNE GYM").
 *
 * Liegt als Feld `kontakt` im Gym-Dokument. Geschrieben wird es NUR über
 * `POST /api/gym/kontakt` (Verwaltung des Gyms, Admin-SDK), herausgegeben an
 * Fremde NUR über `POST /api/gyms/suche` — die Regeln für `gyms/{gymId}`
 * bleiben zu (Mitglieder lesen ihr Gym, sonst niemand). Das Gym-Dokument
 * trägt auch Abo und Stripe-Kunde; eine geöffnete Leseregel gäbe beides mit
 * heraus.
 *
 * DER SCHALTER STEHT STANDARDMÄSSIG AN (Leon: „standardmäßig erst mal auf
 * on"), greift aber erst mit eingetragener Adresse: Ein Gym, das hier nie
 * etwas eingetragen hat, steht nicht in der Suche. Wer einträgt, tut das auf
 * einer Seite, die oben sagt, dass die Angaben öffentlich sind.
 *
 * `sichtbar` rechnet der SERVER beim Speichern aus und legt es mit ab — die
 * Suche fragt genau dieses eine Feld ab. Client UND Server lesen diese Datei;
 * keine React- und keine Node-Abhängigkeiten.
 */

export interface GymKontakt {
  /** Straße und Hausnummer. */
  strasse: string;
  plz: string;
  ort: string;
  telefon: string;
  email: string;
  /** Immer mit `https://` oder `http://` — `pruefeKontakt` ergänzt es. */
  website: string;
  /** Der Pin. `null` = noch keiner gesetzt. */
  lat: number | null;
  lng: number | null;
  /** „In der Gym-Suche zeigen" — fehlt das Feld, gilt AN. */
  inSuche: boolean;
}

export const KONTAKT_LEER: GymKontakt = {
  strasse: "",
  plz: "",
  ort: "",
  telefon: "",
  email: "",
  website: "",
  lat: null,
  lng: null,
  inSuche: true,
};

/** Was die Gym-Suche je Gym herausgibt — genau diese Schlüssel, keine weiteren. */
export interface SuchGym {
  id: string;
  name: string;
  strasse: string;
  plz: string;
  ort: string;
  telefon: string;
  email: string;
  website: string;
  lat: number;
  lng: number;
}

export const KONTAKT_MAX = {
  strasse: 120,
  ort: 80,
  telefon: 30,
  email: 120,
  website: 200,
} as const;

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function zahl(v: unknown, min: number, max: number): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;
}

/** Gym-Dokument → Kontakt. Was nicht passt, fällt weg. */
export function decodeKontakt(x: unknown): GymKontakt {
  const d = (x ?? {}) as Record<string, unknown>;
  const lat = zahl(d.lat, -90, 90);
  const lng = zahl(d.lng, -180, 180);
  const pin = lat != null && lng != null;
  return {
    strasse: text(d.strasse),
    plz: text(d.plz),
    ort: text(d.ort),
    telefon: text(d.telefon),
    email: text(d.email),
    website: text(d.website),
    lat: pin ? lat : null,
    lng: pin ? lng : null,
    inSuche: d.inSuche !== false,
  };
}

/** Straße, PLZ und Ort stehen da. */
export function adresseVollstaendig(k: GymKontakt): boolean {
  return !!k.strasse && !!k.plz && !!k.ort;
}

/**
 * Steht dieses Gym in der Gym-Suche? Schalter an, Adresse vollständig, Pin
 * gesetzt. Die EINE Stelle für diese Frage — die Verwaltungsseite zeigt
 * danach den Stand, die Route legt das Ergebnis als `sichtbar` ab.
 */
export function inSucheSichtbar(k: GymKontakt): boolean {
  return k.inSuche && adresseVollstaendig(k) && k.lat != null && k.lng != null;
}

const TELEFON = /^\+?[0-9 ()/\-.]{5,30}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** „mein-gym.de" → „https://mein-gym.de". Nur http(s) kommt durch. */
export function websiteAdresse(roh: string): string | null {
  const t = roh.trim();
  if (!t) return "";
  const mit = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(mit);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export type KontaktFeld = keyof GymKontakt;

/**
 * Prüft, was die Verwaltung schickt. Jedes Feld darf leer sein — der Schalter
 * greift ohnehin erst mit Adresse. Ein gefülltes Feld muss stimmen.
 */
export function pruefeKontakt(
  roh: unknown,
): { kontakt: GymKontakt } | { fehler: string; feld: KontaktFeld } {
  const d = (roh ?? {}) as Record<string, unknown>;
  const strasse = text(d.strasse);
  const plz = text(d.plz);
  const ort = text(d.ort);
  const telefon = text(d.telefon);
  const email = text(d.email).toLowerCase();

  if (strasse.length > KONTAKT_MAX.strasse) return { fehler: "Kürz die Straße auf 120 Zeichen.", feld: "strasse" };
  // Vier oder fünf Ziffern: Deutschland hat fünf, Österreich und die Schweiz vier.
  if (plz && !/^\d{4,5}$/.test(plz)) return { fehler: "Trag die PLZ mit 5 Ziffern ein.", feld: "plz" };
  if (ort.length > KONTAKT_MAX.ort) return { fehler: "Kürz den Ort auf 80 Zeichen.", feld: "ort" };
  if (telefon && !TELEFON.test(telefon)) {
    return { fehler: "Trag die Telefonnummer mit Ziffern ein, zum Beispiel 0711 123456.", feld: "telefon" };
  }
  if (email && (email.length > KONTAKT_MAX.email || !EMAIL.test(email))) {
    return { fehler: "Trag eine E-Mail-Adresse ein, zum Beispiel info@dein-gym.de.", feld: "email" };
  }
  const website = websiteAdresse(text(d.website));
  if (website === null || website.length > KONTAKT_MAX.website) {
    return { fehler: "Trag die Website als Adresse ein, zum Beispiel dein-gym.de.", feld: "website" };
  }

  // Der Pin: beide Zahlen oder keine.
  const ohnePin = d.lat == null && d.lng == null;
  const lat = zahl(d.lat, -90, 90);
  const lng = zahl(d.lng, -180, 180);
  if (!ohnePin && (lat == null || lng == null)) {
    return { fehler: "Setz den Pin noch einmal auf die Karte.", feld: "lat" };
  }

  return {
    kontakt: {
      strasse,
      plz,
      ort,
      telefon,
      email,
      website,
      lat: ohnePin ? null : Math.round(lat! * 1e5) / 1e5,
      lng: ohnePin ? null : Math.round(lng! * 1e5) / 1e5,
      inSuche: d.inSuche !== false,
    },
  };
}

/** „Musterstraße 12, 70173 Stuttgart" — für Liste und Karte. */
export function adressZeile(k: Pick<GymKontakt, "strasse" | "plz" | "ort">): string {
  const ortTeil = [k.plz, k.ort].filter(Boolean).join(" ");
  return [k.strasse, ortTeil].filter(Boolean).join(", ");
}

/** „https://www.dein-gym.de/kurse" → „dein-gym.de/kurse" für die Anzeige. */
export function websiteKurz(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
}
