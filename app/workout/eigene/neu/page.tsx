"use client";

/**
 * Neues eigenes Workout — komplett selbst zusammengestellt (Teilschritt 3,
 * „+"-Knopf im Eigene-Workoutpläne-Popup). Lokaler Entwurf mit den drei
 * Standard-Blöcken; Übungen kommen per Picker aus der GESAMTEN Bibliothek.
 * Gespeichert wird EXPLIZIT über „Plan speichern" (kein Auto-Save — sonst
 * entstünden beim bloßen Reinschauen leere Pläne); danach geht es in die
 * normale Kopie-Ansicht /workout/eigene/[id] mit Auto-Save.
 */

import { useAuth } from "@/lib/auth-context";
import {
  PHASE_LABEL,
  planWithAddedExercise,
  planWithDuplicatedExercise,
  planWithMovedExercise,
  planWithRemovedExercise,
  upsertPersonalWorkoutPlan,
  type WorkoutPlan,
} from "@/lib/workout-plans";
import { useRouter } from "next/navigation";
import { useState } from "react";
import PlanView from "../../plans/[slug]/PlanView";

function emptyPlan(): WorkoutPlan {
  return {
    id: "",
    slug: "",
    gymId: "personal",
    // Ohne Eingabefelder (Leon 2026-08-28: braucht man beim eigenen Workout
    // nicht) — die Defaults erfüllen nur das Datenmodell
    discipline: "boxing",
    difficulty: "anfaenger",
    name: "",
    short: "",
    description: "",
    blocks: [
      {
        title: PHASE_LABEL.warmup,
        phase: "warmup",
        exerciseIds: [],
        restSeconds: 30,
      },
      {
        title: PHASE_LABEL.main,
        phase: "main",
        exerciseIds: [],
        restSeconds: 60,
      },
      {
        title: PHASE_LABEL.cooldown,
        phase: "cooldown",
        exerciseIds: [],
        restSeconds: 30,
      },
    ],
  };
}

export default function NewPersonalPlanPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [plan, setPlan] = useState<WorkoutPlan>(emptyPlan());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(patch: (p: WorkoutPlan) => WorkoutPlan) {
    setPlan((p) => patch(p));
  }

  // `saving` bleibt bei Erfolg stehen — die Navigation läuft schon
  async function handleSave() {
    if (!user || saving) return;
    setSaving(true);
    setError(null);
    try {
      const id = await upsertPersonalWorkoutPlan(user.uid, plan, {
        sourcePlanId: null,
      });
      router.replace(`/workout/eigene/${id}`);
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    }
  }

  return (
    <PlanView
      plan={plan}
      backHref="/workout/generator"
      backLabel="Workout"
      editing={{
        onNameChange: (name) => update((p) => ({ ...p, name })),
        onExerciseRestChange: (exerciseId, restSeconds) =>
          update((p) => ({
            ...p,
            restOverrides: {
              ...(p.restOverrides ?? {}),
              [exerciseId]: restSeconds,
            },
          })),
        onRestAfterChange: (blockIndex, restAfterSeconds) =>
          update((p) => ({
            ...p,
            blocks: p.blocks.map((b, i) =>
              i === blockIndex ? { ...b, restAfterSeconds } : b,
            ),
          })),
        onAddExercise: (blockIndex, exerciseId) =>
          update((p) => planWithAddedExercise(p, blockIndex, exerciseId)),
        onRemoveExercise: (blockIndex, exerciseIndex) =>
          update((p) => planWithRemovedExercise(p, blockIndex, exerciseIndex)),
        onDuplicateExercise: (blockIndex, exerciseIndex) =>
          update((p) =>
            planWithDuplicatedExercise(p, blockIndex, exerciseIndex),
          ),
        onMoveExercise: (from, to) =>
          update((p) => planWithMovedExercise(p, from, to)),
        create: { onSave: () => void handleSave(), saving },
        error,
      }}
    />
  );
}
