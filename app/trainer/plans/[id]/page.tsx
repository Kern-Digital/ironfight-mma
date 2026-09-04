"use client";

/**
 * Trainer-Plan-Detail (Workout-Pläne AUSBAU Stufe 1) — derselbe Editor wie
 * überall (PlanView), aber mit EXPLIZITEM Speichern/Verwerfen statt
 * Auto-Save: freigegebene Athleten sehen den Live-Stand, ein Auto-Save
 * würde halbfertige Tipp-Stände an alle pushen. Dazu die Freigabe-Karte
 * (öffnet PlanAudienceSheet — Kurse belegen die Schüler-Checkliste vor,
 * materialisiert wird IMMER die explizite Schüler-Auswahl als audienceUids)
 * und „Plan löschen" mit Inline-Bestätigung. Persönliche Kopien der
 * Athleten bleiben Snapshots — Löschen/Ändern fasst sie nie an.
 */

import PlanAudienceSheet from "@/components/PlanAudienceSheet";
import Icon from "@/components/ui/Icon";
import { listAllMembers, type StudentEntry } from "@/lib/admin";
import { useAuth } from "@/lib/auth-context";
import { resolveGymId } from "@/lib/gym";
import { TRAINING_BLOCKS, WEEKDAY_SHORT } from "@/lib/schedule";
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
import type { Difficulty, Discipline } from "@/lib/types";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PlanView from "../../../workout/plans/[slug]/PlanView";

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
  };
}

/** Inhalts-Diff ohne Freigabe-Felder — nur er zählt für Speichern/Verwerfen. */
function contentOf(plan: TrainerWorkoutPlan) {
  // Die drei Felder werden bewusst herausdestrukturiert, um sie AUS dem
  // Vergleich zu nehmen — sie heißen nur deshalb hier, damit `content` sie
  // nicht enthält.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { audienceUids, audienceCourseIds, updatedAt, ...content } = plan;
  return JSON.stringify(content);
}

function memberLabel(s: StudentEntry): string {
  return s.displayName ?? s.authProviderName ?? s.email ?? "Mitglied";
}

/** Kurs-Anzeige „Mo · MMA Advanced" — unbekannte IDs fallen still raus. */
function courseLabels(courseIds: string[]): string[] {
  return courseIds
    .map((id) => TRAINING_BLOCKS.find((b) => b.id === id))
    .filter((b): b is (typeof TRAINING_BLOCKS)[number] => Boolean(b))
    .map((b) => `${WEEKDAY_SHORT[b.weekday]} · ${b.title}`);
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

  // Mitglieder für die Namensauflösung der Freigabe (Leon 30.08.: Kurse
  // und Personen namentlich anzeigen, nicht nur zählen)
  const [members, setMembers] = useState<StudentEntry[] | null>(null);

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

  useEffect(() => {
    if (!user || profileLoading) return;
    let cancelled = false;
    listAllMembers(resolveGymId(profile))
      .then((list) => {
        if (!cancelled) setMembers(list);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profileLoading]);

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

  async function handleAudienceSave(uids: string[], courseIds: string[]) {
    await updateTrainerPlanAudience(gymId, planId, uids, courseIds);
    setSaved((p) =>
      p ? { ...p, audienceUids: uids, audienceCourseIds: courseIds } : p,
    );
    setDraft((p) =>
      p ? { ...p, audienceUids: uids, audienceCourseIds: courseIds } : p,
    );
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
          <Link
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

  if (!draft || !saved) {
    return (
      <main
        className="min-h-screen"
        style={{ background: "var(--surface-page)" }}
      />
    );
  }

  const audienceCount = saved.audienceUids.length;
  const courses = courseLabels(saved.audienceCourseIds);
  // Namen statt Zahlen (Leon 30.08.) — solange die Mitglieder laden,
  // steht die Zählung als Platzhalter da
  const memberMap = members
    ? new Map(members.map((m) => [m.uid, m] as const))
    : null;
  const personNames = memberMap
    ? saved.audienceUids.map((uid) => {
        const m = memberMap.get(uid);
        return m ? memberLabel(m) : "Ehemaliges Mitglied";
      })
    : null;

  return (
    <>
      <PlanView
        plan={draft}
        backHref="/trainer/plans"
        backLabel="Workout-Pläne"
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
            difficulty: draft.difficulty,
            onDisciplineChange: (discipline: Discipline) =>
              update((p) => ({ ...p, discipline })),
            onDifficultyChange: (difficulty: Difficulty) =>
              update((p) => ({ ...p, difficulty })),
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
        belowStats={
          <>
            {/* ── Freigabe — RAHMENLOS (Leon 30.08.): links das große
                Symbol (öffnet den Dialog), rechts Kurse + Personen
                namentlich in gut lesbarer Größe. Sichtbarkeit erzwingen
                die Firestore-Regeln (audienceUids). ── */}
            <section className="-mt-2 flex items-start gap-4">
              <button
                type="button"
                onClick={() => setAudienceOpen(true)}
                aria-label={
                  audienceCount > 0 ? "Freigabe bearbeiten" : "Plan freigeben"
                }
                className="t-interactive flex h-14 w-14 shrink-0 items-center justify-center rounded-field"
                style={{ color: "var(--accent-text)" }}
              >
                <Icon name="users" size={38} strokeWidth={1.8} />
              </button>
              <div className="flex min-w-0 flex-1 flex-col gap-2 pt-1">
                {audienceCount === 0 ? (
                  <p
                    style={{
                      font: "var(--type-body)",
                      color: "var(--text-3)",
                    }}
                  >
                    Noch nicht freigegeben — nur Trainer sehen diesen Plan.
                    Tippe das Symbol, um ihn freizugeben.
                  </p>
                ) : (
                  <>
                    {courses.length > 0 && (
                      <div className="flex flex-col gap-0.5">
                        <span className="t-label">Kurse</span>
                        <p
                          style={{
                            font: "var(--type-body-strong)",
                            color: "var(--text-body)",
                          }}
                        >
                          {courses.join("  ·  ")}
                        </p>
                      </div>
                    )}
                    <div className="flex flex-col gap-0.5">
                      <span className="t-label">Personen</span>
                      <p
                        style={{
                          font: "var(--type-body-strong)",
                          color: "var(--text-body)",
                        }}
                      >
                        {personNames
                          ? personNames.join(", ")
                          : `${audienceCount} ausgewählt`}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </section>
          </>
        }
        belowBlocks={
          <>
            {/* ── Löschen — Inline-Bestätigung statt Popup, ganz unten ── */}
            <section className="flex flex-wrap items-center gap-3">
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
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="t-interactive -ml-2 inline-flex min-h-hit items-center gap-2 rounded-field px-2"
                  style={{ ...BTN_FONT, color: "var(--negative)" }}
                >
                  <Icon name="trash" size={13} strokeWidth={2.2} />
                  Plan löschen
                </button>
              )}
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
        onSave={handleAudienceSave}
        onClose={() => setAudienceOpen(false)}
      />
    </>
  );
}
