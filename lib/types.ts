/**
 * IronFight MMA — zentrale Types
 *
 * Diese Datei sammelt die Kern-Datenmodelle der App. Sie ist bewusst
 * defensiv geschnitten, damit spätere Features (Fight-Camp, Sparring-Log,
 * Gewichts-Tracking, Recovery, Community-Username, Coach-Feedback,
 * Videoanalyse) ergänzt werden können, ohne bestehende Strukturen
 * brechen zu müssen.
 */

import type { ProfileShares } from "./profile-sharing";
import type { RoleSet } from "./roles";

// ─── Disziplinen ───────────────────────────────────────────────────────────

export type Category = "boxing" | "wrestling" | "bjj" | "muay-thai";

export type FutureCategory =
  | "mma-mix"
  | "kickboxing"
  | "judo"
  | "strength-conditioning"
  | "mobility-recovery";

export type AnyCategory = Category | FutureCategory;

/** Vollständige Disziplin-Liste für die Master-Technikdatenbank */
export type Discipline =
  | "boxing"
  | "kickboxen"
  | "muay-thai"
  | "mma"
  | "wrestling"
  | "bjj"
  | "karate"
  | "wing-tsung"
  | "self-defense"
  | "fitness-kickboxen";

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  boxing: "Boxing",
  kickboxen: "Kickboxen",
  "muay-thai": "Muay Thai",
  mma: "MMA",
  wrestling: "Wrestling / Ringen",
  bjj: "BJJ / Grappling",
  karate: "Karate",
  "wing-tsung": "Wing Tsung",
  "self-defense": "Self-Defense",
  "fitness-kickboxen": "Fitness-Kickboxen",
};

/** Kampfphasen und Trainingsbereiche */
export type TrainingArea =
  | "stand-up"
  | "footwork"
  | "punches"
  | "kicks"
  | "knees"
  | "elbows"
  | "clinch"
  | "takedowns"
  | "takedown-defense"
  | "ground-control"
  | "guard"
  | "sweeps"
  | "submissions"
  | "escapes"
  | "transitions"
  | "defense"
  | "combos"
  | "drills";

export const TRAINING_AREA_LABEL: Record<TrainingArea, string> = {
  "stand-up": "Stand-Up",
  footwork: "Footwork",
  punches: "Schläge",
  kicks: "Kicks",
  knees: "Knees",
  elbows: "Elbows",
  clinch: "Clinch",
  takedowns: "Takedowns",
  "takedown-defense": "Takedown Defense",
  "ground-control": "Ground Control",
  guard: "Guard",
  sweeps: "Sweeps",
  submissions: "Submissions",
  escapes: "Escapes",
  transitions: "Transitions",
  defense: "Defense",
  combos: "Kombos",
  drills: "Drills",
};

/** Technikrolle: Core-Technik, Ergänzung, fortgeschritten, Spezialtechnik, Drill oder Kombo */
export type TechniqueRole =
  | "core"
  | "support"
  | "advanced"
  | "specialist"
  | "drill"
  | "combo";

export const TECHNIQUE_ROLE_LABEL: Record<TechniqueRole, string> = {
  core: "Core-Technik",
  support: "Support-Technik",
  advanced: "Fortgeschrittene Technik",
  specialist: "Spezial-Technik",
  drill: "Drill",
  combo: "Kombination",
};

/** Granulares Level — Obermenge von Difficulty */
export type TechniqueLevel =
  | "anfaenger"
  | "aufbau"
  | "fortgeschritten"
  | "advanced"
  | "pro";

export const TECHNIQUE_LEVEL_LABEL: Record<TechniqueLevel, string> = {
  anfaenger: "Anfänger",
  aufbau: "Aufbau",
  fortgeschritten: "Fortgeschritten",
  advanced: "Advanced",
  pro: "Pro / Wettkampf",
};

// ─── Schwierigkeit ─────────────────────────────────────────────────────────

export type Difficulty = "anfaenger" | "fortgeschritten" | "pro";

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  anfaenger: "Anfänger",
  fortgeschritten: "Fortgeschritten",
  pro: "Pro",
};

// ─── Equipment ─────────────────────────────────────────────────────────────

export type EquipmentId =
  | "bodyweight"
  | "jump-rope"
  | "kettlebell-10"
  | "kettlebell-20"
  | "dumbbell"
  | "medicine-ball-7"
  | "heavy-bag"
  | "pads"
  | "mat"
  | "resistance-band"
  | "dummy";

export interface EquipmentDef {
  id: EquipmentId;
  label: string;
  icon: import("@/components/ui/Icon").IconName; // SVG-Icon-Name (kein Emoji)
  description: string;
  defaultFor: Category[];
}

// ─── Techniken ─────────────────────────────────────────────────────────────

export interface VideoSource {
  /** Embed-URL (z. B. youtube /embed/<id>?...) */
  url: string;
  /** Sichtbarer Quellname für Credit-Anzeige */
  source: "YouTube" | "Wikimedia" | "Vimeo" | "Eigene";
  /** Kurzer Lizenz-Hinweis (CC-BY, CC0, YouTube-Embed, ...) */
  license: string;
  /** Optionaler Kanal-/Autorname */
  attribution?: string;
}

export interface LottieAnimation {
  /** Pfad oder URL zu Lottie JSON */
  src: string;
  /** Kurzer Quellenhinweis für Credit */
  source?: string;
}

export interface Technique {
  /** Eindeutige ID, z. B. "boxing_jab" */
  id: string;
  slug: string;
  name: string;
  /** Primäre Kategorie (bestehende Struktur) */
  category: Category;
  difficulty: Difficulty;
  description: string;
  steps: string[];
  commonMistakes: string[];
  /** Wo/wann setzt man das im Kampf oder Training ein? */
  usage: string;
  /** Welche Equipment-IDs sind sinnvoll/möglich */
  equipment: EquipmentId[];
  /** Optional: passendes Video, falls rechtssicher verfügbar */
  video?: VideoSource;
  /** Optional: passende Lottie-Animation */
  animation?: LottieAnimation;
  /** Optional: animiertes GIF als Fallback */
  gif?: string;
  /** IDs der Komponenten-Techniken (z. B. für Kombos) */
  techniqueIds?: string[];
  /** IDs verwandter Techniken */
  relatedTechniqueIds?: string[];
  /** Sinnvolle nächste Technik zum Lernen */
  nextTechniqueId?: string;

  // ─── Erweiterte Felder der Master-Technikdatenbank ─────────────────────
  /** Alle Disziplinen, in denen diese Technik eingesetzt wird */
  disciplines?: Discipline[];
  /** Trainingsbereich(e) dieser Technik */
  trainingArea?: TrainingArea | TrainingArea[];
  /** Technikrolle (Core, Support, Advanced, Specialist, Drill, Combo) */
  role?: TechniqueRole;
  /** Granulares Level (erweitert difficulty) */
  level?: TechniqueLevel;
  /** Alternative Namen / Bezeichnungen */
  alternativeNames?: string[];
  /** Sub-Kategorie (freier Text, z. B. "Jab-Variante") */
  subCategory?: string;
  /** Coaching-Hinweise für den Trainer */
  coachingCues?: string[];
  /** Sicherheitshinweise */
  safetyNotes?: string[];
  /** Konkrete Einsatzbereiche (strukturierter als usage) */
  useCases?: string[];
  /** Prioritätswert 1–10 (Wichtigkeit der Technik generell) */
  priorityScore?: number;
  /** Frequenzwert 1–10 (wie häufig im Training eingesetzt) */
  frequencyScore?: number;
  /** Diversitätsgruppe — verhindert zu viele Techniken eines Typs pro Kurs */
  diversityGroup?: string;
  /** YouTube-Suchbegriff als Fallback, wenn kein eigenes Video vorhanden */
  videoSearchQuery?: string;
}

// ─── Übungen (Exercise = trainierbare Einheit, ggf. Technik-bezogen) ───────

export type ExerciseKind = "warmup" | "technique" | "conditioning" | "cooldown";

export interface Exercise {
  id: string;
  name: string;
  kind: ExerciseKind;
  category: Category | "any";
  /** Optional: empfohlene Schwierigkeit; "any" wenn universell */
  difficulty: Difficulty | "any";
  /** Geschätzte Dauer pro Runde in Sekunden */
  durationSeconds: number;
  /** Standard-Pause in Sekunden zwischen Runden */
  restSeconds: number;
  /** Standard-Anzahl Runden */
  defaultRounds: number;
  /** Intensität: low | medium | high — für Generator-Pacing */
  intensity: "low" | "medium" | "high";
  /** Welche Equipment-IDs werden benötigt — leeres Array = bodyweight ok */
  equipment: EquipmentId[];
  /** Verknüpfung zu Techniken (technische Übungen referenzieren ihre Technik-IDs) */
  techniqueIds?: string[];
  /** Trainingsfokus / Muskelgruppen */
  focus: string[];
  /** Cues für den User während der Übung */
  cues?: string[];
  /** Kurze Notiz/Beschreibung */
  notes?: string;
}

// ─── Workouts ──────────────────────────────────────────────────────────────

export interface WorkoutBlock {
  phase: "warmup" | "main" | "conditioning" | "cooldown";
  exerciseIds: string[];
}

export interface WorkoutDefinition {
  id: string;
  label: string;
  category: Category;
  difficulty: Difficulty;
  /** Timer-Default für diese Übung */
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  prepSeconds: number;
  blocks: WorkoutBlock[];
  /** Wenn vom Generator erstellt: Quellparameter speichern */
  generatedFrom?: {
    equipment: EquipmentId[];
    durationMinutes: number;
    category: Category;
    difficulty: Difficulty;
  };
}

// ─── Logging / Fortschritt ─────────────────────────────────────────────────

export type WorkoutStatus = "completed" | "aborted";

export interface WorkoutLog {
  id: string;
  label: string | null;
  category?: Category;
  difficulty?: Difficulty;
  rounds: number;
  workSeconds: number;
  restSeconds: number;
  totalWorkSeconds: number;
  /** Wann fertig oder abgebrochen */
  completedAt: Date;
  status: WorkoutStatus;
  exerciseIds?: string[];
  techniqueIds?: string[];
}

export type TechniqueProgressStatus =
  | "not_started"
  | "learned"
  | "practiced"
  | "mastered";

export interface TechniqueProgress {
  techniqueId: string;
  status: TechniqueProgressStatus;
  lastPracticedAt?: Date;
  practiceCount: number;
}

// ─── Athlet-Profil-Felder ──────────────────────────────────────────────────

/** UFC-Gewichtsklassen */
export type WeightClass =
  | "strawweight"
  | "flyweight"
  | "bantamweight"
  | "featherweight"
  | "lightweight"
  | "welterweight"
  | "middleweight"
  | "light-heavyweight"
  | "heavyweight";

export const WEIGHT_CLASS_LABEL: Record<WeightClass, string> = {
  strawweight: "Strawweight (≤ 52 kg)",
  flyweight: "Flyweight (≤ 57 kg)",
  bantamweight: "Bantamweight (≤ 61 kg)",
  featherweight: "Featherweight (≤ 66 kg)",
  lightweight: "Lightweight (≤ 70 kg)",
  welterweight: "Welterweight (≤ 77 kg)",
  middleweight: "Middleweight (≤ 84 kg)",
  "light-heavyweight": "Light-Heavyweight (≤ 93 kg)",
  heavyweight: "Heavyweight (> 93 kg)",
};

/** Gibt die passende Gewichtsklasse für ein Körpergewicht (kg) zurück */
export function weightClassForKg(kg: number): WeightClass {
  if (kg <= 52) return "strawweight";
  if (kg <= 57) return "flyweight";
  if (kg <= 61) return "bantamweight";
  if (kg <= 66) return "featherweight";
  if (kg <= 70) return "lightweight";
  if (kg <= 77) return "welterweight";
  if (kg <= 84) return "middleweight";
  if (kg <= 93) return "light-heavyweight";
  return "heavyweight";
}

/**
 * Geschlecht des Athleten — vom User selbst angegeben (2026-08-22).
 * Fachlich relevant, nicht nur Grammatik: bestimmt später das
 * Gewichtsklassen-Raster (Frauen-Divisionen) und geht als Kontext in die
 * KI-Video-Analyse und Gegner-Vergleiche (siehe Backlog „Gewichtsklassen
 * pro Disziplin/Verband"). Keine Angabe ist erlaubt, macht die Analyse
 * aber ungenauer — die UI weist darauf hin.
 */
export type Gender = "male" | "female";

export const GENDER_LABEL: Record<Gender, string> = {
  male: "Männlich",
  female: "Weiblich",
};

/**
 * Herz-Farbe der Workout-Favoriten (Leons Vorgabe 2026-08-27): Männlich =
 * Blau, Weiblich = Lila, ohne Angabe = Gelb — aus den Palette-Tokens
 * (cat-1/2/4), nie als Hex. „unset" = Gender im Athleten-Profil nicht gesetzt.
 */
export const GENDER_HEART_COLOR: Record<Gender | "unset", string> = {
  male: "var(--cat-1)",
  female: "var(--cat-2)",
  unset: "var(--cat-4)",
};

export type AthleteLevel = "beginner" | "intermediate" | "advanced" | "competitor";

export const ATHLETE_LEVEL_LABEL: Record<AthleteLevel, string> = {
  beginner: "Anfänger",
  intermediate: "Fortgeschritten",
  advanced: "Erfahren",
  competitor: "Wettkämpfer",
};

export type BjjBelt = "white" | "blue" | "purple" | "brown" | "black";

export const BJJ_BELT_LABEL: Record<BjjBelt, string> = {
  white: "Weißgurt",
  blue: "Blaugurt",
  purple: "Lilagurt",
  brown: "Braungurt",
  black: "Schwarzgurt",
};

/**
 * Auslage eines Kämpfers — geteilt zwischen Athleten-Profil und Gegner-Profil
 * (lib/fight-camp.ts re-exportiert beide Namen für bestehende Imports).
 */
export type FighterStance = "orthodox" | "southpaw" | "switch";

export const FIGHTER_STANCE_LABEL: Record<FighterStance, string> = {
  orthodox: "Orthodox (Rechtsausleger)",
  southpaw: "Southpaw (Linksausleger)",
  switch: "Switch (beidseitig)",
};

export interface AthleteProfile {
  /** Hauptdisziplin */
  primaryDiscipline?: Discipline | null;
  /** Geschlecht (Gewichtsklassen-Raster + KI-Analyse-Kontext) */
  gender?: Gender | null;
  /** Selbsteinschätzung */
  level?: AthleteLevel | null;
  /** Trainingsbeginn — für "Trainingsjahre"-Anzeige */
  trainingStartDate?: Date | null;
  /** Körpergewicht in kg */
  weightKg?: number | null;
  /** Körpergröße in cm */
  heightCm?: number | null;
  /** Reichweite in cm */
  reachCm?: number | null;
  /** Auslage */
  stance?: FighterStance | null;
  /** Selbst gewählte Gewichtsklasse (sonst aus weightKg ableiten) */
  weightClass?: WeightClass | null;
  /** Optional: BJJ-Gurt */
  bjjBelt?: BjjBelt | null;
  /** Gym / Verein */
  gymName?: string | null;
  /** Hauptcoach */
  trainerName?: string | null;
  /** Nächster Wettkampf — Datum + optionaler Name */
  nextCompetitionDate?: Date | null;
  nextCompetitionName?: string | null;
}

// ─── User-Profil ───────────────────────────────────────────────────────────

export interface UserSettings {
  /** Sound am Timer aktiv */
  soundOn: boolean;
  /** Vibration am Timer aktiv (nur Mobile) */
  vibrate: boolean;
  /** Display-Wake-Lock aktiv halten während Timer läuft */
  wakeLock: boolean;
  /** Standard-Equipment für Generator vorausgewählt */
  defaultEquipment: EquipmentId[];
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  soundOn: true,
  vibrate: true,
  wakeLock: true,
  defaultEquipment: [],
};

export interface UserProfile {
  uid: string;
  email: string | null;
  /** Auth-Name vom Provider (z. B. Google) — NICHT in der App anzeigen */
  authProviderName: string | null;
  /** Vom User gewählter Anzeigename (FighterName). Null = noch nicht gesetzt → Default "Fighter" */
  displayName: string | null;
  /** Reserviert für spätere Community-Funktionen — eindeutig, optional */
  username?: string | null;
  /**
   * Wer dieses Konto sehen darf — je Bereich eine Liste von Trainer-uids
   * (Leon 03.09.2026: „standardmäßig alle Trainer auf privat", getrennt nach
   * Bereichen). Nur für Stab-Konten von Bedeutung; Athleten bleiben für alle
   * Trainer ihres Gyms sichtbar. Fehlend oder leer = privat.
   *
   * Bereiche und Beschriftungen stehen in `lib/profile-sharing.ts` — die
   * Schlüssel dort sind dieselben, die `hatFreigabe()` in `firestore.rules`
   * nachschlägt.
   */
  profileShares?: ProfileShares;
  /**
   * Die Rechte dieses Kontos (Multi-Gym Phase 2, Checkpoint 3): drei
   * unabhängige Häkchen statt eines `role`-Wertes — `trainer`, `verwaltung`,
   * `admin`, Plattform-Rang bereits eingerechnet. Siehe lib/roles.ts.
   *
   * AUTORITATIV IST DER CUSTOM CLAIM. `lib/auth-context.tsx` setzt dieses
   * Feld aus dem ID-Token; die gleichnamigen Felder am users-Dokument sind
   * nur der Abfrage-Spiegel (Claims sind nicht abfragbar, sonst ließe sich
   * „hat dieses Gym noch eine Verwaltung?" nicht beantworten). Geschrieben
   * wird beides ausschließlich von /api/members/role — die Firestore-Regeln
   * verbieten dem Client alle vier Felder.
   *
   * In Komponenten NICHT direkt lesen, sondern `useRights()` aus dem
   * Auth-Context: Der Hook liefert denselben Wert und beantwortet den
   * Ladezustand mit „noch keine Rechte" statt mit `undefined`.
   */
  rights: RoleSet;
  /**
   * Gym-Zugehörigkeit (Slug, z. B. "tidal-athletics"). Steuert, welche
   * gym-geteilten Daten (Gegner-DNA, Wettkämpfe) ein Trainer sieht.
   * Aktuell betreibt die App genau ein Gym — fehlt das Feld, gilt das
   * Default-Gym (siehe lib/gym.ts). Für späteres Multi-Gym vorbereitet.
   */
  gymId?: string | null;
  /** Beitritt zum Gym — serverseitig beim Einlösen der Einladung gesetzt. */
  gymJoinedAt?: Date | null;
  settings: UserSettings;
  createdAt?: Date;
  /** Wurde der erste-Login-Onboarding-Flow durchlaufen? */
  onboarded: boolean;
  /** Wurde das Trainer-spezifische Erst-Onboarding gesehen? Nur relevant für Trainer/Admins. */
  trainerOnboarded?: boolean;
  /** Athleten-Profil — alle Felder optional, nullable */
  athlete?: AthleteProfile;
}

// ─── Nice-to-have-Vorbereitung ────────────────────────────────────────────
// Die folgenden Types existieren als Stub für spätere Features.
// Sie werden noch nicht aktiv verwendet, sind aber bereits geschnitten.

export interface FightCampPlan {
  id: string;
  weeks: 4 | 8 | 12;
  category: Category;
  startsAt: Date;
  endsAt: Date;
  schedule: { day: number; workoutIds: string[] }[];
}

export interface SparringEntry {
  id: string;
  date: Date;
  category: Category;
  partner?: string;
  rounds: number;
  notes?: string;
  rating?: number; // 1..5
}

export interface WeightEntry {
  id: string;
  date: Date;
  weightKg: number;
  notes?: string;
}

export interface Badge {
  id: string;
  label: string;
  description: string;
  unlockedAt?: Date;
}

// ─── Stundenplan & Bibliothek ──────────────────────────────────────────────

/**
 * Der alte Rollenwert. Seit Checkpoint 3 nur noch der ÜBERGANGS-SPIEGEL des
 * Rollen-Sets (`lib/roles.ts`, `legacyRole()`): Er wird weiter in Claims und
 * users-Dokument geschrieben, damit ein Rollback der Firestore-Regeln keine
 * Aussperrung ist — gelesen wird er als Quelle nirgends mehr. Fällt mit dem
 * Rückfall zusammen weg (Backlog-Punkt in CLAUDE.md).
 */
export type UserRole = "user" | "trainer" | "admin";

export interface TrainingBlock {
  id: string;
  /** 0=Montag … 6=Sonntag (europäische Konvention) */
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  startTime: string; // "16:15"
  endTime: string;   // "17:00"
  category?: Category;
  /** Fein-Disziplin für die Farbcodierung (z. B. Kickboxen ≠ Boxen). */
  discipline?: Discipline;
  level?: "kids" | "teens" | "adult" | "advanced" | "mixed";
}

export interface TrainingSession {
  id: string; // `${blockId}_${weekIdentifier}`
  trainingBlockId: string;
  weekIdentifier: string; // "2026-W19" — nur intern, nie im UI
  exerciseIds: string[];
  techniqueIds: string[]; // Kampftechniken aus lib/techniques — primäres Feld
  updatedAt?: Date;
  updatedBy?: string;
}

export interface LibraryEntry {
  exerciseId: string; // doc-ID (exerciseId oder techniqueId — je nach type)
  type?: "exercise" | "technique";
  source: "training" | "manual";
  trainingSessionId?: string;
  contextLabel?: string;
  addedAt: Date;
}

export interface Participation {
  trainingSessionId: string;
  trainingBlockId: string;
  blockTitle: string;
  weekIdentifier: string;
  joinedAt: Date;
  /**
   * Das Gym, zu dem diese Teilnahme zählt (nachgetragen 2026-09-01).
   *
   * WARUM AM DOKUMENT UND NICHT ÜBER DEN BESITZER: Teilnahmen liegen unter
   * `users/{uid}/participations/{sessionId}`. Für eine Kennzahl wie „wie viele
   * Athleten waren diese Woche in den Kursen" muss man sie GYM-WEIT lesen, und
   * das geht nur als collectionGroup-Abfrage. Eine solche Abfrage sieht den
   * Elternpfad nicht — sie kann also nicht prüfen, zu welchem Gym der Besitzer
   * gehört. Ohne dieses Feld ließe sich die Regel nicht schreiben, und die
   * Trennung zwischen zwei Gyms wäre nicht durchsetzbar (Konzept §3.3, deny by
   * default).
   *
   * Optional, weil Bestandsdokumente es nicht haben: Sie zählen dann nicht mit,
   * statt die Abfrage scheitern zu lassen.
   */
  gymId?: string;
}

/**
 * Kurs-Abonnement: User folgt einem festen Wochenkurs (z. B. Mo 20:15 MMA Advanced).
 * Auto-Sync übernimmt jede Woche neu zugewiesene Techniken automatisch in die Bibliothek.
 */
export interface BlockSubscription {
  trainingBlockId: string;
  blockTitle: string;
  weekday: number;        // 0=Mo … 6=So
  startTime: string;      // "20:15"
  subscribedAt: Date;
  /** Letzte Woche, für die schon synchronisiert wurde — verhindert Doppel-Sync */
  lastSyncedWeek?: string;
}

// ─── Kurs-Technik-System ────────────────────────────────────────────────────

export interface CourseDefinition {
  id: string;
  name: string;
  discipline: Discipline;
  level: TechniqueLevel;
  description: string;
  /** Welche Trainingsbereiche dieser Kurs abdeckt */
  techniqueAreas: TrainingArea[];
  /** Maximale Anzahl Techniken pro Kurs (Default: 120) */
  maxTechniques: number;
  /** Optionale Gewichtung der Bereiche (Summe sollte 1 ergeben) */
  areaWeights?: Partial<Record<TrainingArea, number>>;
}

export interface CourseTechniqueMapping {
  courseId: string;
  techniqueId: string;
  relevanceScore: number;
  sortOrder: number;
  isCore: boolean;
  isVisible: boolean;
}

// ─── Workout-Items mit Technik-Verlinkung ──────────────────────────────────

export interface WorkoutItem {
  id: string;
  workoutId: string;
  type: "technique" | "drill" | "exercise" | "rest";
  techniqueId?: string;
  exerciseId?: string;
  title: string;
  sets?: number;
  reps?: number;
  duration?: number;
  intensity?: "low" | "medium" | "high";
  sortOrder: number;
  notes?: string;
}
