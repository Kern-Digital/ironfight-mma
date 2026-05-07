// ─── Typen ────────────────────────────────────────────────────
export interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

export interface SportQuiz {
  id: string;
  name: string;
  icon: string;
  color: string;
  quiz: QuizQuestion[];
}

// ─── Quiz-Daten ───────────────────────────────────────────────
export const SPORT_QUIZZES: SportQuiz[] = [
  {
    id: "mma",
    name: "MMA",
    icon: "🥊",
    color: "text-blood border-blood/60 bg-blood/10",
    quiz: [
      {
        question: "Wie lange dauert eine reguläre MMA-Profi-Runde?",
        options: ["3 Minuten", "5 Minuten", "8 Minuten", "10 Minuten"],
        correct: 1,
        explanation:
          "Eine reguläre MMA-Profi-Runde dauert 5 Minuten, mit 1 Minute Pause dazwischen.",
      },
      {
        question: "Was bedeutet TKO im MMA?",
        options: ["Total Knockout", "Technischer Knockout", "Timed Knockout", "Team Knockout"],
        correct: 1,
        explanation:
          "TKO steht für Technischer Knockout — der Schiedsrichter stoppt den Kampf, weil sich ein Kämpfer nicht mehr verteidigen kann.",
      },
      {
        question: "Welche Technik ist im MMA erlaubt?",
        options: ["Kopfstoß", "Armbar aus der Guard", "Schlag auf den Hinterkopf", "Tritt in die Leiste"],
        correct: 1,
        explanation:
          "Der Armbar (Armhebel) aus der Closed Guard ist eine klassische Submission und voll erlaubt.",
      },
      {
        question: "Wie viele Runden hat ein MMA-Titelkampf?",
        options: ["3 Runden", "4 Runden", "5 Runden", "6 Runden"],
        correct: 2,
        explanation: "Titelkämpfe im MMA gehen über 5 Runden à 5 Minuten.",
      },
      {
        question: "Was bedeutet Submission?",
        options: [
          "Eine KO-Niederlage durch Schläge",
          "Aufgabe durch Würger oder Gelenkhebelungen",
          "Technischer Knockout durch den Schiedsrichter",
          "Niederlage nach Punkten",
        ],
        correct: 1,
        explanation:
          "Submission bedeutet, dass ein Kämpfer durch eine Würge- oder Hebeltechnik aufgibt (Tap-out) oder das Bewusstsein verliert.",
      },
      {
        question: "Was ist beim MMA VERBOTEN?",
        options: ["Tritte auf den Körper", "Kniestöße", "Schläge auf den Hinterkopf", "Ellbogenschläge"],
        correct: 2,
        explanation:
          "Schläge auf den Hinterkopf sind im MMA verboten, da sie das Gehirn besonders gefährlich treffen können.",
      },
      {
        question: "Welches Punktesystem wird im MMA verwendet?",
        options: ["5-Punkt-System", "10-Punkt-Must-System", "15-Punkt-System", "Es gibt keine Punkte"],
        correct: 1,
        explanation:
          "Im MMA gilt das 10-Punkt-Must-System: Der Rundensieger erhält 10, der Verlierer 9 oder weniger.",
      },
      {
        question: "Was passiert bei einem unbeabsichtigten Foul, das einen Kämpfer kampfunfähig macht?",
        options: [
          "Der Verursacher wird disqualifiziert",
          "Die Runde wird wiederholt",
          "Es kommt zu einer technischen Entscheidung",
          "Der Kampf endet automatisch unentschieden",
        ],
        correct: 2,
        explanation:
          "Bei einem unbeabsichtigten Foul, das den Kampf beendet, entscheiden die Punktrichter über den Ausgang (Technical Decision).",
      },
    ],
  },
  {
    id: "bjj",
    name: "BJJ",
    icon: "🥋",
    color: "text-blue-400 border-blue-400/60 bg-blue-400/10",
    quiz: [
      {
        question: "Wie viele Punkte gibt ein Takedown im BJJ?",
        options: ["1 Punkt", "2 Punkte", "3 Punkte", "4 Punkte"],
        correct: 1,
        explanation:
          "Ein Takedown gibt 2 Punkte — der Kämpfer muss den Gegner kontrolliert zu Boden bringen.",
      },
      {
        question: "Wie viele Punkte bringt die Mount-Position?",
        options: ["2 Punkte", "3 Punkte", "4 Punkte", "5 Punkte"],
        correct: 2,
        explanation: "Mount gibt 4 Punkte — es ist eine der dominantesten Positionen im BJJ.",
      },
      {
        question: "Was ist ein 'Advantage' im BJJ?",
        options: [
          "Ein sofortiger Sieg",
          "Ein halber Punkt für beinahe erfolgreiche Aktionen",
          "Eine Strafe für den Gegner",
          "Freie Submission-Technik",
        ],
        correct: 1,
        explanation:
          "Ein Advantage ist ein halber Punkt für nahezu abgeschlossene Aktionen wie near-Sweeps oder near-Submissions — bei Gleichstand entscheidend.",
      },
      {
        question: "Was ist beim Guard Pass erlaubt?",
        options: [
          "Den Gegner schlagen",
          "Die Beine des Gegners umgehen und seitliche Kontrolle erlangen",
          "Den Gegner hochheben und werfen",
          "Kleine Gelenke drehen",
        ],
        correct: 1,
        explanation:
          "Guard Pass bedeutet, die Beine des Gegners zu umgehen und stabile Seitkontrolle (Side Control) zu erlangen.",
      },
      {
        question: "Wie viele Punkte gibt Back Control?",
        options: ["2 Punkte", "3 Punkte", "4 Punkte", "5 Punkte"],
        correct: 2,
        explanation: "Back Control (hinter dem Gegner mit Hooks) gibt 4 Punkte — genau wie Mount.",
      },
      {
        question: "Was ist ein 'Hip Escape' (Shrimp)?",
        options: [
          "Ein Angriff mit der Hüfte",
          "Eine explosive seitliche Hüftbewegung zum Entkommen aus Kontrollpositionen",
          "Ein Takedown",
          "Eine Würgetechnik",
        ],
        correct: 1,
        explanation:
          "Hip Escape (Shrimp) ist die fundamentalste BJJ-Bewegung: Die Hüfte explosiv zur Seite schieben, um aus Kontrollpositionen wie Mount oder Side Control zu entkommen.",
      },
      {
        question: "Was gewinnt bei Punktegleichstand?",
        options: [
          "Immer der Jüngere",
          "Der Kämpfer mit mehr Advantages",
          "Der Kämpfer mit weniger Strafen",
          "Es wird eine Verlängerung gespielt",
        ],
        correct: 1,
        explanation:
          "Bei gleicher Punktzahl entscheiden Advantages. Sind auch diese gleich, entscheidet der Schiedsrichter (Referee Decision).",
      },
      {
        question: "Welche Submission ist für alle Gürtelgrade erlaubt?",
        options: ["Heel Hook", "Kneebar", "Armbar", "Reaping"],
        correct: 2,
        explanation:
          "Der Armbar ist eine grundlegende und sichere Arm-Hebelung, die für alle Gürtelgrade erlaubt ist.",
      },
    ],
  },
  {
    id: "boxing",
    name: "Boxen",
    icon: "🥊",
    color: "text-yellow-400 border-yellow-400/60 bg-yellow-400/10",
    quiz: [
      {
        question: "Welche Treffer zählen im Boxen?",
        options: [
          "Treffer mit dem Handschuhrücken",
          "Treffer mit den Knöcheln auf Kopf oder Oberkörper",
          "Treffer unterhalb der Gürtellinie",
          "Treffer mit dem Ellbogen",
        ],
        correct: 1,
        explanation:
          "Nur Treffer mit dem Frontteil (Knöcheln) des Handschuhs auf Kopf oder Oberkörper sind gültig.",
      },
      {
        question: "Wie lange dauert eine Profi-Box-Runde?",
        options: ["2 Minuten", "3 Minuten", "5 Minuten", "10 Minuten"],
        correct: 1,
        explanation:
          "Eine Profi-Box-Runde dauert 3 Minuten, mit 1 Minute Pause dazwischen.",
      },
      {
        question: "Was bedeutet TKO im Boxen?",
        options: [
          "Der Boxer wird bewusstlos",
          "Der Boxer steigt freiwillig aus",
          "Der Schiedsrichter oder der Arzt stoppt den Kampf",
          "Der Ringrichter zählt bis 10",
        ],
        correct: 2,
        explanation:
          "TKO (Technischer Knockout) bedeutet, dass der Schiedsrichter, der Eckenarzt oder die Ecke (Handtuch) den Kampf stoppt.",
      },
      {
        question: "Welche Schläge sind im Boxen VERBOTEN?",
        options: ["Jab", "Uppercut", "Hook", "Rabbit Punch (Hinterkopf)"],
        correct: 3,
        explanation:
          "Der Rabbit Punch (Schlag auf den Hinterkopf oder Nacken) ist gefährlich und verboten.",
      },
      {
        question: "Wie viele Punkte bekommt der Rundensieger beim 10-Punkt-System?",
        options: ["5 Punkte", "8 Punkte", "9 Punkte", "10 Punkte"],
        correct: 3,
        explanation:
          "Der Rundensieger erhält immer 10 Punkte, der Verlierer in der Regel 9 — daher 'Must'-System.",
      },
      {
        question: "Was ist eine 'Split Decision'?",
        options: [
          "Alle drei Ringrichter sehen denselben Sieger",
          "Zwei Richter für einen Kämpfer, einer für den anderen",
          "Alle Richter werten Unentschieden",
          "Der Kampf wird nach Fouls abgebrochen",
        ],
        correct: 1,
        explanation:
          "Split Decision: Zwei von drei Ringrichtern sehen einen Sieger, der dritte sieht den anderen Kämpfer als Sieger.",
      },
      {
        question: "Was ist eine 'Standing 8 Count'?",
        options: [
          "Der Boxer steht für 8 Sekunden in der neutralen Ecke",
          "Der Schiedsrichter zählt bis 8 bei einem angeschlagenen Boxer, bevor er weiterkämpfen darf",
          "8 Runden werden absolviert",
          "Acht Warnungen führen zur Disqualifikation",
        ],
        correct: 1,
        explanation:
          "Standing 8 Count: Auch ohne Knockdown kann der Schiedsrichter bis 8 zählen, wenn ein Boxer angeschlagen wirkt — danach entscheidet er, ob der Kampf weitergeht.",
      },
      {
        question: "Was passiert, wenn ein Boxer zu häufig verwarnt wird?",
        options: [
          "Er gewinnt automatisch",
          "Der Kampf beginnt von vorne",
          "Er verliert Punkte oder wird disqualifiziert",
          "Nichts — Verwarnungen haben keine Wirkung",
        ],
        correct: 2,
        explanation:
          "Wiederholte Verwarnungen führen zu Punktabzügen. Bei schweren oder wiederholten Verstößen folgt die Disqualifikation.",
      },
    ],
  },
];
