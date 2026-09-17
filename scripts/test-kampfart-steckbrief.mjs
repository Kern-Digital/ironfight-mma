/**
 * Prüft die Kampfart-Steckbriefe (lib/kampfart-steckbrief.ts) gegen den
 * Entwurf docs/kampfart-steckbriefe.md und Leons Entscheidungen vom
 * 17.09.2026 — ohne Firestore, ohne Netz, ohne Build.
 *
 * Aufruf (Projektstamm Tidal-Athletics-App):
 *   node --import ./scripts/lib/ts-loader-register.mjs scripts/test-kampfart-steckbrief.mjs
 *
 * Die Rechnung mit Steckbrief (collectPulls, Signale, Gelegenheiten) prüft
 * scripts/test-profil-rechnung.mjs; hier stehen die reinen Daten.
 */

import {
  ACTION_CATALOG,
  ACTION_GROUPS,
} from "../lib/fight-stats.ts";
import { DNA_CATEGORIES, DNA_QUESTION_BY_ID, frageLabel } from "../lib/gegner-dna.ts";
import {
  SIGNAL_JE_FRAGE,
  STECKBRIEFE,
  ZUSATZFRAGEN_GILT_IN,
  erlaubteTechniken,
  filtereBeobachtung,
  filtereTechnikStats,
  frageGiltFuer,
  gesperrteGruppen,
  begriffe,
  flaecheFromText,
  kategorieLabel,
  offeneFragen,
  splitNachSteckbrief,
  technikErlaubt,
  varianteFuer,
  zonenLabel,
  zonenPhrase,
} from "../lib/kampfart-steckbrief.ts";
import { SPORT_ORDER, sportFromText } from "../lib/video-analysis.ts";

let fehler = 0;
let geprueft = 0;
function erwarte(bez, ist, soll) {
  geprueft += 1;
  const ok = JSON.stringify(ist) === JSON.stringify(soll);
  if (!ok) fehler += 1;
  console.log(`${ok ? "✓" : "✗"} ${bez.padEnd(72)} ${ok ? "" : `→ ${JSON.stringify(ist)} (erwartet ${JSON.stringify(soll)})`}`);
}

const alleFragen = DNA_CATEGORIES.flatMap((c) => c.questions.map((q) => q.id));
const alleTechniken = ACTION_CATALOG.map((a) => a.id);

// ─── Katalog ─────────────────────────────────────────────────────────────────
console.log("\nKatalog");
erwarte("67 Fragen (59 + 8 Zusatzfragen)", alleFragen.length, 67);
erwarte("entry-patterns_jab ist gestrichen", alleFragen.includes("entry-patterns_jab"), false);
erwarte("jede Frage hat eine Du-Fassung", DNA_CATEGORIES.every((c) => c.questions.every((q) => /\b(du|dein\w*|dir|dich)\b/i.test(q.labelDu))), true);
// Leon 17.09.2026: „Du-Fragen kürzer" — keine Du-Frage länger als 55 Zeichen, keine Aufzählung.
erwarte("Du-Fragen kurz (≤ 55 Zeichen, ohne „ – “)",
  DNA_CATEGORIES.flatMap((c) => c.questions).filter((q) => q.labelDu.length > 55 || q.labelDu.includes(" – ")).map((q) => q.id), []);
erwarte("Gegner-Fassung nennt nie „der Gegner“ als Subjekt der Frage", alleFragen.filter((id) => /^Was macht der Gegner|reagiert der Gegner|bewegt sich der Gegner|ist der Gegner/.test(DNA_QUESTION_BY_ID.get(id).label)), []);
erwarte("frageLabel: Athlet bekommt die Du-Fassung", frageLabel("defensive-reactions_pressure", "athlete"), "Wie reagierst du auf Druck?");
erwarte("37 Techniken", alleTechniken.length, 37);
erwarte("sechs Gruppen, clinch und submission neu", ACTION_GROUPS, ["strike", "kick", "clinch", "takedown", "ground", "submission"]);
erwarte("Rückfall-IDs throw und submission bleiben", ["throw", "submission"].every((id) => alleTechniken.includes(id)), true);
erwarte("jede Technik hat versucht UND gelungen", ACTION_CATALOG.every((a) => a.versucht.trim() && a.gelungen.trim()), true);
erwarte("keine Katalog-ID doppelt", new Set(alleTechniken).size, alleTechniken.length);

// ─── Steckbriefe gegen den Katalog ───────────────────────────────────────────
console.log("\nSteckbriefe gegen den Katalog");
for (const sport of SPORT_ORDER) {
  const s = STECKBRIEFE[sport];
  erwarte(`${sport}: jede gesperrte Frage existiert`, Array.from(s.gesperrt).filter((q) => !alleFragen.includes(q)), []);
  erwarte(`${sport}: jede erlaubte Technik existiert`, Array.from(s.techniken).filter((t) => !alleTechniken.includes(t)), []);
}
erwarte("SIGNAL_JE_FRAGE nennt nur existierende Fragen", Object.keys(SIGNAL_JE_FRAGE).filter((q) => !alleFragen.includes(q)), []);
erwarte("SIGNAL_JE_FRAGE: 28 Einträge", Object.keys(SIGNAL_JE_FRAGE).length, 28);
erwarte("shoots und gets-hit-by hängen an attacked", [SIGNAL_JE_FRAGE["defensive-reactions_shoots"], SIGNAL_JE_FRAGE["weaknesses_gets-hit-by"]], ["attacked", "attacked"]);
erwarte("acht Zusatzfragen mit Geltung", Object.keys(ZUSATZFRAGEN_GILT_IN).filter((q) => alleFragen.includes(q)).length, 8);

// ─── Offene Fragen je Kampfart (Entwurf 3.2) ─────────────────────────────────
console.log("\nOffene Fragen je Kampfart");
erwarte("MMA 66 · Boxen 54 · Kickboxen 56 · Ringen 56 · Sambo 57 · BJJ 53",
  SPORT_ORDER.map((s) => offeneFragen(s).length), [66, 54, 56, 56, 57, 53]);
erwarte("ohne Kampfart gilt jede Frage", offeneFragen(null).length, 67);
erwarte("Boxen sperrt die Takedown-Frage", frageGiltFuer("entry-patterns_takedown", "boxen"), false);
erwarte("Boxen lässt den Clinch-Entry offen", frageGiltFuer("entry-patterns_clinch", "boxen"), true);
erwarte("Kickboxen sperrt Takedown-Drills", frageGiltFuer("drills_takedown-sequences", "kickboxen"), false);
erwarte("Ringen sperrt Jabs", frageGiltFuer("defensive-reactions_jabs", "ringen"), false);
erwarte("BJJ sperrt „drückt zum Rand“, lässt at-cage offen",
  [frageGiltFuer("cage-space_pushes-cage", "bjj"), frageGiltFuer("cage-space_at-cage", "bjj")], [false, true]);
erwarte("MMA: Wurfrichtung gilt nicht, Guard schon",
  [frageGiltFuer("entry-patterns_throw-direction", "mma"), frageGiltFuer("preferred-weapons_guard", "mma")], [false, true]);
erwarte("Sambo: Aufgabegriffe gelten, Guard nicht",
  [frageGiltFuer("preferred-weapons_submission", "sambo"), frageGiltFuer("preferred-weapons_guard", "sambo")], [true, false]);
erwarte("nach Wackler: Boxen ja, Ringen nein",
  [frageGiltFuer("real-habits_after-rocked", "boxen"), frageGiltFuer("real-habits_after-rocked", "ringen")], [true, false]);

// ─── Techniken je Kampfart (Entwurf Abschnitt 7) ─────────────────────────────
console.log("\nTechniken je Kampfart");
erwarte("MMA zählt alle 37", erlaubteTechniken("mma").length, 37);
erwarte("Boxen zählt 5 Schläge", erlaubteTechniken("boxen"), ["jab", "cross", "hook", "uppercut", "overhand"]);
erwarte("Kickboxen (Variante Kickboxen) 13", erlaubteTechniken("kickboxen", "kickboxen").length, 13);
erwarte("Kickboxen (Variante Muay Thai) 16", erlaubteTechniken("kickboxen", "muay-thai").length, 16);
erwarte("Kickboxen ohne Variante (Bestand) 16", erlaubteTechniken("kickboxen", null).length, 16);
erwarte("Muay Thai öffnet elbow, Kickboxen sperrt ihn",
  [technikErlaubt("elbow", "kickboxen", "muay-thai"), technikErlaubt("elbow", "kickboxen", "kickboxen")], [true, false]);
erwarte("Ringen 13 · Sambo 17 · BJJ 17 (inkl. Rückfall submission)",
  [erlaubteTechniken("ringen").length, erlaubteTechniken("sambo").length, erlaubteTechniken("bjj").length], [13, 17, 17]);
erwarte("Sambo: choke und leglock zählen, jab nicht",
  [technikErlaubt("choke", "sambo"), technikErlaubt("leglock", "sambo"), technikErlaubt("jab", "sambo")], [true, true, false]);
erwarte("BJJ sperrt turn, hold-down, go-behind",
  ["turn", "hold-down", "go-behind"].map((t) => technikErlaubt(t, "bjj")), [false, false, false]);
erwarte("Boxen: gesperrte Gruppen", gesperrteGruppen("boxen"), ["kick", "clinch", "takedown", "ground", "submission"]);
erwarte("Kickboxen sperrt Takedowns, Boden, Aufgabegriffe", gesperrteGruppen("kickboxen", "kickboxen"), ["takedown", "ground", "submission"]);
erwarte("Variante gilt nur in ihrer Kampfart", [varianteFuer("boxen", "muay-thai"), varianteFuer("kickboxen", "muay-thai")], [null, "muay-thai"]);

// ─── Filter nach der Beobachtung ─────────────────────────────────────────────
console.log("\nFilter nach der Beobachtung");
const beobachtung = {
  identification: { description: "", idConfidence: 0.9, evidence: [] },
  meta: {},
  actions: [
    { id: "jab", otherLabel: null, attempted: 12, landed: 5, zone: "center", setup: null, damage: null, timestamps: [] },
    { id: "low-kick", otherLabel: null, attempted: 6, landed: 4, zone: "cage", setup: null, damage: null, timestamps: [] },
    { id: "double-leg", otherLabel: null, attempted: 1, landed: 1, zone: "cage", setup: null, damage: null, timestamps: [] },
    { id: "elbow", otherLabel: null, attempted: 2, landed: 0, zone: null, setup: null, damage: null, timestamps: [] },
    { id: "other", otherLabel: "Superman Punch", attempted: 1, landed: 0, zone: null, setup: null, damage: null, timestamps: [] },
  ],
  dnaSplit: { boxing: 40, kicking: 30, wrestling: 10, ground: 10, clinch: 10 },
  combos: [],
  defense: { takedownsDefended: 2, takedownsAgainst: 2, strikesAvoided: 5, strikesAgainst: 9, hitLocations: null, knockdownsReceived: 0, rockedMoments: [] },
  controlTime: { clinchSeconds: 10, topSeconds: 8, bottomSeconds: 0, cagePressureSeconds: 5, pressedSeconds: 0 },
  movement: null,
  rounds: [],
  notes: null,
};
const kick = filtereBeobachtung(beobachtung, "kickboxen", "kickboxen");
erwarte("Kickboxen verwirft Double Leg (Kampfart) und Ellbogen (Variante)", kick.verworfen,
  [{ id: "double-leg", attempted: 1, grund: "kampfart" }, { id: "elbow", attempted: 2, grund: "variante" }]);
erwarte("Kickboxen behält jab, low-kick und other", kick.observation.actions.map((a) => a.id), ["jab", "low-kick", "other"]);
erwarte("Kickboxen: Split ohne wrestling/ground, Summe 100", kick.observation.dnaSplit, { boxing: 50, kicking: 38, wrestling: 0, ground: 0, clinch: 12 });
erwarte("Kickboxen: Takedown-Abwehrzähler genullt, Schläge bleiben",
  [kick.observation.defense.takedownsAgainst, kick.observation.defense.strikesAgainst], [null, 9]);
erwarte("Kickboxen: Oben-Sekunden genullt", kick.observation.controlTime.topSeconds, null);
erwarte("Rohbeobachtung bleibt unverändert", beobachtung.actions.length, 5);
const thai = filtereBeobachtung(beobachtung, "kickboxen", "muay-thai");
erwarte("Muay Thai behält den Ellbogen", thai.observation.actions.some((a) => a.id === "elbow"), true);
const bjj = filtereBeobachtung(beobachtung, "bjj", null);
erwarte("BJJ: keine Zonen, kein Rand-Druck",
  [bjj.observation.actions.every((a) => a.zone === null), bjj.observation.controlTime.cagePressureSeconds], [true, null]);
erwarte("BJJ: Schlagzähler genullt", bjj.observation.defense.strikesAgainst, null);
erwarte("ohne Kampfart: nichts gefiltert", filtereBeobachtung(beobachtung, null).verworfen, []);
erwarte("Zähler-Filter: Boxen behält nur Schläge",
  filtereTechnikStats([{ id: "cross", attempted: 3, landed: 1 }, { id: "body-kick", attempted: 2, landed: 1 }], "boxen").stats.map((s) => s.id), ["cross"]);
erwarte("Split-Nullen Boxen neu normiert", splitNachSteckbrief({ boxing: 50, kicking: 30, wrestling: 0, ground: 0, clinch: 20 }, "boxen"),
  { boxing: 71, kicking: 0, wrestling: 0, ground: 0, clinch: 29 });
erwarte("Boxen nur mit Bodenzeit → kein Split", splitNachSteckbrief({ boxing: 0, kicking: 0, wrestling: 0, ground: 100, clinch: 0 }, "boxen"), null);

// ─── Begriffe und Kampf-Sambo ────────────────────────────────────────────────
console.log("\nBegriffe");
// Leon 17.09.2026 nach dem Beweislauf: „Käfig nur, wenn einer da ist" — die
// Wörter hängen an der FLÄCHE des Videos, nicht an der Kampfart.
erwarte("Zonen je Fläche: Käfig · Seile · Mattenrand",
  [zonenLabel("mma", "kaefig").cage, zonenLabel("kickboxen", "ring").cage, zonenLabel("mma", "matte").cage], ["Am Käfig", "An den Seilen", "Am Mattenrand"]);
erwarte("ohne Fläche neutral — auch MMA und Boxen", [zonenLabel("mma").cage, zonenLabel("boxen").center, zonenPhrase(null).cage], ["Am Rand", "Mitte", "am Rand"]);
erwarte("BJJ hat keine Zone, auch auf der Matte", [zonenLabel("bjj"), zonenLabel("bjj", "matte")], [null, null]);
erwarte("Kategorie-Label je Fläche", [kategorieLabel("kaefig"), kategorieLabel("ring"), kategorieLabel("matte"), kategorieLabel(null)], ["Käfig & Raum", "Ring & Raum", "Matte & Raum", "Raum & Rand"]);
const mmaMatte = begriffe("mma", "matte");
erwarte("MMA auf der Matte: Matte, Mattenrand, Boden-Phase aus dem Steckbrief", [mmaMatte.flaeche, mmaMatte.rand, mmaMatte.phaseBoden], ["Matte", "am Mattenrand", "Boden"]);
erwarte("Käfig-Wortschatz nur im Käfig", [mmaMatte.wortschatz.includes("Cage Control"), begriffe("mma", "kaefig").wortschatz.includes("Cage Control")], [false, true]);
erwarte("Fläche aus Text: Oktagon · Boxring · Tatami · Ringen ≠ Ring",
  [flaecheFromText("Käfig (Oktagon)"), flaecheFromText("Boxring mit Seilen"), flaecheFromText("Tatami im Gym"), flaecheFromText("Ringen auf der Matte"), flaecheFromText("Halle")],
  ["kaefig", "ring", "matte", "matte", null]);
erwarte("Kampf-Sambo läuft als MMA", [sportFromText("Kampf-Sambo"), sportFromText("Combat Sambo"), sportFromText("Sambo mit Jacke")], ["mma", "mma", "sambo"]);

console.log(`\n${geprueft - fehler}/${geprueft} Prüfungen grün`);
process.exit(fehler ? 1 : 0);
