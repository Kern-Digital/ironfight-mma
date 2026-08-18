"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import OpponentProfileView from "@/components/trainer/OpponentProfileView";
import OpponentEditor, {
  type OpponentEditorValue,
} from "@/components/trainer/OpponentEditor";
import VideoAnalysisSection from "@/components/trainer/VideoAnalysisSection";
import DnaCompletenessRing from "@/components/trainer/DnaCompletenessRing";
import { useAuth } from "@/lib/auth-context";
import {
  deleteOpponent,
  getOpponent,
  updateOpponent,
  type Opponent,
} from "@/lib/opponents";
import { DNA_CATEGORIES, answeredCount, totalAnswered } from "@/lib/gegner-dna";
import { FIGHTER_STANCE_LABEL, FIGHT_STYLE_LABEL } from "@/lib/fight-camp";

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type DetailTab = "uebersicht" | "dna" | "stats" | "videos";

const DETAIL_TABS: [DetailTab, string][] = [
  ["uebersicht", "Übersicht"],
  ["dna", "DNA"],
  ["stats", "Stats"],
  ["videos", "Videos"],
];

// ─── Auf einen Blick: Stärken / Schwächen / Lieblingsangriffe als Chips ──────

function ChipRow({
  label,
  color,
  items,
}: {
  label: string;
  color: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className="font-mono-ta w-24 shrink-0 text-[10px] font-bold uppercase"
        style={{ letterSpacing: "0.14em", color: "var(--fg-4)" }}
      >
        {label}
      </span>
      {items.map((item) => (
        <span
          key={item}
          className="rounded-lg px-2 py-0.5 text-[11px] font-semibold"
          style={{
            background: "var(--ink-4)",
            border: `1px solid ${color}`,
            color,
          }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function GlanceCard({ opponent }: { opponent: Opponent }) {
  const strengths = opponent.strengths ?? [];
  const weaknesses = opponent.weaknesses ?? [];
  const favorites = opponent.favoriteAttacks ?? [];
  if (
    strengths.length === 0 &&
    weaknesses.length === 0 &&
    favorites.length === 0 &&
    !opponent.notes
  )
    return null;

  return (
    <div
      className="rounded-2xl p-4 sm:p-5"
      style={{
        background:
          "radial-gradient(400px 200px at 100% 0%, rgba(255,79,168,0.08), transparent 60%), var(--ink-2)",
        border: "1px solid var(--ink-4)",
      }}
    >
      <div
        className="font-mono-ta mb-3 text-[10px] font-bold uppercase"
        style={{ letterSpacing: "0.2em", color: "var(--ta-pink)" }}
      >
        Auf einen Blick
      </div>
      <div className="flex flex-col gap-2">
        <ChipRow label="Stärken" color="var(--ta-cyan)" items={strengths} />
        <ChipRow label="Schwächen" color="var(--ta-pink)" items={weaknesses} />
        <ChipRow label="Waffen" color="#9D7BFA" items={favorites} />
      </div>
      {opponent.notes && (
        <p
          className="mt-3 italic"
          style={{ color: "var(--fg-3)", fontSize: "12px" }}
        >
          &bdquo;{opponent.notes}&ldquo;
        </p>
      )}
    </div>
  );
}

// ─── Seite ───────────────────────────────────────────────────────────────────

function OpponentDetailContent({ id }: { id: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [opponent, setOpponent] = useState<Opponent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<DetailTab>("uebersicht");

  const load = useCallback(async () => {
    setError(null);
    setOpponent(null);
    try {
      const o = await getOpponent(id);
      if (!o) throw new Error("Gegner-DNA-Profil nicht gefunden");
      setOpponent(o);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  /** Stilles Neuladen ohne Skeleton — z. B. nach DNA-Übernahme aus einer Video-Analyse. */
  const reload = useCallback(async () => {
    try {
      const o = await getOpponent(id);
      if (o) setOpponent(o);
    } catch {
      /* Ansicht behält den letzten Stand */
    }
  }, [id]);

  async function handleSave(value: OpponentEditorValue) {
    if (!opponent) return;
    setBusy(true);
    try {
      await updateOpponent(opponent.id, {
        ...value,
        updatedBy: user?.uid ?? null,
      });
      await load();
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!opponent) return;
    if (
      !confirm(
        `Gegner-DNA „${opponent.name}" wirklich löschen? Bereits angelegte Wettkämpfe behalten ihren gespeicherten Snapshot.`,
      )
    )
      return;
    try {
      await deleteOpponent(opponent.id);
      router.push("/trainer/opponents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    }
  }

  if (error && !opponent) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <ErrorState
          title="Profil konnte nicht geladen werden"
          message={error}
          onRetry={load}
        />
      </div>
    );
  }

  if (!opponent) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const answers = totalAnswered(opponent.dna);
  const coveredCategories = DNA_CATEGORIES.filter(
    (c) => answeredCount(c, opponent.dna) > 0,
  ).length;
  const measures = [
    opponent.heightCm ? `${opponent.heightCm} cm` : null,
    opponent.weightKg ? `${opponent.weightKg} kg` : null,
    opponent.reachCm ? `Reach ${opponent.reachCm} cm` : null,
  ].filter(Boolean);

  return (
    <main className="min-h-screen" style={{ background: "var(--ink-1)" }}>
      {/* Zurück-Zeile (scrollt mit) */}
      <div className="px-4 pt-4 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/trainer/opponents"
            className="font-mono-ta text-[10px] uppercase"
            style={{ letterSpacing: "0.2em", color: "var(--fg-4)" }}
          >
            ← Gegner-DNA-Bibliothek
          </Link>
        </div>
      </div>

      {/* Sticky Fighter-ID-Card: dockt unter der Haupt-Navbar (h-16) an */}
      <div
        className="sticky top-16 z-30 mt-3 border-y px-4 sm:px-6"
        style={{
          borderColor: "rgba(255,79,168,0.2)",
          background:
            "radial-gradient(500px 220px at 100% 50%, rgba(255,79,168,0.1), transparent 60%), linear-gradient(160deg, #140A12, #080512)",
        }}
      >
        <div className="mx-auto max-w-3xl py-3.5">
          <div className="flex flex-wrap items-center gap-3.5">
            <DnaCompletenessRing
              covered={coveredCategories}
              total={DNA_CATEGORIES.length}
              size={52}
              stroke={4.5}
            />
            <div className="min-w-0 flex-1">
              <h1
                className="font-display-ta truncate font-black uppercase leading-none"
                style={{
                  fontSize: "clamp(20px, 3.5vw, 28px)",
                  letterSpacing: "0.02em",
                  color: "#F5F2F7",
                }}
              >
                {opponent.name}
              </h1>
              <p
                className="font-mono-ta mt-1.5 truncate text-[10px]"
                style={{ letterSpacing: "0.14em", color: "rgba(245,242,247,0.65)" }}
              >
                {FIGHT_STYLE_LABEL[opponent.style]} ·{" "}
                {FIGHTER_STANCE_LABEL[opponent.stance]}
                {measures.length > 0 && <> · {measures.join(" · ")}</>}
              </p>
              <p
                className="font-mono-ta mt-0.5 truncate text-[10px]"
                style={{ letterSpacing: "0.14em", color: "rgba(245,242,247,0.45)" }}
              >
                {answers} {answers === 1 ? "Eintrag" : "Einträge"} · Aktualisiert{" "}
                {formatDate(opponent.updatedAt)}
              </p>
            </div>
            {!editing && (
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link
                  href={`/trainer/competitions/new?opponent=${opponent.id}`}
                  className="btn-secondary px-3.5 py-2 text-xs"
                >
                  Wettkampf anlegen
                </Link>
                <button
                  onClick={() => setEditing(true)}
                  className="btn-primary px-3.5 py-2 text-xs"
                >
                  Bearbeiten
                </button>
              </div>
            )}
          </div>

          {/* Bereichs-Tabs — bleiben beim Scrollen erreichbar */}
          {!editing && (
            <div
              className="mt-3 inline-flex gap-1 rounded-xl p-1"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              {DETAIL_TABS.map(([tabId, label]) => (
                <button
                  key={tabId}
                  onClick={() => setTab(tabId)}
                  className="font-mono-ta rounded-lg px-3.5 py-1.5 text-[11px] font-bold uppercase transition-colors"
                  style={{
                    letterSpacing: "0.12em",
                    background: tab === tabId ? "var(--ta-pink)" : "transparent",
                    color: tab === tabId ? "#fff" : "rgba(245,242,247,0.6)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {error && (
          <div className="mb-4">
            <ErrorState title="Fehler" message={error} onRetry={load} />
          </div>
        )}

        {editing ? (
          <>
            <OpponentEditor
              initial={{
                name: opponent.name,
                style: opponent.style,
                stance: opponent.stance,
                heightCm: opponent.heightCm,
                weightKg: opponent.weightKg,
                reachCm: opponent.reachCm,
                strengths: opponent.strengths,
                weaknesses: opponent.weaknesses,
                favoriteAttacks: opponent.favoriteAttacks,
                notes: opponent.notes,
                dna: opponent.dna,
                dnaSplit: opponent.dnaSplit,
                actionStats: opponent.actionStats,
              }}
              busy={busy}
              submitLabel="Speichern"
              onSubmit={handleSave}
              onCancel={() => setEditing(false)}
            />
            <div className="mt-6 border-t pt-4" style={{ borderColor: "var(--ink-4)" }}>
              <button
                onClick={handleDelete}
                className="font-mono-ta rounded-lg px-3 py-1.5 text-[10px] uppercase"
                style={{
                  letterSpacing: "0.15em",
                  background: "transparent",
                  border: "1px solid var(--ink-5)",
                  color: "var(--fg-4)",
                }}
              >
                Gegner-DNA löschen
              </button>
            </div>
          </>
        ) : tab === "videos" ? (
          <VideoAnalysisSection
            mode="opponent"
            targetId={opponent.id}
            targetName={opponent.name}
            opponent={opponent}
            onOpponentUpdated={reload}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {/* Übersicht: Auf-einen-Blick-Chips vor Split + Auto-Insights */}
            {tab === "uebersicht" && <GlanceCard opponent={opponent} />}
            <OpponentProfileView
              section={
                tab === "uebersicht" ? "overview" : tab === "dna" ? "dna" : "stats"
              }
              showBasics={false}
              opponent={{
                name: opponent.name,
                style: opponent.style,
                stance: opponent.stance,
                heightCm: opponent.heightCm,
                weightKg: opponent.weightKg,
                reachCm: opponent.reachCm,
                strengths: opponent.strengths,
                weaknesses: opponent.weaknesses,
                favoriteAttacks: opponent.favoriteAttacks,
                notes: opponent.notes,
                dna: opponent.dna,
                dnaSplit: opponent.dnaSplit,
                actionStats: opponent.actionStats,
              }}
            />
          </div>
        )}
      </div>
    </main>
  );
}

export default function OpponentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <OpponentDetailContent id={params.id} />;
}
