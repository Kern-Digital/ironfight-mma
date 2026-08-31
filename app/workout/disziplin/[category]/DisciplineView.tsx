"use client";

/**
 * Client-Ansicht der Disziplin-Seite (Ebene 2 des Training-Tabs):
 * Level-Segment (Anfänger/Fortgeschritten/Pro) + Planliste mit Dauer,
 * Übungszahl und Equipment. Kopf mit Rubrik-Schein in der abgenommenen
 * Optik der Plan-Detail-Seite (Maske, Schein läuft nach unten aus).
 *
 * Datenquelle sind seit dem Seeding (Etappen-Schritt 5) die Gym-Pläne aus
 * Firestore (gyms/{gymId}/workoutPlans) — Trainer-Änderungen erscheinen
 * sofort, die eingebauten Start-Pläne sind nur noch Seed-Datenquelle.
 */

import AthleteTabBar from "@/components/AthleteTabBar";
import Icon from "@/components/ui/Icon";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { DISCIPLINE_COLOR } from "@/lib/discipline-colors";
import { EQUIPMENT } from "@/lib/equipment";
import { resolveGymId } from "@/lib/gym";
import { type WorkoutDisciplineInfo } from "@/lib/workout-plan-defaults";
import {
  listSharedTrainerPlans,
  listWorkoutPlansForGym,
  planDurationSeconds,
  planEquipment,
  planExerciseCount,
  type TrainerWorkoutPlan,
  type WorkoutPlan,
} from "@/lib/workout-plans";
import { DIFFICULTY_LABEL, type Difficulty } from "@/lib/types";
import Link from "next/link";
import { useEffect, useState } from "react";

const DIFFICULTIES: Difficulty[] = ["anfaenger", "fortgeschritten", "pro"];

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

/** „Keine Geräte" wenn leer, sonst die Equipment-Labels. */
function equipmentLine(plan: WorkoutPlan): string {
  const ids = planEquipment(plan);
  if (ids.length === 0) return "Keine Geräte";
  return ids
    .map((id) => EQUIPMENT[id]?.label)
    .filter(Boolean)
    .join(" · ");
}

export default function DisciplineView({
  info,
}: {
  info: WorkoutDisciplineInfo;
}) {
  const { user, profile, profileLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isTrainer = profile?.role === "trainer" || profile?.role === "admin";

  const [difficulty, setDifficulty] = useState<Difficulty>("anfaenger");

  // null = lädt noch (kein Leer-Blitz). gymId kommt aus dem Profil
  // (Spiegel des Token-Claims) — erst laden, wenn es aufgelöst ist.
  const [allPlans, setAllPlans] = useState<WorkoutPlan[] | null>(null);
  // Für MICH freigegebene Trainer-Pläne (AUSBAU Stufe 1) — erscheinen
  // OBEN in der Level-Liste mit „Vom Trainer"-Chip.
  const [sharedPlans, setSharedPlans] = useState<TrainerWorkoutPlan[] | null>(
    null,
  );
  useEffect(() => {
    if (!user || profileLoading) return;
    let cancelled = false;
    listWorkoutPlansForGym(resolveGymId(profile))
      .then((all) => {
        if (!cancelled) {
          setAllPlans(all.filter((p) => p.discipline === info.discipline));
        }
      })
      .catch(() => {
        if (!cancelled) setAllPlans([]);
      });
    listSharedTrainerPlans(resolveGymId(profile), user.uid)
      .then((all) => {
        if (!cancelled) {
          setSharedPlans(all.filter((p) => p.discipline === info.discipline));
        }
      })
      .catch(() => {
        if (!cancelled) setSharedPlans([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user, profile, profileLoading, info.discipline]);

  const trainerPlans = (sharedPlans ?? []).filter(
    (p) => p.difficulty === difficulty,
  );
  const plans = (allPlans ?? []).filter((p) => p.difficulty === difficulty);

  return (
    <main
      className={isTrainer ? "min-h-screen pb-12" : "min-h-screen pb-32"}
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      {/* Kopfbereich — gleiche Sprache wie die Plan-Detail-Seite */}
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
          <div data-ambient>
            <span
              data-glow
              style={{
                left: "-12%",
                top: "-30%",
                width: "55%",
                height: "160%",
                background: `color-mix(in oklab, ${DISCIPLINE_COLOR[info.discipline]} var(--cat-glow-mix), transparent)`,
              }}
            />
          </div>
        </div>
        <div className="relative mx-auto flex w-full max-w-2xl items-start gap-3 px-4 pb-5 pt-4 lg:max-w-5xl lg:px-6 lg:pb-7 lg:pt-6">
          <div className="flex flex-1 flex-col gap-1">
            <Link
              href="/workout/generator"
              className="t-interactive -ml-2 mb-1 inline-flex min-h-hit items-center gap-1.5 self-start rounded-field px-2"
              style={{ ...BTN_FONT, color: "var(--text-3)", textDecoration: "none" }}
            >
              <Icon name="arrow-left" size={14} strokeWidth={2.2} />
              Workout
            </Link>
            <h1
              style={{
                font: "var(--type-display)",
                letterSpacing: "var(--ls-display)",
                textTransform: "uppercase",
              }}
            >
              {info.name}
            </h1>
            <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              {info.short}
            </p>
          </div>
          {!isTrainer && (
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? "Helles Design aktivieren"
                  : "Dunkles Design aktivieren"
              }
              className="t-glass t-interactive inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-field lg:hidden"
              style={{ color: "var(--text-2)" }}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} size={20} />
            </button>
          )}
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-4 lg:max-w-5xl lg:px-6 lg:pt-5">
        {/* Level-Segment */}
        <div className="flex flex-wrap gap-2">
          {DIFFICULTIES.map((d) => {
            const active = difficulty === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                aria-pressed={active}
                className="t-interactive min-h-hit flex-1 whitespace-nowrap rounded-field px-3"
                style={{
                  ...BTN_FONT,
                  background: active ? "var(--accent-subtle)" : "var(--surface-raised)",
                  border: "1px solid",
                  borderColor: active ? "var(--accent)" : "var(--line)",
                  color: active ? "var(--accent-text)" : "var(--text-2)",
                }}
              >
                {DIFFICULTY_LABEL[d]}
              </button>
            );
          })}
        </div>

        {/* Planliste — erst mit dem Ladeergebnis (kein „keine Pläne"-Blitz).
            Freigegebene Trainer-Pläne stehen OBEN, markiert per Chip
            (Level nie farbcodiert — der Chip ist Text im Akzent). */}
        {allPlans === null || sharedPlans === null ? null : trainerPlans.length +
            plans.length ===
          0 ? (
          <p
            className="py-8 text-center"
            style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
          >
            Für dieses Level gibt es noch keine Pläne.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {[
              ...trainerPlans.map((plan) => ({
                plan: plan as WorkoutPlan,
                // Wer geteilt hat (Leon 31.08.) — bei mehreren Trainern
                // muss die Herkunft am Plan erkennbar sein
                sharedBy: plan.createdByName || "Trainer",
              })),
              ...plans.map((plan) => ({ plan, sharedBy: null })),
            ].map(({ plan, sharedBy }) => {
              const fromTrainer = sharedBy !== null;
              const minutes = Math.round(planDurationSeconds(plan) / 60);
              const exercises = planExerciseCount(plan);
              return (
                <Link
                  key={`${fromTrainer ? "trainer" : "gym"}-${plan.slug}`}
                  href={`/workout/plans/${plan.slug}`}
                  className="t-card t-interactive flex items-center gap-4 p-4 sm:p-5"
                  style={{ textDecoration: "none", color: "var(--text-body)" }}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    {fromTrainer && (
                      <span
                        className="self-start rounded-badge px-2 py-1"
                        style={{
                          ...META_FONT,
                          background: "var(--accent-subtle)",
                          border: "1px solid var(--accent)",
                          color: "var(--accent-text)",
                        }}
                      >
                        Von {sharedBy}
                      </span>
                    )}
                    <h3
                      style={{
                        font: "var(--type-h2)",
                        letterSpacing: "var(--ls-display)",
                        textTransform: "uppercase",
                      }}
                    >
                      {plan.name}
                    </h3>
                    <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                      {plan.short}
                    </p>
                    <div className="mt-1 flex flex-col gap-0.5">
                      <span style={{ ...META_FONT, color: "var(--text-2)" }}>
                        ≈ {minutes} min · {exercises} Übungen
                      </span>
                      <span style={{ ...META_FONT, color: "var(--text-3)" }}>
                        {equipmentLine(plan)}
                      </span>
                    </div>
                  </div>
                  <span
                    aria-hidden
                    className="shrink-0"
                    style={{ color: "var(--text-3)", lineHeight: 0 }}
                  >
                    <Icon name="arrow-right" size={18} strokeWidth={2} />
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {!isTrainer && <AthleteTabBar />}
    </main>
  );
}
