"use client";

import AdminRoute from "@/components/AdminRoute";
import DashboardHero from "@/components/dashboard/DashboardHero";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import { listAllStudents, type StudentEntry } from "@/lib/admin";
import { useAuth } from "@/lib/auth-context";
import { resolveGymId } from "@/lib/gym";
import {
  clearDemoData,
  countDemoData,
  DEMO_PERSONA_DESCRIPTION,
  DEMO_PERSONA_LABEL,
  seedDemoStudent,
  type DemoPersona,
  type SeedResult,
} from "@/lib/demo-seed";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type DemoCount = {
  workouts: number;
  library: number;
  techniqueProgress: number;
  sparring: number;
  hasDemo: boolean;
};

const PERSONAS: DemoPersona[] = ["beginner", "intermediate", "competitor"];

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

function StudentSeedCard({
  entry,
  count,
  onSeed,
  onClear,
  busyAction,
  lastResult,
  error,
}: {
  entry: StudentEntry;
  count: DemoCount | null;
  onSeed: (uid: string, persona: DemoPersona) => Promise<void>;
  onClear: (uid: string) => Promise<void>;
  busyAction: { type: "seed" | "clear"; persona?: DemoPersona } | null;
  lastResult: SeedResult | null;
  error: string | null;
}) {
  const [persona, setPersona] = useState<DemoPersona>("competitor");
  const isBusy = busyAction !== null;

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: "linear-gradient(180deg, var(--ink-3), var(--ink-2))",
        border: count?.hasDemo
          ? "1px solid rgba(35,196,206,0.4)"
          : "1px solid var(--ink-4)",
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display-ta text-sm font-black"
          style={{
            background: "rgba(35,196,206,0.1)",
            border: "1px solid rgba(35,196,206,0.35)",
            color: "var(--ta-cyan)",
          }}
        >
          {initialsOf(entry)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="font-display-ta truncate text-sm font-bold uppercase"
              style={{ letterSpacing: "0.04em", color: "var(--fg)" }}
            >
              {displayLabel(entry)}
            </span>
            {count?.hasDemo && (
              <span
                className="font-mono-ta rounded px-1.5 py-0.5 text-[9px] uppercase"
                style={{
                  letterSpacing: "0.15em",
                  background: "rgba(35,196,206,0.12)",
                  border: "1px solid rgba(35,196,206,0.4)",
                  color: "var(--ta-cyan)",
                }}
              >
                Demo aktiv
              </span>
            )}
          </div>
          {entry.email && (
            <div
              className="font-mono-ta mt-0.5 truncate text-[10px]"
              style={{ letterSpacing: "0.08em", color: "var(--fg-4)" }}
            >
              {entry.email}
            </div>
          )}
        </div>
      </div>

      {/* Count grid */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        {[
          { label: "Workouts", value: count?.workouts ?? null },
          { label: "Library", value: count?.library ?? null },
          { label: "Tech-Prog", value: count?.techniqueProgress ?? null },
          { label: "Sparring", value: count?.sparring ?? null },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-lg px-2 py-2 text-center"
            style={{
              background: "var(--ink-3)",
              border: "1px solid var(--ink-4)",
            }}
          >
            <div
              className="font-display-ta text-sm font-black"
              style={{
                color:
                  m.value === null
                    ? "var(--fg-4)"
                    : m.value > 0
                      ? "var(--ta-cyan)"
                      : "var(--fg-4)",
              }}
            >
              {count === null ? "…" : (m.value ?? 0)}
            </div>
            <div
              className="font-mono-ta text-[8px] uppercase"
              style={{ letterSpacing: "0.12em", color: "var(--fg-4)" }}
            >
              {m.label}
            </div>
          </div>
        ))}
      </div>

      {/* Persona selector */}
      <div className="mt-4">
        <div
          className="font-mono-ta mb-1.5 text-[10px] uppercase"
          style={{ letterSpacing: "0.15em", color: "var(--fg-3)" }}
        >
          Persona auswählen
        </div>
        <div className="flex flex-col gap-1.5">
          {PERSONAS.map((p) => {
            const active = persona === p;
            return (
              <button
                key={p}
                onClick={() => setPersona(p)}
                disabled={isBusy}
                className="rounded-lg px-3 py-2 text-left text-xs font-bold transition-all"
                style={{
                  background: active
                    ? "rgba(35,196,206,0.1)"
                    : "var(--ink-3)",
                  border: `1px solid ${
                    active ? "rgba(35,196,206,0.4)" : "var(--ink-5)"
                  }`,
                  color: active ? "var(--ta-cyan)" : "var(--fg-3)",
                  opacity: isBusy ? 0.6 : 1,
                  cursor: isBusy ? "not-allowed" : "pointer",
                }}
              >
                <div
                  className="font-display-ta uppercase"
                  style={{ letterSpacing: "0.04em", fontSize: "12px" }}
                >
                  {DEMO_PERSONA_LABEL[p]}
                </div>
                <div
                  className="font-mono-ta mt-0.5 text-[10px]"
                  style={{ color: "var(--fg-4)" }}
                >
                  {DEMO_PERSONA_DESCRIPTION[p]}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          onClick={() => onSeed(entry.uid, persona)}
          disabled={isBusy}
          className="btn-primary flex-1 px-4 py-2 text-xs"
          style={{
            opacity: isBusy ? 0.6 : 1,
            cursor: isBusy ? "not-allowed" : "pointer",
          }}
        >
          {busyAction?.type === "seed" && busyAction.persona === persona
            ? "Schreibe Daten…"
            : count?.hasDemo
              ? "Demo neu erzeugen"
              : "Demo-Daten erzeugen"}
        </button>
        <button
          onClick={() => onClear(entry.uid)}
          disabled={isBusy || !count?.hasDemo}
          className="btn-secondary flex-1 px-4 py-2 text-xs"
          style={{
            opacity: isBusy || !count?.hasDemo ? 0.5 : 1,
            cursor: isBusy || !count?.hasDemo ? "not-allowed" : "pointer",
          }}
        >
          {busyAction?.type === "clear" ? "Lösche…" : "Demo löschen"}
        </button>
      </div>

      {/* Result */}
      {lastResult && (
        <div
          className="mt-3 rounded-lg px-3 py-2 text-[10px]"
          style={{
            background: "rgba(35,196,206,0.06)",
            border: "1px solid rgba(35,196,206,0.3)",
            color: "var(--fg-2)",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.1em",
          }}
        >
          ✓ {lastResult.workouts} Workouts · {lastResult.library} Library ·{" "}
          {lastResult.participations} Teilnahmen · {lastResult.techniqueProgress}{" "}
          Tech-Progress · {lastResult.sparring} Sparring ·{" "}
          {lastResult.subscriptions} Abos · {lastResult.weight} Weight-Logs
        </div>
      )}

      {error && (
        <div
          className="mt-3 rounded-lg px-3 py-2 text-[10px]"
          style={{
            background: "rgba(255,79,168,0.06)",
            border: "1px solid rgba(255,79,168,0.3)",
            color: "var(--ta-pink)",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.08em",
          }}
        >
          ✗ {error}
        </div>
      )}

      {/* View link */}
      <div className="mt-3 text-center">
        <Link
          href={`/trainer/students/${entry.uid}`}
          className="font-mono-ta text-[10px] uppercase"
          style={{ letterSpacing: "0.15em", color: "var(--ta-cyan)" }}
        >
          Schülerprofil öffnen →
        </Link>
      </div>
    </div>
  );
}

function SeedContent() {
  const { profile } = useAuth();
  const gymId = resolveGymId(profile);
  const [students, setStudents] = useState<StudentEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, DemoCount>>({});
  const [busy, setBusy] = useState<
    Record<string, { type: "seed" | "clear"; persona?: DemoPersona } | null>
  >({});
  const [results, setResults] = useState<Record<string, SeedResult>>({});
  const [perStudentError, setPerStudentError] = useState<Record<string, string>>(
    {},
  );

  const loadStudents = useCallback(async () => {
    setError(null);
    setStudents(null);
    try {
      const data = await listAllStudents(gymId);
      setStudents(data);
      // Counts parallel laden
      const entries = await Promise.all(
        data.map(async (s) => {
          try {
            return [s.uid, await countDemoData(s.uid)] as const;
          } catch {
            return [
              s.uid,
              {
                workouts: 0,
                library: 0,
                techniqueProgress: 0,
                sparring: 0,
                hasDemo: false,
              },
            ] as const;
          }
        }),
      );
      setCounts(Object.fromEntries(entries));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      setError(msg);
      setStudents([]);
    }
  }, [gymId]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const handleSeed = useCallback(
    async (uid: string, persona: DemoPersona) => {
      setBusy((s) => ({ ...s, [uid]: { type: "seed", persona } }));
      setPerStudentError((s) => ({ ...s, [uid]: "" }));
      try {
        const result = await seedDemoStudent(uid, persona);
        setResults((r) => ({ ...r, [uid]: result }));
        const c = await countDemoData(uid);
        setCounts((s) => ({ ...s, [uid]: c }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Fehler beim Seeding";
        setPerStudentError((s) => ({ ...s, [uid]: msg }));
      } finally {
        setBusy((s) => ({ ...s, [uid]: null }));
      }
    },
    [],
  );

  const handleClear = useCallback(async (uid: string) => {
    setBusy((s) => ({ ...s, [uid]: { type: "clear" } }));
    setPerStudentError((s) => ({ ...s, [uid]: "" }));
    try {
      await clearDemoData(uid);
      setResults((r) => {
        const next = { ...r };
        delete next[uid];
        return next;
      });
      const c = await countDemoData(uid);
      setCounts((s) => ({ ...s, [uid]: c }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fehler beim Löschen";
      setPerStudentError((s) => ({ ...s, [uid]: msg }));
    } finally {
      setBusy((s) => ({ ...s, [uid]: null }));
    }
  }, []);

  const totalDemo = useMemo(
    () => Object.values(counts).filter((c) => c.hasDemo).length,
    [counts],
  );

  return (
    <main className="min-h-screen">
      <DashboardHero
        badges={[{ label: "Admin · Demo", accent: "amber", icon: "shield" }]}
        accent="amber"
        title="Demo-Daten verwalten"
        subtitle={`Testschüler · Realistische Fortschrittsdaten · ${totalDemo} aktiv`}
      />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Info-Block */}
        <div className="mb-6">
          <p
            className="font-mono-ta text-[10px] uppercase"
            style={{ letterSpacing: "0.18em", color: "var(--fg-3)" }}
          >
            Was passiert hier?
          </p>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--fg-2)" }}>
            Demo-Daten füllen einen Testschüler-Account mit realistischen, frei
            erfundenen Trainingsverläufen. Jeder Datensatz trägt das Feld{" "}
            <code
              className="rounded px-1 py-0.5"
              style={{
                background: "var(--ink-3)",
                border: "1px solid var(--ink-5)",
                color: "var(--ta-cyan)",
              }}
            >
              isDemo: true
            </code>{" "}
            — &bdquo;Demo löschen&ldquo; entfernt nur diese Einträge und tastet echte Daten
            nicht an. Trainer können dann im Schülerprofil + Wettkampfbereich
            sehen, wie Analysen mit echten Daten aussehen würden.
          </p>
          <p className="mt-2 text-xs" style={{ color: "var(--fg-4)" }}>
            <strong style={{ color: "var(--ta-pink)" }}>Hinweis:</strong>{" "}
            Firestore-Regeln müssen Admin-Schreibzugriff auf{" "}
            <code style={{ color: "var(--ta-cyan)" }}>users/&#123;uid&#125;/*</code>{" "}
            erlauben. Wenn nicht: passe rules entsprechend an.
          </p>
        </div>

        {error && (
          <div className="mb-6">
            <ErrorState
              title="Schüler konnten nicht geladen werden"
              message={error}
              onRetry={loadStudents}
            />
          </div>
        )}

        {students === null && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-72 w-full rounded-2xl" />
            ))}
          </div>
        )}

        {students !== null && students.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-sm" style={{ color: "var(--fg-4)" }}>
              Noch keine Schüler registriert.
            </p>
          </div>
        )}

        {students !== null && students.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {students.map((entry) => (
              <StudentSeedCard
                key={entry.uid}
                entry={entry}
                count={counts[entry.uid] ?? null}
                onSeed={handleSeed}
                onClear={handleClear}
                busyAction={busy[entry.uid] ?? null}
                lastResult={results[entry.uid] ?? null}
                error={perStudentError[entry.uid] || null}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function AdminSeedPage() {
  return (
    <AdminRoute>
      <SeedContent />
    </AdminRoute>
  );
}
