"use client";

/**
 * Trainer-Workout-Pläne (Workout-Pläne AUSBAU Stufe 1) — Liste aller
 * Trainer-Pläne des Gyms mit Freigabe-Stand. Token-Look (DESIGN-BRIEF):
 * die neuen Trainer-Oberflächen dieser Stufe entstehen direkt im neuen
 * System, der restliche Trainer-Bereich folgt in seiner eigenen Etappe.
 * Route liegt unter /trainer/* → Middleware lässt nur Trainer/Admin durch.
 *
 * ZWEI ANSICHTEN (Leon 19.09.): „Alle" ist die flache Liste, „Nach Kursen"
 * sortiert die Pläne unter die Kurse, denen der Trainer sie ZUGEORDNET hat
 * (`courseIds` — reine Ordnung; wer den Plan sieht, regelt allein die
 * Freigabe). Die Gruppen folgen den KURSNAMEN, nicht den Terminen (Regel in
 * lib/schedule.ts): „MMA Teens" steht viermal im Kursplan, als vier gleich
 * beschriftete Gruppen wäre das nicht auseinanderzuhalten. Ein Plan in
 * mehreren Kursen steht in jeder seiner Gruppen; Pläne ohne Kurs — auch
 * solche, deren Kurs aus dem Kursplan gefallen ist — sammeln sich am Ende.
 * Das „+" am Kurskopf legt einen neuen Plan an, der diesem Kurs schon
 * zugeordnet ist.
 */

import PlanAudienceSheet from "@/components/PlanAudienceSheet";
import Icon from "@/components/ui/Icon";
import { MorphSwap, StaggerList, useLetzterWert } from "@/components/motion";
import { useAuth } from "@/lib/auth-context";
import { resolveGymId } from "@/lib/gym";
import {
  blockById,
  courseTitles,
  courseTitlesOf,
  WEEKDAY_SHORT,
} from "@/lib/schedule";
import {
  listTrainerWorkoutPlans,
  planDurationSeconds,
  planExerciseCount,
  updateTrainerPlanAudience,
  type TrainerWorkoutPlan,
} from "@/lib/workout-plans";
import { DISCIPLINE_LABEL } from "@/lib/types";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
    „Freigegeben" fällt dann weg (Leon 30.08.), die Farbe trägt es.
    KEINE Kopfzahl über alle (Leon 19.09.): ein Kurs gilt ganz, auch für
    spätere Mitglieder — gezählt werden Kurse (je Kursname) und Einzelne. */
function audienceLine(plan: TrainerWorkoutPlan): {
  text: string;
  shared: boolean;
} {
  const kurse = courseTitlesOf(plan.audienceCourseIds).length;
  // Altbestand ohne getrennte Einzelne: dort zählen nur die Kurse — außer
  // es gibt keine, dann sind alle Einzelne
  const einzeln =
    plan.audienceIndividualUids?.length ??
    (kurse === 0 ? plan.audienceUids.length : 0);
  const teile: string[] = [];
  if (kurse > 0) teile.push(`${kurse} ${kurse === 1 ? "Kurs" : "Kurse"}`);
  if (einzeln > 0) {
    teile.push(`${einzeln} ${einzeln === 1 ? "Athlet" : "Athleten"}`);
  }
  if (teile.length === 0) return { text: "Nicht freigegeben", shared: false };
  return { text: teile.join(" + "), shared: true };
}

// ─── Ansicht „Nach Kursen" ──────────────────────────────────────────────────

type Ansicht = "alle" | "kurse";

/** Die gewählte Ansicht überlebt den Seitenwechsel — nur auf diesem Gerät. */
const ANSICHT_KEY = "ta-trainer-plans-ansicht";

interface KursGruppe {
  /** Kursname, oder null für die Sammelgruppe am Ende */
  title: string | null;
  /** Wochentage der Termine, denen mindestens ein Plan zugeordnet ist */
  weekdays: number[];
  plans: TrainerWorkoutPlan[];
}

/**
 * Sortiert die Pläne unter ihre Kurse — in der Reihenfolge des Kursplans
 * (Wochentag, dann Startzeit des ersten Termins). Unbekannte Kurs-IDs fallen
 * still raus wie auf der Detailseite; wer danach ohne Kurs dasteht, landet in
 * der Sammelgruppe.
 */
function nachKursen(plans: TrainerWorkoutPlan[]): KursGruppe[] {
  // courseTitles() steht in Kursplan-Reihenfolge — die Einfüge-Reihenfolge
  // der Map ist damit die Reihenfolge der Gruppen.
  const gruppen = new Map<string, KursGruppe>(
    courseTitles().map((t) => [t, { title: t, weekdays: [], plans: [] }]),
  );
  const ohneKurs: TrainerWorkoutPlan[] = [];

  for (const plan of plans) {
    const titel = new Set<string>();
    for (const id of plan.courseIds) {
      const block = blockById(id);
      if (!block) continue;
      const gruppe = gruppen.get(block.title)!;
      if (!gruppe.weekdays.includes(block.weekday)) {
        gruppe.weekdays.push(block.weekday);
      }
      titel.add(block.title);
    }
    // Zwei Termine desselben Kurses sind EINE Gruppe — der Plan steht dort
    // nur einmal.
    titel.forEach((t) => gruppen.get(t)!.plans.push(plan));
    if (titel.size === 0) ohneKurs.push(plan);
  }

  const liste = Array.from(gruppen.values())
    .filter((g) => g.plans.length > 0)
    .map((g) => ({ ...g, weekdays: g.weekdays.sort((a, b) => a - b) }));
  if (ohneKurs.length > 0) {
    liste.push({ title: null, weekdays: [], plans: ohneKurs });
  }
  return liste;
}

/**
 * Kopf einer Kursgruppe: Name, Termine, Zahl der Pläne, Trennlinie — und
 * rechts das „+" für einen neuen Plan in diesem Kurs (Leon 19.09.). Das „+"
 * steht in derselben Spalte wie die Freigabe-Symbole der Zeilen darunter
 * (Rechtsabstand = Kartenpolster + halbe Symbolfläche − halbe Knopfbreite).
 */
function KursKopf({ gruppe }: { gruppe: KursGruppe }) {
  const n = gruppe.plans.length;
  const meta = [
    ...gruppe.weekdays.map((d) => WEEKDAY_SHORT[d]),
    `${n} ${n === 1 ? "Plan" : "Pläne"}`,
  ].join(" · ");
  return (
    <div className="flex min-h-hit items-center gap-3 pl-1">
      {/* Mobil stehen Name und Meta untereinander — sonst bricht ein langer
          Kursname um und schiebt die Meta an den rechten Rand */}
      <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
        <h2
          style={{
            font: "700 16px/1.2 var(--font-archivo), system-ui, sans-serif",
            letterSpacing: "var(--ls-label)",
            textTransform: "uppercase",
            color: gruppe.title ? "var(--text-body)" : "var(--text-3)",
          }}
        >
          {gruppe.title ?? "Ohne Kurs"}
        </h2>
        <span
          className={`shrink-0 ${META_SIZE}`}
          style={{ ...META_BASE, color: "var(--text-3)" }}
        >
          {meta}
        </span>
      </div>
      <span
        aria-hidden
        className="h-px min-w-4 flex-1"
        style={{ background: "var(--line)" }}
      />
      {gruppe.title && (
        <Link
          data-press
          href={`/trainer/plans/neu?kurs=${encodeURIComponent(gruppe.title)}`}
          aria-label={`Neuer Plan für „${gruppe.title}"`}
          title={`Neuer Plan für „${gruppe.title}"`}
          className="t-interactive -my-1 mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-field sm:mr-[22px]"
          style={{ color: "var(--accent-text)" }}
        >
          <Icon name="plus" size={22} strokeWidth={2.2} />
        </Link>
      )}
    </div>
  );
}

function PlanZeile({
  plan,
  onFreigabe,
}: {
  plan: TrainerWorkoutPlan;
  onFreigabe: () => void;
}) {
  const minutes = Math.round(planDurationSeconds(plan) / 60);
  const exercises = planExerciseCount(plan);
  const audience = audienceLine(plan);
  return (
    <Link data-press="surface"
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
            {DISCIPLINE_LABEL[plan.discipline]} · ≈ {minutes} min ·{" "}
            {exercises} Übungen
          </span>
          <span
            className={META_SIZE}
            style={{
              ...META_BASE,
              color: audience.shared ? "var(--accent-text)" : "var(--text-3)",
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
          onFreigabe();
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
  // Haelt den Plan waehrend der Austritts-Feder des Freigabe-Sheets fest.
  const letzterPlan = useLetzterWert(audiencePlan);

  const [ansicht, setAnsicht] = useState<Ansicht>("alle");
  // Erst nach dem Mounten lesen — der Server kennt den Speicher nicht, und
  // ein abweichender erster Render gäbe einen Hydration-Fehler.
  useEffect(() => {
    try {
      if (localStorage.getItem(ANSICHT_KEY) === "kurse") setAnsicht("kurse");
    } catch {
      // Privates Fenster o. Ä. — dann eben „Alle"
    }
  }, []);
  function ansichtWaehlen(a: Ansicht) {
    setAnsicht(a);
    try {
      localStorage.setItem(ANSICHT_KEY, a);
    } catch {
      // siehe oben
    }
  }

  const gruppen = useMemo(() => (plans ? nachKursen(plans) : []), [plans]);

  async function handleAudienceSave(
    courseIds: string[],
    individualUids: string[],
  ) {
    if (!audiencePlan) return;
    const uids = await updateTrainerPlanAudience(
      gymId,
      audiencePlan.id,
      courseIds,
      individualUids,
    );
    setPlans(
      (list) =>
        list?.map((p) =>
          p.id === audiencePlan.id
            ? {
                ...p,
                audienceUids: uids,
                audienceCourseIds: courseIds,
                audienceIndividualUids: individualUids,
              }
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
            <Link data-press
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
              Eigene Pläne erstellen und an Kurse oder einzelne Athleten
              freigeben.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-4 lg:max-w-5xl lg:px-6 lg:pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link data-press
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

          {/* Ansicht — zwei Umschalter, ohne Rahmen (Leon 19.09.): die
              gewählte Fläche trägt den Zustand */}
          {plans !== null && plans.length > 0 && (
            <div role="group" aria-label="Ansicht" className="flex gap-2">
              {(
                [
                  ["alle", "Alle"],
                  ["kurse", "Nach Kursen"],
                ] as const
              ).map(([wert, label]) => {
                const active = ansicht === wert;
                return (
                  <button
                    key={wert}
                    type="button"
                    data-press
                    onClick={() => ansichtWaehlen(wert)}
                    aria-pressed={active}
                    className="t-interactive min-h-hit whitespace-nowrap rounded-field px-4"
                    style={{
                      ...BTN_FONT,
                      background: active ? "var(--accent-subtle)" : "transparent",
                      color: active ? "var(--accent-text)" : "var(--text-2)",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
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
            deine Athleten frei.
          </p>
        ) : (
          // Umschalten tauscht die Liste am selben Platz (MorphSwap), statt
          // sie hart zu ersetzen
          <MorphSwap activeKey={ansicht}>
            {ansicht === "alle" ? (
              <StaggerList className="flex flex-col gap-3">
                {plans.map((plan) => (
                  <PlanZeile
                    key={plan.id}
                    plan={plan}
                    onFreigabe={() => setAudiencePlan(plan)}
                  />
                ))}
              </StaggerList>
            ) : (
              <StaggerList className="flex flex-col gap-7">
                {gruppen.map((gruppe) => (
                  <section
                    key={gruppe.title ?? "__ohne-kurs"}
                    className="flex flex-col gap-3"
                  >
                    <KursKopf gruppe={gruppe} />
                    {gruppe.plans.map((plan) => (
                      <PlanZeile
                        key={plan.id}
                        plan={plan}
                        onFreigabe={() => setAudiencePlan(plan)}
                      />
                    ))}
                  </section>
                ))}
              </StaggerList>
            )}
          </MorphSwap>
        )}
      </div>

      {/* Freigabe-Sheet für den gewählten Plan. Immer gerendert, damit es
          sich beim Schliessen zurueckverwandeln kann; `letzterPlan` haelt
          den Inhalt waehrend der Austritts-Feder, wenn audiencePlan schon
          null ist. */}
      <PlanAudienceSheet
        open={audiencePlan !== null}
        gymId={gymId}
        planName={letzterPlan?.name || "Unbenannter Plan"}
        initialUids={letzterPlan?.audienceUids ?? []}
        initialCourseIds={letzterPlan?.audienceCourseIds ?? []}
        initialIndividualUids={letzterPlan?.audienceIndividualUids ?? []}
        onSave={handleAudienceSave}
        onClose={() => setAudiencePlan(null)}
      />
    </main>
  );
}
