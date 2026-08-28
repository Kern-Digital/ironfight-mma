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
import Select from "@/components/ui/Select";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { ALL_EQUIPMENT, EQUIPMENT } from "@/lib/equipment";
import { generateWorkout } from "@/lib/workout-generator";
import {
  DEFAULT_WORKOUT_PLANS,
  WORKOUT_DISCIPLINES,
} from "@/lib/workout-plan-defaults";
import {
  deletePersonalWorkoutPlan,
  listPersonalWorkoutPlans,
  planDurationSeconds,
  planExerciseCount,
  upsertPersonalWorkoutPlan,
  workoutSessionToPlan,
  type PersonalWorkoutPlan,
} from "@/lib/workout-plans";
import {
  getRecentWorkouts,
  setWorkoutSavedPlan,
  type WorkoutSession,
} from "@/lib/workouts";
import { DISCIPLINE_COLOR } from "@/lib/discipline-colors";
import {
  DIFFICULTY_LABEL,
  DISCIPLINE_LABEL,
  GENDER_HEART_COLOR,
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

/** Kompaktes Datum der Letzte-Workouts-Kacheln. */
function dayLabel(d: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - day.getTime()) / 86400000);
  if (diffDays <= 0) return "Heute";
  if (diffDays === 1) return "Gestern";
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

// ─── Typo-Konstanten (Muster der Referenzseiten) ───────────────────────────

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

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    // Kein Gap zwischen Titel und Untertitel (Leon 2026-08-27: weniger
    // Luft) — der Zeilen-Durchschuss der beiden Schriften reicht als Abstand.
    <div className="flex flex-col">
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
  const { user, profile, loading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isTrainer = profile?.role === "trainer" || profile?.role === "admin";

  // Eigene Workoutpläne + letzte Workouts (Teilschritt 3): null = lädt noch —
  // die Bereiche erscheinen erst mit dem Ergebnis (kein Leer-Blitz).
  const [ownPlans, setOwnPlans] = useState<PersonalWorkoutPlan[] | null>(null);
  const [recent, setRecent] = useState<WorkoutSession[] | null>(null);
  const [plansOpen, setPlansOpen] = useState(false);
  const [heartBusy, setHeartBusy] = useState<string | null>(null);

  // Herz-Farbe nach Gender im Athleten-Profil (Leons Vorgabe 2026-08-27)
  const heartColor =
    GENDER_HEART_COLOR[profile?.athlete?.gender ?? "unset"];

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setOwnPlans([]);
      setRecent([]);
      return;
    }
    let cancelled = false;
    listPersonalWorkoutPlans(user.uid)
      .then((plans) => {
        if (!cancelled) setOwnPlans(plans);
      })
      .catch(() => {
        if (!cancelled) setOwnPlans([]);
      });
    // Abgebrochene zählen nicht als „ausgeführt" — deshalb mehr holen und
    // clientseitig auf die letzten 3 abgeschlossenen filtern
    getRecentWorkouts(user.uid, 10)
      .then((sessions) => {
        if (!cancelled)
          setRecent(
            sessions.filter((s) => s.status === "completed").slice(0, 3),
          );
      })
      .catch(() => {
        if (!cancelled) setRecent([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  // Herz: speichert das ausgeführte Workout als eigenen Plan (bzw. entfernt
  // ihn wieder) — der Gefüllt-Zustand hängt am savedPlanId des Log-Eintrags.
  async function toggleFavorite(session: WorkoutSession) {
    if (!user || heartBusy) return;
    setHeartBusy(session.id);
    try {
      if (session.savedPlanId) {
        const planId = session.savedPlanId;
        await deletePersonalWorkoutPlan(user.uid, planId);
        await setWorkoutSavedPlan(user.uid, session.id, null);
        setRecent(
          (r) =>
            r?.map((s) =>
              s.id === session.id ? { ...s, savedPlanId: null } : s,
            ) ?? r,
        );
        setOwnPlans((p) => p?.filter((pl) => pl.id !== planId) ?? p);
      } else {
        const planId = await upsertPersonalWorkoutPlan(
          user.uid,
          workoutSessionToPlan(session),
          { sourcePlanId: null },
        );
        await setWorkoutSavedPlan(user.uid, session.id, planId);
        setRecent(
          (r) =>
            r?.map((s) =>
              s.id === session.id ? { ...s, savedPlanId: planId } : s,
            ) ?? r,
        );
        // Plan-Liste neu laden statt lokal nachbauen (Sortierung/Timestamps)
        setOwnPlans(await listPersonalWorkoutPlans(user.uid));
      }
    } catch {
      // Fehlgeschlagen — Herz bleibt im alten Zustand
    } finally {
      setHeartBusy(null);
    }
  }

  const [category, setCategory] = useState<Category>("boxing");
  const [difficulty, setDifficulty] = useState<Difficulty>("anfaenger");
  // Equipment-Logik (Leon-Feedback 2026-08-27): `gear` hält NUR echte Geräte.
  // „Keine Geräte" (bodyweight) ist kein Listenmitglied, sondern der
  // Leerzustand: Button leuchtet, solange kein Gerät gewählt ist, und
  // erlischt automatisch mit dem ersten Gerät. Bodyweight-Übungen fließen
  // in die Generierung IMMER ein (siehe buildPayload) — der Button-Zustand
  // ist reine Verständlichkeit für den User. Standard: nichts gewählt.
  const [gear, setGear] = useState<EquipmentId[]>([]);
  const [duration, setDuration] = useState<number>(30);

  const noGear = gear.length === 0;

  function toggleGear(id: EquipmentId) {
    if (id === "bodyweight") {
      // „Keine Geräte" wählt alle Geräte ab — abwählen kann man ihn nicht,
      // ohne ein Gerät zu wählen (Bodyweight ist immer Teil des Workouts)
      setGear([]);
      return;
    }
    setGear((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id],
    );
  }

  function buildPayload() {
    const workout = generateWorkout({
      category,
      difficulty,
      // Bodyweight immer dabei + zusätzlich die gewählten Geräte
      equipment: ["bodyweight", ...gear],
      durationMinutes: duration,
    });
    const p = new URLSearchParams();
    p.set("payload", encodeURIComponent(JSON.stringify(workout)));
    return p.toString();
  }

  const stats = useMemo(() => {
    const equipmentLabels = noGear
      ? EQUIPMENT.bodyweight.label
      : gear
          .map((id) => EQUIPMENT[id]?.label)
          .filter(Boolean)
          .join(" · ");
    return { equipmentLabels };
  }, [gear, noGear]);

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

      {/* pt-4/5: sichtbare Abgrenzung Kopf → erste Sektion (Leon 2026-08-27) */}
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-4 pt-4 lg:max-w-5xl lg:px-6 lg:pt-5">
        {/* ── Letzte Workouts — Herz speichert als eigenen Plan ── */}
        {recent !== null && recent.length > 0 && (
          <section className="flex flex-col gap-4">
            <SectionHeader
              title="Letzte Workouts"
              subtitle="Tippe das Herz, um ein Workout bei dir zu speichern"
            />
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {recent.map((s) => {
                const minutes = Math.max(
                  1,
                  Math.round(s.totalWorkSeconds / 60),
                );
                const saved = Boolean(s.savedPlanId);
                return (
                  <div
                    key={s.id}
                    className="t-card relative flex flex-col gap-1 p-3 pr-10"
                  >
                    <button
                      type="button"
                      aria-pressed={saved}
                      aria-label={
                        saved
                          ? `„${s.label ?? "Workout"}" aus den Favoriten entfernen`
                          : `„${s.label ?? "Workout"}" als Favorit speichern`
                      }
                      onClick={() => void toggleFavorite(s)}
                      disabled={heartBusy === s.id}
                      className="t-interactive absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-field"
                      style={{
                        color: saved ? heartColor : "var(--text-3)",
                        opacity: heartBusy === s.id ? 0.5 : undefined,
                      }}
                    >
                      <Icon
                        name="heart"
                        size={17}
                        strokeWidth={2}
                        style={saved ? { fill: "currentColor" } : undefined}
                      />
                    </button>
                    <span
                      className="truncate"
                      style={{ font: "var(--type-body-strong)" }}
                    >
                      {s.label ?? "Workout"}
                    </span>
                    <span
                      className="mt-auto truncate"
                      style={{ ...META_FONT, color: "var(--text-3)" }}
                    >
                      ≈ {minutes} min · {dayLabel(s.completedAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Eigene Workoutpläne — gerahmtes Feld, öffnet das Popup ── */}
        {ownPlans !== null && (
          <button
            type="button"
            onClick={() => setPlansOpen(true)}
            className="t-card t-interactive flex w-full items-center gap-4 p-4 text-left sm:p-5"
            style={{
              border:
                "1px solid color-mix(in oklab, var(--accent) 60%, transparent)",
            }}
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <h2
                style={{
                  font: "var(--type-h2)",
                  letterSpacing: "var(--ls-display)",
                  textTransform: "uppercase",
                }}
              >
                Eigene Workoutpläne
              </h2>
              <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                {ownPlans.length === 0
                  ? "Noch keine — erstelle oder speichere deinen ersten Plan"
                  : `${ownPlans.length} ${ownPlans.length === 1 ? "Plan" : "Pläne"} — zuletzt bearbeitet zuerst`}
              </p>
            </div>
            <span
              aria-hidden
              className="shrink-0"
              style={{ color: "var(--accent-text)", lineHeight: 0 }}
            >
              <Icon name="arrow-right" size={18} strokeWidth={2} />
            </span>
          </button>
        )}

        {/* ── Disziplinen (Ebene 1: Disziplin → Level → Plan) ── */}
        <section className="flex flex-col gap-4">
          <SectionHeader
            title="Disziplinen"
            subtitle="Strukturierte Pläne nach Level — wähle deine Disziplin"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {WORKOUT_DISCIPLINES.map((d) => {
              const plans = DEFAULT_WORKOUT_PLANS.filter(
                (p) => p.discipline === d.discipline,
              );
              const levels = new Set(plans.map((p) => p.difficulty)).size;
              return (
                // Ganze Karte = Link (keine Buttons mehr, Entscheidung 2026-08-23).
                // Bild oben rechts klar, läuft nach links/unten in die
                // Kartenfläche aus (Maske + Token-Verlauf), damit der Text
                // in beiden Themes lesbar bleibt.
                <Link
                  key={d.discipline}
                  href={`/workout/disziplin/${d.discipline}`}
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
                        background: `color-mix(in oklab, ${DISCIPLINE_COLOR[d.discipline]} var(--cat-glow-mix), transparent)`,
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
                      src={`/plans/${d.discipline}.webp`}
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
                        // Light: reines Schwarz wirkt hart auf der pastelligen
                        // Glow-Fläche (Leon-Feedback 2026-08-27) — stattdessen
                        // tiefe Tinte aus der Rubrik-Farbe. Dark bleibt weiß.
                        color:
                          theme === "light"
                            ? `color-mix(in oklab, ${DISCIPLINE_COLOR[d.discipline]} 55%, var(--text-body))`
                            : undefined,
                      }}
                    >
                      {/* Wörter mit Bindestrich („Jiu-Jitsu") bleiben zusammen */}
                      {d.name.split(" ").map((word, i) => (
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
                      {d.short}
                    </p>
                  </div>

                  <div className="relative mt-auto pt-2">
                    <span style={{ ...META_FONT, color: "var(--text-2)" }}>
                      {plans.length} Pläne · {levels} Level
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

          {/* Disziplin — Aufklapp-Menü (ui/Select-Standard) statt Button-Reihe.
              Die Geräte-Auswahl bleibt beim Wechsel erhalten: was der User
              da hat, hängt nicht von der Disziplin ab. */}
          <div className="flex flex-col gap-3">
            <span className="t-label">Disziplin</span>
            <Select
              value={category}
              options={CATEGORIES.map((c) => ({
                value: c,
                label: CATEGORY_LABEL[c],
              }))}
              onChange={(v) => setCategory(v as Category)}
            />
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
                Übungen ohne Geräte sind immer dabei — wähle zusätzlich, was
                du gerade da hast.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ALL_EQUIPMENT.map((eq) => {
                const active =
                  eq.id === "bodyweight" ? noGear : gear.includes(eq.id);
                return (
                  <button
                    key={eq.id}
                    type="button"
                    onClick={() => toggleGear(eq.id)}
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

            {/* EIN Startweg (Leon-Feedback 2026-08-27): der geführte Runner —
                die Wahl Training-Modus/Detail-Ansicht ist entfallen. Gleicher
                Button wie auf der Plan-Detail-Seite. */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push(`/workout/session?${buildPayload()}`)}
                className="t-interactive inline-flex min-h-hit items-center justify-center gap-2 rounded-field px-5"
                style={{
                  ...BTN_FONT,
                  background: "var(--accent)",
                  color: "var(--on-accent)",
                  boxShadow: "var(--accent-glow)",
                }}
              >
                <Icon name="play" size={13} strokeWidth={2.2} />
                Workout starten
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* ── Popup „Eigene Workoutpläne" — Liste + „+" (Leons Vorgabe) ── */}
      {plansOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Eigene Workoutpläne"
        >
          <button
            type="button"
            aria-label="Eigene Workoutpläne schließen"
            className="absolute inset-0"
            style={{
              background: "var(--overlay)",
              animation: "fade-in 0.2s ease-out both",
            }}
            onClick={() => setPlansOpen(false)}
          />
          <div
            className="animate-slide-up relative flex max-h-[75vh] flex-col overflow-hidden"
            style={{
              maxHeight: "75dvh",
              background: "var(--surface-card)",
              borderRadius: "var(--r-xl) var(--r-xl) 0 0",
              boxShadow: "var(--glass-shadow)",
            }}
          >
            <div className="flex items-center justify-between gap-3 px-5 pt-3">
              <div className="flex flex-col items-start">
                <div
                  aria-hidden
                  className="mb-2 h-1 w-10 rounded-full"
                  style={{ background: "var(--line-strong)" }}
                />
                <span className="t-label">Eigene Workoutpläne</span>
              </div>
              <button
                type="button"
                onClick={() => setPlansOpen(false)}
                aria-label="Schließen"
                className="t-interactive inline-flex h-10 w-10 items-center justify-center rounded-field"
                style={{ color: "var(--text-3)" }}
              >
                <Icon name="x" size={16} strokeWidth={2.2} />
              </button>
            </div>
            <div
              className="overflow-y-auto px-3 pt-2"
              style={{
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
              }}
            >
              {/* Der „+"-Knopf des Popups: völlig eigenes Workout erstellen */}
              <Link
                href="/workout/eigene/neu"
                className="t-interactive flex min-h-hit w-full items-center gap-3 rounded-field px-2.5 py-2"
                style={{ color: "var(--accent-text)", textDecoration: "none" }}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field"
                  style={{ border: "1px dashed var(--accent)" }}
                >
                  <Icon name="plus" size={16} strokeWidth={2.2} />
                </span>
                <span style={{ font: "var(--type-body-strong)" }}>
                  Neues Workout erstellen
                </span>
              </Link>
              {ownPlans?.length === 0 ? (
                <p
                  className="px-2.5 py-6"
                  style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                >
                  Noch keine eigenen Pläne. Speichere ein bearbeitetes oder
                  ausgeführtes Workout — oder erstelle eins komplett selbst.
                </p>
              ) : (
                ownPlans?.map((plan) => {
                  const minutes = Math.round(planDurationSeconds(plan) / 60);
                  const exercises = planExerciseCount(plan);
                  return (
                    <Link
                      key={plan.id}
                      href={`/workout/eigene/${plan.id}`}
                      className="t-interactive flex min-h-hit w-full items-center gap-3 rounded-field px-2.5 py-2"
                      style={{
                        color: "var(--text-body)",
                        textDecoration: "none",
                      }}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span
                          className="truncate"
                          style={{ font: "var(--type-body-strong)" }}
                        >
                          {plan.name}
                        </span>
                        <span
                          className="truncate"
                          style={{ ...META_FONT, color: "var(--text-3)" }}
                        >
                          {DIFFICULTY_LABEL[plan.difficulty]} ·{" "}
                          {DISCIPLINE_LABEL[plan.discipline]} · ≈ {minutes} min
                          · {exercises} Übungen
                        </span>
                      </div>
                      <span
                        aria-hidden
                        className="shrink-0"
                        style={{ color: "var(--text-3)", lineHeight: 0 }}
                      >
                        <Icon name="arrow-right" size={16} strokeWidth={2} />
                      </span>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {!isTrainer && <AthleteTabBar />}
    </main>
  );
}
