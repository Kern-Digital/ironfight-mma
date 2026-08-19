"use client";

import { useEffect, useState } from "react";
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
      <div className="card animate-pulse">
        <div className="mb-3 h-4 w-32 bg-carbon-600" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-16 bg-carbon-600" />
          ))}
        </div>
      </div>
    );
  }

  const unlocked = achievements.filter((a) => a.unlocked);
  const upcoming = achievements
    .filter((a) => !a.unlocked && (a.progress ?? 0) > 0)
    .sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))
    .slice(0, 3);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-bold uppercase tracking-widest text-blood">
          Achievements
        </div>
        <div className="text-xs text-foreground/60">
          {unlocked.length} / {achievements.length}
        </div>
      </div>

      {/* Stats-Summary */}
      {stats && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="py-2">
            <div className="text-lg font-black text-foreground">{stats.total}</div>
            <div className="text-[10px] uppercase tracking-widest text-foreground/60">
              Workouts
            </div>
          </div>
          <div className="py-2">
            <div className="text-lg font-black text-blood">{stats.streak}</div>
            <div className="text-[10px] uppercase tracking-widest text-foreground/60">
              Streak
            </div>
          </div>
          <div className="py-2">
            <div className="text-lg font-black text-foreground">{stats.thisWeek}</div>
            <div className="text-[10px] uppercase tracking-widest text-foreground/60">
              Diese Woche
            </div>
          </div>
        </div>
      )}

      {/* Freigeschaltete Badges */}
      {unlocked.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-xs uppercase tracking-widest text-foreground/60">
            Freigeschaltet
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {unlocked.map((a) => (
              <div
                key={a.id}
                className="rounded-sm border border-blood/50 bg-blood/10 px-3 py-2"
                title={a.description}
              >
                <div className="text-xs font-bold text-blood">{a.label}</div>
                <div className="text-[10px] text-foreground/60">{a.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nächste Ziele */}
      {upcoming.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-xs uppercase tracking-widest text-foreground/60">
            Als Nächstes
          </div>
          <div className="space-y-2">
            {upcoming.map((a) => (
              <div key={a.id} className="py-1">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold">{a.label}</div>
                  <div className="text-[10px] text-foreground/50">
                    {Math.round((a.progress ?? 0) * 100)}%
                  </div>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-carbon-800">
                  <div
                    className="h-full bg-blood"
                    style={{ width: `${(a.progress ?? 0) * 100}%` }}
                  />
                </div>
                <div className="mt-1 text-[10px] text-foreground/60">{a.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {unlocked.length === 0 && upcoming.length === 0 && (
        <p className="mt-4 text-sm text-foreground/60">
          Starte dein erstes Workout um Achievements freizuschalten.
        </p>
      )}
    </div>
  );
}
