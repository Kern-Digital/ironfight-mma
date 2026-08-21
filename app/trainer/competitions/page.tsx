"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import TrainerHint from "@/components/TrainerHint";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import CompetitionCard, {
  competitionGroup,
} from "@/components/trainer/CompetitionCard";
import { useAuth } from "@/lib/auth-context";
import { belongsToGym, resolveGymId } from "@/lib/gym";
import {
  campOpponentId,
  listAllFightCamps,
  type FightCamp,
} from "@/lib/fight-camp";
import { listOpponentsForGym, type Opponent } from "@/lib/opponents";
import { listAllMembers, type StudentEntry } from "@/lib/admin";

function studentLabelOf(entry: StudentEntry | undefined): string {
  if (!entry) return "Schüler";
  return entry.displayName ?? entry.authProviderName ?? entry.email ?? "Schüler";
}

// ─── Gruppen-Sektion ─────────────────────────────────────────────────────────

function Section({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2
        className="font-mono-ta mb-2.5 text-[11px] font-bold uppercase"
        style={{ letterSpacing: "0.2em", color: accent }}
      >
        {title}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

// ─── Hauptinhalt ─────────────────────────────────────────────────────────────

function CompetitionsHubContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const gymId = resolveGymId(profile);

  const [camps, setCamps] = useState<FightCamp[] | null>(null);
  // Alle Mitglieder inkl. Trainer: auch Coaches treten als Athleten an.
  const [members, setMembers] = useState<Map<string, StudentEntry>>(new Map());
  // Verknüpfte DeepFight-Profile: die Karten zeigen den AKTUELLEN Scouting-Stand,
  // nicht nur den beim Anlegen eingefrorenen Snapshot.
  const [opponents, setOpponents] = useState<Map<string, Opponent>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Die Gegner-DNA lebt jetzt im eigenen Bereich — alte Links (?tab=dna) umleiten.
  useEffect(() => {
    if (searchParams.get("tab") === "dna") router.replace("/trainer/opponents");
  }, [searchParams, router]);

  const load = useCallback(async () => {
    setError(null);
    setCamps(null);
    try {
      const [allCamps, memberList, gymOpponents] = await Promise.all([
        listAllFightCamps(gymId).catch(() => [] as FightCamp[]),
        listAllMembers(gymId).catch(() => [] as StudentEntry[]),
        listOpponentsForGym(gymId).catch(() => [] as Opponent[]),
      ]);
      setCamps(allCamps.filter((c) => belongsToGym(c.gymId, gymId)));
      setMembers(new Map(memberList.map((s) => [s.uid, s])));
      setOpponents(new Map(gymOpponents.map((o) => [o.id, o])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setCamps([]);
    }
  }, [gymId]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Wettkämpfe filtern + gruppieren ──
  const filteredCamps = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = camps ?? [];
    if (!q) return list;
    return list.filter((c) => {
      const label = studentLabelOf(members.get(c.studentUid)).toLowerCase();
      return (
        c.competitionName.toLowerCase().includes(q) ||
        c.opponent.name.toLowerCase().includes(q) ||
        label.includes(q)
      );
    });
  }, [camps, search, members]);

  const grouped = useMemo(() => {
    const g = { upcoming: [] as FightCamp[], past: [] as FightCamp[], archived: [] as FightCamp[] };
    for (const c of filteredCamps) g[competitionGroup(c)].push(c);
    g.upcoming.sort((a, b) => a.competitionDate.getTime() - b.competitionDate.getTime());
    g.past.sort((a, b) => b.competitionDate.getTime() - a.competitionDate.getTime());
    g.archived.sort((a, b) => b.competitionDate.getTime() - a.competitionDate.getTime());
    return g;
  }, [filteredCamps]);

  return (
    <main className="min-h-screen" style={{ background: "var(--ink-1)" }}>
      {/* Header */}
      <div
        className="relative overflow-hidden border-b px-4 py-9 sm:px-6"
        style={{
          borderColor: "rgba(255,79,168,0.2)",
          background:
            "radial-gradient(420px 250px at 100% 50%, rgba(255,79,168,0.12), transparent 60%), linear-gradient(160deg, #140A12, #080512)",
        }}
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-2 flex items-center gap-2">
            <span
              className="font-mono-ta rounded px-2 py-0.5 text-[10px] font-black uppercase"
              style={{
                letterSpacing: "0.2em",
                background: "rgba(255,79,168,0.12)",
                border: "1px solid rgba(255,79,168,0.4)",
                color: "var(--ta-pink)",
              }}
            >
              Trainer
            </span>
          </div>
          <h1
            className="font-display-ta font-black uppercase leading-none"
            style={{ fontSize: "clamp(28px, 5vw, 42px)", letterSpacing: "0.02em" }}
          >
            Wettkampf
          </h1>
          <p
            className="font-mono-ta mt-2 text-[11px]"
            style={{ letterSpacing: "0.2em", color: "var(--fg-4)" }}
          >
            Planung · Vorbereitung · Rückblick
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
        <TrainerHint id="competitions-hub" title="Wettkampfbereich">
          Hier legst du Wettkämpfe an und verfolgst sie — jeder Wettkampf
          verbindet einen Schüler mit einem Gegner aus der
          DeepFight-Bibliothek und friert deren damaligen Stand ein. Die
          Bibliothek selbst findest du im Bereich &bdquo;DeepFight&ldquo;.
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

        {/* Aktionsleiste */}
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <Link href="/trainer/competitions/new" className="btn-primary px-4 py-2 text-xs">
            + Neuer Wettkampf
          </Link>
          <input
            type="search"
            placeholder="Wettkampf, Gegner oder Schüler suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1 rounded-xl px-4 py-2.5 text-sm sm:max-w-sm"
            style={{
              background: "var(--ink-3)",
              border: "1px solid var(--ink-5)",
              color: "var(--fg-1)",
              outline: "none",
            }}
          />
        </div>

        {/* Inhalt */}
        {camps === null ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        ) : filteredCamps.length === 0 ? (
          <EmptyState
            title={search ? "Keine Wettkämpfe gefunden." : "Noch keine Wettkämpfe."}
            hint={
              search
                ? undefined
                : "Lege deinen ersten Wettkampf an — wähle einen Schüler und einen Gegner."
            }
          />
        ) : (
          <>
            {grouped.upcoming.length > 0 && (
              <Section title="Geplant / Aktiv" accent="var(--ta-cyan)">
                {grouped.upcoming.map((c) => (
                  <CompetitionCard
                    key={c.id}
                    camp={c}
                    studentLabel={studentLabelOf(members.get(c.studentUid))}
                    href={`/trainer/competitions/${c.studentUid}/${c.id}`}
                    opponent={opponents.get(campOpponentId(c) ?? "")}
                  />
                ))}
              </Section>
            )}
            {grouped.past.length > 0 && (
              <Section title="Vergangene Wettkämpfe" accent="var(--fg-3)">
                {grouped.past.map((c) => (
                  <CompetitionCard
                    key={c.id}
                    camp={c}
                    studentLabel={studentLabelOf(members.get(c.studentUid))}
                    href={`/trainer/competitions/${c.studentUid}/${c.id}`}
                    opponent={opponents.get(campOpponentId(c) ?? "")}
                  />
                ))}
              </Section>
            )}
            {grouped.archived.length > 0 && (
              <Section title="Archiviert" accent="#9D7BFA">
                {grouped.archived.map((c) => (
                  <CompetitionCard
                    key={c.id}
                    camp={c}
                    studentLabel={studentLabelOf(members.get(c.studentUid))}
                    href={`/trainer/competitions/${c.studentUid}/${c.id}`}
                    opponent={opponents.get(campOpponentId(c) ?? "")}
                  />
                ))}
              </Section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div
      className="mt-3 rounded-2xl p-10 text-center"
      style={{ border: "1px dashed var(--ink-5)", background: "var(--ink-2)" }}
    >
      <p className="text-sm font-bold" style={{ color: "var(--fg-3)" }}>
        {title}
      </p>
      {hint && (
        <p className="mt-1 text-xs" style={{ color: "var(--fg-4)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export default function CompetitionsHubPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <Skeleton className="h-16 w-full" />
        </div>
      }
    >
      <CompetitionsHubContent />
    </Suspense>
  );
}
