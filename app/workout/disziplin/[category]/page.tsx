import {
  WORKOUT_DISCIPLINES,
  getWorkoutDiscipline,
} from "@/lib/workout-plan-defaults";
import { notFound } from "next/navigation";
import DisciplineView from "./DisciplineView";

// Ebene 2 des Training-Tabs (Etappe „Workout-Pläne", Teilschritt 2):
// Disziplin-Seite mit Level-Segment und Planliste. Statisch die vier
// Kern-Disziplinen — Gym-Rubriken kommen mit Multi-Gym Phase 3.
export function generateStaticParams() {
  return WORKOUT_DISCIPLINES.map((d) => ({ category: d.discipline }));
}

export function generateMetadata({ params }: { params: { category: string } }) {
  const info = getWorkoutDiscipline(params.category);
  if (!info) return { title: "Disziplin nicht gefunden — Tidal Athletics" };
  return {
    title: `${info.name} Pläne — Tidal Athletics`,
    description: `Strukturierte ${info.name}-Trainingspläne nach Level.`,
  };
}

export default function WorkoutDisciplinePage({
  params,
}: {
  params: { category: string };
}) {
  const info = getWorkoutDiscipline(params.category);
  if (!info) notFound();

  return <DisciplineView info={info} />;
}
