"use client";

/**
 * Plan-Detail der Gym-/Start-Pläne — lädt den Plan seit dem Seeding
 * (Etappe „Workout-Pläne", Schritt 5) clientseitig aus
 * gyms/{gymId}/workoutPlans (Doc-ID = Slug → Deep-Links bleiben stabil,
 * Trainer-Änderungen erscheinen sofort). Editor direkt aktiv (flüchtiger
 * Entwurf); gespeichert wird erst über „Als eigenen Plan speichern" oder
 * das Herz nach dem Workout.
 */

import Icon from "@/components/ui/Icon";
import { useAuth } from "@/lib/auth-context";
import { resolveGymId } from "@/lib/gym";
import { getGymWorkoutPlan, type WorkoutPlan } from "@/lib/workout-plans";
import Link from "next/link";
import { useEffect, useState } from "react";
import PlanView from "./PlanView";

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

export default function GymPlanPage({ slug }: { slug: string }) {
  const { user, profile, loading: authLoading, profileLoading } = useAuth();

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    // gymId kommt aus dem Profil (Spiegel des Token-Claims) — erst laden,
    // wenn es aufgelöst ist, sonst fragt ein Fremd-Gym-User das Default-Gym
    // an und die Rules werfen ihn ab.
    if (!user || profileLoading) return;
    let cancelled = false;
    getGymWorkoutPlan(resolveGymId(profile), slug)
      .then((p) => {
        if (cancelled) return;
        if (p) setPlan(p);
        else setMissing(true);
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

  // allowEdit: Editor direkt aktiv (flüchtiger Entwurf, PlanView-Draft)
  return <PlanView plan={plan} allowEdit />;
}
