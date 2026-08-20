"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TrainerHint from "@/components/TrainerHint";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import {
  listAllStudents,
  type StudentEntry,
} from "@/lib/admin";
import {
  getStudentProgress,
  type StudentProgress,
} from "@/lib/student-progress";
import {
  ATHLETE_LEVEL_LABEL,
  BJJ_BELT_LABEL,
  DISCIPLINE_LABEL,
  WEIGHT_CLASS_LABEL,
} from "@/lib/types";
import Link from "next/link";

// ─── Helper ────────────────────────────────────────────────────────────────

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

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function dateAgo(d: Date | null): string {
  if (!d) return "Noch keine Aktivität";
  const days = Math.floor(
    (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days === 0) return "Heute aktiv";
  if (days === 1) return "Gestern aktiv";
  if (days < 7) return `Vor ${days} Tagen aktiv`;
  if (days < 30) return `Vor ${Math.floor(days / 7)} Woche${Math.floor(days / 7) === 1 ? "" : "n"} aktiv`;
  return `Vor ${Math.floor(days / 30)} Monat${Math.floor(days / 30) === 1 ? "" : "en"} aktiv`;
}

// ─── Stat-Tile ────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  loading,
}: {
  label: string;
  value: string | number | null;
  loading?: boolean;
}) {
  return (
    <div className="text-center">
      <div
        className="text-base font-black"
        style={{
          color: value === null || value === "—" ? "var(--fg-4)" : "var(--ta-cyan)",
        }}
      >
        {loading ? "…" : value === null ? "—" : value}
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

// ─── Schüler-Karte ────────────────────────────────────────────────────────

function StudentCard({
  entry,
  open,
  onToggle,
}: {
  entry: StudentEntry;
  open: boolean;
  onToggle: () => void;
}) {
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);

  const athlete = entry.athlete;

  // Lade Fortschritt erst wenn Karte expandiert wird (spart Reads)
  useEffect(() => {
    if (!open || progress !== null || progressLoading) return;
    let cancelled = false;
    setProgressLoading(true);
    setProgressError(null);
    getStudentProgress(entry.uid)
      .then((p) => {
        if (!cancelled) setProgress(p);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setProgressError(
            err instanceof Error ? err.message : "Daten nicht verfügbar",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setProgressLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, entry.uid, progress, progressLoading]);

  return (
    <div
      className="rounded-2xl"
      style={{
        background: "linear-gradient(180deg, var(--ink-3), var(--ink-2))",
        border: "1px solid var(--ink-4)",
      }}
    >
      {/* Kopf-Zeile (klickbar) */}
      <button
        onClick={onToggle}
        className="flex w-full items-start gap-3 p-4 text-left"
        aria-expanded={open}
      >
        {/* Avatar */}
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

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="font-display-ta truncate text-sm font-bold uppercase"
              style={{ letterSpacing: "0.04em", color: "var(--fg)" }}
            >
              {displayLabel(entry)}
            </span>
            {athlete?.level && (
              <span
                className="font-mono-ta rounded px-1.5 py-0.5 text-[9px] uppercase"
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
            {athlete?.primaryDiscipline && (
              <span
                className="font-mono-ta rounded px-1.5 py-0.5 text-[9px] uppercase"
                style={{
                  letterSpacing: "0.12em",
                  background: "rgba(35,196,206,0.08)",
                  border: "1px solid rgba(35,196,206,0.3)",
                  color: "var(--ta-cyan)",
                }}
              >
                {DISCIPLINE_LABEL[athlete.primaryDiscipline]}
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
          <div
            className="font-mono-ta text-[9px]"
            style={{ letterSpacing: "0.08em", color: "var(--fg-4)" }}
          >
            Seit {formatDate(entry.createdAt)}
          </div>
        </div>

        {/* Toggle-Icon */}
        <span
          className="ml-2 shrink-0 text-xs"
          style={{
            color: "var(--fg-4)",
            transition: "transform 0.2s",
            transform: open ? "rotate(180deg)" : "none",
          }}
          aria-hidden
        >
          ▼
        </span>
      </button>

      {/* Detail-Bereich */}
      {open && (
        <div
          className="border-t px-4 py-4"
          style={{ borderColor: "var(--ink-4)" }}
        >
          {/* Fortschritts-Stats */}
          <div
            className="font-mono-ta mb-2 text-[10px] font-bold uppercase"
            style={{ letterSpacing: "0.18em", color: "var(--fg-3)" }}
          >
            Fortschritt
          </div>

          {progressError ? (
            <div
              className="rounded-xl px-3 py-2.5 text-xs"
              style={{
                background: "rgba(255,79,168,0.06)",
                border: "1px solid rgba(255,79,168,0.3)",
                color: "var(--fg-3)",
              }}
            >
              Fortschrittsdaten konnten nicht geladen werden.
              <span className="ml-1" style={{ color: "var(--fg-4)" }}>
                Prüfe die Firestore-Regeln für Trainer-Zugriff.
              </span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat
                  label="Workouts"
                  value={progress?.workoutsTotal ?? null}
                  loading={progressLoading}
                />
                <Stat
                  label="Bibliothek"
                  value={progress?.libraryCount ?? null}
                  loading={progressLoading}
                />
                <Stat
                  label="Kurs-Abos"
                  value={progress?.subscriptionCount ?? null}
                  loading={progressLoading}
                />
                <Stat
                  label="Teilnahmen"
                  value={progress?.participationCount ?? null}
                  loading={progressLoading}
                />
              </div>

              <div
                className="font-mono-ta mt-3 text-[10px] uppercase"
                style={{ letterSpacing: "0.15em", color: "var(--fg-4)" }}
              >
                {progressLoading
                  ? "Lade Aktivität…"
                  : dateAgo(
                      progress?.lastWorkoutAt ??
                        progress?.lastParticipationAt ??
                        null,
                    )}
              </div>
            </>
          )}

          {/* Athleten-Profil */}
          <div
            className="font-mono-ta mb-2 mt-5 text-[10px] font-bold uppercase"
            style={{ letterSpacing: "0.18em", color: "var(--fg-3)" }}
          >
            Athleten-Profil
          </div>
          {!athlete ||
          (!athlete.primaryDiscipline &&
            !athlete.level &&
            !athlete.weightKg &&
            !athlete.gymName &&
            !athlete.trainerName &&
            !athlete.bjjBelt &&
            !athlete.weightClass) ? (
            <p className="text-xs" style={{ color: "var(--fg-4)" }}>
              Noch keine Daten vorhanden.
            </p>
          ) : (
            <dl className="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
              {athlete.primaryDiscipline && (
                <Row
                  label="Disziplin"
                  value={DISCIPLINE_LABEL[athlete.primaryDiscipline]}
                />
              )}
              {athlete.level && (
                <Row label="Level" value={ATHLETE_LEVEL_LABEL[athlete.level]} />
              )}
              {athlete.bjjBelt && (
                <Row label="BJJ-Gurt" value={BJJ_BELT_LABEL[athlete.bjjBelt]} />
              )}
              {athlete.weightClass && (
                <Row
                  label="Gewichtsklasse"
                  value={WEIGHT_CLASS_LABEL[athlete.weightClass]}
                />
              )}
              {athlete.weightKg != null && (
                <Row label="Gewicht" value={`${athlete.weightKg} kg`} />
              )}
              {athlete.heightCm != null && (
                <Row label="Größe" value={`${athlete.heightCm} cm`} />
              )}
              {athlete.gymName && <Row label="Gym" value={athlete.gymName} />}
              {athlete.trainerName && (
                <Row label="Coach" value={athlete.trainerName} />
              )}
              {athlete.trainingStartDate && (
                <Row
                  label="Trainiert seit"
                  value={formatDate(athlete.trainingStartDate)}
                />
              )}
              {athlete.nextCompetitionDate && (
                <Row
                  label="Nächster Wettkampf"
                  value={`${formatDate(athlete.nextCompetitionDate)}${athlete.nextCompetitionName ? ` — ${athlete.nextCompetitionName}` : ""}`}
                />
              )}
            </dl>
          )}

          {/* Detail-Link: Analyse + Wettkämpfe */}
          <div className="mt-4 flex justify-end">
            <Link
              href={`/trainer/students/${entry.uid}`}
              className="font-mono-ta rounded-lg px-3 py-1.5 text-[10px] uppercase transition-colors"
              style={{
                letterSpacing: "0.18em",
                background: "rgba(35,196,206,0.08)",
                border: "1px solid rgba(35,196,206,0.35)",
                color: "var(--ta-cyan)",
              }}
            >
              Detail + Wettkämpfe →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
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

// ─── Hauptinhalt ──────────────────────────────────────────────────────────

function StudentsContent() {
  const [students, setStudents] = useState<StudentEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Akkordeon: es ist immer nur eine Schüler-Karte gleichzeitig aufgeklappt.
  const [openUid, setOpenUid] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setStudents(null);
    try {
      const data = await listAllStudents();
      setStudents(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      setError(msg);
      setStudents([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students ?? [];
    return (students ?? []).filter((s) => {
      return (
        (s.displayName ?? "").toLowerCase().includes(q) ||
        (s.authProviderName ?? "").toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q) ||
        (s.athlete?.gymName ?? "").toLowerCase().includes(q)
      );
    });
  }, [students, search]);

  return (
    <main className="min-h-screen" style={{ background: "var(--ink-1)" }}>
      {/* Header */}
      <div
        className="relative overflow-hidden border-b px-4 py-10 sm:px-6"
        style={{
          borderColor: "rgba(35,196,206,0.2)",
          background:
            "radial-gradient(400px 250px at 100% 50%, rgba(35,196,206,0.1), transparent 60%), linear-gradient(160deg, #0B0716, #080512)",
        }}
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-2 flex items-center gap-2">
            <span
              className="font-mono-ta rounded px-2 py-0.5 text-[10px] font-black uppercase"
              style={{
                letterSpacing: "0.2em",
                background: "rgba(35,196,206,0.12)",
                border: "1px solid rgba(35,196,206,0.4)",
                color: "var(--ta-cyan)",
              }}
            >
              Trainer
            </span>
          </div>
          <h1
            className="font-display-ta font-black uppercase leading-none"
            style={{ fontSize: "clamp(28px, 5vw, 42px)", letterSpacing: "0.02em" }}
          >
            Schüler & Fortschritt
          </h1>
          <p
            className="font-mono-ta mt-2 text-[11px]"
            style={{ letterSpacing: "0.2em", color: "var(--fg-4)" }}
          >
            Alle Mitglieder · Profil-Daten · Aktivität
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <TrainerHint id="students-overview" title="Schülerprofile">
          Klicke auf einen Schüler, um Fortschritt, Athleten-Profil und letzte
          Aktivität zu sehen. Daten, die noch nicht ausgefüllt wurden, werden
          mit Platzhaltern angezeigt.
        </TrainerHint>

        {error && (
          <div className="mb-6">
            <ErrorState
              title="Schüler konnten nicht geladen werden"
              message={error}
              hint="Prüfe die Firestore-Regeln — Trainer brauchen Lesezugriff auf die users-Collection."
              onRetry={load}
            />
          </div>
        )}

        {/* Suche */}
        <div className="mb-5">
          <input
            type="search"
            placeholder="Suche nach Name, E-Mail oder Gym…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl px-4 py-2.5 text-sm sm:max-w-md"
            style={{
              background: "var(--ink-3)",
              border: "1px solid var(--ink-5)",
              color: "var(--fg-1)",
              outline: "none",
            }}
          />
          {students && (
            <div
              className="font-mono-ta mt-2 text-[10px]"
              style={{ letterSpacing: "0.18em", color: "var(--fg-4)" }}
            >
              {filtered.length} {filtered.length === 1 ? "Schüler" : "Schüler"}
              {filtered.length !== students.length && (
                <span> von {students.length}</span>
              )}
            </div>
          )}
        </div>

        {/* Liste */}
        {students === null && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        )}

        {students !== null && filtered.length === 0 && (
          <div
            className="rounded-2xl p-10 text-center"
            style={{
              border: "1px dashed var(--ink-5)",
              background: "var(--ink-2)",
            }}
          >
            <p className="text-sm" style={{ color: "var(--fg-4)" }}>
              {search
                ? "Keine Schüler gefunden."
                : "Noch keine Schüler registriert."}
            </p>
          </div>
        )}

        {students !== null && filtered.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((entry) => (
              <StudentCard
                key={entry.uid}
                entry={entry}
                open={openUid === entry.uid}
                onToggle={() =>
                  setOpenUid((prev) => (prev === entry.uid ? null : entry.uid))
                }
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function TrainerStudentsPage() {
  return <StudentsContent />;
}
