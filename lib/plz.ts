/**
 * PLZ- UND ORTSSUCHE OHNE FREMDE ANFRAGE (Gym-Suche, Etappen 2 und 3).
 *
 * Die Tabelle liegt unter /daten/plz-de.json (gebaut von
 * scripts/plz-tabelle-bauen.mjs aus dem GeoNames-Abzug, CC BY 4.0). Der
 * Browser lädt sie EINMAL von unserer eigenen Adresse, gesucht wird im
 * Gerät: Was jemand eintippt, verlässt den Browser nicht.
 *
 * Zwei Leser: die Verwaltung („Kontakt & Standort" — die PLZ setzt Ort und
 * Pin) und /gym-finden (PLZ oder Ort → Mitte der Suche).
 */

/** [PLZ, Ort, Breite, Länge] */
type PlzZeile = [string, string, number, number];
/** [Name, Land-Index, Breite, Länge, erste PLZ, Anzahl PLZ] */
type OrtZeile = [string, number, number, number, string, number];

export interface PlzTabelle {
  quelle: string;
  laender: string[];
  plz: PlzZeile[];
  orte: OrtZeile[];
}

export interface OrtVorschlag {
  /** Stabil je Vorschlag — React-Schlüssel und Vergleich. */
  id: string;
  /** „70173 Stuttgart" oder „Stuttgart". */
  titel: string;
  /** „Baden-Württemberg" bzw. „17039 · Mecklenburg-Vorpommern". */
  zusatz: string;
  lat: number;
  lng: number;
}

export const PLZ_QUELLE_TEXT = "PLZ-Daten: GeoNames (geonames.org), CC BY 4.0";

let tabelle: Promise<PlzTabelle> | null = null;

/** Lädt die Tabelle einmal je Tab. Ein Fehler wird beim nächsten Aufruf neu versucht. */
export function ladePlzTabelle(): Promise<PlzTabelle> {
  if (!tabelle) {
    tabelle = fetch("/daten/plz-de.json")
      .then((r) => {
        if (!r.ok) throw new Error(`PLZ-Tabelle: ${r.status}`);
        return r.json() as Promise<PlzTabelle>;
      })
      .catch((err) => {
        tabelle = null;
        throw err;
      });
  }
  return tabelle;
}

/** Klein, ohne Akzente, ß → ss: „München" → „munchen". */
function falten(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Mit Umschrift: „München" → „muenchen". */
function umschrift(s: string): string {
  return falten(s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue"));
}

/**
 * Beide Schreibweisen je Ort, einmal je Tabelle gerechnet. Zwei Schlüssel
 * statt einem gefalteten: „Neuenkirchen" und „Neunkirchen" sind zwei Orte —
 * ein Schlüssel, der jedes „ue" zu „u" macht, würfe sie zusammen.
 */
const ortsSchluessel = new WeakMap<PlzTabelle, [string, string][]>();
function schluessel(t: PlzTabelle): [string, string][] {
  let s = ortsSchluessel.get(t);
  if (!s) {
    s = t.orte.map((z) => [falten(z[0]), umschrift(z[0])]);
    ortsSchluessel.set(t, s);
  }
  return s;
}

/** Genau diese PLZ — für die Verwaltung: Ort und Pin aus der PLZ. */
export function ortZurPlz(t: PlzTabelle, plz: string): OrtVorschlag | null {
  const z = t.plz.find((p) => p[0] === plz);
  if (!z) return null;
  return { id: `plz:${z[0]}`, titel: `${z[0]} ${z[1]}`, zusatz: "", lat: z[2], lng: z[3] };
}

/** Der Ortsname zu einer PLZ, ohne die PLZ davor. */
export function ortsnameZurPlz(t: PlzTabelle, plz: string): string | null {
  return t.plz.find((p) => p[0] === plz)?.[1] ?? null;
}

/**
 * Vorschläge zu einer Eingabe. Ziffern suchen PLZ (Anfang), Buchstaben Orte:
 * erst der genaue Name, dann der Wortanfang, große Orte vor kleinen.
 */
export function sucheOrte(t: PlzTabelle, eingabe: string, max = 6): OrtVorschlag[] {
  const roh = eingabe.trim();
  if (roh.length < 2) return [];

  const ziffern = /^\d{2,5}/.exec(roh)?.[0];
  if (ziffern) {
    const treffer: OrtVorschlag[] = [];
    for (const z of t.plz) {
      if (!z[0].startsWith(ziffern)) continue;
      treffer.push({ id: `plz:${z[0]}`, titel: `${z[0]} ${z[1]}`, zusatz: "", lat: z[2], lng: z[3] });
      if (treffer.length >= max) break;
    }
    return treffer;
  }

  const q = falten(roh);
  if (q.length < 2) return [];
  const namen = schluessel(t);
  const rangVon = (name: string) =>
    name === q ? 0 : name.startsWith(q) ? 1 : name.includes(` ${q}`) ? 2 : 9;
  const gefunden: { z: OrtZeile; rang: number }[] = [];
  for (let i = 0; i < t.orte.length; i++) {
    const rang = Math.min(rangVon(namen[i][0]), rangVon(namen[i][1]));
    if (rang < 9) gefunden.push({ z: t.orte[i], rang });
  }
  gefunden.sort(
    (a, b) => a.rang - b.rang || b.z[5] - a.z[5] || a.z[0].localeCompare(b.z[0], "de") || (a.z[4] < b.z[4] ? -1 : 1),
  );
  return gefunden.slice(0, max).map(({ z }) => ({
    id: `ort:${z[0]}:${z[4]}`,
    titel: z[0],
    zusatz: z[5] > 1 ? t.laender[z[1]] ?? "" : `${z[4]} · ${t.laender[z[1]] ?? ""}`,
    lat: z[2],
    lng: z[3],
  }));
}

/** Luftlinie in Kilometern (Haversine). */
export function entfernungKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
