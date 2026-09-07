"use client";

/**
 * DeepFight-Bibliothek — Rollout-Etappe 3a (04.09.2026).
 *
 * Umzug vom alten Token-System auf das neue: `.t-card` statt Ink-Verlauf, Typo
 * aus den `--type-*`-Tokens statt Barlow mit Inline-Pixelgrößen, Aktionsleiste
 * als Pillen-Reihe wie in der Athletenliste und im Wettkampfbereich. Kopf,
 * Gooey-Suche und der fließende Karten-Rost standen schon.
 */

import { Collapse } from "@/components/motion";
import GooeySearch from "@/components/ui/GooeySearch";
import PageHead from "@/components/shell/PageHead";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import TrainerHint from "@/components/TrainerHint";
import DeepFightWordmark from "@/components/DeepFightWordmark";
import Icon from "@/components/ui/Icon";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import { StaggerFlow, FlowItem } from "@/components/motion";
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

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

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
      data-press="surface"
      className="t-card t-interactive block p-4"
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <div className="flex items-start gap-3">
        <DnaCompletenessRing
          covered={covered}
          total={DNA_CATEGORIES.length}
          size={40}
          stroke={3.5}
        />
        <div className="min-w-0 flex-1">
          {/* KEINE VERSALIEN: Ein Gegnername ist Inhalt, keine Überschrift —
              dieselbe Lehre wie auf der Wettkampfkarte, wo „Night of
              Champions" in Versalien abbrach. */}
          <div className="truncate" style={{ font: "var(--type-h3)" }}>
            {opponent.name}
          </div>
          <div
            className="mt-1 truncate"
            style={{ ...META_FONT, color: "var(--text-3)" }}
          >
            {FIGHT_STYLE_LABEL[opponent.style]} ·{" "}
            {formatDate(opponent.updatedAt)}
          </div>
        </div>
      </div>
      {(opponent.strengths.length > 0 || opponent.weaknesses.length > 0) && (
        <div
          className="mt-2.5 flex flex-col gap-0.5"
          style={{ font: "var(--type-sub)" }}
        >
          {/* Semantik statt Marken-Akzenten — dieselbe Zuordnung wie im
              Camp-Plan und im Gegnerbericht: + Stärke, − Schwäche. */}
          {opponent.strengths.length > 0 && (
            <div className="truncate">
              <span style={{ color: "var(--positive)" }}>+ </span>
              <span style={{ color: "var(--text-2)" }}>
                {opponent.strengths.join(", ")}
              </span>
            </div>
          )}
          {opponent.weaknesses.length > 0 && (
            <div className="truncate">
              <span style={{ color: "var(--negative)" }}>− </span>
              <span style={{ color: "var(--text-2)" }}>
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
          profile?.displayName ??
          profile?.authProviderName ??
          profile?.email ??
          null,
        ...value,
      });
      router.push(`/trainer/opponents/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anlegen fehlgeschlagen");
      setCreating(false);
    }
  }

  return (
    <main
      className="min-h-screen"
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      <PageHead
        lane="wide"
        title={<DeepFightWordmark />}
        description="KI-Gegneranalyse für dein ganzes Gym: Jedes Profil steht allen Trainern offen."
      />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 pt-1 sm:px-6">
        <TrainerHint id="opponents-library" title="DeepFight-Bibliothek">
          Jedes Profil ist die lebende Analyse eines Gegners: Muster, Waffen,
          Schwächen, Gameplan. Alle Trainer deines Gyms arbeiten an denselben
          Profilen. Der Ring zeigt, wie viele der {DNA_CATEGORIES.length}{" "}
          Kategorien schon gescoutet sind. Wettkämpfe frieren beim Anlegen den
          damaligen Stand ein.
        </TrainerHint>

        {error && (
          <ErrorState
            title="Daten konnten nicht geladen werden"
            message={error}
            onRetry={load}
          />
        )}

        {/* Aktionsleiste — Knopf und Suche in EINER Reihe aus Pillen, wie in
            der Athletenliste und im Wettkampfbereich. */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowNewOpponent((v) => !v)}
            aria-expanded={showNewOpponent}
            className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-5"
            style={{
              ...BTN_FONT,
              background: "var(--accent)",
              color: "var(--on-accent)",
              boxShadow: "var(--accent-glow)",
            }}
          >
            <Icon
              name={showNewOpponent ? "x" : "plus"}
              size={13}
              strokeWidth={2.4}
            />
            {showNewOpponent ? "Schließen" : "Neues DeepFight-Profil"}
          </button>
          <GooeySearch
            value={search}
            onChange={setSearch}
            label="Suchen"
            placeholder="Gegner suchen…"
          />
        </div>

        {/* Inline-Editor: neue Gegner-DNA */}
        <Collapse open={showNewOpponent}>
          <div className="pb-2">
            <h2
              className="mb-4"
              style={{
                font: "var(--type-h2)",
                letterSpacing: "var(--ls-display)",
                textTransform: "uppercase",
              }}
            >
              Neues DeepFight-Profil
            </h2>
            <OpponentEditor
              busy={creating}
              submitLabel="DeepFight-Profil anlegen"
              onSubmit={handleCreateOpponent}
              onCancel={() => setShowNewOpponent(false)}
            />
          </div>
        </Collapse>

        {/* Bibliothek */}
        {opponents === null ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-card" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="rounded-card p-10 text-center"
            style={{
              border: "1px dashed var(--line-strong)",
              background: "var(--surface-card)",
            }}
          >
            <p style={{ font: "var(--type-body-strong)" }}>
              {search
                ? "Kein DeepFight-Profil gefunden."
                : "Noch kein DeepFight-Profil angelegt."}
            </p>
            <p
              className="mt-1"
              style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
            >
              {search
                ? "Such nach einem anderen Namen oder leer die Suche."
                : "Leg ein erstes Gegnerprofil an — dein ganzes Trainerteam arbeitet damit."}
            </p>
          </div>
        ) : (
          // Die Bibliothek filtert live nach Suchbegriff — die Karten sollen
          // dabei zu ihrer neuen Rasterposition rutschen statt zu springen.
          // Schlüssel ist die Firestore-ID, nie der Index (MOTION-BRIEF §3.7).
          <StaggerFlow className="grid gap-3 pb-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((o, i) => (
              <FlowItem key={o.id} index={i}>
                <OpponentCard opponent={o} />
              </FlowItem>
            ))}
          </StaggerFlow>
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
