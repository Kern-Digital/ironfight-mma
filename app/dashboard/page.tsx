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
  return `${h}h ${m}m`;
}

// 7-day streak calendar
function StreakCalendar({ sessions }: { sessions: WorkoutSession[] }) {
  const days = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const today = new Date();
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 6 + i);
    return d;
  });

  const sessionDays = new Set(
    sessions.map((s) => s.completedAt.toDateString())
  );

  return (
    <div className="mt-4 flex gap-1.5">
      {weekDays.map((d, i) => {
        const isToday = d.toDateString() === today.toDateString();
        const done = sessionDays.has(d.toDateString());
        return (
          <div
            key={i}
            className="flex flex-1 flex-col items-center rounded-md py-2 font-mono-ta text-[9px] uppercase"
            style={{
              letterSpacing: "0.1em",
              background: isToday
                ? "var(--ta-pink)"
                : done
                ? "var(--ta-cyan)"
                : "var(--ink-4)",
              color: isToday ? "#fff" : done ? "#001417" : "var(--fg-3)",
              boxShadow: isToday
                ? "0 0 12px rgba(255,45,120,.5)"
                : done
                ? "0 0 12px rgba(0,212,230,.4)"
                : "none",
            }}
          >
            {days[i]}
          </div>
        );
      })}
    </div>
  );
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

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              "Verbindung zu Firestore dauert zu lange. Bitte Internetverbindung prüfen."
            )
          ),
        15000
      )
    );

    Promise.race([getRecentWorkouts(user.uid, 20), timeout])
      .then((data) => {
        setSessions(data as WorkoutSession[]);
        setStats(computeStats(data as WorkoutSession[]));
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
        setError(msg);
        setSessions([]);
        setStats(computeStats([]));
      });
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const statCards = [
    {
      label: "Diese Woche",
      value: stats ? String(stats.thisWeek) : null,
      delta: null,
    },
    {
      label: "Streak",
      value: stats
        ? `${stats.streak} ${stats.streak === 1 ? "Tag" : "Tage"}`
        : null,
      delta: null,
    },
    {
      label: "Workouts gesamt",
      value: stats ? String(stats.total) : null,
      delta: null,
    },
    {
      label: "Trainingszeit",
      value: stats ? formatHours(stats.totalSeconds) : null,
      delta: null,
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
              hint={
                error.includes("permission")
                  ? "Firestore-Berechtigungen prüfen — oder erneut einloggen."
                  : "Prüfe deine Internetverbindung und lade die Seite neu."
              }
              onRetry={fetchData}
            />
          </div>
        )}

        {/* Streak hero card */}
        <div
          className="mb-6 rounded-2xl p-5 relative overflow-hidden"
          style={{
            background:
              "radial-gradient(300px 200px at 90% -20%, rgba(0,212,230,.22), transparent 60%), linear-gradient(160deg, #0B1218, #050709)",
            border: "1px solid var(--ink-5)",
          }}
        >
          <div
            className="pointer-events-none absolute right-[-20px] top-[-20px] h-48 w-48 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(0,212,230,.15), transparent 60%)",
            }}
          />
          <div
            className="font-mono-ta text-[10px] uppercase"
            style={{ letterSpacing: "0.25em", color: "var(--fg-3)" }}
          >
            Trainings-Streak
          </div>
          {stats === null ? (
            <Skeleton className="mt-2 h-16 w-24" />
          ) : (
            <div
              className="font-display-ta mt-1 font-black leading-none"
              style={{
                fontSize: "72px",
                color: "var(--ta-cyan)",
                textShadow: "0 0 20px rgba(0,212,230,.5)",
                letterSpacing: "-0.01em",
              }}
            >
              {stats.streak}
              <span
                className="font-mono-ta ml-2 text-base"
                style={{ color: "var(--fg-3)", letterSpacing: "0.2em" }}
              >
                {stats.streak === 1 ? "Tag" : "Tage"}
              </span>
            </div>
          )}
          {sessions !== null && (
            <StreakCalendar sessions={sessions} />
          )}
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statCards.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl p-4"
              style={{
                background:
                  "linear-gradient(180deg, var(--ink-3), var(--ink-2))",
                border: "1px solid var(--ink-4)",
              }}
            >
              <div
                className="font-mono-ta text-[9px] uppercase"
                style={{ letterSpacing: "0.2em", color: "var(--fg-3)" }}
              >
                {stat.label}
              </div>
              {stat.value === null ? (
                <Skeleton className="mt-2 h-8 w-20" />
              ) : (
                <div
                  className="font-display-ta mt-2 font-black leading-none"
                  style={{ fontSize: "28px", color: "var(--fg)" }}
                >
                  {stat.value}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Quick actions + top discipline */}
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {/* Top category */}
          <div
            className="rounded-2xl p-5"
            style={{
              background: "linear-gradient(180deg, var(--ink-3), var(--ink-2))",
              border: "1px solid var(--ink-4)",
            }}
          >
            <div
              className="font-mono-ta text-[9px] uppercase"
              style={{ letterSpacing: "0.2em", color: "var(--fg-3)" }}
            >
              Lieblings-Disziplin
            </div>
            {stats === null ? (
              <Skeleton className="mt-3 h-8 w-32" />
            ) : stats.topCategory ? (
              <div className="mt-3">
                <div
                  className="font-display-ta font-black uppercase"
                  style={{
                    fontSize: "24px",
                    color: "var(--ta-cyan)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {CATEGORY_LABEL[stats.topCategory.category]}
                </div>
                <div
                  className="font-mono-ta mt-1 text-[10px] uppercase"
                  style={{ letterSpacing: "0.15em", color: "var(--fg-3)" }}
                >
                  {stats.topCategory.count} Sessions
                </div>
              </div>
            ) : (
              <div className="mt-3 text-sm" style={{ color: "var(--fg-3)" }}>
                Noch keine Daten — starte dein erstes Workout!
              </div>
            )}
          </div>

          {/* Quick start */}
          <div
            className="rounded-2xl p-5 lg:col-span-2"
            style={{
              background: "linear-gradient(180deg, var(--ink-3), var(--ink-2))",
              border: "1px solid var(--ink-4)",
            }}
          >
            <div
              className="font-mono-ta text-[9px] uppercase"
              style={{ letterSpacing: "0.2em", color: "var(--fg-3)" }}
            >
              Schnell-Start
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/workout/generator" className="btn-primary text-sm">
                Auto-Workout starten
              </Link>
              <Link href="/workout/generator" className="btn-secondary text-sm">
                Trainingspläne
              </Link>
              <Link href="/timer" className="btn-secondary text-sm">
                Nur Timer
              </Link>
              <Link href="/techniques" className="btn-secondary text-sm">
                Techniken
              </Link>
            </div>
          </div>
        </div>

        {/* Session history */}
        <div
          className="mt-6 rounded-2xl p-5"
          style={{
            background: "linear-gradient(180deg, var(--ink-3), var(--ink-2))",
            border: "1px solid var(--ink-4)",
          }}
        >
          <div className="flex items-center justify-between">
            <h2
              className="font-display-ta font-black uppercase"
              style={{ fontSize: "22px", letterSpacing: "0.06em" }}
            >
              Letzte Trainings
            </h2>
            <Link
              href="/workout/generator"
              className="font-mono-ta text-[10px] uppercase transition-colors"
              style={{ letterSpacing: "0.2em", color: "var(--ta-cyan)" }}
            >
              + Neue Session
            </Link>
          </div>

          {sessions === null && !error && (
            <div className="mt-6 flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          )}

          {sessions && sessions.length === 0 && !error && (
            <div
              className="mt-6 rounded-xl p-8 text-center"
              style={{
                border: "1px dashed var(--ink-5)",
                background: "var(--ink-2)",
              }}
            >
              <div className="text-3xl">🥊</div>
              <p className="mt-3 text-sm font-bold" style={{ color: "var(--fg-3)" }}>
                Noch keine Sessions.
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--fg-4)" }}>
                Starte dein erstes Training über{" "}
                <Link href="/workout/generator" style={{ color: "var(--ta-cyan)" }}>
                  Generator
                </Link>{" "}
                oder{" "}
                <Link href="/workout/generator" style={{ color: "var(--ta-cyan)" }}>
                  Trainingspläne
                </Link>
                .
              </p>
            </div>
          )}

          {sessions && sessions.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              {sessions.slice(0, 10).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 rounded-xl p-3"
                  style={{
                    background: "var(--ink-2)",
                    border: "1px solid var(--ink-4)",
                  }}
                >
                  {/* Date block */}
                  <div className="font-display-ta min-w-[44px] text-center leading-tight">
                    <span
                      className="block"
                      style={{ fontSize: "22px", color: "var(--ta-cyan)", lineHeight: 1 }}
                    >
                      {s.completedAt.getDate()}
                    </span>
                    <span
                      className="font-mono-ta text-[9px] uppercase"
                      style={{ letterSpacing: "0.2em", color: "var(--fg-3)" }}
                    >
                      {s.completedAt.toLocaleDateString("de-DE", { month: "short" })}
                    </span>
                  </div>
                  {/* Divider */}
                  <div
                    className="h-10 w-px flex-shrink-0"
                    style={{ background: "var(--ink-5)" }}
                  />
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-display-ta font-bold uppercase truncate"
                      style={{ fontSize: "14px", letterSpacing: "0.04em" }}
                    >
                      {s.label ?? "Freies Workout"}
                      {s.status === "aborted" && (
                        <span
                          className="ml-2 rounded px-1.5 py-0.5 text-[9px] uppercase"
                          style={{
                            border: "1px solid rgba(255,45,120,.3)",
                            background: "rgba(255,45,120,.08)",
                            color: "var(--ta-pink)",
                            letterSpacing: "0.15em",
                          }}
                        >
                          abgebrochen
                        </span>
                      )}
                    </div>
                    <div
                      className="font-mono-ta mt-0.5 text-[9px] uppercase"
                      style={{ letterSpacing: "0.15em", color: "var(--fg-3)" }}
                    >
                      {s.category ? CATEGORY_LABEL[s.category] : "—"} ·{" "}
                      {s.rounds}× {Math.round(s.workSeconds / 60)} min · Pause{" "}
                      {s.restSeconds}s
                    </div>
                  </div>
                  {/* Duration + time */}
                  <div className="text-right flex-shrink-0">
                    <div
                      className="font-display-ta font-bold"
                      style={{ fontSize: "16px", color: "var(--ta-pink)" }}
                    >
                      {formatMinutes(s.totalWorkSeconds)}
                    </div>
                    <div
                      className="font-mono-ta text-[9px] uppercase"
                      style={{ letterSpacing: "0.15em", color: "var(--fg-4)" }}
                    >
                      {formatRelative(s.completedAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
