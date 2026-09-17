/**
 * Kampfart-Steckbriefe — was in welcher Kampfart gilt.
 *
 * ─── WARUM ES DIESE DATEI GIBT ──────────────────────────────────────────────
 *
 * Leon 17.09.2026: EINE gemeinsame Fragenliste (gleiche ID = gleiche Frage in
 * allen Kampfarten) plus je Kampfart ein Steckbrief. Ein Steckbrief ist keine
 * zweite Fragenliste, sondern eine SPERRLISTE (welche Fragen gelten nicht),
 * eine ERLAUBNISLISTE (welche Techniken zählen) und die BEGRIFFE (Phasen,
 * Takedown, Wertung). Käfig, Seile und Matte hängen an der FLÄCHE des Videos
 * (`Flaeche`, erkannt im Vorlauf). Spezifikation mit Quellen:
 * docs/kampfart-steckbriefe.md.
 *
 * Leons Antworten auf die sechs Entscheidungen (17.09.2026, alle wie
 * empfohlen): `entry-patterns_jab` gestrichen · acht Zusatzfragen · zwei
 * Label-Fassungen (er/du) · 37 Techniken mit den Gruppen clinch und
 * submission · EIN Varianten-Chip, nur Kickboxen/Muay Thai · Kampf-Sambo
 * läuft als MMA.
 *
 * ─── WO DIE STECKBRIEFE WIRKEN (Reihenfolge der Filter) ────────────────────
 *
 *   1. Gemini beobachtet OHNE Kampfart — eine Vorgabe im Beobachtungs-Prompt
 *      unterdrückt echte Aktionen, wenn die Kampfart falsch gewählt ist
 *      (Versuch 1, Fenster „Daten sauber").
 *   2. `filtereBeobachtung` nimmt aus der Beobachtung, was in der Kampfart
 *      nicht vorkommen kann → `verworfen[]`. Die Bewertung (Claude) bekommt
 *      die gefilterte Beobachtung, die Kampfart und nur die offenen Fragen.
 *   3. Die commit-Route filtert die Zähler und den Split ein zweites Mal
 *      (`filtereTechnikStats`, `splitNachSteckbrief`) — der Server glaubt dem
 *      Client nicht — und speichert `verworfen[]` an der Analyse.
 *   4. Die Profil-Rechnung (lib/profile-evidence.ts) rechnet Signale aus der
 *      GEFILTERTEN Beobachtung und nimmt einen Befund nur, wenn
 *      `frageGiltFuer` UND „nur was vorkam" (`SIGNAL_JE_FRAGE`) passen. Weil
 *      das Profil immer aus ALLEN Analysen neu rechnet, greift das auch für
 *      Analysen von vorher.
 *
 * Rein: kein Firestore, kein React, kein Netz. Prüfung:
 *   node --import ./scripts/lib/ts-loader-register.mjs scripts/test-kampfart-steckbrief.mjs
 */

import {
  ACTION_BY_ID,
  ACTION_CATALOG,
  ACTION_GROUPS,
  DNA_SPLIT_KEYS,
  cleanDnaSplit,
  isDnaSplitEmpty,
  type ActionGroup,
  type ActionStat,
  type CageZone,
  type DnaSplit,
  type DnaSplitKey,
} from "./fight-stats";
import { DNA_CATEGORIES } from "./gegner-dna";
import type { Sport, VideoObservation } from "./video-analysis";

// ─── Signale: was in einem Video passiert sein muss ─────────────────────────

/**
 * Was ein Video zeigen muss, damit eine Frage offen ist („nur was vorkam",
 * Etappe 2). Die Profil-Rechnung rechnet die Signale aus der gefilterten
 * Beobachtung; diese Datei definiert sie, damit Fragen und Signale an EINER
 * Stelle zusammen wachsen.
 *
 *   strikes        Gruppe strike, Split boxing > 0, defense.strikes*
 *   kicks          Gruppe kick, Split kicking > 0 (setzt auch strikes)
 *   clinch         Gruppe clinch, Split clinch > 0, controlTime.clinchSeconds
 *   takedowns      Gruppe takedown, Split wrestling > 0, defense.takedowns*
 *   ground         Gruppe ground oder submission, Split ground > 0, top/bottom-Sekunden
 *   ground-top     controlTime.topSeconds > 0
 *   ground-bottom  controlTime.bottomSeconds > 0
 *   submissions    mindestens ein Eintrag der Gruppe submission mit Versuch
 *   cage           Zone "cage" an Aktionen/Combos, cagePressure-/pressedSeconds
 *   rocked         defense.rockedMoments nicht leer oder knockdownsReceived > 0
 *   attacked       defense.strikesAgainst + defense.takedownsAgainst > 0
 */
export type Signal =
  | "strikes"
  | "kicks"
  | "clinch"
  | "takedowns"
  | "ground"
  | "ground-top"
  | "ground-bottom"
  | "submissions"
  | "cage"
  | "rocked"
  | "attacked";

/** Welche Signale eine gezählte Technik ihrer Gruppe setzt. */
export const SIGNALE_JE_GRUPPE: Readonly<Record<ActionGroup, readonly Signal[]>> = {
  strike: ["strikes"],
  kick: ["kicks", "strikes"],
  clinch: ["clinch"],
  takedown: ["takedowns"],
  ground: ["ground"],
  submission: ["submissions", "ground"],
};

/**
 * Frage → nötiges Signal. Fragen ohne Eintrag sind stilneutral und immer
 * offen. Stand 17.09.2026: 21 bisherige Einträge − `entry-patterns_jab`
 * + acht Zusatzfragen; `defensive-reactions_shoots` und
 * `weaknesses_gets-hit-by` sind neutral formuliert und hängen jetzt an
 * `attacked` (Entwurf Abschnitt 6).
 */
export const SIGNAL_JE_FRAGE: Readonly<Record<string, Signal>> = {
  "real-habits_after-hit": "strikes",
  "real-habits_after-miss": "strikes",
  "real-habits_after-td-attempt": "takedowns",
  "real-habits_ground-top": "ground-top",
  "real-habits_ground-bottom": "ground-bottom",
  "real-habits_after-rocked": "rocked",
  "entry-patterns_clinch": "clinch",
  "entry-patterns_takedown": "takedowns",
  "entry-patterns_center-or-cage": "cage",
  "entry-patterns_throw-direction": "takedowns",
  "preferred-weapons_kick": "kicks",
  "preferred-weapons_punch": "strikes",
  "preferred-weapons_takedown": "takedowns",
  "preferred-weapons_grip": "clinch",
  "preferred-weapons_clinch": "clinch",
  "preferred-weapons_submission": "submissions",
  "preferred-weapons_guard": "ground-bottom",
  "defensive-reactions_jabs": "strikes",
  "defensive-reactions_low-kicks": "kicks",
  "defensive-reactions_takedowns": "takedowns",
  "defensive-reactions_parry-shell": "strikes",
  "defensive-reactions_shoots": "attacked",
  "cage-space_at-cage": "cage",
  "cage-space_pushes-cage": "cage",
  "cage-space_escapes-cage": "cage",
  "weaknesses_gets-hit-by": "attacked",
  "drills_cage-situations": "cage",
  "drills_takedown-sequences": "takedowns",
};

// ─── Varianten ───────────────────────────────────────────────────────────────

/**
 * Variante innerhalb einer Kampfart — heute genau eine Wahl: Kickboxen oder
 * Muay Thai (Leon 17.09.2026). Ellbogen, Schläge im Clinch und Umwerfen sind
 * im Muay Thai Kern des Kampfes, in K-1/GLORY Fouls; ohne die Wahl mittelte
 * das Profil beides. Alle anderen Unterschiede (Freistil/Greco, Judo/Sport-
 * Sambo, Gi/No-Gi, Profi/Amateur) trägt „nur was vorkam". Gi/No-Gi kommt bei
 * Bedarf additiv hinzu.
 */
export type Variante = "kickboxen" | "muay-thai";

export const VARIANTE_LABEL: Record<Variante, string> = {
  kickboxen: "Kickboxen",
  "muay-thai": "Muay Thai",
};

export function isVariante(x: unknown): x is Variante {
  return x === "kickboxen" || x === "muay-thai";
}

// ─── Fläche ──────────────────────────────────────────────────────────────────

/**
 * Worauf im Video gekämpft wird — erkennt der Vorlauf, einmal je Upload
 * (Leon 17.09.2026 nach dem Beweislauf: „Käfig nur, wenn einer da ist").
 * Gemessen: MMA-Sparring im Gym auf der Matte, und die Bewertung schrieb
 * 41-mal „Käfig". Die Fläche gehört wie die Kampfart zum VIDEO: Sie
 * bestimmt die Wörter für Mitte, Rand und Zonen und die Form der Karte
 * (Käfig Achteck · Ring Quadrat · Matte Kreis). null = nicht erkannt oder
 * Bestand → neutrale Wörter „Mitte" und „am Rand".
 */
export type Flaeche = "kaefig" | "ring" | "matte";

export const FLAECHE_LABEL: Record<Flaeche, string> = {
  kaefig: "Käfig",
  ring: "Ring",
  matte: "Matte",
};

export function isFlaeche(x: unknown): x is Flaeche {
  return x === "kaefig" || x === "ring" || x === "matte";
}

/** Rückfall, wenn das Modell die Fläche nur in Worten nennt. */
export function flaecheFromText(text: string | null | undefined): Flaeche | null {
  const t = (text ?? "").toLowerCase();
  if (/(käfig|cage|octagon|oktagon|zaun)/.test(t)) return "kaefig";
  if (/(\bring\b|boxring|seile)/.test(t)) return "ring";
  if (/(matte|tatami)/.test(t)) return "matte";
  return null;
}

// ─── Die Form eines Steckbriefs ──────────────────────────────────────────────

/** Die Wörter einer Kampfart auf ihrer Fläche — für Claudes Texte und die Oberfläche. */
export interface Begriffe {
  /** „Käfig", „Ring", „Matte". */
  flaeche: string;
  /** „Käfigmitte", „Ringmitte", „Mattenmitte". */
  mitte: string;
  /** Ortsangabe am Rand: „am Käfig", „an den Seilen", „am Mattenrand". */
  rand: string;
  phaseStand: string;
  /** Stehender Griffkontakt: „Clinch", „Bindung", „Griffkampf (Kumi-kata)". */
  phaseKontakt: string;
  /** null = die Kampfart hat keinen Bodenkampf. */
  phaseBoden: string | null;
  /** null = die Kampfart hat keine Takedowns. */
  takedown: string | null;
  /** Wie der Kampfbeginn heißt: „Runde 1", „erste Periode", „Kampfbeginn". */
  runde1: string;
  /** Wie Punkte heißen — nur als Wort, eine Wertung ist auf Video nie eine Zahl. */
  wertung: string;
  /** Label der Kategorie `cage-space`. */
  kategorieRaum: string;
  /** Fachwörter, die Claude benutzen darf (Auswahl, keine Pflicht). */
  wortschatz: readonly string[];
}

/** Die Wörter, die an der FLÄCHE hängen (Käfig, Ring, Matte) — nicht an der Kampfart. */
type FlaechenWort = "flaeche" | "mitte" | "rand" | "kategorieRaum";

/** Was der Steckbrief einer Kampfart selbst an Wörtern trägt. */
export type KampfartBegriffe = Omit<Begriffe, FlaechenWort>;

export interface ZonenText {
  /** Anzeige in Tabellen und Chips: „Am Käfig". */
  label: string;
  /** Gebeugt für Fließtext: „am Käfig". */
  phrase: string;
}

export interface Steckbrief {
  sport: Sport;
  /** Satz für Claudes System-Prompt: „Du bist ein erfahrener {rolle} und Kampfanalyst." */
  rolle: string;
  /** Phasen, Takedown, Wertung, Fachwörter — Käfig/Ring/Matte kommen aus der Fläche. */
  begriffe: KampfartBegriffe;
  /** Fragen, die in dieser Kampfart NICHT gelten. Alle anderen gelten (+ „nur was vorkam"). */
  gesperrt: ReadonlySet<string>;
  /** Techniken, die immer zählen. Varianten öffnen zusätzliche (siehe `varianten`). */
  techniken: ReadonlySet<string>;
  /** Split-Schlüssel, die in dieser Kampfart fest 0 sind. */
  splitNull: readonly DnaSplitKey[];
  /** false = keine Zonen (BJJ: Der Rand ist nur Neustart). Die Wörter liefert die Fläche. */
  hatZonen: boolean;
  /** Nur Kickboxen: welche Techniken welche Variante zusätzlich öffnet. */
  varianten?: {
    werte: readonly Variante[];
    oeffnet: Readonly<Record<Variante, readonly string[]>>;
    /** Woran der Vorlauf die Variante erkennt — Satz für den Vorlauf-Prompt. */
    erkennung: string;
  };
  /** Plausibilitätswerte für die Bewertung — Prüfsätze, kein Automatismus. */
  anker: {
    split: string;
    pruefsaetze: readonly string[];
    /** Zusatzsätze je Variante. */
    variante?: Readonly<Partial<Record<Variante, string>>>;
  };
}

// ─── Sperrgruppen der Fragen (Entwurf 3.2) ───────────────────────────────────

/** S — Schläge. */
const FRAGEN_SCHLAEGE = [
  "real-habits_after-hit",
  "real-habits_after-miss",
  "preferred-weapons_punch",
  "defensive-reactions_jabs",
  "defensive-reactions_parry-shell",
];
/** K — Tritte. */
const FRAGEN_TRITTE = ["preferred-weapons_kick", "defensive-reactions_low-kicks"];
/** T — Takedowns und Würfe. */
const FRAGEN_TAKEDOWNS = [
  "real-habits_after-td-attempt",
  "entry-patterns_takedown",
  "preferred-weapons_takedown",
  "defensive-reactions_takedowns",
  "drills_takedown-sequences",
];
/** R ohne `at-cage` — der Rand als Druckmittel (in BJJ nur Neustart). */
const FRAGEN_RAND_DRUCK = [
  "entry-patterns_center-or-cage",
  "cage-space_pushes-cage",
  "cage-space_escapes-cage",
  "drills_cage-situations",
];

/** Die acht Zusatzfragen (Entwurf 3.5) und wo sie gelten. */
export const ZUSATZFRAGEN_GILT_IN: Readonly<Record<string, readonly Sport[]>> = {
  "real-habits_ground-top": ["mma", "ringen", "sambo", "bjj"],
  "real-habits_ground-bottom": ["mma", "ringen", "sambo", "bjj"],
  "preferred-weapons_grip": ["mma", "ringen", "sambo", "bjj"],
  "preferred-weapons_clinch": ["mma", "boxen", "kickboxen"],
  "preferred-weapons_submission": ["mma", "sambo", "bjj"],
  "preferred-weapons_guard": ["bjj", "mma"],
  "entry-patterns_throw-direction": ["ringen", "sambo"],
  "real-habits_after-rocked": ["mma", "boxen", "kickboxen"],
};

function sperrliste(sport: Sport, basis: string[]): ReadonlySet<string> {
  const zusatz = Object.keys(ZUSATZFRAGEN_GILT_IN).filter(
    (q) => !ZUSATZFRAGEN_GILT_IN[q].includes(sport),
  );
  return new Set([...basis, ...zusatz]);
}

// ─── Technik-Listen (Entwurf 4.3 und 7) ──────────────────────────────────────

const ALLE_TECHNIKEN = ACTION_CATALOG.map((a) => a.id);
const TECHNIKEN_BOXEN = ["jab", "cross", "hook", "uppercut", "overhand"];
const TECHNIKEN_KICKBOXEN = [
  "jab", "cross", "hook", "uppercut", "overhand", "spinning-strike",
  "low-kick", "body-kick", "high-kick", "front-kick", "knee", "spinning-kick",
  "clinch-knee",
];
/** Nur Muay Thai: in K-1/GLORY Fouls. */
const NUR_MUAY_THAI = ["elbow", "clinch-strike", "sweep-dump"];
const TECHNIKEN_RINGEN = [
  "single-leg", "double-leg", "body-lock", "trip", "throw-hip", "throw-shoulder",
  "throw-sacrifice", "throw", "go-behind",
  "sweep", "turn", "hold-down", "escape",
];
/**
 * `submission` (Rückfall, Art nicht erkennbar) steht in Sambo und BJJ mit
 * drin, obwohl der Entwurf in 7.5/7.6 nur die drei feinen IDs aufzählt: Leons
 * Entscheidung 4 hält `throw`/`submission` als Rückfall — ohne ihn verwürfe
 * der Server einen Aufgabegriff, nur weil die KI die Art nicht erkennt.
 */
const TECHNIKEN_SAMBO = [
  "single-leg", "double-leg", "body-lock", "trip", "throw-hip", "throw-shoulder",
  "throw-sacrifice", "throw",
  "hold-down", "turn", "sweep", "escape", "pass", "submission",
  "choke", "armlock", "leglock",
];
const TECHNIKEN_BJJ = [
  "single-leg", "double-leg", "body-lock", "trip", "throw-hip", "throw-shoulder",
  "throw-sacrifice", "throw", "guard-pull",
  "pass", "sweep", "back-take", "escape", "submission",
  "choke", "armlock", "leglock",
];

// ─── Zonen-Wörter (Entwurf 5.1) ──────────────────────────────────────────────

const ZONEN_KAEFIG: Record<CageZone, ZonenText> = {
  center: { label: "Käfigmitte", phrase: "in der Käfigmitte" },
  open: { label: "Offener Raum", phrase: "im offenen Raum" },
  cage: { label: "Am Käfig", phrase: "am Käfig" },
};
const ZONEN_RING: Record<CageZone, ZonenText> = {
  center: { label: "Ringmitte", phrase: "in der Ringmitte" },
  open: { label: "Offener Raum", phrase: "im offenen Raum" },
  cage: { label: "An den Seilen", phrase: "an den Seilen" },
};
const ZONEN_MATTE: Record<CageZone, ZonenText> = {
  center: { label: "Mattenmitte", phrase: "in der Mattenmitte" },
  open: { label: "Kampffläche", phrase: "auf der Kampffläche" },
  cage: { label: "Am Mattenrand", phrase: "am Mattenrand" },
};
/** Ohne Kampfart (Gegnerprofil, Gesamtprofil über mehrere Kampfarten). */
const ZONEN_NEUTRAL: Record<CageZone, ZonenText> = {
  center: { label: "Mitte", phrase: "in der Mitte" },
  open: { label: "Offener Raum", phrase: "im offenen Raum" },
  cage: { label: "Am Rand", phrase: "am Rand" },
};

interface FlaechenWoerter extends Pick<Begriffe, FlaechenWort> {
  zonen: Readonly<Record<CageZone, ZonenText>>;
  wortschatz: readonly string[];
}

/** Wörter je Fläche (Entwurf 5.1) — Käfig-Wörter NUR, wenn der Vorlauf einen Käfig sieht. */
const FLAECHEN: Readonly<Record<Flaeche, FlaechenWoerter>> = {
  kaefig: {
    flaeche: "Käfig",
    mitte: "Käfigmitte",
    rand: "am Käfig",
    kategorieRaum: "Käfig & Raum",
    zonen: ZONEN_KAEFIG,
    wortschatz: ["Zaun", "Wall-Wrestling", "Cage Control"],
  },
  ring: {
    flaeche: "Ring",
    mitte: "Ringmitte",
    rand: "an den Seilen",
    kategorieRaum: "Ring & Raum",
    zonen: ZONEN_RING,
    wortschatz: ["Seile", "Ecke", "Ringmitte"],
  },
  matte: {
    flaeche: "Matte",
    mitte: "Mattenmitte",
    rand: "am Mattenrand",
    kategorieRaum: "Matte & Raum",
    zonen: ZONEN_MATTE,
    wortschatz: ["Mattenrand"],
  },
};

/** Fläche unbekannt (nicht erkannt, Bestand, Gesamtprofil). */
const FLAECHE_NEUTRAL: FlaechenWoerter = {
  flaeche: "Kampffläche",
  mitte: "Mitte",
  rand: "am Rand",
  kategorieRaum: "Raum & Rand",
  zonen: ZONEN_NEUTRAL,
  wortschatz: [],
};

const BEGRIFFE_NEUTRAL: KampfartBegriffe = {
  phaseStand: "Stand",
  phaseKontakt: "Clinch",
  phaseBoden: "Boden",
  takedown: "Takedown",
  runde1: "Runde 1",
  wertung: "Wertung",
  wortschatz: [],
};

// ─── Die sechs Steckbriefe (Entwurf Abschnitt 7) ─────────────────────────────

export const STECKBRIEFE: Readonly<Record<Sport, Steckbrief>> = {
  mma: {
    sport: "mma",
    rolle: "MMA-Cheftrainer",
    begriffe: {
      phaseStand: "Stand",
      phaseKontakt: "Clinch",
      phaseBoden: "Boden",
      takedown: "Takedown",
      runde1: "Runde 1",
      wertung: "Punktrichter-Wertung",
      wortschatz: [
        "Shot", "Sprawl", "Scramble", "Stand-up",
        "Guard", "Half Guard", "Side Control", "Mount", "Back Control", "Turtle",
        "Underhook", "Overhook", "Collar Tie", "Body Lock", "Whizzer",
        "Ground & Pound", "Submission", "Level-Change", "Knockdown",
      ],
    },
    // MMA ist die Obermenge: keine Basisfrage gesperrt; von den Zusatzfragen
    // gilt nur die Wurfrichtung nicht.
    gesperrt: sperrliste("mma", []),
    techniken: new Set(ALLE_TECHNIKEN),
    splitNull: [],
    hatZonen: true,
    anker: {
      split: "Richtwerte aus UFC-Kämpfen: Stand etwa 50 %, Boden etwa 36 %, Clinch etwa 13 %, Zeit am Rand etwa 21 %.",
      pruefsaetze: [
        "Eine Takedown-Quote nennst du erst ab 5 Versuchen.",
        "Bodenzeit allein sagt wenig — gelandete Bodenschläge und Positionsverbesserungen zeigen Überlegenheit.",
        "Ein Takedown ohne Bodenphase danach ist ein Versuch, kein gelungener Takedown.",
        "Amateur-MMA (Schienbeinschoner, 3 × 3 Minuten): Ellbogen, Knie zum Kopf und Heel Hook sind verboten. Tauchen sie auf, ist es ein Erkennungsfehler, keine Waffe.",
        "Kampf-Sambo läuft als MMA: Würfe, Haltegriffe und Aufgabegriffe gehören dann dazu.",
      ],
    },
  },

  boxen: {
    sport: "boxen",
    rolle: "Boxtrainer",
    begriffe: {
      phaseStand: "Distanz",
      phaseKontakt: "Clinch/Halten",
      phaseBoden: null,
      takedown: null,
      runde1: "Runde 1",
      wertung: "Wertungstreffer",
      wortschatz: [
        "lange Distanz", "Halbdistanz", "Infight",
        "Führhand", "Schlaghand", "Gerade", "Haken", "Aufwärtshaken", "Körperhaken",
        "Leberhaken", "Deckung", "Parade", "Pendeln", "Abducken", "Abrollen",
        "Ausdrehen (Pivot)", "Clinch/Halten", "Break", "Konter", "Niederschlag", "Anzählen",
      ],
    },
    gesperrt: sperrliste("boxen", [...FRAGEN_TRITTE, ...FRAGEN_TAKEDOWNS]),
    techniken: new Set(TECHNIKEN_BOXEN),
    splitNull: ["kicking", "wrestling", "ground"],
    hatZonen: true,
    anker: {
      split: "Nur boxing und clinch — kicking, wrestling und ground sind 0. Amateure schlagen etwa 20–25 Schläge pro Minute; die Clinch-Zeit steigt mit der Ermüdung. Mehr als 30 % Clinch ist ungewöhnlich — prüfe die Phasen.",
      pruefsaetze: [
        "Die Schlagzahl allein trennt Sieger nicht von Verlierern — Trefferquote, Führhand-Geraden, Körperarbeit und Abwehr mit Beinarbeit schon.",
        "Gelungen heißt: Kontakt auf der Trefferfläche UND sichtbare Reaktion. Getroffen oder geblockt bleibt oft unsicher — dann senkst du die Konfidenz.",
        "Mit Kopfschutz sind Kopftreffer schlechter erkennbar — Konfidenz senken.",
        "Schlagen im Halten ist ein Foul und kein Muster.",
      ],
    },
  },

  kickboxen: {
    sport: "kickboxen",
    rolle: "Kickbox- und Thaibox-Trainer",
    begriffe: {
      phaseStand: "Distanz",
      phaseKontakt: "Clinch",
      phaseBoden: null,
      takedown: null,
      runde1: "Runde 1",
      wertung: "Wertungstreffer",
      wortschatz: [
        "Lowkick", "Middlekick", "Highkick", "Teep", "Kniestoß", "Ellbogen",
        "checken", "Bein fangen", "Plum (Double Collar Tie)", "Single Collar Tie",
        "Over-Under", "Innenposition", "Fußfeger", "Umwerfen (Dump)",
        "Kickdistanz", "Boxdistanz", "Kniedistanz", "K-1-Regeln", "Thairegeln",
      ],
    },
    gesperrt: sperrliste("kickboxen", [...FRAGEN_TAKEDOWNS]),
    techniken: new Set(TECHNIKEN_KICKBOXEN),
    splitNull: ["wrestling", "ground"],
    hatZonen: true,
    varianten: {
      werte: ["kickboxen", "muay-thai"],
      oeffnet: { kickboxen: [], "muay-thai": NUR_MUAY_THAI },
      erkennung:
        "Muay Thai erkennst du an Ellbogenschützern, Mongkon (Kopfreif) oder Pra Jiad (Armbänder), Wai Kru vor dem Kampf, Ellbogen und langen Clinch-Phasen mit Knie-Serien; sonst Kickboxen (K-1, GLORY, Low Kick, Vollkontakt).",
    },
    anker: {
      split: "Nur boxing, kicking und clinch — wrestling und ground sind 0, der Kampf stoppt bei Bodenkontakt. Richtwert: Arme etwa 63 %, Beine etwa 37 % der Techniken.",
      pruefsaetze: [
        "Ein Roundhouse-Kick dauert etwa 1 Sekunde — bei wenigen Bildern pro Sekunde sind Serienzahlen Tendenzen, keine exakten Werte.",
        "Sieger nutzen mehr Haken, Abwehr mit Beinarbeit und Clinch.",
        "Balance nach dem Tritt ist ein sichtbares Schwächemerkmal.",
        "Ein Sturz ist nur dann Fegen oder Umwerfen, wenn Fuß- oder Wadenkontakt, Zug oder Drehung sichtbar ist — sonst ein Ausrutscher.",
      ],
      variante: {
        kickboxen: "Variante Kickboxen (K-1, GLORY): Ellbogen, Schläge im Clinch und Umwerfen sind Fouls; im Clinch zählt höchstens ein Knie. Clinch-Zeit liegt bei wenigen Prozent.",
        "muay-thai": "Variante Muay Thai: Ellbogen, Knie-Serien im Clinch und Umwerfen gehören zum Kern des Kampfes; der Clinch hat kein Zeitlimit.",
      },
    },
  },

  ringen: {
    sport: "ringen",
    rolle: "Ringertrainer",
    begriffe: {
      phaseStand: "Standkampf",
      phaseKontakt: "Bindung",
      phaseBoden: "Bodenkampf",
      takedown: "Angriff/Wurf",
      runde1: "erste Periode",
      wertung: "technische Punkte",
      wortschatz: [
        "Passivitätszone", "Schutzzone", "Parterre", "Obermann", "Untermann", "Bank",
        "Brücke", "gefährliche Lage", "Schultersieg", "Fassung", "Beinangriff",
        "Einbeinangriff", "Zweibeinangriff", "Knöchelgriff", "Konter", "Übertragen",
        "Ausheber", "Durchdreher", "Beinschraube", "Halbnelson", "Überwurf",
        "Hüftschwung", "Schulterwurf", "Armzug", "Nackenzug", "Unterhaken",
        "Abtauchen", "Sprawl",
      ],
    },
    gesperrt: sperrliste("ringen", [...FRAGEN_SCHLAEGE, ...FRAGEN_TRITTE]),
    techniken: new Set(TECHNIKEN_RINGEN),
    splitNull: ["boxing", "kicking"],
    hatZonen: true,
    anker: {
      split: "boxing und kicking sind 0. Freistil: Stand 74–79 %, Boden 21–26 %. Griechisch-Römisch: 44–47 % der Punkte aus dem Boden. Freistil mit über 40 % Boden oder Griechisch-Römisch mit unter 20 % Bindung ist ungewöhnlich — prüfe die Phasen.",
      pruefsaetze: [
        "Zählen, nicht werten: gelungen nur über die Körperlage, nie über Kampfrichterpunkte.",
        "Die Single-Leg-Quote trennt Sieger stark von Verlierern — eine Quote nennst du trotzdem erst ab 5 Versuchen.",
        "Griechisch-Römisch: Beinangriffe sind Fouls. Tauchen sie auf, prüfe die Erkennung.",
        "Die Bindung ist eine Phase, kein Angriff.",
      ],
    },
  },

  sambo: {
    sport: "sambo",
    rolle: "Judo- und Sambo-Trainer",
    begriffe: {
      phaseStand: "Standkampf (Tachi-waza)",
      phaseKontakt: "Griffkampf (Kumi-kata)",
      phaseBoden: "Bodenkampf (Ne-waza)",
      takedown: "Wurf",
      runde1: "Kampfbeginn",
      wertung: "Wurfwertung",
      wortschatz: [
        "Kumi-kata", "Zughand (Hikite)", "Hebehand (Tsurite)", "Ärmel", "Revers",
        "Ai-yotsu", "Kenka-yotsu", "Kuzushi", "Kaeshi-waza", "Renraku-waza",
        "Uchi-mata", "O-soto-gari", "Seoi-nage", "Tai-otoshi", "Harai-goshi",
        "Haltegriff", "Armhebel", "Achillessehnenhebel", "Kniehebel", "Hadaka-jime",
        "Beingreifer",
      ],
    },
    gesperrt: sperrliste("sambo", [...FRAGEN_SCHLAEGE, ...FRAGEN_TRITTE]),
    techniken: new Set(TECHNIKEN_SAMBO),
    splitNull: ["boxing", "kicking"],
    hatZonen: true,
    anker: {
      split: "boxing und kicking sind 0. Griffkampf etwa 40 % der Kampfzeit, ein Wurf dauert 1,0–1,4 Sekunden.",
      pruefsaetze: [
        "Direkte Angriffe etwa 83 %, Konter etwa 17 %; vorwärts etwa 58 %, rückwärts etwa 42 %.",
        "Ein Angriff auf der Griffseite erhöht die Wertungschance deutlich — nenne die Griffseite, wenn sie sichtbar ist.",
        "Die Wertung (Ippon, Waza-ari, Yuko) ist auf Video nicht sicher, die Landung schon — beschreibe die Landung.",
        "Judo: keine Beinhebel. Sport-Sambo: keine Würger. Tauchen sie auf, prüfe die Erkennung.",
        "Die Gewichtsklasse verändert die Griffzeit stark — nenne sie als Kontext, wenn sie bekannt ist.",
      ],
    },
  },

  bjj: {
    sport: "bjj",
    rolle: "BJJ- und Grappling-Trainer",
    begriffe: {
      phaseStand: "Stand",
      phaseKontakt: "Griffkampf im Stand",
      phaseBoden: "Boden",
      takedown: "Takedown oder Guard-Pull",
      runde1: "erste Phase",
      wertung: "Punkte und Advantages",
      wortschatz: [
        "Closed Guard", "Half Guard", "Open Guard", "Guard Pass", "Sweep",
        "Knee on Belly", "Side Control", "Mount", "Back Control", "Turtle",
        "Guard-Pull", "Wrestle-up", "Escape", "Top", "Bottom", "Würger", "Armbar",
        "Kimura", "Beinhebel", "Heel Hook", "Beinverwicklung",
      ],
    },
    gesperrt: sperrliste("bjj", [...FRAGEN_SCHLAEGE, ...FRAGEN_TRITTE, ...FRAGEN_RAND_DRUCK]),
    techniken: new Set(TECHNIKEN_BJJ),
    splitNull: ["boxing", "kicking"],
    hatZonen: false,
    anker: {
      split: "boxing und kicking sind 0. Boden etwa 79–87 % der Kampfzeit.",
      pruefsaetze: [
        "Ein gelungener Pass hängt fast immer mit dem Sieg zusammen, ein Sweep deutlich schwächer.",
        "Ein Submission-Versuch endet selten im Finish — Versuche überhöhst du nicht zur Stärke.",
        "Zeit oben ist nicht gleich Überlegenheit.",
        "Der Mattenrand ist nur Neustart, kein Druckmittel.",
      ],
    },
  },
};

// ─── Abfragen ────────────────────────────────────────────────────────────────

/** Der Steckbrief einer Kampfart — null ohne Kampfart (Bestand vor Etappe 2). */
export function steckbrief(sport: Sport | null | undefined): Steckbrief | null {
  return sport ? (STECKBRIEFE[sport] ?? null) : null;
}

/**
 * Gilt diese Frage in dieser Kampfart? Ohne Kampfart gilt alles — ein
 * Video ohne Kampfart ist unbekannt, nicht eingeschränkt.
 */
export function frageGiltFuer(questionId: string, sport: Sport | null | undefined): boolean {
  const s = steckbrief(sport);
  return !s || !s.gesperrt.has(questionId);
}

/** Die Variante nur, wenn sie zur Kampfart gehört — sonst null. */
export function varianteFuer(sport: Sport | null | undefined, variante: unknown): Variante | null {
  const s = steckbrief(sport);
  if (!s?.varianten || !isVariante(variante)) return null;
  return s.varianten.werte.includes(variante) ? variante : null;
}

/**
 * Zählt diese Technik in dieser Kampfart (und Variante)? Ohne Kampfart
 * zählt alles. Hat die Kampfart Varianten und ist keine gewählt (Bestand),
 * zählt, was irgendeine Variante erlaubt — lieber nichts wegwerfen, was
 * vielleicht gilt.
 */
export function technikErlaubt(
  actionId: string,
  sport: Sport | null | undefined,
  variante?: Variante | null,
): boolean {
  const s = steckbrief(sport);
  if (!s) return true;
  if (s.techniken.has(actionId)) return true;
  if (!s.varianten) return false;
  const v = varianteFuer(sport, variante);
  if (v) return s.varianten.oeffnet[v].includes(actionId);
  return s.varianten.werte.some((w) => s.varianten!.oeffnet[w].includes(actionId));
}

/** Die erlaubten Techniken in Katalog-Reihenfolge. */
export function erlaubteTechniken(sport: Sport | null | undefined, variante?: Variante | null): string[] {
  return ALLE_TECHNIKEN.filter((id) => technikErlaubt(id, sport, variante));
}

/** Gruppen, in denen KEINE Technik zählt — für Claudes Kampfart-Absatz. */
export function gesperrteGruppen(sport: Sport | null | undefined, variante?: Variante | null): ActionGroup[] {
  return ACTION_GROUPS.filter(
    (g) => !ACTION_CATALOG.some((a) => a.group === g && technikErlaubt(a.id, sport, variante)),
  );
}

/** Die offenen Fragen einer Kampfart in Katalog-Reihenfolge. */
export function offeneFragen(sport: Sport | null | undefined): string[] {
  return DNA_CATEGORIES.flatMap((c) => c.questions.map((q) => q.id)).filter((id) =>
    frageGiltFuer(id, sport),
  );
}

function flaechenWoerter(flaeche: Flaeche | null | undefined): FlaechenWoerter {
  return isFlaeche(flaeche) ? FLAECHEN[flaeche] : FLAECHE_NEUTRAL;
}

/**
 * Die Wörter einer Kampfart auf ihrer Fläche: Phasen, Takedown, Wertung aus
 * dem Steckbrief, Käfig/Ring/Matte aus der Fläche. Ohne Fläche neutral
 * („Mitte", „am Rand") — auch im MMA, wenn der Vorlauf keinen Käfig sieht.
 */
export function begriffe(sport: Sport | null | undefined, flaeche?: Flaeche | null): Begriffe {
  const k = steckbrief(sport)?.begriffe ?? BEGRIFFE_NEUTRAL;
  const f = flaechenWoerter(flaeche);
  return {
    ...k,
    flaeche: f.flaeche,
    mitte: f.mitte,
    rand: f.rand,
    kategorieRaum: f.kategorieRaum,
    wortschatz: [...k.wortschatz, ...f.wortschatz],
  };
}

/** Wörter der Fläche; BJJ hat keine Zone (null) — dort ist der Rand nur Neustart. */
function zonenVon(
  sport: Sport | null | undefined,
  flaeche: Flaeche | null | undefined,
): Readonly<Record<CageZone, ZonenText>> | null {
  const s = steckbrief(sport);
  if (s && !s.hatZonen) return null;
  return flaechenWoerter(flaeche).zonen;
}

function mapZonen(z: Readonly<Record<CageZone, ZonenText>> | null, feld: keyof ZonenText): Record<CageZone, string> | null {
  return z ? { center: z.center[feld], open: z.open[feld], cage: z.cage[feld] } : null;
}

/** Zonen-Labels je Fläche („An den Seilen") — null, wo die Kampfart keine Zone hat (BJJ). */
export function zonenLabel(sport: Sport | null | undefined, flaeche?: Flaeche | null): Record<CageZone, string> | null {
  return mapZonen(zonenVon(sport, flaeche), "label");
}

/** Gebeugte Ortsangabe je Fläche („an den Seilen") — null ohne Zone. */
export function zonenPhrase(sport: Sport | null | undefined, flaeche?: Flaeche | null): Record<CageZone, string> | null {
  return mapZonen(zonenVon(sport, flaeche), "phrase");
}

/** Label der Kategorie `cage-space` je Fläche („Ring & Raum"). */
export function kategorieLabel(flaeche?: Flaeche | null): string {
  return flaechenWoerter(flaeche).kategorieRaum;
}

// ─── Filter nach der Beobachtung ─────────────────────────────────────────────

/** Eine Technik, die in der Kampfart nicht zählt — bleibt als Beleg an der Analyse. */
export interface VerworfeneAktion {
  /** Katalog-ID. */
  id: string;
  /** So viele Versuche fielen heraus. */
  attempted: number;
  /**
   * "kampfart" = in dieser Kampfart nie erlaubt (Erkennungsfehler oder Foul);
   * "variante" = nur in der anderen Variante erlaubt (z. B. Ellbogen im Kickboxen).
   */
  grund: "kampfart" | "variante";
}

export function isVerworfeneAktion(x: unknown): x is VerworfeneAktion {
  const v = x as VerworfeneAktion;
  return (
    !!v &&
    typeof v.id === "string" &&
    typeof v.attempted === "number" &&
    (v.grund === "kampfart" || v.grund === "variante")
  );
}

function grundFuer(id: string, sport: Sport | null | undefined): VerworfeneAktion["grund"] {
  // Erlaubt ohne Variante (= irgendeine Variante) → die Variante hat es gesperrt.
  return steckbrief(sport)?.varianten && technikErlaubt(id, sport, null) ? "variante" : "kampfart";
}

function sammleVerworfen(liste: VerworfeneAktion[], id: string, attempted: number, grund: VerworfeneAktion["grund"]) {
  const da = liste.find((v) => v.id === id);
  if (da) da.attempted += attempted;
  else liste.push({ id, attempted, grund });
}

/**
 * Zähler gegen den Steckbrief: Erlaubtes bleibt, der Rest geht nach
 * `verworfen`. Unbekannte IDs bleiben liegen — die räumt `cleanActionStats`.
 */
export function filtereTechnikStats<T extends Pick<ActionStat, "id" | "attempted">>(
  stats: readonly T[] | null | undefined,
  sport: Sport | null | undefined,
  variante?: Variante | null,
): { stats: T[]; verworfen: VerworfeneAktion[] } {
  const behalten: T[] = [];
  const verworfen: VerworfeneAktion[] = [];
  for (const s of stats ?? []) {
    if (!ACTION_BY_ID.has(s.id) || technikErlaubt(s.id, sport, variante)) {
      behalten.push(s);
      continue;
    }
    sammleVerworfen(verworfen, s.id, Math.max(0, Math.round(Number(s.attempted) || 0)), grundFuer(s.id, sport));
  }
  return { stats: behalten, verworfen };
}

/**
 * Split mit den festen Nullen der Kampfart, neu auf 100 normiert. Bleibt
 * nichts übrig (ein „Boxkampf" nur mit Bodenzeit), ist der Split null —
 * lieber keiner als ein erfundener.
 */
export function splitNachSteckbrief(
  split: DnaSplit | null | undefined,
  sport: Sport | null | undefined,
): DnaSplit | null {
  if (!split || isDnaSplitEmpty(split)) return null;
  const s = steckbrief(sport);
  const roh = { ...split };
  for (const k of s?.splitNull ?? []) roh[k] = 0;
  const sauber = cleanDnaSplit(roh);
  return isDnaSplitEmpty(sauber) ? null : sauber;
}

/**
 * Die Beobachtung, wie sie in dieser Kampfart gelesen wird (Entwurf
 * Abschnitt 2 und 8.3). Die Rohbeobachtung bleibt gespeichert; dieses
 * Ergebnis ist die Sicht, aus der Claude bewertet und die Profil-Rechnung
 * Signale bildet:
 *   • Aktionen außerhalb der Erlaubnisliste → `verworfen` ("other" bleibt)
 *   • Split: feste Nullen, neu normiert
 *   • Abwehrzähler einer gesperrten Gruppe → null (kein Takedown-Signal
 *     aus „2 Takedowns abgewehrt" im Kickboxen)
 *   • Oben/unten-Sekunden → null, wo ground fest 0 ist
 *   • Wackler/Niederschläge → leer, wo weder Schläge noch Tritte zählen
 *   • Zonen und Rand-Sekunden → null, wo es keine Zone gibt (BJJ)
 */
export function filtereBeobachtung(
  o: VideoObservation,
  sport: Sport | null | undefined,
  variante?: Variante | null,
): { observation: VideoObservation; verworfen: VerworfeneAktion[] } {
  const s = steckbrief(sport);
  if (!s) return { observation: o, verworfen: [] };
  const v = varianteFuer(sport, variante);
  const gesperrt = new Set(gesperrteGruppen(sport, v));
  const ohneZone = !s.hatZonen;

  const verworfen: VerworfeneAktion[] = [];
  const actions = (o.actions ?? []).flatMap((a) => {
    if (a.id !== "other" && ACTION_BY_ID.has(a.id) && !technikErlaubt(a.id, sport, v)) {
      sammleVerworfen(verworfen, a.id, Math.max(0, Math.round(Number(a.attempted) || 0)), grundFuer(a.id, sport));
      return [];
    }
    return [ohneZone ? { ...a, zone: null } : a];
  });

  const def = o.defense;
  const ohneSchlaege = gesperrt.has("strike") && gesperrt.has("kick");
  const defense = def
    ? {
        ...def,
        ...(gesperrt.has("takedown") ? { takedownsDefended: null, takedownsAgainst: null } : {}),
        ...(ohneSchlaege
          ? { strikesAvoided: null, strikesAgainst: null, hitLocations: null, knockdownsReceived: null, rockedMoments: [] }
          : {}),
      }
    : def;

  const ctl = o.controlTime;
  const bodenNull = s.splitNull.includes("ground");
  const controlTime = ctl
    ? {
        ...ctl,
        ...(bodenNull ? { topSeconds: null, bottomSeconds: null } : {}),
        ...(ohneZone ? { cagePressureSeconds: null, pressedSeconds: null } : {}),
      }
    : ctl;

  return {
    observation: {
      ...o,
      actions,
      dnaSplit: splitNachSteckbrief(o.dnaSplit, sport),
      combos: ohneZone ? (o.combos ?? []).map((c) => ({ ...c, zone: null })) : o.combos,
      defense,
      controlTime,
    },
    verworfen,
  };
}

/** Alle Split-Schlüssel ohne feste Null — für Claudes Split-Satz. */
export function freieSplitSchluessel(sport: Sport | null | undefined): DnaSplitKey[] {
  const nullen = steckbrief(sport)?.splitNull ?? [];
  return DNA_SPLIT_KEYS.filter((k) => !nullen.includes(k));
}
