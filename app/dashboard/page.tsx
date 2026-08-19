"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import Icon from "@/components/ui/Icon";
import DashboardHero from "@/components/dashboard/DashboardHero";
import StatCard from "@/components/dashboard/StatCard";
import SectionCard from "@/components/dashboard/SectionCard";
import QuickAction from "@/components/dashboard/QuickAction";
import EmptyState from "@/components/dashboard/EmptyState";
import Reveal from "@/components/dashboard/Reveal";
import { useAuth } from "@/lib/auth-context";
import { greetingFor, trainerGreetingFor } from "@/lib/greeting";
import { CATEGORY_LABEL } from "@/lib/techniques";
import { getTopTechniques, type TechniqueStatEntry } from "@/lib/technique-analytics";
import { getTechniqueById } from "@/lib/techniques";
import {
  computeStats,
  getRecentWorkouts,
  type WorkoutSession,
  type WorkoutStats,
} from "@/lib/workouts";
import {
  TRAINING_BLOCKS,
  getBlocksForDay,
  getCurrentWeekday,
  getWeekIdentifier,
  WEEKDAY_LABELS,
} from "@/lib/schedule";
import { getSessionCountForWeek } from "@/lib/training-sessions";
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

// ─── Streak-Kalender (Schüler-Dashboard) ─────────────────────────────────────

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
            className={`rise-${Math.min(i + 1, 6)} flex flex-1 flex-col items-center gap-1 rounded-xl py-2 font-mono-ta text-[9px] uppercase`}
            style={{
              letterSpacing: "0.1em",
              background: isToday
                ? "rgba(255,79,168,.14)"
                : done
                ? "rgba(35,196,206,.12)"
                : "rgba(255,255,255,.03)",
              border: isToday
                ? "1px solid rgba(255,79,168,.45)"
                : done
                ? "1px solid rgba(35,196,206,.4)"
                : "1px solid var(--ink-4)",
              color: isToday ? "var(--ta-pink)" : done ? "var(--ta-cyan)" : "var(--fg-4)",
            }}
          >
            {done ? (
              <Icon name="check" size={11} strokeWidth={2.6} />
            ) : (
              <span
                className="block h-[11px] w-[11px] rounded-full"
                style={{ border: "1.5px solid currentColor", opacity: 0.4 }}
              />
            )}
            {days[(d.getDay() + 6) % 7]}
          </div>
        );
      })}
    </div>
  );
}

// ─── Schüler-Dashboard ────────────────────────────────────────────────────────

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

  const todayLabel = new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <main className="min-h-screen">
      <DashboardHero
        badges={[{ label: "Athlet", accent: "cyan", icon: "wave" }]}
        accent="cyan"
        title={greeting}
        subtitle={`Mein Training · ${todayLabel}`}
      />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
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

        {/* Streak-Hero + Schnell-Start */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Reveal className="lg:col-span-2">
            <div
              className="card-glass relative h-full overflow-hidden"
              style={{ borderColor: "rgba(35,196,206,.18)" }}
            >
              <div
                className="pointer-events-none absolute right-[-30px] top-[-30px] h-56 w-56 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, rgba(35,196,206,.14), transparent 60%)",
                }}
              />
              <div className="flex items-center gap-2">
                <span style={{ color: "var(--ta-cyan)" }}>
                  <Icon name="flame" size={16} />
                </span>
                <span
                  className="font-mono-ta text-[10px] uppercase"
                  style={{ letterSpacing: "0.25em", color: "var(--fg-3)" }}
                >
                  Trainings-Streak
                </span>
              </div>
              {stats === null ? (
                <Skeleton className="mt-2 h-16 w-24" />
              ) : (
                <div
                  className="font-display-ta mt-1 font-black leading-none"
                  style={{
                    fontSize: "68px",
                    color: "var(--ta-cyan)",
                    textShadow: "0 0 24px rgba(35,196,206,.35)",
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
              {sessions !== null && <StreakCalendar sessions={sessions} />}
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <SectionCard
              title="Schnell-Start"
              icon="spark"
              accent="var(--ta-pink)"
              className="h-full"
            >
              <div className="flex flex-col gap-2">
                <QuickAction
                  href="/workout/generator"
                  icon="spark"
                  title="Auto-Workout"
                  sub="Generator"
                  accent="var(--ta-cyan)"
                />
                <QuickAction
                  href="/timer"
                  icon="timer"
                  title="Timer"
                  sub="Runden & Pausen"
                  accent="var(--ta-pink)"
                />
                <QuickAction
                  href="/techniques"
                  icon="book"
                  title="Techniken"
                  sub="Bibliothek"
                  accent="var(--ta-cyan)"
                />
              </div>
            </SectionCard>
          </Reveal>
        </div>

        {/* Statistiken */}
        <Reveal delay={0.05}>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Diese Woche"
              icon="calendar"
              value={stats ? String(stats.thisWeek) : null}
              hint="Einheiten"
            />
            <StatCard
              label="Streak"
              icon="flame"
              accent="var(--ta-pink)"
              value={
                stats
                  ? `${stats.streak} ${stats.streak === 1 ? "Tag" : "Tage"}`
                  : null
              }
            />
            <StatCard
              label="Workouts gesamt"
              icon="chart"
              value={stats ? String(stats.total) : null}
            />
            <StatCard
              label="Trainingszeit"
              icon="timer"
              accent="var(--ta-pink)"
              value={stats ? formatHours(stats.totalSeconds) : null}
            />
          </div>
        </Reveal>

        {/* Lieblings-Disziplin + Verlauf */}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Reveal>
            <SectionCard
              title="Lieblings-Disziplin"
              icon="target"
              accent="var(--ta-cyan)"
              className="h-full"
            >
              {stats === null ? (
                <Skeleton className="h-8 w-32" />
              ) : stats.topCategory ? (
                <div>
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
                    className="font-mono-ta mt-1 text-[10px]"
                    style={{ letterSpacing: "0.15em", color: "var(--fg-3)" }}
                  >
                    {stats.topCategory.count} Sessions
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon="target"
                  title="Noch keine Daten"
                  hint="Starte dein erstes Workout, um Statistiken zu sammeln."
                />
              )}
            </SectionCard>
          </Reveal>

          {/* Session history */}
          <Reveal delay={0.06} className="lg:col-span-2">
            <SectionCard
              title="Letzte Trainings"
              icon="chart"
              accent="var(--ta-pink)"
              moreHref="/workout/generator"
              moreLabel="Neue Session"
              className="h-full"
            >
              {sessions === null && !error && (
                <div className="flex flex-col gap-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              )}

              {sessions && sessions.length === 0 && !error && (
                <EmptyState
                  icon="glove"
                  title="Noch keine Sessions."
                  hint="Starte dein erstes Training über den Generator oder die Trainingspläne."
                >
                  <Link href="/workout/generator" className="btn-primary px-4 py-2 text-xs">
                    Workout starten
                  </Link>
                </EmptyState>
              )}

              {sessions && sessions.length > 0 && (
                <div className="flex flex-col gap-2">
                  {sessions.slice(0, 10).map((s, idx) => (
                    <div
                      key={s.id}
                      className={`rise-${Math.min(idx + 1, 6)} flex items-center gap-3 py-2`}
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
                                border: "1px solid rgba(255,79,168,.3)",
                                background: "rgba(255,79,168,.08)",
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
            </SectionCard>
          </Reveal>
        </div>
      </div>
    </main>
  );
}

// ─── Trainer-Dashboard ────────────────────────────────────────────────────────

function TrainerDashboardContent() {
  const { user, profile } = useAuth();
  const greeting = trainerGreetingFor(profile?.displayName);
  const isAdmin = profile?.role === "admin";

  const weekId = getWeekIdentifier();
  const todayWeekday = getCurrentWeekday();
  const todayBlocks = getBlocksForDay(todayWeekday);

  const [topTechniques, setTopTechniques] = useState<TechniqueStatEntry[] | null>(null);
  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setError(null);

    Promise.all([
      getTopTechniques(10),
      getSessionCountForWeek(weekId),
    ])
      .then(([techniques, count]) => {
        setTopTechniques(techniques);
        setSessionCount(count);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Daten konnten nicht geladen werden";
        setError(msg);
        setTopTechniques([]);
        setSessionCount(0);
      });
  }, [user, weekId]);

  const today = new Date();
  const todayLabel = today.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const badges: { label: string; accent: "pink" | "amber"; icon?: "users" | "shield" }[] = [
    { label: "Trainer", accent: "pink", icon: "users" },
  ];
  if (isAdmin) badges.push({ label: "Admin", accent: "amber", icon: "shield" });

  return (
    <main className="min-h-screen">
      <DashboardHero
        badges={badges}
        accent="pink"
        title={greeting}
        subtitle={`Trainer-Dashboard · ${todayLabel}`}
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {error && (
          <div className="mb-6">
            <ErrorState
              title="Daten konnten nicht geladen werden"
              message={error}
              hint="Prüfe deine Internetverbindung und lade die Seite neu."
              onRetry={() => {
                setTopTechniques(null);
                setSessionCount(null);
                setError(null);
                if (!user) return;
                Promise.all([getTopTechniques(10), getSessionCountForWeek(weekId)])
                  .then(([t, c]) => { setTopTechniques(t); setSessionCount(c); })
                  .catch(() => { setTopTechniques([]); setSessionCount(0); });
              }}
            />
          </div>
        )}

        {/* KPI-Kacheln */}
        <Reveal>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard
              label="Einheiten diese Woche"
              icon="calendar"
              accent="var(--ta-pink)"
              value={sessionCount !== null ? String(sessionCount) : null}
            />
            <StatCard
              label="Trainingsblöcke"
              icon="clipboard"
              value={String(TRAINING_BLOCKS.length)}
            />
            <StatCard
              label="Heute"
              icon="timer"
              accent={todayBlocks.length > 0 ? "var(--ta-cyan)" : "var(--fg-4)"}
              value={todayBlocks.length > 0 ? `${todayBlocks.length} Kurs${todayBlocks.length !== 1 ? "e" : ""}` : "Frei"}
            />
            <StatCard
              label="Top Techniken"
              icon="chart"
              value={topTechniques !== null ? String(topTechniques.length) : null}
            />
          </div>
        </Reveal>

        {/* Hauptbereich: Techniken-Ranking + Quick Actions */}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">

          {/* Meistangesehene Techniken — 2 Spalten */}
          <Reveal className="lg:col-span-2">
            <SectionCard
              title="Meistangesehene Techniken"
              eyebrow="Aggregiert · Anonym"
              icon="chart"
              accent="var(--ta-cyan)"
              moreHref="/techniques"
              className="h-full"
            >
              {topTechniques === null && (
                <div className="space-y-2">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              )}

              {topTechniques !== null && topTechniques.length === 0 && (
                <EmptyState
                  icon="chart"
                  title="Noch keine Aufrufdaten vorhanden."
                  hint="Sobald Techniken aufgerufen werden, erscheinen sie hier."
                />
              )}

              {topTechniques !== null && topTechniques.length > 0 && (
                <div className="space-y-1.5">
                  {topTechniques.map((entry, idx) => {
                    const technique = getTechniqueById(entry.id);
                    const isTop3 = idx < 3;
                    const rankColor =
                      idx === 0 ? "var(--ta-cyan)" : idx === 1 ? "var(--ta-pink)" : idx === 2 ? "var(--fg-2)" : "var(--fg-4)";
                    return (
                      <Link
                        key={entry.id}
                        href={`/techniques/${entry.id}`}
                        className={`rise-${Math.min(idx + 1, 6)} flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[.03]`}
                        style={{
                          background: isTop3 ? "rgba(255,255,255,.03)" : "transparent",
                          border: isTop3 ? "1px solid var(--ink-4)" : "1px solid transparent",
                          textDecoration: "none",
                        }}
                      >
                        {/* Rang */}
                        <span
                          className="font-display-ta w-6 shrink-0 text-center font-black leading-none"
                          style={{ fontSize: "18px", color: rankColor }}
                        >
                          {idx + 1}
                        </span>
                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <div
                            className="font-bold truncate text-sm"
                            style={{ color: "var(--fg)" }}
                          >
                            {technique?.name ?? entry.id}
                          </div>
                          {technique && (
                            <div
                              className="font-mono-ta text-[9px] uppercase mt-0.5"
                              style={{ letterSpacing: "0.1em", color: "var(--fg-4)" }}
                            >
                              {technique.category}
                            </div>
                          )}
                        </div>
                        {/* View-Count */}
                        <div className="shrink-0 text-right">
                          <span
                            className="font-mono-ta font-bold"
                            style={{ fontSize: "15px", color: isTop3 ? "var(--ta-cyan)" : "var(--fg-3)" }}
                          >
                            {entry.viewCount}
                          </span>
                          <div
                            className="font-mono-ta text-[8px] uppercase"
                            style={{ letterSpacing: "0.15em", color: "var(--fg-4)" }}
                          >
                            Aufrufe
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </Reveal>

          {/* Trainer Quick-Zugriff */}
          <Reveal delay={0.08}>
            <SectionCard
              title="Verwalten"
              icon="clipboard"
              accent="var(--ta-pink)"
              className="h-full"
            >
              <div className="flex flex-col gap-2">
                <QuickAction
                  href="/schedule"
                  icon="calendar"
                  title="Stundenplan"
                  sub="Wochenplan & Übungen"
                  accent="var(--ta-pink)"
                />
                <QuickAction
                  href="/trainer"
                  icon="trophy"
                  title="Wettkampf"
                  sub="Schüler · DeepFight"
                  accent="var(--ta-cyan)"
                />
                <QuickAction
                  href="/techniques"
                  icon="book"
                  title="Techniken"
                  sub="Bibliothek"
                  accent="var(--ta-cyan)"
                />
                <QuickAction
                  href="/workout/generator"
                  icon="spark"
                  title="Generator"
                  sub="Workout erstellen"
                  accent="var(--ta-pink)"
                />
              </div>
            </SectionCard>
          </Reveal>
        </div>

        {/* Heutiger Stundenplan */}
        <Reveal>
          <SectionCard
            title="Heutiger Stundenplan"
            eyebrow={WEEKDAY_LABELS[todayWeekday]}
            icon="calendar"
            accent="var(--ta-cyan)"
            moreHref="/schedule"
            moreLabel="Wochenplan"
            className="mt-4"
          >
            {todayBlocks.length === 0 ? (
              <EmptyState icon="calendar" title="Heute keine Kurse geplant." />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {todayBlocks.map((block, idx) => (
                  <Link
                    key={block.id}
                    href="/schedule"
                    className={`rise-${Math.min(idx + 1, 6)} card-interactive rounded-xl px-4 py-3`}
                    style={{
                      background: "rgba(255,255,255,.02)",
                      border: "1px solid var(--ink-4)",
                      textDecoration: "none",
                    }}
                  >
                    <div
                      className="font-mono-ta text-[10px]"
                      style={{ color: "var(--ta-cyan)", letterSpacing: "0.08em" }}
                    >
                      {block.startTime}–{block.endTime}
                    </div>
                    <div
                      className="font-display-ta mt-0.5 font-bold uppercase"
                      style={{ fontSize: "14px", letterSpacing: "0.04em", color: "var(--fg)" }}
                    >
                      {block.title}
                    </div>
                    {block.level && (
                      <div
                        className="font-mono-ta mt-1 text-[9px] uppercase"
                        style={{ letterSpacing: "0.1em", color: "var(--fg-4)" }}
                      >
                        {block.level}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </Reveal>
      </div>
    </main>
  );
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

function DashboardRouter() {
  const { profile, profileLoading } = useAuth();

  if (profileLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const isTrainer =
    profile?.role === "trainer" || profile?.role === "admin";

  return isTrainer ? <TrainerDashboardContent /> : <DashboardContent />;
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardRouter />
    </ProtectedRoute>
  );
}
