"use client";

/**
 * Workout-Hub — strukturierte Trainingspläne + Auto-Generator.
 * Neues Token-System (Rollout Etappe 4): Athleten-Shell (Tab-Bar statt alter
 * Navbar), Karten als t-card, Auswahl-Zustände über accent-subtle/accent-text.
 * Disziplin-Farben kommen ausschließlich aus lib/discipline-colors.ts —
 * der Text trägt die Information, der Farbpunkt verstärkt nur.
 */

import AthleteTabBar from "@/components/AthleteTabBar";
import Icon from "@/components/ui/Icon";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { ALL_EQUIPMENT, defaultEquipmentForCategory, EQUIPMENT } from "@/lib/equipment";
import { generateWorkout } from "@/lib/workout-generator";
import { TRAINING_PLANS, planDurationSeconds } from "@/lib/training-plans";
import { CATEGORY_COLOR } from "@/lib/discipline-colors";
import {
  DIFFICULTY_LABEL,
  type Category,
  type Difficulty,
  type EquipmentId,
} from "@/lib/types";
import { CATEGORY_LABEL } from "@/lib/techniques";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";

const CATEGORIES: Category[] = ["boxing", "wrestling", "bjj", "muay-thai"];
const DIFFICULTIES: Difficulty[] = ["anfaenger", "fortgeschritten", "pro"];

// ─── Typo-Konstanten (Muster der Referenzseiten) ───────────────────────────

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const META_FONT: React.CSSProperties = {
  font: "600 10px/1.2 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2
        style={{
          font: "var(--type-h2)",
          letterSpacing: "var(--ls-display)",
          textTransform: "uppercase",
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>{subtitle}</p>
      )}
    </div>
  );
}

// ─── Auswahl-Baustein (Disziplin/Schwierigkeit/Dauer) ──────────────────────

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
      type="button"
      onClick={onClick}
      aria-pressed={active}
      // flex-1 + nowrap: Buttons teilen sich die Zeile, werden aber nie
      // schmaler als ihr Text — zu lange Reihen brechen um statt abzuschneiden
      className="t-interactive min-h-hit flex-1 whitespace-nowrap rounded-field px-3"
      style={{
        ...BTN_FONT,
        background: active ? "var(--accent-subtle)" : "var(--surface-raised)",
        border: "1px solid",
        borderColor: active ? "var(--accent)" : "var(--line)",
        color: active ? "var(--accent-text)" : "var(--text-2)",
      }}
    >
      {label}
    </button>
  );
}

// ─── Hauptkomponente ───────────────────────────────────────────────────────

export default function WorkoutHubPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isTrainer = profile?.role === "trainer" || profile?.role === "admin";

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

  const stats = useMemo(() => {
    const equipmentLabels = equipment
      .map((id) => EQUIPMENT[id]?.label)
      .filter(Boolean)
      .join(" · ");
    return { equipmentLabels: equipmentLabels || "—" };
  }, [equipment]);

  return (
    <main
      className={isTrainer ? "min-h-screen pb-12" : "min-h-screen pb-32"}
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      {/* Kopfbereich mit Ambient-Schicht (nur hier — nie hinter Listen) */}
      <section className="relative">
        <div className="absolute inset-0 overflow-hidden" aria-hidden>
          <div data-ambient style={{ background: "var(--ambient)" }} />
        </div>
        <div className="relative mx-auto flex w-full max-w-2xl items-start gap-3 px-4 pb-5 pt-6 lg:max-w-5xl lg:px-6 lg:pb-7 lg:pt-8">
          <div className="flex flex-1 flex-col gap-1">
            <span className="t-label">Training</span>
            <h1
              style={{
                font: "var(--type-display)",
                letterSpacing: "var(--ls-display)",
                textTransform: "uppercase",
              }}
            >
              Workout
            </h1>
            <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              Starte einen strukturierten Plan oder lass dir ein Workout aus
              Zeit, Equipment und Disziplin bauen.
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

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-4 pt-1 lg:max-w-5xl lg:px-6">
        {/* ── Strukturierte Pläne ── */}
        <section className="flex flex-col gap-4">
          <SectionHeader
            title="Strukturierte Pläne"
            subtitle="Vorgefertigte Pläne für jede Disziplin — sofort startklar"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {TRAINING_PLANS.map((plan) => {
              const exercises = plan.blocks.reduce(
                (sum, b) => sum + b.exercises.length,
                0,
              );
              const minutes = Math.round(planDurationSeconds(plan) / 60);
              return (
                // Ganze Karte = Link (keine Buttons mehr, Entscheidung 2026-08-23).
                // Bild oben rechts klar, läuft nach links/unten in die
                // Kartenfläche aus (Maske + Token-Verlauf), damit der Text
                // in beiden Themes lesbar bleibt.
                <Link
                  key={plan.slug}
                  href={`/workout/plans/${plan.slug}`}
                  className="t-card t-interactive relative flex min-h-[10.5rem] flex-col gap-2 overflow-hidden p-4 sm:p-5"
                  style={{ textDecoration: "none", color: "var(--text-body)" }}
                >
                  {/* Rubrik-Farbe als Schein von links (Karten-Ambient aus
                      globals.css) statt Farbpunkt — prägt sich besser ein,
                      bleibt aber Atmosphäre: Farbe aus der Registry, per
                      color-mix so weit abgeschwächt, dass Text lesbar bleibt. */}
                  <div aria-hidden data-ambient className="overflow-hidden">
                    <span
                      data-glow
                      style={{
                        left: "-14%",
                        top: "-25%",
                        width: "78%",
                        height: "150%",
                        background: `color-mix(in oklab, ${CATEGORY_COLOR[plan.slug]} var(--cat-glow-mix), transparent)`,
                      }}
                    />
                  </div>
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 right-0 w-[60%]"
                    style={{
                      maskImage:
                        "linear-gradient(to left, black 38%, transparent 100%)",
                      WebkitMaskImage:
                        "linear-gradient(to left, black 38%, transparent 100%)",
                    }}
                  >
                    <Image
                      src={`/plans/${plan.slug}.webp`}
                      alt=""
                      fill
                      sizes="(min-width: 640px) 300px, 60vw"
                      className="object-cover object-center"
                    />
                    {/* Auslauf nach unten beginnt erst in der unteren Hälfte —
                        oben rechts bleibt das Bild klar */}
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(to top, var(--surface-card) 8%, transparent 50%)",
                      }}
                    />
                  </div>

                  {/* Rubrik = markanteste Zeile (Display-Größe); Meta darunter
                      bewusst ruhig. Tag/Level-Eyebrow entfernt (2026-08-23).
                      Kein Lichthof hinter dem Text (sah verwaschen aus) —
                      Lesbarkeit kommt aus dem Abstand zum Bild. */}
                  <div className="relative flex min-w-0 flex-col gap-1">
                    {/* Titel darf in den Bild-Auslauf hineinragen (pr kleiner
                        als beim Untertitel) — nie mitten im Wort umbrechen */}
                    <h3
                      className="pr-[22%]"
                      style={{
                        font: "800 26px/1.1 var(--font-archivo), system-ui, sans-serif",
                        letterSpacing: "var(--ls-display)",
                        textTransform: "uppercase",
                      }}
                    >
                      {/* Wörter mit Bindestrich („Jiu-Jitsu") bleiben zusammen */}
                      {plan.name.split(" ").map((word, i) => (
                        <Fragment key={i}>
                          {i > 0 && " "}
                          <span className="whitespace-nowrap">{word}</span>
                        </Fragment>
                      ))}
                    </h3>
                    <p
                      className="pr-[38%]"
                      style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
                    >
                      {plan.short}
                    </p>
                  </div>

                  <div className="relative mt-auto pt-2">
                    <span style={{ ...META_FONT, color: "var(--text-2)" }}>
                      ≈ {minutes} min · {exercises} Übungen
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ── Trennung ── */}
        <div className="flex items-center gap-4" aria-hidden>
          <div className="h-px flex-1" style={{ background: "var(--line)" }} />
          <span className="t-label">oder</span>
          <div className="h-px flex-1" style={{ background: "var(--line)" }} />
        </div>

        {/* ── Auto-Generator ── */}
        <section className="flex flex-col gap-8">
          <SectionHeader
            title="Auto-Generator"
            subtitle="Sag uns, was du hast und wie viel Zeit — wir bauen dir das passende Workout"
          />

          {/* Disziplin */}
          <div className="flex flex-col gap-3">
            <span className="t-label">Disziplin</span>
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
          </div>

          {/* Schwierigkeit */}
          <div className="flex flex-col gap-3">
            <span className="t-label">Schwierigkeit</span>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTIES.map((d) => (
                <ChoiceButton
                  key={d}
                  label={DIFFICULTY_LABEL[d]}
                  active={difficulty === d}
                  onClick={() => setDifficulty(d)}
                />
              ))}
            </div>
          </div>

          {/* Equipment */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="t-label">Equipment</span>
              <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                Wähle, was du gerade da hast — Übungen mit fehlendem Equipment
                werden ausgeschlossen.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ALL_EQUIPMENT.map((eq) => {
                const active = equipment.includes(eq.id);
                return (
                  <button
                    key={eq.id}
                    type="button"
                    onClick={() => toggleEquipment(eq.id)}
                    aria-pressed={active}
                    className="t-interactive flex min-h-hit items-center gap-3 rounded-field px-3.5 py-2.5 text-left"
                    style={{
                      background: active
                        ? "var(--accent-subtle)"
                        : "var(--surface-card)",
                      border: "1px solid",
                      borderColor: active ? "var(--accent)" : "var(--line)",
                    }}
                  >
                    <span
                      className="shrink-0"
                      style={{
                        color: active ? "var(--accent-text)" : "var(--text-3)",
                      }}
                    >
                      <Icon name={eq.icon} size={20} />
                    </span>
                    {/* Nur das Label — die Beschreibung passte in die
                        2-Spalten-Kachel nie lesbar hinein (Entscheidung 2026-08-23) */}
                    <span
                      className="min-w-0"
                      style={{
                        font: "var(--type-body-strong)",
                        color: active ? "var(--accent-text)" : "var(--text-body)",
                      }}
                    >
                      {eq.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Trainingsdauer */}
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="t-label">Trainingsdauer</span>
              <span
                className="tabular-nums"
                style={{ font: "var(--type-num-xl)", color: "var(--accent-text)" }}
              >
                {duration}
                <span
                  style={{ font: "var(--type-body-strong)", color: "var(--text-3)" }}
                >
                  {" "}
                  min
                </span>
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={120}
              step={5}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              aria-label="Trainingsdauer in Minuten"
              className="w-full"
              style={{ accentColor: "var(--accent)" }}
            />
          </div>

          {/* Zusammenfassung + Start */}
          <div className="flex flex-col gap-4">
            <div
              className="flex flex-col gap-0.5"
              style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
            >
              <span>
                <span style={{ color: "var(--text-body)", fontWeight: 600 }}>
                  {CATEGORY_LABEL[category]}
                </span>{" "}
                · {DIFFICULTY_LABEL[difficulty]} · {duration} min
              </span>
              <span>Equipment: {stats.equipmentLabels}</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* Training-Modus: geführt, Animation, Sprachansagen */}
              <button
                type="button"
                onClick={() => router.push(`/workout/session?${buildPayload()}`)}
                disabled={equipment.length === 0}
                className="t-interactive flex min-h-hit flex-col gap-1 rounded-field px-4 py-3.5 text-left disabled:opacity-40"
                style={{
                  background: "var(--accent)",
                  color: "var(--on-accent)",
                  boxShadow: "var(--accent-glow)",
                }}
              >
                <span className="inline-flex items-center gap-2" style={BTN_FONT}>
                  <Icon name="play" size={13} strokeWidth={2.2} />
                  Training-Modus
                </span>
                <span style={{ font: "var(--type-sub)", opacity: 0.8 }}>
                  Geführt · Animation · Sprachansagen
                </span>
              </button>

              {/* Detail-Ansicht: klassisch mit allen Infos */}
              <button
                type="button"
                onClick={() => router.push(`/workout?${buildPayload()}`)}
                disabled={equipment.length === 0}
                className="t-interactive flex min-h-hit flex-col gap-1 rounded-field px-4 py-3.5 text-left disabled:opacity-40"
                style={{
                  background: "var(--surface-raised)",
                  border: "1px solid var(--line)",
                }}
              >
                <span
                  className="inline-flex items-center gap-2"
                  style={{ ...BTN_FONT, color: "var(--text-body)" }}
                >
                  Detail-Ansicht
                  <Icon name="arrow-right" size={13} strokeWidth={2.2} />
                </span>
                <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                  Alle Infos · Technik-Links · Accordion
                </span>
              </button>
            </div>

            {equipment.length === 0 && (
              <p style={{ font: "var(--type-sub)", color: "var(--warning)" }}>
                Wähle mindestens ein Equipment (oder „Keine Geräte" für
                Bodyweight).
              </p>
            )}
          </div>
        </section>
      </div>

      {!isTrainer && <AthleteTabBar />}
    </main>
  );
}
