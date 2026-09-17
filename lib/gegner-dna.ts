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
  /** Sichtbare Frage im Gegner-Profil (dritte Person, „er"). */
  label: string;
  /**
   * Dieselbe Frage im Athleten-Profil (Du-Form) — für Athlet UND Trainer
   * sichtbar, passend zu den Du-Sätzen der Profil-Rechnung (Leon 17.09.2026).
   * Exploits, Gameplan und Drills drehen sich beim Athleten um: was Gegner
   * bei ihm ausnutzen könnten, wie er seine Stärken einsetzt, was er trainiert.
   * KURZ (Leon 17.09.2026 nach dem Beweislauf: „Du-Fragen kürzer", Beispiel
   * „Wo bist du angreifbar?") — die Aufzählung steht nur in `label`; die
   * Bewertung hängt sie in Klammern an (lib/server/claude.ts dnaCatalogText).
   */
  labelDu: string;
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
//
// Stand 17.09.2026 (Kampfart-Steckbriefe, docs/kampfart-steckbriefe.md 3.3/3.5):
// 59 bisherige Fragen mit neutralerem Wortlaut (Käfig, Ring UND Matte),
// `entry-patterns_jab` gestrichen (ging in `entry-patterns_start` auf), acht
// Zusatzfragen je am Ende ihrer Kategorie. Welche Frage in welcher Kampfart
// gilt, steht in lib/kampfart-steckbrief.ts — hier steht nur der Wortlaut.

export const DNA_CATEGORIES: DnaCategory[] = [
  {
    id: "real-habits",
    label: "Real Habits",
    hint: "Wiederkehrende, echte Verhaltensmuster",
    accent: "var(--ta-cyan)",
    questions: [
      { id: "real-habits_repeats", label: "Welche Muster wiederholt er immer wieder – was fällt besonders auf?", labelDu: "Welche Muster wiederholst du?" },
      { id: "real-habits_after-hit", label: "Was macht er nach einem eigenen Treffer?", labelDu: "Was machst du nach einem Treffer?" },
      { id: "real-habits_after-miss", label: "Was macht er nach einem verfehlten Schlag?", labelDu: "Was machst du, wenn du verfehlst?" },
      { id: "real-habits_when-tired", label: "Was macht er, wenn er müde wird?", labelDu: "Was machst du, wenn du müde wirst?" },
      { id: "real-habits_after-td-attempt", label: "Was macht er nach einem Takedown- oder Wurfversuch – folgt er zu Boden, bleibt er dran oder löst er sich?", labelDu: "Was folgt auf deinen Takedown- oder Wurfversuch?" },
      { id: "real-habits_plan-fails", label: "Was macht er, wenn sein erster Plan nicht funktioniert?", labelDu: "Was machst du, wenn dein Plan nicht greift?" },
      { id: "real-habits_ground-top", label: "Was macht er oben am Boden – Druck und Kontrolle, Passen, Schlagen, Aufgabegriff suchen, Ausheben oder Durchdrehen?", labelDu: "Was machst du oben am Boden?" },
      { id: "real-habits_ground-bottom", label: "Was macht er unten – Guard spielen, sweepen, aufstehen, Bauchlage und Basis halten, Aufgabegriff von unten?", labelDu: "Was machst du unten am Boden?" },
      { id: "real-habits_after-rocked", label: "Was macht er nach einem Wackler oder Anzählen – klammern, zurückfeuern, laufen, Takedown suchen?", labelDu: "Was machst du nach einem Wackler?" },
    ],
  },
  {
    id: "entry-patterns",
    label: "Entry Patterns",
    hint: "Wie Angriffe beginnen",
    accent: "var(--ta-pink)",
    questions: [
      { id: "entry-patterns_start", label: "Wie leitet er Angriffe ein – Jab, Finte, Kick, Level-Change, Griff?", labelDu: "Wie leitest du Angriffe ein?" },
      { id: "entry-patterns_clinch", label: "Wie kommt er in den Clinch oder in die Bindung?", labelDu: "Wie kommst du in den Clinch?" },
      { id: "entry-patterns_takedown", label: "Wie kommt er in den Takedown oder Wurf – oder zieht er Guard?", labelDu: "Wie kommst du zum Takedown oder Wurf?" },
      { id: "entry-patterns_center-or-cage", label: "Greift er eher in der Mitte oder am Rand an?", labelDu: "Greifst du aus der Mitte oder am Rand an?" },
      { id: "entry-patterns_after-entry", label: "Welche Aktion folgt auf seinen Entry?", labelDu: "Was folgt auf deinen Entry?" },
      { id: "entry-patterns_counter", label: "Wie lässt sich dieser Entry kontern?", labelDu: "Wie kontert ein Gegner deinen Entry?" },
      { id: "entry-patterns_throw-direction", label: "In welche Richtung und auf welche Seite greift er an – vorwärts (Eindrehen) oder rückwärts (Sichel, Fegen), links oder rechts?", labelDu: "In welche Richtung wirfst du?" },
    ],
  },
  {
    id: "preferred-weapons",
    label: "Preferred Weapons",
    hint: "Bevorzugte und gefährlichste Techniken",
    accent: "#8A63E8",
    questions: [
      { id: "preferred-weapons_most-common", label: "Was ist seine häufigste Waffe?", labelDu: "Was ist deine häufigste Waffe?" },
      { id: "preferred-weapons_most-dangerous", label: "Was ist seine gefährlichste Technik?", labelDu: "Was ist deine gefährlichste Technik?" },
      { id: "preferred-weapons_combo", label: "Welche Kombination oder Angriffskette nutzt er oft?", labelDu: "Welche Kombination nutzt du oft?" },
      { id: "preferred-weapons_kick", label: "Welchen Kick nutzt er am meisten?", labelDu: "Welchen Kick nutzt du am meisten?" },
      { id: "preferred-weapons_punch", label: "Welchen Schlag nutzt er am meisten?", labelDu: "Welchen Schlag nutzt du am meisten?" },
      { id: "preferred-weapons_takedown", label: "Welchen Takedown oder Wurf nutzt er am meisten?", labelDu: "Welchen Takedown oder Wurf nutzt du am meisten?" },
      { id: "preferred-weapons_finish", label: "Welche Technik nutzt er zum Finishen?", labelDu: "Womit finishst du?" },
      { id: "preferred-weapons_under-pressure", label: "Welche Technik nutzt er unter Druck?", labelDu: "Was nutzt du unter Druck?" },
      { id: "preferred-weapons_grip", label: "Welchen Griff oder welche Bindung sucht er zuerst – Ärmel/Revers, Unterhaken, Nackengriff, Body Lock, links oder rechts?", labelDu: "Welchen Griff suchst du zuerst?" },
      { id: "preferred-weapons_clinch", label: "Womit arbeitet er im Clinch – Knie, Ellbogen, kurze Schläge, Fegen oder Umwerfen, oder hält er nur?", labelDu: "Womit arbeitest du im Clinch?" },
      { id: "preferred-weapons_submission", label: "Welche Aufgabegriffe sucht er – Würger, Armhebel, Beinhebel – und aus welcher Position?", labelDu: "Welche Aufgabegriffe suchst du?" },
      { id: "preferred-weapons_guard", label: "Welche Guard spielt er – geschlossen, Half Guard, offen mit Beinkontrolle, Beinverwicklung?", labelDu: "Welche Guard spielst du?" },
    ],
  },
  {
    id: "defensive-reactions",
    label: "Defensive Reactions",
    hint: "Reaktionen auf Angriffe und Druck",
    accent: "#9D7BFA",
    questions: [
      { id: "defensive-reactions_jabs", label: "Wie reagiert er auf Jabs?", labelDu: "Wie reagierst du auf Jabs?" },
      { id: "defensive-reactions_pressure", label: "Wie reagiert er auf Druck – Clinch suchen, kontern oder ausweichen?", labelDu: "Wie reagierst du auf Druck?" },
      { id: "defensive-reactions_low-kicks", label: "Wie reagiert er auf Tritte – checken, blocken, fangen, ausweichen, kontern?", labelDu: "Wie reagierst du auf Tritte?" },
      { id: "defensive-reactions_takedowns", label: "Wie reagiert er auf Takedown- oder Wurfversuche?", labelDu: "Wie reagierst du auf Takedowns und Würfe?" },
      { id: "defensive-reactions_parry-shell", label: "Verteidigt er mit Deckung und Parade oder mit Kopf- und Beinarbeit (Slip, Roll, Pivot)?", labelDu: "Verteidigst du mit Deckung oder mit Kopfbewegung?" },
      { id: "defensive-reactions_shoots", label: "Womit antwortet er auf einen Angriff – Konter, Takedown/Wurf oder Abstand?", labelDu: "Womit antwortest du auf einen Angriff?" },
    ],
  },
  {
    id: "cage-space",
    // Die ID bleibt „cage-space" (stabil); das Label je Kampfart kommt aus
    // kategorieLabel() in lib/kampfart-steckbrief.ts („Ring & Raum", „Matte & Raum").
    label: "Raum & Rand",
    hint: "Bewegung in der Mitte, am Rand und unter Druck",
    accent: "var(--ta-cyan)",
    questions: [
      { id: "cage-space_center-movement", label: "Wie bewegt er sich im freien Raum und in der Mitte?", labelDu: "Wie bewegst du dich in der Mitte?" },
      { id: "cage-space_at-cage", label: "Wie verhält er sich am Rand – am Käfig, an den Seilen, am Mattenrand?", labelDu: "Was machst du am Rand?" },
      { id: "cage-space_pushes-cage", label: "Drückt er selbst zum Rand oder lässt er sich drücken?", labelDu: "Drückst du zum Rand oder wirst du gedrückt?" },
      { id: "cage-space_escapes-cage", label: "Wie löst er sich vom Rand?", labelDu: "Wie löst du dich vom Rand?" },
      { id: "cage-space_space-under-pressure", label: "Wie nutzt er den Raum, wenn er unter Druck steht?", labelDu: "Wie nutzt du den Raum unter Druck?" },
      { id: "cage-space_dangerous-positions", label: "Welche Positionen im Raum sind für ihn gefährlich oder unangenehm?", labelDu: "Wo im Raum wird es für dich gefährlich?" },
    ],
  },
  {
    id: "weaknesses",
    label: "Schwächen",
    hint: "Technische und konditionelle Lücken",
    accent: "var(--ta-pink)",
    questions: [
      { id: "weaknesses_technical", label: "Wo ist er technisch anfällig?", labelDu: "Wo bist du technisch anfällig?" },
      { id: "weaknesses_problem-situations", label: "Welche Situationen bereiten ihm sichtbar Probleme?", labelDu: "Welche Situationen bereiten dir Probleme?" },
      { id: "weaknesses_repeated-mistakes", label: "Welche Fehler wiederholt er?", labelDu: "Welche Fehler wiederholst du?" },
      { id: "weaknesses_loses-control", label: "Wann verliert er die Kontrolle – in welchem Übergang?", labelDu: "Wann verlierst du die Kontrolle?" },
      { id: "weaknesses_bad-distance", label: "Welche Distanz liegt ihm nicht?", labelDu: "Welche Distanz liegt dir nicht?" },
      { id: "weaknesses_gets-hit-by", label: "Welche Angriffe kommen bei ihm besonders oft durch?", labelDu: "Was trifft dich besonders oft?" },
      { id: "weaknesses_conditioning-mental", label: "Welche konditionellen Schwächen zeigen sich über die Runden – Tempo, Deckung, Beinarbeit?", labelDu: "Was lässt bei dir über die Runden nach?" },
    ],
  },
  {
    id: "exploits",
    label: "Exploit-Möglichkeiten",
    hint: "Wie sich Schwächen gezielt ausnutzen lassen",
    accent: "#8A63E8",
    questions: [
      { id: "exploits_target-weakness", label: "Welche Schwäche kann gezielt ausgenutzt werden?", labelDu: "Wo bist du angreifbar?" },
      { id: "exploits_technique-vs-pattern", label: "Welche Technik eignet sich gegen sein Muster?", labelDu: "Womit bricht ein Gegner dein Muster?" },
      { id: "exploits_provoke-reaction", label: "Welche Reaktion kann provoziert werden?", labelDu: "Wozu kann dich ein Gegner verleiten?" },
      { id: "exploits_trap", label: "Welche Falle kann gestellt werden?", labelDu: "Welche Falle droht dir?" },
      { id: "exploits_seek-position", label: "Welche Position sollte aktiv gesucht werden?", labelDu: "Welche Position sucht ein Gegner gegen dich?" },
      { id: "exploits_avoid-situations", label: "Welche Situationen sollten vermieden werden?", labelDu: "Was solltest du meiden?" },
    ],
  },
  {
    id: "gameplan",
    label: "Gameplan",
    hint: "Empfohlener Grundplan und Anpassungen",
    accent: "#9D7BFA",
    questions: [
      { id: "gameplan_base-plan", label: "Was ist der empfohlene Grundplan gegen diesen Gegner?", labelDu: "Welcher Plan passt zu dir?" },
      { id: "gameplan_seek-distance", label: "Welche Distanz soll gesucht werden?", labelDu: "Welche Distanz solltest du suchen?" },
      { id: "gameplan_avoid-distance", label: "Welche Distanz soll vermieden werden?", labelDu: "Welche Distanz solltest du meiden?" },
      { id: "gameplan_priority-techniques", label: "Welche Techniken sollen priorisiert werden?", labelDu: "Welche Techniken sind deine Priorität?" },
      { id: "gameplan_round-1", label: "Welche Taktik passt für den Kampfbeginn oder Runde 1?", labelDu: "Wie startest du in den Kampf?" },
      { id: "gameplan_if-pressure", label: "Welche Anpassung ist sinnvoll, wenn der Gegner Druck macht?", labelDu: "Was tust du, wenn dein Gegner Druck macht?" },
      { id: "gameplan_if-passive", label: "Welche Anpassung ist sinnvoll, wenn der Gegner passiv wird?", labelDu: "Was tust du, wenn dein Gegner passiv wird?" },
      { id: "gameplan_key-to-win", label: "Was ist der wichtigste Schlüssel zum Sieg?", labelDu: "Was ist dein Schlüssel zum Sieg?" },
    ],
  },
  {
    id: "drills",
    label: "Drills",
    hint: "Konkrete Vorbereitung im Training",
    accent: "var(--ta-cyan)",
    questions: [
      { id: "drills_preparation", label: "Welche Drills passen zur Vorbereitung?", labelDu: "Welche Drills bringen dich weiter?" },
      { id: "drills_defensive-reaction", label: "Welche defensive Reaktion soll trainiert werden?", labelDu: "Welche Abwehr trainierst du?" },
      { id: "drills_automate-counters", label: "Welche Konter sollen automatisiert werden?", labelDu: "Welche Konter automatisierst du?" },
      { id: "drills_cage-situations", label: "Welche Rand-Situationen (Käfig, Seile, Mattenrand) sollen geübt werden?", labelDu: "Welche Rand-Situationen übst du?" },
      { id: "drills_takedown-sequences", label: "Welche Takedown-, Wurf- oder Anti-Takedown-Sequenzen sind wichtig?", labelDu: "Welche Takedown- und Wurf-Sequenzen übst du?" },
      { id: "drills_sparring-tasks", label: "Welche Sparring-Aufgaben passen zum Gameplan?", labelDu: "Welche Sparring-Aufgaben passen zu dir?" },
    ],
  },
];

// ─── Helfer ──────────────────────────────────────────────────────────────────

/** Map: questionId → Frage (für schnelle Lookups in der Profilansicht). */
export const DNA_QUESTION_BY_ID: Map<string, DnaQuestion> = new Map(
  DNA_CATEGORIES.flatMap((c) => c.questions.map((q) => [q.id, q] as const)),
);

/**
 * Die passende Fassung einer Frage: Gegner-Profil „er" (`label`),
 * Athleten-Profil „du" (`labelDu`). Unbekannte IDs kommen als ID zurück.
 */
export function frageLabel(
  questionId: string,
  mode: "opponent" | "athlete",
): string {
  const q = DNA_QUESTION_BY_ID.get(questionId);
  if (!q) return questionId;
  return mode === "athlete" ? q.labelDu : q.label;
}

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
  /**
   * Die Fragen, die für dieses Profil gelten — seit den Kampfart-Steckbriefen
   * (17.09.2026) `offeneFragen(sport)` aus lib/kampfart-steckbrief.ts. Ohne
   * Angabe der ganze Katalog.
   */
  fragen?: readonly string[],
): number {
  if (!answers) return 0;
  if (fragen) {
    if (fragen.length === 0) return 0;
    const n = fragen.reduce((k, id) => (isAnswered(answers[id]) ? k + 1 : k), 0);
    return Math.round((n / fragen.length) * 100);
  }
  if (DNA_TOTAL_QUESTIONS === 0) return 0;
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
