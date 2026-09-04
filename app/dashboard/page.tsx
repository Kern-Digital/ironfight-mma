"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import AthleteTabBar from "@/components/AthleteTabBar";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import Icon from "@/components/ui/Icon";
import DashboardHero from "@/components/dashboard/DashboardHero";
import StatCard from "@/components/dashboard/StatCard";
import SectionCard from "@/components/dashboard/SectionCard";
import QuickAction from "@/components/dashboard/QuickAction";
import EmptyState from "@/components/dashboard/EmptyState";
import Reveal from "@/components/dashboard/Reveal";
import { useAuth, useHasStaffShell, useRights } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { dashboardGreetingFor, trainerGreetingFor } from "@/lib/greeting";
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
  WEEKDAY_SHORT,
} from "@/lib/schedule";
import type { TrainingBlock } from "@/lib/types";
import {
  listFightCamps,
  fightCampProgress,
  type FightCamp,
} from "@/lib/fight-camp";
import { getSessionCountForWeek } from "@/lib/training-sessions";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";

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

// ─── Streak-Kalender (Schüler-Dashboard, neues Token-System) ─────────────────

function StreakCalendar({ sessions }: { sessions: WorkoutSession[] }) {
  const today = new Date();
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 6 + i);
    return d;
  });

  const sessionDays = new Set(sessions.map((s) => s.completedAt.toDateString()));

  return (
    <div className="mt-1 flex gap-1.5">
      {weekDays.map((d, i) => {
        const isToday = d.toDateString() === today.toDateString();
        const done = sessionDays.has(d.toDateString());
        return (
          <div
            key={i}
            className="flex flex-1 flex-col items-center gap-1 rounded-badge py-2"
            style={{
              font: "var(--type-meta)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              background: done ? "var(--accent-subtle)" : "var(--surface-raised)",
              border: isToday ? "1px solid var(--accent)" : "1px solid transparent",
              color: done ? "var(--accent-text)" : "var(--text-3)",
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
            {WEEKDAY_SHORT[(d.getDay() + 6) % 7]}
          </div>
        );
      })}
    </div>
  );
}

// ─── Bausteine (neues Token-System) ──────────────────────────────────────────

function StatTile({
  label,
  value,
  unit,
  sub,
  subColor,
}: {
  label: string;
  value: string | null;
  unit?: string;
  sub?: string;
  subColor?: string;
}) {
  return (
    <div className="t-card flex flex-col gap-1 p-3.5">
      <span className="t-label">{label}</span>
      {value === null ? (
        <Skeleton className="h-8 w-16" />
      ) : (
        <span style={{ font: "var(--type-num-xl)", fontVariantNumeric: "tabular-nums" }}>
          {value}
          {unit && (
            <span style={{ font: "var(--type-h3)", color: "var(--text-3)" }}> {unit}</span>
          )}
        </span>
      )}
      {sub && (
        <span style={{ font: "var(--type-sub)", color: subColor ?? "var(--text-3)" }}>{sub}</span>
      )}
    </div>
  );
}

const LEVEL_LABEL: Record<string, string> = {
  kids: "Kids",
  teens: "Teens",
  adult: "Adult",
  mixed: "Mixed",
  advanced: "Advanced",
};

/** Nächste Kurse ab jetzt: heute ab Uhrzeit, danach die folgenden Tage. */
function upcomingBlocks(count: number): { block: TrainingBlock; dayShort: string }[] {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const result: { block: TrainingBlock; dayShort: string }[] = [];
  for (let offset = 0; offset < 7 && result.length < count; offset++) {
    const weekday = (getCurrentWeekday() + offset) % 7;
    for (const block of getBlocksForDay(weekday)) {
      if (offset === 0) {
        const [h, m] = block.startTime.split(":").map(Number);
        if (h * 60 + m < nowMinutes) continue;
      }
      result.push({ block, dayShort: WEEKDAY_SHORT[weekday] });
      if (result.length >= count) break;
    }
  }
  return result;
}

// ─── Schüler-Dashboard — Referenzseite des Redesigns (DESIGN-BRIEF §4.2) ─────

function DashboardContent() {
  const { user, profile, profileLoading } = useAuth();
  // Verwaltungsrecht OHNE Trainer-Haekchen: Diese Seite ist fuer sie der
  // einzige Einstieg, denn die Top-Navigation ist hier ausgeblendet
  // (AthleteChromeGate). Trainer/Admin landen gar nicht in diesem Dashboard.
  const isPureVerwaltung = useRights().verwaltung;
  // Dieselbe Person hat seit dem 01.09.2026 die Stab-Hülle um sich: Sidebar am
  // Desktop, Schublade und Bottom-Bar auf dem Handy. Diese Seite darf ihre
  // eigene Leiste und ihren Hell/Dunkel-Knopf dann NICHT auch noch rendern —
  // sonst stehen zwei Leisten übereinander. Für den Trainer stellt sich die
  // Frage nicht: der landet in TrainerDashboardContent.
  const hasStaffShell = useHasStaffShell();
  // Kein Gym: entweder von der Verwaltung entfernt (/api/members/remove setzt
  // den gymId-Claim auf null) oder ohne Einladung registriert (die Regeln
  // verbieten dem Client, sich selbst ein Gym zu setzen). Beides sah bisher
  // aus wie „drin, aber nichts los" — dabei fehlt schlicht die Zugehörigkeit.
  const hasNoGym = !profile?.gymId && !profileLoading;
  const { theme, toggleTheme } = useTheme();
  // Seed einmal pro Seitenaufruf würfeln — der Spruch bleibt bei Re-Renders
  // stabil, wechselt aber von Besuch zu Besuch.
  const greetingSeed = useRef(Math.random());
  const greeting = dashboardGreetingFor(profile?.displayName, greetingSeed.current);

  const [sessions, setSessions] = useState<WorkoutSession[] | null>(null);
  const [stats, setStats] = useState<WorkoutStats | null>(null);
  const [camps, setCamps] = useState<FightCamp[] | null>(null);
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

  useEffect(() => {
    if (!user) return;
    listFightCamps(user.uid)
      .then(setCamps)
      .catch(() => setCamps([]));
  }, [user]);

  const todayLabel = new Date()
    .toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })
    .replace(",", " ·");

  const nextCamp =
    camps
      ?.filter((c) => c.status === "active" && c.competitionDate.getTime() > Date.now())
      .sort((a, b) => a.competitionDate.getTime() - b.competitionDate.getTime())[0] ?? null;
  const campInfo = nextCamp ? fightCampProgress(nextCamp) : null;
  const campPct = campInfo ? Math.round(campInfo.ratio * 100) : 0;

  // Wochenlast (letzte 7 Tage) + Vergleich zur Vorwoche
  const nowMs = Date.now();
  const weekAgo = nowMs - 7 * 24 * 3600 * 1000;
  const twoWeeksAgo = nowMs - 14 * 24 * 3600 * 1000;
  const weekSeconds = sessions
    ? sessions
        .filter((s) => s.completedAt.getTime() >= weekAgo)
        .reduce((sum, s) => sum + (s.totalWorkSeconds || 0), 0)
    : null;
  const prevWeekSeconds = sessions
    ? sessions
        .filter((s) => {
          const t = s.completedAt.getTime();
          return t >= twoWeeksAgo && t < weekAgo;
        })
        .reduce((sum, s) => sum + (s.totalWorkSeconds || 0), 0)
    : 0;
  const weekDelta =
    weekSeconds !== null && prevWeekSeconds > 0
      ? Math.round(((weekSeconds - prevWeekSeconds) / prevWeekSeconds) * 100)
      : null;

  const nextBlocks = upcomingBlocks(4);

  return (
    <main
      className={hasStaffShell ? "min-h-screen pb-12" : "min-h-screen pb-32"}
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      {/* Kopfbereich mit Ambient-Schicht (nur hier — nie hinter Listen).
          Der Clip-Container umschließt NUR die Ambient-Ebene — läge er auf der
          Sektion, würde er den weichen Glass-Schatten der Hero-Karte an der
          Sektionskante hart abschneiden. */}
      <section className="relative">
        <div className="absolute inset-0 overflow-hidden" aria-hidden>
          <div data-ambient style={{ background: "var(--ambient)" }} />
        </div>
        <div className="relative mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-5 pt-6 lg:max-w-5xl lg:flex-row lg:items-center lg:justify-between lg:gap-8 lg:px-6 lg:pb-7 lg:pt-8">
          <div className="flex items-start gap-3 lg:flex-1">
            <div className="flex flex-1 flex-col gap-1">
              <span className="t-label">{todayLabel}</span>
              <h1
                style={{
                  font: "800 24px/1.15 var(--font-archivo), system-ui, sans-serif",
                  letterSpacing: "0.01em",
                }}
              >
                {greeting}
              </h1>
            </div>
            {/* Mobil: Umschalter rechts, oben an der Datumszeile, Liquid Glass.
                Desktop: sitzt stattdessen in der Bottom-Tab-Bar. In der
                Stab-Hülle steht er in der Fußgruppe der Sidebar. */}
            {!hasStaffShell && (
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

          <div className="lg:w-[400px] lg:shrink-0">
          {camps === null ? (
            <div className="t-glass p-4">
              <Skeleton className="h-24 w-full" />
            </div>
          ) : nextCamp && campInfo ? (
            <div className="t-glass flex flex-col gap-2.5 p-4">
              <span className="t-label">{nextCamp.competitionName}</span>
              <div className="flex items-baseline gap-2">
                <span style={{ font: "var(--type-num-xl)", fontVariantNumeric: "tabular-nums" }}>
                  {campInfo.daysRemaining}
                </span>
                <span style={{ font: "var(--type-h3)", color: "var(--text-2)" }}>
                  {campInfo.daysRemaining === 1 ? "Tag" : "Tage"} bis zum Kampf
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="t-label">Camp-Fortschritt</span>
                  <span
                    style={{
                      font: "var(--type-num)",
                      fontVariantNumeric: "tabular-nums",
                      color: "var(--text-2)",
                    }}
                  >
                    {campPct} %
                  </span>
                </div>
                <div className="t-progress">
                  <span style={{ width: `${campPct}%` }} />
                </div>
              </div>
            </div>
          ) : (
            <div className="t-glass flex flex-col gap-2.5 p-4">
              <span className="t-label">Trainings-Streak</span>
              {stats === null ? (
                <Skeleton className="h-9 w-24" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span style={{ font: "var(--type-num-xl)", fontVariantNumeric: "tabular-nums" }}>
                    {stats.streak}
                  </span>
                  <span style={{ font: "var(--type-h3)", color: "var(--text-2)" }}>
                    {stats.streak === 1 ? "Tag" : "Tage"} in Folge
                  </span>
                </div>
              )}
              {sessions !== null && <StreakCalendar sessions={sessions} />}
            </div>
          )}
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-1 lg:grid lg:max-w-5xl lg:grid-cols-2 lg:items-start lg:gap-6 lg:px-6">
        {hasNoGym && (
          <section className="flex flex-col gap-2 lg:col-span-2">
            <span className="t-label">Dein Gym</span>
            <div className="t-card flex items-start gap-3.5 p-4">
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: "var(--accent-subtle)",
                  color: "var(--accent-text)",
                }}
              >
                <Icon name="users" size={18} strokeWidth={2} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <span
                  style={{
                    font: "var(--type-body-strong)",
                    color: "var(--text-body)",
                  }}
                >
                  Du gehörst gerade zu keinem Gym
                </span>
                <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                  Deine Workouts, dein Verlauf und dein Kampfprofil bleiben dir
                  erhalten — Kursplan und Trainer-Inhalte kommen erst wieder
                  dazu, wenn du einem Gym beitrittst. Dafür brauchst du einen
                  Einladungscode.
                </span>
                <Link data-press
                  href="/beitreten"
                  className="t-interactive inline-flex min-h-hit items-center gap-2 self-start rounded-field px-4"
                  style={{
                    font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    background: "var(--accent)",
                    color: "var(--on-accent)",
                    boxShadow: "var(--accent-glow)",
                    textDecoration: "none",
                  }}
                >
                  Code eingeben
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Einstieg in die Gym-Verwaltung — nur fuer eine REINE Verwaltung
            (Verwaltungsrecht ohne Trainer-Haekchen). Trainer und Admins
            erreichen den Bereich ueber die Top-Navigation; sie sehen dieses
            Dashboard ohnehin nicht. */}
        {isPureVerwaltung && (
          <section className="flex flex-col gap-2 lg:col-span-2">
            <span className="t-label">Dein Gym</span>
            <Link data-press="surface"
              href="/verwaltung/mitglieder"
              className="t-card t-interactive flex items-center gap-3.5 p-4"
              style={{ textDecoration: "none" }}
            >
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: "var(--accent-subtle)",
                  color: "var(--accent-text)",
                }}
              >
                <Icon name="users" size={18} strokeWidth={2} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  style={{
                    font: "var(--type-body-strong)",
                    color: "var(--text-body)",
                  }}
                >
                  Gym verwalten
                </span>
                <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                  Mitglieder, Einladungen und Neuigkeiten deines Gyms.
                </span>
              </span>
              <span aria-hidden className="shrink-0" style={{ color: "var(--text-3)" }}>
                <Icon name="arrow-right" size={18} strokeWidth={2} />
              </span>
            </Link>
          </section>
        )}

        {error && (
          <div className="lg:col-span-2">
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

        {/* Kursplan */}
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="t-label">Kursplan</span>
            <Link href="/schedule" style={{ font: "var(--type-sub)", color: "var(--accent-text)" }}>
              Alle ansehen
            </Link>
          </div>
          <div className="t-card px-3.5 py-0.5">
            {nextBlocks.map(({ block, dayShort }, i) => (
              <div
                key={block.id}
                className="flex min-h-hit items-center gap-3 py-3"
                style={i > 0 ? { borderTop: "1px solid var(--line)" } : undefined}
              >
                <div className="flex w-16 shrink-0 flex-col gap-0.5">
                  <span className="t-label" style={{ fontSize: "9px", color: "var(--accent-text)" }}>
                    {dayShort}
                  </span>
                  <span
                    style={{
                      font: "600 13px/1.2 var(--font-mono), ui-monospace, monospace",
                      color: "var(--accent-text)",
                    }}
                  >
                    {block.startTime}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate" style={{ font: "var(--type-body-strong)" }}>
                    {block.title}
                  </span>
                  <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                    {block.startTime}–{block.endTime}
                  </span>
                </div>
                {block.level && (
                  <span
                    className="inline-flex shrink-0 items-center gap-1.5"
                    style={{
                      font: "var(--type-meta)",
                      letterSpacing: "var(--ls-label)",
                      textTransform: "uppercase",
                      color: "var(--text-3)",
                    }}
                  >
                    <span
                      className="h-[5px] w-[5px] rounded-full"
                      style={{ background: "currentColor" }}
                    />
                    {LEVEL_LABEL[block.level] ?? block.level}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Trainingsfortschritt */}
        <section className="flex flex-col gap-2">
          <span className="t-label">Trainingsfortschritt</span>
          <div className="grid grid-cols-2 gap-2.5">
            <StatTile
              label="Wochenlast"
              value={
                weekSeconds === null
                  ? null
                  : (weekSeconds / 3600).toLocaleString("de-DE", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })
              }
              unit="h"
              sub={
                weekDelta === null
                  ? "letzte 7 Tage"
                  : `${weekDelta >= 0 ? "+" : ""}${weekDelta} % ggü. Vorwoche`
              }
              subColor={
                weekDelta === null
                  ? undefined
                  : weekDelta >= 0
                  ? "var(--positive)"
                  : "var(--negative)"
              }
            />
            <StatTile
              label="Sessions"
              value={stats ? String(stats.thisWeek) : null}
              sub="letzte 7 Tage"
            />
            <StatTile label="Workouts gesamt" value={stats ? String(stats.total) : null} />
            <StatTile
              label="Trainingszeit"
              value={stats ? formatHours(stats.totalSeconds) : null}
              sub="gesamt"
            />
          </div>
          {nextCamp && (
            <div className="t-card flex flex-col gap-2 p-3.5">
              <div className="flex items-baseline justify-between">
                <span className="t-label">Trainings-Streak</span>
                {stats !== null && (
                  <span
                    style={{
                      font: "var(--type-num)",
                      fontVariantNumeric: "tabular-nums",
                      color: "var(--text-2)",
                    }}
                  >
                    {stats.streak} {stats.streak === 1 ? "Tag" : "Tage"}
                  </span>
                )}
              </div>
              {sessions !== null && <StreakCalendar sessions={sessions} />}
            </div>
          )}
        </section>

        {/* Schnell-Start */}
        <section className="flex flex-col gap-2">
          <span className="t-label">Schnell-Start</span>
          <div className="t-card px-3.5 py-0.5">
            {[
              {
                href: "/workout/generator",
                icon: "spark" as const,
                title: "Auto-Workout",
                sub: "Generator",
              },
              { href: "/timer", icon: "timer" as const, title: "Timer", sub: "Runden & Pausen" },
              { href: "/techniques", icon: "book" as const, title: "Techniken", sub: "Bibliothek" },
            ].map((a, i) => (
              <Fragment key={a.href}>
              {/* Trennlinie als eigenes Element — border-top auf der gerundeten
                  Zeile würde die Linienenden mitrunden */}
              {i > 0 && (
                <div aria-hidden style={{ height: "1px", background: "var(--line)" }} />
              )}
              <Link data-press="quiet"
                href={a.href}
                className="t-interactive flex min-h-hit items-center gap-3 rounded-badge py-3"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <span style={{ color: "var(--accent-text)" }}>
                  <Icon name={a.icon} size={20} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span style={{ font: "var(--type-body-strong)" }}>{a.title}</span>
                  <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>{a.sub}</span>
                </div>
              </Link>
              </Fragment>
            ))}
          </div>
        </section>

        {/* Letzte Trainings — Klick auf einen Eintrag führt in den vollen
            Verlauf (/workout/verlauf); „Neue Session" ist raus (Leon
            2026-08-28) */}
        <section className="flex flex-col gap-2">
          <span className="t-label">Letzte Trainings</span>
          <div className="t-card px-3.5 py-0.5">
            {sessions === null && !error && (
              <div className="flex flex-col gap-2 py-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            )}
            {sessions && sessions.length === 0 && !error && (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <span style={{ font: "var(--type-body-strong)" }}>Noch keine Sessions.</span>
                <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                  Starte dein erstes Training über den Generator oder die Trainingspläne.
                </span>
                <Link data-press
                  href="/workout/generator"
                  className="t-interactive mt-2 inline-flex min-h-hit items-center justify-center rounded-field px-5"
                  style={{
                    background: "var(--accent)",
                    color: "var(--on-accent)",
                    boxShadow: "var(--accent-glow)",
                    font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    textDecoration: "none",
                  }}
                >
                  Workout starten
                </Link>
              </div>
            )}
            {sessions &&
              sessions.length > 0 &&
              sessions.slice(0, 6).map((s, i) => (
                <Link data-press="quiet"
                  key={s.id}
                  href="/workout/verlauf"
                  className="t-interactive flex min-h-hit items-center gap-3 py-3"
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    ...(i > 0 ? { borderTop: "1px solid var(--line)" } : {}),
                  }}
                >
                  <div className="w-11 shrink-0 text-center leading-tight">
                    <span
                      className="block"
                      style={{
                        font: "700 18px/1.1 var(--font-archivo), system-ui, sans-serif",
                        fontVariantNumeric: "tabular-nums",
                        color: "var(--accent-text)",
                      }}
                    >
                      {s.completedAt.getDate()}
                    </span>
                    <span className="t-label" style={{ fontSize: "9px" }}>
                      {s.completedAt.toLocaleDateString("de-DE", { month: "short" })}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate" style={{ font: "var(--type-body-strong)" }}>
                      {s.label ?? "Freies Workout"}
                    </span>
                    <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                      {s.category ? CATEGORY_LABEL[s.category] : "—"} · {s.rounds}×{" "}
                      {Math.round(s.workSeconds / 60)} min
                      {s.status === "aborted" && (
                        <span style={{ color: "var(--negative)" }}> · abgebrochen</span>
                      )}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className="block"
                      style={{
                        font: "var(--type-num)",
                        fontVariantNumeric: "tabular-nums",
                        color: "var(--text-2)",
                      }}
                    >
                      {formatMinutes(s.totalWorkSeconds)}
                    </span>
                    <span style={{ font: "var(--type-sub)", fontSize: "11px", color: "var(--text-3)" }}>
                      {formatRelative(s.completedAt)}
                    </span>
                  </div>
                </Link>
              ))}
          </div>
        </section>
      </div>

      {!hasStaffShell && <AthleteTabBar />}
    </main>
  );
}

// ─── Trainer-Dashboard ────────────────────────────────────────────────────────

function TrainerDashboardContent() {
  const { user, profile } = useAuth();
  const greeting = trainerGreetingFor(profile?.displayName);
  const isAdmin = useRights().admin;

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
                  title="Kursplan"
                  sub="Deine Woche & Übungen"
                  accent="var(--ta-pink)"
                />
                <QuickAction
                  href="/trainer"
                  icon="trophy"
                  title="Wettkampf"
                  sub="Athleten · DeepFight"
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

        {/* Heutiger Kursplan */}
        <Reveal>
          <SectionCard
            title="Heute im Gym"
            eyebrow={WEEKDAY_LABELS[todayWeekday]}
            icon="calendar"
            accent="var(--ta-cyan)"
            moreHref="/schedule"
            moreLabel="Ganze Woche"
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
  const { profileLoading } = useAuth();
  // VOR dem frühen Return: Hooks laufen bei jedem Render, sonst bricht die
  // Reihenfolge, sobald das Profil fertig geladen ist.
  const rights = useRights();

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

  const isTrainer = rights.trainer;

  return isTrainer ? <TrainerDashboardContent /> : <DashboardContent />;
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardRouter />
    </ProtectedRoute>
  );
}
