/**
 * Fuenf fiktive DeepFight-Analysen fuer das Konto noelreichle@gmail.com.
 *
 * Leon am 09.09.2026: er will beim Weiterbauen den VOLLEN Umfang der neuen
 * Landung sehen -- Meine Analysen als angedeutete Kartei, die Suche mit
 * Treffern in der Gruppe Analysen, und den Ergebnisbericht mit echtem Inhalt.
 * Ohne Daten zeigt die Landung nur ihren Leerzustand.
 *
 * DIE DOKUMENTE SIND ECHT, ABER MARKIERT. Jedes traegt `isDemo: true` und
 * eine feste Dokument-ID (`demo-analyse-01` ...). Damit ist der Seeder
 * idempotent -- ein zweiter Lauf ueberschreibt, er verdoppelt nicht -- und
 * `--loeschen` raeumt genau diese fuenf wieder weg, ohne echte Analysen zu
 * beruehren.
 *
 * WAS ER NICHT ANFASST: `opponents/{id}`. Paul the Fighter steht auf 59
 * beantworteten DNA-Fragen aus echter Arbeit; ein Seeder, der dort
 * mitschreibt, waere nicht mehr sauber zurueckzunehmen. Seine beiden
 * Analysen tragen deshalb nur ihre eigenen Marken.
 *
 * WAS ER SEHR WOHL ANLEGT: das Kampfprofil von demo-002 (Mira Sauer). Ihre
 * Analyse ist als UEBERNOMMEN markiert -- und eine uebernommene Analyse neben
 * einem Profil mit DNA 0 % ist ein Widerspruch, den man auf der Seite sieht.
 * Der Seeder schreibt dort genau das, was Alle uebernehmen geschrieben
 * haette: die sechs Befunde als Antworten, den Split (bei leerem Profil wird
 * er voll uebernommen, `mergeDnaSplit` mit W=0), das Video-Gewicht als
 * `dnaSplitWeight` und die Aktions-Statistik. Vorher geprueft: KEINER der
 * drei Athleten hat heute ein `fightProfile` -- es wird also nichts
 * ueberschrieben, nur angelegt. `--loeschen` nimmt es wieder mit.
 *
 * Aufruf (NUR ueber PowerShell, Falle 20):
 *   node scripts/seed-demo-analysen.mjs
 *   node scripts/seed-demo-analysen.mjs --loeschen
 */

import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initAdmin } from "./lib/admin-app.mjs";

const MAIL = "noelreichle@gmail.com";
const GYM_ID = "tidal-athletics";
const GEGNER_ID = "BZdtaypdo5BlPtnqJ6lt"; // Paul the Fighter, das eine echte Profil
const loeschen = process.argv.includes("--loeschen");

const tageHer = (n) =>
  Timestamp.fromDate(new Date(Date.now() - n * 24 * 60 * 60 * 1000));

/**
 * Baut ein vollstaendiges VideoAnalysis-Dokument (lib/video-analysis.ts).
 *
 * Vollstaendig ist hier kein Schmuck: Der Ergebnisbericht
 * (VideoAnalysisResult) liest Identifikation, Metadaten, Kontrollzeiten,
 * Defensiv-Quoten, Kombinationen, Scores, vier Top-Listen und das
 * Gefahrenprofil. Fehlt eines davon, steht dort eine leere Rubrik -- und
 * genau die soll Leon ja nicht sehen.
 */
function baueAnalyse(s) {
  return {
    isDemo: true,
    mode: s.mode,
    targetId: s.targetId,
    targetName: s.targetName,
    sourceLabel: s.sourceLabel,
    sourceKind: s.sourceKind,
    youtubeUrl: s.youtubeUrl ?? null,
    fighter: {
      name: s.targetName,
      corner: s.corner,
      clothing: s.clothing,
      features: s.features,
      startPosition: s.startPosition,
    },
    tier: s.tier,
    recency: s.recency,
    models: {
      gemini: s.tier === "pro" ? "gemini-3.1-pro-preview" : "gemini-flash-latest",
      claude: "claude-opus-5",
    },
    usage: {
      inputTokens: s.inputTokens,
      outputTokens: s.outputTokens,
      costEur: s.costEur,
      model: "claude-opus-5",
    },
    observation: {
      identification: {
        description: s.idBeschreibung,
        idConfidence: s.idSicherheit,
        evidence: s.idBelege,
      },
      meta: {
        ruleset: s.regelwerk,
        rounds: s.runden,
        roundLengthMinutes: s.rundenlaenge,
        weightClass: s.gewichtsklasse,
        result: s.ergebnis,
        opponentLevel: s.gegnerniveau,
        coverage: s.abdeckung,
        videoQuality: s.videoqualitaet,
        estimatedAge: s.altersschaetzung,
        representativeness: s.aussagekraft,
      },
      actions: s.aktionen,
      dnaSplit: s.split,
      combos: s.kombinationen,
      defense: {
        takedownsDefended: s.tdAbgewehrt,
        takedownsAgainst: s.tdGegen,
        strikesAvoided: s.schlaegeAusgewichen,
        strikesAgainst: s.schlaegeGegen,
        hitLocations: s.trefferzonen,
        knockdownsReceived: s.niederschlaegeKassiert,
        rockedMoments: s.wacklerMomente,
      },
      controlTime: s.kontrollzeit,
      movement: s.bewegung,
      rounds: s.rundenkurve,
      notes: s.notizen,
    },
    evaluation: {
      summary: s.zusammenfassung,
      style: s.stil,
      findings: s.befunde,
      scores: s.scores,
      topWeapons: s.topWaffen,
      topPatterns: s.topMuster,
      topWeaknesses: s.topSchwaechen,
      topDangers: s.topGefahren,
      dangerProfile: s.gefahrenprofil,
      actionStats: s.aktionen.map((a) => ({
        id: a.id,
        attempted: a.attempted,
        landed: a.landed,
        zone: a.zone,
        setup: a.setup,
      })),
      dnaSplit: s.split,
      merge: {
        confirms: s.bestaetigt,
        contradicts: s.widersprueche,
        weight: s.gewicht,
      },
    },
    appliedFindingIds: s.uebernommeneBefunde,
    appliedStats: s.statsUebernommen,
    sharedWithAthlete: s.fuerAthletFrei ?? false,
    createdAt: s.erstelltAm,
  };
}

// ─── Die fuenf Analysen ─────────────────────────────────────────────────────

const ANALYSEN = [
  // 1 ── Gegner, frisch, noch nichts uebernommen
  {
    docId: "demo-analyse-01",
    mode: "opponent",
    targetId: GEGNER_ID,
    targetName: "Paul the Fighter",
    sourceLabel: "paul-vs-mertens-rd1-3.mp4",
    sourceKind: "upload",
    corner: "red",
    clothing: "Schwarze Shorts mit rotem Bund",
    features: "Vollbart, Tattoo am rechten Oberarm, kompakte Statur",
    startPosition: "bei 0:00 links im Bild, rote Ecke",
    tier: "flash",
    recency: "recent",
    inputTokens: 41280,
    outputTokens: 6140,
    costEur: 0.36,
    erstelltAm: tageHer(2),
    idBeschreibung:
      "Kaempfer in schwarzen Shorts mit rotem Bund, Vollbart, Tattoo rechter Oberarm. Durchgehend in der roten Ecke.",
    idSicherheit: 0.94,
    idBelege: ["0:04 Einlauf rote Ecke", "2:11 Nahaufnahme Tattoo", "7:38 Cornerman spricht ihn mit Namen an"],
    regelwerk: "MMA, Amateur, 3 Runden",
    runden: 3,
    rundenlaenge: 3,
    gewichtsklasse: "Weltergewicht (bis 77 kg)",
    ergebnis: "Sieg nach Punkten (einstimmig)",
    gegnerniveau: "Regionalliga, solide Grundtechnik",
    abdeckung: "vollstaendiger Kampf, alle drei Runden",
    videoqualitaet: "1080p, feste Kamera, gute Ausleuchtung",
    altersschaetzung: "Mitte zwanzig",
    aussagekraft: 0.88,
    aktionen: [
      { id: "jab", otherLabel: null, attempted: 62, landed: 24, zone: "center", setup: null, damage: 1, timestamps: ["0:32", "1:47", "4:12"] },
      { id: "cross", otherLabel: null, attempted: 31, landed: 13, zone: "open", setup: "Doppelter Jab", damage: 2, timestamps: ["1:52", "6:03"] },
      { id: "low-kick", otherLabel: null, attempted: 18, landed: 14, zone: "center", setup: "Handserie", damage: 2, timestamps: ["2:20", "5:41", "8:09"] },
      { id: "single-leg", otherLabel: null, attempted: 11, landed: 4, zone: "cage", setup: "Schlagwechsel", damage: 0, timestamps: ["3:15", "7:02"] },
      { id: "knee", otherLabel: null, attempted: 9, landed: 6, zone: "cage", setup: "Unterhaken", damage: 2, timestamps: ["3:28", "7:14"] },
    ],
    split: { boxing: 41, kicking: 17, wrestling: 22, ground: 8, clinch: 12 },
    kombinationen: [
      { sequence: ["Jab", "Jab", "Cross"], count: 9, landedFully: 4, zone: "center", openingAfter: "Kopf bleibt auf der Mittellinie stehen" },
      { sequence: ["Cross", "Low Kick"], count: 6, landedFully: 5, zone: "open", openingAfter: "Gewicht kurz auf dem Standbein" },
      { sequence: ["Level Change", "Single Leg"], count: 5, landedFully: 2, zone: "cage", openingAfter: "Nacken frei fuer den Whizzer" },
    ],
    tdAbgewehrt: 5,
    tdGegen: 7,
    schlaegeAusgewichen: 71,
    schlaegeGegen: 118,
    trefferzonen: { head: 28, body: 14, legs: 5 },
    niederschlaegeKassiert: 0,
    wacklerMomente: [{ timestamp: "6:47", note: "Rechter Haken bringt ihn kurz aus dem Stand, faengt sich sofort" }],
    kontrollzeit: { clinchSeconds: 96, topSeconds: 74, bottomSeconds: 18, cagePressureSeconds: 132, pressedSeconds: 41 },
    bewegung: { stance: "Rechtsauslage, wechselt selten", stanceSwitches: "3 Wechsel, alle in Runde 3", forwardPct: 58, backwardPct: 17, lateralPct: 25, centerControlPct: 61 },
    rundenkurve: [
      { round: 1, outputPerMin: 14.2, hitRate: 0.41, strategy: "Distanz vermessen, viel Jab", fatigueSigns: null },
      { round: 2, outputPerMin: 16.8, hitRate: 0.38, strategy: "Druck zum Zaun, Clinch gesucht", fatigueSigns: "Atmung wird hoerbar" },
      { round: 3, outputPerMin: 11.4, hitRate: 0.31, strategy: "Haelt den Vorsprung, weniger Risiko", fatigueSigns: "Haende sinken, breiterer Stand" },
    ],
    notizen: "Ein Punktabzug fuer Griff in den Zaun bei 8:52. Der Cornerman ruft fast durchgehend nach dem Low Kick.",
    zusammenfassung:
      "Druckvoller Allrounder mit Boxlastigkeit und verlaesslichem Low Kick. Er gewinnt ueber Volumen und Zaunarbeit, nicht ueber einzelne harte Treffer. In Runde 3 faellt sein Output um rund ein Drittel, und die Fuehrhand sinkt sichtbar.",
    stil: { primaryStyle: "Pressure Boxer mit Ringer-Basis", approach: "Vorwaerts, schneidet den Raum ab", baseDiscipline: "Boxen" },
    befunde: [
      { questionId: "preferred-weapons_most-common", categoryId: "preferred-weapons", answer: "Der Jab traegt mit 62 Versuchen fast die Haelfte seines Volumens.", confidence: 0.92, evidence: ["0:32", "1:47", "4:12"] },
      { questionId: "preferred-weapons_kick", categoryId: "preferred-weapons", answer: "Low Kick auf das vordere Bein, fast immer als Abschluss einer Handserie (14 von 18 landen).", confidence: 0.89, evidence: ["2:20", "5:41", "8:09"] },
      { questionId: "entry-patterns_takedown", categoryId: "entry-patterns", answer: "Single Leg von aussen, ausschliesslich in der Zaunhaelfte und nach einem Schlagwechsel.", confidence: 0.81, evidence: ["3:15", "7:02"] },
      { questionId: "weaknesses_conditioning-mental", categoryId: "weaknesses", answer: "Output faellt in Runde 3 von 16,8 auf 11,4 Aktionen pro Minute, Haende sinken.", confidence: 0.86, evidence: ["9:10", "10:24"] },
      { questionId: "cage-space_pushes-cage", categoryId: "cage-space", answer: "Er drueckt selbst zum Zaun: 132 Sekunden Zaundruck gegen 41 Sekunden gedrueckt.", confidence: 0.9, evidence: ["3:28", "7:14"] },
      { questionId: "real-habits_after-miss", categoryId: "real-habits", answer: "Nach einem verfehlten Cross sinkt die Fuehrhand fuer einen Moment.", confidence: 0.78, evidence: ["1:52", "6:03", "6:47"] },
    ],
    scores: { aggression: 78, cageControl: 74, cardio: 52, damage: 58, durability: 71, fightIq: 66, predictability: 61 },
    topWaffen: [
      { title: "Jab zum Koerper", reason: "Traegt sein Volumen und bereitet fast jeden Angriff vor.", confidence: 0.92 },
      { title: "Low Kick als Abschluss", reason: "14 von 18 landen, weil er ihn nie isoliert wirft.", confidence: 0.89 },
      { title: "Knie im Clinch", reason: "6 von 9 treffen, sobald er den Unterhaken hat.", confidence: 0.8 },
    ],
    topMuster: [
      { title: "Jab-Jab-Cross, dann Seitschritt links", reason: "Neun Mal in derselben Reihenfolge.", confidence: 0.87 },
      { title: "Level Change nur nach Schlagwechsel", reason: "Alle fuenf Takedown-Versuche folgen auf einen Austausch.", confidence: 0.83 },
    ],
    topSchwaechen: [
      { title: "Kondition in Runde 3", reason: "Ein Drittel weniger Output, laengere Pausen zwischen den Serien.", confidence: 0.86 },
      { title: "Tiefe Fuehrhand nach Fehlschlag", reason: "Wiederholt sich, und genau darueber wird er getroffen.", confidence: 0.79 },
      { title: "Rueckwaertsbewegung", reason: "Laeuft gerade zurueck statt abzubiegen.", confidence: 0.74 },
    ],
    topGefahren: [
      { title: "Zaun mit Unterhaken", reason: "Dort kommen die Knie, und dort verliert der Gegner die Hueften.", confidence: 0.85 },
      { title: "Erste zwei Minuten Runde 2", reason: "Hoechster Output des ganzen Kampfes.", confidence: 0.77 },
    ],
    gefahrenprofil: {
      mostDangerousWhen: "Wenn er den Ruecken des Gegners am Zaun hat und den Unterhaken bekommt.",
      finishes: "Kein Finish in diesem Kampf; sein Weg ist Volumen ueber drei Runden.",
      vulnerableWhen: "Direkt nach dem eigenen Fehlschlag und ab Mitte Runde 3.",
    },
    bestaetigt: ["preferred-weapons_most-common", "cage-space_pushes-cage"],
    widersprueche: [],
    gewicht: 0.86,
    uebernommeneBefunde: [],
    statsUebernommen: false,
  },

  // 2 ── Gegner, YouTube, teilweise uebernommen, mit Widerspruch
  {
    docId: "demo-analyse-02",
    mode: "opponent",
    targetId: GEGNER_ID,
    targetName: "Paul the Fighter",
    sourceLabel: "https://www.youtube.com/watch?v=k7Qd2nRxVpE",
    sourceKind: "youtube",
    youtubeUrl: "https://www.youtube.com/watch?v=k7Qd2nRxVpE",
    corner: "blue",
    clothing: "Blaue Shorts, weisser Rashguard",
    features: "Vollbart, kuerzere Haare als im juengeren Material",
    startPosition: "bei 0:12 rechts im Bild",
    tier: "pro",
    recency: "mid",
    inputTokens: 58940,
    outputTokens: 8210,
    costEur: 0.61,
    erstelltAm: tageHer(9),
    idBeschreibung:
      "Derselbe Kaempfer, diesmal in der blauen Ecke. Vollbart und Statur stimmen, Frisur ist kuerzer -- aelteres Material.",
    idSicherheit: 0.83,
    idBelege: ["0:12 Einlauf blaue Ecke", "4:55 Tattoo rechter Oberarm sichtbar"],
    regelwerk: "MMA, Amateur, 3 Runden",
    runden: 3,
    rundenlaenge: 3,
    gewichtsklasse: "Weltergewicht (bis 77 kg)",
    ergebnis: "Niederlage durch Aufgabe (Rear Naked Choke, Runde 2)",
    gegnerniveau: "Erfahrener Grappler mit Ringer-Vergangenheit",
    abdeckung: "Runde 1 und 2, danach Kampfende",
    videoqualitaet: "720p, Handkamera, teils verwackelt",
    altersschaetzung: "Anfang zwanzig",
    aussagekraft: 0.71,
    aktionen: [
      { id: "jab", otherLabel: null, attempted: 44, landed: 15, zone: "center", setup: null, damage: 1, timestamps: ["0:48", "2:33"] },
      { id: "hook", otherLabel: null, attempted: 19, landed: 6, zone: "cage", setup: "Nach dem Jab", damage: 1, timestamps: ["1:19", "3:52"] },
      { id: "body-kick", otherLabel: null, attempted: 12, landed: 7, zone: "open", setup: null, damage: 2, timestamps: ["2:05", "4:40"] },
      { id: "sweep", otherLabel: null, attempted: 6, landed: 1, zone: "cage", setup: "Aus der Halbdeckung", damage: 0, timestamps: ["5:22"] },
    ],
    split: { boxing: 36, kicking: 21, wrestling: 15, ground: 19, clinch: 9 },
    kombinationen: [
      { sequence: ["Jab", "Hook"], count: 7, landedFully: 2, zone: "cage", openingAfter: "Dreht die Schulter zu weit auf" },
      { sequence: ["Body Kick", "Cross"], count: 4, landedFully: 3, zone: "open", openingAfter: "Standbein kurz belastet" },
    ],
    tdAbgewehrt: 2,
    tdGegen: 9,
    schlaegeAusgewichen: 38,
    schlaegeGegen: 84,
    trefferzonen: { head: 21, body: 19, legs: 6 },
    niederschlaegeKassiert: 1,
    wacklerMomente: [
      { timestamp: "3:11", note: "Overhand landet sauber, er geht in die Knie" },
      { timestamp: "6:02", note: "Rueckennahme, danach Aufgabe" },
    ],
    kontrollzeit: { clinchSeconds: 44, topSeconds: 12, bottomSeconds: 188, cagePressureSeconds: 27, pressedSeconds: 121 },
    bewegung: { stance: "Rechtsauslage", stanceSwitches: "keine", forwardPct: 34, backwardPct: 41, lateralPct: 25, centerControlPct: 38 },
    rundenkurve: [
      { round: 1, outputPerMin: 12.6, hitRate: 0.34, strategy: "Auf Distanz halten, Takedowns vermeiden", fatigueSigns: null },
      { round: 2, outputPerMin: 7.9, hitRate: 0.28, strategy: "Ueberwiegend defensiv am Boden", fatigueSigns: "Deutlich, nach 90 Sekunden unter Kontrolle" },
    ],
    notizen: "Aelteres Material -- die Bodenarbeit sieht deutlich schwaecher aus als im aktuellen Video. Fuer die Gewichtung beruecksichtigt.",
    zusammenfassung:
      "Aelteres Material und der Gegenentwurf zum aktuellen Kampf: Gegen einen echten Grappler verliert er die Hueften und kommt am Zaun nicht mehr hoch. Im Stand dasselbe Bild wie heute, am Boden ein deutlich schwaecherer Kaempfer als im juengeren Video.",
    stil: { primaryStyle: "Striker, am Boden defensiv", approach: "Haelt Distanz, weicht dem Ringen aus", baseDiscipline: "Boxen" },
    befunde: [
      { questionId: "defensive-reactions_takedowns", categoryId: "defensive-reactions", answer: "Sprawlt hart, kommt am Zaun aber sehr langsam wieder hoch -- 9 Takedowns gegen ihn, nur 2 abgewehrt.", confidence: 0.88, evidence: ["1:44", "5:10", "6:02"] },
      { questionId: "weaknesses_problem-situations", categoryId: "weaknesses", answer: "Ruecken am Zaun ohne Unterhaken. Dort hoert seine Offensive vollstaendig auf.", confidence: 0.85, evidence: ["5:22", "6:02"] },
      { questionId: "cage-space_escapes-cage", categoryId: "cage-space", answer: "Befreit sich ueber den Unterhaken und einen Dreh, braucht dafuer im Schnitt ueber zwanzig Sekunden.", confidence: 0.76, evidence: ["4:12", "5:48"] },
      { questionId: "preferred-weapons_kick", categoryId: "preferred-weapons", answer: "Body Kick ist hier die zweitstaerkste Waffe (7 von 12), nicht der Low Kick.", confidence: 0.72, evidence: ["2:05", "4:40"] },
    ],
    scores: { aggression: 54, cageControl: 38, cardio: 44, damage: 41, durability: 55, fightIq: 58, predictability: 66 },
    topWaffen: [
      { title: "Body Kick", reason: "Sieben von zwoelf landen, meist ohne Vorbereitung.", confidence: 0.75 },
      { title: "Jab auf Distanz", reason: "Sein einziges verlaessliches Mittel gegen das Vorwaertsgehen.", confidence: 0.7 },
    ],
    topMuster: [
      { title: "Rueckwaerts gerade statt seitwaerts", reason: "Vierzig Prozent Rueckwaertsbewegung, fast ohne Winkel.", confidence: 0.82 },
    ],
    topSchwaechen: [
      { title: "Bodenverteidigung am Zaun", reason: "188 Sekunden in der Unterlage, kein einziger sauberer Aufsteher.", confidence: 0.89 },
      { title: "Takedown-Abwehr gegen echte Ringer", reason: "Nur zwei von neun abgewehrt.", confidence: 0.86 },
    ],
    topGefahren: [
      { title: "Erste Minute Runde 1", reason: "Dort ist er am frischesten und am aktivsten.", confidence: 0.68 },
    ],
    gefahrenprofil: {
      mostDangerousWhen: "Auf langer Distanz, solange er den Body Kick setzen kann.",
      finishes: "Kein eigenes Finish; er verliert selbst durch Aufgabe in Runde 2.",
      vulnerableWhen: "Sobald der Ruecken am Zaun ist und der Unterhaken fehlt.",
    },
    bestaetigt: ["weaknesses_problem-situations"],
    widersprueche: [
      {
        questionId: "preferred-weapons_kick",
        existing: "Low Kick auf das vordere Bein, meist als Abschluss einer Handserie.",
        observed: "Body Kick ist hier die haeufigere Waffe -- moeglicherweise eine Entwicklung seit diesem Kampf.",
      },
    ],
    gewicht: 0.54,
    uebernommeneBefunde: ["defensive-reactions_takedowns", "weaknesses_problem-situations"],
    statsUebernommen: false,
  },

  // 3 ── Eigener Athlet, offen
  {
    docId: "demo-analyse-03",
    mode: "athlete",
    targetId: "demo-001",
    targetName: "Arne Engel",
    sourceLabel: "arne-sparring-kw36.mp4",
    sourceKind: "upload",
    corner: "blue",
    clothing: "Blaue Shorts, schwarzer Rashguard",
    features: "Schmale Statur, blonde kurze Haare",
    startPosition: "bei 0:00 rechts an der Wand",
    tier: "flash",
    recency: "recent",
    inputTokens: 33210,
    outputTokens: 5480,
    costEur: 0.29,
    erstelltAm: tageHer(4),
    idBeschreibung: "Athlet in blauen Shorts und schwarzem Rashguard, schmale Statur, blonde kurze Haare.",
    idSicherheit: 0.96,
    idBelege: ["0:00 Startposition rechts", "3:22 Nahaufnahme"],
    regelwerk: "Sparring, 5 Runden zu 3 Minuten",
    runden: 5,
    rundenlaenge: 3,
    gewichtsklasse: "Leichtgewicht (bis 70 kg)",
    ergebnis: "Sparring, kein Ergebnis",
    gegnerniveau: "Trainingspartner, aehnliches Niveau",
    abdeckung: "alle fuenf Runden",
    videoqualitaet: "1080p, Handystativ",
    altersschaetzung: "Anfang zwanzig",
    aussagekraft: 0.79,
    aktionen: [
      { id: "jab", otherLabel: null, attempted: 88, landed: 39, zone: "center", setup: null, damage: 1, timestamps: ["0:41", "5:12", "9:03"] },
      { id: "front-kick", otherLabel: null, attempted: 21, landed: 13, zone: "open", setup: "Gegen das Vorwaertsgehen", damage: 1, timestamps: ["2:18", "7:44"] },
      { id: "double-leg", otherLabel: null, attempted: 14, landed: 8, zone: "center", setup: "Nach dem Jab", damage: 0, timestamps: ["4:02", "11:30"] },
      { id: "pass", otherLabel: null, attempted: 17, landed: 9, zone: "center", setup: null, damage: 0, timestamps: ["4:20", "11:52"] },
      { id: "submission", otherLabel: null, attempted: 5, landed: 2, zone: "center", setup: "Aus der Rueckenlage des Partners", damage: 0, timestamps: ["6:31", "12:40"] },
    ],
    split: { boxing: 29, kicking: 16, wrestling: 26, ground: 23, clinch: 6 },
    kombinationen: [
      { sequence: ["Jab", "Level Change", "Double Leg"], count: 8, landedFully: 5, zone: "center", openingAfter: "Sauber in die Passage" },
      { sequence: ["Front Kick", "Jab"], count: 6, landedFully: 4, zone: "open", openingAfter: "Partner rueckt zurueck" },
    ],
    tdAbgewehrt: 6,
    tdGegen: 8,
    schlaegeAusgewichen: 96,
    schlaegeGegen: 141,
    trefferzonen: { head: 31, body: 12, legs: 2 },
    niederschlaegeKassiert: 0,
    wacklerMomente: [],
    kontrollzeit: { clinchSeconds: 61, topSeconds: 214, bottomSeconds: 43, cagePressureSeconds: 58, pressedSeconds: 36 },
    bewegung: { stance: "Rechtsauslage", stanceSwitches: "1 Wechsel in Runde 4", forwardPct: 46, backwardPct: 22, lateralPct: 32, centerControlPct: 57 },
    rundenkurve: [
      { round: 1, outputPerMin: 15.1, hitRate: 0.46, strategy: "Jab und Distanz", fatigueSigns: null },
      { round: 2, outputPerMin: 15.8, hitRate: 0.44, strategy: "Mehr Takedowns", fatigueSigns: null },
      { round: 3, outputPerMin: 14.4, hitRate: 0.42, strategy: "Bodenarbeit, Passagen", fatigueSigns: null },
      { round: 4, outputPerMin: 13.2, hitRate: 0.39, strategy: "Haelt das Tempo", fatigueSigns: "Leicht, Atmung tiefer" },
      { round: 5, outputPerMin: 12.9, hitRate: 0.4, strategy: "Sucht Submissions", fatigueSigns: "Leicht" },
    ],
    notizen: "Sehr sauberer Eintritt in den Double Leg. Der Clinch bleibt sein schwaechster Bereich -- er sucht ihn kaum.",
    zusammenfassung:
      "Starker Wrestler mit sauberem Jab und guter Kondition ueber fuenf Runden. Der Weg vom Stand auf den Boden funktioniert verlaesslich, die Passagen sitzen. Der Clinch fehlt fast vollstaendig, und gegen Vorwaertsdruck fehlt ihm ein Mittel ausser dem Front Kick.",
    stil: { primaryStyle: "Wrestler mit Boxbasis", approach: "Kontrolliert, sucht die Passage", baseDiscipline: "Ringen" },
    befunde: [
      { questionId: "preferred-weapons_takedown", categoryId: "preferred-weapons", answer: "Double Leg aus der Mitte, eingeleitet mit dem Jab -- 8 von 14 sitzen.", confidence: 0.91, evidence: ["4:02", "11:30"] },
      { questionId: "entry-patterns_start", categoryId: "entry-patterns", answer: "Er leitet fast alles mit dem Jab ein, auch den Level Change.", confidence: 0.88, evidence: ["0:41", "4:02"] },
      { questionId: "weaknesses_technical", categoryId: "weaknesses", answer: "Der Clinch fehlt: nur 61 Sekunden in fuenf Runden, und er sucht ihn nie aktiv.", confidence: 0.84, evidence: ["3:50", "8:12"] },
      { questionId: "gameplan_priority-techniques", categoryId: "gameplan", answer: "Fuer den Wettkampf: Jab-Level-Change als Hauptweg, Passagen aus der Halbdeckung ausbauen.", confidence: 0.8, evidence: ["4:20", "11:52"] },
      { questionId: "real-habits_when-tired", categoryId: "real-habits", answer: "Bleibt auch in Runde 5 bei seinem Plan, sucht dann vermehrt Submissions statt Schlagabtausch.", confidence: 0.77, evidence: ["12:40"] },
    ],
    scores: { aggression: 61, cageControl: 69, cardio: 82, damage: 44, durability: 76, fightIq: 74, predictability: 58 },
    topWaffen: [
      { title: "Double Leg nach dem Jab", reason: "Der verlaesslichste Weg in seine Staerke.", confidence: 0.91 },
      { title: "Guard Pass", reason: "Neun von siebzehn Passagen sitzen sauber.", confidence: 0.83 },
    ],
    topMuster: [
      { title: "Jab, Level Change, Double Leg", reason: "Acht Mal, fuenf davon vollstaendig.", confidence: 0.87 },
    ],
    topSchwaechen: [
      { title: "Kein Clinch-Spiel", reason: "61 Sekunden in fuenf Runden -- er meidet die Position.", confidence: 0.84 },
      { title: "Wenig Antwort auf Vorwaertsdruck", reason: "Ausser dem Front Kick fehlt ein Mittel.", confidence: 0.71 },
    ],
    topGefahren: [
      { title: "Nach eigener Takedown-Landung", reason: "Dort kommt er sofort in die Passage.", confidence: 0.8 },
    ],
    gefahrenprofil: {
      mostDangerousWhen: "Sobald der Kampf auf dem Boden ist und er oben liegt.",
      finishes: "Zwei Submission-Ansaetze aus der Rueckenkontrolle.",
      vulnerableWhen: "Im Clinch am Zaun -- eine Position, die er im Training meidet.",
    },
    bestaetigt: [],
    widersprueche: [],
    gewicht: 0.79,
    uebernommeneBefunde: [],
    statsUebernommen: false,
  },

  // 4 ── Eigene Athletin, komplett uebernommen und fuer sie freigegeben
  {
    docId: "demo-analyse-04",
    mode: "athlete",
    targetId: "demo-002",
    targetName: "Mira Sauer",
    sourceLabel: "mira-wettkampf-koeln-rd1-2.mp4",
    sourceKind: "upload",
    corner: "red",
    clothing: "Rote Shorts, weisses Top",
    features: "Zopf, Tape am linken Handgelenk",
    startPosition: "bei 0:07 links, rote Ecke",
    tier: "pro",
    recency: "recent",
    inputTokens: 61540,
    outputTokens: 9120,
    costEur: 0.68,
    erstelltAm: tageHer(16),
    idBeschreibung: "Athletin in roten Shorts und weissem Top, Zopf, Tape am linken Handgelenk.",
    idSicherheit: 0.97,
    idBelege: ["0:07 Einlauf rote Ecke", "1:30 Nahaufnahme Tape"],
    regelwerk: "Kickboxen K-1, 3 Runden",
    runden: 3,
    rundenlaenge: 2,
    gewichtsklasse: "Bantamgewicht (bis 61 kg)",
    ergebnis: "Sieg durch technischen K.o. in Runde 2",
    gegnerniveau: "Landesmeisterschaft, erfahren",
    abdeckung: "Runde 1 und 2 bis zum Abbruch",
    videoqualitaet: "1080p, zwei Kameras",
    altersschaetzung: "Anfang zwanzig",
    aussagekraft: 0.93,
    aktionen: [
      { id: "jab", otherLabel: null, attempted: 51, landed: 27, zone: "center", setup: null, damage: 1, timestamps: ["0:22", "2:41"] },
      { id: "high-kick", otherLabel: null, attempted: 9, landed: 4, zone: "open", setup: "Nach dem Low Kick", damage: 3, timestamps: ["3:58"] },
      { id: "low-kick", otherLabel: null, attempted: 24, landed: 19, zone: "center", setup: "Nach dem Jab", damage: 2, timestamps: ["1:05", "2:12", "3:44"] },
      { id: "knee", otherLabel: null, attempted: 7, landed: 5, zone: "cage", setup: "Doppelter Nackengriff", damage: 2, timestamps: ["2:55"] },
    ],
    split: { boxing: 33, kicking: 44, wrestling: 4, ground: 2, clinch: 17 },
    kombinationen: [
      { sequence: ["Jab", "Low Kick"], count: 12, landedFully: 9, zone: "center", openingAfter: "Deckung sinkt auf der gleichen Seite" },
      { sequence: ["Low Kick", "Low Kick", "High Kick"], count: 3, landedFully: 2, zone: "open", openingAfter: "Kopf frei -- so faellt der Kampf" },
    ],
    tdAbgewehrt: 1,
    tdGegen: 1,
    schlaegeAusgewichen: 62,
    schlaegeGegen: 88,
    trefferzonen: { head: 14, body: 9, legs: 3 },
    niederschlaegeKassiert: 0,
    wacklerMomente: [],
    kontrollzeit: { clinchSeconds: 38, topSeconds: 0, bottomSeconds: 0, cagePressureSeconds: 44, pressedSeconds: 19 },
    bewegung: { stance: "Linksauslage (Suedpfote)", stanceSwitches: "keine", forwardPct: 51, backwardPct: 19, lateralPct: 30, centerControlPct: 64 },
    rundenkurve: [
      { round: 1, outputPerMin: 18.4, hitRate: 0.52, strategy: "Low Kicks sammeln, Distanz halten", fatigueSigns: null },
      { round: 2, outputPerMin: 19.1, hitRate: 0.55, strategy: "Dieselbe Serie, dann High Kick", fatigueSigns: null },
    ],
    notizen: "Lehrbuchhafte Umsetzung des Gameplans: zwei Runden dieselbe Serie, dann dieselbe Bewegung eine Etage hoeher.",
    zusammenfassung:
      "Suedpfoten-Kickboxerin mit sehr sauberer Beinarbeit und einem klaren Plan. Sie sammelt zwei Runden lang Low Kicks auf derselben Seite und beendet den Kampf mit demselben Ansatz zum Kopf. Bodenkampf kommt praktisch nicht vor -- gegen einen Ringer waere das die offene Flanke.",
    stil: { primaryStyle: "Suedpfoten-Kickboxerin", approach: "Geduldig, baut ueber Wiederholung auf", baseDiscipline: "Kickboxen" },
    befunde: [
      { questionId: "preferred-weapons_combo", categoryId: "preferred-weapons", answer: "Jab und Low Kick als Paar, zwoelf Mal, neun davon vollstaendig gelandet.", confidence: 0.94, evidence: ["1:05", "2:12", "3:44"] },
      { questionId: "preferred-weapons_finish", categoryId: "preferred-weapons", answer: "High Kick nach zwei Low Kicks auf dieselbe Seite -- so endet der Kampf.", confidence: 0.95, evidence: ["3:58"] },
      { questionId: "gameplan_base-plan", categoryId: "gameplan", answer: "Zwei Runden dieselbe Serie, dann dieselbe Bewegung eine Etage hoeher.", confidence: 0.9, evidence: ["3:44", "3:58"] },
      { questionId: "weaknesses_technical", categoryId: "weaknesses", answer: "Kein Bodenspiel sichtbar: null Sekunden am Boden, ein einziger Takedown-Kontakt.", confidence: 0.86, evidence: ["2:30"] },
      { questionId: "cage-space_center-movement", categoryId: "cage-space", answer: "Haelt 64 Prozent der Zeit die Mitte und schneidet den Raum seitwaerts ab.", confidence: 0.88, evidence: ["0:22", "2:41"] },
      { questionId: "drills_automate-counters", categoryId: "drills", answer: "Der Wechsel von Low auf High auf derselben Seite ist automatisiert -- weiter so drillen.", confidence: 0.82, evidence: ["3:58"] },
    ],
    scores: { aggression: 72, cageControl: 79, cardio: 84, damage: 81, durability: 74, fightIq: 86, predictability: 48 },
    topWaffen: [
      { title: "Low Kick nach dem Jab", reason: "Neunzehn von vierundzwanzig landen.", confidence: 0.94 },
      { title: "High Kick als Abschluss", reason: "Direkte Folge der Low-Kick-Serie -- damit endet der Kampf.", confidence: 0.95 },
      { title: "Knie im Nackengriff", reason: "Fuenf von sieben treffen.", confidence: 0.79 },
    ],
    topMuster: [
      { title: "Zwei Etagen, eine Seite", reason: "Sie baut die Oeffnung ueber Wiederholung auf, statt sie zu suchen.", confidence: 0.9 },
    ],
    topSchwaechen: [
      { title: "Kein Bodenspiel im Material", reason: "Gegen einen Ringer ist das die offene Flanke.", confidence: 0.86 },
    ],
    topGefahren: [
      { title: "Zweite Haelfte Runde 2", reason: "Dort ist die Vorarbeit fertig und der High Kick kommt.", confidence: 0.91 },
    ],
    gefahrenprofil: {
      mostDangerousWhen: "Sobald der Gegner das Standbein wegen der Low Kicks belastet.",
      finishes: "Technischer K.o. durch High Kick in Runde 2.",
      vulnerableWhen: "Wenn der Kampf auf den Boden geht -- dazu gibt es kein Material.",
    },
    bestaetigt: ["preferred-weapons_combo", "cage-space_center-movement"],
    widersprueche: [],
    gewicht: 0.93,
    uebernommeneBefunde: [
      "preferred-weapons_combo",
      "preferred-weapons_finish",
      "gameplan_base-plan",
      "weaknesses_technical",
      "cage-space_center-movement",
      "drills_automate-counters",
    ],
    statsUebernommen: true,
    fuerAthletFrei: true,
  },

  // 5 ── Ich selbst -- ein Trainer analysiert sich wie einen Athleten
  {
    docId: "demo-analyse-05",
    mode: "athlete",
    targetId: "vSyZjarCbAhvVXLONZIZsRlrUEf2",
    targetName: "Leon",
    sourceLabel: "eigenes-sparring-offene-matte.mp4",
    sourceKind: "upload",
    corner: "unknown",
    clothing: "Graue Shorts, schwarzer Rashguard",
    features: "Eigene Aufnahme, offene Matte",
    startPosition: "bei 0:00 in der Mitte",
    tier: "flash",
    recency: "recent",
    inputTokens: 28760,
    outputTokens: 4930,
    costEur: 0.24,
    erstelltAm: tageHer(1),
    idBeschreibung: "Eigene Aufnahme von der offenen Matte, graue Shorts und schwarzer Rashguard.",
    idSicherheit: 0.99,
    idBelege: ["0:00 Startposition Mitte"],
    regelwerk: "Sparring, 4 Runden zu 5 Minuten",
    runden: 4,
    rundenlaenge: 5,
    gewichtsklasse: "Weltergewicht (bis 77 kg)",
    ergebnis: "Sparring, kein Ergebnis",
    gegnerniveau: "Wechselnde Partner, gemischtes Niveau",
    abdeckung: "alle vier Runden",
    videoqualitaet: "1080p, feste Kamera",
    altersschaetzung: "Anfang dreissig",
    aussagekraft: 0.74,
    aktionen: [
      { id: "cross", otherLabel: null, attempted: 47, landed: 21, zone: "center", setup: "Nach dem Jab", damage: 2, timestamps: ["1:12", "8:40"] },
      { id: "uppercut", otherLabel: null, attempted: 13, landed: 5, zone: "cage", setup: "Im Clinch", damage: 1, timestamps: ["6:22"] },
      { id: "body-lock", otherLabel: null, attempted: 10, landed: 6, zone: "cage", setup: "Nach dem Fehlschlag des Partners", damage: 0, timestamps: ["3:35", "14:02"] },
      { id: "ground-strikes", otherLabel: null, attempted: 22, landed: 15, zone: "cage", setup: "Aus der Halbdeckung", damage: 1, timestamps: ["4:10", "14:30"] },
      { id: "trip", otherLabel: null, attempted: 8, landed: 5, zone: "cage", setup: "Aus dem Body Lock", damage: 0, timestamps: ["3:44"] },
    ],
    split: { boxing: 34, kicking: 9, wrestling: 24, ground: 18, clinch: 15 },
    kombinationen: [
      { sequence: ["Jab", "Cross", "Body Lock"], count: 7, landedFully: 4, zone: "cage", openingAfter: "Partner dreht sich zum Zaun" },
      { sequence: ["Body Lock", "Trip"], count: 5, landedFully: 4, zone: "cage", openingAfter: "Direkt in die Halbdeckung" },
    ],
    tdAbgewehrt: 4,
    tdGegen: 6,
    schlaegeAusgewichen: 58,
    schlaegeGegen: 112,
    trefferzonen: { head: 26, body: 21, legs: 7 },
    niederschlaegeKassiert: 0,
    wacklerMomente: [],
    kontrollzeit: { clinchSeconds: 178, topSeconds: 192, bottomSeconds: 66, cagePressureSeconds: 149, pressedSeconds: 58 },
    bewegung: { stance: "Rechtsauslage", stanceSwitches: "2 Wechsel", forwardPct: 62, backwardPct: 14, lateralPct: 24, centerControlPct: 59 },
    rundenkurve: [
      { round: 1, outputPerMin: 13.8, hitRate: 0.43, strategy: "Boxen, Distanz suchen", fatigueSigns: null },
      { round: 2, outputPerMin: 14.6, hitRate: 0.41, strategy: "Mehr Clinch und Body Lock", fatigueSigns: null },
      { round: 3, outputPerMin: 12.1, hitRate: 0.37, strategy: "Bodenarbeit halten", fatigueSigns: "Deutlich, Pausen werden laenger" },
      { round: 4, outputPerMin: 9.8, hitRate: 0.33, strategy: "Position halten statt arbeiten", fatigueSigns: "Stark" },
    ],
    notizen: "Eigenanalyse. Der Kick fehlt fast vollstaendig -- neun Prozent Split ist zu wenig fuer den eigenen Anspruch.",
    zusammenfassung:
      "Druckvoller Clinch- und Bodenkaempfer mit solidem Cross. Der Weg ueber Body Lock und Trip an den Zaun funktioniert verlaesslich. Zwei Baustellen sind deutlich: Das Beinarsenal kommt praktisch nicht vor, und ab Runde 3 faellt der Output um fast ein Drittel.",
    stil: { primaryStyle: "Clinch-Kaempfer mit Bodenkontrolle", approach: "Vorwaerts, sucht den Zaun", baseDiscipline: "Ringen" },
    befunde: [
      { questionId: "preferred-weapons_takedown", categoryId: "preferred-weapons", answer: "Body Lock an den Zaun, danach Trip -- vier von fuenf sitzen.", confidence: 0.88, evidence: ["3:35", "3:44", "14:02"] },
      { questionId: "weaknesses_conditioning-mental", categoryId: "weaknesses", answer: "Output faellt von 14,6 auf 9,8 Aktionen pro Minute zwischen Runde 2 und 4.", confidence: 0.85, evidence: ["16:20", "18:05"] },
      { questionId: "weaknesses_technical", categoryId: "weaknesses", answer: "Kicks fehlen fast vollstaendig -- neun Prozent im Split.", confidence: 0.82, evidence: ["0:00"] },
      { questionId: "cage-space_pushes-cage", categoryId: "cage-space", answer: "149 Sekunden eigener Zaundruck gegen 58 Sekunden gedrueckt.", confidence: 0.87, evidence: ["3:35", "14:02"] },
      { questionId: "drills_preparation", categoryId: "drills", answer: "Kick-Integration in die Handserien und Konditionsarbeit fuer die dritte Runde.", confidence: 0.8, evidence: ["16:20"] },
    ],
    scores: { aggression: 74, cageControl: 81, cardio: 49, damage: 52, durability: 70, fightIq: 71, predictability: 64 },
    topWaffen: [
      { title: "Body Lock an den Zaun", reason: "Sechs von zehn, und daraus folgt fast immer der Trip.", confidence: 0.88 },
      { title: "Ground and Pound aus der Halbdeckung", reason: "Fuenfzehn von zweiundzwanzig treffen.", confidence: 0.84 },
    ],
    topMuster: [
      { title: "Jab, Cross, Body Lock", reason: "Sieben Mal derselbe Weg an den Zaun.", confidence: 0.8 },
    ],
    topSchwaechen: [
      { title: "Kein Beinarsenal", reason: "Neun Prozent Split -- ein ganzer Kampfbereich fehlt.", confidence: 0.82 },
      { title: "Kondition ab Runde 3", reason: "Ein Drittel weniger Output.", confidence: 0.85 },
    ],
    topGefahren: [
      { title: "Erste zwei Runden am Zaun", reason: "Dort ist der Druck am hoechsten.", confidence: 0.79 },
    ],
    gefahrenprofil: {
      mostDangerousWhen: "Im Clinch am Zaun mit Body Lock.",
      finishes: "Kein Finish im Sparring; Ground and Pound als Druckmittel.",
      vulnerableWhen: "Ab Runde 3, wenn die Pausen zwischen den Serien laenger werden.",
    },
    bestaetigt: [],
    widersprueche: [],
    gewicht: 0.74,
    uebernommeneBefunde: [],
    statsUebernommen: false,
  },
];

// ─── Lauf ───────────────────────────────────────────────────────────────────

const { projectId } = initAdmin();
console.log(`Admin-SDK: ${projectId}`);
const auth = getAuth();
const db = getFirestore();

const konto = await auth.getUserByEmail(MAIL);
const doku = await db.collection("users").doc(konto.uid).get();
const name = doku.data()?.displayName ?? doku.data()?.authProviderName ?? MAIL;
console.log(`Konto: ${MAIL} -> ${konto.uid} (${name})`);
if ((konto.customClaims ?? {}).gymId !== GYM_ID) {
  console.log(`ACHTUNG: gymId des Kontos ist ${(konto.customClaims ?? {}).gymId} statt ${GYM_ID}`);
}

function pfad(a) {
  return a.mode === "opponent"
    ? db.collection("opponents").doc(a.targetId).collection("videoAnalyses").doc(a.docId)
    : db.collection("users").doc(a.targetId).collection("videoAnalyses").doc(a.docId);
}

/** Das Kampfprofil, das aus der uebernommenen Analyse folgt (siehe Kopf). */
const PROFIL_ZIEL = "demo-002";
const profilRef = db
  .collection("users")
  .doc(PROFIL_ZIEL)
  .collection("fightProfile")
  .doc("main");

if (loeschen) {
  for (const a of ANALYSEN) {
    await pfad(a).delete();
    console.log(`geloescht: ${a.docId} (${a.targetName})`);
  }
  const p = await profilRef.get();
  if (p.exists && p.data()?.isDemo === true) {
    await profilRef.delete();
    console.log(`geloescht: Kampfprofil von ${PROFIL_ZIEL}`);
  } else if (p.exists) {
    // Ohne die Marke ist es NICHT unseres -- dann bleibt es stehen.
    console.log(`stehen gelassen: Kampfprofil von ${PROFIL_ZIEL} traegt keine Demo-Marke`);
  }
  console.log("\nFertig -- die fuenf Demo-Analysen sind weg.");
} else {
  // Zielpruefung VOR dem Schreiben: Eine Analyse unter einem Ziel, das es
  // nicht gibt, taucht in keiner Liste auf und faellt niemandem auf.
  let fehlt = 0;
  for (const a of ANALYSEN) {
    const ref =
      a.mode === "opponent"
        ? db.collection("opponents").doc(a.targetId)
        : db.collection("users").doc(a.targetId);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`FEHLT: Ziel ${a.targetId} (${a.targetName}) existiert nicht`);
      fehlt += 1;
    }
  }
  if (fehlt) {
    console.log(`\nAbbruch: ${fehlt} Ziel(e) fehlen.`);
    process.exit(1);
  }

  for (const a of ANALYSEN) {
    const daten = baueAnalyse({
      ...a,
      createdBy: konto.uid,
    });
    await pfad(a).set({
      ...daten,
      createdBy: konto.uid,
      createdByName: name,
    });
    const zustand = a.statsUebernommen || a.uebernommeneBefunde.length ? "uebernommen" : "offen";
    console.log(
      `geschrieben: ${a.docId}  ${a.mode === "opponent" ? "Gegner" : "Athlet"} ${a.targetName}  (${zustand})`,
    );
  }
  // ── Die Wirkung der uebernommenen Analyse ────────────────────────────────
  // Genau das, was Alle uebernehmen geschrieben haette. Nur anlegen, nie
  // ueberschreiben: Traegt dort schon etwas ohne Demo-Marke, bleibt es.
  const vorhanden = await profilRef.get();
  if (vorhanden.exists && vorhanden.data()?.isDemo !== true) {
    console.log(
      `\nKampfprofil von ${PROFIL_ZIEL} existiert bereits OHNE Demo-Marke -- nicht angefasst.`,
    );
  } else {
    const quelle = ANALYSEN.find((a) => a.targetId === PROFIL_ZIEL);
    const dna = {};
    for (const b of quelle.befunde) {
      if (quelle.uebernommeneBefunde.includes(b.questionId)) dna[b.questionId] = b.answer;
    }
    await profilRef.set({
      isDemo: true,
      dna,
      dnaSplit: quelle.split,
      // Leeres Profil: mergeDnaSplit uebernimmt den neuen Split voll, und die
      // Gewichtssumme startet beim Gewicht dieses einen Videos.
      dnaSplitWeight: quelle.gewicht,
      actionStats: quelle.aktionen.map((a) => ({
        id: a.id,
        attempted: a.attempted,
        landed: a.landed,
        zone: a.zone,
        setup: a.setup,
      })),
      updatedBy: konto.uid,
      updatedAt: new Date(),
    });
    console.log(
      `\nKampfprofil von ${PROFIL_ZIEL} angelegt: ${Object.keys(dna).length} Antworten, Gewicht ${quelle.gewicht}`,
    );
  }

  console.log(`\nFertig -- ${ANALYSEN.length} Analysen, alle mit createdBy=${konto.uid}.`);
  console.log("Zum Zuruecknehmen: node scripts/seed-demo-analysen.mjs --loeschen");
}
