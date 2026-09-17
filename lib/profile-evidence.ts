/**
 * Profil-Rechnung — das Profil als ABLEITUNG aus allen Analysen.
 *
 * ─── WARUM ES DIESE DATEI GIBT ──────────────────────────────────────────────
 *
 * Leon 14.09.2026: „Analyse fertig = Profil aktualisiert." Niemand klickt
 * mehr Befunde ins Profil. Dann muss eine REGEL entscheiden, was gilt, wenn
 * Videos einander widersprechen — und die Regel muss jederzeit neu laufen
 * können: nach einem Löschen (Markieren), nach einer Neuzuordnung, nach
 * einem Doppel-Upload, mit dem Altern der Videos. Deshalb rechnet diese
 * Datei das Profil IMMER aus ALLEN Analysen, nie inkrementell. Sie ist rein:
 * kein Firestore, kein React, kein Netz — dieselbe Eingabe ergibt dieselbe
 * Ausgabe, und `scripts/test-profil-rechnung.mjs` prüft sie gegen die
 * durchgerechneten Beispiele der Gegenprobe.
 *
 * Gerufen wird sie NUR serverseitig (`lib/server/profile-recompute.ts`,
 * Admin-SDK). Der Client liest das Ergebnis; die Firestore-Regeln lassen
 * ihn die abgeleiteten Felder nicht schreiben.
 *
 * ─── DIE REGELN (Gegenprobe 14.09., 10 Agenten; Leons Entscheidungen) ─────
 *
 * GEWICHT einer Analyse: w = Zeitraum × Art (lib/video-analysis.ts). Die
 * Kämpfer-Sicherheit ist ein TOR: zu → die Analyse zählt nicht (auch nicht
 * ein bisschen). `wrongFighter` ist dasselbe Tor, nur von Hand.
 *
 * TEXTE — das Tauziehen je Frage-ID:
 *   • Jeder Befund zieht mit w an der Seite seines `sideKey`. Eine
 *     Bestätigung („confirms") zieht mit w an der Seite, die zum Zeitpunkt
 *     der Analyse die jüngste Antwort war — aber NUR mit Beleg (Timestamp).
 *     Modelle bestätigen Vorgaben bereitwillig; ohne Beleg wiegt es nichts.
 *   • Vorhandener Profil-Text ohne Analyse dahinter (Handeingabe, Bestand)
 *     ist die Seite `manual` mit Gewicht 0. Sie steht, bis eine Seite mit
 *     Gewicht gewinnt — und bekommt Gewicht, wenn ein Video sie bestätigt.
 *   • KIPP-REGEL: Die JÜNGSTEN Quellen entscheiden, sobald sie zusammen
 *     ≥ 1,0 wiegen: Innerhalb dieser Menge gewinnt die Seite mit dem
 *     meisten Gewicht. Erreichen alle Quellen zusammen keine 1,0, gilt die
 *     Mehrheit über alles. Daraus folgt von selbst: Ein Ausschnitt (0,7)
 *     oder ein Sparring (0,6) kippt allein nie eine Antwort, die auf 1,0
 *     steht; zwei zusammen ja; Clips (0,3, je Antwort gedeckelt 0,6) nie.
 *   • WIEDERHOLUNGS-REGEL (Leon 17.09.2026): Eine Antwort, die in mindestens
 *     ZWEI Videos steht, wechselt erst, wenn die neue Aussage ebenfalls in
 *     zwei Videos steht. Leons Einwand: „du hast 15 Analysen, und er zeigt in
 *     EINER etwas anderes — dann wäre unsere Aussage einfach falsch." Ohne
 *     diese Regel kippte ein einziger aktueller ganzer Kampf (1,0) jede
 *     Antwort, auch gegen 14 ältere Videos. Gezählt werden Videos, nicht
 *     Gewichte — eine Wiederholung ist eine Wiederholung.
 *   • GLEICHSTAND deterministisch: mehr Video-Masse → jüngere Quelle →
 *     beide nennen.
 *   • „BEIDES" (Leon: „kann ja sein, dass jemand beides macht, rechts und
 *     links"): Sobald die zweite Seite ≥ die Hälfte der ersten wiegt, nennt
 *     der Text beide. Den Satz dazu schreibt Claude
 *     (`lib/server/satzschreiber.ts`); `answerText` ist der Rückfall.
 *   • HIGHLIGHT liefert nur Text, und nur in den Kategorien Waffen und
 *     Entries (Finish gehört zu den Waffen). Alle Clips zusammen wiegen je
 *     Antwort höchstens 0,6.
 *
 * WIE OFT GESEHEN (Leon 17.09.2026): Jede Seite weiß, in wie vielen Videos
 *   sie steht (`videos`), jede Antwort, in wie vielen zählenden Videos die
 *   Frage überhaupt beantwortbar war (`gelegenheiten`). Daraus wird der
 *   ehrliche Satz „in 1 von 15 Videos" statt „Neu".
 *
 * ZAHLEN (actionStats): ungewichtete Summen — „14/30" ist eine Zählung, der
 *   ein Trainer traut; „9,6/19" nicht. Nur aus ganzem Kampf und Ausschnitt,
 *   nicht älter als 3 Jahre. Sparring zählt NUR beim eigenen Athleten (beim
 *   Gegner ist es eine andere Population). Highlight nie (zeigt nur Treffer).
 *
 * SPLIT: gewichteter Mittelwert über ein FENSTER der fünf jüngsten Kämpfe
 *   (ganzer Kampf oder Ausschnitt). Jeder Kampf bewegt rund ein Fünftel und
 *   fällt von selbst heraus — kein Altbestand, der ewig nachzieht.
 *
 * PROFILSTÄRKE (Leon 17.09.2026: „sollte aussagen, wie stark der Athlet
 *   ausgewertet wurde — 100 % braucht so viele Analysen, dass man fast
 *   garantieren kann, wofür DeepFight steht"): je Frage mit Beleg
 *   min(1, Gewicht der führenden Seite / 3,0) × (führend / alle Seiten);
 *   die Profilstärke ist der Durchschnitt. 3,0 = drei aktuelle ganze Kämpfe
 *   oder fünf Sparrings, die dasselbe zeigen. Widerspruch senkt: Orthodox in
 *   drei Kämpfen, Southpaw in zwei → diese Frage zählt zu 60 %.
 *
 * NUR WAS VORKAM (Etappe 2, Leon 16.09.): Ein Video beantwortet nur Fragen
 *   zu dem, was in ihm passiert ist. Eine reine Boxrunde aus dem
 *   MMA-Training stärkt die Schlagfragen und lässt die Takedown-Fragen
 *   unberührt — weder Befund noch Bestätigung. Das Signal kommt aus Stufe 1
 *   (Split, Zähler, Kontrollzeiten, Zonen); `SIGNAL_JE_FRAGE` sagt, welche
 *   Frage welches Signal braucht. Fehlt JEDES Signal (Bestand ohne Split
 *   und Zähler), bleibt alles offen wie bisher — ein unbekanntes Video ist
 *   kein leeres Video. Dasselbe Muster wie `HIGHLIGHT_KATEGORIEN`, nur je
 *   Frage statt je Kategorie.
 *
 * NUR WAS IN DER KAMPFART GILT (Kampfart-Steckbriefe, Leon 17.09.2026,
 *   lib/kampfart-steckbrief.ts): Vor den Signalen läuft die Beobachtung
 *   durch `filtereBeobachtung` (ein „2 Takedowns abgewehrt" im Kickboxen
 *   setzt kein Takedown-Signal mehr), eine gesperrte Frage (`frageGiltFuer`)
 *   bekommt weder Befund noch Bestätigung noch Gelegenheit, Zähler und Split
 *   laufen durch `filtereTechnikStats` und `splitNachSteckbrief`. Weil das
 *   Profil immer aus ALLEN Analysen rechnet, gilt das auch rückwirkend.
 *
 * DIE FIGHT-DNA ÜBER MEHRERE KAMPFARTEN (Etappe 3, Leon 16.09.): Das
 *   Gesamtprofil ist keine vierte Rechnung, sondern die ZUSAMMENSTELLUNG der
 *   Profile je Kampfart (`stelleZusammen`). Gleiche Aussage in allen
 *   Kampfarten → ein Satz; verschiedene → beide mit Kampfart („im MMA die
 *   Außendistanz, im Sambo die Griffdistanz"). Zahlen je Technik addiert —
 *   einen Zähler gibt es wegen „nur was vorkam" ohnehin nur dort, wo die
 *   Technik passiert ist.
 *
 * WIRKUNG EINER ANALYSE (Etappe 3, Leon 17.09.): Was ein Video am Profil
 *   bewegt hat, beschreibt den BELEG, nie eine Tatsache über den Athleten —
 *   „Erstmals gesehen", „Bestätigt, in 4 von 5 Videos", „Anders als
 *   bisher", „Profil angepasst" (`wirkungDerAnalyse`).
 */

import {
  ACTION_CATALOG,
  cleanActionStats,
  cleanDnaSplit,
  DNA_SPLIT_KEYS,
  isDnaSplitEmpty,
  type ActionStat,
  type CageZone,
  type DnaSplit,
  type DnaSplitKey,
} from "./fight-stats";
import { DNA_CATEGORIES, pruneAnswers, type GegnerDnaAnswers } from "./gegner-dna";
import {
  SIGNALE_JE_GRUPPE,
  SIGNAL_JE_FRAGE,
  filtereBeobachtung,
  filtereTechnikStats,
  frageGiltFuer,
  splitNachSteckbrief,
  type Flaeche,
  type Signal,
} from "./kampfart-steckbrief";
import {
  FIGHT_RECENCY_RANK,
  SPORT_KURZ,
  SPORT_ORDER,
  isSport,
  type AnalysisMode,
  type Sport,
  type VideoAnalysis,
  type VideoObservation,
  type VideoType,
} from "./video-analysis";

// ─── Konstanten der Regel ────────────────────────────────────────────────────

/** Ab dieser Gewichtssumme entscheiden die jüngsten Quellen allein. */
export const KIPP_SCHWELLE = 1.0;
/** Zweite Seite ab diesem Anteil der ersten: „beides" im Text. */
export const BEIDES_ANTEIL = 0.5;
/** Alle Highlight-Clips zusammen je Antwort höchstens so viel. */
export const HIGHLIGHT_DECKEL = 0.6;
/** Kategorien, in denen ein Highlight überhaupt Text beitragen darf. */
export const HIGHLIGHT_KATEGORIEN: ReadonlySet<string> = new Set([
  "preferred-weapons",
  "entry-patterns",
]);
/** Wie viele Kämpfe der Split im Fenster hält. */
export const SPLIT_FENSTER = 5;
/**
 * Gewicht, ab dem EINE Frage als gesichert gilt (drei aktuelle ganze Kämpfe
 * oder fünf Sparrings) — Maßstab der Profilstärke.
 */
export const EVIDENCE_FULL = 3.0;
/** Wiederholungs-Regel: So viele Videos braucht eine Seite, um zu halten oder zu kippen. */
export const WIEDERHOLUNG = 2;
/** Unter so vielen Versuchen nennt der Bericht keine Zahl (Stresstest 16.09.: „Cross 0/2 = Schwäche"). */
export const ZAHLEN_MINDESTVERSUCHE = 5;
/** Seite für Profil-Text ohne Analyse dahinter. */
export const MANUAL_SIDE = "manual";

const ZAHLEN_ARTEN_GEGNER = new Set<VideoType>(["full", "excerpt"]);
const ZAHLEN_ARTEN_ATHLET = new Set<VideoType>(["full", "excerpt", "sparring"]);
const SPLIT_ARTEN = new Set<VideoType>(["full", "excerpt"]);
/** Höchstens so viele Fassungen je Seite gehen an den Satzschreiber. */
const TEXTE_JE_SEITE = 4;

/** Alle Fragen des Katalogs mit ihrer Kategorie. */
const ALLE_FRAGEN: { id: string; kategorie: string }[] = DNA_CATEGORIES.flatMap((c) =>
  c.questions.map((q) => ({ id: q.id, kategorie: c.id })),
);

// ─── Nur was vorkam ──────────────────────────────────────────────────────────

// Signal und SIGNAL_JE_FRAGE wohnen seit den Kampfart-Steckbriefen
// (17.09.2026) in lib/kampfart-steckbrief.ts — Fragen und Signale wachsen
// dort an EINER Stelle. Re-Export für bestehende Aufrufer.
export type { Signal };
export { SIGNAL_JE_FRAGE };

const GRUPPE_JE_AKTION = new Map(ACTION_CATALOG.map((a) => [a.id, a.group] as const));

/**
 * Die Signale eines Videos aus Stufe 1 — oder null, wenn die Beobachtung
 * gar nichts hergibt (kein Split, keine Zähler, keine Zeiten): Dann ist das
 * Video unbekannt, nicht leer, und nichts wird gesperrt.
 */
export function beobachteteSignale(o: VideoObservation | undefined): Set<Signal> | null {
  if (!o) return null;
  const split = o.dnaSplit && !isDnaSplitEmpty(o.dnaSplit) ? cleanDnaSplit(o.dnaSplit) : null;
  const actions = (o.actions ?? []).filter((a) => (a.attempted ?? 0) > 0 || (a.landed ?? 0) > 0);
  const def = o.defense ?? ({} as VideoObservation["defense"]);
  const ctl = o.controlTime;
  const n = (x: number | null | undefined) => (typeof x === "number" && x > 0 ? x : 0);
  const zonen = [...actions, ...(o.combos ?? [])].some((a) => a.zone === "cage");

  const wackler = (def?.rockedMoments ?? []).length > 0 || n(def?.knockdownsReceived) > 0;

  const irgendwas =
    !!split ||
    actions.length > 0 ||
    wackler ||
    n(def?.takedownsAgainst) + n(def?.takedownsDefended) + n(def?.strikesAgainst) + n(def?.strikesAvoided) > 0 ||
    (!!ctl && n(ctl.clinchSeconds) + n(ctl.topSeconds) + n(ctl.bottomSeconds) + n(ctl.cagePressureSeconds) + n(ctl.pressedSeconds) > 0);
  if (!irgendwas) return null;

  const s = new Set<Signal>();
  // Jede gezählte Technik setzt die Signale ihrer Gruppe (SIGNALE_JE_GRUPPE).
  for (const a of actions) {
    const g = GRUPPE_JE_AKTION.get(a.id);
    if (g) for (const sig of SIGNALE_JE_GRUPPE[g]) s.add(sig);
  }
  if ((split?.boxing ?? 0) > 0 || n(def?.strikesAgainst) + n(def?.strikesAvoided) > 0) s.add("strikes");
  if ((split?.kicking ?? 0) > 0) { s.add("kicks"); s.add("strikes"); }
  if ((split?.wrestling ?? 0) > 0 || n(def?.takedownsAgainst) + n(def?.takedownsDefended) > 0) s.add("takedowns");
  if ((split?.ground ?? 0) > 0 || n(ctl?.topSeconds) + n(ctl?.bottomSeconds) > 0) s.add("ground");
  if (n(ctl?.topSeconds) > 0) s.add("ground-top");
  if (n(ctl?.bottomSeconds) > 0) s.add("ground-bottom");
  if ((split?.clinch ?? 0) > 0 || n(ctl?.clinchSeconds) > 0) s.add("clinch");
  if (zonen || n(ctl?.cagePressureSeconds) + n(ctl?.pressedSeconds) > 0) s.add("cage");
  if (wackler) s.add("rocked");
  if (n(def?.strikesAgainst) + n(def?.takedownsAgainst) > 0) s.add("attacked");
  return s;
}

/** Darf dieses Video diese Frage beantworten? */
export function frageOffen(questionId: string, signale: Set<Signal> | null): boolean {
  const noetig = SIGNAL_JE_FRAGE[questionId];
  if (!noetig || signale === null) return true;
  return signale.has(noetig);
}

// ─── Ergebnis-Typen (so stehen sie im Profil-Dokument) ──────────────────────

/** Ein Beitrag zu einer Seite: eine Analyse, ein Gewicht. */
export interface EvidenceSource {
  analysisId: string;
  weight: number;
  kind: "finding" | "confirm";
  videoType: VideoType;
}

/** Eine Seite im Tauziehen um eine Frage. */
export interface AnswerSide {
  key: string;
  /** Gewichtssumme dieser Seite. */
  weight: number;
  /** Der Text, der diese Seite vertritt (die jüngste Fassung). */
  text: string;
  /** Alle Fassungen dieser Seite, jüngste zuerst (Stoff für den Satzschreiber). */
  texte?: string[];
  /** In wie vielen verschiedenen Videos steht diese Seite? */
  videos?: number;
  sources: EvidenceSource[];
}

/** Eine Kampfart mit eigener Aussage — nur im Gesamtprofil, wenn die Kampfarten sich unterscheiden. */
export interface KampfartAntwort {
  /** null = Analysen ohne Kampfart (Bestand vor Etappe 2). */
  sport: Sport | null;
  winner: string;
  text: string;
  weight: number;
  videos: number;
}

/** Der geschriebene Satz einer Antwort — von Claude, mit dem Schlüssel seiner Eingabe. */
export interface AnswerSatz {
  text: string;
  /** Fingerabdruck der Eingabe; gleicher Schlüssel = Satz wiederverwenden. */
  schluessel: string;
}

/** Stand einer Frage nach der Rechnung. */
export interface AnswerEvidence {
  /** Schlüssel der führenden Seite (`manual`, wenn nur Bestand da ist). */
  winner: string;
  /** Zweite Seite wird mitgenannt. */
  both: boolean;
  /** Gewichtssumme aller Seiten. */
  total: number;
  /** In wie vielen zählenden Videos war die Frage beantwortbar? */
  gelegenheiten?: number;
  /** Nur im Gesamtprofil: die Kampfarten sagen Verschiedenes. */
  kampfarten?: KampfartAntwort[];
  /** Claudes Satz (`lib/server/satzschreiber.ts`); fehlt er, gilt `answerText`. */
  satz?: AnswerSatz;
  /** Claude konnte den Satz noch nicht schreiben — beim nächsten Lauf nachholen. */
  satzOffen?: boolean;
  /** Seiten, die führende zuerst. */
  sides: AnswerSide[];
}

/** Ein Kampf im Split-Fenster. */
export interface SplitWindowEntry {
  analysisId: string;
  weight: number;
}

/** Alles Abgeleitete, das neben den Antworten im Profil liegt. */
export interface ProfileEvidence {
  answers: Record<string, AnswerEvidence>;
  splitWindow: SplitWindowEntry[];
  /** Summe der Gewichte aller zählenden Analysen. */
  evidenceTotal: number;
  /** Profilstärke 0–100 (siehe Kopf). */
  staerke?: number;
  /** Kampfarten mit zählenden Analysen, in SPORT_ORDER. */
  kampfarten?: Sport[];
  /**
   * Die Fläche, auf der das Profil entstanden ist (Leon 17.09.2026:
   * Käfig-Wörter nur, wenn im Video ein Käfig zu sehen ist) — die häufigste
   * der zählenden Analysen, null ohne Angabe. Bestimmt Zonen-Wörter und
   * Kartenform der Profilansicht.
   */
  flaeche?: Flaeche | null;
  /** Zählende Analysen (Tor offen, nicht markiert). */
  countedAnalyses: number;
  /** Alle gespeicherten Analysen, auch markierte. */
  totalAnalyses: number;
  /** Analysen, deren Zahlen in die Zähltabelle laufen. */
  numbersFrom: string[];
  computedAt: string;
}

export interface ComputedProfile {
  dna: GegnerDnaAnswers;
  dnaSplit: DnaSplit | null;
  dnaSplitWeight: number;
  actionStats: ActionStat[];
  evidence: ProfileEvidence;
}

export interface ExistingProfile {
  dna: GegnerDnaAnswers;
}

// ─── Profilstärke ────────────────────────────────────────────────────────────

/** Wie gesichert ist EINE Antwort? 0–1 (siehe Kopf, PROFILSTÄRKE). */
export function antwortSicherheit(e: AnswerEvidence): number {
  if (!(e.total > 0)) return 0;
  const stuetze = e.kampfarten?.length
    ? e.kampfarten.reduce((n, k) => n + k.weight, 0)
    : (e.sides.find((s) => s.key === e.winner)?.weight ?? 0);
  return Math.min(1, stuetze / EVIDENCE_FULL) * Math.min(1, stuetze / e.total);
}

/**
 * Profilstärke 0–100 — der Durchschnitt über alle Antworten MIT Beleg.
 * Handtext ohne Video zählt nicht mit: Er ist keine Auswertung.
 */
export function profilStaerke(answers: Record<string, AnswerEvidence> | undefined | null): number {
  const mitBeleg = Object.values(answers ?? {}).filter((e) => e.total > 0);
  if (mitBeleg.length === 0) return 0;
  const summe = mitBeleg.reduce((n, e) => n + antwortSicherheit(e), 0);
  return Math.round((summe / mitBeleg.length) * 100);
}

// ─── Reihenfolge „jünger zuerst" ─────────────────────────────────────────────

/**
 * Jünger heißt: bekannter Kampfmonat vor Zeitraum-Stufe vor Speicherdatum.
 * Ein Video mit Monat schlägt eines ohne, wenn der Monat in dieselbe oder
 * eine jüngere Stufe fällt — sonst zählt die Stufe. Bei gleicher Stufe
 * entscheidet, was zuletzt gespeichert wurde (spätere Sicht = frischer).
 */
export function compareNewestFirst(a: VideoAnalysis, b: VideoAnalysis): number {
  const ra = FIGHT_RECENCY_RANK[a.recency];
  const rb = FIGHT_RECENCY_RANK[b.recency];
  if (ra !== rb) return ra - rb;
  if (a.fightMonth && b.fightMonth && a.fightMonth !== b.fightMonth)
    return a.fightMonth < b.fightMonth ? 1 : -1;
  return b.createdAt.getTime() - a.createdAt.getTime();
}

function counts(a: VideoAnalysis): boolean {
  return !a.wrongFighter && a.weight.identified && a.weight.value > 0;
}

// ─── Texte: das Tauziehen ────────────────────────────────────────────────────

/** Die Beobachtung einer Analyse, wie sie in ihrer Kampfart gelesen wird. */
function sichtInDerKampfart(a: VideoAnalysis): VideoObservation | undefined {
  if (!a.observation) return undefined;
  return filtereBeobachtung(a.observation, a.sport, a.variante).observation;
}

/** Die Zähler einer Analyse ohne das, was in ihrer Kampfart nicht zählt. */
function zahlenInDerKampfart(a: VideoAnalysis): ActionStat[] {
  return filtereTechnikStats(a.evaluation.actionStats, a.sport, a.variante).stats;
}

interface Pull {
  side: string;
  text: string;
  weight: number;
  source: EvidenceSource;
  /** Position in der Jünger-zuerst-Reihe (0 = jüngste). */
  order: number;
}

/**
 * Sammelt je Frage alle Züge — Befunde UND belegte Bestätigungen — und
 * kappt die Highlight-Clips je Antwort. Zählt nebenbei, in wie vielen
 * Videos jede Frage überhaupt beantwortbar war.
 */
function collectPulls(
  sorted: VideoAnalysis[],
  existing: GegnerDnaAnswers,
): { pulls: Map<string, Pull[]>; gelegenheiten: Map<string, number> } {
  const byQuestion = new Map<string, Pull[]>();
  const gelegenheiten = new Map<string, number>();
  const push = (q: string, p: Pull) => {
    const list = byQuestion.get(q) ?? [];
    list.push(p);
    byQuestion.set(q, list);
  };

  // Ältestes zuerst durchgehen: Eine Bestätigung bezieht sich auf das, was
  // VOR ihr die jüngste Antwort war.
  const oldestFirst = [...sorted].reverse();
  const latestSide = new Map<string, { side: string; text: string }>();
  for (const a of oldestFirst) {
    const order = sorted.indexOf(a);
    const w = a.weight.value;
    const isHighlight = a.videoType === "highlight";
    // Nur was vorkam: einmal je Video gerechnet, gilt für Befunde UND
    // Bestätigungen — ein Video ohne Takedowns bestätigt auch keinen. Die
    // Signale kommen aus der Beobachtung, wie sie in der Kampfart gilt.
    const signale = beobachteteSignale(sichtInDerKampfart(a));
    for (const f of ALLE_FRAGEN) {
      if (isHighlight && !HIGHLIGHT_KATEGORIEN.has(f.kategorie)) continue;
      if (!frageGiltFuer(f.id, a.sport)) continue;
      if (!frageOffen(f.id, signale)) continue;
      gelegenheiten.set(f.id, (gelegenheiten.get(f.id) ?? 0) + 1);
    }
    for (const f of a.evaluation.findings) {
      if (!f.questionId || !f.answer.trim()) continue;
      if (isHighlight && !HIGHLIGHT_KATEGORIEN.has(f.categoryId)) continue;
      if (!frageGiltFuer(f.questionId, a.sport)) continue;
      if (!frageOffen(f.questionId, signale)) continue;
      push(f.questionId, {
        side: f.sideKey,
        text: f.answer.trim(),
        weight: w,
        source: { analysisId: a.id, weight: w, kind: "finding", videoType: a.videoType },
        order,
      });
      latestSide.set(f.questionId, { side: f.sideKey, text: f.answer.trim() });
    }
    for (const c of a.evaluation.merge.confirms) {
      if (!c.questionId || c.evidence.length === 0) continue;
      if (isHighlight) continue; // ein Clip bestätigt nichts mit Gewicht
      if (!frageGiltFuer(c.questionId, a.sport)) continue;
      if (!frageOffen(c.questionId, signale)) continue;
      const target =
        latestSide.get(c.questionId) ??
        (existing[c.questionId]?.trim()
          ? { side: MANUAL_SIDE, text: existing[c.questionId].trim() }
          : null);
      if (!target) continue;
      push(c.questionId, {
        side: target.side,
        text: target.text,
        weight: w,
        source: { analysisId: a.id, weight: w, kind: "confirm", videoType: a.videoType },
        order,
      });
    }
  }

  // Highlight-Deckel: alle Clips zusammen je Antwort ≤ 0,6.
  for (const pulls of Array.from(byQuestion.values())) {
    const clips = pulls.filter((p) => p.source.videoType === "highlight");
    const sum = clips.reduce((n, p) => n + p.weight, 0);
    if (sum > HIGHLIGHT_DECKEL) {
      const f = HIGHLIGHT_DECKEL / sum;
      for (const p of clips) {
        p.weight = round2(p.weight * f);
        p.source = { ...p.source, weight: p.weight };
      }
    }
  }
  return { pulls: byQuestion, gelegenheiten };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Wie viele verschiedene Videos stehen hinter diesen Quellen? */
function videoZahl(sources: EvidenceSource[]): number {
  return new Set(sources.map((s) => s.analysisId)).size;
}

/** Dasselbe ohne Highlight-Clips — Maß der Wiederholungs-Regel. */
function kampfVideos(sources: EvidenceSource[]): number {
  return new Set(sources.filter((s) => s.videoType !== "highlight").map((s) => s.analysisId)).size;
}

/**
 * Entscheidet EINE Frage. `manualText` ist der Bestand ohne Analyse dahinter.
 */
export function resolveAnswer(
  pulls: Pull[],
  manualText: string | null,
): AnswerEvidence {
  type Arbeit = AnswerSide & { newest: number; fassungen: { text: string; order: number }[] };
  const sides = new Map<string, Arbeit>();
  const add = (side: string, text: string, weight: number, source: EvidenceSource | null, order: number) => {
    const s: Arbeit = sides.get(side) ?? { key: side, weight: 0, text, sources: [], newest: Infinity, fassungen: [] };
    s.weight = round2(s.weight + weight);
    if (source) s.sources.push(source);
    if (order < s.newest) {
      s.newest = order;
      s.text = text; // die jüngste Fassung vertritt die Seite
    }
    if (!s.fassungen.some((f) => f.text === text)) s.fassungen.push({ text, order });
    sides.set(side, s);
  };
  if (manualText) add(MANUAL_SIDE, manualText, 0, null, Infinity);
  for (const p of pulls) add(p.side, p.text, p.weight, p.source, p.order);

  const all = Array.from(sides.values());
  const total = round2(all.reduce((n, s) => n + s.weight, 0));

  // Jüngste Quellen bis zur Schwelle einsammeln.
  const newestFirst = [...pulls].sort((a, b) => a.order - b.order);
  const inWindow = new Map<string, number>();
  let acc = 0;
  for (const p of newestFirst) {
    inWindow.set(p.side, round2((inWindow.get(p.side) ?? 0) + p.weight));
    acc = round2(acc + p.weight);
    if (acc >= KIPP_SCHWELLE) break;
  }
  const decideBy: Map<string, number> =
    acc >= KIPP_SCHWELLE
      ? inWindow
      : new Map(all.map((s) => [s.key, s.weight] as const));

  // Gleichstand deterministisch: Masse im Fenster → Gesamtmasse → jüngere Quelle → Schlüssel.
  const ranked = [...all].sort((a, b) => {
    const da = decideBy.get(a.key) ?? 0;
    const db = decideBy.get(b.key) ?? 0;
    if (db !== da) return db - da;
    if (b.weight !== a.weight) return b.weight - a.weight;
    if (a.newest !== b.newest) return a.newest - b.newest;
    return a.key < b.key ? -1 : 1;
  });

  // Wiederholungs-Regel: Führt eine Seite aus nur EINEM Video, obwohl eine
  // andere in mindestens zwei steht, bleibt die wiederholte vorn. Clips
  // zählen dabei nicht als Wiederholung — sonst kippten zwei Highlights
  // einen ganzen Kampf, und „Clips kippen nie" wäre gebrochen.
  const erste = ranked[0];
  if (erste && kampfVideos(erste.sources) < WIEDERHOLUNG) {
    const gehalten = ranked.findIndex((s) => kampfVideos(s.sources) >= WIEDERHOLUNG);
    if (gehalten > 0) ranked.unshift(...ranked.splice(gehalten, 1));
  }

  const winner = ranked[0]?.key ?? MANUAL_SIDE;
  const second = ranked[1];
  const first = ranked[0];
  const both =
    !!second &&
    second.weight > 0 &&
    first.weight > 0 &&
    second.weight >= first.weight * BEIDES_ANTEIL;

  return {
    winner,
    both,
    total,
    sides: ranked.map(({ newest: _n, fassungen, ...s }) => {
      void _n;
      return {
        ...s,
        texte: fassungen
          .sort((x, y) => x.order - y.order)
          .slice(0, TEXTE_JE_SEITE)
          .map((f) => f.text),
        videos: videoZahl(s.sources),
      };
    }),
  };
}

/**
 * Der Text, der im Profil steht, solange Claude keinen Satz geschrieben hat
 * (oder gerade nicht erreichbar ist) — eine schlichte Verkettung.
 */
export function answerText(e: AnswerEvidence): string {
  if (e.satz?.text) return e.satz.text;
  if (e.kampfarten?.length) {
    return e.kampfarten
      .map((k) => (k.sport ? `${SPORT_KURZ[k.sport]}: ${k.text}` : k.text))
      .join(" ");
  }
  const first = e.sides.find((s) => s.key === e.winner);
  if (!first) return "";
  if (!e.both) return first.text;
  const second = e.sides.find((s) => s.key !== e.winner);
  if (!second || second.text === first.text) return first.text;
  return `${first.text} Zugleich: ${second.text}`;
}

// ─── Zahlen ──────────────────────────────────────────────────────────────────

function numbersAllowed(a: VideoAnalysis, mode: AnalysisMode): boolean {
  if (a.recency === "ancient") return false;
  const allowed = mode === "athlete" ? ZAHLEN_ARTEN_ATHLET : ZAHLEN_ARTEN_GEGNER;
  return allowed.has(a.videoType);
}

/** Ungewichtete Summen über mehrere Listen; Zone = häufigste, Setup = erstes nicht-leeres. */
function summiereListen(listen: ActionStat[][]): ActionStat[] {
  const merged = new Map<
    string,
    { attempted: number; landed: number; zones: Map<CageZone, number>; setup: string | null }
  >();
  for (const liste of listen) {
    for (const s of cleanActionStats(liste)) {
      const m = merged.get(s.id) ?? {
        attempted: 0,
        landed: 0,
        zones: new Map<CageZone, number>(),
        setup: null,
      };
      m.attempted += s.attempted;
      m.landed += s.landed;
      if (s.zone) m.zones.set(s.zone, (m.zones.get(s.zone) ?? 0) + s.attempted);
      if (!m.setup && s.setup) m.setup = s.setup;
      merged.set(s.id, m);
    }
  }
  const out: ActionStat[] = [];
  for (const [id, m] of Array.from(merged.entries())) {
    const stat: ActionStat = { id, attempted: m.attempted, landed: m.landed };
    const zone = Array.from(m.zones.entries()).sort((x, y) => y[1] - x[1])[0];
    if (zone) stat.zone = zone[0];
    if (m.setup) stat.setup = m.setup;
    out.push(stat);
  }
  return cleanActionStats(out);
}

/** Ungewichtete Summen; Zone = häufigste, Setup = jüngstes nicht-leeres. */
export function sumActionStats(sorted: VideoAnalysis[]): ActionStat[] {
  return summiereListen(sorted.map(zahlenInDerKampfart)); // sorted = jüngste zuerst
}

// ─── Split-Fenster ───────────────────────────────────────────────────────────

export function windowedSplit(
  sorted: VideoAnalysis[],
): { split: DnaSplit | null; weight: number; window: SplitWindowEntry[] } {
  const splitVon = (a: VideoAnalysis) => splitNachSteckbrief(a.evaluation.dnaSplit, a.sport);
  const inWindow = sorted
    .filter((a) => SPLIT_ARTEN.has(a.videoType) && !!splitVon(a))
    .slice(0, SPLIT_FENSTER);
  if (inWindow.length === 0) return { split: null, weight: 0, window: [] };
  const acc: DnaSplit = { boxing: 0, kicking: 0, wrestling: 0, ground: 0, clinch: 0 };
  let weight = 0;
  for (const a of inWindow) {
    const s = cleanDnaSplit(splitVon(a));
    const w = a.weight.value;
    for (const k of Object.keys(acc) as (keyof DnaSplit)[]) acc[k] += s[k] * w;
    weight += w;
  }
  for (const k of Object.keys(acc) as (keyof DnaSplit)[]) acc[k] /= weight;
  return {
    split: cleanDnaSplit(acc),
    weight: round2(weight),
    window: inWindow.map((a) => ({ analysisId: a.id, weight: a.weight.value })),
  };
}

// ─── Die ganze Rechnung ──────────────────────────────────────────────────────

/**
 * Die häufigste Fläche der zählenden Analysen (jüngste zuerst sortiert):
 * Gleichstand → die jüngere gewinnt; ohne jede Angabe null — ein Profil ohne
 * gesehenen Käfig spricht neutral („am Rand").
 */
function haeufigsteFlaeche(sorted: VideoAnalysis[]): Flaeche | null {
  const zaehler = new Map<Flaeche, number>();
  for (const a of sorted) if (a.flaeche) zaehler.set(a.flaeche, (zaehler.get(a.flaeche) ?? 0) + 1);
  let beste: Flaeche | null = null;
  for (const a of sorted) {
    if (!a.flaeche) continue;
    if (beste === null || (zaehler.get(a.flaeche) ?? 0) > (zaehler.get(beste) ?? 0)) beste = a.flaeche;
  }
  return beste;
}

/** Kampfarten der zählenden Analysen, in Anzeige-Reihenfolge. */
function kampfartenVon(sports: (Sport | null | undefined)[]): Sport[] {
  const da = new Set(sports.filter(isSport));
  return SPORT_ORDER.filter((s) => da.has(s));
}

/**
 * Rechnet das Profil aus ALLEN Analysen eines Ziels. `existing.dna` ist der
 * heutige Profil-Text: Fragen ohne jede Analyse dahinter behalten ihn (Seite
 * `manual`); Fragen mit Analysen bekommen den Text der führenden Seite.
 */
export function computeProfile(
  mode: AnalysisMode,
  analyses: VideoAnalysis[],
  existing: ExistingProfile,
  now: Date = new Date(),
): ComputedProfile {
  const counted = analyses.filter(counts).sort(compareNewestFirst);
  const existingDna = pruneAnswers(existing.dna ?? {});

  // Texte
  const { pulls, gelegenheiten } = collectPulls(counted, existingDna);
  const answers: Record<string, AnswerEvidence> = {};
  const dna: GegnerDnaAnswers = { ...existingDna };
  const questionIds = Array.from(
    new Set<string>([...Object.keys(existingDna), ...Array.from(pulls.keys())]),
  );
  for (const q of questionIds) {
    const list = pulls.get(q) ?? [];
    const manual = existingDna[q] ?? null;
    // Frage ohne Züge: Bestand steht, keine Rechnung nötig.
    if (list.length === 0) {
      if (manual)
        answers[q] = {
          winner: MANUAL_SIDE,
          both: false,
          total: 0,
          gelegenheiten: gelegenheiten.get(q) ?? 0,
          sides: [{ key: MANUAL_SIDE, weight: 0, text: manual, texte: [manual], videos: 0, sources: [] }],
        };
      continue;
    }
    const e = { ...resolveAnswer(list, manual), gelegenheiten: gelegenheiten.get(q) ?? 0 };
    answers[q] = e;
    const text = answerText(e);
    if (text) dna[q] = text;
  }

  // Zahlen
  const numberSources = counted.filter((a) => numbersAllowed(a, mode));
  const actionStats = sumActionStats(numberSources);

  // Split
  const split = windowedSplit(counted);

  const evidenceTotal = round2(counted.reduce((n, a) => n + a.weight.value, 0));
  return {
    dna: pruneAnswers(dna),
    dnaSplit: split.split,
    dnaSplitWeight: split.weight,
    actionStats,
    evidence: {
      answers,
      splitWindow: split.window,
      evidenceTotal,
      staerke: profilStaerke(answers),
      kampfarten: kampfartenVon(counted.map((a) => a.sport)),
      flaeche: haeufigsteFlaeche(counted),
      countedAnalyses: counted.length,
      totalAnalyses: analyses.filter((a) => !a.wrongFighter).length,
      numbersFrom: numberSources.map((a) => a.id),
      computedAt: now.toISOString(),
    },
  };
}

// ─── Die Fight-DNA über mehrere Kampfarten ───────────────────────────────────

/** Ein Profil je Kampfart — `sport: null` sind Analysen ohne Kampfart (Bestand). */
export interface KampfartProfil {
  sport: Sport | null;
  profil: ComputedProfile;
}

/**
 * Das Gesamtprofil als ZUSAMMENSTELLUNG der Profile je Kampfart (siehe Kopf).
 * Bei EINER Kampfart ist es genau dieses Profil (plus Handtext des
 * Gesamtprofils für Fragen, die kein Video beantwortet).
 */
export function stelleZusammen(
  gruppen: KampfartProfil[],
  existing: ExistingProfile,
  now: Date = new Date(),
): ComputedProfile {
  const mitDaten = gruppen
    .filter((g) => g.profil.evidence.countedAnalyses > 0)
    .sort(
      (a, b) =>
        (a.sport ? SPORT_ORDER.indexOf(a.sport) : SPORT_ORDER.length) -
        (b.sport ? SPORT_ORDER.indexOf(b.sport) : SPORT_ORDER.length),
    );
  const manual = pruneAnswers(existing.dna ?? {});
  const answers: Record<string, AnswerEvidence> = {};
  const dna: GegnerDnaAnswers = {};

  const fragen = new Set<string>(Object.keys(manual));
  for (const g of mitDaten) for (const q of Object.keys(g.profil.evidence.answers)) fragen.add(q);

  for (const q of Array.from(fragen)) {
    const eintraege = mitDaten
      .map((g) => ({ sport: g.sport, e: g.profil.evidence.answers[q] }))
      .filter((x): x is { sport: Sport | null; e: AnswerEvidence } => !!x.e && x.e.total > 0);

    if (eintraege.length === 0) {
      if (manual[q]) {
        answers[q] = {
          winner: MANUAL_SIDE,
          both: false,
          total: 0,
          gelegenheiten: 0,
          sides: [{ key: MANUAL_SIDE, weight: 0, text: manual[q], texte: [manual[q]], videos: 0, sources: [] }],
        };
        dna[q] = manual[q];
      }
      continue;
    }

    // Eine einzige Kampfart beantwortet die Frage: ihre Antwort, unverändert.
    if (eintraege.length === 1) {
      answers[q] = eintraege[0].e;
      const text = answerText(eintraege[0].e);
      if (text) dna[q] = text;
      continue;
    }

    // Seiten über alle Kampfarten zusammenlegen.
    const seiten = new Map<string, AnswerSide & { schwerste: number }>();
    for (const { e } of eintraege) {
      for (const s of e.sides) {
        const m = seiten.get(s.key) ?? { key: s.key, weight: 0, text: s.text, texte: [], sources: [], schwerste: -1 };
        m.weight = round2(m.weight + s.weight);
        m.sources = [...m.sources, ...s.sources];
        for (const t of s.texte ?? [s.text]) if (!(m.texte ?? []).includes(t)) m.texte = [...(m.texte ?? []), t];
        if (s.weight > m.schwerste) {
          m.schwerste = s.weight;
          m.text = s.text;
        }
        seiten.set(s.key, m);
      }
    }
    const gewinner = Array.from(new Set(eintraege.map((x) => x.e.winner)));
    const gelegenheiten = eintraege.reduce((n, x) => n + (x.e.gelegenheiten ?? 0), 0);
    const total = round2(eintraege.reduce((n, x) => n + x.e.total, 0));
    const liste = Array.from(seiten.values())
      .map(({ schwerste: _s, ...s }) => {
        void _s;
        return { ...s, texte: (s.texte ?? []).slice(0, TEXTE_JE_SEITE), videos: videoZahl(s.sources) };
      })
      .sort((a, b) => b.weight - a.weight || (a.key < b.key ? -1 : 1));

    if (gewinner.length === 1) {
      // Alle Kampfarten sagen dasselbe → EIN Satz.
      const winner = gewinner[0];
      const sides = [...liste.filter((s) => s.key === winner), ...liste.filter((s) => s.key !== winner)];
      const both =
        !!sides[1] && sides[0].weight > 0 && sides[1].weight >= sides[0].weight * BEIDES_ANTEIL;
      const e: AnswerEvidence = { winner, both, total, gelegenheiten, sides };
      answers[q] = e;
      dna[q] = answerText(e);
      continue;
    }

    // Die Kampfarten sagen Verschiedenes → beide Aussagen mit Kampfart.
    const kampfarten: KampfartAntwort[] = eintraege.map(({ sport, e }) => {
      const fuehrend = e.sides.find((s) => s.key === e.winner);
      return {
        sport,
        winner: e.winner,
        text: answerText(e),
        weight: fuehrend?.weight ?? 0,
        videos: fuehrend?.videos ?? videoZahl(fuehrend?.sources ?? []),
      };
    });
    const schwerste = [...kampfarten].sort((a, b) => b.weight - a.weight)[0];
    const sides = [
      ...liste.filter((s) => s.key === schwerste.winner),
      ...liste.filter((s) => s.key !== schwerste.winner),
    ];
    const e: AnswerEvidence = { winner: schwerste.winner, both: false, total, gelegenheiten, kampfarten, sides };
    answers[q] = e;
    dna[q] = answerText(e);
  }

  // Split: gewichteter Schnitt der Kampfart-Splits.
  const acc: DnaSplit = { boxing: 0, kicking: 0, wrestling: 0, ground: 0, clinch: 0 };
  let splitGewicht = 0;
  for (const g of mitDaten) {
    const w = g.profil.dnaSplitWeight;
    if (!g.profil.dnaSplit || !(w > 0)) continue;
    const s = cleanDnaSplit(g.profil.dnaSplit);
    for (const k of DNA_SPLIT_KEYS) acc[k] += s[k] * w;
    splitGewicht += w;
  }
  if (splitGewicht > 0) for (const k of DNA_SPLIT_KEYS) acc[k] /= splitGewicht;

  const ev = mitDaten.map((g) => g.profil.evidence);
  return {
    dna: pruneAnswers(dna),
    dnaSplit: splitGewicht > 0 ? cleanDnaSplit(acc) : null,
    dnaSplitWeight: round2(splitGewicht),
    actionStats: summiereListen(mitDaten.map((g) => g.profil.actionStats)),
    evidence: {
      answers,
      splitWindow: ev.flatMap((e) => e.splitWindow),
      evidenceTotal: round2(ev.reduce((n, e) => n + e.evidenceTotal, 0)),
      staerke: profilStaerke(answers),
      kampfarten: kampfartenVon(ev.flatMap((e) => e.kampfarten ?? [])),
      // Eine Fläche nur, wenn ALLE Kampfarten auf derselben entstanden sind —
      // ein Sambo auf der Matte macht den MMA-Käfig nicht zur Fight-DNA-Fläche.
      flaeche: new Set(ev.map((e) => e.flaeche ?? null)).size === 1 ? (ev[0]?.flaeche ?? null) : null,
      countedAnalyses: ev.reduce((n, e) => n + e.countedAnalyses, 0),
      totalAnalyses: gruppen.reduce((n, g) => n + g.profil.evidence.totalAnalyses, 0),
      numbersFrom: ev.flatMap((e) => e.numbersFrom),
      computedAt: now.toISOString(),
    },
  };
}

// ─── Die Wirkung einer Analyse ───────────────────────────────────────────────

/**
 * Was ein Video an einer Frage bewegt hat — als BELEG, nie als Tatsache:
 *   angepasst   die Antwort hat gewechselt, und dieses Video steht auf der neuen Seite
 *   abweichend  das Video zeigt etwas anderes; das Profil bleibt
 *   bestaetigt  das Video stützt die führende Antwort, die in ≥ 2 Videos steht
 *   erstmals    die führende Antwort steht bisher nur in diesem Video
 */
export type WirkungArt = "angepasst" | "abweichend" | "bestaetigt" | "erstmals";

export interface WirkungPunkt {
  art: WirkungArt;
  questionId: string;
  /** Was DIESES Video zu der Frage sagt. */
  text: string;
  /** In wie vielen Videos steht die Seite dieses Videos? */
  videos: number;
  /** In wie vielen zählenden Videos war die Frage beantwortbar? */
  gelegenheiten: number;
  /** Bei „abweichend": was im Profil stehen bleibt. */
  fuehrend?: { text: string; videos: number };
}

export type WirkungZahl =
  | { art: "technik"; id: string; attempted: number; landed: number }
  | { art: "split"; key: DnaSplitKey; vorher: number | null; nachher: number };

export interface AnalyseWirkung {
  /** In welches Profil das Video lief. */
  profil: Sport | "gesamt" | "gegner";
  /** Zählt die Analyse überhaupt (Tor offen, nicht markiert)? */
  zaehlt: boolean;
  /** Höchstens drei Punkte, der wichtigste zuerst. */
  punkte: WirkungPunkt[];
  /** Wie viele Punkte je Art es insgesamt gab. */
  zaehler: Record<WirkungArt, number>;
  /** Höchstens zwei Zahlen: die meistversuchte Technik (ab 5 Versuchen) und die Split-Bewegung. */
  zahlen: WirkungZahl[];
  staerkeVorher: number;
  staerkeNachher: number;
  berechnetAm: string;
}

const WIRKUNG_RANG: Record<WirkungArt, number> = {
  angepasst: 0,
  abweichend: 1,
  bestaetigt: 2,
  erstmals: 3,
};
/** Höchstens so viele Punkte zeigt die Kurzinfo (Leon: 3–5 Punkte samt Zahlen). */
export const WIRKUNG_PUNKTE = 3;
/** Eine Split-Bewegung ab so vielen Prozentpunkten ist eine Zeile wert. */
const SPLIT_BEWEGUNG = 3;

export function wirkungDerAnalyse(args: {
  analyse: VideoAnalysis;
  mode: AnalysisMode;
  profil: AnalyseWirkung["profil"];
  vorher: { evidence: ProfileEvidence | null; dnaSplit: DnaSplit | null } | null;
  nachher: ComputedProfile;
  now?: Date;
}): AnalyseWirkung {
  const { analyse, mode, profil, vorher, nachher } = args;
  const zaehler: Record<WirkungArt, number> = { angepasst: 0, abweichend: 0, bestaetigt: 0, erstmals: 0 };
  const staerkeVorher = vorher?.evidence
    ? (vorher.evidence.staerke ?? profilStaerke(vorher.evidence.answers))
    : 0;
  const staerkeNachher = nachher.evidence.staerke ?? profilStaerke(nachher.evidence.answers);
  const zaehlt = counts(analyse);
  const leer = {
    profil,
    zaehlt,
    punkte: [],
    zaehler,
    zahlen: [],
    staerkeVorher,
    staerkeNachher,
    berechnetAm: (args.now ?? new Date()).toISOString(),
  };
  if (!zaehlt) return leer;

  const punkte: (WirkungPunkt & { konfidenz: number })[] = [];
  for (const [q, e] of Object.entries(nachher.evidence.answers)) {
    const idx = e.sides.findIndex((s) => s.sources.some((src) => src.analysisId === analyse.id));
    if (idx < 0) continue;
    const seite = e.sides[idx];
    const befund = analyse.evaluation.findings.find((f) => f.questionId === q);
    const videos = seite.videos ?? videoZahl(seite.sources);
    const fuehrt = seite.key === e.winner || (e.both && idx === 1);
    const vorE = vorher?.evidence?.answers?.[q];
    const vorGewinner = vorE && vorE.total > 0 ? vorE.winner : null;

    let art: WirkungArt;
    if (!fuehrt) art = "abweichend";
    else if (vorGewinner && vorGewinner !== e.winner && seite.key === e.winner) art = "angepasst";
    else if (videos >= WIEDERHOLUNG) art = "bestaetigt";
    else art = "erstmals";
    zaehler[art] += 1;

    const fuehrend = e.sides.find((s) => s.key === e.winner);
    punkte.push({
      art,
      questionId: q,
      text: befund?.answer.trim() || seite.text,
      videos,
      gelegenheiten: e.gelegenheiten ?? 0,
      konfidenz: befund?.confidence ?? 0,
      ...(art === "abweichend" && fuehrend
        ? { fuehrend: { text: fuehrend.text, videos: fuehrend.videos ?? videoZahl(fuehrend.sources) } }
        : {}),
    });
  }
  punkte.sort(
    (a, b) =>
      WIRKUNG_RANG[a.art] - WIRKUNG_RANG[b.art] ||
      b.videos - a.videos ||
      b.konfidenz - a.konfidenz ||
      (a.questionId < b.questionId ? -1 : 1),
  );

  const zahlen: WirkungZahl[] = [];
  if (numbersAllowed(analyse, mode)) {
    const technik = cleanActionStats(zahlenInDerKampfart(analyse))
      .filter((s) => s.attempted >= ZAHLEN_MINDESTVERSUCHE)
      .sort((a, b) => b.attempted - a.attempted || (a.id < b.id ? -1 : 1))[0];
    if (technik) zahlen.push({ art: "technik", id: technik.id, attempted: technik.attempted, landed: technik.landed });
  }
  const imFenster = nachher.evidence.splitWindow.some((w) => w.analysisId === analyse.id);
  if (imFenster && nachher.dnaSplit) {
    const nach = nachher.dnaSplit;
    const vor = vorher?.dnaSplit && !isDnaSplitEmpty(vorher.dnaSplit) ? cleanDnaSplit(vorher.dnaSplit) : null;
    if (vor) {
      const key = [...DNA_SPLIT_KEYS].sort((a, b) => Math.abs(nach[b] - vor[b]) - Math.abs(nach[a] - vor[a]))[0];
      if (Math.abs(nach[key] - vor[key]) >= SPLIT_BEWEGUNG) {
        zahlen.push({ art: "split", key, vorher: vor[key], nachher: nach[key] });
      }
    } else {
      const key = [...DNA_SPLIT_KEYS].sort((a, b) => nach[b] - nach[a])[0];
      zahlen.push({ art: "split", key, vorher: null, nachher: nach[key] });
    }
  }

  return {
    ...leer,
    punkte: punkte.slice(0, WIRKUNG_PUNKTE).map(({ konfidenz: _k, ...p }) => {
      void _k;
      return p;
    }),
    zahlen,
  };
}
