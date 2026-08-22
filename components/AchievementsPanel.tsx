"use client";

/**
 * Achievements-Übersicht (Account-Seite): Workout-Stats, freigeschaltete
 * Meilensteine und die nächsten Ziele. Neues Token-System (Rollout Etappe 3);
 * der umgebende Karten-Rahmen + Sektions-Titel kommen von der Seite —
 * die Komponente rendert nur den Karten-INHALT.
 */

import { useEffect, useState } from "react";
import Skeleton from "@/components/ui/Skeleton";
import { computeStats, getRecentWorkouts, type WorkoutStats } from "@/lib/workouts";
import { getLibrary } from "@/lib/training-sessions";

type Achievement = {
  id: string;
  label: string;
  description: string;
  unlocked: boolean;
  /** Fortschritt 0..1 für Progress-Bar bei nicht freigeschalteten */
  progress?: number;
};

function buildAchievements(
  stats: WorkoutStats,
  libraryCount: number,
  disciplineCount: number,
): Achievement[] {
  const list: Achievement[] = [];

  // Workout-Volume Meilensteine
  for (const target of [1, 10, 50, 100, 250]) {
    list.push({
      id: `workouts-${target}`,
      label: `${target} Workout${target === 1 ? "" : "s"}`,
      description:
        target === 1
          ? "Erstes Workout abgeschlossen"
          : `${target} Workouts insgesamt`,
      unlocked: stats.total >= target,
      progress: Math.min(1, stats.total / target),
    });
  }

  // Streak-Meilensteine
  for (const target of [3, 7, 14, 30]) {
    list.push({
      id: `streak-${target}`,
      label: `${target}-Tage-Streak`,
      description: `${target} Tage in Folge trainiert`,
      unlocked: stats.streak >= target,
      progress: Math.min(1, stats.streak / target),
    });
  }

  // Bibliothek
  for (const target of [1, 10, 25, 50]) {
    list.push({
      id: `library-${target}`,
      label: `${target} Technik${target === 1 ? "" : "en"}`,
      description: `${target} Techniken in der Bibliothek`,
      unlocked: libraryCount >= target,
      progress: Math.min(1, libraryCount / target),
    });
  }

  // Vielfalt
  list.push({
    id: "all-rounder",
    label: "Allrounder",
    description: "In allen 4 Hauptkategorien trainiert",
    unlocked: disciplineCount >= 4,
    progress: Math.min(1, disciplineCount / 4),
  });

  return list;
}

export default function AchievementsPanel({ uid }: { uid: string }) {
  const [achievements, setAchievements] = useState<Achievement[] | null>(null);
  const [stats, setStats] = useState<WorkoutStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sessions, library] = await Promise.all([
          getRecentWorkouts(uid, 250),
          getLibrary(uid),
        ]);
        if (cancelled) return;
        const s = computeStats(sessions);
        const disciplineCount = (Object.keys(s.byCategory) as Array<keyof typeof s.byCategory>)
          .filter((k) => s.byCategory[k] > 0).length;
        setStats(s);
        setAchievements(buildAchievements(s, library.length, disciplineCount));
      } catch {
        if (!cancelled) {
          setAchievements([]);
          setStats(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  if (achievements === null) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-16 w-full rounded-badge" />
        <Skeleton className="h-24 w-full rounded-badge" />
      </div>
    );
  }

  const unlocked = achievements.filter((a) => a.unlocked);
  const upcoming = achievements
    .filter((a) => !a.unlocked && (a.progress ?? 0) > 0)
    .sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-5">
      {/* Stats-Summary + Zähler */}
      <div className="flex items-start justify-between gap-3">
        {stats && (
          <div className="flex flex-1 flex-wrap gap-x-6 gap-y-2">
            {(
              [
                { value: stats.total, label: "Workouts", accent: false },
                { value: stats.streak, label: "Streak", accent: true },
                { value: stats.thisWeek, label: "Diese Woche", accent: false },
              ] as const
            ).map((s) => (
              <div key={s.label} className="flex flex-col gap-1">
                <span
                  style={{
                    font: "var(--type-num-xl)",
                    fontVariantNumeric: "tabular-nums",
                    color: s.accent ? "var(--accent-text)" : "var(--text-body)",
                  }}
                >
                  {s.value}
                </span>
                <span className="t-label">{s.label}</span>
              </div>
            ))}
          </div>
        )}
        <span
          className="shrink-0"
          style={{
            font: "var(--type-num)",
            fontVariantNumeric: "tabular-nums",
            color: "var(--text-3)",
          }}
        >
          {unlocked.length} / {achievements.length}
        </span>
      </div>

      {/* Freigeschaltete Badges */}
      {unlocked.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="t-label">Freigeschaltet</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {unlocked.map((a) => (
              <div
                key={a.id}
                className="flex flex-col gap-0.5 rounded-badge px-3 py-2"
                style={{ background: "var(--accent-subtle)" }}
                title={a.description}
              >
                <span
                  style={{
                    font: "600 12px/1.3 var(--font-archivo), system-ui, sans-serif",
                    color: "var(--accent-text)",
                  }}
                >
                  {a.label}
                </span>
                <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                  {a.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nächste Ziele */}
      {upcoming.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="t-label">Als Nächstes</span>
          <div className="flex flex-col gap-3">
            {upcoming.map((a) => (
              <div key={a.id} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span style={{ font: "var(--type-body-strong)" }}>{a.label}</span>
                  <span
                    style={{
                      font: "var(--type-num)",
                      fontVariantNumeric: "tabular-nums",
                      color: "var(--text-2)",
                    }}
                  >
                    {Math.round((a.progress ?? 0) * 100)} %
                  </span>
                </div>
                <div className="t-progress">
                  <span style={{ width: `${(a.progress ?? 0) * 100}%` }} />
                </div>
                <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                  {a.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {unlocked.length === 0 && upcoming.length === 0 && (
        <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
          Starte dein erstes Workout, um Achievements freizuschalten.
        </p>
      )}
    </div>
  );
}
