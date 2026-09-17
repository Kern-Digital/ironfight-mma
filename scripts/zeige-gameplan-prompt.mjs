/**
 * Zeigt den Gameplan-Prompt (System + Nutzer) aus zwei GESPEICHERTEN Profilen —
 * ohne KI-Aufruf, kostet nichts. Wer an lib/server/gameplan-prompt.ts
 * schraubt, prüft hier Belege, Kampfart-Absatz und Umfang, bevor ein echter
 * Lauf Guthaben kostet.
 *
 * Aufruf (Projektstamm Tidal-Athletics-App):
 *   node --import ./scripts/lib/ts-loader-register.mjs scripts/zeige-gameplan-prompt.mjs <athlet.json> <gegner.json> [sport]
 *
 * <athlet.json> und <gegner.json> = ein Profil-Dokument ODER eine Datei mit
 * { main, mma, … } (Format der Beweisläufe, z. B.
 * D:\Tidal-Athletics\tmp\beweis-steckbrief-2026-09-17\lauf3-abnahme\profil-A.json).
 * Beim Athleten zählt das Profil der Kampfart, beim Gegner `main`.
 * sport Standard: mma.
 */
import { readFileSync } from "node:fs";
import { gameplanPrompt, gameplanSchluessel, gameplanVoraussetzung } from "../lib/server/gameplan-prompt.ts";

const [athletDatei, gegnerDatei, sportArg] = process.argv.slice(2);
if (!athletDatei || !gegnerDatei) {
  console.error("Aufruf: … zeige-gameplan-prompt.mjs <athlet.json> <gegner.json> [sport]");
  process.exit(1);
}
const sport = sportArg ?? "mma";
const lies = (datei, schluessel) => {
  const roh = JSON.parse(readFileSync(datei, "utf8"));
  const p = roh[schluessel] ?? roh.main ?? roh;
  return { dna: p.dna ?? {}, dnaSplit: p.dnaSplit ?? null, actionStats: p.actionStats ?? [], evidence: p.evidence ?? null };
};

const eingabe = {
  sport,
  wettkampf: { name: "Probe-Wettkampf", datum: new Date("2026-10-24T18:00:00Z") },
  athlet: { name: "Person A", profil: lies(athletDatei, sport) },
  gegner: {
    name: "Person B",
    profil: lies(gegnerDatei, "main"),
    eckdaten: ["Auslage: Orthodox"],
    staerken: [],
    schwaechen: [],
    lieblingsangriffe: [],
    notizen: null,
    nurSnapshot: false,
  },
};

console.log(`Voraussetzung: ${gameplanVoraussetzung(eingabe) ?? "erfüllt"}`);
const p = gameplanPrompt(eingabe);
console.log("══ SYSTEM ══\n" + p.system + "\n\n══ NUTZER ══\n" + p.user);
console.log(
  `\n══ Länge: System ${p.system.length} Zeichen, Nutzer ${p.user.length} Zeichen (≈ ${Math.round((p.system.length + p.user.length) / 3.5)} Tokens) · Schlüssel ${gameplanSchluessel(p)}`,
);
