import {
  DEFAULT_WORKOUT_PLANS,
  getDefaultPlanBySlug,
} from "@/lib/workout-plan-defaults";
import { notFound } from "next/navigation";
import PlanView from "./PlanView";

// Statisch nur die eingebauten Start-Pläne — Gym-/persönliche Pläne aus
// Firestore bekommen ihre Auflösung clientseitig in Etappen-Schritt 2.
export function generateStaticParams() {
  return DEFAULT_WORKOUT_PLANS.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const plan = getDefaultPlanBySlug(params.slug);
  if (!plan) return { title: "Plan nicht gefunden — Tidal Athletics" };
  return {
    title: `${plan.name} Plan — Tidal Athletics`,
    description: plan.description,
  };
}

export default function TrainingPlanPage({
  params,
}: {
  params: { slug: string };
}) {
  const plan = getDefaultPlanBySlug(params.slug);
  if (!plan) notFound();

  // allowEdit: Editor direkt aktiv (flüchtiger Entwurf); gespeichert wird
  // erst über „Als eigenen Plan speichern" oder das Herz nach dem Workout
  return <PlanView plan={plan} allowEdit />;
}
