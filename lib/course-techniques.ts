/**
 * IronFight MMA — Kurs-Technik-Mapping
 *
 * Definiert Kurse, berechnet Relevanzscores und wählt Techniken
 * für einen Kurs aus der zentralen Technikdatenbank aus.
 */

import type {
  CourseDefinition,
  CourseTechniqueMapping,
  Discipline,
  Technique,
  TrainingArea,
  TechniqueLevel,
} from "./types";

// ─── Kurs-Definitionen ────────────────────────────────────────────────────────

export const COURSES: CourseDefinition[] = [
  {
    id: "mma-beginner",
    name: "MMA Beginner",
    discipline: "mma",
    level: "anfaenger",
    description:
      "Einstiegskurs in Mixed Martial Arts — alle relevanten Kampfbereiche von Stand-Up bis Boden.",
    techniqueAreas: [
      "punches",
      "kicks",
      "takedowns",
      "takedown-defense",
      "ground-control",
      "escapes",
      "submissions",
      "combos",
    ],
    maxTechniques: 120,
  },
  {
    id: "mma-advanced",
    name: "MMA Fortgeschritten",
    discipline: "mma",
    level: "fortgeschritten",
    description:
      "Fortgeschrittenes MMA-Programm mit komplexen Übergängen und Spezialtechniken.",
    techniqueAreas: [
      "punches",
      "kicks",
      "takedowns",
      "takedown-defense",
      "ground-control",
      "escapes",
      "submissions",
      "combos",
    ],
    maxTechniques: 120,
  },
  {
    id: "boxing-beginner",
    name: "Boxing Basics",
    discipline: "boxing",
    level: "anfaenger",
    description:
      "Grundlagen des Boxens — Schläge, Footwork, Defense und erste Kombos.",
    techniqueAreas: ["punches", "footwork", "defense", "combos"],
    maxTechniques: 80,
  },
  {
    id: "boxing-advanced",
    name: "Boxing Advanced",
    discipline: "boxing",
    level: "fortgeschritten",
    description:
      "Fortgeschrittenes Boxtraining mit Kontertechniken, Slips und komplexen Kombinationen.",
    techniqueAreas: ["punches", "footwork", "defense", "combos"],
    maxTechniques: 80,
  },
  {
    id: "kickboxen-beginner",
    name: "Kickboxen",
    discipline: "kickboxen",
    level: "anfaenger",
    description:
      "Einführung ins Kickboxen — Schläge, Kicks, Footwork, Defense, Kombos und Clinch-Basics.",
    techniqueAreas: [
      "punches",
      "kicks",
      "footwork",
      "defense",
      "combos",
      "clinch",
    ],
    maxTechniques: 100,
  },
  {
    id: "muay-thai-beginner",
    name: "Muay Thai",
    discipline: "muay-thai",
    level: "anfaenger",
    description:
      "Muay Thai — die Kunst der acht Gliedmaßen: Schläge, Kicks, Knie, Ellbogen, Clinch und Defense.",
    techniqueAreas: [
      "punches",
      "kicks",
      "knees",
      "elbows",
      "clinch",
      "defense",
      "combos",
    ],
    maxTechniques: 100,
  },
  {
    id: "bjj-beginner",
    name: "BJJ / Grappling Beginner",
    discipline: "bjj",
    level: "anfaenger",
    description:
      "Einführung in Brazilian Jiu-Jitsu — Guard, Ground Control, Escapes, Sweeps, Submissions und Übergänge.",
    techniqueAreas: [
      "guard",
      "ground-control",
      "escapes",
      "sweeps",
      "submissions",
      "transitions",
    ],
    maxTechniques: 100,
  },
  {
    id: "bjj-advanced",
    name: "BJJ Advanced",
    discipline: "bjj",
    level: "fortgeschritten",
    description:
      "Fortgeschrittenes BJJ mit komplexen Submissions, Guard-Varianten und Übergangsketten.",
    techniqueAreas: [
      "guard",
      "ground-control",
      "escapes",
      "sweeps",
      "submissions",
      "transitions",
    ],
    maxTechniques: 100,
  },
  {
    id: "wrestling-beginner",
    name: "Wrestling / Ringen",
    discipline: "wrestling",
    level: "anfaenger",
    description:
      "Grundlagen des Ringens — Takedowns, Takedown-Defense, Ground Control und Escapes.",
    techniqueAreas: [
      "takedowns",
      "takedown-defense",
      "ground-control",
      "escapes",
    ],
    maxTechniques: 80,
  },
  {
    id: "fitness-kickboxen",
    name: "Fitness Kickboxen",
    discipline: "fitness-kickboxen",
    level: "anfaenger",
    description:
      "Fitness-orientiertes Kickboxen — Kondition, Schläge, Kicks, Kombos und Footwork-Drills.",
    techniqueAreas: ["punches", "kicks", "combos", "drills", "footwork"],
    maxTechniques: 60,
  },
];

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

/**
 * Ordnet eine Category (bestehende Struktur) direkt einer Discipline zu.
 * Boxing → boxing, Wrestling → wrestling, BJJ → bjj, Muay-Thai → muay-thai.
 */
const CATEGORY_TO_DISCIPLINE: Record<string, Discipline> = {
  boxing: "boxing",
  wrestling: "wrestling",
  bjj: "bjj",
  "muay-thai": "muay-thai",
};

/**
 * Disziplinen, die von MMA abgedeckt werden.
 * Eine MMA-Technik kann aus jeder dieser Disziplinen stammen.
 */
const MMA_DISCIPLINES = new Set<string>([
  "boxing",
  "kickboxen",
  "muay-thai",
  "wrestling",
  "bjj",
  "mma",
]);

/**
 * Prüft, ob eine Technik zur Disziplin eines Kurses passt.
 * Gibt einen Matching-Score zurück: 1 = direkte Übereinstimmung, 0.5 = partiell, 0 = kein Match.
 */
function disciplineMatchScore(technique: Technique, discipline: Discipline): number {
  // Direkte disciplines-Feld-Prüfung (neues Feld)
  if (technique.disciplines && technique.disciplines.length > 0) {
    if (technique.disciplines.includes(discipline)) return 1;

    // MMA-Kurs: Techniken aller Kampfdisziplinen sind relevant
    if (discipline === "mma" && technique.disciplines.some((d) => MMA_DISCIPLINES.has(d))) {
      return 0.7;
    }

    // Fitness-Kickboxen akzeptiert Kickboxen- und Boxing-Techniken
    if (
      discipline === "fitness-kickboxen" &&
      (technique.disciplines.includes("kickboxen") || technique.disciplines.includes("boxing"))
    ) {
      return 0.6;
    }

    return 0;
  }

  // Fallback: category-basiertes Matching
  const mappedDiscipline = CATEGORY_TO_DISCIPLINE[technique.category];
  if (!mappedDiscipline) return 0;

  if (mappedDiscipline === discipline) return 1;

  // MMA akzeptiert alle Kampf-Kategorien
  if (discipline === "mma" && MMA_DISCIPLINES.has(mappedDiscipline)) return 0.7;

  // Fitness-Kickboxen akzeptiert Boxing (als Basis-Stand-Up)
  if (discipline === "fitness-kickboxen" && mappedDiscipline === "boxing") return 0.5;

  // Kickboxen akzeptiert Boxing- und Muay-Thai-Techniken partiell
  if (discipline === "kickboxen" && (mappedDiscipline === "boxing" || mappedDiscipline === "muay-thai")) {
    return 0.6;
  }

  return 0;
}

/**
 * Prüft, ob eine Technik für das Kursniveau geeignet ist.
 * Anfänger-Kurse: anfaenger + aufbau
 * Fortgeschritten-Kurse: alle Levels
 * Alle anderen: strenge Übereinstimmung oder kein Niveau gesetzt
 */
function levelMatches(technique: Technique, courseLevel: TechniqueLevel): boolean {
  // Neues level-Feld hat Vorrang
  const techLevel = technique.level;

  if (techLevel) {
    switch (courseLevel) {
      case "anfaenger":
        return techLevel === "anfaenger" || techLevel === "aufbau";
      case "aufbau":
        return techLevel === "anfaenger" || techLevel === "aufbau";
      case "fortgeschritten":
        return true; // Fortgeschrittene lernen alles
      case "advanced":
        return techLevel !== "anfaenger";
      case "pro":
        return true;
      default:
        return true;
    }
  }

  // Fallback: difficulty-Feld
  const diff = technique.difficulty;
  switch (courseLevel) {
    case "anfaenger":
    case "aufbau":
      return diff === "anfaenger";
    case "fortgeschritten":
    case "advanced":
    case "pro":
      return true; // Fortgeschrittene Kurse bekommen alles
    default:
      return true;
  }
}

/**
 * Prüft, ob der Trainingsbereich einer Technik zum Kurs passt.
 * Gibt true zurück wenn trainingArea undefiniert (kein Pflichtfeld).
 */
function trainingAreaMatches(technique: Technique, areas: TrainingArea[]): boolean {
  if (!technique.trainingArea) {
    // Keine trainingArea gesetzt → Technik wird trotzdem einbezogen,
    // bekommt aber einen niedrigeren Score.
    return true;
  }

  const techAreas = Array.isArray(technique.trainingArea)
    ? technique.trainingArea
    : [technique.trainingArea];

  return techAreas.some((a) => areas.includes(a));
}

// ─── Öffentliche API ──────────────────────────────────────────────────────────

/**
 * Berechnet den Relevanzwert (0–100) einer Technik für einen Kurs.
 *
 * Gewichtung:
 *   40% frequencyScore  — wie häufig wird die Technik im Training eingesetzt
 *   25% priorityScore   — allgemeine Wichtigkeit der Technik
 *   15% discipline      — passt die Disziplin zum Kurs
 *   10% safety          — Specialist-Techniken werden leicht abgewertet
 *   10% diversity       — wird extern beim Auswählen genutzt, hier neutral
 */
export function computeRelevanceScore(
  technique: Technique,
  course: CourseDefinition,
): number {
  // Frequenz-Score (40%) — Default 5 wenn nicht gesetzt
  const freq = technique.frequencyScore ?? 5;
  const freqComponent = (freq / 10) * 40;

  // Prioritäts-Score (25%) — Default 5 wenn nicht gesetzt
  const prio = technique.priorityScore ?? 5;
  const prioComponent = (prio / 10) * 25;

  // Disziplin-Match (15%)
  const discMatch = disciplineMatchScore(technique, course.discipline);
  const discComponent = discMatch * 15;

  // Sicherheit / Rolle (10%) — Specialist bekommt Abzug (weniger geeignet für Einsteiger)
  const role = technique.role;
  let safetyFactor: number;
  if (role === "specialist") {
    safetyFactor = 0; // Specialist = höchstes Risiko / Spezialisierung
  } else if (role === "advanced") {
    safetyFactor = 0.5;
  } else {
    safetyFactor = 1; // core, support, drill, combo → sicher
  }
  const safetyComponent = safetyFactor * 10;

  // Diversity-Placeholder (10%) — wird beim Auswählen angewendet, hier neutral (5/10)
  const diversityComponent = 5;

  // Bonus: trainingArea gesetzt und passend → leichter Bonus
  const hasAreaMatch =
    technique.trainingArea !== undefined &&
    trainingAreaMatches(technique, course.techniqueAreas);
  const areaBonus = hasAreaMatch ? 3 : 0;

  const raw =
    freqComponent + prioComponent + discComponent + safetyComponent + diversityComponent + areaBonus;

  // Clamp auf 0–100
  return Math.min(100, Math.max(0, Math.round(raw)));
}

/**
 * Gibt alle CourseTechniqueMapping-Einträge für einen Kurs zurück,
 * gefiltert, gewichtet und nach Relevanz sortiert.
 *
 * Algorithmus:
 * 1. Filtere Techniken nach Disziplin, Trainingsbereich und Level
 * 2. Berechne Relevanzscores
 * 3. Sortiere absteigend nach Score
 * 4. Diversity-Cap: max. 20% der Gesamtzahl pro diversityGroup
 * 5. Limitiere auf course.maxTechniques
 */
export function getTechniquesForCourse(
  courseId: string,
  allTechniques: Technique[],
): CourseTechniqueMapping[] {
  const course = getCourseById(courseId);
  if (!course) return [];

  // ─ Schritt 1: Filtern ───────────────────────────────────────────────────

  const candidates = allTechniques.filter((t) => {
    // Disziplin muss passen (mind. ein partieller Match)
    const discScore = disciplineMatchScore(t, course.discipline);
    if (discScore === 0) return false;

    // Trainingsbereich: wenn vorhanden muss er in den Kurs-Areas liegen
    if (t.trainingArea !== undefined && !trainingAreaMatches(t, course.techniqueAreas)) {
      return false;
    }

    // Level-Prüfung
    if (!levelMatches(t, course.level)) return false;

    return true;
  });

  // ─ Schritt 2: Scores berechnen ──────────────────────────────────────────

  const scored = candidates.map((t) => ({
    technique: t,
    score: computeRelevanceScore(t, course),
  }));

  // ─ Schritt 3: Absteigend nach Score sortieren ───────────────────────────

  scored.sort((a, b) => b.score - a.score);

  // ─ Schritt 4: Diversity-Cap — max. 20% pro diversityGroup ───────────────

  const diversityCap = Math.max(1, Math.ceil(course.maxTechniques * 0.2));
  const groupCounts = new Map<string, number>();
  const diversified: typeof scored = [];

  for (const entry of scored) {
    const group = entry.technique.diversityGroup;

    if (!group) {
      // Keine Gruppe → immer aufnehmen
      diversified.push(entry);
      continue;
    }

    const count = groupCounts.get(group) ?? 0;
    if (count < diversityCap) {
      diversified.push(entry);
      groupCounts.set(group, count + 1);
    }
  }

  // ─ Schritt 5: Limitieren auf maxTechniques ──────────────────────────────

  const limited = diversified.slice(0, course.maxTechniques);

  // ─ Ausgabe: CourseTechniqueMapping[] ────────────────────────────────────

  return limited.map((entry, index) => ({
    courseId: course.id,
    techniqueId: entry.technique.id,
    relevanceScore: entry.score,
    sortOrder: index + 1,
    isCore: entry.technique.role === "core" || entry.score >= 70,
    isVisible: true,
  }));
}

/**
 * Gibt einen Kurs anhand seiner ID zurück.
 */
export function getCourseById(courseId: string): CourseDefinition | undefined {
  return COURSES.find((c) => c.id === courseId);
}
