"use client";

/**
 * Workout-Detail (?payload=…) — Ziel des „Detail"-Buttons im Session-Runner.
 * Zeigt das laufende Workout im selben Aufbau wie die Plan-Seite (PlanView):
 * Plan-Workouts lösen über die id „plan-<slug>" auf den echten Plan auf,
 * generierte Workouts werden als gleichgeformte Ansicht direkt aus dem
 * Payload gerendert. Der alte Timer-Runner dieser Route ist ersatzlos raus
 * (Leon 2026-08-27) — geführt trainiert wird nur noch in /workout/session;
 * „Workout starten" hier steigt mit dem unveränderten Payload wieder ein.
 */

import Icon from "@/components/ui/Icon";
import { CATEGORY_LABEL } from "@/lib/techniques";
import { DIFFICULTY_LABEL, type WorkoutDefinition } from "@/lib/types";
import { getDefaultPlanBySlug } from "@/lib/workout-plan-defaults";
import { type WorkoutPlan } from "@/lib/workout-plans";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import PlanView from "./plans/[slug]/PlanView";

const BLOCK_LABEL: Record<string, string> = {
  warmup: "Aufwärmen",
  main: "Hauptteil",
  conditioning: "Konditionierung",
  cooldown: "Cooldown",
};

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

function parseWorkout(payload: string | null): WorkoutDefinition | null {
  if (!payload) return null;
  try {
    return JSON.parse(decodeURIComponent(payload)) as WorkoutDefinition;
  } catch {
    return null;
  }
}

function WorkoutDetail() {
  const params = useSearchParams();
  const raw = params.get("payload");
  const workout = useMemo(() => parseWorkout(raw), [raw]);

  // Plan-Workout → echter Plan (planToWorkoutDefinition setzt id „plan-<slug>")
  const plan = workout?.id.startsWith("plan-")
    ? getDefaultPlanBySlug(workout.id.slice("plan-".length))
    : undefined;

  // Generiertes Workout → Plan-förmig aus dem Payload, damit PlanView es
  // identisch rendert. Die Blockpause ist der Timer-Default der Definition;
  // die Category ist Teilmenge von Discipline (gleiche Slugs).
  const generatedPlan = useMemo<WorkoutPlan | null>(() => {
    if (!workout) return null;
    return {
      id: workout.id,
      slug: workout.id,
      gymId: "generated",
      discipline: workout.category,
      difficulty: workout.difficulty,
      name: workout.label,
      short: "",
      description: `Auto-generiertes Workout — ${DIFFICULTY_LABEL[workout.difficulty]} · ${CATEGORY_LABEL[workout.category]}`,
      blocks: workout.blocks.map((b) => ({
        title: BLOCK_LABEL[b.phase] ?? b.phase,
        phase: b.phase,
        exerciseIds: b.exerciseIds,
        restSeconds: workout.restSeconds,
      })),
    };
  }, [workout]);

  if (!workout || !generatedPlan) {
    return (
      <main
        className="min-h-screen"
        style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4 px-4 pt-16 lg:px-6">
          <h1
            style={{
              font: "var(--type-h2)",
              letterSpacing: "var(--ls-display)",
              textTransform: "uppercase",
            }}
          >
            Kein Workout geladen
          </h1>
          <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
            Diese Ansicht zeigt die Details eines laufenden Workouts. Starte
            eins über den Workout-Hub.
          </p>
          <Link
            href="/workout/generator"
            className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-5"
            style={{
              ...BTN_FONT,
              background: "var(--accent)",
              color: "var(--on-accent)",
              boxShadow: "var(--accent-glow)",
              textDecoration: "none",
            }}
          >
            <Icon name="arrow-left" size={13} strokeWidth={2.2} />
            Zum Workout-Hub
          </Link>
        </div>
      </main>
    );
  }

  if (plan) {
    return <PlanView plan={plan} sessionPayload={raw ?? undefined} />;
  }
  return (
    <PlanView
      plan={generatedPlan}
      sessionPayload={raw ?? undefined}
      backHref="/workout/generator"
      backLabel="Workout"
    />
  );
}

export default function WorkoutDetailPage() {
  // useSearchParams braucht die Suspense-Grenze (Next-App-Router)
  return (
    <Suspense fallback={null}>
      <WorkoutDetail />
    </Suspense>
  );
}
