/**
 * Zeigt den Bewertungs-Prompt (System + Nutzer) für eine GESPEICHERTE
 * Analyse — ohne KI-Aufruf, kostet nichts. Wer am Prompt in
 * lib/server/claude.ts schraubt, prüft hier Kampfart-Absatz, Fläche,
 * Fragenkatalog und Du-Form, bevor ein echter Lauf Guthaben kostet.
 *
 * Aufruf (Projektstamm Tidal-Athletics-App):
 *   node --import ./scripts/lib/ts-loader-register.mjs scripts/zeige-bewertungs-prompt.mjs <analyse.json> [sport] [flaeche] [variante]
 *
 * <analyse.json> = ein Analyse-Dokument oder ein Array mit einem (Format der
 * Beweisläufe, z. B. D:\Tidal-Athletics\tmp\beweis-steckbrief-2026-09-17\lauf2-mma\analyse-A.json).
 * sport/flaeche/variante überschreiben die Werte am Dokument ("-" = null).
 */
import { readFileSync } from "node:fs";
import { bewertungsPrompt } from "../lib/server/claude.ts";

const [datei, sportArg, flaecheArg, varianteArg] = process.argv.slice(2);
if (!datei) {
  console.error("Aufruf: … zeige-bewertungs-prompt.mjs <analyse.json> [sport] [flaeche] [variante]");
  process.exit(1);
}
const roh = JSON.parse(readFileSync(datei, "utf8"));
const a = Array.isArray(roh) ? roh[0] : roh;
const wert = (arg, feld) => (arg === undefined ? (a[feld] ?? null) : arg === "-" ? null : arg);

const { system, user } = bewertungsPrompt({
  mode: a.mode,
  fighter: a.fighter,
  observation: a.observation,
  existingDna: {},
  existingSplit: null,
  existingStats: [],
  profileContext: "",
  recency: a.recency ?? "unknown",
  sport: wert(sportArg, "sport"),
  flaeche: wert(flaecheArg, "flaeche"),
  variante: wert(varianteArg, "variante"),
  tier: "flash",
});

console.log("══ SYSTEM ══\n" + system + "\n\n══ NUTZER ══\n" + user);
console.log(`\n══ Länge: System ${system.length} Zeichen, Nutzer ${user.length} Zeichen (≈ ${Math.round((system.length + user.length) / 3.5)} Tokens)`);
