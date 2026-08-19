"use client";

import PageHeader from "@/components/PageHeader";
import Icon, { type IconName } from "@/components/ui/Icon";
import { ALL_EQUIPMENT, defaultEquipmentForCategory, EQUIPMENT } from "@/lib/equipment";
import { generateWorkout } from "@/lib/workout-generator";
import { TRAINING_PLANS } from "@/lib/training-plans";
import {
  DIFFICULTY_LABEL,
  type Category,
  type Difficulty,
  type EquipmentId,
} from "@/lib/types";
import { CATEGORY_LABEL } from "@/lib/techniques";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const CATEGORIES: Category[] = ["boxing", "wrestling", "bjj", "muay-thai"];
const DIFFICULTIES: Difficulty[] = ["anfaenger", "fortgeschritten", "pro"];
const DURATION_PRESETS = [10, 15, 20, 30, 45, 60, 75, 90];

const PLAN_ICONS: Record<string, IconName> = {
  boxing: "glove",
  wrestling: "grapple",
  bjj: "gi",
  "muay-thai": "kick",
};

export default function WorkoutPage() {
  const router = useRouter();
  const [category, setCategory] = useState<Category>("boxing");
  const [difficulty, setDifficulty] = useState<Difficulty>("anfaenger");
  const [equipment, setEquipment] = useState<EquipmentId[]>([]);
  const [duration, setDuration] = useState<number>(30);

  useEffect(() => {
    if (equipment.length === 0) {
      setEquipment(defaultEquipmentForCategory(category));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  function toggleEquipment(id: EquipmentId) {
    setEquipment((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id],
    );
  }

  function buildPayload() {
    const workout = generateWorkout({
      category,
      difficulty,
      equipment,
      durationMinutes: duration,
    });
    const p = new URLSearchParams();
    p.set("payload", encodeURIComponent(JSON.stringify(workout)));
    return p.toString();
  }

  function handleGenerate() {
    router.push(`/workout?${buildPayload()}`);
  }

  function handleSessionMode() {
    router.push(`/workout/session?${buildPayload()}`);
  }

  const stats = useMemo(() => {
    const equipmentLabels = equipment
      .map((id) => EQUIPMENT[id]?.label)
      .filter(Boolean)
      .join(" · ");
    return { equipmentLabels: equipmentLabels || "—" };
  }, [equipment]);

  return (
    <>
      <PageHeader
        eyebrow="Workout-Hub"
        title="Workout"
        description="Wähle einen strukturierten Trainingsplan oder lass dir ein individuelles Workout generieren."
      />

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 space-y-12">

        {/* ── Trainingspläne ── */}
        <section>
          <div className="mb-6">
            <h2 className="heading-display text-2xl font-black">Strukturierte Pläne</h2>
            <p className="mt-1 text-xs uppercase tracking-widest text-foreground/50">
              Vorgefertigte Pläne für jede Disziplin — sofort startklar
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {TRAINING_PLANS.map((plan) => {
              const sessions = plan.blocks.reduce(
                (sum, b) => sum + b.exercises.length,
                0,
              );
              const timerHref = `/timer?rounds=${plan.preset.rounds}&work=${plan.preset.workSeconds}&rest=${plan.preset.restSeconds}&prep=${plan.preset.prepSeconds}&label=${encodeURIComponent(plan.name)}`;
              return (
                <div
                  key={plan.slug}
                  className="group relative overflow-hidden rounded-xl border border-carbon-500 bg-carbon-700/60 p-6 transition-all hover:border-blood/60"
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${plan.accent} to-transparent opacity-0 transition-opacity group-hover:opacity-100`}
                  />
                  <div className="relative">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-blood"><Icon name={PLAN_ICONS[plan.slug] ?? "glove"} size={26} /></span>
                          <div className="text-xs font-bold uppercase tracking-widest text-blood">
                            {plan.level}
                          </div>
                        </div>
                        <h3 className="heading-display mt-1 text-2xl font-black">
                          {plan.name}
                        </h3>
                      </div>
                      <div className="shrink-0 rounded-lg border border-carbon-400 px-3 py-1 text-xs font-bold uppercase tracking-widest text-foreground/70">
                        {sessions} Übungen
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-foreground/70">{plan.short}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={timerHref}
                        className="btn-primary px-4 py-2 text-xs"
                      >
                        Timer starten
                      </Link>
                      <Link
                        href={`/workout/plans/${plan.slug}`}
                        className="btn-secondary px-4 py-2 text-xs"
                      >
                        Plan ansehen →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Trennlinie ── */}
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-carbon-500/60" />
          <span className="text-xs font-bold uppercase tracking-widest text-foreground/40">
            oder
          </span>
          <div className="h-px flex-1 bg-carbon-500/60" />
        </div>

        {/* ── Auto-Generator ── */}
        <section className="space-y-8">
          <div className="mb-2">
            <h2 className="heading-display text-2xl font-black">Auto-Workout Generator</h2>
            <p className="mt-1 text-xs uppercase tracking-widest text-foreground/50">
              Sag uns, was du hast und wie viel Zeit — wir bauen dir das passende Workout
            </p>
          </div>

          {/* Disziplin */}
          <Section title="Disziplin">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CATEGORIES.map((c) => (
                <ChoiceButton
                  key={c}
                  label={CATEGORY_LABEL[c]}
                  active={category === c}
                  onClick={() => {
                    setCategory(c);
                    setEquipment(defaultEquipmentForCategory(c));
                  }}
                />
              ))}
            </div>
          </Section>

          {/* Schwierigkeit */}
          <Section title="Schwierigkeit">
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map((d) => (
                <ChoiceButton
                  key={d}
                  label={DIFFICULTY_LABEL[d]}
                  active={difficulty === d}
                  onClick={() => setDifficulty(d)}
                />
              ))}
            </div>
          </Section>

          {/* Equipment */}
          <Section
            title="Equipment"
            description="Wähle, was du gerade da hast. Übungen mit fehlendem Equipment werden ausgeschlossen."
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ALL_EQUIPMENT.map((eq) => {
                const active = equipment.includes(eq.id);
                return (
                  <button
                    key={eq.id}
                    onClick={() => toggleEquipment(eq.id)}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all ${
                      active
                        ? "border-blood bg-blood/10"
                        : "border-carbon-400 bg-carbon-700/40 hover:border-blood/60"
                    }`}
                  >
                    <span className={active ? "text-blood" : "text-foreground/60"}><Icon name={eq.icon} size={22} /></span>
                    <div className="min-w-0">
                      <div
                        className={`text-sm font-bold ${
                          active ? "text-blood" : "text-foreground"
                        }`}
                      >
                        {eq.label}
                      </div>
                      <div className="truncate text-[10px] uppercase tracking-widest text-foreground/50">
                        {eq.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Zeit */}
          <Section title="Trainingsdauer">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-foreground/60">
                  Verfügbare Zeit
                </span>
                <span className="font-display text-4xl font-black text-blood">
                  {duration} <span className="text-xl">min</span>
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={120}
                step={5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="mt-4 w-full accent-blood"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {DURATION_PRESETS.map((min) => (
                  <button
                    key={min}
                    onClick={() => setDuration(min)}
                    className={`rounded-lg border px-3 py-1 text-xs font-bold uppercase tracking-wider transition-all ${
                      duration === min
                        ? "border-blood bg-blood/15 text-blood"
                        : "border-carbon-400 bg-carbon-800/60 text-foreground/70 hover:border-blood/60"
                    }`}
                  >
                    {min} min
                  </button>
                ))}
              </div>
            </div>
          </Section>

          {/* Action */}
          <div className="space-y-4">
            <div className="text-xs uppercase tracking-widest text-foreground/60">
              <div>
                <strong className="text-foreground">{CATEGORY_LABEL[category]}</strong>{" "}
                · {DIFFICULTY_LABEL[difficulty]} · {duration} min
              </div>
              <div className="mt-1">Equipment: {stats.equipmentLabels}</div>
            </div>

            {/* Zwei Modi */}
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Session-Modus: minimal, geführt, mit Animation + Sprache */}
              <button
                onClick={handleSessionMode}
                disabled={equipment.length === 0}
                className="flex flex-col gap-1 rounded-xl border border-blood bg-blood/10 px-4 py-4 text-left transition-all hover:bg-blood/20 disabled:opacity-40"
              >
                <span className="text-sm font-black uppercase tracking-widest text-blood">
                  ▶ Training-Modus
                </span>
                <span className="text-[11px] text-foreground/60">
                  Geführt · Animation · Sprachansagen
                </span>
              </button>

              {/* Detail-Ansicht: klassisch mit allen Infos */}
              <button
                onClick={handleGenerate}
                disabled={equipment.length === 0}
                className="flex flex-col gap-1 rounded-xl border border-carbon-400 bg-carbon-700/40 px-4 py-4 text-left transition-all hover:border-blood/60 disabled:opacity-40"
              >
                <span className="text-sm font-black uppercase tracking-widest text-foreground">
                  Detail-Ansicht →
                </span>
                <span className="text-[11px] text-foreground/60">
                  Alle Infos · Technik-Links · Accordion
                </span>
              </button>
            </div>

            {equipment.length === 0 && (
              <div className="text-xs text-yellow-300">
                Wähle mindestens ein Equipment (oder „Keine Geräte" für Bodyweight).
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3">
        <h3 className="heading-display text-xl font-black">{title}</h3>
        {description && (
          <p className="mt-1 text-xs uppercase tracking-widest text-foreground/50">
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

function ChoiceButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-4 py-3 text-sm font-bold uppercase tracking-wider transition-all ${
        active
          ? "border-blood bg-blood/15 text-blood"
          : "border-carbon-400 bg-carbon-700/40 text-foreground/70 hover:border-blood/60 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
