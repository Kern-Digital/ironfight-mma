import type { TimerConfig } from "./use-workout-timer";

export type ExerciseBlock = {
  name: string;
  format: string;
  notes?: string;
};

export type DisciplinePlan = {
  slug: "boxing" | "wrestling" | "bjj" | "muay-thai";
  name: string;
  tag: string;
  level: string;
  short: string;
  description: string;
  preset: TimerConfig;
  blocks: {
    title: string;
    exercises: ExerciseBlock[];
  }[];
  accent: string;
};

export const TRAINING_PLANS: DisciplinePlan[] = [
  {
    slug: "boxing",
    name: "Boxing",
    tag: "Stand-Up",
    level: "Alle Level",
    short: "Footwork, Combinations, Defense.",
    description:
      "Klassisches Boxing-Workout. Fokus auf saubere Technik, Bewegung und Konditionierung. 3-Minuten-Runden mit aktiver Erholung.",
    preset: { rounds: 5, workSeconds: 180, restSeconds: 60, prepSeconds: 10 },
    accent: "from-[#23C4CE]/40", // Boxen = Cyan (lib/discipline-colors.ts)
    blocks: [
      {
        title: "Aufwärmen",
        exercises: [
          { name: "Seilspringen", format: "3 × 3 min", notes: "Schritte wechseln, leichtes Tempo aufbauen" },
          { name: "Schattenboxen", format: "3 × 3 min", notes: "Footwork, Kopfbewegung, Kombinationen einüben" },
        ],
      },
      {
        title: "Technik",
        exercises: [
          { name: "Jab-Cross-Hook am Sandsack", format: "5 × 3 min", notes: "Volle Kraft, sauberer Rückzug der Hände" },
          { name: "Defense Drills", format: "3 × 3 min", notes: "Slip, Roll, Parry — mit Partner oder Pads" },
          { name: "Speed Bag", format: "3 × 3 min", notes: "Rhythmus halten" },
        ],
      },
      {
        title: "Konditionierung",
        exercises: [
          { name: "Burpees + Sit-ups", format: "3 × 1 min", notes: "30 s Pause zwischen Sätzen" },
        ],
      },
    ],
  },
  {
    slug: "wrestling",
    name: "Wrestling",
    tag: "Grappling",
    level: "Intermediate",
    short: "Takedowns, Sprawls, Kontrolle.",
    description:
      "Wrestling-Session mit Fokus auf Stand & Motion, Penetration Steps und Takedowns. Hohe Intensität, kurze Pausen.",
    preset: { rounds: 6, workSeconds: 120, restSeconds: 45, prepSeconds: 10 },
    accent: "from-[#FF4FA8]/40", // Wrestling = Pink
    blocks: [
      {
        title: "Aufwärmen",
        exercises: [
          { name: "Stance & Motion", format: "3 × 3 min", notes: "Grundposition, Level Changes, seitliches Bewegen" },
          { name: "Penetration Steps", format: "4 × 30 s", notes: "Explosive Schussbewegung aus dem Stand" },
        ],
      },
      {
        title: "Takedowns",
        exercises: [
          { name: "Single-Leg Takedown", format: "3 × 10 Reps pro Seite", notes: "Kontrollierter Aufbau, dann mit Tempo" },
          { name: "Double-Leg Takedown", format: "3 × 10 Reps", notes: "Tiefer Schuss, Kopf nach oben" },
          { name: "Sprawl Drill", format: "5 × 30 s", notes: "Reaktiv auf Partner-Schuss" },
        ],
      },
      {
        title: "Live",
        exercises: [
          { name: "Top / Bottom Positional Sparring", format: "3 × 2 min", notes: "Rollenwechsel nach jeder Runde" },
          { name: "Wrestler Ladder", format: "1 × 5 min", notes: "Sprawl + Sprint im Wechsel, ohne Pause" },
        ],
      },
    ],
  },
  {
    slug: "bjj",
    name: "Brazilian Jiu-Jitsu",
    tag: "Ground",
    level: "Anfänger → Fortgeschritten",
    short: "Submissions, Sweeps, Guards.",
    description:
      "Bodenkampf-Session. Saubere Mechanik vor Geschwindigkeit. Lange Sparring-Runden — Position vor Submission.",
    preset: { rounds: 5, workSeconds: 300, restSeconds: 60, prepSeconds: 10 },
    accent: "from-[#FFB648]/40", // BJJ/Boden = Amber
    blocks: [
      {
        title: "Solo-Movements",
        exercises: [
          { name: "Hip Escape (Shrimp)", format: "3 × 10 Reps pro Seite", notes: "Schultern flach, Hüfte explosiv weg" },
          { name: "Technical Stand-up", format: "3 × 10 Reps", notes: "Hand am Boden, Auge am Gegner" },
          { name: "Bridge & Roll", format: "3 × 10 Reps", notes: "Aus Mount-Verteidigung" },
        ],
      },
      {
        title: "Technik",
        exercises: [
          { name: "Scissor Sweep aus Closed Guard", format: "3 × 10 Reps", notes: "Beide Seiten" },
          { name: "Arm Bar from Guard", format: "3 × 10 Reps", notes: "Hüfte raus, Bein über den Kopf" },
          { name: "Triangle from Guard", format: "3 × 10 Reps", notes: "Winkel kontrollieren" },
        ],
      },
      {
        title: "Sparring",
        exercises: [
          { name: "Positional Sparring (Side Control)", format: "5 × 3 min", notes: "Top hält, Bottom escaped" },
          { name: "Free Roll", format: "5 × 5 min", notes: "Lockerer Flow, Position vor Submission" },
        ],
      },
    ],
  },
  {
    slug: "muay-thai",
    name: "Muay Thai",
    tag: "Stand-Up",
    level: "Alle Level",
    short: "Knies, Ellbogen, Clinch.",
    description:
      "Muay Thai mit allen acht Gliedmaßen. Schienbein-Konditionierung, schwere Kicks, Clinch-Arbeit.",
    preset: { rounds: 5, workSeconds: 180, restSeconds: 60, prepSeconds: 10 },
    accent: "from-[#8A63E8]/40", // Muay Thai/Kicks = Violett
    blocks: [
      {
        title: "Aufwärmen",
        exercises: [
          { name: "Seilspringen", format: "3 × 3 min", notes: "Hohe Knie, schnelle Füße" },
          { name: "Schienbein-Konditionierung am Sandsack", format: "3 × 2 min", notes: "Kontrollierte Low Kicks" },
        ],
      },
      {
        title: "Technik",
        exercises: [
          { name: "Teep & Roundhouse Drill", format: "5 × 3 min", notes: "Distanzkontrolle, beide Beine" },
          { name: "Knee Strike Drill", format: "4 × 2 min", notes: "Aus dem Clinch, am Sandsack" },
          { name: "Elbow Drill", format: "3 × 2 min", notes: "Pads, kurze Distanz" },
        ],
      },
      {
        title: "Sparring",
        exercises: [
          { name: "Clinch Sparring", format: "4 × 3 min", notes: "Knies, Würfe, Kontrolle" },
          { name: "Pad Work", format: "5 × 3 min", notes: "Volle Kombinationen, hohes Tempo" },
        ],
      },
    ],
  },
];

export function getPlanBySlug(slug: string): DisciplinePlan | undefined {
  return TRAINING_PLANS.find((p) => p.slug === slug);
}
