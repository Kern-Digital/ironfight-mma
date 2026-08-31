"use client";

/**
 * Neuer Trainer-Plan (Workout-Pläne AUSBAU Stufe 1) — derselbe Editor wie
 * bei den persönlichen Plänen (PlanView, Listen-Gesten, ExercisePicker),
 * zusätzlich Disziplin/Level-Selects (nötig für die Disziplin→Level-
 * Navigation der Athleten). Lokaler Entwurf, EXPLIZITER Speichern-Knopf
 * (Muster /workout/eigene/neu); freigegeben wird danach auf der
 * Detailseite — ein frisch angelegter Plan ist für niemanden sichtbar.
 */

import { useAuth } from "@/lib/auth-context";
import { resolveGymId } from "@/lib/gym";
import {
  PHASE_LABEL,
  planWithAddedBlock,
  planWithAddedExercise,
  planWithDuplicatedExercise,
  planWithMovedBlock,
  planWithMovedExercise,
  planWithRemovedBlock,
  planWithRemovedExercise,
  upsertTrainerWorkoutPlan,
  type WorkoutPlan,
} from "@/lib/workout-plans";
import type { Difficulty, Discipline } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useState } from "react";
import PlanView from "../../../workout/plans/[slug]/PlanView";

function emptyPlan(): WorkoutPlan {
  return {
    id: "",
    slug: "",
    gymId: "",
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

export default function NewTrainerPlanPage() {
  const router = useRouter();
  const { user, profile } = useAuth();

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
      const gymId = resolveGymId(profile);
      const id = await upsertTrainerWorkoutPlan(
        gymId,
        { ...plan, gymId },
        user.uid,
        // Name wird mitgeschrieben: Athleten dürfen fremde users-Dokumente
        // nicht lesen, „Von X geteilt" ginge sonst nicht
        profile?.displayName ?? profile?.authProviderName ?? "",
      );
      router.replace(`/trainer/plans/${id}`);
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    }
  }

  return (
    <PlanView
      plan={plan}
      backHref="/trainer/plans"
      backLabel="Workout-Pläne"
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
        onRemoveBlock: (blockIndex) =>
          update((p) => planWithRemovedBlock(p, blockIndex)),
        onAddBlock: () => update((p) => planWithAddedBlock(p)),
        onBlockTitleChange: (blockIndex, title) =>
          update((p) => ({
            ...p,
            blocks: p.blocks.map((b, i) =>
              i === blockIndex ? { ...b, title } : b,
            ),
          })),
        onMoveBlock: (from, to) =>
          update((p) => planWithMovedBlock(p, from, to)),
        meta: {
          discipline: plan.discipline,
          difficulty: plan.difficulty,
          onDisciplineChange: (discipline: Discipline) =>
            update((p) => ({ ...p, discipline })),
          onDifficultyChange: (difficulty: Difficulty) =>
            update((p) => ({ ...p, difficulty })),
        },
        create: {
          onSave: () => void handleSave(),
          saving,
          hint: `„Plan speichern" legt den Plan an — freigeben kannst du ihn danach auf der Plan-Seite.`,
        },
        error,
      }}
    />
  );
}
