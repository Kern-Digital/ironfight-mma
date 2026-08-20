"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TrainerHint from "@/components/TrainerHint";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import DashboardHero from "@/components/dashboard/DashboardHero";
import StatCard from "@/components/dashboard/StatCard";
import SectionCard from "@/components/dashboard/SectionCard";
import EmptyState from "@/components/dashboard/EmptyState";
import Reveal from "@/components/dashboard/Reveal";
import CompetitionCard, {
  competitionGroup,
} from "@/components/trainer/CompetitionCard";
import { useAuth } from "@/lib/auth-context";
import { belongsToGym, resolveGymId } from "@/lib/gym";
import {
  FIGHT_STYLE_LABEL,
  listAllFightCamps,
  type FightCamp,
} from "@/lib/fight-camp";
import { listOpponentsForGym, type Opponent } from "@/lib/opponents";
import { isStaffEntry, listAllMembers, type StudentEntry } from "@/lib/admin";
import { totalAnswered } from "@/lib/gegner-dna";

function studentLabelOf(entry: StudentEntry | undefined): string {
  if (!entry) return "Schüler";
  return entry.displayName ?? entry.authProviderName ?? entry.email ?? "Schüler";
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Bausteine ───────────────────────────────────────────────────────────────

function OpponentMiniCard({ opponent }: { opponent: Opponent }) {
  const dnaCount = totalAnswered(opponent.dna);
  return (
    <Link
      href={`/trainer/opponents/${opponent.id}`}
      className="card-glass card-interactive block !p-4"
      style={{ textDecoration: "none" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className="font-display-ta truncate font-black uppercase"
          style={{ fontSize: "14px", letterSpacing: "0.03em", color: "var(--fg)" }}
        >
          {opponent.name}
        </div>
        <span
          className="font-mono-ta shrink-0 rounded px-1.5 py-0.5 text-[9px] uppercase"
          style={{
            letterSpacing: "0.12em",
            background: dnaCount > 0 ? "rgba(35,196,206,0.1)" : "var(--ink-4)",
            border: `1px solid ${dnaCount > 0 ? "rgba(35,196,206,0.35)" : "var(--ink-5)"}`,
            color: dnaCount > 0 ? "var(--ta-cyan)" : "var(--fg-4)",
          }}
        >
          DNA {dnaCount}
        </span>
      </div>
      <div
        className="font-mono-ta mt-1 truncate text-[10px] uppercase"
        style={{ letterSpacing: "0.12em", color: "var(--fg-4)" }}
      >
        {FIGHT_STYLE_LABEL[opponent.style]} · {formatDate(opponent.updatedAt)}
      </div>
    </Link>
  );
}

// ─── Seite ───────────────────────────────────────────────────────────────────

export default function TrainerDashboardPage() {
  const { profile } = useAuth();
  const gymId = resolveGymId(profile);

  const [camps, setCamps] = useState<FightCamp[] | null>(null);
  const [opponents, setOpponents] = useState<Opponent[] | null>(null);
  // Alle Mitglieder (inkl. Trainer) — Trainer können selbst Wettkämpfe haben,
  // daher müssen ihre Namen auflösbar sein. Die Schüler-Kachel zählt separat.
  const [members, setMembers] = useState<StudentEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setCamps(null);
    setOpponents(null);
    setMembers(null);
    try {
      const [allCamps, gymOpponents, memberList] = await Promise.all([
        listAllFightCamps().catch(() => [] as FightCamp[]),
        listOpponentsForGym(gymId).catch(() => [] as Opponent[]),
        listAllMembers().catch(() => [] as StudentEntry[]),
      ]);
      setCamps(allCamps.filter((c) => belongsToGym(c.gymId, gymId)));
      setOpponents(gymOpponents);
      setMembers(memberList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setCamps([]);
      setOpponents([]);
      setMembers([]);
    }
  }, [gymId]);

  useEffect(() => {
    load();
  }, [load]);

  const memberMap = useMemo(
    () => new Map((members ?? []).map((s) => [s.uid, s])),
    [members],
  );
  const studentCount = useMemo(
    () => (members ?? []).filter((s) => !isStaffEntry(s)).length,
    [members],
  );

  const upcoming = useMemo(
    () =>
      (camps ?? [])
        .filter((c) => competitionGroup(c) === "upcoming")
        .sort((a, b) => a.competitionDate.getTime() - b.competitionDate.getTime()),
    [camps],
  );

  // listOpponentsForGym liefert bereits nach updatedAt absteigend sortiert.
  const recentOpponents = useMemo(() => (opponents ?? []).slice(0, 6), [opponents]);

  const loading = camps === null || opponents === null || members === null;

  return (
    <main className="min-h-screen">
      <DashboardHero
        badges={[{ label: "Trainer", accent: "pink", icon: "users" }]}
        accent="pink"
        title="Wettkampf-Zentrale"
        subtitle="Schüler · Stundenplan · DeepFight"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/trainer/competitions/new" className="btn-primary px-4 py-2 text-xs">
            + Neuer Wettkampf
          </Link>
          <Link
            href="/trainer/opponents?new=1"
            className="btn-secondary px-4 py-2 text-xs"
          >
            + Neues DeepFight-Profil
          </Link>
          <Link href="/trainer/students" className="btn-secondary px-4 py-2 text-xs">
            Schüler ansehen
          </Link>
        </div>
      </DashboardHero>

      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
        <TrainerHint id="trainer-dashboard" title="Trainer-Dashboard">
          Dein Einstieg in den Trainerbereich: anstehende Wettkämpfe, zuletzt
          bearbeitete DeepFight-Profile und Schnellzugriffe. Alles Weitere findest du
          über die Bereichs-Navigation oben.
        </TrainerHint>

        {error && (
          <div className="mb-5">
            <ErrorState
              title="Daten konnten nicht geladen werden"
              message={error}
              onRetry={load}
            />
          </div>
        )}

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            {/* Kennzahlen */}
            <Reveal>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard
                  label="Anstehende Wettkämpfe"
                  icon="trophy"
                  value={String(upcoming.length)}
                  href="/trainer/competitions"
                />
                <StatCard
                  label="DeepFight-Profile"
                  icon="target"
                  accent="var(--ta-pink)"
                  value={String((opponents ?? []).length)}
                  href="/trainer/opponents"
                />
                <StatCard
                  label="Schüler"
                  icon="users"
                  value={String(studentCount)}
                  href="/trainer/students"
                />
              </div>
            </Reveal>

            {/* Nächste Wettkämpfe */}
            <Reveal>
              <SectionCard
                title="Nächste Wettkämpfe"
                icon="trophy"
                accent="var(--ta-cyan)"
                moreHref="/trainer/competitions"
                moreLabel="Alle Wettkämpfe"
                className="mt-5"
              >
                {upcoming.length === 0 ? (
                  <EmptyState
                    icon="trophy"
                    title="Kein Wettkampf geplant."
                    hint="Lege einen Wettkampf an — wähle einen Schüler und einen Gegner."
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {upcoming.slice(0, 3).map((c) => (
                      <CompetitionCard
                        key={c.id}
                        camp={c}
                        studentLabel={studentLabelOf(memberMap.get(c.studentUid))}
                        href={`/trainer/competitions/${c.studentUid}/${c.id}`}
                      />
                    ))}
                  </div>
                )}
              </SectionCard>
            </Reveal>

            {/* Zuletzt bearbeitete DeepFight-Profile */}
            <Reveal>
              <SectionCard
                title="Zuletzt bearbeitete DeepFight-Profile"
                icon="target"
                accent="var(--ta-pink)"
                moreHref="/trainer/opponents"
                moreLabel="Bibliothek"
                className="mt-5"
              >
                {recentOpponents.length === 0 ? (
                  <EmptyState
                    icon="target"
                    title="Noch keine DeepFight-Profile angelegt."
                    hint="Gegnerprofile werden gym-weit für alle Trainer geteilt."
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {recentOpponents.map((o) => (
                      <OpponentMiniCard key={o.id} opponent={o} />
                    ))}
                  </div>
                )}
              </SectionCard>
            </Reveal>

            {/* KI-Review-Queue (Platzhalter bis zur Video-Analyse) */}
            <Reveal>
              <SectionCard
                title="KI-Review"
                icon="spark"
                accent="var(--ta-cyan)"
                className="mt-5"
              >
                <EmptyState
                  icon="spark"
                  title="Keine offenen KI-Befunde."
                  hint="Sobald die Video-Analyse aktiv ist, erscheinen hier Befunde, die auf deine Bestätigung warten — Widersprüche überschreiben nie automatisch."
                />
              </SectionCard>
            </Reveal>
          </>
        )}
      </div>
    </main>
  );
}
