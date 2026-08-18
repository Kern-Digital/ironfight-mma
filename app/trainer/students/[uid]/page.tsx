"use client";

import TrainerHint from "@/components/TrainerHint";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import AreaCoverageChart from "@/components/trainer/AreaCoverageChart";
import CompetitionCard, {
  competitionGroup,
} from "@/components/trainer/CompetitionCard";
import MatchupBlock from "@/components/trainer/MatchupBlock";
import VideoAnalysisSection from "@/components/trainer/VideoAnalysisSection";
import { getStudentEntry, type StudentEntry } from "@/lib/admin";
import { getRecentWorkouts, type WorkoutSession } from "@/lib/workouts";
import { getAllProgress } from "@/lib/extensions/technique-progress";
import {
  analyzeTrainingHistory,
  type TrainingHistoryAnalysis,
} from "@/lib/fight-camp-analysis";
import {
  ATHLETE_LEVEL_LABEL,
  BJJ_BELT_LABEL,
  DISCIPLINE_LABEL,
  TRAINING_AREA_LABEL,
  WEIGHT_CLASS_LABEL,
  type TechniqueProgress,
} from "@/lib/types";
import { listFightCamps, type FightCamp } from "@/lib/fight-camp";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const CATEGORY_LABEL: Record<string, string> = {
  boxing: "Boxing",
  wrestling: "Wrestling",
  bjj: "BJJ",
  "muay-thai": "Muay Thai",
};

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function initialsOf(entry: StudentEntry): string {
  const name =
    entry.displayName ?? entry.authProviderName ?? entry.email ?? "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function displayLabel(entry: StudentEntry): string {
  return (
    entry.displayName ?? entry.authProviderName ?? entry.email ?? entry.uid
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div
      className="rounded-xl px-3 py-3 text-center"
      style={{ background: "var(--ink-3)", border: "1px solid var(--ink-4)" }}
    >
      <div
        className="font-display-ta text-base font-black"
        style={{ color: accent ?? "var(--ta-cyan)" }}
      >
        {value}
      </div>
      <div
        className="font-mono-ta mt-1 text-[9px] uppercase"
        style={{ letterSpacing: "0.15em", color: "var(--fg-4)" }}
      >
        {label}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5"
      style={{ background: "var(--ink-3)", border: "1px solid var(--ink-4)" }}
    >
      <dt
        className="font-mono-ta text-[9px] uppercase"
        style={{ letterSpacing: "0.12em", color: "var(--fg-4)" }}
      >
        {label}
      </dt>
      <dd
        className="truncate text-right text-[12px] font-bold"
        style={{ color: "var(--fg-2)" }}
      >
        {value}
      </dd>
    </div>
  );
}

function StudentDetailContent({ uid }: { uid: string }) {
  const [entry, setEntry] = useState<StudentEntry | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutSession[] | null>(null);
  const [progress, setProgress] = useState<TechniqueProgress[] | null>(null);
  const [camps, setCamps] = useState<FightCamp[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setEntry(null);
    setWorkouts(null);
    setProgress(null);
    setCamps(null);
    try {
      const [e, w, p, c] = await Promise.all([
        getStudentEntry(uid),
        getRecentWorkouts(uid, 500),
        getAllProgress(uid).catch(() => [] as TechniqueProgress[]),
        listFightCamps(uid).catch(() => [] as FightCamp[]),
      ]);
      if (!e) throw new Error("Schüler nicht gefunden");
      setEntry(e);
      setWorkouts(w);
      setProgress(p);
      setCamps(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    }
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  const analysis = useMemo<TrainingHistoryAnalysis | null>(() => {
    if (workouts === null || progress === null) return null;
    return analyzeTrainingHistory(workouts, progress);
  }, [workouts, progress]);

  // Nächster anstehender Wettkampf — Basis für den Matchup-Block.
  const nextCamp = useMemo(() => {
    const upcoming = (camps ?? []).filter(
      (c) => competitionGroup(c) === "upcoming",
    );
    upcoming.sort(
      (a, b) => a.competitionDate.getTime() - b.competitionDate.getTime(),
    );
    return upcoming[0] ?? null;
  }, [camps]);

  if (error && !entry) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <ErrorState
          title="Schüler konnte nicht geladen werden"
          message={error}
          onRetry={load}
        />
      </div>
    );
  }

  if (!entry || !analysis) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const athlete = entry.athlete;
  const competitionPersona =
    athlete?.nextCompetitionDate &&
    athlete.nextCompetitionDate.getTime() > Date.now();

  return (
    <main className="min-h-screen" style={{ background: "var(--ink-1)" }}>
      {/* Header */}
      <div
        className="relative overflow-hidden border-b px-4 py-8 sm:px-6"
        style={{
          borderColor: "rgba(35,196,206,0.2)",
          background:
            "radial-gradient(500px 250px at 100% 50%, rgba(35,196,206,0.12), transparent 60%), linear-gradient(160deg, #0B0716, #080512)",
        }}
      >
        <div className="mx-auto max-w-7xl">
          <Link
            href="/trainer/students"
            className="font-mono-ta text-[10px] uppercase"
            style={{ letterSpacing: "0.2em", color: "var(--fg-4)" }}
          >
            ← Schülerliste
          </Link>
          <div className="mt-3 flex items-start gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl font-display-ta text-lg font-black"
              style={{
                background: "rgba(35,196,206,0.1)",
                border: "1px solid rgba(35,196,206,0.4)",
                color: "var(--ta-cyan)",
              }}
            >
              {initialsOf(entry)}
            </div>
            <div className="min-w-0 flex-1">
              <h1
                className="font-display-ta font-black uppercase leading-none"
                style={{
                  fontSize: "clamp(24px, 4vw, 36px)",
                  letterSpacing: "0.02em",
                }}
              >
                {displayLabel(entry)}
              </h1>
              <p
                className="font-mono-ta mt-2 text-[11px]"
                style={{ letterSpacing: "0.2em", color: "var(--fg-4)" }}
              >
                {entry.email ?? "—"} · Seit {formatDate(entry.createdAt)}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {athlete?.primaryDiscipline && (
                  <span
                    className="font-mono-ta rounded px-1.5 py-0.5 text-[10px] uppercase"
                    style={{
                      letterSpacing: "0.12em",
                      background: "rgba(35,196,206,0.1)",
                      border: "1px solid rgba(35,196,206,0.3)",
                      color: "var(--ta-cyan)",
                    }}
                  >
                    {DISCIPLINE_LABEL[athlete.primaryDiscipline]}
                  </span>
                )}
                {athlete?.level && (
                  <span
                    className="font-mono-ta rounded px-1.5 py-0.5 text-[10px] uppercase"
                    style={{
                      letterSpacing: "0.12em",
                      background: "var(--ink-4)",
                      border: "1px solid var(--ink-5)",
                      color: "var(--fg-3)",
                    }}
                  >
                    {ATHLETE_LEVEL_LABEL[athlete.level]}
                  </span>
                )}
                {athlete?.weightClass && (
                  <span
                    className="font-mono-ta rounded px-1.5 py-0.5 text-[10px] uppercase"
                    style={{
                      letterSpacing: "0.12em",
                      background: "var(--ink-4)",
                      border: "1px solid var(--ink-5)",
                      color: "var(--fg-3)",
                    }}
                  >
                    {WEIGHT_CLASS_LABEL[athlete.weightClass]}
                  </span>
                )}
                {competitionPersona && (
                  <span
                    className="font-mono-ta rounded px-1.5 py-0.5 text-[10px] uppercase"
                    style={{
                      letterSpacing: "0.12em",
                      background: "rgba(255,79,168,0.1)",
                      border: "1px solid rgba(255,79,168,0.4)",
                      color: "var(--ta-pink)",
                    }}
                  >
                    Wettkampf geplant
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <TrainerHint id="student-detail" title="Schüler-Detail">
          Hier siehst du das volle Athleten-Profil und die Trainings-Analyse aus
          der App-Historie. Wettkämpfe inkl. Gegner-DNA werden zentral im
          Wettkampfbereich verwaltet — unten kannst du direkt einen neuen
          Wettkampf für diesen Schüler anlegen.
        </TrainerHint>

        {/* KPI-Kacheln */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Workouts" value={analysis.totalWorkouts} />
          <Stat
            label="Trainingszeit"
            value={`${analysis.totalTrainingHours}h`}
          />
          <Stat
            label="∅ pro Woche"
            value={analysis.workoutsPerWeek}
            accent="var(--ta-pink)"
          />
          <Stat
            label="Wochen aktiv"
            value={analysis.weeksTracked}
            accent="#8A63E8"
          />
        </div>

        {/* Layout: Profil + Analyse nebeneinander */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Profil */}
          <div
            className="rounded-2xl p-5"
            style={{
              background: "linear-gradient(180deg, var(--ink-3), var(--ink-2))",
              border: "1px solid var(--ink-4)",
            }}
          >
            <h2
              className="font-display-ta font-black uppercase"
              style={{ fontSize: "16px", letterSpacing: "0.06em" }}
            >
              Athleten-Profil
            </h2>
            <dl className="mt-3 flex flex-col gap-1.5 text-xs">
              {athlete?.primaryDiscipline && (
                <Row
                  label="Disziplin"
                  value={DISCIPLINE_LABEL[athlete.primaryDiscipline]}
                />
              )}
              {athlete?.level && (
                <Row
                  label="Level"
                  value={ATHLETE_LEVEL_LABEL[athlete.level]}
                />
              )}
              {athlete?.bjjBelt && (
                <Row
                  label="BJJ-Gurt"
                  value={BJJ_BELT_LABEL[athlete.bjjBelt]}
                />
              )}
              {athlete?.weightClass && (
                <Row
                  label="Gewichtsklasse"
                  value={WEIGHT_CLASS_LABEL[athlete.weightClass]}
                />
              )}
              {athlete?.weightKg != null && (
                <Row label="Gewicht" value={`${athlete.weightKg} kg`} />
              )}
              {athlete?.heightCm != null && (
                <Row label="Größe" value={`${athlete.heightCm} cm`} />
              )}
              {athlete?.gymName && <Row label="Gym" value={athlete.gymName} />}
              {athlete?.trainerName && (
                <Row label="Coach" value={athlete.trainerName} />
              )}
              {athlete?.trainingStartDate && (
                <Row
                  label="Trainiert seit"
                  value={formatDate(athlete.trainingStartDate)}
                />
              )}
              {athlete?.nextCompetitionDate && (
                <Row
                  label="Nächster Wettkampf"
                  value={`${formatDate(athlete.nextCompetitionDate)}${athlete.nextCompetitionName ? ` — ${athlete.nextCompetitionName}` : ""}`}
                />
              )}
            </dl>

            {/* Technique progress aggregate */}
            <div className="mt-4">
              <div
                className="font-mono-ta mb-2 text-[10px] font-bold uppercase"
                style={{ letterSpacing: "0.18em", color: "var(--fg-3)" }}
              >
                Technik-Fortschritt
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Stat
                  label="Gemeistert"
                  value={analysis.technique.mastered}
                  accent="var(--ta-cyan)"
                />
                <Stat
                  label="Geübt"
                  value={analysis.technique.practiced}
                />
                <Stat label="Gelernt" value={analysis.technique.learned} />
                <Stat
                  label="Gesamt"
                  value={analysis.technique.total}
                  accent="#8A63E8"
                />
              </div>
            </div>
          </div>

          {/* Category-Verteilung + Stärken/Schwächen */}
          <div
            className="rounded-2xl p-5 lg:col-span-2"
            style={{
              background: "linear-gradient(180deg, var(--ink-3), var(--ink-2))",
              border: "1px solid var(--ink-4)",
            }}
          >
            <h2
              className="font-display-ta font-black uppercase"
              style={{ fontSize: "16px", letterSpacing: "0.06em" }}
            >
              Trainings-Analyse
            </h2>

            {/* Category Distribution */}
            <div className="mt-3">
              <div
                className="font-mono-ta mb-2 text-[10px] font-bold uppercase"
                style={{ letterSpacing: "0.18em", color: "var(--fg-3)" }}
              >
                Verteilung nach Disziplin
              </div>
              <div className="flex flex-col gap-1">
                {analysis.categoryDistribution.map((c) => (
                  <div key={c.category} className="flex items-center gap-2">
                    <div
                      className="font-mono-ta w-24 text-[10px] uppercase"
                      style={{
                        letterSpacing: "0.12em",
                        color: "var(--fg-3)",
                      }}
                    >
                      {CATEGORY_LABEL[c.category]}
                    </div>
                    <div
                      className="flex-1 overflow-hidden rounded-full"
                      style={{
                        height: "8px",
                        background: "var(--ink-3)",
                        border: "1px solid var(--ink-5)",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.round(c.shareOfTotal * 100)}%`,
                          background: "var(--ta-cyan)",
                          boxShadow: "0 0 6px rgba(35,196,206,0.4)",
                        }}
                      />
                    </div>
                    <div
                      className="font-mono-ta w-16 text-right text-[10px]"
                      style={{ color: "var(--fg-4)" }}
                    >
                      {c.workoutCount} ·{" "}
                      {Math.round(c.shareOfTotal * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Area coverage */}
            <div className="mt-4">
              <div
                className="font-mono-ta mb-2 text-[10px] font-bold uppercase"
                style={{ letterSpacing: "0.18em", color: "var(--fg-3)" }}
              >
                Kampfbereiche · Abdeckung
              </div>
              <AreaCoverageChart scores={analysis.areaScores} highlightWeak />
            </div>

            {/* Strong / Weak summary */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div
                className="rounded-xl p-3"
                style={{
                  background: "rgba(35,196,206,0.06)",
                  border: "1px solid rgba(35,196,206,0.3)",
                }}
              >
                <div
                  className="font-mono-ta text-[10px] font-bold uppercase"
                  style={{ letterSpacing: "0.2em", color: "var(--ta-cyan)" }}
                >
                  Stärken
                </div>
                <ul className="mt-2 flex flex-col gap-1 text-xs">
                  {analysis.strongAreas.length === 0 && (
                    <li style={{ color: "var(--fg-4)" }}>
                      Noch keine eindeutigen Schwerpunkte erkennbar.
                    </li>
                  )}
                  {analysis.strongAreas.map((s) => (
                    <li key={s.area} style={{ color: "var(--fg-2)" }}>
                      • {TRAINING_AREA_LABEL[s.area]}{" "}
                      <span style={{ color: "var(--fg-4)" }}>
                        ({s.workoutCount} Workouts)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div
                className="rounded-xl p-3"
                style={{
                  background: "rgba(255,79,168,0.06)",
                  border: "1px solid rgba(255,79,168,0.3)",
                }}
              >
                <div
                  className="font-mono-ta text-[10px] font-bold uppercase"
                  style={{ letterSpacing: "0.2em", color: "var(--ta-pink)" }}
                >
                  Vernachlässigte Bereiche
                </div>
                <ul className="mt-2 flex flex-col gap-1 text-xs">
                  {analysis.weakAreas.map((s) => (
                    <li key={s.area} style={{ color: "var(--fg-2)" }}>
                      • {TRAINING_AREA_LABEL[s.area]}{" "}
                      <span style={{ color: "var(--fg-4)" }}>
                        ({s.workoutCount} Workouts)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Wettkämpfe — zentral im Wettkampfbereich verwaltet */}
        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2
                className="font-display-ta font-black uppercase"
                style={{ fontSize: "20px", letterSpacing: "0.06em" }}
              >
                Wettkämpfe
              </h2>
              <p
                className="font-mono-ta mt-1 text-[10px]"
                style={{ letterSpacing: "0.18em", color: "var(--fg-4)" }}
              >
                Zentral im Wettkampfbereich verwaltet · Gegner-DNA inklusive
              </p>
            </div>
            <Link
              href={`/trainer/competitions/new?student=${uid}`}
              className="btn-primary px-4 py-2 text-xs"
            >
              + Neuer Wettkampf
            </Link>
          </div>

          {/* Matchup: Athlet vs. Gegner-DNA des nächsten Wettkampfs */}
          {nextCamp && (
            <div className="mt-4">
              <MatchupBlock
                athleteName={displayLabel(entry)}
                athlete={athlete}
                camp={nextCamp}
              />
            </div>
          )}

          <div className="mt-4">
            {camps === null ? (
              <Skeleton className="h-24 w-full rounded-2xl" />
            ) : camps.length === 0 ? (
              <div
                className="rounded-2xl p-10 text-center"
                style={{
                  background: "var(--ink-2)",
                  border: "1px dashed var(--ink-5)",
                }}
              >
                <p className="text-sm font-bold" style={{ color: "var(--fg-3)" }}>
                  Noch kein Wettkampf für diesen Schüler.
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--fg-4)" }}>
                  Lege einen Wettkampf an, wähle einen Gegner aus der Gegner-DNA
                  oder erstelle ein neues Gegnerprofil.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {camps.map((c) => (
                  <CompetitionCard
                    key={c.id}
                    camp={c}
                    studentLabel={displayLabel(entry)}
                    href={`/trainer/competitions/${uid}/${c.id}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* KI-Video-Analyse: eigene Kampf-Videos des Athleten auswerten */}
        <div className="mt-8">
          <VideoAnalysisSection
            mode="athlete"
            targetId={uid}
            targetName={displayLabel(entry)}
          />
        </div>
      </div>
    </main>
  );
}

export default function StudentDetailPage({
  params,
}: {
  params: { uid: string };
}) {
  return <StudentDetailContent uid={params.uid} />;
}
