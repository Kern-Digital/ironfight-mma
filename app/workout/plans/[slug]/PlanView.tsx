"use client";

/**
 * Client-Ansicht der Trainingsplan-Seite (neues Token-System, Etappe 4;
 * seit der Workout-Pläne-Etappe auf dem WorkoutPlan-Modell: Übungen kommen
 * als IDs aus lib/exercises, die Pause ist ein Feld pro Block, die
 * Gesamtdauer wird berechnet).
 * Die Seite selbst bleibt Server-Komponente (generateStaticParams/-Metadata);
 * hier lebt alles, was die Athleten-Shell braucht (Rolle, Theme, Tab-Bar).
 */

import AthleteTabBar from "@/components/AthleteTabBar";
import Icon from "@/components/ui/Icon";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { DISCIPLINE_COLOR } from "@/lib/discipline-colors";
import {
  blockExercises,
  planDurationSeconds,
  planExerciseCount,
  planToWorkoutDefinition,
  type WorkoutPlan,
} from "@/lib/workout-plans";
import Link from "next/link";
import { Fragment, useMemo } from "react";

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const META_FONT: React.CSSProperties = {
  font: "600 10px/1.2 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

function Hairline() {
  return <div aria-hidden style={{ height: "1px", background: "var(--line)" }} />;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} s`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s} s`;
}

/**
 * Eckdaten-Kachel: Zahl in num-xl, Präfix/Einheit eine Stufe kleiner
 * (Muster der Trainingsdauer-Anzeige im Generator) — bleibt dadurch
 * IMMER einzeilig, auch „≈ 68 min" in der 3-Spalten-Karte auf 360px.
 */
function Stat({
  label,
  value,
  unit,
  prefix,
}: {
  label: string;
  value: string;
  unit?: string;
  prefix?: string;
}) {
  const smallFont: React.CSSProperties = {
    font: "var(--type-body-strong)",
    color: "var(--text-3)",
  };
  return (
    <div className="flex flex-col gap-1">
      <span className="t-label">{label}</span>
      <span
        className="whitespace-nowrap tabular-nums"
        style={{ font: "var(--type-num-xl)", color: "var(--accent-text)" }}
      >
        {prefix && <span style={smallFont}>{prefix} </span>}
        {value}
        {unit && <span style={smallFont}> {unit}</span>}
      </span>
    </div>
  );
}

export default function PlanView({ plan }: { plan: WorkoutPlan }) {
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isTrainer = profile?.role === "trainer" || profile?.role === "admin";

  const totalExercises = planExerciseCount(plan);
  const totalMinutes = Math.round(planDurationSeconds(plan) / 60);

  // Gleiches Payload-Muster wie der Generator — der geführte Runner
  // (/workout/session) läuft bis zu seiner Umstellung (Schritt 4) über die
  // WorkoutDefinition-Brücke.
  const sessionHref = useMemo(() => {
    const p = new URLSearchParams();
    p.set(
      "payload",
      encodeURIComponent(JSON.stringify(planToWorkoutDefinition(plan))),
    );
    return `/workout/session?${p.toString()}`;
  }, [plan]);

  return (
    <main
      className={isTrainer ? "min-h-screen pb-12" : "min-h-screen pb-32"}
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      {/* Kopfbereich mit Ambient-Schicht */}
      <section className="relative">
        {/* Maske statt harter Kante: Schein + Ambient laufen zur Unterkante
            des Kopfbereichs weich aus (Leon-Feedback 2026-08-27) */}
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
          {/* Rubrik-Farbe als Schein von links — gleiche Sprache wie die
              Plan-Karten im Hub (kein Farbpunkt) */}
          <div data-ambient>
            <span
              data-glow
              style={{
                left: "-12%",
                top: "-30%",
                width: "55%",
                height: "160%",
                background: `color-mix(in oklab, ${DISCIPLINE_COLOR[plan.discipline]} var(--cat-glow-mix), transparent)`,
              }}
            />
          </div>
        </div>
        <div className="relative mx-auto flex w-full max-w-2xl items-start gap-3 px-4 pb-5 pt-4 lg:max-w-5xl lg:px-6 lg:pb-7 lg:pt-6">
          <div className="flex flex-1 flex-col gap-1">
            {/* Zurück-Weg: Unterseite des Training-Tabs, Orientierung bleibt */}
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
              {plan.name}
            </h1>
            <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              {plan.description}
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

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pt-1 lg:max-w-5xl lg:px-6">
        {/* Eckdaten + Start */}
        <section className="flex flex-col gap-5">
          <div className="t-card grid grid-cols-3 gap-4 p-4 sm:p-5">
            <Stat label="Dauer" value={String(totalMinutes)} prefix="≈" unit="min" />
            <Stat label="Übungen" value={String(totalExercises)} />
            <Stat label="Blöcke" value={String(plan.blocks.length)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={sessionHref}
              className="t-interactive inline-flex min-h-hit items-center justify-center gap-2 rounded-field px-5"
              style={{
                ...BTN_FONT,
                background: "var(--accent)",
                color: "var(--on-accent)",
                boxShadow: "var(--accent-glow)",
                textDecoration: "none",
              }}
            >
              <Icon name="play" size={13} strokeWidth={2.2} />
              Workout starten
            </Link>
          </div>
        </section>

        {/* Blöcke — pro Block EINE Karte mit Haarlinien-Trennern */}
        <div className="flex flex-col gap-8">
          {plan.blocks.map((block, idx) => {
            const exercises = blockExercises(block);
            return (
              <section key={`${block.title}-${idx}`} className="flex flex-col gap-3">
                <div className="flex items-baseline gap-3">
                  <span
                    className="tabular-nums"
                    style={{ font: "var(--type-num-xl)", color: "var(--accent-text)" }}
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <h2
                    style={{
                      font: "var(--type-h2)",
                      letterSpacing: "var(--ls-display)",
                      textTransform: "uppercase",
                    }}
                  >
                    {block.title}
                  </h2>
                  {/* Blockpause — das neue, später editierbare Feld */}
                  <span
                    className="ml-auto"
                    style={{ ...META_FONT, color: "var(--text-3)" }}
                  >
                    Pause {formatDuration(block.restSeconds)}
                  </span>
                </div>
                <div className="t-card px-3.5 py-0.5">
                  {exercises.map((ex, i) => (
                    <Fragment key={ex.id}>
                      {i > 0 && <Hairline />}
                      <div className="flex min-h-hit flex-col gap-1.5 py-2.5 sm:flex-row sm:items-center sm:gap-4">
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span style={{ font: "var(--type-body-strong)" }}>
                            {ex.name}
                          </span>
                          {ex.focus.length > 0 && (
                            <span
                              style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                            >
                              {ex.focus.join(" · ")}
                            </span>
                          )}
                        </div>
                        <span
                          className="shrink-0 self-start rounded-badge px-2 py-1 sm:self-center"
                          style={{
                            ...META_FONT,
                            background: "var(--surface-raised)",
                            border: "1px solid var(--line)",
                            color: "var(--accent-text)",
                          }}
                        >
                          {ex.defaultRounds} × {formatDuration(ex.durationSeconds)}
                        </span>
                      </div>
                    </Fragment>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {!isTrainer && <AthleteTabBar />}
    </main>
  );
}
