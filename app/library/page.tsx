"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth-context";
import {
  addToLibrary,
  getLibrary,
  removeFromLibrary,
} from "@/lib/training-sessions";
import { EXERCISES, getExerciseById } from "@/lib/exercises";
import type { Category, Exercise, LibraryEntry } from "@/lib/types";

// ─── Hilfskonstanten ───────────────────────────────────────────────────────

const CATEGORY_STYLE: Record<string, { label: string; color: string }> = {
  boxing:      { label: "Boxing",    color: "#FB923C" },
  wrestling:   { label: "Ringen",    color: "#60A5FA" },
  bjj:         { label: "BJJ",       color: "#C084FC" },
  "muay-thai": { label: "Muay Thai", color: "#F87171" },
};

const KIND_LABEL: Record<string, string> = {
  warmup:       "Aufwärmen",
  technique:    "Technik",
  conditioning: "Kondition",
  cooldown:     "Cooldown",
};

const ALL_CATEGORIES: Array<Category | "all"> = [
  "all", "boxing", "wrestling", "bjj", "muay-thai",
];

const CATEGORY_FILTER_LABEL: Record<string, string> = {
  all:         "Alle",
  boxing:      "Boxing",
  wrestling:   "Ringen",
  bjj:         "BJJ",
  "muay-thai": "Muay Thai",
};

// ─── Typen ─────────────────────────────────────────────────────────────────

interface EnrichedEntry extends LibraryEntry {
  exercise: Exercise | undefined;
}

// ─── Hauptkomponente ───────────────────────────────────────────────────────

export default function LibraryPage() {
  return (
    <ProtectedRoute>
      <LibraryContent />
    </ProtectedRoute>
  );
}

function LibraryContent() {
  const { user } = useAuth();

  const [entries, setEntries] = useState<EnrichedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<Category | "all">("all");
  const [showBrowse, setShowBrowse] = useState(false);
  const [browseSearch, setBrowseSearch] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadLibrary = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const raw = await getLibrary(user.uid);
      setEntries(
        raw.map((e) => ({ ...e, exercise: getExerciseById(e.exerciseId) })),
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  async function handleManualAdd(exerciseId: string) {
    if (!user) return;
    setAddingId(exerciseId);
    try {
      await addToLibrary(user.uid, exerciseId, "manual");
      await loadLibrary();
    } finally {
      setAddingId(null);
    }
  }

  async function handleRemove(exerciseId: string) {
    if (!user) return;
    setRemovingId(exerciseId);
    try {
      await removeFromLibrary(user.uid, exerciseId);
      setEntries((prev) => prev.filter((e) => e.exerciseId !== exerciseId));
    } finally {
      setRemovingId(null);
    }
  }

  const savedIds = new Set(entries.map((e) => e.exerciseId));

  // Filter nach Kategorie
  const filtered = entries.filter((e) => {
    if (filterCat === "all") return true;
    if (!e.exercise) return false;
    return e.exercise.category === filterCat || e.exercise.category === "any";
  });

  const recent = entries.slice(0, 3);

  // Browse-Liste: alle Übungen minus bereits gespeicherte, dann gefiltert
  const browseList = EXERCISES.filter((e) => {
    if (
      browseSearch &&
      !e.name.toLowerCase().includes(browseSearch.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen" style={{ background: "var(--ink-1)" }}>
      {/* Header */}
      <div
        className="border-b px-4 py-8 sm:px-6"
        style={{ borderColor: "var(--ink-4)" }}
      >
        <div className="mx-auto flex max-w-3xl items-end justify-between gap-4">
          <div>
            <p
              className="mb-1 font-mono-ta text-xs uppercase"
              style={{ letterSpacing: "0.25em", color: "var(--ta-cyan)" }}
            >
              Persönlich
            </p>
            <h1
              className="font-display-ta text-3xl font-black uppercase sm:text-4xl"
              style={{ letterSpacing: "0.04em", color: "var(--fg-1)" }}
            >
              Meine Bibliothek
            </h1>
            <p
              className="mt-1 text-sm"
              style={{ color: "var(--fg-3)" }}
            >
              {loading
                ? "Lade…"
                : entries.length === 0
                  ? "Noch keine Übungen — besuche ein Training oder füge manuell hinzu."
                  : `${entries.length} Übung${entries.length !== 1 ? "en" : ""} gespeichert`}
            </p>
          </div>
          <button
            onClick={() => {
              setShowBrowse(true);
              setBrowseSearch("");
            }}
            className="shrink-0 rounded-xl px-4 py-2 text-xs font-bold uppercase transition-colors"
            style={{
              background: "var(--ta-cyan)",
              color: "var(--ink-1)",
              letterSpacing: "0.1em",
            }}
          >
            + Hinzufügen
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-16 animate-pulse rounded-xl"
                style={{ background: "var(--ink-3)" }}
              />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Zuletzt hinzugefügt */}
            {recent.length > 0 && (
              <section className="mb-8">
                <SectionTitle>Zuletzt hinzugefügt</SectionTitle>
                <div className="space-y-2">
                  {recent.map((entry) => (
                    <LibraryCard
                      key={entry.exerciseId}
                      entry={entry}
                      removing={removingId === entry.exerciseId}
                      onRemove={() => handleRemove(entry.exerciseId)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Alle Übungen mit Kategorie-Filter */}
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <SectionTitle>Alle Übungen</SectionTitle>
                {/* Kategorie-Tabs */}
                <div className="flex flex-wrap gap-1">
                  {ALL_CATEGORIES.map((cat) => {
                    const active = filterCat === cat;
                    const style =
                      cat !== "all" ? CATEGORY_STYLE[cat] : null;
                    return (
                      <button
                        key={cat}
                        onClick={() => setFilterCat(cat as Category | "all")}
                        className="rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase transition-colors"
                        style={{
                          background: active
                            ? style?.color ?? "var(--ta-cyan)"
                            : "var(--ink-3)",
                          color: active ? "var(--ink-1)" : "var(--fg-3)",
                          border: `1px solid ${active ? "transparent" : "var(--ink-5)"}`,
                          letterSpacing: "0.08em",
                        }}
                      >
                        {CATEGORY_FILTER_LABEL[cat]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {filtered.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--fg-4)" }}>
                  Keine Übungen in dieser Kategorie.
                </p>
              ) : (
                <div className="space-y-2">
                  {filtered.map((entry) => (
                    <LibraryCard
                      key={entry.exerciseId}
                      entry={entry}
                      removing={removingId === entry.exerciseId}
                      onRemove={() => handleRemove(entry.exerciseId)}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* Hinweis auf Stundenplan */}
        {!loading && (
          <div
            className="mt-8 rounded-xl p-4"
            style={{
              background: "var(--ink-3)",
              border: "1px solid var(--ink-4)",
            }}
          >
            <p
              className="mb-1 text-xs font-bold uppercase"
              style={{
                color: "var(--ta-cyan)",
                letterSpacing: "0.1em",
                fontFamily: "var(--font-mono)",
              }}
            >
              Tipp
            </p>
            <p className="text-sm" style={{ color: "var(--fg-3)" }}>
              Klicke im{" "}
              <Link
                href="/schedule"
                className="font-bold underline"
                style={{ color: "var(--ta-cyan)" }}
              >
                Stundenplan
              </Link>{" "}
              auf ein Training und wähle „Ich nehme teil" — alle Übungen der
              Einheit werden automatisch hier gespeichert.
            </p>
          </div>
        )}
      </div>

      {/* Browse-Modal */}
      {showBrowse && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          style={{ background: "rgba(3,4,6,0.85)" }}
          onClick={(e) => e.target === e.currentTarget && setShowBrowse(false)}
        >
          <div
            className="w-full max-h-[90vh] overflow-y-auto rounded-t-2xl sm:max-w-lg sm:rounded-2xl"
            style={{
              background: "var(--ink-2)",
              border: "1px solid var(--ink-4)",
            }}
          >
            <div className="p-5">
              {/* Browse-Header */}
              <div className="mb-4 flex items-center justify-between">
                <h2
                  className="font-display-ta text-lg font-black uppercase"
                  style={{ letterSpacing: "0.04em", color: "var(--fg-1)" }}
                >
                  Übungen durchsuchen
                </h2>
                <button
                  onClick={() => setShowBrowse(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-sm"
                  style={{
                    background: "var(--ink-4)",
                    color: "var(--fg-3)",
                    border: "1px solid var(--ink-5)",
                  }}
                  aria-label="Schließen"
                >
                  ✕
                </button>
              </div>

              <input
                type="text"
                placeholder="Übung suchen…"
                value={browseSearch}
                onChange={(e) => setBrowseSearch(e.target.value)}
                autoFocus
                className="mb-3 w-full rounded-lg px-3 py-2 text-sm"
                style={{
                  background: "var(--ink-3)",
                  border: "1px solid var(--ink-5)",
                  color: "var(--fg-1)",
                  outline: "none",
                }}
              />

              <div className="space-y-1.5">
                {browseList.map((ex) => {
                  const alreadySaved = savedIds.has(ex.id);
                  const catStyle =
                    ex.category !== "any"
                      ? CATEGORY_STYLE[ex.category]
                      : null;
                  return (
                    <div
                      key={ex.id}
                      className="flex items-center gap-3 rounded-lg px-3 py-2"
                      style={{
                        background: alreadySaved
                          ? "rgba(0,212,230,.06)"
                          : "var(--ink-3)",
                        border: `1px solid ${alreadySaved ? "rgba(0,212,230,.2)" : "var(--ink-4)"}`,
                      }}
                    >
                      <div
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: catStyle?.color ?? "var(--fg-4)" }}
                      />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span
                          className="truncate text-sm font-medium"
                          style={{ color: "var(--fg-1)" }}
                        >
                          {ex.name}
                        </span>
                        <span
                          className="text-[10px]"
                          style={{
                            color: "var(--fg-4)",
                            fontFamily: "var(--font-mono)",
                            letterSpacing: "0.06em",
                          }}
                        >
                          {catStyle?.label ?? "Allgemein"} ·{" "}
                          {KIND_LABEL[ex.kind] ?? ex.kind}
                        </span>
                      </div>
                      {alreadySaved ? (
                        <span
                          className="shrink-0 text-[10px] font-bold uppercase"
                          style={{ color: "var(--ta-cyan)" }}
                        >
                          ✓ Gespeichert
                        </span>
                      ) : (
                        <button
                          onClick={() => handleManualAdd(ex.id)}
                          disabled={addingId === ex.id}
                          className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase transition-opacity"
                          style={{
                            background: "var(--ta-cyan)",
                            color: "var(--ink-1)",
                            letterSpacing: "0.08em",
                            opacity: addingId === ex.id ? 0.6 : 1,
                          }}
                        >
                          {addingId === ex.id ? "…" : "+ Speichern"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ─── LibraryCard ──────────────────────────────────────────────────────────

function LibraryCard({
  entry,
  removing,
  onRemove,
}: {
  entry: EnrichedEntry;
  removing: boolean;
  onRemove: () => void;
}) {
  const ex = entry.exercise;
  const catStyle =
    ex && ex.category !== "any" ? CATEGORY_STYLE[ex.category] : null;

  const dateStr = entry.addedAt.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
  });

  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3 py-3"
      style={{
        background: "var(--ink-3)",
        border: "1px solid var(--ink-4)",
        borderLeft: `3px solid ${catStyle?.color ?? "var(--fg-4)"}`,
        opacity: removing ? 0.5 : 1,
        transition: "opacity 0.2s",
      }}
    >
      <div className="min-w-0 flex-1">
        <div
          className="truncate text-sm font-bold"
          style={{ color: "var(--fg-1)" }}
        >
          {ex?.name ?? entry.exerciseId}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {catStyle && (
            <span
              className="text-[10px] font-bold uppercase"
              style={{
                color: catStyle.color,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.06em",
              }}
            >
              {catStyle.label}
            </span>
          )}
          {ex && (
            <span
              className="text-[10px]"
              style={{ color: "var(--fg-4)", fontFamily: "var(--font-mono)" }}
            >
              {KIND_LABEL[ex.kind] ?? ex.kind}
            </span>
          )}
          <span
            className="text-[10px]"
            style={{ color: "var(--fg-4)" }}
          >
            {entry.source === "training" ? (
              <>
                📋{" "}
                {entry.contextLabel ?? "Training"}
              </>
            ) : (
              "✋ Manuell"
            )}
          </span>
          <span
            className="text-[10px]"
            style={{ color: "var(--fg-4)" }}
          >
            {dateStr}
          </span>
        </div>
      </div>
      <button
        onClick={onRemove}
        disabled={removing}
        className="shrink-0 rounded-lg px-2 py-1 text-[11px] transition-colors"
        style={{ color: "var(--fg-4)" }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLElement).style.color = "var(--ta-pink)")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLElement).style.color = "var(--fg-4)")
        }
        aria-label="Entfernen"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Hilfskomponenten ─────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-2 text-xs font-bold uppercase"
      style={{
        color: "var(--fg-3)",
        letterSpacing: "0.12em",
        fontFamily: "var(--font-mono)",
      }}
    >
      {children}
    </p>
  );
}

function EmptyState() {
  return (
    <div className="py-12 text-center">
      <div
        className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
        style={{ background: "var(--ink-3)" }}
      >
        📚
      </div>
      <h3
        className="mb-2 font-display-ta text-lg font-black uppercase"
        style={{ color: "var(--fg-2)", letterSpacing: "0.04em" }}
      >
        Bibliothek leer
      </h3>
      <p className="mb-6 text-sm" style={{ color: "var(--fg-4)" }}>
        Besuche ein Training im Stundenplan oder füge Übungen manuell hinzu.
      </p>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/schedule"
          className="rounded-xl px-5 py-2.5 text-xs font-bold uppercase"
          style={{
            background: "var(--ta-cyan)",
            color: "var(--ink-1)",
            letterSpacing: "0.1em",
            textDecoration: "none",
          }}
        >
          Zum Stundenplan
        </Link>
      </div>
    </div>
  );
}
