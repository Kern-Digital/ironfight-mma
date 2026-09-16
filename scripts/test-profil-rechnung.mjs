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
  computeProfile,
  evidenceStrengthPct,
  resolveAnswer,
} from "../lib/profile-evidence.ts";
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
}) {
  laufnummer += 1;
  const observation = { identification: { idConfidence }, meta: { coverage: null, ruleset: null } };
  return {
    id: `a${laufnummer}`,
    mode: "opponent",
    targetId: "t",
    recency,
    videoType,
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
erwarte("3,0 = 100 %", evidenceStrengthPct(3), 100);
erwarte("1,0 = 33 %", evidenceStrengthPct(1), 33);
erwarte("0 = 0 %", evidenceStrengthPct(0), 0);
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

console.log(`\n${geprueft} Prüfungen, ${fehler} fehlgeschlagen ${fehler === 0 ? "✓" : "✗"}`);
process.exit(fehler === 0 ? 0 : 1);
