/**
 * WOCHENPLAN ALS DATEI — Rechnungen ohne Oberfläche (28.09.2026).
 *
 * Leon 28.09.: „bau noch ein, dass man den Wochenplan sich speichern kann
 * (also herunterladen) als PDF und als Bild PNG oder JPG, so dass die
 * Verwaltung sich das Ganze in die Hallen hängen bzw. in die Gruppen posten
 * kann. In der normalen Version soll das Layout mit Tidal-Farben und
 * Tidal-Logo zu sehen sein. In der Paid-Version soll es in Gym-Farben mit
 * Gym-Logo zu sehen sein, ohne Tidal."
 *
 * Seine Antworten am selben Abend: PDF A4 quer, Bild quer, Bild hoch
 * 1080 × 1350 · Trainer unter jedem Kurs · exportiert wird der Plan, den man
 * gerade ansieht (auch ein Ferienplan, dann mit Zeitraum) · zahlendes Gym
 * ohne Logo → Gym-Name als Schriftzug in der Gym-Farbe.
 *
 * FARBEN ALS HEX, NICHT ALS TOKEN: Der Aushang ist immer hell (weißes Papier)
 * und darf weder vom Theme noch vom Bernstein der Verwaltung
 * (`[data-area="verwaltung"]` überschreibt den Akzent) abhängen. Deshalb
 * rechnet er seine Farben selbst aus Farbton und Buntheit — dieselben zwei
 * Zahlen, die das Branding-Kit speichert.
 */

import { AKZENT_TIDAL, decodeBranding } from "./gym";
import { decodeGymAbo, leistungenFuer } from "./abo";
import { oklchZuHex } from "./farbe";
import { KURSPLAN_STANDARD_NAME, planStandRechnen, tagPlus, tagText, type Wochenplan } from "./kursplan";

export type ExportFormatId = "pdf-a4" | "bild-quer" | "bild-hoch";

export interface ExportFormat {
  id: ExportFormatId;
  /** Größe der Druckfassung in CSS-Pixeln. */
  breite: number;
  hoehe: number;
  /** Aufnahme-Faktor: A4 mit 2 → 3508 × 2480 px = 300 dpi. */
  pixelRatio: number;
  lage: "quer" | "hoch";
}

export const EXPORT_FORMATE: Record<ExportFormatId, ExportFormat> = {
  // A4 bei 150 dpi (297 × 210 mm), aufgenommen mit Faktor 2 → Druckqualität.
  "pdf-a4": { id: "pdf-a4", breite: 1754, hoehe: 1240, pixelRatio: 2, lage: "quer" },
  "bild-quer": { id: "bild-quer", breite: 1920, hoehe: 1080, pixelRatio: 1, lage: "quer" },
  "bild-hoch": { id: "bild-hoch", breite: 1080, hoehe: 1350, pixelRatio: 1, lage: "hoch" },
};

export interface DruckFarben {
  /** Tagesnamen, Kante der Kurse, Schriftzug. Auf Weiß gut lesbar. */
  akzent: string;
  /** Fläche der Kurse. */
  flaeche: string;
  /** Haarlinien. */
  linie: string;
  tinte: string;
  text2: string;
  text3: string;
}

/**
 * Aus Farbton und Buntheit die Farben des Aushangs. Helligkeit 0,50 wie der
 * Akzent im hellen Theme — dort ist er als Schrift auf Weiß geprüft.
 */
export function druckFarben(h: number, c: number): DruckFarben {
  return {
    akzent: oklchZuHex(0.5, c, h),
    flaeche: oklchZuHex(0.965, Math.min(c, 0.14) * 0.22, h),
    linie: oklchZuHex(0.9, Math.min(c, 0.14) * 0.2, h),
    tinte: oklchZuHex(0.2, 0.012, h),
    text2: oklchZuHex(0.4, 0.01, h),
    text3: oklchZuHex(0.56, 0.008, h),
  };
}

/** Wessen Zeichen und Farbe der Aushang trägt. */
export interface DruckMarke {
  gymName: string;
  farben: DruckFarben;
  /** true = Tarif ohne Branding: Tidal-Farbe, Tidal-Zeichen. */
  tidal: boolean;
  /** Gym-Logo als data-URL — nur bei `tidal === false`. */
  logo: string | null;
}

/**
 * Gym-Dokument → Marke. DIE STUFE ENTSCHEIDET, NICHT DAS GESPEICHERTE
 * (wie `GymBrandingTokens`): Ein Gym, das von Gym auf Team wechselt, druckt
 * wieder mit Tidal — gelöscht wird nichts.
 */
export function markeAusGym(gymName: string, daten: { subscription?: unknown; branding?: unknown }): DruckMarke {
  const stufe = decodeGymAbo(daten.subscription).plan;
  if (!leistungenFuer(stufe).branding) {
    return { gymName, farben: druckFarben(AKZENT_TIDAL.h, AKZENT_TIDAL.c), tidal: true, logo: null };
  }
  const b = decodeBranding(daten.branding);
  const mitFarbe = b.akzentH != null && b.akzentC != null;
  return {
    gymName,
    // Ohne eigene Farbe bleibt das Cyan — als Farbe, nicht als Tidal-Zeichen.
    farben: mitFarbe ? druckFarben(b.akzentH!, b.akzentC!) : druckFarben(AKZENT_TIDAL.h, AKZENT_TIDAL.c),
    tidal: false,
    logo: b.logoUrl ?? null,
  };
}

/**
 * Ab wann der Plan gilt — für den Kopf des Aushangs. `null` beim Grundplan
 * und bei einem Plan ohne Datum: Dort steht nichts, was veralten könnte.
 */
export function gueltigText(plan: Wochenplan, plaene: Wochenplan[], heute: string): string | null {
  const { stand } = planStandRechnen(plaene, heute);
  const st = stand.get(plan.id) ?? plan;
  const t = (x: string) => tagText(x, heute);
  if (st.grundplan) return null;
  if (st.zeitraumVon && st.zeitraumBis) return `Vom ${t(st.zeitraumVon)} bis ${t(st.zeitraumBis)}`;
  if (st.zeitraumVon) return `Ab ${t(st.zeitraumVon)}`;
  const vorg = plaene.find(
    (x) => x.id !== plan.id && stand.get(x.id)?.nachfolgerId === plan.id && stand.get(x.id)?.zeitraumBis,
  );
  if (vorg) return `Ab ${t(tagPlus(stand.get(vorg.id)!.zeitraumBis!, 1))}`;
  return null;
}

/** Der Planname im Kopf — der Standardname „Wochenplan" steht schon als Label da. */
export function planNameFuerDruck(name: string): string | null {
  const n = name.trim();
  return n && n !== KURSPLAN_STANDARD_NAME ? n : null;
}

/** „Wochenplan-Sommerferien-hoch.png" — ohne Zeichen, die ein Dateisystem stören. */
export function dateiName(planName: string, format: ExportFormatId, endung: "pdf" | "png" | "jpg"): string {
  const sauber = planName
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const lage = format === "bild-hoch" ? "-hoch" : format === "bild-quer" ? "-quer" : "";
  const teil = sauber && sauber !== KURSPLAN_STANDARD_NAME ? `-${sauber}` : "";
  return `Wochenplan${teil}${lage}.${endung}`;
}
