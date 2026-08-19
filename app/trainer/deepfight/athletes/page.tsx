"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import Icon from "@/components/ui/Icon";
import DeepFightWordmark from "@/components/DeepFightWordmark";
import { listAllStudents, type StudentEntry } from "@/lib/admin";
import { DISCIPLINE_LABEL } from "@/lib/types";

function labelOf(s: StudentEntry): string {
  return s.displayName ?? s.authProviderName ?? s.email ?? s.uid;
}

function initialsOf(s: StudentEntry): string {
  const parts = labelOf(s).trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * DeepFight → Schüler-Analysen: Einstieg in die „umgekehrte" DeepFight-
 * Richtung — statt Gegner zu scouten wird der eigene Schüler ausgewertet.
 * Die Analyse selbst lebt unter /trainer/deepfight/athletes/[uid] und ist
 * zusätzlich vom Schülerprofil aus verlinkt.
 */
export default function DeepFightAthletesPage() {
  const [students, setStudents] = useState<StudentEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setError(null);
    setStudents(null);
    try {
      setStudents(await listAllStudents());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!students) return null;
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => labelOf(s).toLowerCase().includes(q));
  }, [students, search]);

  return (
    <main className="min-h-screen" style={{ background: "var(--ink-1)" }}>
      {/* Kopf */}
      <div
        className="relative overflow-hidden border-b px-4 py-8 sm:px-6"
        style={{
          borderColor: "rgba(157,123,250,0.25)",
          background:
            "radial-gradient(500px 250px at 100% 50%, rgba(157,123,250,0.12), transparent 60%), linear-gradient(160deg, #0B0716, #080512)",
        }}
      >
        <div className="mx-auto max-w-7xl">
          <h1
            className="font-display-ta flex items-center gap-3 font-black uppercase leading-none"
            style={{
              fontSize: "clamp(24px, 4vw, 36px)",
              letterSpacing: "0.02em",
            }}
          >
            <DeepFightWordmark />
          </h1>
          <p
            className="font-mono-ta mt-2 text-[11px] uppercase"
            style={{ letterSpacing: "0.2em", color: "var(--fg-4)" }}
          >
            Schüler-Analysen · Eigene Athleten auswerten
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-xs" style={{ color: "var(--fg-4)" }}>
            Wähle einen Schüler: DeepFight wertet seine Kampf-Videos aus —
            Ergebnisse lassen sich anschließend für ihn freigeben.
          </p>
          <Link
            href="/trainer/opponents"
            className="btn-secondary px-4 py-2 text-xs"
          >
            <Icon name="shield" size={14} />
            Gegner-Scouting
          </Link>
        </div>

        {/* Suche */}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Schüler suchen …"
          className="mt-4 w-full max-w-sm rounded-xl px-3 py-2 text-sm"
          style={{
            background: "var(--ink-2)",
            border: "1px solid var(--ink-5)",
            color: "var(--fg)",
          }}
        />

        <div className="mt-5">
          {error ? (
            <ErrorState
              title="Schüler konnten nicht geladen werden"
              message={error}
              onRetry={load}
            />
          ) : filtered === null ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
            </div>
          ) : filtered.length === 0 ? (
            <div
              className="rounded-2xl p-10 text-center"
              style={{
                background: "var(--ink-2)",
                border: "1px dashed var(--ink-5)",
              }}
            >
              <p className="text-sm font-bold" style={{ color: "var(--fg-3)" }}>
                Keine Schüler gefunden.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((s) => (
                <Link
                  key={s.uid}
                  href={`/trainer/deepfight/athletes/${s.uid}`}
                  className="flex items-center gap-3 rounded-2xl p-4 transition-colors"
                  style={{
                    background: "var(--ink-2)",
                    border: "1px solid var(--ink-4)",
                    textDecoration: "none",
                  }}
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-display-ta text-sm font-black"
                    style={{
                      background: "rgba(157,123,250,0.1)",
                      border: "1px solid rgba(157,123,250,0.4)",
                      color: "#9D7BFA",
                    }}
                  >
                    {initialsOf(s)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-sm font-bold"
                      style={{ color: "var(--fg)" }}
                    >
                      {labelOf(s)}
                    </span>
                    <span
                      className="font-mono-ta block text-[9px] uppercase"
                      style={{ letterSpacing: "0.14em", color: "var(--fg-4)" }}
                    >
                      {s.athlete?.primaryDiscipline
                        ? DISCIPLINE_LABEL[s.athlete.primaryDiscipline]
                        : "Analyse starten"}
                    </span>
                  </span>
                  <span style={{ color: "var(--fg-4)", lineHeight: 0 }}>
                    <Icon name="arrow-right" size={14} />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
