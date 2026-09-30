/**
 * Profilbilder — die feste Auswahl, aus der sich jedes Konto eins nimmt
 * (Leon 29.09.2026). Es gibt KEIN Hochladen: 14 gezeichnete Figuren, das
 * users-Dokument trägt nur die ID im Feld `avatar`.
 *
 * Die Originale (1254 px, je ~2,4 MB) liegen außerhalb des Repos in
 * `D:\Tidal-Athletics\assets\profilbilder\`; ausgeliefert werden die
 * 256-px-WebP aus `public/profilbilder/` (je ~10 KB). Wer eine Figur
 * hinzufügt, legt beides an und trägt die ID hier ein — eine unbekannte ID im
 * Dokument fällt still aufs Namenskürzel zurück.
 */

export const PROFILBILDER = [
  { id: "kael", name: "Kael" },
  { id: "rin", name: "Rin" },
  { id: "zora", name: "Zora" },
  { id: "ivar", name: "Ivar" },
  { id: "fen", name: "Fen" },
  { id: "lyn", name: "Lyn" },
  { id: "koda", name: "Koda" },
  { id: "rook", name: "Rook" },
  { id: "neris", name: "Neris" },
  { id: "orin", name: "Orin" },
  { id: "nox", name: "Nox" },
  { id: "veya", name: "Veya" },
  { id: "mako", name: "Mako" },
  { id: "elio", name: "Elio" },
] as const;

export type ProfilbildId = (typeof PROFILBILDER)[number]["id"];

const IDS = new Set<string>(PROFILBILDER.map((b) => b.id));

/** Liest das Feld aus einem Dokument — alles Unbekannte wird `null`. */
export function readProfilbild(value: unknown): ProfilbildId | null {
  return typeof value === "string" && IDS.has(value)
    ? (value as ProfilbildId)
    : null;
}

export function profilbildSrc(id: ProfilbildId): string {
  return `/profilbilder/${id}.webp`;
}
