/**
 * Prüft die reine Profil-Rechnung (lib/profile-evidence.ts) gegen die
 * Regeln aus der Gegenprobe vom 14.09.2026 und Leons Entscheidungen —
 * ohne Firestore, ohne Netz, ohne Build.
 *
 * Aufruf (Projektstamm Tidal-Athletics-App):
 *   node --import ./scripts/lib/ts-loader-register.mjs scripts/test-profil-rechnung.mjs
 *
 * Bleibt im Repo: Wer an den Gewichten, der Kipp-Regel oder dem Fenster
 * dreht, lässt das hier laufen. Jede Zeile ist eine Regel in Zahlen.
 */

import {
  beobachteteSignale,
  computeProfile,
  profilStaerke,
  resolveAnswer,
  stelleZusammen,
  wirkungDerAnalyse,
} from "../lib/profile-evidence.ts";
import { filtereBeobachtung } from "../lib/kampfart-steckbrief.ts";
import { sportFromText } from "../lib/video-analysis.ts";
import { computeVideoWeight } from "../lib/video-analysis.ts";

let fehler = 0;
let geprueft = 0;
function erwarte(bez, ist, soll) {
  geprueft += 1;
  const ok = JSON.stringify(ist) === JSON.stringify(soll);
  if (!ok) fehler += 1;
  console.log(`${ok ? "✓" : "✗"} ${bez.padEnd(70)} ${ok ? "" : `→ ${JSON.stringify(ist)} (erwartet ${JSON.stringify(soll)})`}`);
}

let laufnummer = 0;
/** Baut eine zählende Analyse. */
function analyse({
  recency = "recent",
  videoType = "full",
  idConfidence = 0.95,
  wrongFighter = false,
  findings = [],
  confirms = [],
  actionStats = [],
  dnaSplit = null,
  createdAgoDays = 0,
  fightMonth = null,
  sport = null,
  flaeche = null,
}) {
  laufnummer += 1;
  const observation = { identification: { idConfidence }, meta: { coverage: null, ruleset: null } };
  return {
    id: `a${laufnummer}`,
    mode: "opponent",
    targetId: "t",
    recency,
    videoType,
    sport,
    flaeche,
    fightMonth,
    weight: computeVideoWeight({ recency, videoType, observation }),
    wrongFighter,
    observation,
    createdAt: new Date(Date.now() - createdAgoDays * 86_400_000),
    evaluation: {
      findings: findings.map((f) => ({
        questionId: f.q,
        categoryId: f.q.split("_")[0],
        answer: f.text,
        confidence: 0.8,
        evidence: ["01:00"],
        sideKey: f.side,
      })),
      merge: { confirms, contradicts: [], weight: 0 },
      actionStats,
      dnaSplit,
    },
  };
}

const Q = "preferred-weapons_most-common";
const cross = (text = "Der Cross ist seine häufigste Waffe.") => ({ q: Q, side: "cross", text });
const kick = (text = "Der Low Kick kommt am häufigsten.") => ({ q: Q, side: "low-kick", text });

console.log("\nGEWICHTE (w = Zeitraum × Art, Tor bei 0,75):");
erwarte("ganzer Kampf, kürzlich", computeVideoWeight({ recency: "recent", videoType: "full", observation: { identification: { idConfidence: 0.9 }, meta: {} } }).value, 1);
erwarte("Ausschnitt, letztes Jahr", computeVideoWeight({ recency: "mid", videoType: "excerpt", observation: { identification: { idConfidence: 0.9 }, meta: {} } }).value, 0.63);
erwarte("Highlight, länger her (Minimum 0,12)", computeVideoWeight({ recency: "ancient", videoType: "highlight", observation: { identification: { idConfidence: 0.9 }, meta: {} } }).value, 0.12);
erwarte("unbekannt zählt wie 1–3 Jahre", computeVideoWeight({ recency: "unknown", videoType: "full", observation: { identification: { idConfidence: 0.9 }, meta: {} } }).value, 0.6);
erwarte("Tor zu bei 0,74 → 0", computeVideoWeight({ recency: "recent", videoType: "full", observation: { identification: { idConfidence: 0.74 }, meta: {} } }).value, 0);
erwarte("Tor offen bei 0,75 → voll", computeVideoWeight({ recency: "recent", videoType: "full", observation: { identification: { idConfidence: 0.75 }, meta: {} } }).value, 1);

console.log("\nKIPP-REGEL:");
{
  const alt = analyse({ recency: "mid", findings: [cross()], createdAgoDays: 100 });
  const neu = analyse({ videoType: "excerpt", findings: [kick()] });
  const p = computeProfile("opponent", [alt, neu], { dna: {} });
  erwarte("ein Ausschnitt (0,7) kippt einen ganzen Kampf (0,9) NICHT", p.evidence.answers[Q].winner, "cross");
  erwarte("… aber die zweite Seite ≥ Hälfte → beides im Text", p.evidence.answers[Q].both, true);
  erwarte("… Text nennt beide", p.dna[Q].includes("Zugleich"), true);
}
{
  const alt = analyse({ recency: "mid", findings: [cross()], createdAgoDays: 100 });
  const neu1 = analyse({ videoType: "excerpt", findings: [kick()], createdAgoDays: 2 });
  const neu2 = analyse({ videoType: "excerpt", findings: [kick()], createdAgoDays: 1 });
  const p = computeProfile("opponent", [alt, neu1, neu2], { dna: {} });
  erwarte("zwei Ausschnitte (1,4) kippen", p.evidence.answers[Q].winner, "low-kick");
}
{
  const alt = analyse({ recency: "mid", findings: [cross()], createdAgoDays: 100 });
  const neu = analyse({ videoType: "full", findings: [kick()] });
  const p = computeProfile("opponent", [alt, neu], { dna: {} });
  erwarte("ein ganzer aktueller Kampf (1,0) kippt allein", p.evidence.answers[Q].winner, "low-kick");
}
{
  const alt = analyse({ recency: "recent", findings: [cross()], createdAgoDays: 30 });
  const alt2 = analyse({ recency: "recent", findings: [cross()], createdAgoDays: 20 });
  const clips = [1, 2, 3, 4].map((i) => analyse({ videoType: "highlight", findings: [kick()], createdAgoDays: i }));
  const p = computeProfile("opponent", [alt, alt2, ...clips], { dna: {} });
  const e = p.evidence.answers[Q];
  const clipSeite = e.sides.find((s) => s.key === "low-kick");
  erwarte("vier Clips zusammen gedeckelt auf 0,6", clipSeite.weight, 0.6);
  erwarte("Clips kippen nie", e.winner, "cross");
}
{
  const a = analyse({ recency: "unknown", findings: [cross()], createdAgoDays: 3 });
  const b = analyse({ recency: "unknown", findings: [kick()], createdAgoDays: 2 });
  const c = analyse({ recency: "unknown", findings: [kick()], createdAgoDays: 1 });
  const p = computeProfile("opponent", [a, b, c], { dna: {} });
  erwarte("ohne Datum entscheidet die Mehrheit", p.evidence.answers[Q].winner, "low-kick");
}
{
  const a = analyse({ videoType: "excerpt", findings: [cross()], createdAgoDays: 2 });
  const b = analyse({ videoType: "excerpt", findings: [kick()], createdAgoDays: 1 });
  const p = computeProfile("opponent", [a, b], { dna: {} });
  erwarte("Gleichstand → jüngere Quelle gewinnt", p.evidence.answers[Q].winner, "low-kick");
  erwarte("… und beide werden genannt", p.evidence.answers[Q].both, true);
}

console.log("\nBESTAND UND BESTÄTIGUNG:");
{
  const p = computeProfile("opponent", [], { dna: { [Q]: "Handeingabe: der Jab." } });
  erwarte("Handtext ohne Analyse bleibt stehen", p.dna[Q], "Handeingabe: der Jab.");
  erwarte("… als Seite manual mit Gewicht 0", p.evidence.answers[Q].sides[0].weight, 0);
}
{
  const ohne = analyse({ videoType: "excerpt", confirms: [{ questionId: Q, evidence: [] }] });
  const p = computeProfile("opponent", [ohne], { dna: { [Q]: "Handeingabe: der Jab." } });
  erwarte("Bestätigung OHNE Beleg wiegt nichts", p.evidence.answers[Q].total, 0);
  const mit = analyse({ videoType: "excerpt", confirms: [{ questionId: Q, evidence: ["02:10"] }] });
  const p2 = computeProfile("opponent", [mit], { dna: { [Q]: "Handeingabe: der Jab." } });
  erwarte("Bestätigung MIT Beleg gibt dem Bestand 0,7", p2.evidence.answers[Q].sides[0].weight, 0.7);
  erwarte("… Text bleibt der Bestand", p2.dna[Q], "Handeingabe: der Jab.");
}
{
  const neu = analyse({ videoType: "excerpt", findings: [kick()] });
  const p = computeProfile("opponent", [neu], { dna: { [Q]: "Handeingabe: der Jab." } });
  erwarte("Evidenz schlägt Handtext ohne Gewicht", p.evidence.answers[Q].winner, "low-kick");
}

console.log("\nTOR UND MARKE:");
{
  const unsicher = analyse({ idConfidence: 0.6, findings: [kick()] });
  const markiert = analyse({ wrongFighter: true, findings: [kick()] });
  const p = computeProfile("opponent", [unsicher, markiert], { dna: {} });
  erwarte("unsicher + markiert → nichts zählt", p.evidence.countedAnalyses, 0);
  erwarte("… markierte fehlt auch in totalAnalyses", p.evidence.totalAnalyses, 1);
  erwarte("… keine Antwort", Object.keys(p.dna).length, 0);
}

console.log("\nZAHLEN:");
const stats = [{ id: "cross", attempted: 10, landed: 4, zone: "center", setup: null }];
{
  const full = analyse({ actionStats: stats });
  const spar = analyse({ videoType: "sparring", actionStats: stats });
  const clip = analyse({ videoType: "highlight", actionStats: stats });
  const alt = analyse({ recency: "ancient", actionStats: stats });
  const pG = computeProfile("opponent", [full, spar, clip, alt], { dna: {} });
  erwarte("Gegner: nur ganzer Kampf zählt (10 Versuche)", pG.actionStats[0].attempted, 10);
  const pA = computeProfile("athlete", [full, spar, clip, alt], { dna: {} });
  erwarte("Athlet: Sparring zählt mit (20 Versuche)", pA.actionStats[0].attempted, 20);
  erwarte("Zahlen ungewichtet (4 Treffer, nicht 3,6)", pG.actionStats[0].landed, 4);
}

console.log("\nSPLIT-FENSTER:");
{
  const split = (boxing) => ({ boxing, kicking: 100 - boxing, wrestling: 0, ground: 0, clinch: 0 });
  const alte = [1, 2, 3].map((i) => analyse({ dnaSplit: split(0), createdAgoDays: 100 + i }));
  const neue = [1, 2, 3, 4, 5].map((i) => analyse({ dnaSplit: split(100), createdAgoDays: i }));
  const p = computeProfile("opponent", [...alte, ...neue], { dna: {} });
  erwarte("nur die fünf jüngsten im Fenster", p.evidence.splitWindow.length, 5);
  erwarte("… Split ist der der fünf jüngsten (100 % Boxen)", p.dnaSplit.boxing, 100);
  erwarte("… Gewichtssumme 5,0", p.dnaSplitWeight, 5);
  const spar = analyse({ videoType: "sparring", dnaSplit: split(0) });
  const p2 = computeProfile("opponent", [spar], { dna: {} });
  erwarte("Sparring liefert keinen Split", p2.dnaSplit, null);
}

console.log("\nSTÄRKE:");
{
  const p = computeProfile("opponent", [analyse({}), analyse({ videoType: "excerpt" })], { dna: {} });
  erwarte("evidenceTotal 1,7", p.evidence.evidenceTotal, 1.7);
}

console.log("\nHIGHLIGHT NUR IN WAFFEN UND ENTRIES:");
{
  const clip = analyse({
    videoType: "highlight",
    findings: [kick(), { q: "real-habits_when-tired", side: "rueckwaerts", text: "Geht rückwärts." }],
  });
  const p = computeProfile("opponent", [clip], { dna: {} });
  erwarte("Waffe aus Clip: ja", Q in p.dna, true);
  erwarte("Verhalten aus Clip: nein", "real-habits_when-tired" in p.dna, false);
}

console.log("\nNUR WAS VORKAM (Etappe 2):");
{
  // Eine reine Boxrunde: Split 100 % Boxen, ein Cross gezählt, kein Ringen.
  const boxrunde = analyse({
    videoType: "sparring",
    findings: [
      { q: "preferred-weapons_punch", side: "cross", text: "Der Cross sitzt." },
      { q: "defensive-reactions_takedowns", side: "sprawl", text: "Sprawlt sauber." },
      { q: "real-habits_when-tired", side: "rueckwaerts", text: "Geht rückwärts." },
    ],
    confirms: [{ questionId: "entry-patterns_takedown", evidence: ["01:10"] }],
  });
  boxrunde.observation = {
    ...boxrunde.observation,
    dnaSplit: { boxing: 100, kicking: 0, wrestling: 0, ground: 0, clinch: 0 },
    actions: [{ id: "cross", otherLabel: null, attempted: 8, landed: 3, zone: "center", setup: null, damage: 1, timestamps: [] }],
    defense: {}, controlTime: null, combos: [],
  };
  const p = computeProfile("athlete", [boxrunde], { dna: { "entry-patterns_takedown": "Double Leg aus dem Jab." } });
  erwarte("Schlagfrage aus der Boxrunde: ja", "preferred-weapons_punch" in p.dna, true);
  erwarte("Takedown-Frage aus der Boxrunde: nein", "defensive-reactions_takedowns" in p.dna, false);
  erwarte("stilneutrale Frage: ja", "real-habits_when-tired" in p.dna, true);
  erwarte("Bestätigung einer Takedown-Antwort ohne Takedowns wiegt nichts", p.evidence.answers["entry-patterns_takedown"].total, 0);
}
{
  // Ein MMA-Kampf mit Takedowns: dieselbe Takedown-Frage ist offen.
  const mma = analyse({
    findings: [{ q: "defensive-reactions_takedowns", side: "sprawl", text: "Sprawlt sauber." }],
  });
  mma.observation = {
    ...mma.observation,
    dnaSplit: { boxing: 50, kicking: 10, wrestling: 30, ground: 10, clinch: 0 },
    actions: [], defense: {}, controlTime: null, combos: [],
  };
  const p = computeProfile("athlete", [mma], { dna: {} });
  erwarte("Takedown-Frage mit Ringen im Split: ja", "defensive-reactions_takedowns" in p.dna, true);
}
{
  // Bestand ohne Split und Zähler: unbekannt, nicht leer → nichts gesperrt.
  const alt = analyse({ findings: [{ q: "preferred-weapons_kick", side: "low-kick", text: "Low Kick." }] });
  const p = computeProfile("athlete", [alt], { dna: {} });
  erwarte("ohne jedes Signal bleibt alles offen", "preferred-weapons_kick" in p.dna, true);
}

// resolveAnswer direkt: Gleichstand mit identischem Alter → Schlüssel entscheidet.
{
  const e = resolveAnswer(
    [
      { side: "b", text: "B", weight: 0.5, order: 0, source: { analysisId: "x", weight: 0.5, kind: "finding", videoType: "excerpt" } },
      { side: "a", text: "A", weight: 0.5, order: 0, source: { analysisId: "y", weight: 0.5, kind: "finding", videoType: "excerpt" } },
    ],
    null,
  );
  erwarte("völliger Gleichstand → alphabetisch (deterministisch)", e.winner, "a");
}

// ─── Etappe 3 (Leon 17.09.2026) ─────────────────────────────────────────────
const orthodox = (text = "Steht Orthodox.") => ({ q: "real-habits_repeats", side: "orthodox", text });
const southpaw = (text = "Steht Southpaw.") => ({ q: "real-habits_repeats", side: "southpaw", text });
const RQ = "real-habits_repeats";

console.log("\nWIEDERHOLUNGS-REGEL:");
{
  const alte = Array.from({ length: 14 }, (_, i) => analyse({ recency: "mid", findings: [orthodox()], createdAgoDays: 200 + i }));
  const neu = analyse({ findings: [southpaw()], createdAgoDays: 1 });
  const p = computeProfile("athlete", [...alte, neu], { dna: {} });
  erwarte("14 Videos Orthodox + EIN aktueller Kampf Southpaw → bleibt Orthodox", p.evidence.answers[RQ].winner, "orthodox");
  const neu2 = analyse({ findings: [southpaw("Kämpft wieder Southpaw.")], createdAgoDays: 0 });
  const p2 = computeProfile("athlete", [...alte, neu, neu2], { dna: {} });
  erwarte("… das zweite Southpaw-Video → wechselt", p2.evidence.answers[RQ].winner, "southpaw");
}
{
  const kampf = analyse({ findings: [cross()], createdAgoDays: 5 });
  const clips = [1, 2].map((i) => analyse({ videoType: "highlight", findings: [kick()], createdAgoDays: i }));
  const p = computeProfile("opponent", [kampf, ...clips], { dna: {} });
  erwarte("zwei Clips sind keine Wiederholung gegen einen ganzen Kampf", p.evidence.answers[Q].winner, "cross");
}

console.log("\nWIE OFT GESEHEN:");
{
  const a = analyse({ findings: [cross()], createdAgoDays: 3 });
  const b = analyse({ findings: [cross("Wieder der Cross.")], createdAgoDays: 2 });
  const c = analyse({ findings: [{ q: "real-habits_when-tired", side: "rueckwaerts", text: "Geht rückwärts." }], createdAgoDays: 1 });
  const p = computeProfile("athlete", [a, b, c], { dna: {} });
  erwarte("Cross steht in 2 Videos", p.evidence.answers[Q].sides[0].videos, 2);
  erwarte("… beantwortbar war die Frage in 3", p.evidence.answers[Q].gelegenheiten, 3);
  erwarte("… beide Fassungen gehen mit (jüngste zuerst)", p.evidence.answers[Q].sides[0].texte, ["Wieder der Cross.", "Der Cross ist seine häufigste Waffe."]);
}

console.log("\nPROFILSTÄRKE:");
{
  const spar = analyse({ videoType: "sparring", findings: [cross(), { q: "real-habits_when-tired", side: "rueckwaerts", text: "Geht rückwärts." }] });
  erwarte("ein Sparring, jede Antwort einmal → 20 %", computeProfile("athlete", [spar], { dna: {} }).evidence.staerke, 20);
  const fuenf = [1, 2, 3, 4, 5].map((i) => analyse({ videoType: "sparring", findings: [cross()], createdAgoDays: i }));
  erwarte("fünf Sparrings mit derselben Aussage → 100 %", computeProfile("athlete", fuenf, { dna: {} }).evidence.staerke, 100);
  const sp = [10, 11].map((d) => analyse({ findings: [southpaw()], createdAgoDays: d }));
  const or = [1, 2, 3].map((d) => analyse({ findings: [orthodox()], createdAgoDays: d }));
  erwarte("Orthodox in 3 Kämpfen, Southpaw in 2 → 60 %", computeProfile("athlete", [...sp, ...or], { dna: {} }).evidence.staerke, 60);
  const mitHand = computeProfile("athlete", [spar], { dna: { "weaknesses_bad-distance": "Handtext." } });
  erwarte("Handtext ohne Video zählt nicht mit", mitHand.evidence.staerke, 20);
  erwarte("leeres Profil → 0 %", profilStaerke({}), 0);
}

console.log("\nZUSAMMENSTELLUNG ÜBER KAMPFARTEN:");
{
  const D = "gameplan_seek-distance";
  const mma = analyse({ sport: "mma", findings: [cross(), { q: D, side: "aussen", text: "Sucht die Außendistanz." }], actionStats: [{ id: "double-leg", attempted: 10, landed: 4 }], dnaSplit: { boxing: 100, kicking: 0, wrestling: 0, ground: 0, clinch: 0 }, createdAgoDays: 2 });
  const sambo = analyse({ sport: "sambo", findings: [cross("Auch hier der Cross."), { q: D, side: "griff", text: "Sucht die Griffdistanz." }], actionStats: [{ id: "double-leg", attempted: 6, landed: 2 }], dnaSplit: { boxing: 0, kicking: 0, wrestling: 100, ground: 0, clinch: 0 }, createdAgoDays: 1 });
  const gMma = { sport: "mma", profil: computeProfile("athlete", [mma], { dna: {} }) };
  const gSambo = { sport: "sambo", profil: computeProfile("athlete", [sambo], { dna: {} }) };
  const nurMma = stelleZusammen([gMma], { dna: {} });
  erwarte("eine Kampfart → Fight-DNA ist genau dieses Profil", JSON.stringify(nurMma.dna), JSON.stringify(gMma.profil.dna));
  const g = stelleZusammen([gSambo, gMma], { dna: { "weaknesses_bad-distance": "Handtext." } });
  erwarte("gleiche Aussage in beiden → EIN Satz ohne Kampfart", /MMA:|Sambo:/.test(g.dna[Q]), false);
  erwarte("… steht in 2 Videos", g.evidence.answers[Q].sides[0].videos, 2);
  erwarte("verschiedene Aussagen → beide mit Kampfart", g.evidence.answers[D].kampfarten?.map((k) => k.sport), ["mma", "sambo"]);
  erwarte("… der Text nennt beide", g.dna[D].includes("MMA:") && g.dna[D].includes("Sambo:"), true);
  erwarte("Handtext ohne Video bleibt stehen", g.dna["weaknesses_bad-distance"], "Handtext.");
  erwarte("Zahlen je Technik addiert (Double Leg 16 Versuche)", g.actionStats.find((s) => s.id === "double-leg")?.attempted, 16);
  erwarte("Split gewichtet gemittelt (50 % Boxen)", g.dnaSplit.boxing, 50);
  erwarte("Kampfarten in Anzeige-Reihenfolge", g.evidence.kampfarten, ["mma", "sambo"]);
  erwarte("Gewichte summiert (2,0)", g.evidence.evidenceTotal, 2);
}

console.log("\nWIRKUNG EINER ANALYSE:");
{
  const alt = analyse({ findings: [cross()], createdAgoDays: 10 });
  const vorherP = computeProfile("athlete", [alt], { dna: {} });
  const vorher = { evidence: vorherP.evidence, dnaSplit: vorherP.dnaSplit };
  const neu = analyse({
    findings: [cross("Wieder der Cross."), { q: "real-habits_after-hit", side: "clinch", text: "Nach einem Treffer geht er in den Clinch." }],
    actionStats: [{ id: "cross", attempted: 8, landed: 3 }, { id: "jab", attempted: 3, landed: 1 }],
    createdAgoDays: 1,
  });
  const nachher = computeProfile("athlete", [alt, neu], { dna: {} });
  const w = wirkungDerAnalyse({ analyse: neu, mode: "athlete", profil: "mma", vorher, nachher });
  erwarte("bestätigt: Cross, jetzt in 2 Videos", w.punkte.find((p) => p.questionId === Q)?.art, "bestaetigt");
  erwarte("erstmals gesehen: Clinch nach Treffer, 1 Video", w.punkte.find((p) => p.questionId === "real-habits_after-hit")?.art, "erstmals");
  erwarte("… der Punkt trägt den Text DIESES Videos", w.punkte.find((p) => p.questionId === Q)?.text, "Wieder der Cross.");
  erwarte("Zahl nur ab 5 Versuchen: Cross 8/3, kein Jab", w.zahlen.filter((z) => z.art === "technik").map((z) => z.id), ["cross"]);
  erwarte("Stärke vorher → nachher steigt", w.staerkeNachher > w.staerkeVorher, true);
}
{
  // Drei Kämpfe Orthodox (2,7) gegen einen Southpaw (1,0): unter der Hälfte,
  // also kein „beides" — die Southpaw-Seite steht wirklich nur daneben.
  const o = [20, 21, 22].map((d) => analyse({ recency: "mid", findings: [orthodox()], createdAgoDays: d }));
  const s1 = analyse({ findings: [southpaw()], createdAgoDays: 2 });
  const vorherP = computeProfile("athlete", [...o, s1], { dna: {} });
  const w1 = wirkungDerAnalyse({ analyse: s1, mode: "athlete", profil: "mma", vorher: null, nachher: vorherP });
  erwarte("anders als bisher: Southpaw, Profil bleibt Orthodox", w1.punkte[0].art, "abweichend");
  erwarte("… mit dem, was stehen bleibt (3 Videos)", w1.punkte[0].fuehrend?.videos, 3);
  const s2 = analyse({ findings: [southpaw("Wieder Southpaw.")], createdAgoDays: 1 });
  const nachher = computeProfile("athlete", [...o, s1, s2], { dna: {} });
  const w2 = wirkungDerAnalyse({ analyse: s2, mode: "athlete", profil: "mma", vorher: { evidence: vorherP.evidence, dnaSplit: null }, nachher });
  erwarte("zweites Southpaw-Video → Profil angepasst", w2.punkte[0].art, "angepasst");
  const falsch = analyse({ wrongFighter: true, findings: [kick()] });
  const w3 = wirkungDerAnalyse({ analyse: falsch, mode: "athlete", profil: "mma", vorher: null, nachher: computeProfile("athlete", [falsch], { dna: {} }) });
  erwarte("markierte Analyse → zählt nicht, keine Punkte", [w3.zaehlt, w3.punkte.length], [false, 0]);
}

console.log("\nKAMPFART-STECKBRIEFE (Leon 17.09.2026):");
{
  // Beobachtung eines Kickbox-Sparrings, in der die KI Takedowns „gesehen" hat.
  const beob = (extra = {}) => ({
    identification: { idConfidence: 0.95 }, meta: { coverage: null, ruleset: null },
    actions: [
      { id: "cross", otherLabel: null, attempted: 8, landed: 3, zone: "cage", setup: null, damage: 1, timestamps: [] },
      { id: "double-leg", otherLabel: null, attempted: 2, landed: 1, zone: "center", setup: null, damage: null, timestamps: [] },
    ],
    dnaSplit: { boxing: 70, kicking: 10, wrestling: 20, ground: 0, clinch: 0 },
    combos: [],
    defense: { takedownsDefended: 2, takedownsAgainst: 2, strikesAvoided: 3, strikesAgainst: 5, hitLocations: null, knockdownsReceived: 0, rockedMoments: [] },
    controlTime: { clinchSeconds: 0, topSeconds: 0, bottomSeconds: 0, cagePressureSeconds: 12, pressedSeconds: 0 },
    ...extra,
  });
  const q = "defensive-reactions_takedowns";
  const box = analyse({ sport: "boxen", videoType: "sparring", findings: [{ q, side: "sprawl", text: "Sprawlt sauber." }, cross()] });
  box.observation = beob();
  const pBox = computeProfile("athlete", [box], { dna: {} });
  erwarte("Boxen sperrt die Takedown-Frage", q in pBox.dna, false);
  erwarte("… die Schlagfrage bleibt", Q in pBox.dna, true);

  erwarte("Kickboxen verwirft den Takedown → kein takedowns-Signal", beobachteteSignale(filtereBeobachtung(beob(), "kickboxen").observation).has("takedowns"), false);
  erwarte("… ohne Kampfart bleibt das Signal (Bestand)", beobachteteSignale(filtereBeobachtung(beob(), null).observation).has("takedowns"), true);
  erwarte("BJJ hat keine Zone → kein cage-Signal", beobachteteSignale(filtereBeobachtung(beob(), "bjj").observation).has("cage"), false);

  const kick = analyse({ sport: "kickboxen", actionStats: [{ id: "cross", attempted: 8, landed: 3 }, { id: "double-leg", attempted: 6, landed: 2 }] });
  kick.observation = beob();
  const pKick = computeProfile("athlete", [kick], { dna: {} });
  erwarte("Zähler: Takedown aus dem Kickboxen fällt raus, Cross bleibt", pKick.actionStats.map((s) => s.id), ["cross"]);

  const mma = analyse({ sport: "mma", findings: [{ q, side: "sprawl", text: "Sprawlt sauber." }], createdAgoDays: 2 });
  mma.observation = beob();
  const pBeide = computeProfile("athlete", [mma, box], { dna: {} });
  erwarte("Gelegenheiten zählen die gesperrte Frage nicht (1 statt 2)", pBeide.evidence.answers[q].gelegenheiten, 1);

  erwarte("Kampf-Sambo läuft als MMA", sportFromText("Kampf-Sambo"), "mma");
}

console.log("\nFLÄCHE DES PROFILS (Leon 17.09.: Käfig-Wörter nur mit Käfig im Video):");
{
  const k1 = analyse({ sport: "mma", flaeche: "kaefig", findings: [cross()], createdAgoDays: 3 });
  const k2 = analyse({ sport: "mma", flaeche: "kaefig", findings: [cross()], createdAgoDays: 2 });
  const m = analyse({ sport: "mma", flaeche: "matte", findings: [cross()], createdAgoDays: 1 });
  const ohne = analyse({ sport: "mma", findings: [cross()], createdAgoDays: 0 });
  erwarte("häufigste Fläche der zählenden Videos (2× Käfig, 1× Matte)", computeProfile("athlete", [k1, k2, m, ohne], { dna: {} }).evidence.flaeche, "kaefig");
  erwarte("Gleichstand → die jüngere Fläche", computeProfile("athlete", [k1, m], { dna: {} }).evidence.flaeche, "matte");
  erwarte("ohne jede Angabe → null (neutrale Wörter)", computeProfile("athlete", [ohne], { dna: {} }).evidence.flaeche, null);
  const markiert = analyse({ sport: "mma", flaeche: "ring", wrongFighter: true, findings: [cross()] });
  erwarte("markierte Analyse zählt für die Fläche nicht", computeProfile("athlete", [k1, markiert], { dna: {} }).evidence.flaeche, "kaefig");
  const gMma = { sport: "mma", profil: computeProfile("athlete", [k1, k2], { dna: {} }) };
  const gSambo = { sport: "sambo", profil: computeProfile("athlete", [analyse({ sport: "sambo", flaeche: "matte", findings: [cross()] })], { dna: {} }) };
  const gMma2 = { sport: "mma", profil: computeProfile("athlete", [analyse({ sport: "mma", flaeche: "matte", findings: [cross()] })], { dna: {} }) };
  erwarte("Fight-DNA über Käfig + Matte → keine Fläche", stelleZusammen([gMma, gSambo], { dna: {} }).evidence.flaeche, null);
  erwarte("Fight-DNA, alle auf der Matte → Matte", stelleZusammen([gMma2, gSambo], { dna: {} }).evidence.flaeche, "matte");
}

console.log(`\n${geprueft} Prüfungen, ${fehler} fehlgeschlagen ${fehler === 0 ? "✓" : "✗"}`);
process.exit(fehler === 0 ? 0 : 1);
