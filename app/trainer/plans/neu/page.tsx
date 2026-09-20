"use client";

/**
 * Neuer Trainer-Plan (Workout-Pläne AUSBAU Stufe 1) — derselbe Editor wie
 * bei den persönlichen Plänen (PlanView, Listen-Gesten, ExercisePicker),
 * zusätzlich der Disziplin-Select (nötig für die Disziplin-Navigation der
 * Athleten). Lokaler Entwurf, EXPLIZITER Speichern-Knopf
 * (Muster /workout/eigene/neu); freigegeben wird danach auf der
 * Detailseite — ein frisch angelegter Plan ist für niemanden sichtbar.
 *
 * KURS-ZUORDNUNG (Leon 19.09.): Der Plan lässt sich hier schon Kursen
 * zuordnen. Kommt der Trainer über das „+" eines Kurses in der Ansicht
 * „Nach Kursen" (`?kurs=<Kursname>`), ist dieser Kurs vorgewählt und die
 * Disziplin folgt seiner Rubrik, falls er eine hat. Freigegeben ist damit
 * trotzdem nichts — Zuordnung ordnet nur.
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
import { blocksForCourse } from "@/lib/schedule";
import type { Discipline } from "@/lib/types";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import PlanView from "../../../workout/plans/[slug]/PlanView";

type NeuerPlan = WorkoutPlan & { courseIds: string[] };

/** Leerer Entwurf — mit `kurs` diesem Kurs zugeordnet (alle Termine). */
function emptyPlan(kurs: string | null): NeuerPlan {
  const termine = kurs ? blocksForCourse(kurs) : [];
  // Rubrik des Kurses als Disziplin, sofern er eine trägt (MMA-Kurse
  // haben keine — dann bleibt der Standard)
  const rubrik = termine.find((b) => b.category)?.category;
  return {
    id: "",
    slug: "",
    gymId: "",
    courseIds: termine.map((b) => b.id),
    discipline: rubrik ?? "boxing",
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
  // useSearchParams braucht eine Suspense-Grenze (sonst bricht der Build)
  return (
    <Suspense fallback={null}>
      <NewTrainerPlanContent />
    </Suspense>
  );
}

function NewTrainerPlanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();

  const [plan, setPlan] = useState<NeuerPlan>(() =>
    emptyPlan(searchParams.get("kurs")),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(patch: (p: NeuerPlan) => NeuerPlan) {
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
          onDisciplineChange: (discipline: Discipline) =>
            update((p) => ({ ...p, discipline })),
          courses: {
            ids: plan.courseIds,
            onChange: (courseIds) => update((p) => ({ ...p, courseIds })),
          },
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
