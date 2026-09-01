"use client";

/**
 * Letzte Workouts — Verlauf ALLER geloggten Workouts (Leons Vorgabe
 * 2026-08-28). Erreichbar über „Alle ansehen" im Hub und über die
 * Letzte-Trainings-Liste auf dem Dashboard. Gleiche Kacheln wie der
 * Hub-Stapel (Datum + Startzeit über dem Namen, Herz rechts), Tippen
 * öffnet das Detail-Popup; abgebrochene Workouts sind markiert.
 */

import AthleteTabBar from "@/components/AthleteTabBar";
import Icon from "@/components/ui/Icon";
import WorkoutLogSheet, { WorkoutLogTile } from "@/components/WorkoutLogSheet";
import { useAuth, useRights } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { toggleWorkoutFavorite } from "@/lib/workout-plans";
import { getRecentWorkouts, type WorkoutSession } from "@/lib/workouts";
import { GENDER_HEART_COLOR } from "@/lib/types";
import Link from "next/link";
import { useEffect, useState } from "react";

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

/** Mehr als genug für den Anfang — Paginierung erst, wenn es je nötig wird */
const MAX_ENTRIES = 100;

export default function WorkoutHistoryPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isTrainer = useRights().trainer;
  const heartColor = GENDER_HEART_COLOR[profile?.athlete?.gender ?? "unset"];

  const [sessions, setSessions] = useState<WorkoutSession[] | null>(null);
  const [heartBusy, setHeartBusy] = useState<string | null>(null);
  const [openLogId, setOpenLogId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setSessions([]);
      return;
    }
    let cancelled = false;
    getRecentWorkouts(user.uid, MAX_ENTRIES)
      .then((s) => {
        if (!cancelled) setSessions(s);
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  async function toggleFavorite(session: WorkoutSession) {
    if (!user || heartBusy) return;
    setHeartBusy(session.id);
    try {
      const savedPlanId = await toggleWorkoutFavorite(user.uid, session);
      setSessions(
        (s) =>
          s?.map((x) => (x.id === session.id ? { ...x, savedPlanId } : x)) ??
          s,
      );
    } catch {
      // Fehlgeschlagen — Herz bleibt im alten Zustand
    } finally {
      setHeartBusy(null);
    }
  }

  const openLog = sessions?.find((s) => s.id === openLogId) ?? null;

  return (
    <main
      className={isTrainer ? "min-h-screen pb-12" : "min-h-screen pb-32"}
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      <section className="relative">
        <div className="absolute inset-0 overflow-hidden" aria-hidden>
          <div data-ambient style={{ background: "var(--ambient)" }} />
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
              Letzte Workouts
            </h1>
            <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              Alles, was du gestartet hast — tippe ein Workout für die
              Details, das Herz speichert es als eigenen Plan.
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

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 pt-4 lg:max-w-5xl lg:px-6 lg:pt-5">
        {sessions === null && (
          <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
            Lade Workouts…
          </p>
        )}
        {sessions !== null && sessions.length === 0 && (
          <div className="flex flex-col items-start gap-3 pt-4">
            <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              Noch keine Workouts geloggt — starte dein erstes über den
              Workout-Hub.
            </p>
            <Link
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
              <Icon name="play" size={13} strokeWidth={2.2} />
              Workout starten
            </Link>
          </div>
        )}
        {sessions?.map((s) => (
          <WorkoutLogTile
            key={s.id}
            session={s}
            heartColor={heartColor}
            heartBusy={heartBusy === s.id}
            onToggleFavorite={() => void toggleFavorite(s)}
            onOpen={() => setOpenLogId(s.id)}
          />
        ))}
      </div>

      {openLog && (
        <WorkoutLogSheet
          session={openLog}
          heartColor={heartColor}
          heartBusy={heartBusy === openLog.id}
          onToggleFavorite={() => void toggleFavorite(openLog)}
          onClose={() => setOpenLogId(null)}
        />
      )}

      {!isTrainer && <AthleteTabBar />}
    </main>
  );
}
