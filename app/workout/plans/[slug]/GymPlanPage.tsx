"use client";

/**
 * Plan-Detail der Gym-/Start-Pläne — lädt den Plan seit dem Seeding
 * (Etappe „Workout-Pläne", Schritt 5) clientseitig aus
 * gyms/{gymId}/workoutPlans (Doc-ID = Slug → Deep-Links bleiben stabil,
 * Trainer-Änderungen erscheinen sofort). Findet sich dort nichts, wird ein
 * freigegebener TRAINER-Plan versucht (AUSBAU Stufe 1) — EINE Route für
 * beide Quellen; ohne Freigabe wirft der Read permission-denied und die
 * Seite zeigt „Plan nicht gefunden" (Existenz bleibt verborgen).
 *
 * Editierbarkeit (Leons Vorgabe 31.08.):
 *   • Gym-/Start-Pläne: Editor direkt aktiv für alle (unverändert) —
 *     geändert + Herz = persönliche Kopie.
 *   • Trainer-Pläne: für ATHLETEN read-only (ein freigegebener Plan ist
 *     eine Vorgabe, keine Vorlage). Andere TRAINER dürfen anpassen und den
 *     Entwurf als NEUEN EIGENEN Trainer-Plan speichern, den sie dann selbst
 *     freigeben — das Original samt Freigabe bleibt unberührt.
 */

import Icon from "@/components/ui/Icon";
import { useAuth, useRights } from "@/lib/auth-context";
import { resolveGymId } from "@/lib/gym";
import {
  copyAsOwnTrainerPlan,
  getGymWorkoutPlan,
  getTrainerWorkoutPlan,
  type TrainerWorkoutPlan,
  type WorkoutPlan,
} from "@/lib/workout-plans";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PlanView from "./PlanView";

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

export default function GymPlanPage({ slug }: { slug: string }) {
  const router = useRouter();
  const { user, profile, loading: authLoading, profileLoading } = useAuth();
  const isTrainer = useRights().trainer;

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  // Trainer-Plan-Herkunft: null = Gym-/Start-Plan
  const [trainerPlan, setTrainerPlan] = useState<TrainerWorkoutPlan | null>(
    null,
  );
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    // gymId kommt aus dem Profil (Spiegel des Token-Claims) — erst laden,
    // wenn es aufgelöst ist, sonst fragt ein Fremd-Gym-User das Default-Gym
    // an und die Rules werfen ihn ab.
    if (!user || profileLoading) return;
    let cancelled = false;
    const gymId = resolveGymId(profile);
    getGymWorkoutPlan(gymId, slug)
      .then(async (gymPlan) => {
        if (gymPlan) return { plan: gymPlan, trainer: null };
        const tp = await getTrainerWorkoutPlan(gymId, slug);
        return tp ? { plan: tp as WorkoutPlan, trainer: tp } : null;
      })
      .then((found) => {
        if (cancelled) return;
        if (found) {
          setPlan(found.plan);
          setTrainerPlan(found.trainer);
        } else setMissing(true);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user, profile, profileLoading, slug]);

  // Nicht vorhanden oder ausgeloggt — gleiche Sprache wie eigene/[id]
  if (missing || (!authLoading && !user)) {
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
            Plan nicht gefunden
          </h1>
          <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
            Diesen Plan gibt es nicht mehr — oder er gehört zu einem anderen
            Gym.
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

  // Lädt (Auth oder Firestore) — Seitengrund statt weißem Blitz
  if (!plan) {
    return (
      <main className="min-h-screen" style={{ background: "var(--surface-page)" }} />
    );
  }

  // Gym-/Start-Plan: unverändert für alle editierbar (persönliche Kopie
  // über das Herz). Trainer-Plan: nur Trainer/Admin dürfen anpassen.
  if (!trainerPlan) {
    return <PlanView plan={plan} allowEdit />;
  }

  const sharedBy = trainerPlan.createdByName || undefined;
  // Trainer-Pläne hängen nicht an der Disziplin-Navigation — der Athlet
  // kommt aus dem Hub, nicht von der Disziplin-Seite (Leon 31.08.)
  const backProps = { backHref: "/workout/generator", backLabel: "Workout" };

  if (!isTrainer) {
    return <PlanView plan={plan} {...backProps} sharedBy={sharedBy} />;
  }

  return (
    <PlanView
      plan={plan}
      allowEdit
      {...backProps}
      sharedBy={sharedBy}
      draftAction={{
        label: "Als eigenen Plan speichern",
        icon: "copy",
        onSave: async (draft) => {
          if (!user) return;
          const id = await copyAsOwnTrainerPlan(
            resolveGymId(profile),
            draft,
            user.uid,
            profile?.displayName ?? profile?.authProviderName ?? "",
          );
          router.push(`/trainer/plans/${id}`);
        },
      }}
    />
  );
}
