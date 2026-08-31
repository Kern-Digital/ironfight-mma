"use client";

/**
 * Trainer-Workout-Pläne (Workout-Pläne AUSBAU Stufe 1) — Liste aller
 * Trainer-Pläne des Gyms mit Freigabe-Stand. Token-Look (DESIGN-BRIEF):
 * die neuen Trainer-Oberflächen dieser Stufe entstehen direkt im neuen
 * System, der restliche Trainer-Bereich folgt in seiner eigenen Etappe.
 * Route liegt unter /trainer/* → Middleware lässt nur Trainer/Admin durch.
 */

import PlanAudienceSheet from "@/components/PlanAudienceSheet";
import Icon from "@/components/ui/Icon";
import { useAuth } from "@/lib/auth-context";
import { resolveGymId } from "@/lib/gym";
import {
  listTrainerWorkoutPlans,
  planDurationSeconds,
  planExerciseCount,
  updateTrainerPlanAudience,
  type TrainerWorkoutPlan,
} from "@/lib/workout-plans";
import { DIFFICULTY_LABEL, DISCIPLINE_LABEL } from "@/lib/types";
import Link from "next/link";
import { useEffect, useState } from "react";

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

// Größe kommt responsiv über Klassen (Leon 30.08.: am Desktop größer,
// 10px war dort schlecht lesbar) — deshalb kein font-Shorthand
const META_BASE: React.CSSProperties = {
  fontFamily: "var(--font-archivo), system-ui, sans-serif",
  fontWeight: 600,
  lineHeight: 1.3,
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};
const META_SIZE = "text-[10px] sm:text-[13px]";

/** Freigabe-Stand in einer Zeile — Akzent, sobald freigegeben; das Wort
    „Freigegeben" fällt dann weg (Leon 30.08.), die Farbe trägt es. */
function audienceLine(plan: TrainerWorkoutPlan): {
  text: string;
  shared: boolean;
} {
  const n = plan.audienceUids.length;
  if (n === 0) return { text: "Nicht freigegeben", shared: false };
  const courses = plan.audienceCourseIds.length;
  const students = `${n} Schüler`;
  if (courses === 0) return { text: students, shared: true };
  return {
    text: `${students} · ${courses} ${courses === 1 ? "Kurs" : "Kurse"}`,
    shared: true,
  };
}

export default function TrainerPlansPage() {
  const { user, profile, profileLoading } = useAuth();
  const gymId = resolveGymId(profile);

  const [plans, setPlans] = useState<TrainerWorkoutPlan[] | null>(null);
  const [error, setError] = useState(false);
  // Freigabe direkt aus der Liste (Leon 30.08.): Symbol pro Zeile öffnet
  // das Sheet für DIESEN Plan
  const [audiencePlan, setAudiencePlan] = useState<TrainerWorkoutPlan | null>(
    null,
  );

  async function handleAudienceSave(uids: string[], courseIds: string[]) {
    if (!audiencePlan) return;
    await updateTrainerPlanAudience(gymId, audiencePlan.id, uids, courseIds);
    setPlans(
      (list) =>
        list?.map((p) =>
          p.id === audiencePlan.id
            ? { ...p, audienceUids: uids, audienceCourseIds: courseIds }
            : p,
        ) ?? list,
    );
  }

  useEffect(() => {
    if (!user || profileLoading) return;
    let cancelled = false;
    listTrainerWorkoutPlans(resolveGymId(profile))
      .then((list) => {
        if (!cancelled) setPlans(list);
      })
      .catch(() => {
        if (!cancelled) {
          setPlans([]);
          setError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user, profile, profileLoading]);

  return (
    <main
      className="min-h-screen pb-12"
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      {/* Kopfbereich mit Ambient-Schicht (Muster der Workout-Seiten) */}
      <section className="relative">
        <div
          className="absolute inset-0 overflow-hidden"
          aria-hidden
          style={{
            maskImage:
              "linear-gradient(to bottom, black 55%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black 55%, transparent 100%)",
          }}
        >
          <div data-ambient style={{ background: "var(--ambient)" }} />
        </div>
        <div className="relative mx-auto flex w-full max-w-2xl items-start gap-3 px-4 pb-5 pt-4 lg:max-w-5xl lg:px-6 lg:pb-7 lg:pt-6">
          <div className="flex flex-1 flex-col gap-1">
            <Link
              href="/trainer"
              className="t-interactive -ml-2 mb-1 inline-flex min-h-hit items-center gap-1.5 self-start rounded-field px-2"
              style={{
                ...BTN_FONT,
                color: "var(--text-3)",
                textDecoration: "none",
              }}
            >
              <Icon name="arrow-left" size={14} strokeWidth={2.2} />
              Trainer
            </Link>
            <h1
              style={{
                font: "var(--type-display)",
                letterSpacing: "var(--ls-display)",
                textTransform: "uppercase",
              }}
            >
              Workout-Pläne
            </h1>
            <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              Eigene Pläne erstellen und an Kurse oder einzelne Schüler
              freigeben.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-4 lg:max-w-5xl lg:px-6 lg:pt-5">
        <div>
          <Link
            href="/trainer/plans/neu"
            className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-5"
            style={{
              ...BTN_FONT,
              background: "var(--accent)",
              color: "var(--on-accent)",
              boxShadow: "var(--accent-glow)",
              textDecoration: "none",
            }}
          >
            <Icon name="plus" size={13} strokeWidth={2.4} />
            Neuer Plan
          </Link>
        </div>

        {error && (
          <p style={{ font: "var(--type-sub)", color: "var(--negative)" }}>
            Pläne konnten nicht geladen werden.
          </p>
        )}

        {/* Liste erst mit Ladeergebnis (kein Leer-Blitz) */}
        {plans === null ? null : plans.length === 0 && !error ? (
          <p
            className="py-8 text-center"
            style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
          >
            Noch keine Trainer-Pläne — leg den ersten an und gib ihn an
            deine Schüler frei.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {plans.map((plan) => {
              const minutes = Math.round(planDurationSeconds(plan) / 60);
              const exercises = planExerciseCount(plan);
              const audience = audienceLine(plan);
              return (
                <Link
                  key={plan.id}
                  href={`/trainer/plans/${plan.id}`}
                  className="t-card t-interactive flex items-start gap-4 p-4 sm:items-center sm:p-5"
                  style={{ textDecoration: "none", color: "var(--text-body)" }}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <h3
                      style={{
                        font: "var(--type-h2)",
                        letterSpacing: "var(--ls-display)",
                        textTransform: "uppercase",
                      }}
                    >
                      {plan.name || "Unbenannter Plan"}
                    </h3>
                    <div className="mt-1 flex flex-col gap-0.5">
                      <span
                        className={META_SIZE}
                        style={{ ...META_BASE, color: "var(--text-2)" }}
                      >
                        {DIFFICULTY_LABEL[plan.difficulty]} ·{" "}
                        {DISCIPLINE_LABEL[plan.discipline]} · ≈ {minutes} min ·{" "}
                        {exercises} Übungen
                      </span>
                      <span
                        className={META_SIZE}
                        style={{
                          ...META_BASE,
                          color: audience.shared
                            ? "var(--accent-text)"
                            : "var(--text-3)",
                        }}
                      >
                        {audience.text}
                      </span>
                    </div>
                  </div>
                  {/* Freigabe direkt aus der Liste (Leon 30.08.) — mobil
                      rechts auf Höhe des Plannamens, Desktop mittig */}
                  <button
                    type="button"
                    aria-label={`„${plan.name || "Unbenannter Plan"}" freigeben`}
                    onClick={(e) => {
                      // Nicht zusätzlich zur Detailseite navigieren
                      e.preventDefault();
                      e.stopPropagation();
                      setAudiencePlan(plan);
                    }}
                    className="t-interactive -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-field sm:mt-0 sm:h-14 sm:w-14"
                    style={{ color: "var(--accent-text)" }}
                  >
                    {/* Mobil kompakt, am Desktop deutlich größer (Leon 30.08.) */}
                    <Icon name="users" size={20} strokeWidth={2} className="sm:hidden" />
                    <Icon
                      name="users"
                      size={34}
                      strokeWidth={1.8}
                      className="hidden sm:block"
                    />
                  </button>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Freigabe-Sheet für den gewählten Plan */}
      {audiencePlan && (
        <PlanAudienceSheet
          gymId={gymId}
          planName={audiencePlan.name || "Unbenannter Plan"}
          initialUids={audiencePlan.audienceUids}
          initialCourseIds={audiencePlan.audienceCourseIds}
          onSave={handleAudienceSave}
          onClose={() => setAudiencePlan(null)}
        />
      )}
    </main>
  );
}
