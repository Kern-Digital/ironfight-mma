"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import TrainerHint from "@/components/TrainerHint";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import OpponentEditor, {
  type OpponentEditorValue,
} from "@/components/trainer/OpponentEditor";
import DnaCompletenessRing from "@/components/trainer/DnaCompletenessRing";
import { useAuth } from "@/lib/auth-context";
import { resolveGymId } from "@/lib/gym";
import { FIGHT_STYLE_LABEL } from "@/lib/fight-camp";
import {
  createOpponent,
  listOpponentsForGym,
  searchOpponents,
  type Opponent,
} from "@/lib/opponents";
import { DNA_CATEGORIES, answeredCount } from "@/lib/gegner-dna";

function formatDate(d: Date): string {
  return d.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Bibliothekskarte ────────────────────────────────────────────────────────

function OpponentCard({ opponent }: { opponent: Opponent }) {
  const covered = DNA_CATEGORIES.filter(
    (c) => answeredCount(c, opponent.dna) > 0,
  ).length;

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
      <div className="flex items-start gap-3">
        <DnaCompletenessRing
          covered={covered}
          total={DNA_CATEGORIES.length}
          size={40}
          stroke={3.5}
        />
        <div className="min-w-0 flex-1">
          <div
            className="font-display-ta truncate font-black uppercase"
            style={{ fontSize: "15px", letterSpacing: "0.03em", color: "var(--fg)" }}
          >
            {opponent.name}
          </div>
          <div
            className="font-mono-ta mt-1 truncate text-[10px]"
            style={{ letterSpacing: "0.12em", color: "var(--fg-4)" }}
          >
            {FIGHT_STYLE_LABEL[opponent.style]} · {formatDate(opponent.updatedAt)}
          </div>
        </div>
      </div>
      {(opponent.strengths.length > 0 || opponent.weaknesses.length > 0) && (
        <div className="mt-2.5 flex flex-col gap-0.5 text-[11px]">
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

// ─── Seite ───────────────────────────────────────────────────────────────────

function OpponentsLibraryContent() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const gymId = resolveGymId(profile);

  const [opponents, setOpponents] = useState<Opponent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Deep-Link "?new=1" (z. B. vom Dashboard) öffnet den Editor direkt.
  const [showNewOpponent, setShowNewOpponent] = useState(
    searchParams.get("new") === "1",
  );
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setOpponents(null);
    try {
      setOpponents(await listOpponentsForGym(gymId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setOpponents([]);
    }
  }, [gymId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
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
            Gegner-DNA
          </h1>
          <p
            className="font-mono-ta mt-2 text-[11px]"
            style={{ letterSpacing: "0.2em", color: "var(--fg-4)" }}
          >
            Scouting-Bibliothek · gym-weit geteilt
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
        <TrainerHint id="opponents-library" title="Gegner-DNA-Bibliothek">
          Jedes Profil ist die lebende DNA eines Gegners: Muster, Waffen,
          Schwächen, Gameplan. Alle Trainer deines Gyms arbeiten an denselben
          Profilen. Der Ring zeigt, wie viele der {DNA_CATEGORIES.length}{" "}
          DNA-Kategorien schon gescoutet sind. Wettkämpfe frieren beim Anlegen
          den damaligen Stand ein.
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
          <button
            onClick={() => setShowNewOpponent((v) => !v)}
            className="btn-primary px-4 py-2 text-xs"
          >
            {showNewOpponent ? "Schließen" : "+ Neue Gegner-DNA"}
          </button>
          <input
            type="search"
            placeholder="Gegner-DNA suchen…"
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
        {showNewOpponent && (
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

        {/* Bibliothek */}
        {opponents === null ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="mt-3 rounded-2xl p-10 text-center"
            style={{ border: "1px dashed var(--ink-5)", background: "var(--ink-2)" }}
          >
            <p className="text-sm font-bold" style={{ color: "var(--fg-3)" }}>
              {search ? "Keine Gegner-DNA gefunden." : "Noch keine Gegner-DNA angelegt."}
            </p>
            {!search && (
              <p className="mt-1 text-xs" style={{ color: "var(--fg-4)" }}>
                Lege ein erstes Gegnerprofil an — es wird gym-weit für alle
                Trainer geteilt.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((o) => (
              <OpponentCard key={o.id} opponent={o} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function OpponentsLibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <Skeleton className="h-16 w-full" />
        </div>
      }
    >
      <OpponentsLibraryContent />
    </Suspense>
  );
}
