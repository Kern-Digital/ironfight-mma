/**
 * Demo-Seed-System für Testschüler
 *
 * Schreibt realistische, klar als Demo gekennzeichnete Fortschrittsdaten in
 * Firestore-Subcollections eines Schülers (workouts / library / subscriptions /
 * participations / techniqueProgress / sparringLog / weightLog).
 *
 * Jedes Demo-Dokument trägt das Feld `isDemo: true` — `clearDemoData` löscht
 * gezielt nur diese Einträge und tastet keine echten User-Daten an.
 *
 * Datenschutz: Die Daten sind fiktiv. `isDemo` und ein Banner im Admin-UI
 * machen das in Firestore und im UI sichtbar.
 *
 * Personas: 3 vorgefertigte Profile (Anfänger / Fortgeschritten / Wettkämpfer).
 * Der Wettkämpfer ist für die Fight-Camp-Demo gezielt asymmetrisch trainiert
 * (viel Striking, wenig Takedown-Defense) — die Analyse erkennt das.
 */

import {
  collection,
  doc,
  getDocs,
  query,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { getFirestoreDb } from "./firebase";
import { TRAINING_BLOCKS } from "./schedule";
import { ALL_TECHNIQUES } from "./techniques";
import { EXERCISES } from "./exercises";
import { updateAthleteProfile } from "./user-profile";
import { getFightProfile, updateFightProfile } from "./fight-profile";
import type { GegnerDnaAnswers } from "./gegner-dna";
import type { ActionStat, DnaSplit } from "./fight-stats";
import type {
  AthleteLevel,
  Category,
  Discipline,
  TechniqueProgressStatus,
  WeightClass,
} from "./types";

// ─── Personas ──────────────────────────────────────────────────────────────

export type DemoPersona = "beginner" | "intermediate" | "competitor";

export const DEMO_PERSONA_LABEL: Record<DemoPersona, string> = {
  beginner: "Anfänger — 6 Monate aktiv",
  intermediate: "Fortgeschritten — 14 Monate, stabile Routine",
  competitor: "Wettkämpfer — 18 Monate, Kampf in 4 Monaten",
};

export const DEMO_PERSONA_DESCRIPTION: Record<DemoPersona, string> = {
  beginner:
    "Frisch dabei. Grundtechniken, unregelmäßige Trainingsfrequenz, viel Boxing/Wrestling-Basis.",
  intermediate:
    "Stabile 2–3× pro Woche. Bandbreite Striking + Grappling. Erste Sparring-Sessions.",
  competitor:
    "Erfahrener Athlet mit Wettkampf in 4 Monaten. Bewusst asymmetrisch trainiert — viel Striking, schwache Takedown-Defense und Grappling-Bereiche. Perfekt für die Fight-Camp-Analyse.",
};

interface PersonaConfig {
  athlete: {
    primaryDiscipline: Discipline;
    level: AthleteLevel;
    weightKg: number;
    heightCm: number;
    weightClass: WeightClass;
    gymName: string;
    trainerName: string;
    /** Monate, die der Athlet schon trainiert (Trainingsstart = jetzt - X Monate) */
    trainingMonths: number;
    /** Optional: nächster Wettkampf in X Monaten ab heute */
    nextCompetitionMonths?: number;
    nextCompetitionName?: string;
  };
  /** Durchschnittliche Workouts pro Woche */
  workoutsPerWeek: number;
  /** Verteilung der Kategorien (muss zu 1.0 summieren) */
  categoryMix: Record<Category, number>;
  /** Standard-Workout-Längen */
  workoutPattern: { minRounds: number; maxRounds: number; minWork: number; maxWork: number };
  /** Anteil abgebrochener Workouts (0..1) */
  abortedRate: number;
  /** Anzahl Library-Einträge */
  libraryCount: number;
  /** Anzahl Kurs-Abos */
  subscriptionCount: number;
  /** Wieviele Techniken werden im Progress getrackt */
  techniqueProgressCount: number;
  /** Welche TrainingArea-Tags sollen unterrepräsentiert sein (für Fight-Camp-Analyse) */
  underTrainedAreas?: string[];
  /** Anzahl Sparring-Einträge */
  sparringCount: number;
  /** Gewichts-Tracking-Einträge (für Cut/Bulk-Verlauf) */
  weightEntries: number;
}

const PERSONA_CONFIGS: Record<DemoPersona, PersonaConfig> = {
  beginner: {
    athlete: {
      primaryDiscipline: "mma",
      level: "beginner",
      weightKg: 78,
      heightCm: 178,
      weightClass: "welterweight",
      gymName: "Tidal Athletics MMA",
      trainerName: "Alec",
      trainingMonths: 6,
    },
    workoutsPerWeek: 1.6,
    categoryMix: { boxing: 0.45, wrestling: 0.2, bjj: 0.15, "muay-thai": 0.2 },
    workoutPattern: { minRounds: 3, maxRounds: 6, minWork: 120, maxWork: 240 },
    abortedRate: 0.18,
    libraryCount: 14,
    subscriptionCount: 2,
    techniqueProgressCount: 12,
    sparringCount: 4,
    weightEntries: 8,
  },
  intermediate: {
    athlete: {
      primaryDiscipline: "mma",
      level: "intermediate",
      weightKg: 82,
      heightCm: 181,
      weightClass: "middleweight",
      gymName: "Tidal Athletics MMA",
      trainerName: "Alec",
      trainingMonths: 14,
    },
    workoutsPerWeek: 2.7,
    categoryMix: { boxing: 0.3, wrestling: 0.22, bjj: 0.22, "muay-thai": 0.26 },
    workoutPattern: { minRounds: 4, maxRounds: 8, minWork: 180, maxWork: 300 },
    abortedRate: 0.08,
    libraryCount: 38,
    subscriptionCount: 3,
    techniqueProgressCount: 28,
    sparringCount: 18,
    weightEntries: 26,
  },
  competitor: {
    athlete: {
      primaryDiscipline: "mma",
      level: "competitor",
      weightKg: 86,
      heightCm: 183,
      weightClass: "light-heavyweight",
      gymName: "Tidal Athletics MMA",
      trainerName: "Alec",
      trainingMonths: 18,
      nextCompetitionMonths: 4,
      nextCompetitionName: "Fight Night Match",
    },
    // Asymmetrische Verteilung — viel Striking, wenig Grappling/Wrestling
    workoutsPerWeek: 3.6,
    categoryMix: { boxing: 0.4, "muay-thai": 0.3, wrestling: 0.12, bjj: 0.18 },
    workoutPattern: { minRounds: 5, maxRounds: 10, minWork: 180, maxWork: 360 },
    abortedRate: 0.05,
    libraryCount: 56,
    subscriptionCount: 4,
    techniqueProgressCount: 42,
    /**
     * Bewusste Schwachstellen für die Fight-Camp-Analyse:
     * — wenig Takedown-Defense
     * — wenig Bottom-Game (Guard, Escapes, Sweeps)
     * — wenig Clinch
     */
    underTrainedAreas: ["takedown-defense", "guard", "escapes", "sweeps", "clinch"],
    sparringCount: 34,
    weightEntries: 52,
  },
};

// ─── DeepFight-Beispielprofil (users/{uid}.fightProfile) ───────────────────
// Als Demo markiert über updatedBy = DEMO_SEED_AUTHOR — clearDemoData setzt
// NUR solche Profile zurück und tastet echte (Trainer-gepflegte) nie an.
// Texte sind entwicklungsorientiert formuliert: der Athlet liest sein
// eigenes Profil unter /kampfprofil.

const DEMO_SEED_AUTHOR = "demo-seed";

interface DemoFightProfile {
  dna: GegnerDnaAnswers;
  dnaSplit: DnaSplit;
  dnaSplitWeight: number;
  actionStats: ActionStat[];
}

const DEMO_FIGHT_PROFILE: Record<DemoPersona, DemoFightProfile> = {
  beginner: {
    dna: {
      "real-habits_repeats": "Sucht nach dem Jab sofort die Distanz — bleibt selten in der Schlagfolge.",
      "preferred-weapons_most-common": "Jab-Cross, sauber aber noch vorhersehbar getimt.",
      "weaknesses_technical": "Deckung fällt beim Zurückweichen; Low-Kick-Defense noch ohne Check.",
      "drills_preparation": "Jab-Cross-Hook am Sandsack, Partner-Drill: Check gegen Low Kicks.",
    },
    dnaSplit: { boxing: 52, kicking: 20, wrestling: 14, ground: 8, clinch: 6 },
    dnaSplitWeight: 0.8,
    actionStats: [
      { id: "jab", attempted: 24, landed: 14, zone: "center" },
      { id: "cross", attempted: 12, landed: 6 },
      { id: "low-kick", attempted: 8, landed: 5 },
      { id: "single-leg", attempted: 2, landed: 0 },
    ],
  },
  intermediate: {
    dna: {
      "real-habits_repeats": "Startet fast jede Offensive mit dem Jab; nach Treffern sofort Winkelwechsel nach links.",
      "real-habits_when-tired": "Ab Runde 3 sinkt die Führhand — dann kommen Gegentreffer über die Außenbahn.",
      "entry-patterns_start": "Jab-Feint → Cross oder Level-Change; Entries werden variabler.",
      "preferred-weapons_most-common": "Jab-Cross-Low-Kick als Standardkombination.",
      "preferred-weapons_combo": "1-2 → Low Kick; gegen Southpaws 1-2-3.",
      "defensive-reactions_pressure": "Weicht linear zurück statt im Winkel — daran arbeiten wir.",
      "weaknesses_technical": "Takedown-Defense gegen Body Locks; Guard-Retention nach Sweeps.",
      "gameplan_priority-techniques": "Distanz halten, Teep etablieren, Low Kicks konsequent mitnehmen.",
    },
    dnaSplit: { boxing: 34, kicking: 24, wrestling: 16, ground: 14, clinch: 12 },
    dnaSplitWeight: 1.7,
    actionStats: [
      { id: "jab", attempted: 52, landed: 33, zone: "center" },
      { id: "cross", attempted: 27, landed: 14, setup: "Nach Jab-Feint" },
      { id: "hook", attempted: 15, landed: 8 },
      { id: "low-kick", attempted: 21, landed: 15, setup: "Nach 1-2" },
      { id: "body-kick", attempted: 9, landed: 5 },
      { id: "front-kick", attempted: 11, landed: 7, zone: "center" },
      { id: "double-leg", attempted: 5, landed: 2, zone: "cage" },
      { id: "pass", attempted: 4, landed: 2 },
    ],
  },
  competitor: {
    dna: {
      "real-habits_repeats": "Eröffnet konstant mit Jab-Druck und schneidet den Ring ab; nach eigenen Treffern sofort Nachfassen mit dem Cross.",
      "real-habits_after-hit": "Bleibt nach Treffern ruhig, geht in den Clinch und arbeitet mit Knien weiter.",
      "real-habits_when-tired": "Hände sinken ab Runde 3 leicht — Konditionsblock im Camp adressiert das bereits.",
      "real-habits_after-td-attempt": "Nach abgewehrtem Takedown sofortiges Sprawl-and-Brawl — stark im Scramble.",
      "entry-patterns_start": "Jab → Cross oder Jab → Low Kick; gelegentlich Feint-Level-Change als Setup für die Rechte.",
      "entry-patterns_center-or-cage": "Dominiert das Center und drückt den Gegner ans Gitter, bevor der Angriff kommt.",
      "entry-patterns_counter": "Anfällig für Teep-Konter beim Vorwärtsdruck — im Sparring gezielt üben.",
      "preferred-weapons_most-common": "Der Jab — hohe Frequenz, kontrolliert die Distanz.",
      "preferred-weapons_most-dangerous": "Rechter Cross über die Mitte, besonders als Konter.",
      "preferred-weapons_combo": "1-2 → Low Kick; am Cage 1-2 → Body Lock.",
      "preferred-weapons_finish": "Ground & Pound aus der Top-Position.",
      "defensive-reactions_pressure": "Kontert unter Druck mit Check-Hook und Winkelwechsel — sehr stabil.",
      "defensive-reactions_takedowns": "Starkes Sprawl-Timing; gegen Body Locks am Cage noch ausbaufähig.",
      "cage-space_center-movement": "Kleine Schritte, gute Balance, schneidet Winkel statt zu jagen.",
      "weaknesses_technical": "Bottom-Game: Guard-Retention und Escapes nach verlorenem Scramble sind die klare Baustelle.",
      "weaknesses_bad-distance": "Clinch-Distanz gegen körperlich stärkere Gegner meiden.",
      "gameplan_base-plan": "Kampf im Stand halten, Striking-Vorteil ausspielen, Takedowns früh abwehren.",
      "gameplan_key-to-win": "Jab-Kontrolle plus Low-Kick-Investment — den Gegner in Runde 3 langsam machen.",
      "drills_takedown-sequences": "Anti-Body-Lock am Cage, Guard-Retention-Zirkel, Wall-Walks.",
      "drills_sparring-tasks": "Runden mit Startposition Unterlage — Escapes unter Druck automatisieren.",
    },
    dnaSplit: { boxing: 36, kicking: 26, wrestling: 12, ground: 12, clinch: 14 },
    dnaSplitWeight: 2.6,
    actionStats: [
      { id: "jab", attempted: 86, landed: 58, zone: "center" },
      { id: "cross", attempted: 41, landed: 22, setup: "Nach Jab" },
      { id: "hook", attempted: 28, landed: 15, setup: "Als Check-Hook beim Rückwärtsgehen" },
      { id: "uppercut", attempted: 9, landed: 4, zone: "cage" },
      { id: "elbow", attempted: 6, landed: 4, zone: "cage" },
      { id: "low-kick", attempted: 33, landed: 24, setup: "Nach 1-2" },
      { id: "body-kick", attempted: 18, landed: 11 },
      { id: "high-kick", attempted: 6, landed: 2 },
      { id: "front-kick", attempted: 12, landed: 8, zone: "center" },
      { id: "knee", attempted: 9, landed: 6, zone: "cage", setup: "Im Clinch nach Collar Tie" },
      { id: "single-leg", attempted: 7, landed: 3, zone: "open" },
      { id: "double-leg", attempted: 5, landed: 2, zone: "cage" },
      { id: "body-lock", attempted: 3, landed: 2, zone: "cage" },
      { id: "pass", attempted: 6, landed: 4 },
      { id: "submission", attempted: 4, landed: 1 },
      { id: "ground-strikes", attempted: 14, landed: 10 },
    ],
  },
};

// ─── PRNG (deterministisch pro Persona für reproduzierbare Demos) ──────────

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function weightedPick<K extends string>(
  rng: () => number,
  weights: Record<K, number>,
): K {
  const keys = Object.keys(weights) as K[];
  const total = keys.reduce((s, k) => s + weights[k], 0);
  let r = rng() * total;
  for (const k of keys) {
    r -= weights[k];
    if (r <= 0) return k;
  }
  return keys[keys.length - 1];
}

function chance(rng: () => number, p: number): boolean {
  return rng() < p;
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// ─── Persona → Daten generieren ────────────────────────────────────────────

const CATEGORY_LABEL: Record<Category, string> = {
  boxing: "Boxing",
  wrestling: "Wrestling",
  bjj: "BJJ",
  "muay-thai": "Muay Thai",
};

interface GeneratedData {
  workouts: WorkoutDocData[];
  libraryEntries: LibraryDocData[];
  subscriptions: SubscriptionDocData[];
  participations: ParticipationDocData[];
  techniqueProgress: TechniqueProgressDocData[];
  sparringEntries: SparringDocData[];
  weightLog: WeightLogDocData[];
}

interface WorkoutDocData {
  label: string;
  category: Category;
  difficulty: "anfaenger" | "fortgeschritten" | "pro";
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  totalWorkSeconds: number;
  completedAt: Date;
  status: "completed" | "aborted";
  exerciseIds: string[];
  techniqueIds: string[];
  isDemo: true;
}

interface LibraryDocData {
  id: string;
  exerciseId: string;
  type: "exercise" | "technique";
  source: "training" | "manual";
  contextLabel: string | null;
  addedAt: Date;
  isDemo: true;
}

interface SubscriptionDocData {
  trainingBlockId: string;
  blockTitle: string;
  weekday: number;
  startTime: string;
  subscribedAt: Date;
  isDemo: true;
}

interface ParticipationDocData {
  id: string;
  trainingSessionId: string;
  trainingBlockId: string;
  blockTitle: string;
  weekIdentifier: string;
  joinedAt: Date;
  isDemo: true;
}

interface TechniqueProgressDocData {
  techniqueId: string;
  status: TechniqueProgressStatus;
  practiceCount: number;
  lastPracticedAt: Date;
  isDemo: true;
}

interface SparringDocData {
  date: Date;
  category: Category;
  partner: string;
  rounds: number;
  notes: string;
  rating: number;
  isDemo: true;
}

interface WeightLogDocData {
  date: Date;
  weightKg: number;
  notes?: string;
  isDemo: true;
}

const FAKE_PARTNERS = [
  "Marco",
  "Jens",
  "David",
  "Yusuf",
  "Lukas",
  "Tom",
  "Erik",
  "Hannes",
  "Niko",
];

const WEEKDAY_IDENTIFIER = (d: Date): string => {
  const cursor = new Date(d);
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() + 4 - (cursor.getDay() || 7));
  const yearStart = new Date(cursor.getFullYear(), 0, 1);
  const weekNo = Math.ceil(
    ((cursor.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${cursor.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

function pickTechniquesForCategory(
  rng: () => number,
  category: Category,
  count: number,
  underTrained: Set<string>,
): string[] {
  const pool = ALL_TECHNIQUES.filter((t) => t.category === category);
  if (pool.length === 0) return [];
  const ids: string[] = [];
  for (let i = 0; i < count * 3 && ids.length < count; i++) {
    const t = pick(rng, pool);
    const areas = Array.isArray(t.trainingArea)
      ? t.trainingArea
      : t.trainingArea
        ? [t.trainingArea]
        : [];
    // 80% weniger Chance bei untertrainierten Bereichen
    if (areas.some((a) => underTrained.has(a)) && rng() < 0.8) continue;
    if (!ids.includes(t.id)) ids.push(t.id);
  }
  return ids;
}

function pickExercisesForCategory(
  rng: () => number,
  category: Category,
  count: number,
): string[] {
  const pool = EXERCISES.filter(
    (e) => e.category === category || e.category === "any",
  );
  if (pool.length === 0) return [];
  const ids: string[] = [];
  for (let i = 0; i < count * 3 && ids.length < count; i++) {
    const e = pick(rng, pool);
    if (!ids.includes(e.id)) ids.push(e.id);
  }
  return ids;
}

function generateForPersona(persona: DemoPersona): GeneratedData {
  const cfg = PERSONA_CONFIGS[persona];
  const rng = mulberry32(
    persona === "beginner" ? 11 : persona === "intermediate" ? 222 : 4242,
  );
  const now = new Date();
  const trainingStartMs =
    now.getTime() - cfg.athlete.trainingMonths * 30 * 24 * 3600 * 1000;
  const totalWeeks = Math.floor(cfg.athlete.trainingMonths * 4.33);
  const underTrained = new Set(cfg.underTrainedAreas ?? []);

  // ── Workouts ─────────────────────────────────────────────────────────────
  const workouts: WorkoutDocData[] = [];
  for (let week = 0; week < totalWeeks; week++) {
    // Anzahl Sessions pro Woche — leicht schwankend
    const wkAdj = 0.7 + rng() * 0.6;
    const sessions = Math.max(0, Math.round(cfg.workoutsPerWeek * wkAdj));
    for (let s = 0; s < sessions; s++) {
      // Position in der Woche
      const dayOffset = randInt(rng, 0, 6);
      const hourOffset = randInt(rng, 17, 21);
      const date = new Date(trainingStartMs + week * 7 * 24 * 3600 * 1000);
      date.setDate(date.getDate() + dayOffset);
      date.setHours(hourOffset, randInt(rng, 0, 59), 0, 0);

      // Erst nach Trainingsbeginn, vor jetzt
      if (date.getTime() > now.getTime()) continue;

      const category = weightedPick(rng, cfg.categoryMix);
      const rounds = randInt(
        rng,
        cfg.workoutPattern.minRounds,
        cfg.workoutPattern.maxRounds,
      );
      const workSeconds = randInt(
        rng,
        cfg.workoutPattern.minWork,
        cfg.workoutPattern.maxWork,
      );
      const restSeconds = pick(rng, [30, 45, 60, 60, 90]);
      const aborted = chance(rng, cfg.abortedRate);

      // Schwierigkeit korreliert mit Level + Zeit
      const progress = week / Math.max(1, totalWeeks);
      const difficulty: WorkoutDocData["difficulty"] =
        persona === "beginner"
          ? progress < 0.5
            ? "anfaenger"
            : chance(rng, 0.6)
              ? "anfaenger"
              : "fortgeschritten"
          : persona === "intermediate"
            ? chance(rng, 0.55)
              ? "fortgeschritten"
              : chance(rng, 0.5)
                ? "anfaenger"
                : "pro"
            : chance(rng, 0.5)
              ? "fortgeschritten"
              : chance(rng, 0.7)
                ? "pro"
                : "anfaenger";

      const techniqueIds = pickTechniquesForCategory(
        rng,
        category,
        randInt(rng, 2, 5),
        underTrained,
      );
      const exerciseIds = pickExercisesForCategory(
        rng,
        category,
        randInt(rng, 2, 4),
      );

      const label = aborted
        ? `${CATEGORY_LABEL[category]} (Demo)`
        : pick(rng, [
            `${CATEGORY_LABEL[category]} Drill`,
            `${CATEGORY_LABEL[category]} Skills`,
            `${CATEGORY_LABEL[category]} Conditioning`,
            `${CATEGORY_LABEL[category]} Pads`,
            `${CATEGORY_LABEL[category]} Sparring-Prep`,
          ]);

      workouts.push({
        label,
        category,
        difficulty,
        rounds,
        workSeconds,
        restSeconds,
        totalWorkSeconds: aborted
          ? Math.floor(rounds * workSeconds * (0.2 + rng() * 0.5))
          : rounds * workSeconds,
        completedAt: date,
        status: aborted ? "aborted" : "completed",
        exerciseIds,
        techniqueIds,
        isDemo: true,
      });
    }
  }

  workouts.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());

  // ── Library ──────────────────────────────────────────────────────────────
  const techniquePoolByCategory: Record<Category, string[]> = {
    boxing: ALL_TECHNIQUES.filter((t) => t.category === "boxing").map(
      (t) => t.id,
    ),
    wrestling: ALL_TECHNIQUES.filter((t) => t.category === "wrestling").map(
      (t) => t.id,
    ),
    bjj: ALL_TECHNIQUES.filter((t) => t.category === "bjj").map((t) => t.id),
    "muay-thai": ALL_TECHNIQUES.filter((t) => t.category === "muay-thai").map(
      (t) => t.id,
    ),
  };

  const libraryEntries: LibraryDocData[] = [];
  const usedLibIds = new Set<string>();
  let libTries = 0;
  while (libraryEntries.length < cfg.libraryCount && libTries < cfg.libraryCount * 8) {
    libTries++;
    const category = weightedPick(rng, cfg.categoryMix);
    const isTechnique = chance(rng, 0.65);
    const idPool = isTechnique
      ? techniquePoolByCategory[category]
      : EXERCISES.filter(
          (e) => e.category === category || e.category === "any",
        ).map((e) => e.id);
    if (idPool.length === 0) continue;
    const item = pick(rng, idPool);
    if (usedLibIds.has(item)) continue;

    // Skip wenn Tech untertrained — moderater Filter
    if (isTechnique && underTrained.size > 0) {
      const t = ALL_TECHNIQUES.find((tt) => tt.id === item);
      const areas = t
        ? Array.isArray(t.trainingArea)
          ? t.trainingArea
          : t.trainingArea
            ? [t.trainingArea]
            : []
        : [];
      if (areas.some((a) => underTrained.has(a)) && rng() < 0.85) continue;
    }

    usedLibIds.add(item);

    const daysAgo = randInt(rng, 1, cfg.athlete.trainingMonths * 30);
    const addedAt = new Date(now.getTime() - daysAgo * 24 * 3600 * 1000);
    libraryEntries.push({
      id: item,
      exerciseId: item,
      type: isTechnique ? "technique" : "exercise",
      source: chance(rng, 0.7) ? "training" : "manual",
      contextLabel: pick(rng, [
        "MMA Advanced",
        "Kickboxen Adult",
        "MMA (Ringen)",
        "Muay Thai Adult",
        "MMA/Kickboxen Sparring",
        null as unknown as string,
      ]) || null,
      addedAt,
      isDemo: true,
    });
  }

  // ── Subscriptions ────────────────────────────────────────────────────────
  // Wähle bevorzugt MMA + relevante Kurse passend zur Hauptdisziplin
  const preferredBlocks = TRAINING_BLOCKS.filter(
    (b) =>
      b.title.includes("MMA") ||
      b.title.includes("Kickboxen") ||
      b.title.includes("Muay Thai"),
  );
  const subscriptions: SubscriptionDocData[] = [];
  const usedBlockIds = new Set<string>();
  for (
    let i = 0;
    subscriptions.length < cfg.subscriptionCount && i < preferredBlocks.length * 3;
    i++
  ) {
    const block = pick(rng, preferredBlocks);
    if (usedBlockIds.has(block.id)) continue;
    usedBlockIds.add(block.id);
    const daysAgo = randInt(rng, 14, cfg.athlete.trainingMonths * 25);
    subscriptions.push({
      trainingBlockId: block.id,
      blockTitle: block.title,
      weekday: block.weekday,
      startTime: block.startTime,
      subscribedAt: new Date(now.getTime() - daysAgo * 24 * 3600 * 1000),
      isDemo: true,
    });
  }

  // ── Participations ───────────────────────────────────────────────────────
  // Ungefähr 60–80% der Workouts haben eine korrespondierende Kurs-Teilnahme
  const participations: ParticipationDocData[] = [];
  const usedParticipationIds = new Set<string>();
  for (const w of workouts) {
    if (!chance(rng, 0.65)) continue;
    // Suche einen passenden Block
    const candidateBlocks = TRAINING_BLOCKS.filter((b) => b.category === w.category);
    const block = candidateBlocks.length > 0 ? pick(rng, candidateBlocks) : pick(rng, preferredBlocks);
    const weekId = WEEKDAY_IDENTIFIER(w.completedAt);
    const id = `${block.id}_${weekId}`;
    if (usedParticipationIds.has(id)) continue;
    usedParticipationIds.add(id);
    participations.push({
      id,
      trainingSessionId: id,
      trainingBlockId: block.id,
      blockTitle: block.title,
      weekIdentifier: weekId,
      joinedAt: w.completedAt,
      isDemo: true,
    });
    if (participations.length > 120) break;
  }

  // ── TechniqueProgress ────────────────────────────────────────────────────
  const techniqueProgress: TechniqueProgressDocData[] = [];
  const usedTechProgIds = new Set<string>();
  let tries = 0;
  while (
    techniqueProgress.length < cfg.techniqueProgressCount &&
    tries < cfg.techniqueProgressCount * 6
  ) {
    tries++;
    const category = weightedPick(rng, cfg.categoryMix);
    const t = pick(rng, ALL_TECHNIQUES.filter((tt) => tt.category === category));
    if (!t || usedTechProgIds.has(t.id)) continue;

    const areas = Array.isArray(t.trainingArea)
      ? t.trainingArea
      : t.trainingArea
        ? [t.trainingArea]
        : [];
    if (areas.some((a) => underTrained.has(a)) && rng() < 0.85) continue;

    usedTechProgIds.add(t.id);

    // Status-Verteilung — abhängig von Persona
    const statusRoll = rng();
    let status: TechniqueProgressStatus;
    let practiceCount: number;
    if (persona === "beginner") {
      status =
        statusRoll < 0.55 ? "learned" : statusRoll < 0.9 ? "practiced" : "mastered";
      practiceCount = randInt(rng, 1, 8);
    } else if (persona === "intermediate") {
      status =
        statusRoll < 0.2
          ? "learned"
          : statusRoll < 0.7
            ? "practiced"
            : "mastered";
      practiceCount = randInt(rng, 4, 24);
    } else {
      status =
        statusRoll < 0.1
          ? "learned"
          : statusRoll < 0.55
            ? "practiced"
            : "mastered";
      practiceCount = randInt(rng, 8, 48);
    }
    const daysAgo = randInt(rng, 1, cfg.athlete.trainingMonths * 30);
    techniqueProgress.push({
      techniqueId: t.id,
      status,
      practiceCount,
      lastPracticedAt: new Date(now.getTime() - daysAgo * 24 * 3600 * 1000),
      isDemo: true,
    });
  }

  // ── Sparring-Log ─────────────────────────────────────────────────────────
  const sparringEntries: SparringDocData[] = [];
  for (let i = 0; i < cfg.sparringCount; i++) {
    const daysAgo = randInt(rng, 7, cfg.athlete.trainingMonths * 30);
    const date = new Date(now.getTime() - daysAgo * 24 * 3600 * 1000);
    const category = weightedPick(rng, cfg.categoryMix);
    sparringEntries.push({
      date,
      category,
      partner: pick(rng, FAKE_PARTNERS),
      rounds: randInt(rng, 3, 8),
      notes: pick(rng, [
        "Saubere Combos, Distanzgefühl gut",
        "Im Clinch zu passiv — mehr Knee-Battle drillen",
        "Stand-Up dominant, Bodenlage schwach",
        "Defense war heute Top, Konter sauber",
        "Atmung in Runde 4 weggebrochen — Conditioning",
        "Takedowns standen, Top-Position kontrolliert",
        "Counter-Striking hat funktioniert",
        "Body-Shots zu wenig gesetzt",
      ]),
      rating: randInt(rng, 2, 5),
      isDemo: true,
    });
  }
  sparringEntries.sort((a, b) => b.date.getTime() - a.date.getTime());

  // ── Weight-Log ───────────────────────────────────────────────────────────
  const weightLog: WeightLogDocData[] = [];
  let currentWeight = cfg.athlete.weightKg + 4; // Start etwas schwerer
  for (let i = 0; i < cfg.weightEntries; i++) {
    const daysAgo = Math.floor(
      (i / cfg.weightEntries) * cfg.athlete.trainingMonths * 30,
    );
    const date = new Date(now.getTime() - daysAgo * 24 * 3600 * 1000);
    // Drift Richtung Zielgewicht + Rauschen
    const targetDrift = (cfg.athlete.weightKg - currentWeight) * 0.06;
    const noise = (rng() - 0.5) * 0.4;
    currentWeight = +(currentWeight + targetDrift + noise).toFixed(1);
    weightLog.push({
      date,
      weightKg: currentWeight,
      isDemo: true,
    });
  }
  weightLog.sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    workouts,
    libraryEntries,
    subscriptions,
    participations,
    techniqueProgress,
    sparringEntries,
    weightLog,
  };
}

// ─── Firestore-Writes (batched) ────────────────────────────────────────────

const DEMO_SPARRING_COLLECTION = "sparringLog";
const DEMO_WEIGHT_COLLECTION = "weightLog";

export interface SeedResult {
  workouts: number;
  library: number;
  subscriptions: number;
  participations: number;
  techniqueProgress: number;
  sparring: number;
  weight: number;
}

/**
 * Schreibt alle Demo-Daten für einen Schüler.
 * Vorher: bestehende Demo-Daten löschen (idempotent).
 * Außerdem: athleteProfile entsprechend der Persona setzen.
 */
export async function seedDemoStudent(
  uid: string,
  persona: DemoPersona,
): Promise<SeedResult> {
  await clearDemoData(uid);
  const data = generateForPersona(persona);
  const cfg = PERSONA_CONFIGS[persona];

  // Athlet-Profil aktualisieren — gibt der Seed dem Schüler ein realistisches Profil
  const trainingStartDate = new Date(
    Date.now() - cfg.athlete.trainingMonths * 30 * 24 * 3600 * 1000,
  );
  const nextCompetitionDate = cfg.athlete.nextCompetitionMonths
    ? new Date(
        Date.now() + cfg.athlete.nextCompetitionMonths * 30 * 24 * 3600 * 1000,
      )
    : null;
  await updateAthleteProfile(uid, {
    primaryDiscipline: cfg.athlete.primaryDiscipline,
    level: cfg.athlete.level,
    weightKg: cfg.athlete.weightKg,
    heightCm: cfg.athlete.heightCm,
    weightClass: cfg.athlete.weightClass,
    gymName: cfg.athlete.gymName,
    trainerName: cfg.athlete.trainerName,
    trainingStartDate,
    nextCompetitionDate,
    nextCompetitionName: cfg.athlete.nextCompetitionName ?? null,
  });

  // DeepFight-Beispielprofil (Split, DNA, Action-Stats) — läuft als
  // Trainer/Admin über die normale fightProfile-Schreibregel und macht die
  // Profilansicht unter /kampfprofil bzw. /trainer/deepfight demo-fähig.
  const demoFp = DEMO_FIGHT_PROFILE[persona];
  await updateFightProfile(uid, {
    dna: demoFp.dna,
    dnaSplit: demoFp.dnaSplit,
    dnaSplitWeight: demoFp.dnaSplitWeight,
    actionStats: demoFp.actionStats,
    updatedBy: DEMO_SEED_AUTHOR,
  });

  const db = getFirestoreDb();

  // Batches je ~400 Ops
  let currentBatch = writeBatch(db);
  let opsInBatch = 0;
  const batches: ReturnType<typeof writeBatch>[] = [currentBatch];
  const commit = async () => {
    if (opsInBatch === 0) return;
    currentBatch = writeBatch(db);
    batches.push(currentBatch);
    opsInBatch = 0;
  };
  const addOp = (fn: (b: ReturnType<typeof writeBatch>) => void) => {
    fn(currentBatch);
    opsInBatch++;
    if (opsInBatch >= 400) {
      void commit();
    }
  };

  // Workouts — auto-IDs
  for (const w of data.workouts) {
    const ref = doc(collection(db, "users", uid, "workouts"));
    addOp((b) =>
      b.set(ref, {
        label: w.label,
        category: w.category,
        difficulty: w.difficulty,
        rounds: w.rounds,
        workSeconds: w.workSeconds,
        restSeconds: w.restSeconds,
        totalWorkSeconds: w.totalWorkSeconds,
        completedAt: Timestamp.fromDate(w.completedAt),
        status: w.status,
        exerciseIds: w.exerciseIds,
        techniqueIds: w.techniqueIds,
        isDemo: w.isDemo,
      }),
    );
  }

  // Library — fixed IDs (= techniqueId/exerciseId)
  for (const l of data.libraryEntries) {
    const ref = doc(db, "users", uid, "library", l.id);
    addOp((b) =>
      b.set(ref, {
        exerciseId: l.exerciseId,
        type: l.type,
        source: l.source,
        contextLabel: l.contextLabel,
        addedAt: Timestamp.fromDate(l.addedAt),
        isDemo: l.isDemo,
      }),
    );
  }

  // Subscriptions — blockId als doc-ID
  for (const s of data.subscriptions) {
    const ref = doc(db, "users", uid, "subscriptions", s.trainingBlockId);
    addOp((b) =>
      b.set(ref, {
        trainingBlockId: s.trainingBlockId,
        blockTitle: s.blockTitle,
        weekday: s.weekday,
        startTime: s.startTime,
        subscribedAt: Timestamp.fromDate(s.subscribedAt),
        isDemo: s.isDemo,
      }),
    );
  }

  // Participations — sessionId als doc-ID
  for (const p of data.participations) {
    const ref = doc(db, "users", uid, "participations", p.id);
    addOp((b) =>
      b.set(ref, {
        trainingSessionId: p.trainingSessionId,
        trainingBlockId: p.trainingBlockId,
        blockTitle: p.blockTitle,
        weekIdentifier: p.weekIdentifier,
        joinedAt: Timestamp.fromDate(p.joinedAt),
        isDemo: p.isDemo,
      }),
    );
  }

  // TechniqueProgress — techniqueId als doc-ID
  for (const tp of data.techniqueProgress) {
    const ref = doc(db, "users", uid, "techniqueProgress", tp.techniqueId);
    addOp((b) =>
      b.set(ref, {
        status: tp.status,
        practiceCount: tp.practiceCount,
        lastPracticedAt: Timestamp.fromDate(tp.lastPracticedAt),
        updatedAt: Timestamp.fromDate(tp.lastPracticedAt),
        isDemo: tp.isDemo,
      }),
    );
  }

  // Sparring — auto-IDs
  for (const sp of data.sparringEntries) {
    const ref = doc(collection(db, "users", uid, DEMO_SPARRING_COLLECTION));
    addOp((b) =>
      b.set(ref, {
        date: Timestamp.fromDate(sp.date),
        category: sp.category,
        partner: sp.partner,
        rounds: sp.rounds,
        notes: sp.notes,
        rating: sp.rating,
        isDemo: sp.isDemo,
      }),
    );
  }

  // Weight-Log — auto-IDs
  for (const wl of data.weightLog) {
    const ref = doc(collection(db, "users", uid, DEMO_WEIGHT_COLLECTION));
    addOp((b) =>
      b.set(ref, {
        date: Timestamp.fromDate(wl.date),
        weightKg: wl.weightKg,
        isDemo: wl.isDemo,
      }),
    );
  }

  // Alle Batches committen
  for (const b of batches) {
    if (b === currentBatch && opsInBatch === 0) continue;
    await b.commit();
  }

  return {
    workouts: data.workouts.length,
    library: data.libraryEntries.length,
    subscriptions: data.subscriptions.length,
    participations: data.participations.length,
    techniqueProgress: data.techniqueProgress.length,
    sparring: data.sparringEntries.length,
    weight: data.weightLog.length,
  };
}

/**
 * Löscht alle Demo-Dokumente eines Schülers (alle mit isDemo == true).
 * Tastet keine echten Daten an.
 */
export async function clearDemoData(uid: string): Promise<{
  workouts: number;
  library: number;
  subscriptions: number;
  participations: number;
  techniqueProgress: number;
  sparring: number;
  weight: number;
  fightCamps: number;
}> {
  const subs = [
    "workouts",
    "library",
    "subscriptions",
    "participations",
    "techniqueProgress",
    DEMO_SPARRING_COLLECTION,
    DEMO_WEIGHT_COLLECTION,
    "fightCamps",
  ] as const;

  const counts: Record<string, number> = {};
  for (const sub of subs) {
    counts[sub] = 0;
    try {
      const q = query(
        collection(getFirestoreDb(), "users", uid, sub),
        where("isDemo", "==", true),
      );
      const snap = await getDocs(q);
      // In Batches löschen (max 500 Ops)
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const slice = docs.slice(i, i + 400);
        const batch = writeBatch(getFirestoreDb());
        slice.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      counts[sub] = docs.length;
    } catch {
      // Subcollection existiert evtl. nicht — ignorieren
    }
  }

  // Fight-Camps können auch Plan-Subdocs haben — die werden mit dem Hauptdoc verworfen,
  // da wir hier nur die Top-Level fightCamps zählen. Fight-Camp-Plans sind als Felder
  // im Hauptdokument gespeichert (siehe lib/fight-camp.ts), daher reicht das.

  // DeepFight-Demo-Profil zurücksetzen — NUR wenn es der Seed geschrieben hat
  // (updatedBy = DEMO_SEED_AUTHOR). Trainer-gepflegte Profile bleiben unberührt.
  try {
    const fp = await getFightProfile(uid);
    if (fp.updatedBy === DEMO_SEED_AUTHOR) {
      await updateFightProfile(uid, {
        dna: {},
        dnaSplit: null,
        dnaSplitWeight: 0,
        actionStats: [],
      });
    }
  } catch {
    // Kein Zugriff / kein Profil — ignorieren
  }

  return {
    workouts: counts.workouts ?? 0,
    library: counts.library ?? 0,
    subscriptions: counts.subscriptions ?? 0,
    participations: counts.participations ?? 0,
    techniqueProgress: counts.techniqueProgress ?? 0,
    sparring: counts[DEMO_SPARRING_COLLECTION] ?? 0,
    weight: counts[DEMO_WEIGHT_COLLECTION] ?? 0,
    fightCamps: counts.fightCamps ?? 0,
  };
}

/** Quick-Count je Subcollection — für Admin-Anzeige */
export async function countDemoData(uid: string): Promise<{
  workouts: number;
  library: number;
  techniqueProgress: number;
  sparring: number;
  hasDemo: boolean;
}> {
  async function count(sub: string): Promise<number> {
    try {
      const q = query(
        collection(getFirestoreDb(), "users", uid, sub),
        where("isDemo", "==", true),
      );
      const snap = await getDocs(q);
      return snap.size;
    } catch {
      return 0;
    }
  }
  const [workouts, library, techniqueProgress, sparring] = await Promise.all([
    count("workouts"),
    count("library"),
    count("techniqueProgress"),
    count(DEMO_SPARRING_COLLECTION),
  ]);
  return {
    workouts,
    library,
    techniqueProgress,
    sparring,
    hasDemo: workouts + library + techniqueProgress + sparring > 0,
  };
}

