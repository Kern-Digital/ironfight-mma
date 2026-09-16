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
 *   • GLEICHSTAND deterministisch: mehr Video-Masse → jüngere Quelle →
 *     beide nennen.
 *   • „BEIDES" (Leon: „kann ja sein, dass jemand beides macht, rechts und
 *     links"): Sobald die zweite Seite ≥ die Hälfte der ersten wiegt, nennt
 *     der Text beide. Bis Etappe 3 (Claude schreibt die Antwort fort) ist
 *     das eine schlichte Verkettung.
 *   • HIGHLIGHT liefert nur Text, und nur in den Kategorien Waffen und
 *     Entries (Finish gehört zu den Waffen). Alle Clips zusammen wiegen je
 *     Antwort höchstens 0,6.
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
 * STÄRKE: `evidenceTotal` = Summe der Gewichte aller zählenden Analysen.
 *   Die Anzeige ist ein Füllstand mit Prozent (Leon 16.09., Frage c);
 *   `EVIDENCE_FULL` sagt, was 100 % bedeutet.
 */

import {
  cleanActionStats,
  cleanDnaSplit,
  isDnaSplitEmpty,
  type ActionStat,
  type CageZone,
  type DnaSplit,
} from "./fight-stats";
import { pruneAnswers, type GegnerDnaAnswers } from "./gegner-dna";
import {
  FIGHT_RECENCY_RANK,
  type AnalysisMode,
  type VideoAnalysis,
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
/** Gewichtssumme, die als „volles" Profil gilt (drei aktuelle ganze Kämpfe). */
export const EVIDENCE_FULL = 3.0;
/** Seite für Profil-Text ohne Analyse dahinter. */
export const MANUAL_SIDE = "manual";

const ZAHLEN_ARTEN_GEGNER = new Set<VideoType>(["full", "excerpt"]);
const ZAHLEN_ARTEN_ATHLET = new Set<VideoType>(["full", "excerpt", "sparring"]);
const SPLIT_ARTEN = new Set<VideoType>(["full", "excerpt"]);

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
  sources: EvidenceSource[];
}

/** Stand einer Frage nach der Rechnung. */
export interface AnswerEvidence {
  /** Schlüssel der führenden Seite (`manual`, wenn nur Bestand da ist). */
  winner: string;
  /** Zweite Seite wird mitgenannt. */
  both: boolean;
  /** Gewichtssumme aller Seiten. */
  total: number;
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

/** Profil-Stärke 0–100 für den Füllstand (Leon 16.09., Frage c). */
export function evidenceStrengthPct(evidenceTotal: number): number {
  return Math.max(0, Math.min(100, Math.round((evidenceTotal / EVIDENCE_FULL) * 100)));
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
 * kappt die Highlight-Clips je Antwort.
 */
function collectPulls(
  sorted: VideoAnalysis[],
  existing: GegnerDnaAnswers,
): Map<string, Pull[]> {
  const byQuestion = new Map<string, Pull[]>();
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
    for (const f of a.evaluation.findings) {
      if (!f.questionId || !f.answer.trim()) continue;
      if (isHighlight && !HIGHLIGHT_KATEGORIEN.has(f.categoryId)) continue;
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
  return byQuestion;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Entscheidet EINE Frage. `manualText` ist der Bestand ohne Analyse dahinter.
 */
export function resolveAnswer(
  pulls: Pull[],
  manualText: string | null,
): AnswerEvidence {
  const sides = new Map<string, AnswerSide & { newest: number }>();
  const add = (side: string, text: string, weight: number, source: EvidenceSource | null, order: number) => {
    const s = sides.get(side) ?? { key: side, weight: 0, text, sources: [], newest: Infinity };
    s.weight = round2(s.weight + weight);
    if (source) s.sources.push(source);
    if (order < s.newest) {
      s.newest = order;
      s.text = text; // die jüngste Fassung vertritt die Seite
    }
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
    sides: ranked.map(({ newest: _n, ...s }) => {
      void _n;
      return s;
    }),
  };
}

/** Der Text, der im Profil steht — bis Etappe 3 eine schlichte Verkettung. */
export function answerText(e: AnswerEvidence): string {
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

/** Ungewichtete Summen; Zone = häufigste, Setup = jüngstes nicht-leeres. */
export function sumActionStats(sorted: VideoAnalysis[]): ActionStat[] {
  const merged = new Map<
    string,
    { attempted: number; landed: number; zones: Map<CageZone, number>; setup: string | null }
  >();
  for (const a of sorted) {
    for (const s of cleanActionStats(a.evaluation.actionStats)) {
      const m = merged.get(s.id) ?? {
        attempted: 0,
        landed: 0,
        zones: new Map<CageZone, number>(),
        setup: null,
      };
      m.attempted += s.attempted;
      m.landed += s.landed;
      if (s.zone) m.zones.set(s.zone, (m.zones.get(s.zone) ?? 0) + s.attempted);
      if (!m.setup && s.setup) m.setup = s.setup; // sorted = jüngste zuerst
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

// ─── Split-Fenster ───────────────────────────────────────────────────────────

export function windowedSplit(
  sorted: VideoAnalysis[],
): { split: DnaSplit | null; weight: number; window: SplitWindowEntry[] } {
  const inWindow = sorted
    .filter((a) => SPLIT_ARTEN.has(a.videoType) && !isDnaSplitEmpty(a.evaluation.dnaSplit))
    .slice(0, SPLIT_FENSTER);
  if (inWindow.length === 0) return { split: null, weight: 0, window: [] };
  const acc: DnaSplit = { boxing: 0, kicking: 0, wrestling: 0, ground: 0, clinch: 0 };
  let weight = 0;
  for (const a of inWindow) {
    const s = cleanDnaSplit(a.evaluation.dnaSplit);
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
  const pulls = collectPulls(counted, existingDna);
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
          sides: [{ key: MANUAL_SIDE, weight: 0, text: manual, sources: [] }],
        };
      continue;
    }
    const e = resolveAnswer(list, manual);
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
      countedAnalyses: counted.length,
      totalAnalyses: analyses.filter((a) => !a.wrongFighter).length,
      numbersFrom: numberSources.map((a) => a.id),
      computedAt: now.toISOString(),
    },
  };
}
