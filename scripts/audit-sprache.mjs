/**
 * SPRACH-PRÜFUNG — app-weite Suche nach Texten, die gegen die Sprachregel
 * verstoßen (modern, sportlich, aktiv, „du"; CLAUDE.md → Konventionen).
 *
 * DAUERWERKZEUG (Leon 02.09.2026: „behalten ja"). Vor der Abnahme jeder neuen
 * Seite laufen lassen — der Behörden-Ton schleicht sich nicht durch Absicht
 * ein, sondern weil sachlich-korrekte Sätze am leichtesten zu schreiben sind.
 *
 * GESUCHT WIRD NICHT „schlechte Sprache" (das kann kein Regex), sondern die
 * drei GRAMMATISCHEN Muster, die den Behörden-Ton erzeugen:
 *
 *   1. PASSIV        „Änderungen werden gespeichert" — niemand handelt.
 *   2. VERNEINUNG    „wird NICHT automatisch gespeichert" — erklärt, was die
 *                    App nicht tut, statt zu sagen, was du tun kannst.
 *                    Leons Beispiel 02.09.
 *   3. SYSTEM-SUBJEKT „Die App zeigt dir…" — die Maschine redet über sich.
 *
 * Ausgabe: Datei + Zeile + Text, gruppiert nach Muster, damit jeder Treffer
 * einzeln beurteilt werden kann. Ein Treffer ist ein VERDACHT, kein Urteil —
 * „nicht mehr gültig" ist zum Beispiel richtig so.
 *
 * Aufruf: node scripts/audit-sprache.mjs [> bericht.txt]
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["app", "components"];

/** Sichtbarer Text? Alles, was nur der Code liest, fällt raus. */
const NOISE =
  /className|style=|import |from ["']|font:|background|color:|border|shadow|var\(|=>|: string|: boolean|: number|Record<|useState|console\.|process\.|href=|aria-hidden|data-|\.map\(|\.filter\(/;

const MUSTER = [
  {
    key: "VERNEINUNG",
    hinweis: "sagt, was NICHT geht — besser: was du tun kannst",
    re: /\b(nicht|kein|keine|keinen|keiner|keinem|niemals|nie)\b/i,
  },
  {
    key: "PASSIV",
    hinweis: "niemand handelt — besser: „du …“",
    re: /\b(wird|werden|wurde|wurden)\b\s+(?:\w+\s+){0,3}?(ge\w{2,}(?:t|en)|angezeigt|gespeichert|hinterlegt|erstellt|entfernt|gelöscht|übernommen|benötigt|verwendet)\b/i,
  },
  {
    key: "SYSTEM-SUBJEKT",
    hinweis: "die Maschine redet über sich",
    re: /\b(Die App|Das System|Die Anwendung|Die Seite zeigt|Es wird|Es werden|Diese Funktion)\b/,
  },
];

/** Deutsch genug, um UI-Text zu sein? */
const DEUTSCH =
  /\b(du|dein|deine|deinen|deiner|dich|dir|und|oder|nicht|kein|ist|sind|wird|werden|kannst|hast|für|mit|von|dem|der|die|das)\b/i;

function dateien(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      dateien(p, out);
    } else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const treffer = new Map(MUSTER.map((m) => [m.key, []]));
let geprueft = 0;

for (const datei of ROOTS.flatMap((r) => dateien(r))) {
  const zeilen = readFileSync(datei, "utf8").split(/\r?\n/);
  let imBlockKommentar = false;
  zeilen.forEach((zeile, i) => {
    const t = zeile.trim();
    // Kommentare sind Entwickler-Text, kein UI-Text.
    if (t.startsWith("/*")) imBlockKommentar = !t.includes("*/");
    if (imBlockKommentar) {
      if (t.includes("*/")) imBlockKommentar = false;
      return;
    }
    if (t.startsWith("//") || t.startsWith("*")) return;
    if (!DEUTSCH.test(t)) return;
    if (NOISE.test(t)) return;

    // Kandidaten: Zeichenketten und blanker JSX-Text
    const kandidaten = [];
    for (const m of t.matchAll(/"([^"]{16,})"/g)) kandidaten.push(m[1]);
    if (!/[<>{}=]/.test(t) && t.length > 16) kandidaten.push(t);

    for (const text of kandidaten) {
      if (!DEUTSCH.test(text)) continue;
      geprueft++;
      for (const muster of MUSTER) {
        if (muster.re.test(text)) {
          treffer.get(muster.key).push({ datei, zeile: i + 1, text });
          break;
        }
      }
    }
  });
}

console.log(`${geprueft} Textstellen geprüft.\n`);
for (const muster of MUSTER) {
  const liste = treffer.get(muster.key);
  console.log(`\n${"=".repeat(72)}`);
  console.log(`${muster.key} — ${muster.hinweis}  (${liste.length} Verdachtsfälle)`);
  console.log("=".repeat(72));
  let letzteDatei = null;
  for (const t of liste) {
    if (t.datei !== letzteDatei) {
      console.log(`\n  ${t.datei}`);
      letzteDatei = t.datei;
    }
    console.log(`   ${String(t.zeile).padStart(5)}  ${t.text.slice(0, 150)}`);
  }
}
