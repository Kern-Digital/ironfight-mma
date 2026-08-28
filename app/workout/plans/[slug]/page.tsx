import {
  DEFAULT_WORKOUT_PLANS,
  getDefaultPlanBySlug,
} from "@/lib/workout-plan-defaults";
import GymPlanPage from "./GymPlanPage";

// Die bekannten Start-Slugs werden statisch vorgerendert; die Plan-DATEN
// kommen seit dem Seeding (Schritt 5) clientseitig aus Firestore
// (GymPlanPage) — auch später angelegte Trainer-Pläne funktionieren so
// (dynamicParams). Metadaten nutzen weiter die eingebauten Start-Pläne;
// unbekannte Slugs bekommen den generischen Titel.
export function generateStaticParams() {
  return DEFAULT_WORKOUT_PLANS.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const plan = getDefaultPlanBySlug(params.slug);
  if (!plan) return { title: "Workout-Plan — Tidal Athletics" };
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
  return <GymPlanPage slug={params.slug} />;
}
