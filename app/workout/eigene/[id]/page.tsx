"use client";

/**
 * Persönliche Workoutplan-Kopie (users/{uid}/workoutPlans — Teilschritt 3).
 * Rendert PlanView im Editier-Modus: Name und Blockpausen ändern sich hier,
 * gespeichert wird AUTOMATISCH (debounced 800 ms nach der letzten Änderung,
 * Muster AthleteProfileForm — kein Speichern-Button). Nach dem Laden ist der
 * Client-State die Quelle der Wahrheit; Löschen führt zurück zum Hub.
 * Übungsliste bearbeiten (Wischen/Halten/„+ Übung") kommt in Teilschritt 4.
 */

import Icon from "@/components/ui/Icon";
import { useAuth } from "@/lib/auth-context";
import {
  getPersonalWorkoutPlan,
  planWithAddedExercise,
  planWithDuplicatedExercise,
  planWithMovedExercise,
  planWithRemovedExercise,
  removeSavedPlan,
  upsertPersonalWorkoutPlan,
  type PersonalWorkoutPlan,
} from "@/lib/workout-plans";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import PlanView from "../../plans/[slug]/PlanView";

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

export default function PersonalPlanPage() {
  const params = useParams<{ id: string }>();
  const planId = params.id;
  const { user, loading: authLoading } = useAuth();

  const [plan, setPlan] = useState<PersonalWorkoutPlan | null>(null);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-Speichern (Muster AthleteProfileForm): dirty = ungespeicherte
  // Änderung, inFlight/pending serialisieren überlappende Saves, deleted
  // verhindert, dass der Unmount-Flush eine gelöschte Kopie wiederbelebt.
  const dirtyRef = useRef(false);
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);
  const deletedRef = useRef(false);
  const planRef = useRef<PersonalWorkoutPlan | null>(null);
  planRef.current = plan;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getPersonalWorkoutPlan(user.uid, planId)
      .then((p) => {
        if (cancelled) return;
        if (p) setPlan(p);
        else setMissing(true);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user, planId]);

  const persist = useCallback(async () => {
    const current = planRef.current;
    if (!user || !current || deletedRef.current) return;
    if (inFlightRef.current) {
      // Läuft schon ein Save, danach mit dem dann aktuellen Stand erneut
      pendingRef.current = true;
      return;
    }
    inFlightRef.current = true;
    dirtyRef.current = false;
    setError(null);
    setSaving(true);
    try {
      await upsertPersonalWorkoutPlan(user.uid, current, {
        sourcePlanId: current.sourcePlanId,
      });
      setSaved(true);
    } catch (err) {
      dirtyRef.current = true; // nächste Änderung versucht es erneut
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
      inFlightRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        void persist();
      }
    }
  }, [user]);

  // Debounce: 800 ms nach der letzten Änderung automatisch speichern
  useEffect(() => {
    if (!dirtyRef.current) return;
    const t = setTimeout(() => void persist(), 800);
    return () => clearTimeout(t);
  }, [plan, persist]);

  // Flush beim Unmount: Wer innerhalb der Debounce-Zeit wegnavigiert
  // (z. B. „Workout starten"), verlöre sonst die letzte Eingabe.
  useEffect(
    () => () => {
      if (dirtyRef.current) void persist();
    },
    [persist],
  );

  function update(patch: (p: PersonalWorkoutPlan) => PersonalWorkoutPlan) {
    dirtyRef.current = true;
    setSaved(false);
    setPlan((p) => (p ? patch(p) : p));
  }

  // Herz oben (Leons Vorgabe 2026-08-28): gefüllt = Plan ist Favorit.
  // Klick entfernt die Kopie (inkl. Herz-Verweisen in den Logs) — die
  // Seite bleibt offen, deletedRef pausiert derweil den Auto-Save; ein
  // erneuter Klick legt den Plan unter derselben ID wieder an.
  const [unfavorited, setUnfavorited] = useState(false);
  const [heartBusy, setHeartBusy] = useState(false);

  async function handleToggleFavorite() {
    const current = planRef.current;
    if (!user || !current || heartBusy) return;
    setHeartBusy(true);
    setError(null);
    try {
      if (unfavorited) {
        deletedRef.current = false;
        await upsertPersonalWorkoutPlan(user.uid, current, {
          sourcePlanId: current.sourcePlanId,
        });
        setUnfavorited(false);
      } else {
        deletedRef.current = true;
        await removeSavedPlan(user.uid, current.id);
        setUnfavorited(true);
      }
    } catch (err) {
      // Klick hat nicht gegriffen — Zustand zurückdrehen
      deletedRef.current = unfavorited;
      setError(err instanceof Error ? err.message : "Aktion fehlgeschlagen");
    } finally {
      setHeartBusy(false);
    }
  }

  // Nicht (mehr) vorhanden oder ausgeloggt — gleiche Sprache wie /workout
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
            Diese Kopie gibt es nicht mehr — oder sie gehört zu einem anderen
            Konto.
          </p>
          <Link data-press
            href="/workout/generator"
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
            Zum Workout-Hub
          </Link>
        </div>
      </main>
    );
  }

  // Lädt (Auth oder Firestore) — Seitengrund statt weißem Blitz
  if (!plan) {
    return (
      <main
        className="min-h-screen"
        style={{ background: "var(--surface-page)" }}
      />
    );
  }

  return (
    <PlanView
      plan={plan}
      backHref="/workout/generator"
      backLabel="Workout"
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
          update((p) => planWithRemovedExercise(p, blockIndex, exerciseIndex)),
        onDuplicateExercise: (blockIndex, exerciseIndex) =>
          update((p) =>
            planWithDuplicatedExercise(p, blockIndex, exerciseIndex),
          ),
        onMoveExercise: (from, to) =>
          update((p) => planWithMovedExercise(p, from, to)),
        favorite: {
          saved: !unfavorited,
          busy: heartBusy,
          onToggle: () => void handleToggleFavorite(),
        },
        autoSave: { saving, saved },
        error,
      }}
    />
  );
}
