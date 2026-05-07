/**
 * IronFight MMA — zentrale Types
 *
 * Diese Datei sammelt die Kern-Datenmodelle der App. Sie ist bewusst
 * defensiv geschnitten, damit spätere Features (Fight-Camp, Sparring-Log,
 * Gewichts-Tracking, Recovery, Community-Username, Coach-Feedback,
 * Videoanalyse) ergänzt werden können, ohne bestehende Strukturen
 * brechen zu müssen.
 */

// ─── Disziplinen ───────────────────────────────────────────────────────────

export type Category = "boxing" | "wrestling" | "bjj" | "muay-thai";

export type FutureCategory =
  | "mma-mix"
  | "kickboxing"
  | "judo"
  | "strength-conditioning"
  | "mobility-recovery";

export type AnyCategory = Category | FutureCategory;

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
  icon: string; // Emoji / kurzes ASCII-Symbol
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
  /** Optionale Rolle — wird manuell in Firebase Console gesetzt */
  role?: UserRole;
  settings: UserSettings;
  createdAt?: Date;
  /** Wurde der erste-Login-Onboarding-Flow durchlaufen? */
  onboarded: boolean;
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

export type UserRole = "user" | "trainer" | "admin";

export interface TrainingBlock {
  id: string;
  /** 0=Montag … 6=Sonntag (europäische Konvention) */
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  startTime: string; // "16:15"
  endTime: string;   // "17:00"
  category?: Category;
  level?: "kids" | "teens" | "adult" | "advanced" | "mixed";
}

export interface TrainingSession {
  id: string; // `${blockId}_${weekIdentifier}`
  trainingBlockId: string;
  weekIdentifier: string; // "2026-W19" — nur intern, nie im UI
  exerciseIds: string[];
  updatedAt?: Date;
  updatedBy?: string;
}

export interface LibraryEntry {
  exerciseId: string;
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
}
