/**
 * Prüft die reine Gameplan-Rechnung (lib/server/gameplan-prompt.ts,
 * lib/gameplan.ts) und die Kampfart am Wettkampf (Plan-Kategorien,
 * ansichtDesProfils) — ohne Firestore, ohne Netz, ohne KI.
 *
 * Aufruf (Projektstamm Tidal-Athletics-App):
 *   node --import ./scripts/lib/ts-loader-register.mjs scripts/test-gameplan.mjs
 *
 * Leons Entscheidungen (17.09.2026): Claude nur mit Beleg · automatisch nach
 * jeder neuen Analyse · drei Blöcke, Drills in Phase 2 + 3 · Kampfart Pflicht.
 */

import {
  GAMEPLAN_SCHEMA,
  gameplanLeer,
  gameplanPrompt,
  gameplanSchluessel,
  gameplanStand,
  gameplanVoraussetzung,
  normalisiereGameplan,
} from "../lib/server/gameplan-prompt.ts";
import { decodeGameplan, drillsFuerPhase, gameplanDocId, gameplanHaengt } from "../lib/gameplan.ts";
import { KATEGORIEN_JE_KAMPFART, generateFightCampPhases } from "../lib/fight-camp-generator.ts";
import {
  ansichtDesProfils,
  flaecheDesWettkampfs,
  flaecheWaehlbar,
  STANDARD_FLAECHE,
} from "../lib/kampfart-steckbrief.ts";
import { ALL_TECHNIQUES } from "../lib/techniques";
import { buchungsZuwachs, altfelder } from "../lib/server/ki-kosten.ts";
import { GAMEPLAN_AUFRUF_MS, SCOUTING_AUFSCHUB_MS } from "../lib/server/gameplan.ts";
import {
  PHASE_FOCUS,
  PHASE_GRENZEN,
  PLAN_MIN_TAGE,
  fruehestesKampfdatum,
  phasenNachVerschiebung,
  phasenZeitachse,
  planWochen,
  planZuletztGeaendert,
  pruefeKampfdatum,
  saeubereAenderung,
  verschiebungText,
  wannText,
} from "../lib/fight-camp.ts";
import { preisJeMillion, kostenAusUsage } from "../lib/server/claude-aufruf.ts";

let fehler = 0;
let geprueft = 0;
const sagt = (ok, text) => {
  geprueft++;
  if (!ok) fehler++;
  console.log(`  ${ok ? "OK  " : "FEHL"} ${text}`);
};

function evidence({ gezaehlt = 3, staerke = 45, antworten = {}, kampfarten = ["mma"], flaeche = null } = {}) {
  return {
    answers: antworten,
    splitWindow: [],
    evidenceTotal: gezaehlt,
    staerke,
    kampfarten,
    flaeche,
    countedAnalyses: gezaehlt,
    totalAnalyses: gezaehlt,
    numbersFrom: [],
    computedAt: "2026-09-17T12:00:00Z",
  };
}

const belegt = (videos, gelegenheiten, text) => ({
  winner: "a",
  both: false,
  total: videos,
  gelegenheiten,
  sides: [{ key: "a", weight: videos, text, videos, sources: [] }],
});

function eingabe(over = {}) {
  return {
    sport: "mma",
    wettkampf: { name: "Night of Champions" },
    athlet: {
      name: "Leon",
      profil: {
        dna: { "preferred-weapons_most-common": "Du nutzt den Cross am häufigsten.", "preferred-weapons_takedown": "Double Leg aus dem Clinch." },
        dnaSplit: { boxing: 60, kicking: 20, wrestling: 10, ground: 5, clinch: 5 },
        actionStats: [
          { id: "cross", attempted: 13, landed: 6, zone: "center", setup: "nach Jab" },
          { id: "body-kick", attempted: 2, landed: 0, zone: null, setup: null },
        ],
        evidence: evidence({ antworten: { "preferred-weapons_most-common": belegt(4, 5, "Cross") } }),
      },
    },
    gegner: {
      name: "Marco K.",
      profil: { dna: {}, dnaSplit: null, actionStats: [], evidence: null },
      eckdaten: ["Auslage: Southpaw"],
      staerken: ["harter Low Kick"],
      schwaechen: [],
      lieblingsangriffe: [],
      notizen: null,
      nurSnapshot: false,
    },
    ...over,
  };
}

console.log("── Voraussetzungen");
sagt(gameplanVoraussetzung(eingabe()) === null, "Athlet mit Videos + Gegner nur mit Scouting-Notiz → erfüllt");
const ohneAthlet = eingabe();
ohneAthlet.athlet.profil.evidence = evidence({ gezaehlt: 0 });
sagt(gameplanVoraussetzung(ohneAthlet) === "athlet", "Athlet ohne zählendes Video → offen · athlet");
const ohneGegner = eingabe();
ohneGegner.gegner.staerken = [];
sagt(gameplanVoraussetzung(ohneGegner) === "gegner", "Gegner ohne Video und ohne Scouting → offen · gegner");
const handGegner = eingabe();
handGegner.gegner.staerken = [];
handGegner.gegner.profil.dna = { "real-habits_repeats": "Geht nach jedem Jab zurück." };
sagt(gameplanVoraussetzung(handGegner) === null, "Gegner mit Hand-Antwort (ohne Beleg) zählt als Scouting");
const videoGegner = eingabe();
videoGegner.gegner.staerken = [];
videoGegner.gegner.profil.evidence = evidence({ gezaehlt: 2 });
sagt(gameplanVoraussetzung(videoGegner) === null, "Gegner mit 2 Videos ohne Scouting → erfüllt");

console.log("── Prompt");
const p = gameplanPrompt(eingabe());
sagt(p.system.includes("MMA-Cheftrainer"), "Rolle aus dem Steckbrief (MMA-Cheftrainer)");
sagt(p.system.includes("NUR MIT BELEG") && p.system.includes("NUR WAS VORKAM"), "Grundregeln Beleg + nur was vorkam");
sagt(p.system.includes("KEIN Urteil aus Treffern"), "Kleinstmengen-Regel (Leon: Ausführung ja, Trefferquote nein)");
sagt(p.system.includes("DER GEGNER HAT KEIN PRONOMEN") && p.system.includes("dort schlägt dein Gegner ein"), "Gegner beim Namen, nie er/sie/sein (mit Beispielen)");
sagt(p.system.includes("BELEG KURZ") && p.system.includes("unter 70 Zeichen"), "Beleg als Kurzform unter 70 Zeichen (Leon: Belege kürzer)");
sagt(p.user.includes("Cross: 13 Versuche, 6 gelungen, meist Mitte"), "Zähler mit Zone neutral");
sagt(p.user.includes("[4 von 5 Videos]"), "Beleg einer Antwort: 4 von 5 Videos");
sagt(p.user.includes("[Trainer-Eintrag]"), "Antwort ohne Rechnung → Trainer-Eintrag");
sagt(p.user.includes("Stärken (Scouting-Notiz): harter Low Kick"), "Scouting-Notiz des Gegners");
sagt(p.user.includes("Wettkampfs ist unbekannt") && !/Käfig(?!", „Cage)/.test(p.user.replace(/nie „Käfig", „Cage" oder „Seile"/, "")), "Fläche neutral, kein Käfig-Wort");
sagt(/Was nutzt du am häufigsten|Du nutzt|du/.test(p.user.split("GEGNER —")[0]), "Athleten-Teil in Du-Fragen");
const boxen = gameplanPrompt({ ...eingabe(), sport: "boxen" });
sagt(boxen.user.includes("Gesperrt:") && !boxen.user.includes("Double Leg aus dem Clinch"), "Boxen: gesperrte Gruppen genannt, Takedown-Frage fällt weg");
sagt(!boxen.user.includes("Body Kick:"), "Boxen: Body Kick aus den Zählern gefiltert");

console.log("── Fläche des Wettkampfs (Leon 17.09.: vorbelegt aus der Kampfart)");
sagt(
  STANDARD_FLAECHE.mma === "kaefig" && STANDARD_FLAECHE.boxen === "ring" && STANDARD_FLAECHE.kickboxen === "ring" && STANDARD_FLAECHE.ringen === "matte" && STANDARD_FLAECHE.sambo === "matte",
  "Vorbelegung: MMA Käfig, Boxen/Kickboxen Ring, Ringen/Sambo Matte",
);
sagt(flaecheDesWettkampfs({ sport: "mma" }) === "kaefig" && flaecheDesWettkampfs({ sport: "mma", flaeche: "ring" }) === "ring", "Wahl des Trainers schlägt die Vorbelegung");
sagt(flaecheDesWettkampfs({ sport: null }) === null && flaecheDesWettkampfs({ sport: "boxen", flaeche: "wiese" }) === "ring", "ohne Kampfart null, ungültige Wahl → Vorbelegung");
sagt(flaecheWaehlbar("mma") && !flaecheWaehlbar("bjj") && !flaecheWaehlbar(null), "BJJ und ohne Kampfart: kein Feld");
const kaefig = gameplanPrompt(eingabe({ flaeche: "kaefig" }));
sagt(kaefig.user.includes("FLÄCHE: Gekämpft wird im Käfig") && kaefig.user.includes(`Rand „am Käfig"`), `Käfig: Flächen-Satz mit Rand „am Käfig"`);
sagt(kaefig.user.includes("Wall-Wrestling") && kaefig.user.includes(`„Seile" schreibst du nie`), "Käfig: Wall-Wrestling im Wortschatz, Seile verboten");
sagt(!kaefig.user.includes("überträgst du still"), "Käfig: Profile ohne andere Fläche → kein Übertrags-Satz");
const matteVideos = eingabe({ flaeche: "kaefig" });
matteVideos.athlet.profil.evidence = evidence({ antworten: {}, flaeche: "matte" });
matteVideos.gegner.profil.evidence = evidence({ gezaehlt: 2, flaeche: "kaefig" });
const uebertrag = gameplanPrompt(matteVideos).user;
sagt(
  uebertrag.includes("Die Videos deines Athleten zeigen die Matte.") && !uebertrag.includes("Die Videos von Marco K.") && uebertrag.includes("überträgst du still auf den Käfig — ohne diesen Satz zu zitieren"),
  "Käfig-Wettkampf, Athlet auf der Matte: nur seine Videos genannt, still übertragen, nicht zitieren",
);
const ring = gameplanPrompt(eingabe({ sport: "boxen", flaeche: "ring" }));
sagt(ring.user.includes("Gekämpft wird im Ring") && ring.user.includes(`„Käfig", „Cage" und „Zaun" schreibst du nie`) && !ring.user.includes("Wall-Wrestling"), "Ring: Käfig-Wörter verboten, kein Wall-Wrestling");
const matte = gameplanPrompt(eingabe({ sport: "ringen", flaeche: "matte" }));
sagt(matte.user.includes("Gekämpft wird auf der Matte") && matte.user.includes(`Rand „am Mattenrand"`), "Matte: am Mattenrand");
sagt(gameplanSchluessel(kaefig) !== gameplanSchluessel(gameplanPrompt(eingabe({ flaeche: "ring" }))), "andere Fläche → neuer Schlüssel (Gameplan schreibt neu)");

console.log("── Schlüssel, Stand");
sagt(gameplanSchluessel(p) === gameplanSchluessel(gameplanPrompt(eingabe())), "gleiche Eingabe → gleicher Schlüssel");
// Stufe 2 (Leon 17.09.: verschieben kostet nichts): Das Kampfdatum steht nicht
// mehr im Auftrag — also auch nicht im Fingerabdruck.
sagt(p.user.startsWith(`WETTKAMPF: „Night of Champions".`), "Auftrag nennt den Wettkampf ohne Datum");
sagt(!/\b(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\b/.test(p.user), "kein Kampfdatum im ganzen Auftrag");
const anders = eingabe();
anders.athlet.profil.actionStats[0].attempted = 14;
sagt(gameplanSchluessel(p) !== gameplanSchluessel(gameplanPrompt(anders)), "ein Versuch mehr → neuer Schlüssel");
const st = gameplanStand(eingabe());
sagt(st.athletAnalysen === 3 && st.athletStaerke === 45 && st.gegnerAnalysen === 0 && st.gegnerScouting, "Stand: 3 Videos, 45 %, Gegner 0 + Scouting");

console.log("── Schema, Normalisierung");
sagt(GAMEPLAN_SCHEMA.additionalProperties === false && GAMEPLAN_SCHEMA.required.length === 5, "Schema streng, 5 Pflichtfelder");
const roh = {
  lage: " Erste Tendenz. ",
  waffen: [{ titel: "Jab zum Körper", text: "Setz ihn.", beleg: "4 von 5 Videos" }, { titel: "", text: "leer" }],
  gefahren: Array.from({ length: 6 }, (_, i) => ({ titel: `G${i}`, text: "t", beleg: "b" })),
  soKaempfstDu: "kaputt",
  drills: [
    { phase: "specific-prep", titel: "Seitlich lösen", text: "3 × 3 min", wofuer: "Jab zum Körper" },
    { phase: "taper", titel: "falsche Phase", text: "x", wofuer: "" },
  ],
};
const n = normalisiereGameplan(roh);
sagt(n.lage === "Erste Tendenz." && n.waffen.length === 1, "leere Punkte fallen weg, Text getrimmt");
sagt(n.gefahren.length === 4, "höchstens 4 Punkte je Block");
sagt(Array.isArray(n.soKaempfstDu) && n.soKaempfstDu.length === 0, "kaputter Block → leer");
sagt(n.drills.length === 1 && n.drills[0].phase === "specific-prep", "Drill mit falscher Phase fällt weg");
sagt(gameplanLeer(normalisiereGameplan({})) && !gameplanLeer(n), "gameplanLeer");

console.log("── Client-Helfer");
sagt(gameplanDocId("abc") === "gameplan-abc", "Dokument-ID gameplan-{campId}");
const g = decodeGameplan({ campId: "abc", status: "fertig", inhalt: n, geschriebenAt: "2026-09-17T18:40:00Z" });
sagt(g.geschriebenAt instanceof Date && drillsFuerPhase(g, "specific-prep").length === 1 && drillsFuerPhase(g, "sparring-simulation").length === 0, "Drills je Phase");
const haengt = decodeGameplan({ campId: "x", status: "schreibt", gestartetAt: new Date(Date.now() - 7 * 60_000).toISOString() });
const laeuft = decodeGameplan({ campId: "x", status: "schreibt", gestartetAt: new Date(Date.now() - 60_000).toISOString() });
sagt(gameplanHaengt(haengt) && !gameplanHaengt(laeuft), "schreibt > 6 min = hängt");

console.log("── Gameplan folgt dem Scouting (Fenster d5)");
sagt(decodeGameplan({ campId: "x", aufschubId: "a", aufschubBis: "2026-09-17T19:00:00Z" }) === null, "Dokument nur mit Aufschub-Marke (ohne Status) = noch kein Gameplan");
const mitAufschub = decodeGameplan({ campId: "x", status: "fertig", inhalt: n, aufschubId: "a", aufschubBis: "2026-09-17T19:00:00Z" });
sagt(mitAufschub.aufschubBis instanceof Date && mitAufschub.aufschubBis.toISOString() === "2026-09-17T19:00:00.000Z", "aufschubBis als Datum");
sagt(decodeGameplan({ campId: "x", status: "fertig" }).aufschubBis === null, "ohne Aufschub → null");
sagt(SCOUTING_AUFSCHUB_MS === 90_000 && SCOUTING_AUFSCHUB_MS + GAMEPLAN_AUFRUF_MS <= 280_000, "90 s Aufschub + 150 s Claude passen ins 280-s-Budget der Route");

console.log("── Wettkampf-Plan bearbeiten, Stufe 1 (Fenster d5)");
const s1 = saeubereAenderung("specific-prep", { focus: "  Takedown-Abwehr am Zaun  ", sessionsPerWeek: 3.4, sparringRatio: 0.27, notes: "  Kopfschutz " });
sagt(s1.focus === "Takedown-Abwehr am Zaun" && s1.notes === "Kopfschutz", "Fokus und Notiz getrimmt");
sagt(s1.sessionsPerWeek === 3 && s1.sparringRatio === 0.25, "Einheiten ganzzahlig, Sparring in 5-%-Schritten");
const s2 = saeubereAenderung("taper", { focus: "   ", sessionsPerWeek: 99, sparringRatio: -1, notes: "x".repeat(2000) });
sagt(s2.focus === PHASE_FOCUS.taper, "leerer Fokus → Fokus der Phase aus dem Generator");
sagt(s2.sessionsPerWeek === PHASE_GRENZEN.einheitenMax && s2.sparringRatio === 0 && s2.notes.length === PHASE_GRENZEN.notizMax, "Grenzen: 14 Einheiten, 0 %, 1000 Zeichen");
sagt(saeubereAenderung("taper", { focus: "a", sessionsPerWeek: Number.NaN, sparringRatio: Number.NaN, notes: "" }).sessionsPerWeek === 0, "keine Zahl → 0");
const zuletzt = planZuletztGeaendert({
  phases: [
    { geaendert: { uid: "a", name: "Alt", at: 1000 } },
    { geaendert: null },
    { geaendert: { uid: "b", name: "Leon", at: 5000 } },
    {},
  ],
});
sagt(zuletzt?.name === "Leon", "zuletzt geändert = jüngste Phase");
sagt(planZuletztGeaendert({ phases: [{}, { geaendert: null }] }) === null, "unberührter Plan → null");

console.log("── Kampf verschoben, Stufe 2 (Fenster 12)");
const TAG = 86_400_000;
const start = new Date("2026-09-02T00:00:00Z");
const tage = (a, b) => Math.round((b.getTime() - a.getTime()) / TAG);
const luecken = (achse) =>
  achse.every((z, i) => (i === 0 ? true : z.startsAt.getTime() === achse[i - 1].endsAt.getTime()));
const achse8 = phasenZeitachse(start, new Date("2026-10-28T00:00:00Z"));
sagt(
  achse8.map((z) => z.weeks).join("/") === "3/2/2/1" && planWochen(start, new Date("2026-10-28T00:00:00Z")) === 8,
  "8 Wochen: Aufbau 3 · Schwerpunkt 2 · Sparring 2 · Taper 1",
);
sagt(
  achse8[0].startsAt.getTime() === start.getTime() &&
    achse8[3].endsAt.toISOString() === "2026-10-28T00:00:00.000Z" &&
    luecken(achse8),
  "Zeitachse beginnt am Start, endet auf dem Kampftag, ohne Lücke",
);
const achse10 = phasenZeitachse(start, new Date("2026-11-11T00:00:00Z"));
sagt(
  achse10.map((z) => z.weeks).join("/") === "4/3/2/1",
  "zwei Wochen später (11.11.): Aufbau 4 · Schwerpunkt 3 · Sparring 2 · Taper 1 (wie beim Anlegen)",
);
const angebrochen = phasenZeitachse(start, new Date("2026-10-31T00:00:00Z"));
sagt(
  tage(angebrochen[3].startsAt, angebrochen[3].endsAt) === 7 &&
    tage(angebrochen[0].startsAt, angebrochen[0].endsAt) === 17 &&
    tage(start, angebrochen[3].endsAt) === 59,
  "angebrochene Woche kürzt den Aufbau (17 Tage), Taper behält seine Woche",
);
const kurz2 = phasenZeitachse(start, new Date("2026-09-16T00:00:00Z"));
sagt(
  luecken(kurz2) && kurz2[3].endsAt.toISOString() === "2026-09-16T00:00:00.000Z" && kurz2.every((z) => z.endsAt > z.startsAt),
  "Plan über zwei Wochen: vier Phasen schrumpfen gleichmäßig, keine überlappt (alte Falle des Generators)",
);
const altePhasen = [
  { phase: "foundation", startsAt: start, endsAt: new Date("2026-09-23T00:00:00Z"), weeks: 3, focus: "Mein Fokus", techniqueIds: ["jab"], exerciseIds: [], trainingAreas: [], categories: [], sessionsPerWeek: 5, sparringRatio: 0.1, notes: "Kopfschutz", geaendert: { uid: "u", name: "Leon", at: 1000 } },
  { phase: "specific-prep", startsAt: new Date("2026-09-23T00:00:00Z"), endsAt: new Date("2026-10-07T00:00:00Z"), weeks: 2, focus: "F2", techniqueIds: [], exerciseIds: [], trainingAreas: [], categories: [], sessionsPerWeek: 5, sparringRatio: 0.25 },
  { phase: "sparring-simulation", startsAt: new Date("2026-10-07T00:00:00Z"), endsAt: new Date("2026-10-21T00:00:00Z"), weeks: 2, focus: "F3", techniqueIds: [], exerciseIds: [], trainingAreas: [], categories: [], sessionsPerWeek: 5, sparringRatio: 0.5 },
  { phase: "taper", startsAt: new Date("2026-10-21T00:00:00Z"), endsAt: new Date("2026-10-28T00:00:00Z"), weeks: 1, focus: "F4", techniqueIds: [], exerciseIds: [], trainingAreas: [], categories: [], sessionsPerWeek: 3, sparringRatio: 0.05 },
];
const neuePhasen = phasenNachVerschiebung(altePhasen, start, new Date("2026-11-11T00:00:00Z"));
sagt(
  neuePhasen[0].focus === "Mein Fokus" &&
    neuePhasen[0].notes === "Kopfschutz" &&
    neuePhasen[0].geaendert?.name === "Leon" &&
    neuePhasen[0].techniqueIds.join() === "jab" &&
    neuePhasen[0].sessionsPerWeek === 5,
  `Verschieben lässt Fokus, Notiz, Techniken, Einheiten und die Marke „geändert von" stehen`,
);
sagt(
  neuePhasen.map((p) => p.weeks).join("/") === "4/3/2/1" && neuePhasen[3].endsAt.toISOString() === "2026-11-11T00:00:00.000Z",
  "Verschieben legt die Phasen auf die neue Zeitachse",
);
sagt(altePhasen[0].endsAt.toISOString() === "2026-09-23T00:00:00.000Z", "die alten Phasen bleiben unberührt (reine Rechnung)");
const campStand = { startedAt: start, competitionDate: new Date("2026-10-28T00:00:00Z") };
const jetzt = new Date("2026-09-17T21:00:00Z");
sagt(pruefeKampfdatum(campStand, new Date("2026-11-11T00:00:00Z"), jetzt) === null, "11.11. ist erlaubt");
sagt(/Termin, der schon steht/.test(pruefeKampfdatum(campStand, new Date("2026-10-28T00:00:00Z"), jetzt) ?? ""), "derselbe Termin → kein Speichern");
sagt(/mindestens 4 Tage/.test(pruefeKampfdatum(campStand, new Date("2026-09-03T00:00:00Z"), jetzt) ?? ""), "in der Vergangenheit → Grenze mit Datum im Satz");
sagt(/bis zum/.test(pruefeKampfdatum(campStand, new Date("2028-01-01T00:00:00Z"), jetzt) ?? ""), "mehr als ein Jahr voraus → Grenze");
sagt(
  fruehestesKampfdatum(new Date("2026-09-30T12:00:00Z"), jetzt).toISOString() === "2026-10-05T00:00:00.000Z",
  `Start am Mittag: frühester Kampf ${PLAN_MIN_TAGE} Tage später, aufgerundet auf den nächsten Tag`,
);
sagt(
  fruehestesKampfdatum(start, jetzt).toISOString() === "2026-09-17T00:00:00.000Z",
  "alter Start: frühestens heute",
);
sagt(
  verschiebungText({ von: new Date("2026-10-28T00:00:00Z").getTime(), auf: 0, uid: "u", name: "Leon", at: jetzt.getTime() }, jetzt) ===
    "Verschoben vom 28. Okt. 2026 · Leon · heute",
  `Marke: „Verschoben vom 28. Okt. 2026 · Leon · heute"`,
);
// Der Monatsname kommt von Intl („Sept." in neueren ICU-Daten, „Sep." in alten)
// — geprüft wird die Regel, nicht die Abkürzung.
const vorFuenf = new Date(jetzt.getTime() - 5 * TAG);
sagt(
  wannText(jetzt.getTime() - TAG, jetzt) === "gestern" &&
    wannText(vorFuenf.getTime(), jetzt) === vorFuenf.toLocaleDateString("de-DE", { day: "numeric", month: "short" }),
  "wannText: gestern, sonst Tag und Monat",
);

console.log("── Kampfart am Wettkampf: Plan-Kategorien");
sagt(KATEGORIEN_JE_KAMPFART.boxen.join() === "boxing", "Boxen → nur boxing");
sagt(KATEGORIEN_JE_KAMPFART.mma.length === 4, "MMA → alle vier");
const kat = new Map(ALL_TECHNIQUES.map((t) => [t.id, t.category]));
const analyse = { totalWorkouts: 0, totalTrainingHours: 0, weeksTracked: 0, workoutsPerWeek: 0, categoryDistribution: [], areaScores: [], strongAreas: [], weakAreas: [], technique: { total: 0, mastered: 0, practiced: 0, learned: 0, notStarted: 0 } };
const opp = { name: "X", style: "wrestler", stance: "orthodox", strengths: [], weaknesses: [], favoriteAttacks: [] };
let phasen;
try {
  phasen = generateFightCampPhases({ weeksTotal: 8, competitionDate: new Date(Date.now() + 56 * 86_400_000), athleteLevel: "fortgeschritten", analysis: analyse, opponent: opp, sport: "boxen" });
} catch (err) {
  phasen = null;
  sagt(false, `Generator wirft: ${err.message}`);
}
if (phasen) {
  const ids = phasen.flatMap((ph) => ph.techniqueIds);
  sagt(ids.length > 0 && ids.every((id) => kat.get(id) === "boxing"), `Boxkampf: nur Box-Techniken im Plan (${ids.length})`);
  sagt(phasen.every((ph) => ph.categories.join() === "boxing"), "Boxkampf: Phasen-Kategorien = boxing");
  const alt = generateFightCampPhases({ weeksTotal: 8, competitionDate: new Date(Date.now() + 56 * 86_400_000), athleteLevel: "fortgeschritten", analysis: analyse, opponent: opp });
  sagt(alt.every((ph) => ph.categories.length === 4), "ohne Kampfart wie bisher alle vier");
}

console.log("── ansichtDesProfils (Gegnerprofil)");
sagt(JSON.stringify(ansichtDesProfils({ kampfarten: ["mma"], flaeche: "kaefig" })) === '{"sport":"mma","flaeche":"kaefig"}', "eine Kampfart + Käfig");
sagt(ansichtDesProfils({ kampfarten: ["mma", "boxen"], flaeche: "ring" }).sport === null, "zwei Kampfarten → neutral");
sagt(ansichtDesProfils(null).flaeche === null && ansichtDesProfils({ flaeche: "wiese" }).flaeche === null, "ohne Evidenz / ungültige Fläche → null");

console.log("── Kosten");
sagt(preisJeMillion("claude-sonnet-5").join() === "2,10" && preisJeMillion("claude-opus-5").join() === "5,25", "Sonnet 5 2/10, Opus 5 5/25");
sagt(kostenAusUsage("claude-opus-5", { input_tokens: 8000, output_tokens: 4000 }).costEur === 0.14, "8k ein + 4k aus auf Opus = 0,14 €");
const z = buchungsZuwachs({ inputTokens: 1, outputTokens: 1, costEur: 0.2, model: "m" }, "gameplan", "2026-09");
sagt(!z.has("analysisCount") && z.get("anzahlJeArt.gameplan") === 1, "Gameplan zählt keine Analyse");
const loesch = altfelder({ "months.2026-09.spentEur": 1.5 }, z);
sagt(loesch.length === 1 && Math.abs(z.get("months.2026-09.spentEur") - 1.7) < 1e-9, "Altfeld addiert in denselben Pfad (kein doppelter Pfad)");

console.log(`\n${geprueft - fehler}/${geprueft} ${fehler === 0 ? "BESTANDEN" : "FEHLER"}`);
process.exit(fehler === 0 ? 0 : 1);
