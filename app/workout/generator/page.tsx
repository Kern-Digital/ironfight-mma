"use client";

/**
 * Workout-Hub — strukturierte Trainingspläne + Auto-Generator.
 * Neues Token-System (Rollout Etappe 4): Athleten-Shell (Tab-Bar statt alter
 * Navbar), Karten als t-card, Auswahl-Zustände über accent-subtle/accent-text.
 * Disziplin-Farben kommen ausschließlich aus lib/discipline-colors.ts —
 * der Text trägt die Information, der Farbpunkt verstärkt nur.
 */

import AthleteTabBar from "@/components/AthleteTabBar";
import Icon, { type IconName } from "@/components/ui/Icon";
import Select from "@/components/ui/Select";
import { useAuth, useHasStaffShell, useRights } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { ALL_EQUIPMENT, EQUIPMENT } from "@/lib/equipment";
import { generateWorkout } from "@/lib/workout-generator";
import { WORKOUT_DISCIPLINES } from "@/lib/workout-plan-defaults";
import { resolveGymId } from "@/lib/gym";
import SwipeAction from "@/components/SwipeAction";
import { SheetShell } from "@/components/motion";
import {
  listPersonalWorkoutPlans,
  listSharedTrainerPlans,
  listWorkoutPlansForGym,
  planDurationSeconds,
  planExerciseCount,
  planToSessionPayload,
  removeSavedPlan,
  workoutDefinitionToPlan,
  type PersonalWorkoutPlan,
  type TrainerWorkoutPlan,
  type WorkoutPlan,
} from "@/lib/workout-plans";
import { getRecentWorkouts, type WorkoutSession } from "@/lib/workouts";
import { DISCIPLINE_COLOR } from "@/lib/discipline-colors";
import {
  DIFFICULTY_LABEL,
  DISCIPLINE_LABEL,
  type Category,
  type Difficulty,
  type EquipmentId,
} from "@/lib/types";
import { CATEGORY_LABEL } from "@/lib/techniques";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

const CATEGORIES: Category[] = ["boxing", "wrestling", "bjj", "muay-thai"];
const DIFFICULTIES: Difficulty[] = ["anfaenger", "fortgeschritten", "pro"];

// ─── Typo-Konstanten (Muster der Referenzseiten) ───────────────────────────

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

// ─── Hub-Kopffelder „Letzte Workouts" / „Meine Workouts" (Leon 31.08.) ─────

/** Großes Symbol über dem Titel — gibt dem Feld sein Gesicht. */
function HubFieldHead({ icon, title }: { icon: IconName; title: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span aria-hidden style={{ color: "var(--accent-text)", lineHeight: 0 }}>
        <Icon name={icon} size={34} strokeWidth={1.8} />
      </span>
      <h2
        style={{
          font: "var(--type-h2)",
          letterSpacing: "var(--ls-display)",
          textTransform: "uppercase",
        }}
      >
        {title}
      </h2>
    </div>
  );
}

/**
 * Angedeutete Kartei: die ersten drei Einträge als kompakte Kacheln, nach
 * unten in den Seitengrund ausgeblendet (Maske) — man sieht den Anfang,
 * der Rest „läuft aus". Die vollen Listen liegen hinter dem Feld.
 */
function PeekStack({
  items,
  empty,
  emptyText,
}: {
  items: { key: string; title: string; meta: string }[];
  empty: boolean;
  emptyText: string;
}) {
  if (empty) {
    return (
      <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
        {emptyText}
      </p>
    );
  }
  return (
    <div
      aria-hidden
      className="relative overflow-hidden"
      style={{
        // Zeigt gut zwei Kacheln, die dritte läuft in der Maske aus
        height: 96,
        maskImage: "linear-gradient(to bottom, black 40%, transparent 96%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, black 40%, transparent 96%)",
      }}
    >
      <div className="flex flex-col gap-1.5">
        {items.map((it) => (
          <div
            key={it.key}
            className="flex flex-col rounded-field px-2.5 py-1.5"
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--line)",
            }}
          >
            <span
              className="truncate"
              style={{
                font: "600 14px/1.3 var(--font-archivo), system-ui, sans-serif",
                color: "var(--text-body)",
              }}
            >
              {it.title}
            </span>
            <span
              className="truncate"
              style={{ ...META_FONT, color: "var(--text-3)" }}
            >
              {it.meta}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Die letzten Workouts als angedeutete Kartei (Datum unter dem Namen). */
function PeekStackRecent({ items }: { items: WorkoutSession[] }) {
  return (
    <PeekStack
      empty={false}
      emptyText=""
      items={items.slice(0, 3).map((s) => ({
        key: s.id,
        title: s.label ?? "Workout",
        meta: shortLogDate(s.startedAt ?? s.completedAt),
      }))}
    />
  );
}

/** Eigene Pläne als angedeutete Kartei (Dauer + Übungszahl). */
function PeekStackOwn({ items }: { items: PersonalWorkoutPlan[] }) {
  return (
    <PeekStack
      empty={false}
      emptyText=""
      items={items.slice(0, 3).map((p) => ({
        key: p.id,
        title: p.name,
        meta: `${Math.round(planDurationSeconds(p) / 60)} min · ${planExerciseCount(p)} Übungen`,
      }))}
    />
  );
}

/** Kurzdatum für die angedeuteten Log-Kacheln („Heute", „28.08.") */
function shortLogDate(d: Date | null | undefined): string {
  if (!d) return "";
  const today = new Date();
  const sameDay =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  if (sameDay) {
    return `Heute · ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
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
  const { user, profile, loading: authLoading, profileLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  // Getrennt seit der Stab-Hülle (01.09.2026): `isTrainer` steuert die
  // ANSPRACHE der Freigabe-Karte („Aus dem Team" statt „Vom Trainer für
  // dich"), `hasStaffShell` die Hülle drumherum. Eine reine Verwaltung ist
  // kein Trainer, hat aber die Sidebar — und bräuchte sonst zwei Bottom-Bars.
  const isTrainer = useRights().trainer;
  const hasStaffShell = useHasStaffShell();

  // Eigene Workoutpläne + letzte Workouts (Teilschritt 3): null = lädt noch —
  // die Bereiche erscheinen erst mit dem Ergebnis (kein Leer-Blitz).
  const [ownPlans, setOwnPlans] = useState<PersonalWorkoutPlan[] | null>(null);
  const [recent, setRecent] = useState<WorkoutSession[] | null>(null);
  // Gym-Pläne aus Firestore (seit Seeding, Schritt 5) — nur für die
  // Meta-Zeile der Disziplinkarten („n Pläne · n Level").
  const [gymPlans, setGymPlans] = useState<WorkoutPlan[] | null>(null);
  // Für MICH freigegebene Trainer-Pläne (AUSBAU Stufe 1) — Sektion
  // „Vom Trainer für dich"; leer = Sektion erscheint gar nicht.
  const [trainerPlans, setTrainerPlans] = useState<TrainerWorkoutPlan[] | null>(
    null,
  );
  const [plansOpen, setPlansOpen] = useState(false);
  // Freigegebene Trainer-Pläne als Popup (Leon 31.08. — die Sektion ist
  // eine Bild-Karte im Muster „Meine Bibliothek")
  const [trainerPlansOpen, setTrainerPlansOpen] = useState(false);
  // Auto-Generator als Popup (Leons Vorgabe 2026-08-28)
  const [genOpen, setGenOpen] = useState(false);
  // Links-Wisch in „Meine Workouts": Plan fliegt mit Raus-Animation, dann
  // wird er entfernt (inkl. Herz-Verweisen in den Logs)
  const [removingPlanId, setRemovingPlanId] = useState<string | null>(null);
  const removePlanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (removePlanTimer.current) clearTimeout(removePlanTimer.current);
    },
    [],
  );

  function handleRemovePlan(planId: string) {
    if (!user || removingPlanId) return;
    setRemovingPlanId(planId);
    removePlanTimer.current = setTimeout(() => {
      setRemovingPlanId(null);
      setOwnPlans((p) => p?.filter((pl) => pl.id !== planId) ?? p);
      setRecent(
        (r) =>
          r?.map((s) =>
            s.savedPlanId === planId ? { ...s, savedPlanId: null } : s,
          ) ?? r,
      );
      removeSavedPlan(user.uid, planId).catch(() => {
        // Fehlgeschlagen — Liste neu laden, damit der Plan wieder auftaucht
        void listPersonalWorkoutPlans(user.uid).then(setOwnPlans);
      });
    }, 220);
  }

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
    // Auch abgebrochene Workouts erscheinen im Stapel (Leon 2026-08-28)
    getRecentWorkouts(user.uid, 3)
      .then((sessions) => {
        if (!cancelled) setRecent(sessions);
      })
      .catch(() => {
        if (!cancelled) setRecent([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  // Gym-Pläne — eigener Effect, weil die gymId aus dem Profil kommt
  // (Spiegel des Token-Claims) und erst aufgelöst sein muss.
  useEffect(() => {
    if (!user || profileLoading) return;
    let cancelled = false;
    listWorkoutPlansForGym(resolveGymId(profile))
      .then((plans) => {
        if (!cancelled) setGymPlans(plans);
      })
      .catch(() => {
        if (!cancelled) setGymPlans([]);
      });
    // Freigegebene Trainer-Pläne — die array-contains-Query auf die eigene
    // uid ist die einzige, die die Rules einem Athleten hier erlauben.
    listSharedTrainerPlans(resolveGymId(profile), user.uid)
      .then((plans) => {
        if (!cancelled) setTrainerPlans(plans);
      })
      .catch(() => {
        if (!cancelled) setTrainerPlans([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user, profile, profileLoading]);

  // Titel der Freigabe-Karte: „Vom Trainer für dich" wäre für einen
  // Trainer schief — er IST der Trainer und bekommt die Pläne von
  // Kollegen (oder sich selbst). Leons Wahl 31.08.
  const sharedPlansTitle = isTrainer ? "Aus dem Team" : "Vom Trainer für dich";
  // Passendes Foto zur Rolle (Pexels, frei nutzbar — Ordner bewusst
  // /library-stack, /library läuft durch die Auth-Middleware):
  // Trainer sehen das Corner-Team um den Kämpfer, Athleten den Coach
  // an den Pratzen.
  const sharedPlansImage = isTrainer
    ? // Coach beobachtet sein Team beim Sparring im Käfig — der Coach
      // steht links, deshalb der Ausschnitt weiter rechts: in der Karte
      // ist nur die rechte Bildhälfte sichtbar (Maske läuft nach links)
      { src: "/library-stack/coach-team.jpg", position: "62% 45%" }
    : { src: "/library-stack/coach-pads.jpg", position: "50% 40%" };

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
    // Der Runner läuft nativ auf dem Plan-Modell — das Generator-Ergebnis
    // wird direkt in die Plan-Form gehoben (Blockpause = Timer-Default)
    const p = new URLSearchParams();
    p.set("payload", planToSessionPayload(workoutDefinitionToPlan(workout)));
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
      className={hasStaffShell ? "min-h-screen pb-12" : "min-h-screen pb-32"}
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
          {!hasStaffShell && (
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
        {/* ── Zwei Felder auf gleicher Höhe (Leon 31.08.): links die
            letzten Workouts nur ANGEDEUTET (Klick → ganzer Verlauf),
            rechts „Meine Workouts" (Klick → Popup mit der Planliste).
            Herz und Detail-Popup leben jetzt auf /workout/verlauf. ── */}
        {(recent !== null || ownPlans !== null) && (
          <div className="grid grid-cols-2 items-stretch gap-3">
            <Link
              href="/workout/verlauf"
              className="t-card t-interactive flex flex-col gap-2 p-4 sm:p-5"
              style={{
                border:
                  "1px solid color-mix(in oklab, var(--accent) 60%, transparent)",
                textDecoration: "none",
                color: "var(--text-body)",
              }}
            >
              <HubFieldHead icon="chart" title="Letzte Workouts" />
              {recent !== null && recent.length > 0 ? (
                <PeekStackRecent items={recent} />
              ) : (
                <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                  {recent === null ? " " : "Noch kein Workout gelaufen"}
                </p>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setPlansOpen(true)}
              disabled={ownPlans === null}
              className="t-card t-interactive flex flex-col gap-2 p-4 text-left sm:p-5"
              style={{
                border:
                  "1px solid color-mix(in oklab, var(--accent) 60%, transparent)",
              }}
            >
              <HubFieldHead icon="heart" title="Meine Workouts" />
              {ownPlans !== null && ownPlans.length > 0 ? (
                <PeekStackOwn items={ownPlans} />
              ) : (
                <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                  {ownPlans === null
                    ? " "
                    : "Noch keine — speichere deinen ersten Plan"}
                </p>
              )}
            </button>
          </div>
        )}

        {/* ── Vom Trainer für dich (AUSBAU Stufe 1) — Bild-Karte im
            Muster „Meine Bibliothek" (Leon 31.08.): ein Feld mit
            Coach-Foto, das die freigegebenen Pläne als Popup öffnet.
            Sichtbar nur, wenn der Trainer für DIESEN Athleten etwas
            freigegeben hat — erzwungen von den Firestore-Regeln. ── */}
        {trainerPlans !== null && trainerPlans.length > 0 && (
          <button
            type="button"
            onClick={() => setTrainerPlansOpen(true)}
            className="t-card t-interactive relative flex min-h-[7rem] items-center gap-4 overflow-hidden p-4 text-left sm:min-h-[8rem] sm:p-5"
            style={{
              border:
                "1px solid color-mix(in oklab, var(--accent) 60%, transparent)",
            }}
          >
            {/* Foto rechts, nach links in die Karte auslaufend (Maske) */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-[62%] sm:w-[52%]"
              style={{
                maskImage:
                  "linear-gradient(to left, black 45%, transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to left, black 45%, transparent 100%)",
              }}
            >
              <Image
                src={sharedPlansImage.src}
                alt=""
                fill
                sizes="(max-width: 640px) 60vw, 420px"
                className="object-cover"
                style={{ objectPosition: sharedPlansImage.position }}
              />
            </div>
            <span
              aria-hidden
              className="relative shrink-0"
              style={{ color: "var(--accent-text)", lineHeight: 0 }}
            >
              <Icon name="users" size={22} />
            </span>
            <div className="relative flex min-w-0 flex-1 flex-col">
              <h2
                style={{
                  font: "var(--type-h2)",
                  letterSpacing: "var(--ls-display)",
                  textTransform: "uppercase",
                }}
              >
                {sharedPlansTitle}
              </h2>
              <span style={{ ...META_FONT, color: "var(--text-2)" }}>
                {trainerPlans.length}{" "}
                {trainerPlans.length === 1 ? "Plan" : "Pläne"} freigegeben
              </span>
            </div>
          </button>
        )}

        {/* ── Auto-Generator — nur Karte, der Generator öffnet als Popup
            (Leons Vorschlag 2026-08-28); sitzt ÜBER den Disziplinen ── */}
        <button
          type="button"
          onClick={() => setGenOpen(true)}
          className="t-card t-interactive flex w-full items-center gap-4 p-4 text-left sm:p-5"
          style={{
            border:
              "1px solid color-mix(in oklab, var(--accent) 60%, transparent)",
          }}
        >
          <span
            aria-hidden
            className="shrink-0"
            style={{ color: "var(--accent-text)", lineHeight: 0 }}
          >
            <Icon name="spark" size={22} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <h2
              style={{
                font: "var(--type-h2)",
                letterSpacing: "var(--ls-display)",
                textTransform: "uppercase",
              }}
            >
              Auto-Generator
            </h2>
            <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              Sag uns, was du hast und wie viel Zeit — wir bauen dir das
              passende Workout
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

        {/* ── Disziplinen (Ebene 1: Disziplin → Level → Plan) ── */}
        <section className="flex flex-col gap-4">
          <SectionHeader
            title="Disziplinen"
            subtitle="Strukturierte Pläne nach Level — wähle deine Disziplin"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {WORKOUT_DISCIPLINES.map((d) => {
              const plans = (gymPlans ?? []).filter(
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
                    {/* Bis zum Ladeergebnis nur die Zeilenhöhe halten —
                        „0 Pläne" wäre ein falscher Zwischenstand */}
                    <span style={{ ...META_FONT, color: "var(--text-2)" }}>
                      {gymPlans === null
                        ? " "
                        : `${plans.length} Pläne · ${levels} Level`}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

      </div>

      {/* ── Popup „Auto-Generator" — die komplette Generator-Steuerung im
          Sheet (mobil unten, Desktop zentriert; Leons Vorschlag 2026-08-28,
          im Hub bleibt nur die Karte) ── */}
      <SheetShell
        open={genOpen}
        onClose={() => setGenOpen(false)}
        label="Auto-Generator"
        panelClassName="pointer-events-auto relative flex w-full max-h-[85vh] flex-col overflow-hidden rounded-t-[var(--r-xl)] sm:max-w-xl sm:rounded-[var(--r-xl)]"
        panelStyle={{
          maxHeight: "85dvh",
          background: "var(--surface-card)",
          boxShadow: "var(--glass-shadow)",
        }}
      >
            <div className="flex items-center justify-between gap-3 px-5 pt-3">
              <div className="flex flex-col items-start">
                <div
                  aria-hidden
                  className="mb-2 h-1 w-10 rounded-full sm:invisible"
                  style={{ background: "var(--line-strong)" }}
                />
                <span className="t-label">Auto-Generator</span>
              </div>
              <button
                type="button"
                onClick={() => setGenOpen(false)}
                aria-label="Schließen"
                className="t-interactive inline-flex h-10 w-10 items-center justify-center rounded-field"
                style={{ color: "var(--text-3)" }}
              >
                <Icon name="x" size={16} strokeWidth={2.2} />
              </button>
            </div>
            <div
              className="flex flex-col gap-6 overflow-y-auto px-5 pt-2"
              style={{
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
              }}
            >

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
            </div>
      </SheetShell>

      {/* Detail-Popup und Herz der letzten Workouts liegen seit dem
          Zwei-Felder-Umbau (Leon 31.08.) auf /workout/verlauf */}

      {/* ── Popup „Vom Trainer für dich" — freigegebene Pläne ── */}
      <SheetShell
        open={trainerPlansOpen && trainerPlans !== null}
        onClose={() => setTrainerPlansOpen(false)}
        label={sharedPlansTitle}
        panelClassName="relative flex max-h-[75vh] w-full flex-col overflow-hidden rounded-t-[var(--r-xl)] sm:max-w-xl sm:rounded-[var(--r-xl)]"
        panelStyle={{
          maxHeight: "75dvh",
          background: "var(--surface-card)",
          boxShadow: "var(--glass-shadow)",
        }}
      >
            <div className="flex items-center justify-between gap-3 px-5 pt-3">
              <div className="flex flex-col items-start">
                <div
                  aria-hidden
                  className="mb-2 h-1 w-10 rounded-full sm:invisible"
                  style={{ background: "var(--line-strong)" }}
                />
                <span className="t-label">{sharedPlansTitle}</span>
              </div>
              <button
                type="button"
                onClick={() => setTrainerPlansOpen(false)}
                aria-label="Schließen"
                className="t-interactive inline-flex h-10 w-10 items-center justify-center rounded-field"
                style={{ color: "var(--text-3)" }}
              >
                <Icon name="x" size={16} strokeWidth={2.2} />
              </button>
            </div>
            <div
              className="flex flex-col gap-3 overflow-y-auto px-4 pt-3"
              style={{
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
              }}
            >
              {(trainerPlans ?? []).map((plan) => {
                const minutes = Math.round(planDurationSeconds(plan) / 60);
                const exercises = planExerciseCount(plan);
                return (
                  <Link
                    key={plan.id}
                    href={`/workout/plans/${plan.id}`}
                    className="t-card t-interactive relative flex items-center gap-4 overflow-hidden p-4"
                    style={{
                      textDecoration: "none",
                      color: "var(--text-body)",
                    }}
                  >
                    {/* Rubrik-Farbe leuchtet von links (Muster Hub-Karten) */}
                    <div aria-hidden data-ambient className="overflow-hidden">
                      <span
                        data-glow
                        style={{
                          left: "-22%",
                          top: "-30%",
                          width: "32%",
                          height: "160%",
                          background: `color-mix(in oklab, ${DISCIPLINE_COLOR[plan.discipline]} var(--cat-glow-mix), transparent)`,
                        }}
                      />
                    </div>
                    <div className="relative flex min-w-0 flex-1 flex-col gap-1">
                      <h3
                        style={{
                          font: "var(--type-h2)",
                          letterSpacing: "var(--ls-display)",
                          textTransform: "uppercase",
                        }}
                      >
                        {plan.name || "Trainer-Plan"}
                      </h3>
                      <span style={{ ...META_FONT, color: "var(--text-2)" }}>
                        {DIFFICULTY_LABEL[plan.difficulty]} ·{" "}
                        {DISCIPLINE_LABEL[plan.discipline]} · ≈ {minutes} min ·{" "}
                        {exercises} Übungen
                      </span>
                      {plan.createdByName && (
                        <span
                          style={{ ...META_FONT, color: "var(--accent-text)" }}
                        >
                          Von {plan.createdByName}
                        </span>
                      )}
                    </div>
                    <span
                      aria-hidden
                      className="relative shrink-0"
                      style={{ color: "var(--accent-text)", lineHeight: 0 }}
                    >
                      <Icon name="arrow-right" size={18} strokeWidth={2} />
                    </span>
                  </Link>
                );
              })}
            </div>
      </SheetShell>

      {/* ── Popup „Meine Workouts" — Liste + „+" (Leons Vorgabe) ── */}
      <SheetShell
        open={plansOpen}
        onClose={() => setPlansOpen(false)}
        label="Meine Workouts"
        placement="bottom"
        panelClassName="relative flex max-h-[75vh] flex-col overflow-hidden"
        panelStyle={{
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
                <span className="t-label">Meine Workouts</span>
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
                  Noch keine eigenen Workouts. Speichere ein bearbeitetes oder
                  ausgeführtes Workout — oder erstelle eins komplett selbst.
                </p>
              ) : (
                <div className="flex flex-col gap-2 pb-1 pt-1">
                  {/* Gerahmte Karten; links wischen = aus den Favoriten
                      entfernen (Lösch-Optik), am Desktop der x-Button */}
                  {ownPlans?.map((plan) => {
                    const minutes = Math.round(planDurationSeconds(plan) / 60);
                    const exercises = planExerciseCount(plan);
                    const isRemoving = removingPlanId === plan.id;
                    return (
                      <SwipeAction
                        key={plan.id}
                        left={{
                          color: "var(--gesture-delete)",
                          icon: "x",
                          onTrigger: () => handleRemovePlan(plan.id),
                        }}
                        disabled={isRemoving}
                      >
                        <Link
                          href={`/workout/eigene/${plan.id}`}
                          className={`t-card t-interactive flex min-h-hit w-full items-center gap-3 p-3${
                            isRemoving ? " animate-remove-row" : ""
                          }`}
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
                              {DISCIPLINE_LABEL[plan.discipline]} · ≈ {minutes}{" "}
                              min · {exercises} Übungen
                            </span>
                          </div>
                          <button
                            type="button"
                            aria-label={`„${plan.name}" aus den Favoriten entfernen`}
                            onClick={(e) => {
                              // nicht zusätzlich zur Plan-Seite navigieren
                              e.preventDefault();
                              e.stopPropagation();
                              handleRemovePlan(plan.id);
                            }}
                            className="t-interactive hidden h-9 w-9 shrink-0 items-center justify-center rounded-field sm:flex"
                            style={{ color: "var(--gesture-delete)" }}
                          >
                            <Icon name="x" size={15} strokeWidth={2.2} />
                          </button>
                          <span
                            aria-hidden
                            className="shrink-0"
                            style={{ color: "var(--text-3)", lineHeight: 0 }}
                          >
                            <Icon name="arrow-right" size={16} strokeWidth={2} />
                          </span>
                        </Link>
                      </SwipeAction>
                    );
                  })}
                </div>
              )}
            </div>
      </SheetShell>

      {!hasStaffShell && <AthleteTabBar />}
    </main>
  );
}
