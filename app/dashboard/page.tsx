"use client";

import PageHeader from "@/components/PageHeader";
import ProtectedRoute from "@/components/ProtectedRoute";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import { useAuth } from "@/lib/auth-context";
import { greetingFor } from "@/lib/greeting";
import { CATEGORY_LABEL } from "@/lib/techniques";
import {
  computeStats,
  getRecentWorkouts,
  type WorkoutSession,
  type WorkoutStats,
} from "@/lib/workouts";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function formatRelative(d: Date) {
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `vor ${hours} Std`;
  const days = Math.round(hours / 24);
  if (days < 7) return `vor ${days} ${days === 1 ? "Tag" : "Tagen"}`;
  return d.toLocaleDateString("de-DE");
}

function formatMinutes(seconds: number) {
  const m = Math.round(seconds / 60);
  return `${m} min`;
}

function formatHours(seconds: number) {
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h} h ${m} min`;
}

function DashboardContent() {
  const { user, profile } = useAuth();
  const greeting = greetingFor(profile?.displayName);

  const [sessions, setSessions] = useState<WorkoutSession[] | null>(null);
  const [stats, setStats] = useState<WorkoutStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    if (!user) return;
    setError(null);
    setSessions(null);
    setStats(null);

    getRecentWorkouts(user.uid, 20)
      .then((data) => {
        setSessions(data);
        setStats(computeStats(data));
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
        setError(msg);
      });
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const statCards = [
    { label: "Diese Woche", value: stats ? String(stats.thisWeek) : null },
    {
      label: "Streak",
      value: stats
        ? `${stats.streak} ${stats.streak === 1 ? "Tag" : "Tage"}`
        : null,
    },
    { label: "Workouts gesamt", value: stats ? String(stats.total) : null },
    {
      label: "Trainingszeit",
      value: stats ? formatHours(stats.totalSeconds) : null,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Mein Training"
        title={greeting}
        description="Deine Trainings, Streaks und Fortschritte auf einen Blick."
      />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {error && (
          <div className="mb-6">
            <ErrorState
              title="Daten konnten nicht geladen werden"
              message={error}
              hint="Prüfe ob Firestore in der Firebase Console aktiviert ist."
              onRetry={fetchData}
            />
          </div>
        )}

        {/* Stat-Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <div key={stat.label} className="card">
              <div className="text-xs font-bold uppercase tracking-widest text-foreground/60">
                {stat.label}
              </div>
              {stat.value === null ? (
                <Skeleton className="mt-3 h-10 w-20" />
              ) : (
                <div className="font-display mt-3 text-4xl font-black text-blood">
                  {stat.value}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Top-Kategorie + Quick-Actions */}
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="card">
            <div className="text-xs font-bold uppercase tracking-widest text-foreground/60">
              Lieblings-Disziplin
            </div>
            {stats === null ? (
              <Skeleton className="mt-3 h-8 w-32" />
            ) : stats.topCategory ? (
              <div className="mt-2">
                <div className="heading-display text-2xl font-black text-blood">
                  {CATEGORY_LABEL[stats.topCategory.category]}
                </div>
                <div className="mt-1 text-xs uppercase tracking-widest text-foreground/60">
                  {stats.topCategory.count} Sessions
                </div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-foreground/60">
                Noch keine Daten — starte dein erstes Workout!
              </div>
            )}
          </div>

          <div className="card lg:col-span-2">
            <div className="text-xs font-bold uppercase tracking-widest text-foreground/60">
              Schnell-Start
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/workout/generator" className="btn-primary text-sm">
                Auto-Workout starten
              </Link>
              <Link href="/training" className="btn-secondary text-sm">
                Disziplin wählen
              </Link>
              <Link href="/timer" className="btn-secondary text-sm">
                Nur Timer
              </Link>
              <Link href="/techniques" className="btn-secondary text-sm">
                Technikbibliothek
              </Link>
            </div>
          </div>
        </div>

        {/* Letzte Sessions */}
        <div className="mt-10 card">
          <div className="flex items-center justify-between">
            <h2 className="heading-display text-2xl font-black">
              Letzte Trainings
            </h2>
            <Link
              href="/training"
              className="text-xs font-bold uppercase tracking-widest text-foreground/70 hover:text-blood"
            >
              + Neue Session
            </Link>
          </div>

          {sessions === null && !error && (
            <div className="mt-6 space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          )}

          {sessions && sessions.length === 0 && (
            <div className="mt-6 rounded-sm border border-dashed border-carbon-400 bg-carbon-800/40 p-6 text-center text-sm text-foreground/70">
              <p>Noch keine Sessions.</p>
              <p className="mt-1 text-xs text-foreground/50">
                Starte dein erstes Training über{" "}
                <Link href="/workout/generator" className="text-blood hover:underline">
                  Generator
                </Link>{" "}
                oder{" "}
                <Link href="/training" className="text-blood hover:underline">
                  Trainingspläne
                </Link>
                .
              </p>
            </div>
          )}

          {sessions && sessions.length > 0 && (
            <ul className="mt-6 divide-y divide-carbon-500/60">
              {sessions.slice(0, 10).map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <div className="font-bold">
                      {s.label ?? "Freies Workout"}
                      {s.status === "aborted" && (
                        <span className="ml-2 rounded-sm border border-yellow-500/40 bg-yellow-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-yellow-300">
                          abgebrochen
                        </span>
                      )}
                    </div>
                    <div className="text-xs uppercase tracking-widest text-foreground/60">
                      {s.category ? CATEGORY_LABEL[s.category] : "—"} ·{" "}
                      {s.rounds}× {Math.round(s.workSeconds / 60)} min · Pause{" "}
                      {s.restSeconds}s
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-blood">
                      {formatMinutes(s.totalWorkSeconds)}
                    </div>
                    <div className="text-xs uppercase tracking-widest text-foreground/60">
                      {formatRelative(s.completedAt)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
