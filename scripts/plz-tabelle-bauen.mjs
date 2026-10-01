/**
 * PLZ-TABELLE BAUEN — aus dem GeoNames-Abzug wird public/daten/plz-de.json.
 *
 *   node scripts/plz-tabelle-bauen.mjs <Pfad zu DE.txt>
 *
 * Quelle: https://download.geonames.org/export/zip/DE.zip (GeoNames Postal
 * Codes, Creative Commons Attribution 4.0 — die Quelle steht auf /gym-finden
 * und in der Datei selbst). Der Abzug liegt NICHT im Repo; wer die Tabelle
 * erneuert, lädt ihn frisch und lässt dieses Skript laufen.
 *
 * WARUM EINE EIGENE TABELLE (Leon 30.09.2026, Gym-Suche): Die Suche nach PLZ
 * oder Ort soll keine fremde Adresse anfragen. Was ein Athlet eintippt,
 * bleibt im Browser — die Tabelle kommt von unserer eigenen Adresse.
 *
 * WAS HERAUSFÄLLT: Der Abzug führt neben den Zustell-PLZ rund 8.000 Zeilen
 * mit Großkunden-PLZ („10875 Daimler Insurance Services GmbH") und
 * Ortsteil-Dubletten. Die tragen alle KEINE Genauigkeit (letzte Spalte leer)
 * und fliegen damit raus. Übrig: 8.172 PLZ (Stand 01.10.2026).
 *
 * FORMAT (klein gehalten, die Datei geht an Handys):
 *   laender: ["Baden-Württemberg", …]            Index = Land
 *   plz:     [["01067","Dresden",51.0547,13.7269], …]   eine Zeile je PLZ
 *   orte:    [["Dresden",12,51.054,13.737,"01067",28], …] Name, Land, Mitte,
 *            erste PLZ, Anzahl PLZ — gruppiert nach Name + Kreis
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const quelle = process.argv[2];
if (!quelle) {
  console.error("Aufruf: node scripts/plz-tabelle-bauen.mjs <Pfad zu DE.txt>");
  process.exit(1);
}

const zeilen = readFileSync(quelle, "utf8")
  .split(/\r?\n/)
  .filter(Boolean)
  .map((l) => l.split("\t"))
  // [0] Land, [1] PLZ, [2] Ort, [3] Bundesland, [8] Kreis-Schlüssel,
  // [9] Breite, [10] Länge, [11] Genauigkeit (leer = Großkunde/Dublette)
  .filter((r) => r[0] === "DE" && /^\d{5}$/.test(r[1]) && r[11] !== "");
// Der Abzug schreibt Bayern mal deutsch, mal englisch.
for (const r of zeilen) if (r[3] === "Bavaria") r[3] = "Bayern";

// PLZ auf ~10 m (der Pin des Gyms startet dort), Orte auf ~100 m (nur die
// Mitte einer Suche).
const mitte = (rs, stellen) => {
  const f = 10 ** stellen;
  const rund = (x) => Math.round(x * f) / f;
  return [
    rund(rs.reduce((s, r) => s + Number(r[9]), 0) / rs.length),
    rund(rs.reduce((s, r) => s + Number(r[10]), 0) / rs.length),
  ];
};

const laender = [...new Set(zeilen.map((r) => r[3]))].sort((a, b) => a.localeCompare(b, "de"));
const landIndex = new Map(laender.map((l, i) => [l, i]));

// ─── Eine Zeile je PLZ: Mitte aller Orte, kürzester Ortsname ───────────────
const jePlz = new Map();
for (const r of zeilen) (jePlz.get(r[1]) ?? jePlz.set(r[1], []).get(r[1])).push(r);
const plz = [...jePlz.entries()]
  .sort(([a], [b]) => (a < b ? -1 : 1))
  .map(([code, rs]) => {
    const name = rs.map((r) => r[2]).sort((a, b) => a.length - b.length || a.localeCompare(b, "de"))[0];
    return [code, name, ...mitte(rs, 4)];
  });

// ─── Orte: Name + Kreis ────────────────────────────────────────────────────
const jeOrt = new Map();
for (const r of zeilen) {
  const k = `${r[2]}|${r[8]}`;
  (jeOrt.get(k) ?? jeOrt.set(k, []).get(k)).push(r);
}
const orte = [...jeOrt.values()]
  .map((rs) => {
    const codes = [...new Set(rs.map((r) => r[1]))].sort();
    return [rs[0][2], landIndex.get(rs[0][3]), ...mitte(rs, 3), codes[0], codes.length];
  })
  .sort((a, b) => a[0].localeCompare(b[0], "de") || (a[4] < b[4] ? -1 : 1));

const stand = new Date().toISOString().slice(0, 10);
const daten = {
  quelle: `GeoNames Postal Codes (www.geonames.org), CC BY 4.0, Abzug ${stand}`,
  laender,
  plz,
  orte,
};
mkdirSync("public/daten", { recursive: true });
const json = JSON.stringify(daten);
writeFileSync("public/daten/plz-de.json", json);
console.log(`${plz.length} PLZ, ${orte.length} Orte, ${laender.length} Länder, ${(json.length / 1024).toFixed(0)} KB → public/daten/plz-de.json`);
