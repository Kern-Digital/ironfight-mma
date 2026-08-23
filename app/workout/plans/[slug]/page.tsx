import { getPlanBySlug, TRAINING_PLANS } from "@/lib/training-plans";
import { notFound } from "next/navigation";
import PlanView from "./PlanView";

export function generateStaticParams() {
  return TRAINING_PLANS.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const plan = getPlanBySlug(params.slug);
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
  const plan = getPlanBySlug(params.slug);
  if (!plan) notFound();

  return <PlanView plan={plan} />;
}
