/**
 * Gegner-DNA — strukturiertes Gegner-Scouting (vormals Teil von "Fight-Camp").
 *
 * Definiert die Hauptkategorien und optionalen Fragen eines Gegnerprofils.
 * Das Schema ist bewusst datengetrieben: weitere Kategorien/Fragen lassen sich
 * ergänzen, ohne UI oder Speicher-Logik anzufassen.
 *
 * Speicher-Modell:
 *   Antworten = flache Map  { [questionId]: string }
 *   Leere/fehlende Antworten werden NICHT angezeigt (Profilansicht) und müssen
 *   auch nicht beantwortet werden. Die IDs sind stabil — niemals umbenennen,
 *   sonst verlieren bestehende Profile ihre Zuordnung.
 *
 * Zwei Ansichten teilen sich dieses Schema:
 *   • Profilansicht  → nur beantwortete Fragen (fertiger Gegnerbericht)
 *   • Bearbeiten     → alle Fragen sichtbar (Eingabefelder)
 */

/** Antworten eines Gegner-DNA-Profils: questionId → Freitext. */
export type GegnerDnaAnswers = Record<string, string>;

export interface DnaQuestion {
  /** Stabile ID — NIEMALS ändern (sonst Datenverlust der Zuordnung). */
  id: string;
  /** Sichtbare Frage in der UI. */
  label: string;
  /** Optionaler Platzhalter / Beispiel für das Eingabefeld. */
  placeholder?: string;
}

export interface DnaCategory {
  /** Stabile Kategorie-ID. */
  id: string;
  /** Sichtbarer Kategorie-Titel. */
  label: string;
  /** Kurzer Untertitel / Beschreibung der Kategorie. */
  hint: string;
  /** Akzentfarbe (CSS-Variable oder Hex) für die Karte. */
  accent: string;
  questions: DnaQuestion[];
}

// ─── Kategorien & Fragen ─────────────────────────────────────────────────────

export const DNA_CATEGORIES: DnaCategory[] = [
  {
    id: "real-habits",
    label: "Real Habits",
    hint: "Wiederkehrende, echte Verhaltensmuster",
    accent: "var(--ta-cyan)",
    questions: [
      { id: "real-habits_repeats", label: "Welche Muster wiederholt er immer wieder – was ist besonders auffällig?" },
      { id: "real-habits_after-hit", label: "Was macht der Gegner nach einem Treffer?" },
      { id: "real-habits_after-miss", label: "Was macht der Gegner nach einem verfehlten Schlag?" },
      { id: "real-habits_when-tired", label: "Was macht der Gegner, wenn er müde wird?" },
      { id: "real-habits_after-td-attempt", label: "Was macht der Gegner nach einem Takedown-Versuch?" },
      { id: "real-habits_plan-fails", label: "Was macht der Gegner, wenn sein erster Gameplan nicht funktioniert?" },
    ],
  },
  {
    id: "entry-patterns",
    label: "Entry Patterns",
    hint: "Wie der Gegner seine Angriffe startet",
    accent: "var(--ta-pink)",
    questions: [
      { id: "entry-patterns_start", label: "Wie leitet er Angriffe ein – welches Setup nutzt er?" },
      { id: "entry-patterns_jab", label: "Womit leitet er ein – Jab, Feints, Kicks oder Level-Change?" },
      { id: "entry-patterns_clinch", label: "Wie kommt er in den Clinch?" },
      { id: "entry-patterns_takedown", label: "Wie kommt er in den Takedown?" },
      { id: "entry-patterns_center-or-cage", label: "Greift er eher im Center oder am Cage an?" },
      { id: "entry-patterns_after-entry", label: "Welche Aktion kommt nach seinem Entry?" },
      { id: "entry-patterns_counter", label: "Wie kann man diesen Entry kontern?" },
    ],
  },
  {
    id: "preferred-weapons",
    label: "Preferred Weapons",
    hint: "Bevorzugte und gefährlichste Techniken",
    accent: "#8A63E8",
    questions: [
      { id: "preferred-weapons_most-common", label: "Was ist seine häufigste Waffe?" },
      { id: "preferred-weapons_most-dangerous", label: "Was ist seine gefährlichste Technik?" },
      { id: "preferred-weapons_combo", label: "Welche Kombination nutzt er oft?" },
      { id: "preferred-weapons_kick", label: "Welchen Kick nutzt er am meisten?" },
      { id: "preferred-weapons_punch", label: "Welchen Schlag nutzt er am meisten?" },
      { id: "preferred-weapons_takedown", label: "Welchen Takedown nutzt er am meisten?" },
      { id: "preferred-weapons_finish", label: "Welche Technik nutzt er zum Finishen?" },
      { id: "preferred-weapons_under-pressure", label: "Welche Technik nutzt er unter Druck?" },
    ],
  },
  {
    id: "defensive-reactions",
    label: "Defensive Reactions",
    hint: "Reaktionen auf Angriffe und Druck",
    accent: "#9D7BFA",
    questions: [
      { id: "defensive-reactions_jabs", label: "Wie reagiert der Gegner auf Jabs?" },
      { id: "defensive-reactions_pressure", label: "Wie reagiert er auf Druck – Clinch suchen, kontern oder flüchten?" },
      { id: "defensive-reactions_low-kicks", label: "Wie reagiert der Gegner auf Low Kicks?" },
      { id: "defensive-reactions_takedowns", label: "Wie reagiert der Gegner auf Takedown-Versuche?" },
      { id: "defensive-reactions_parry-shell", label: "Nutzt er Parry, Shell, Slip oder Block?" },
      { id: "defensive-reactions_shoots", label: "Reagiert er auf Angriffe mit einem Konter oder Shot?" },
    ],
  },
  {
    id: "cage-space",
    label: "Cage- und Raumverhalten",
    hint: "Bewegung im Center, am Cage und unter Druck",
    accent: "var(--ta-cyan)",
    questions: [
      { id: "cage-space_center-movement", label: "Wie bewegt sich der Gegner im Center?" },
      { id: "cage-space_at-cage", label: "Wie verhält er sich am Cage?" },
      { id: "cage-space_pushes-cage", label: "Drückt er selbst zum Cage oder lässt er sich drücken?" },
      { id: "cage-space_escapes-cage", label: "Wie befreit er sich vom Cage?" },
      { id: "cage-space_space-under-pressure", label: "Wie nutzt er den Raum, wenn er unter Druck steht?" },
      { id: "cage-space_dangerous-positions", label: "Welche Raumpositionen sind für ihn gefährlich oder unangenehm?" },
    ],
  },
  {
    id: "weaknesses",
    label: "Schwächen",
    hint: "Technische, konditionelle und mentale Lücken",
    accent: "var(--ta-pink)",
    questions: [
      { id: "weaknesses_technical", label: "Wo ist der Gegner technisch anfällig?" },
      { id: "weaknesses_problem-situations", label: "Welche Situationen bereiten ihm sichtbar Probleme?" },
      { id: "weaknesses_repeated-mistakes", label: "Welche Fehler wiederholt er?" },
      { id: "weaknesses_loses-control", label: "Wann verliert er die Kontrolle?" },
      { id: "weaknesses_bad-distance", label: "Welche Distanz liegt ihm nicht?" },
      { id: "weaknesses_gets-hit-by", label: "Welche Angriffe treffen ihn besonders häufig?" },
      { id: "weaknesses_conditioning-mental", label: "Welche konditionellen oder mentalen Schwächen sind erkennbar?" },
    ],
  },
  {
    id: "exploits",
    label: "Exploit-Möglichkeiten",
    hint: "Wie sich Schwächen gezielt ausnutzen lassen",
    accent: "#8A63E8",
    questions: [
      { id: "exploits_target-weakness", label: "Welche Schwäche kann gezielt ausgenutzt werden?" },
      { id: "exploits_technique-vs-pattern", label: "Welche Technik eignet sich gegen sein Muster?" },
      { id: "exploits_provoke-reaction", label: "Welche Reaktion kann provoziert werden?" },
      { id: "exploits_trap", label: "Welche Falle kann gestellt werden?" },
      { id: "exploits_seek-position", label: "Welche Position sollte aktiv gesucht werden?" },
      { id: "exploits_avoid-situations", label: "Welche Situationen sollten vermieden werden?" },
    ],
  },
  {
    id: "gameplan",
    label: "Gameplan",
    hint: "Empfohlener Grundplan und Anpassungen",
    accent: "#9D7BFA",
    questions: [
      { id: "gameplan_base-plan", label: "Was ist der empfohlene Grundplan gegen diesen Gegner?" },
      { id: "gameplan_seek-distance", label: "Welche Distanz soll gesucht werden?" },
      { id: "gameplan_avoid-distance", label: "Welche Distanz soll vermieden werden?" },
      { id: "gameplan_priority-techniques", label: "Welche Techniken sollen priorisiert werden?" },
      { id: "gameplan_round-1", label: "Welche Taktik eignet sich in Runde 1?" },
      { id: "gameplan_if-pressure", label: "Welche Anpassung ist sinnvoll, wenn der Gegner Druck macht?" },
      { id: "gameplan_if-passive", label: "Welche Anpassung ist sinnvoll, wenn der Gegner passiv wird?" },
      { id: "gameplan_key-to-win", label: "Was ist der wichtigste Schlüssel zum Sieg?" },
    ],
  },
  {
    id: "drills",
    label: "Drills",
    hint: "Konkrete Vorbereitung im Training",
    accent: "var(--ta-cyan)",
    questions: [
      { id: "drills_preparation", label: "Welche Drills passen zur Vorbereitung auf diesen Gegner?" },
      { id: "drills_defensive-reaction", label: "Welche defensive Reaktion soll trainiert werden?" },
      { id: "drills_automate-counters", label: "Welche Konter sollen automatisiert werden?" },
      { id: "drills_cage-situations", label: "Welche Cage-Situationen sollen geübt werden?" },
      { id: "drills_takedown-sequences", label: "Welche Takedown- oder Anti-Takedown-Sequenzen sind wichtig?" },
      { id: "drills_sparring-tasks", label: "Welche Sparring-Aufgaben passen zum Gameplan?" },
    ],
  },
];

// ─── Helfer ──────────────────────────────────────────────────────────────────

/** Map: questionId → Frage (für schnelle Lookups in der Profilansicht). */
export const DNA_QUESTION_BY_ID: Map<string, DnaQuestion> = new Map(
  DNA_CATEGORIES.flatMap((c) => c.questions.map((q) => [q.id, q] as const)),
);

/** Gesamtzahl aller möglichen Fragen über alle Kategorien. */
export const DNA_TOTAL_QUESTIONS = DNA_CATEGORIES.reduce(
  (sum, c) => sum + c.questions.length,
  0,
);

/** True, wenn die Antwort sinnvoll befüllt ist (nicht leer / nur Whitespace). */
export function isAnswered(value: string | undefined | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** Liefert nur die beantworteten Fragen einer Kategorie (für die Profilansicht). */
export function answeredQuestions(
  category: DnaCategory,
  answers: GegnerDnaAnswers,
): { question: DnaQuestion; value: string }[] {
  return category.questions
    .filter((q) => isAnswered(answers[q.id]))
    .map((q) => ({ question: q, value: answers[q.id].trim() }));
}

/** Anzahl beantworteter Fragen in einer Kategorie. */
export function answeredCount(
  category: DnaCategory,
  answers: GegnerDnaAnswers,
): number {
  return category.questions.reduce(
    (n, q) => (isAnswered(answers[q.id]) ? n + 1 : n),
    0,
  );
}

/** Gesamtzahl beantworteter Fragen über alle Kategorien. */
export function totalAnswered(answers: GegnerDnaAnswers): number {
  return DNA_CATEGORIES.reduce((n, c) => n + answeredCount(c, answers), 0);
}

/** True, wenn überhaupt keine DNA-Frage beantwortet wurde. */
export function isDnaEmpty(answers: GegnerDnaAnswers | undefined | null): boolean {
  if (!answers) return true;
  return totalAnswered(answers) === 0;
}

/**
 * DNA-Vollständigkeit in Prozent (0–100): beantwortete Fragen relativ zu
 * ALLEN für dieses Profil möglichen Fragen.
 *
 * ANZEIGE-REGEL (Entscheidung Leon, 2026-08-21): Zusammenfassungen (Badges,
 * Karten, Kopfzeilen) zeigen den DNA-Stand IMMER als Prozent; absolute
 * Zahlen nur in Detail-Auflistungen/Zählungen, und dort ausschließlich als
 * „n/gesamt" (siehe DnaCategoryGrid). Hintergrund: Profile bekommen später
 * disziplinabhängige Fragenkataloge (reiner BJJ-Kämpfer ≠ MMA-Katalog) —
 * eine absolute Zahl ist dann nicht mehr vergleichbar. Diese Funktion ist
 * der EINZIGE Ort, der den Nenner kennt; heute ist das der globale Katalog
 * (DNA_TOTAL_QUESTIONS), später der profilspezifische.
 */
export function dnaCompleteness(
  answers: GegnerDnaAnswers | undefined | null,
): number {
  if (!answers || DNA_TOTAL_QUESTIONS === 0) return 0;
  return Math.round((totalAnswered(answers) / DNA_TOTAL_QUESTIONS) * 100);
}

/**
 * Entfernt leere Antworten aus der Map — so landen keine leeren Strings in
 * Firestore und die gespeicherte DNA bleibt schlank.
 */
export function pruneAnswers(answers: GegnerDnaAnswers): GegnerDnaAnswers {
  const out: GegnerDnaAnswers = {};
  for (const [k, v] of Object.entries(answers)) {
    if (isAnswered(v)) out[k] = v.trim();
  }
  return out;
}
