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
import OpponentEditor, {
  type OpponentEditorValue,
} from "@/components/trainer/OpponentEditor";
import { useAuth } from "@/lib/auth-context";
import { belongsToGym, resolveGymId } from "@/lib/gym";
import { listAllFightCamps, type FightCamp } from "@/lib/fight-camp";
import {
  createOpponent,
  listOpponentsForGym,
  searchOpponents,
  type Opponent,
} from "@/lib/opponents";
import { listAllStudents, type StudentEntry } from "@/lib/admin";
import { FIGHT_STYLE_LABEL } from "@/lib/fight-camp";
import { totalAnswered } from "@/lib/gegner-dna";

type Tab = "wettkaempfe" | "dna";

function studentLabelOf(entry: StudentEntry | undefined): string {
  if (!entry) return "Schüler";
  return entry.displayName ?? entry.authProviderName ?? entry.email ?? "Schüler";
}

// ─── Gegner-DNA-Bibliothekskarte ─────────────────────────────────────────────

function OpponentCard({ opponent }: { opponent: Opponent }) {
  const dnaCount = totalAnswered(opponent.dna);
  return (
    <Link
      href={`/trainer/opponents/${opponent.id}`}
      className="block rounded-2xl p-4 transition-colors"
      style={{
        background: "linear-gradient(180deg, var(--ink-3), var(--ink-2))",
        border: "1px solid var(--ink-4)",
        textDecoration: "none",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className="font-display-ta truncate font-black uppercase"
          style={{ fontSize: "15px", letterSpacing: "0.03em", color: "var(--fg)" }}
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
        className="font-mono-ta mt-1 truncate text-[10px]"
        style={{ letterSpacing: "0.12em", color: "var(--fg-4)" }}
      >
        {FIGHT_STYLE_LABEL[opponent.style]}
      </div>
      {(opponent.strengths.length > 0 || opponent.weaknesses.length > 0) && (
        <div className="mt-2 flex flex-col gap-0.5 text-[11px]">
          {opponent.strengths.length > 0 && (
            <div className="truncate">
              <span style={{ color: "var(--ta-cyan)" }}>+ </span>
              <span style={{ color: "var(--fg-3)" }}>
                {opponent.strengths.join(", ")}
              </span>
            </div>
          )}
          {opponent.weaknesses.length > 0 && (
            <div className="truncate">
              <span style={{ color: "var(--ta-pink)" }}>− </span>
              <span style={{ color: "var(--fg-3)" }}>
                {opponent.weaknesses.join(", ")}
              </span>
            </div>
          )}
        </div>
      )}
    </Link>
  );
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
  const { user, profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const gymId = resolveGymId(profile);

  const [tab, setTab] = useState<Tab>(
    searchParams.get("tab") === "dna" ? "dna" : "wettkaempfe",
  );
  const [camps, setCamps] = useState<FightCamp[] | null>(null);
  const [opponents, setOpponents] = useState<Opponent[] | null>(null);
  const [students, setStudents] = useState<Map<string, StudentEntry>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showNewOpponent, setShowNewOpponent] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setCamps(null);
    setOpponents(null);
    try {
      const [allCamps, gymOpponents, studentList] = await Promise.all([
        listAllFightCamps().catch(() => [] as FightCamp[]),
        listOpponentsForGym(gymId).catch(() => [] as Opponent[]),
        listAllStudents().catch(() => [] as StudentEntry[]),
      ]);
      setCamps(allCamps.filter((c) => belongsToGym(c.gymId, gymId)));
      setOpponents(gymOpponents);
      setStudents(new Map(studentList.map((s) => [s.uid, s])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setCamps([]);
      setOpponents([]);
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
      const label = studentLabelOf(students.get(c.studentUid)).toLowerCase();
      return (
        c.competitionName.toLowerCase().includes(q) ||
        c.opponent.name.toLowerCase().includes(q) ||
        label.includes(q)
      );
    });
  }, [camps, search, students]);

  const grouped = useMemo(() => {
    const g = { upcoming: [] as FightCamp[], past: [] as FightCamp[], archived: [] as FightCamp[] };
    for (const c of filteredCamps) g[competitionGroup(c)].push(c);
    g.upcoming.sort((a, b) => a.competitionDate.getTime() - b.competitionDate.getTime());
    g.past.sort((a, b) => b.competitionDate.getTime() - a.competitionDate.getTime());
    g.archived.sort((a, b) => b.competitionDate.getTime() - a.competitionDate.getTime());
    return g;
  }, [filteredCamps]);

  // ── Gegner-DNA filtern ──
  const filteredOpponents = useMemo(
    () => searchOpponents(opponents ?? [], search),
    [opponents, search],
  );

  async function handleCreateOpponent(value: OpponentEditorValue) {
    if (!user) return;
    setCreating(true);
    try {
      const created = await createOpponent({
        gymId,
        createdBy: user.uid,
        createdByName:
          profile?.displayName ?? profile?.authProviderName ?? profile?.email ?? null,
        ...value,
      });
      router.push(`/trainer/opponents/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anlegen fehlgeschlagen");
      setCreating(false);
    }
  }

  function switchTab(next: Tab) {
    setTab(next);
    setSearch("");
    setShowNewOpponent(false);
  }

  const loading = camps === null || opponents === null;

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
            Wettkämpfe · Gegner-DNA · gym-weit geteilt
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
        <TrainerHint id="competitions-hub" title="Wettkampfbereich">
          Hier laufen alle kampfbezogenen Funktionen zusammen: Wettkämpfe
          anlegen und verfolgen sowie Gegner-DNA-Profile pflegen. Gegner-DNA wird
          gym-weit geteilt — alle Trainer deines Gyms sehen dieselben
          Gegnerprofile. Alte Wettkämpfe behalten ihre damals gespeicherte DNA.
        </TrainerHint>

        {/* Tabs */}
        <div
          className="mb-5 inline-flex gap-1 rounded-xl p-1"
          style={{ background: "var(--ink-3)", border: "1px solid var(--ink-5)" }}
        >
          {([
            ["wettkaempfe", "Wettkämpfe"],
            ["dna", "Gegner-DNA"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => switchTab(id)}
              className="font-mono-ta rounded-lg px-4 py-2 text-[11px] font-bold uppercase transition-colors"
              style={{
                letterSpacing: "0.12em",
                background: tab === id ? "var(--ta-pink)" : "transparent",
                color: tab === id ? "#fff" : "var(--fg-3)",
              }}
            >
              {label}
            </button>
          ))}
        </div>

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
          {tab === "wettkaempfe" ? (
            <Link href="/trainer/competitions/new" className="btn-primary px-4 py-2 text-xs">
              + Neuer Wettkampf
            </Link>
          ) : (
            <button
              onClick={() => setShowNewOpponent((v) => !v)}
              className="btn-primary px-4 py-2 text-xs"
            >
              {showNewOpponent ? "Schließen" : "+ Neue Gegner-DNA"}
            </button>
          )}
          <input
            type="search"
            placeholder={
              tab === "wettkaempfe"
                ? "Wettkampf, Gegner oder Schüler suchen…"
                : "Gegner-DNA suchen…"
            }
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

        {/* Inline-Editor: neue Gegner-DNA */}
        {tab === "dna" && showNewOpponent && (
          <div
            className="mb-5 mt-3 rounded-2xl p-4 sm:p-5"
            style={{
              background: "linear-gradient(180deg, var(--ink-3), var(--ink-2))",
              border: "1px solid var(--ink-4)",
            }}
          >
            <h3
              className="font-display-ta mb-4 font-black uppercase"
              style={{ fontSize: "16px", letterSpacing: "0.04em" }}
            >
              Neue Gegner-DNA anlegen
            </h3>
            <OpponentEditor
              busy={creating}
              submitLabel="Gegner-DNA anlegen"
              onSubmit={handleCreateOpponent}
              onCancel={() => setShowNewOpponent(false)}
            />
          </div>
        )}

        {/* Inhalt */}
        {loading ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        ) : tab === "wettkaempfe" ? (
          filteredCamps.length === 0 ? (
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
                      studentLabel={studentLabelOf(students.get(c.studentUid))}
                      href={`/trainer/competitions/${c.studentUid}/${c.id}`}
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
                      studentLabel={studentLabelOf(students.get(c.studentUid))}
                      href={`/trainer/competitions/${c.studentUid}/${c.id}`}
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
                      studentLabel={studentLabelOf(students.get(c.studentUid))}
                      href={`/trainer/competitions/${c.studentUid}/${c.id}`}
                    />
                  ))}
                </Section>
              )}
            </>
          )
        ) : filteredOpponents.length === 0 ? (
          <EmptyState
            title={search ? "Keine Gegner-DNA gefunden." : "Noch keine Gegner-DNA angelegt."}
            hint={
              search
                ? undefined
                : "Lege ein erstes Gegnerprofil an — es wird gym-weit für alle Trainer geteilt."
            }
          />
        ) : (
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredOpponents.map((o) => (
              <OpponentCard key={o.id} opponent={o} />
            ))}
          </div>
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
