"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import DeepFightWordmark from "@/components/DeepFightWordmark";
import OpponentEditor, {
  type OpponentEditorValue,
} from "@/components/trainer/OpponentEditor";
import { useAuth } from "@/lib/auth-context";
import { resolveGymId } from "@/lib/gym";
import { isStaffEntry, listAllMembers, type StudentEntry } from "@/lib/admin";
import {
  createOpponent,
  getOpponent,
  listOpponentsForGym,
  opponentToSnapshot,
  searchOpponents,
  type Opponent,
} from "@/lib/opponents";
import { createFightCamp } from "@/lib/fight-camp";
import { generateFightCamp } from "@/lib/fight-camp-generator";
import { analyzeTrainingHistory } from "@/lib/fight-camp-analysis";
import { getRecentWorkouts } from "@/lib/workouts";
import { getAllProgress } from "@/lib/extensions/technique-progress";
import { FIGHT_STYLE_LABEL } from "@/lib/fight-camp";
import { totalAnswered } from "@/lib/gegner-dna";
import { ATHLETE_LEVEL_LABEL, type TechniqueProgress } from "@/lib/types";

function studentLabel(s: StudentEntry): string {
  return s.displayName ?? s.authProviderName ?? s.email ?? s.uid;
}

/**
 * Zweite Zeile der Athleten-Karte: bei Trainern/Admins zuerst die Rolle
 * (sonst wäre nicht erkennbar, dass hier ein Coach als Athlet antritt),
 * danach — wenn gepflegt — das Athleten-Level.
 */
function athleteSubLabel(s: StudentEntry): string | null {
  const level = s.athlete?.level ? ATHLETE_LEVEL_LABEL[s.athlete.level] : null;
  if (!isStaffEntry(s)) return level;
  const role = s.role === "admin" ? "Admin" : "Trainer";
  return level ? `${role} · ${level}` : role;
}

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  letterSpacing: "0.15em",
  color: "var(--fg-3)",
};
const fieldStyle: React.CSSProperties = {
  background: "var(--ink-3)",
  border: "1px solid var(--ink-5)",
  color: "var(--fg-1)",
  outline: "none",
};

function StepHeader({ n, title }: { n: number; title: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span
        className="font-display-ta flex h-7 w-7 items-center justify-center rounded-lg text-sm font-black"
        style={{
          background: "rgba(255,79,168,0.1)",
          border: "1px solid rgba(255,79,168,0.4)",
          color: "var(--ta-pink)",
        }}
      >
        {n}
      </span>
      <h2
        className="font-display-ta font-black uppercase"
        style={{ fontSize: "16px", letterSpacing: "0.05em" }}
      >
        {title}
      </h2>
    </div>
  );
}

function AthleteCard({
  entry,
  active,
  onSelect,
}: {
  entry: StudentEntry;
  active: boolean;
  onSelect: () => void;
}) {
  const sub = athleteSubLabel(entry);
  return (
    <button
      onClick={onSelect}
      className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors"
      style={{
        background: active ? "rgba(35,196,206,0.1)" : "var(--ink-3)",
        border: `1px solid ${active ? "var(--ta-cyan)" : "var(--ink-5)"}`,
      }}
    >
      <span
        className="font-display-ta flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black"
        style={{
          background: "var(--ink-4)",
          color: active ? "var(--ta-cyan)" : "var(--fg-3)",
        }}
      >
        {studentLabel(entry).slice(0, 2).toUpperCase()}
      </span>
      <span className="min-w-0">
        <span
          className="block truncate text-sm font-bold"
          style={{ color: active ? "var(--ta-cyan)" : "var(--fg-2)" }}
        >
          {studentLabel(entry)}
        </span>
        {sub && (
          <span
            className="font-mono-ta block truncate text-[9px] uppercase"
            style={{ letterSpacing: "0.1em", color: "var(--fg-4)" }}
          >
            {sub}
          </span>
        )}
      </span>
    </button>
  );
}

function AthleteGroup({
  title,
  accent,
  entries,
  selectedUid,
  onSelect,
}: {
  title: string;
  accent: string;
  entries: StudentEntry[];
  selectedUid: string | null;
  onSelect: (uid: string) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <div>
      <p
        className="font-mono-ta mb-2 text-[9px] font-bold uppercase"
        style={{ letterSpacing: "0.18em", color: accent }}
      >
        {title}
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {entries.map((e) => (
          <AthleteCard
            key={e.uid}
            entry={e}
            active={e.uid === selectedUid}
            onSelect={() => onSelect(e.uid)}
          />
        ))}
      </div>
    </div>
  );
}

function NewCompetitionContent() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const gymId = resolveGymId(profile);

  const [members, setMembers] = useState<StudentEntry[] | null>(null);
  const [opponents, setOpponents] = useState<Opponent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [studentUid, setStudentUid] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState("");

  const [oppMode, setOppMode] = useState<"existing" | "new">("existing");
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null);
  const [oppSearch, setOppSearch] = useState("");
  const [creatingOpp, setCreatingOpp] = useState(false);

  const [name, setName] = useState("");
  const defaultDate = useMemo(
    () =>
      new Date(Date.now() + 84 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    [],
  );
  const [date, setDate] = useState(defaultDate);

  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [memberList, opponentList] = await Promise.all([
        listAllMembers().catch(() => [] as StudentEntry[]),
        listOpponentsForGym(gymId).catch(() => [] as Opponent[]),
      ]);
      setMembers(memberList);
      setOpponents(opponentList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setMembers([]);
      setOpponents([]);
    }
  }, [gymId]);

  useEffect(() => {
    load();
  }, [load]);

  // Vorauswahl aus Query-Parametern (?student= / ?opponent=)
  useEffect(() => {
    const s = searchParams.get("student");
    if (s) setStudentUid(s);
    const o = searchParams.get("opponent");
    if (o) {
      setSelectedOpponentId(o);
      setOppMode("existing");
    }
  }, [searchParams]);

  const filteredMembers = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    const list = members ?? [];
    if (!q) return list;
    return list.filter(
      (s) =>
        studentLabel(s).toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q),
    );
  }, [members, studentSearch]);

  // Trainer sind ebenfalls Athleten — sie stehen nur in eigenen Gruppen, damit
  // niemand sie versehentlich statt eines Schülers erwischt.
  const selfEntry = useMemo(
    () => filteredMembers.find((s) => s.uid === user?.uid) ?? null,
    [filteredMembers, user?.uid],
  );
  const staffEntries = useMemo(
    () =>
      filteredMembers
        .filter((s) => s.uid !== user?.uid && isStaffEntry(s))
        .sort((a, b) => studentLabel(a).localeCompare(studentLabel(b), "de")),
    [filteredMembers, user?.uid],
  );
  const studentEntries = useMemo(
    () => filteredMembers.filter((s) => s.uid !== user?.uid && !isStaffEntry(s)),
    [filteredMembers, user?.uid],
  );

  const filteredOpponents = useMemo(
    () => searchOpponents(opponents ?? [], oppSearch),
    [opponents, oppSearch],
  );

  const selectedStudent = members?.find((s) => s.uid === studentUid) ?? null;
  const selectedOpponent =
    opponents?.find((o) => o.id === selectedOpponentId) ?? null;

  const canSubmit =
    !!studentUid && !!selectedOpponentId && !!name.trim() && !!date;

  // Neue Gegner-DNA inline anlegen → wird ausgewählt
  async function handleCreateOpponent(value: OpponentEditorValue) {
    if (!user) return;
    setCreatingOpp(true);
    setError(null);
    try {
      const created = await createOpponent({
        gymId,
        createdBy: user.uid,
        createdByName:
          profile?.displayName ?? profile?.authProviderName ?? profile?.email ?? null,
        ...value,
      });
      setOpponents((prev) => [created, ...(prev ?? [])]);
      setSelectedOpponentId(created.id);
      setOppMode("existing");
      if (!name.trim()) setName(`Wettkampf vs ${created.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "DeepFight-Profil konnte nicht angelegt werden");
    } finally {
      setCreatingOpp(false);
    }
  }

  async function handleCreateCompetition() {
    if (!user || !studentUid || !selectedOpponentId) return;
    setSubmitting(true);
    setError(null);
    try {
      // 1) Snapshot der Gegner-DNA holen (eingefroren für diesen Wettkampf)
      const opponent =
        selectedOpponent ?? (await getOpponent(selectedOpponentId));
      if (!opponent) throw new Error("Ausgewähltes DeepFight-Profil nicht gefunden");
      const snapshot = opponentToSnapshot(opponent);

      // 2) Trainingsanalyse des Schülers (für den 4-Phasen-Plan)
      const [workouts, progress] = await Promise.all([
        getRecentWorkouts(studentUid, 500).catch(() => []),
        getAllProgress(studentUid).catch(() => [] as TechniqueProgress[]),
      ]);
      const analysis = analyzeTrainingHistory(workouts, progress);

      // 3) Camp generieren + gym/opponent-Verweise ergänzen
      const base = generateFightCamp({
        studentUid,
        createdBy: user.uid,
        competitionDate: new Date(date),
        competitionName: name.trim(),
        athleteLevel: selectedStudent?.athlete?.level ?? null,
        analysis,
        opponent: snapshot,
      });
      const created = await createFightCamp({
        ...base,
        gymId,
        opponentId: opponent.id,
      });

      router.push(`/trainer/competitions/${studentUid}/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wettkampf konnte nicht erstellt werden");
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--ink-1)" }}>
      <div
        className="border-b px-4 py-7 sm:px-6"
        style={{
          borderColor: "rgba(255,79,168,0.2)",
          background:
            "radial-gradient(500px 220px at 100% 50%, rgba(255,79,168,0.1), transparent 60%), linear-gradient(160deg, #140A12, #080512)",
        }}
      >
        <div className="mx-auto max-w-3xl">
          <Link
            href="/trainer/competitions"
            className="font-mono-ta text-[10px] uppercase"
            style={{ letterSpacing: "0.2em", color: "var(--fg-4)" }}
          >
            ← Wettkampfbereich
          </Link>
          <h1
            className="font-display-ta mt-3 font-black uppercase leading-none"
            style={{ fontSize: "clamp(24px, 4vw, 34px)", letterSpacing: "0.02em" }}
          >
            Neuer Wettkampf
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-7 sm:px-6">
        {error && (
          <div className="mb-5">
            <ErrorState title="Fehler" message={error} onRetry={load} />
          </div>
        )}

        {members === null || opponents === null ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        ) : (
          <div className="flex flex-col gap-7">
            {/* Schritt 1: Schüler */}
            <section>
              <StepHeader n={1} title="Athlet" />
              <input
                type="search"
                placeholder="Athlet suchen…"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="mb-3 w-full rounded-xl px-4 py-2.5 text-sm sm:max-w-sm"
                style={fieldStyle}
              />
              {filteredMembers.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--fg-4)" }}>
                  Keine Athleten gefunden.
                </p>
              ) : (
                <div className="flex max-h-72 flex-col gap-4 overflow-y-auto">
                  <AthleteGroup
                    title="Ich selbst"
                    accent="var(--ta-cyan)"
                    entries={selfEntry ? [selfEntry] : []}
                    selectedUid={studentUid}
                    onSelect={setStudentUid}
                  />
                  <AthleteGroup
                    title="Trainer & Coaches"
                    accent="#9D7BFA"
                    entries={staffEntries}
                    selectedUid={studentUid}
                    onSelect={setStudentUid}
                  />
                  <AthleteGroup
                    title="Schüler"
                    accent="var(--fg-4)"
                    entries={studentEntries}
                    selectedUid={studentUid}
                    onSelect={setStudentUid}
                  />
                </div>
              )}
            </section>

            {/* Schritt 2: DeepFight-Profil */}
            <section>
              <StepHeader n={2} title={<DeepFightWordmark />} />
              <div
                className="mb-3 inline-flex gap-1 rounded-xl p-1"
                style={{ background: "var(--ink-3)", border: "1px solid var(--ink-5)" }}
              >
                {([
                  ["existing", "Bestehende auswählen"],
                  ["new", "Neu anlegen"],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setOppMode(id)}
                    className="font-mono-ta rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase transition-colors"
                    style={{
                      letterSpacing: "0.1em",
                      background: oppMode === id ? "var(--ta-pink)" : "transparent",
                      color: oppMode === id ? "#fff" : "var(--fg-3)",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {oppMode === "existing" ? (
                <>
                  <input
                    type="search"
                    placeholder="Gegner suchen…"
                    value={oppSearch}
                    onChange={(e) => setOppSearch(e.target.value)}
                    className="mb-3 w-full rounded-xl px-4 py-2.5 text-sm sm:max-w-sm"
                    style={fieldStyle}
                  />
                  {filteredOpponents.length === 0 ? (
                    <p className="text-xs" style={{ color: "var(--fg-4)" }}>
                      Noch keine DeepFight-Profile im Gym.{" "}
                      <button
                        onClick={() => setOppMode("new")}
                        style={{ color: "var(--ta-cyan)", textDecoration: "underline" }}
                      >
                        Jetzt neu anlegen
                      </button>
                    </p>
                  ) : (
                    <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                      {filteredOpponents.map((o) => {
                        const active = o.id === selectedOpponentId;
                        return (
                          <button
                            key={o.id}
                            onClick={() => setSelectedOpponentId(o.id)}
                            className="rounded-xl px-3 py-2.5 text-left transition-colors"
                            style={{
                              background: active ? "rgba(255,79,168,0.1)" : "var(--ink-3)",
                              border: `1px solid ${active ? "var(--ta-pink)" : "var(--ink-5)"}`,
                            }}
                          >
                            <span
                              className="block truncate text-sm font-bold"
                              style={{ color: active ? "var(--ta-pink)" : "var(--fg-2)" }}
                            >
                              {o.name}
                            </span>
                            <span
                              className="font-mono-ta block truncate text-[9px] uppercase"
                              style={{ letterSpacing: "0.1em", color: "var(--fg-4)" }}
                            >
                              {FIGHT_STYLE_LABEL[o.style]} · DNA {totalAnswered(o.dna)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-1">
                  <p className="mb-4 text-xs" style={{ color: "var(--fg-4)" }}>
                    Neues Gegnerprofil — wird gym-weit geteilt und nach dem
                    Speichern automatisch für diesen Wettkampf ausgewählt.
                  </p>
                  <OpponentEditor
                    busy={creatingOpp}
                    submitLabel="DeepFight-Profil speichern & auswählen"
                    onSubmit={handleCreateOpponent}
                  />
                </div>
              )}
            </section>

            {/* Schritt 3: Details */}
            <section>
              <StepHeader n={3} title="Wettkampf-Details" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase" style={labelStyle}>
                    Wettkampf-Name
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="z.B. Fight Night München"
                    className="rounded-lg px-3 py-2 text-sm"
                    style={fieldStyle}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase" style={labelStyle}>
                    Kampfdatum
                  </span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="rounded-lg px-3 py-2 text-sm"
                    style={fieldStyle}
                  />
                </label>
              </div>
            </section>

            {/* Zusammenfassung + Erstellen */}
            <div
              className="sticky bottom-3 rounded-2xl p-4"
              style={{
                background: "linear-gradient(180deg, var(--ink-3), var(--ink-2))",
                border: "1px solid var(--ink-4)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              }}
            >
              <div
                className="font-mono-ta mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] uppercase"
                style={{ letterSpacing: "0.1em", color: "var(--fg-4)" }}
              >
                <span>
                  Athlet:{" "}
                  <span style={{ color: selectedStudent ? "var(--ta-cyan)" : "var(--fg-4)" }}>
                    {selectedStudent ? studentLabel(selectedStudent) : "—"}
                  </span>
                </span>
                <span>
                  Gegner:{" "}
                  <span style={{ color: selectedOpponent ? "var(--ta-pink)" : "var(--fg-4)" }}>
                    {selectedOpponent?.name ?? "—"}
                  </span>
                </span>
              </div>
              <button
                onClick={handleCreateCompetition}
                disabled={!canSubmit || submitting}
                className="btn-primary w-full px-5 py-2.5 text-sm"
                style={{
                  opacity: !canSubmit || submitting ? 0.5 : 1,
                  cursor: !canSubmit || submitting ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? "Erstelle Wettkampf + Plan…" : "Wettkampf erstellen"}
              </button>
              {!canSubmit && (
                <p
                  className="font-mono-ta mt-2 text-center text-[9px] uppercase"
                  style={{ letterSpacing: "0.12em", color: "var(--fg-4)" }}
                >
                  Athlet, DeepFight-Profil, Name und Datum wählen
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function NewCompetitionPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <Skeleton className="h-16 w-full" />
        </div>
      }
    >
      <NewCompetitionContent />
    </Suspense>
  );
}
