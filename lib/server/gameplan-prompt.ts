/**
 * Der Gameplan als REINE Rechnung — Voraussetzungen, Prompt, Schema und
 * Normalisierung, ohne Firestore und ohne KI (testbar mit
 * scripts/test-gameplan.mjs, ansehbar ohne Kosten). Den Ablauf mit Firestore
 * und Claude hält lib/server/gameplan.ts; Leons Entscheidungen stehen im Kopf
 * von lib/gameplan.ts.
 */

import { createHash } from "node:crypto";
import { DNA_CATEGORIES, isAnswered, type GegnerDnaAnswers } from "../gegner-dna";
import {
  ACTION_GROUP_META,
  DNA_SPLIT_KEYS,
  DNA_SPLIT_META,
  actionLabel,
  CAGE_ZONE_LABEL,
  type ActionStat,
  type DnaSplit,
} from "../fight-stats";
import {
  begriffe,
  erlaubteTechniken,
  filtereTechnikStats,
  FLAECHE_ORT,
  frageGiltFuer,
  gesperrteGruppen,
  splitNachSteckbrief,
  steckbrief,
  type Flaeche,
} from "../kampfart-steckbrief";
import { SPORT_LABEL, type Sport } from "../video-analysis";
import type { AnswerEvidence, ProfileEvidence } from "../profile-evidence";
import type {
  GameplanDrill,
  GameplanDrillPhase,
  GameplanInhalt,
  GameplanOffen,
  GameplanPunkt,
  GameplanStand,
} from "../gameplan";

/** Ein Profil in der Form, die der Gameplan liest (Athlet und Gegner gleich). */
export interface GameplanProfil {
  dna: GegnerDnaAnswers;
  dnaSplit: DnaSplit | null;
  actionStats: ActionStat[];
  evidence: ProfileEvidence | null;
}

export interface GameplanEingabe {
  sport: Sport;
  /**
   * Fläche des Wettkampfs (Trainer-Wahl oder Vorbelegung der Kampfart,
   * `flaecheDesWettkampfs`). Fehlt sie, schreibt der Gameplan neutral.
   */
  flaeche?: Flaeche | null;
  /**
   * OHNE DATUM (Leon 17.09.2026, Stufe 2 „Kampf verschoben"): Der Gameplan
   * baut auf beiden Profilen auf — Waffen, Gefahren und „So kämpfst du" lesen
   * sich am Kampftag wie vier Wochen davor. Stand das Datum im Auftrag,
   * änderte jede Verschiebung den Fingerabdruck und der nächste Anlass kostete
   * einen Claude-Lauf. Leon: „nein, aber eine Option einfügen, dass man direkt
   * einen neuen erstellen lassen kann" — den Knopf trägt die Wettkampfseite.
   */
  wettkampf: { name: string };
  athlet: { name: string; profil: GameplanProfil | null };
  gegner: {
    name: string;
    profil: GameplanProfil | null;
    /** Stil, Auslage, Maße — als lesbarer Text (Labels aus lib/fight-camp.ts). */
    eckdaten: string[];
    staerken: string[];
    schwaechen: string[];
    lieblingsangriffe: string[];
    notizen: string | null;
    /** true = nur der eingefrorene Stand vom Anlegen des Wettkampfs (kein verknüpftes Profil). */
    nurSnapshot: boolean;
  };
}

const zaehlende = (p: GameplanProfil | null) => p?.evidence?.countedAnalyses ?? 0;

function hatScouting(g: GameplanEingabe["gegner"]): boolean {
  const handAntworten = Object.entries(g.profil?.dna ?? {}).some(
    ([id, v]) => isAnswered(v) && !((g.profil?.evidence?.answers?.[id]?.total ?? 0) > 0),
  );
  return (
    handAntworten ||
    g.staerken.length > 0 ||
    g.schwaechen.length > 0 ||
    g.lieblingsangriffe.length > 0 ||
    !!g.notizen?.trim()
  );
}

/** Was fehlt, damit Claude schreiben kann — null = alles da. */
export function gameplanVoraussetzung(e: GameplanEingabe): GameplanOffen | null {
  if (zaehlende(e.athlet.profil) < 1) return "athlet";
  if (zaehlende(e.gegner.profil) < 1 && !hatScouting(e.gegner)) return "gegner";
  return null;
}

export function gameplanStand(e: GameplanEingabe): GameplanStand {
  return {
    athletAnalysen: zaehlende(e.athlet.profil),
    gegnerAnalysen: zaehlende(e.gegner.profil),
    athletStaerke: e.athlet.profil?.evidence?.staerke ?? 0,
    gegnerStaerke: e.gegner.profil?.evidence?.staerke ?? 0,
    gegnerScouting: hatScouting(e.gegner),
  };
}

// ─── Profil als Text ─────────────────────────────────────────────────────────

function belegDerAntwort(e: AnswerEvidence | undefined): string {
  if (!e || !(e.total > 0)) return "Trainer-Eintrag";
  const fuehrend = e.sides.find((s) => s.key === e.winner);
  const videos = fuehrend?.videos ?? fuehrend?.sources.length ?? 0;
  const gelegenheiten = e.gelegenheiten ?? 0;
  let text =
    gelegenheiten >= videos && gelegenheiten > 0
      ? `${videos} von ${gelegenheiten} Videos`
      : `${videos} ${videos === 1 ? "Video" : "Videos"}`;
  if (e.both) {
    const zweite = e.sides.find((s) => s.key !== e.winner);
    if (zweite) {
      const n = zweite.videos ?? zweite.sources.length;
      text += ` · Gegenstimme in ${n} ${n === 1 ? "Video" : "Videos"}: „${zweite.text}"`;
    }
  }
  return text;
}

function splitText(split: DnaSplit | null, sport: Sport): string | null {
  const s = splitNachSteckbrief(split, sport);
  if (!s) return null;
  const teile = DNA_SPLIT_KEYS.filter((k) => (s[k] ?? 0) > 0).map(
    (k) => `${DNA_SPLIT_META[k].label} ${Math.round(s[k])} %`,
  );
  return teile.length ? teile.join(", ") : null;
}

function technikText(stats: ActionStat[], sport: Sport): string[] {
  return filtereTechnikStats(stats, sport)
    .stats.filter((s) => (s.attempted ?? 0) > 0)
    .sort((a, b) => b.attempted - a.attempted)
    .map((s) => {
      const teile = [`${s.attempted} ${s.attempted === 1 ? "Versuch" : "Versuche"}`, `${s.landed ?? 0} gelungen`];
      if (s.zone) teile.push(`meist ${CAGE_ZONE_LABEL[s.zone]}`);
      if (s.setup?.trim()) teile.push(`Setup: ${s.setup.trim()}`);
      return `- ${actionLabel(s.id)}: ${teile.join(", ")}`;
    });
}

type Seite = "athlet" | "gegner";

function antwortenText(p: GameplanProfil, sport: Sport, seite: Seite): string[] {
  const zeilen: string[] = [];
  for (const kat of DNA_CATEGORIES) {
    const fragen = kat.questions.filter((q) => frageGiltFuer(q.id, sport) && isAnswered(p.dna[q.id]));
    if (!fragen.length) continue;
    zeilen.push(`${kat.label}:`);
    for (const q of fragen) {
      const e = p.evidence?.answers?.[q.id];
      const text = e?.satz?.text?.trim() || p.dna[q.id].trim();
      zeilen.push(`- ${seite === "athlet" ? q.labelDu : q.label} → „${text}" [${belegDerAntwort(e)}]`);
    }
  }
  return zeilen;
}

/**
 * Aus welcher Sicht die Antworten stehen — die Kategorien Exploits, Gameplan
 * und Drills bedeuten beim Athleten „seine eigene Entwicklung", beim Gegner
 * „der Plan gegen ihn" (lib/gegner-dna.ts, labelDu).
 */
const SICHT: Record<Seite, string> = {
  athlet: `Sicht: Die Antworten stehen in der Du-Form an deinen Athleten. Exploits heißt hier „wo Gegner dich treffen könnten", Gameplan und Drills sind seine allgemeinen Trainingsziele — noch nicht auf diesen Gegner bezogen.`,
  gegner: `Sicht: Exploits, Gameplan und Drills sind hier schon als Plan GEGEN diesen Gegner gedacht. Steht ein Profil in der Du-Form, ist es das Profil eines Athleten, der hier als Gegner antritt.`,
};

function profilBlock(p: GameplanProfil | null, sport: Sport, ohneVideos: string, seite: Seite): string {
  if (!p || zaehlende(p) < 1) {
    const hand = p ? antwortenText(p, sport, seite) : [];
    return hand.length ? `${ohneVideos}\nAntworten:\n${hand.join("\n")}` : ohneVideos;
  }
  const ev = p.evidence;
  const kampfarten = ev?.kampfarten?.length ? ev.kampfarten.map((s) => SPORT_LABEL[s]).join(", ") : null;
  const teile = [
    `Profil aus ${zaehlende(p)} ausgewerteten ${zaehlende(p) === 1 ? "Video" : "Videos"}, Profilstärke ${ev?.staerke ?? 0} %${kampfarten ? ` (Videos aus: ${kampfarten})` : ""}.`,
  ];
  const split = splitText(p.dnaSplit, sport);
  if (split) teile.push(`Anteil der Kampfbereiche: ${split}.`);
  const technik = technikText(p.actionStats, sport);
  if (technik.length) teile.push(`Techniken (über alle Videos gezählt):\n${technik.join("\n")}`);
  const antworten = antwortenText(p, sport, seite);
  if (antworten.length) teile.push(`Antworten (Frage → Antwort [Beleg]):\n${SICHT[seite]}\n${antworten.join("\n")}`);
  return teile.join("\n");
}

const FLAECHE_AKK: Record<Flaeche, string> = { kaefig: "den Käfig", ring: "den Ring", matte: "die Matte" };

/**
 * Der Flächen-Satz (Leon 17.09.2026: Fläche am Wettkampf, vorbelegt aus der
 * Kampfart). Die Videos eines Profils laufen oft auf einer anderen Fläche
 * (Gym-Sparring auf der Matte, der Gegner im Käfig) — ihre Rand-Muster gelten
 * auch am Wettkampf, erfundene Käfig-Zahlen nicht. Nachweis 17.09.: Ohne den
 * Hinweis „nicht zitieren" schrieb Claude die Anweisung wörtlich in lage.
 */
function flaechenSatz(e: GameplanEingabe, flaeche: Flaeche | null): string {
  if (!flaeche) {
    return `Die Kampffläche des Wettkampfs ist unbekannt: Schreib neutral „Mitte" und „am Rand", nie „Käfig", „Cage" oder „Seile".`;
  }
  const b = begriffe(e.sport, flaeche);
  const verboten: Record<Flaeche, string> = {
    kaefig: `„Seile"`,
    ring: `„Käfig", „Cage" und „Zaun"`,
    matte: `„Käfig", „Cage", „Zaun" und „Seile"`,
  };
  const anders = (
    [
      ["deines Athleten", e.athlet.profil?.evidence?.flaeche],
      [e.gegner.name, e.gegner.profil?.evidence?.flaeche],
    ] as const
  )
    .filter(([, f]) => f && f !== flaeche)
    .map(([wer, f]) => `Die Videos ${wer === "deines Athleten" ? wer : `von ${wer}`} zeigen ${FLAECHE_AKK[f!]}.`);
  const uebertrag = anders.length
    ? ` ${anders.join(" ")} Was diese Profile über Mitte und Rand zeigen, überträgst du still auf ${FLAECHE_AKK[flaeche]} — ohne diesen Satz zu zitieren. Zahlen, die kein Profil nennt, erfindest du nicht.`
    : "";
  return `FLÄCHE: Gekämpft wird ${FLAECHE_ORT[flaeche]} (Angabe des Trainers). Mitte heißt „${b.mitte}", Rand „${b.rand}". ${verboten[flaeche]} schreibst du nie.${uebertrag}`;
}

function kampfartText(e: GameplanEingabe, flaeche: Flaeche | null): string {
  const sport = e.sport;
  const b = begriffe(sport, flaeche);
  const erlaubt = erlaubteTechniken(sport).map((id) => actionLabel(id)).join(", ");
  const gesperrt = gesperrteGruppen(sport).map((g) => ACTION_GROUP_META[g].label);
  const phasen = [b.phaseStand, b.phaseKontakt, b.phaseBoden].filter(Boolean).join(" / ");
  return [
    `KAMPFART: ${SPORT_LABEL[sport]}. Phasen: ${phasen}. Fachwörter, die passen: ${b.wortschatz.join(", ")}.`,
    `Techniken, die in dieser Kampfart zählen: ${erlaubt}.${gesperrt.length ? ` Gesperrt: ${gesperrt.join(", ")} — nie als Waffe, Gefahr oder Drill.` : ""}`,
    flaechenSatz(e, flaeche),
  ].join("\n");
}

// ─── Prompt ──────────────────────────────────────────────────────────────────

const REGELN = `Grundregeln:
- NUR MIT BELEG: Jeder Punkt stützt sich auf mindestens eine Angabe aus den Profilen unten. Was die Profile nicht hergeben, schreibst du nicht.
- BELEG KURZ (Leon 17.09.2026: „Belege kürzer"): Das Feld beleg ist eine Kurzform, kein Satz — höchstens zwei Angaben, getrennt durch „ · ", zusammen unter 70 Zeichen. Beispiele: „Du: Hook 12 Versuche, 50 %", „Gegner: Double Leg 6 von 9", „Du: 4 von 5 Videos · Scouting-Notiz". Keine Zeitstempel, keine Klammern, kein „(1 von 1 Videos)", keine Erklärung — die steht im text.
- DUELL STATT LISTE: Die stärksten Punkte verbinden beide Profile — eine Stärke deines Athleten trifft eine Lücke des Gegners, eine Waffe des Gegners trifft eine Baustelle deines Athleten. Ein Punkt aus nur einem Profil geht, wenn er den Kampf klar prägt.
- NUR WAS VORKAM: Fehlt eine Phase oder Technik in einem Profil (0 Versuche, keine Antwort), ist das kein Befund — weder Lücke noch Waffe. Nur lage nennt einmal knapp, was die Profile nicht abdecken.
- ZAHLEN ehrlich nach Menge: Unter 5 Versuchen nennst du nur die Zählung als Tatsache — keine Quote, keinen Bruch wie „2 von 3" und KEIN Urteil aus Treffern oder Fehlschlägen („2 Versuche ohne Treffer, bringt wenig" schreibst du nie). Was eine Antwort über die AUSFÜHRUNG sagt, darfst du auch bei wenigen Versuchen nutzen. Von 5 bis 9 Versuchen nur als Bruch („3 von 5"), ab 10 Prozent, ab 20 mit Bandbreite („etwa 40–60 %").
- BELASTBARKEIT: Trägt ein Profil nur 1–2 Videos oder eine Profilstärke unter 30 %, sagst du das in lage und schreibst weniger, vorsichtigere Punkte („erste Tendenz").
- Handeinträge und Scouting-Notizen des Trainers sind Einschätzungen, keine Zählungen — nutze sie und kennzeichne sie im beleg („Scouting-Notiz", „Trainer-Eintrag").
- SPRACHE: Du schreibst an deinen Athleten, in der Du-Form. Kurze aktive Sätze, sportlich und konkret, Fachbegriffe erwünscht; kein Passiv, keine JSON-Feldnamen, keine Frage-IDs.
- DER GEGNER HAT KEIN PRONOMEN (Leon 17.09.2026): Nenne ihn beim Namen oder „dein Gegner" — in JEDEM Satz, auch im zweiten Satz desselben Punkts und in Titeln. Nie „er", „sie", „ihn", „ihm", „ihr", „sein", „seine", „seinen". Statt „dort schlägt er ein" → „dort schlägt dein Gegner ein"; statt „seine Hände sinken" → „die Hände deines Gegners sinken"; statt „Sein Cross aus dem Konter" → „Cross aus dem Konter". Die Profile unten schreiben den Gegner teils mit „er" — übernimm das nie.
- UMFANG: waffen, gefahren und soKaempfstDu je 2–4 Punkte, weniger bei dünnen Belegen; titel höchstens 6 Wörter, text 1–2 Sätze. drills 2–6, jeder mit phase "specific-prep" (gegnerspezifische Vorbereitung: Technik und Muster) oder "sparring-simulation" (Sparring und Kampfsimulation gegen genau dieses Muster); wofuer ist der titel des Punkts, auf den der Drill einzahlt.`;

export function gameplanPrompt(e: GameplanEingabe): { system: string; user: string } {
  const rolle = steckbrief(e.sport)?.rolle ?? "Kampfsport-Cheftrainer";
  const system = `Du bist ein erfahrener ${rolle} und stellst den Gameplan für einen Wettkampf auf: dein Athlet gegen genau diesen Gegner. Du bekommst zwei DeepFight-Profile, gerechnet aus ausgewerteten Videos und Scouting-Notizen des Trainers.

${REGELN}`;

  const g = e.gegner;
  const scouting = [
    ...g.eckdaten,
    g.staerken.length ? `Stärken (Scouting-Notiz): ${g.staerken.join(", ")}` : "",
    g.schwaechen.length ? `Schwächen (Scouting-Notiz): ${g.schwaechen.join(", ")}` : "",
    g.lieblingsangriffe.length ? `Lieblingsangriffe (Scouting-Notiz): ${g.lieblingsangriffe.join(", ")}` : "",
    g.notizen?.trim() ? `Notiz des Trainers: „${g.notizen.trim()}"` : "",
  ].filter(Boolean);

  const user = `WETTKAMPF: „${e.wettkampf.name}".
${kampfartText(e, e.flaeche ?? null)}

ATHLET — ${e.athlet.name} (Profil der Kampfart ${SPORT_LABEL[e.sport]}):
${profilBlock(e.athlet.profil, e.sport, "Noch kein ausgewertetes Video in dieser Kampfart.", "athlet")}

GEGNER — ${g.name}${g.nurSnapshot ? " (Stand beim Anlegen des Wettkampfs)" : ""}:
${scouting.length ? `${scouting.join("\n")}\n` : ""}${profilBlock(g.profil, e.sport, "Kein ausgewertetes Video — nur Scouting des Trainers.", "gegner")}

Schreib jetzt den Gameplan als JSON gemäß Schema.`;
  return { system, user };
}

/**
 * Fingerabdruck der Eingabe: Gleiche Profile und gleicher Wettkampf ergeben
 * denselben Schlüssel — dann spart der Nachlauf den Aufruf. Das KAMPFDATUM
 * steckt bewusst nicht darin (siehe `GameplanEingabe.wettkampf`): Verschieben
 * soll nichts kosten.
 */
export function gameplanSchluessel(p: { system: string; user: string }): string {
  return createHash("sha256").update(p.system).update("\n").update(p.user).digest("hex").slice(0, 32);
}

// ─── Schema und Normalisierung ───────────────────────────────────────────────

const str = { type: "string" } as const;
const punkt = {
  type: "object",
  properties: { titel: str, text: str, beleg: str },
  required: ["titel", "text", "beleg"],
  additionalProperties: false,
} as const;

export const GAMEPLAN_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    lage: str,
    waffen: { type: "array", items: punkt },
    gefahren: { type: "array", items: punkt },
    soKaempfstDu: { type: "array", items: punkt },
    drills: {
      type: "array",
      items: {
        type: "object",
        properties: {
          phase: { type: "string", enum: ["specific-prep", "sparring-simulation"] },
          titel: str,
          text: str,
          wofuer: str,
        },
        required: ["phase", "titel", "text", "wofuer"],
        additionalProperties: false,
      },
    },
  },
  required: ["lage", "waffen", "gefahren", "soKaempfstDu", "drills"],
  additionalProperties: false,
};

const text = (x: unknown) => (typeof x === "string" ? x.trim() : "");

function punkte(raw: unknown): GameplanPunkt[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => ({ titel: text(p?.titel), text: text(p?.text), beleg: text(p?.beleg) }))
    .filter((p) => p.titel && p.text)
    .slice(0, 4);
}

const DRILL_PHASEN: GameplanDrillPhase[] = ["specific-prep", "sparring-simulation"];

export function normalisiereGameplan(raw: unknown): GameplanInhalt {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const drills: GameplanDrill[] = Array.isArray(r.drills)
    ? r.drills
        .map((d) => ({
          phase: d?.phase as GameplanDrillPhase,
          titel: text(d?.titel),
          text: text(d?.text),
          wofuer: text(d?.wofuer),
        }))
        .filter((d) => DRILL_PHASEN.includes(d.phase) && d.titel && d.text)
        .slice(0, 6)
    : [];
  return {
    lage: text(r.lage),
    waffen: punkte(r.waffen),
    gefahren: punkte(r.gefahren),
    soKaempfstDu: punkte(r.soKaempfstDu),
    drills,
  };
}

export function gameplanLeer(i: GameplanInhalt): boolean {
  return i.waffen.length + i.gefahren.length + i.soKaempfstDu.length === 0;
}
