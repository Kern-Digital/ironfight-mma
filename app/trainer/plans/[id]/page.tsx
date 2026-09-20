"use client";

/**
 * Trainer-Plan-Detail (Workout-Pläne AUSBAU Stufe 1) — derselbe Editor wie
 * überall (PlanView), aber mit EXPLIZITEM Speichern/Verwerfen statt
 * Auto-Save: freigegebene Athleten sehen den Live-Stand, ein Auto-Save
 * würde halbfertige Tipp-Stände an alle pushen. Die Freigabe hängt am
 * großen Symbol VOR dem Plannamen (Leon 20.09.: Wort wächst beim Hovern
 * heraus, Klick öffnet PlanAudienceSheet — ganze Kurse und/oder Einzelne;
 * die Leseliste audienceUids rechnet lib/workout-plans.ts daraus aus)
 * und „Plan löschen" mit Inline-Bestätigung. Persönliche Kopien der
 * Athleten bleiben Snapshots — Löschen/Ändern fasst sie nie an.
 */

import PlanAudienceSheet from "@/components/PlanAudienceSheet";
import WortKnopf from "@/components/ui/WortKnopf";
import Icon from "@/components/ui/Icon";
import { useAuth } from "@/lib/auth-context";
import { resolveGymId } from "@/lib/gym";
import {
  deleteTrainerWorkoutPlan,
  getTrainerWorkoutPlan,
  planWithAddedBlock,
  planWithAddedExercise,
  planWithDuplicatedExercise,
  planWithMovedBlock,
  planWithMovedExercise,
  planWithRemovedBlock,
  planWithRemovedExercise,
  updateTrainerPlanAudience,
  upsertTrainerWorkoutPlan,
  type TrainerWorkoutPlan,
} from "@/lib/workout-plans";
import type { Discipline } from "@/lib/types";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PlanView from "../../../workout/plans/[slug]/PlanView";
import { MorphSwap } from "@/components/motion";

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

/** Blöcke/Overrides tief genug kopieren, damit der Entwurf nie ins
    gespeicherte Original durchschreibt (Muster PlanView-Draft). */
function clonePlan(plan: TrainerWorkoutPlan): TrainerWorkoutPlan {
  return {
    ...plan,
    blocks: plan.blocks.map((b) => ({ ...b, exerciseIds: [...b.exerciseIds] })),
    ...(plan.restOverrides ? { restOverrides: { ...plan.restOverrides } } : {}),
    audienceUids: [...plan.audienceUids],
    audienceCourseIds: [...plan.audienceCourseIds],
    audienceIndividualUids: plan.audienceIndividualUids
      ? [...plan.audienceIndividualUids]
      : null,
    courseIds: [...plan.courseIds],
  };
}

/** Inhalts-Diff ohne Freigabe-Felder — nur er zählt für Speichern/Verwerfen. */
function contentOf(plan: TrainerWorkoutPlan) {
  // Die Felder werden bewusst herausdestrukturiert, um sie AUS dem
  // Vergleich zu nehmen — sie heißen nur deshalb hier, damit `content` sie
  // nicht enthält.
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const {
    audienceUids,
    audienceCourseIds,
    audienceIndividualUids,
    updatedAt,
    ...content
  } = plan;
  /* eslint-enable @typescript-eslint/no-unused-vars */
  return JSON.stringify(content);
}

export default function TrainerPlanDetailPage() {
  const params = useParams<{ id: string }>();
  const planId = params.id;
  const router = useRouter();
  const { user, profile, loading: authLoading, profileLoading } = useAuth();

  // saved = Firestore-Stand, draft = Editor-Stand (explizites Speichern)
  const [saved, setSaved] = useState<TrainerWorkoutPlan | null>(null);
  const [draft, setDraft] = useState<TrainerWorkoutPlan | null>(null);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlag, setSavedFlag] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Freigabe-Sheet + Löschen
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Mitglieder und Kurs-Abos lädt der Freigabe-Dialog selbst, erst beim
  // Öffnen — die Seite braucht sie nicht mehr (Leon 20.09.: Freigabe steckt
  // im Symbol vor dem Namen). Spart pro Seitenaufruf eine Abfrage je Mitglied.

  const gymId = resolveGymId(profile);

  useEffect(() => {
    if (!user || profileLoading) return;
    let cancelled = false;
    getTrainerWorkoutPlan(resolveGymId(profile), planId)
      .then((p) => {
        if (cancelled) return;
        if (p) {
          setSaved(p);
          setDraft(clonePlan(p));
        } else setMissing(true);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
    // profile nur für die gymId — Neuladen bei User/Plan-Wechsel reicht
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profileLoading, planId]);

  const dirty =
    saved !== null && draft !== null && contentOf(draft) !== contentOf(saved);

  function update(patch: (p: TrainerWorkoutPlan) => TrainerWorkoutPlan) {
    setDraft((p) => (p ? patch(p) : p));
  }

  async function handleSave() {
    if (!user || !draft || !saved || saving) return;
    setSaving(true);
    setError(null);
    try {
      await upsertTrainerWorkoutPlan(
        gymId,
        draft,
        user.uid,
        profile?.displayName ?? profile?.authProviderName ?? "",
        // Nur der Ersteller schreibt seinen Namen ins Dokument
        { isCreator: !saved.createdBy || saved.createdBy === user.uid },
      );
      setSaved(clonePlan(draft));
      setSavedFlag(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    if (saved) setDraft(clonePlan(saved));
    setError(null);
  }

  async function handleAudienceSave(
    courseIds: string[],
    individualUids: string[],
  ) {
    const uids = await updateTrainerPlanAudience(
      gymId,
      planId,
      courseIds,
      individualUids,
    );
    const freigabe = {
      audienceUids: uids,
      audienceCourseIds: courseIds,
      audienceIndividualUids: individualUids,
    };
    setSaved((p) => (p ? { ...p, ...freigabe } : p));
    setDraft((p) => (p ? { ...p, ...freigabe } : p));
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteTrainerWorkoutPlan(gymId, planId);
      router.replace("/trainer/plans");
    } catch (err) {
      setDeleting(false);
      setConfirmDelete(false);
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    }
  }

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
            Diesen Trainer-Plan gibt es nicht mehr — oder er gehört zu einem
            anderen Gym.
          </p>
          <Link data-press
            href="/trainer/plans"
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
            Zu den Workout-Plänen
          </Link>
        </div>
      </main>
    );
  }

  // Sieht den Plan überhaupt jemand? Kurse zählen mit — sie gelten auch für
  // Mitglieder, die den Kurs erst später buchen.
  const freigegeben =
    (saved?.audienceCourseIds.length ?? 0) > 0 ||
    (saved?.audienceUids.length ?? 0) > 0;

  if (!draft || !saved) {
    return (
      <main
        className="min-h-screen"
        style={{ background: "var(--surface-page)" }}
      />
    );
  }

  return (
    <>
      <PlanView
        plan={draft}
        backHref="/trainer/plans"
        backLabel="Workout-Pläne"
        titleLeading={
          // Freigabe: großes Symbol VOR dem Plannamen, beim Hovern wächst das
          // Wort heraus, Klick öffnet den Dialog (Leon 20.09.). Die Farbe sagt
          // den Zustand: Akzent = freigegeben, still = niemand sieht ihn.
          <WortKnopf
            icon="users"
            wort="Freigeben"
            // So groß wie die Überschrift daneben (Leon 20.09.)
            size={44}
            strokeWidth={1.7}
            ariaLabel={
              freigegeben
                ? `Freigabe von „${saved.name || "Unbenannter Plan"}" ändern`
                : `„${saved.name || "Unbenannter Plan"}" freigeben`
            }
            onClick={() => setAudienceOpen(true)}
            style={{
              color: freigegeben ? "var(--accent-text)" : "var(--text-3)",
            }}
          />
        }
        startBelowBlocks
        editHeadBelowStats
        editing={{
          onNameChange: (name) => update((p) => ({ ...p, name })),
          onExerciseRestChange: (exerciseId, restSeconds) =>
            update((p) => ({
              ...p,
              restOverrides: {
                ...(p.restOverrides ?? {}),
                [exerciseId]: restSeconds,
              },
            })),
          onRestAfterChange: (blockIndex, restAfterSeconds) =>
            update((p) => ({
              ...p,
              blocks: p.blocks.map((b, i) =>
                i === blockIndex ? { ...b, restAfterSeconds } : b,
              ),
            })),
          onAddExercise: (blockIndex, exerciseId) =>
            update((p) => planWithAddedExercise(p, blockIndex, exerciseId)),
          onRemoveExercise: (blockIndex, exerciseIndex) =>
            update((p) =>
              planWithRemovedExercise(p, blockIndex, exerciseIndex),
            ),
          onDuplicateExercise: (blockIndex, exerciseIndex) =>
            update((p) =>
              planWithDuplicatedExercise(p, blockIndex, exerciseIndex),
            ),
          onMoveExercise: (from, to) =>
            update((p) => planWithMovedExercise(p, from, to)),
          onRemoveBlock: (blockIndex) =>
            update((p) => planWithRemovedBlock(p, blockIndex)),
          onAddBlock: () => update((p) => planWithAddedBlock(p)),
          onBlockTitleChange: (blockIndex, title) =>
            update((p) => ({
              ...p,
              blocks: p.blocks.map((b, i) =>
                i === blockIndex ? { ...b, title } : b,
              ),
            })),
          onMoveBlock: (from, to) =>
            update((p) => planWithMovedBlock(p, from, to)),
          meta: {
            discipline: draft.discipline,
            onDisciplineChange: (discipline: Discipline) =>
              update((p) => ({ ...p, discipline })),
            // Zuordnung ist Inhalt: sie läuft über Speichern/Verwerfen wie
            // Name und Blöcke, nicht über die Freigabe
            courses: {
              ids: draft.courseIds,
              onChange: (courseIds) => update((p) => ({ ...p, courseIds })),
            },
          },
          save: {
            dirty,
            saving,
            saved: savedFlag,
            onSave: () => void handleSave(),
            onDiscard: handleDiscard,
          },
          error,
        }}
        belowBlocks={
          <>
            {/* ── Löschen — Inline-Bestätigung statt Popup, ganz unten ──
                Der Knopf verwandelt sich in die Rückfrage, statt sie
                danebenzustellen: MorphSwap misst die neue Breite und federt
                dorthin. Die Flex-Reihe traegt der wechselnde Kasten selbst
                (innerClassName), nicht die Huelle darum. */}
            <section>
              <MorphSwap
                activeKey={confirmDelete ? "confirm" : "idle"}
                innerClassName="flex flex-wrap items-center gap-3"
              >
              {confirmDelete ? (
                <>
                  <span
                    style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
                  >
                    Plan wirklich löschen? Persönliche Kopien der Athleten
                    bleiben erhalten.
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={deleting}
                    className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-4 disabled:opacity-50"
                    style={{
                      ...BTN_FONT,
                      background:
                        "color-mix(in oklab, var(--negative) 14%, transparent)",
                      border:
                        "1px solid color-mix(in oklab, var(--negative) 45%, transparent)",
                      color: "var(--negative)",
                    }}
                  >
                    <Icon name="trash" size={13} strokeWidth={2.2} />
                    {deleting ? "Lösche…" : "Endgültig löschen"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                    className="t-interactive inline-flex min-h-hit items-center rounded-field px-4 disabled:opacity-50"
                    style={{ ...BTN_FONT, color: "var(--text-3)" }}
                  >
                    Abbrechen
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="t-interactive -ml-2 inline-flex min-h-hit items-center gap-2 rounded-field px-2"
                    style={{ ...BTN_FONT, color: "var(--negative)" }}
                  >
                    <Icon name="trash" size={13} strokeWidth={2.2} />
                    Plan löschen
                  </button>
                </>
              )}
              </MorphSwap>
            </section>
          </>
        }
      />

      {/* Immer gerendert (siehe components/motion/SheetShell) — `saved`
          steht auf dieser Seite ohnehin durchgehend zur Verfuegung. */}
      <PlanAudienceSheet
        open={audienceOpen}
        gymId={gymId}
        planName={saved.name || "Unbenannter Plan"}
        initialUids={saved.audienceUids}
        initialCourseIds={saved.audienceCourseIds}
        initialIndividualUids={saved.audienceIndividualUids}
        onSave={handleAudienceSave}
        onClose={() => setAudienceOpen(false)}
      />
    </>
  );
}
