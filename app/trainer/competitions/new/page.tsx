"use client";

import GooeySearch from "@/components/ui/GooeySearch";
import PageHead from "@/components/shell/PageHead";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import DeepFightWordmark from "@/components/DeepFightWordmark";
import OpponentEditor, {
  type OpponentEditorValue,
} from "@/components/trainer/OpponentEditor";
import { MorphSwap, StaggerFlow, FlowItem } from "@/components/motion";
import { useAuth } from "@/lib/auth-context";
import { resolveGymId } from "@/lib/gym";
import {
  getStudentEntry,
  isGhostAccount,
  isStaffEntry,
  listAllMembers,
  type StudentEntry,
} from "@/lib/admin";
import { darfSehen } from "@/lib/profile-sharing";
import { hasAnyRight } from "@/lib/roles";
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
import { dnaCompleteness } from "@/lib/gegner-dna";
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
  const role = s.rights.admin ? "Admin" : "Trainer";
  return level ? `${role} · ${level}` : role;
}

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};
const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};
const fieldStyle: React.CSSProperties = {
  background: "var(--surface-raised)",
  border: "1px solid var(--line)",
  color: "var(--text-body)",
  font: "var(--type-body)",
  outline: "none",
};

/** Nummer + Titel eines Schritts. Die Ziffer trägt den Gym-Akzent — vorher
    war sie das alte Pink, das es im neuen System nicht mehr gibt. */
function StepHeader({ n, title }: { n: number; title: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-badge"
        style={{
          font: "var(--type-body-strong)",
          background: "var(--accent-subtle)",
          border: "1px solid color-mix(in oklab, var(--accent) 35%, transparent)",
          color: "var(--accent-text)",
        }}
      >
        {n}
      </span>
      <h2
        style={{
          font: "var(--type-h3)",
          letterSpacing: "var(--ls-display)",
          textTransform: "uppercase",
        }}
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
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      data-press="surface"
      className="t-interactive flex min-h-hit w-full items-center gap-2.5 rounded-field px-3 py-2.5 text-left"
      style={{
        background: active ? "var(--accent-subtle)" : "var(--surface-raised)",
        border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
      }}
    >
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-badge"
        style={{
          font: "var(--type-meta)",
          letterSpacing: "var(--ls-label)",
          background: active ? "var(--accent)" : "var(--surface-card)",
          color: active ? "var(--on-accent)" : "var(--text-3)",
        }}
      >
        {studentLabel(entry).slice(0, 2).toUpperCase()}
      </span>
      <span className="min-w-0">
        <span
          className="block truncate"
          style={{
            font: "var(--type-body-strong)",
            color: active ? "var(--accent-text)" : "var(--text-body)",
          }}
        >
          {studentLabel(entry)}
        </span>
        {sub && (
          <span
            className="block truncate"
            style={{ ...META_FONT, color: "var(--text-3)" }}
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
      <p className="t-label mb-2" style={{ color: accent }}>
        {title}
      </p>
      {/* Die Suche filtert live — bleibende Namen rutschen an ihren neuen
          Platz, statt zu springen. Schlüssel ist die uid, nie der Index
          (MOTION-BRIEF §3.7). */}
      <StaggerFlow className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {entries.map((e, i) => (
          <FlowItem key={e.uid} index={i}>
            <AthleteCard
              entry={e}
              active={e.uid === selectedUid}
              onSelect={() => onSelect(e.uid)}
            />
          </FlowItem>
        ))}
      </StaggerFlow>
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
        listAllMembers(gymId).catch(() => [] as StudentEntry[]),
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
  /**
   * Kollegen, denen man einen Wettkampf anlegen darf.
   *
   * NUR MIT IHRER FREIGABE (Bereich „wettkampf", Schritt 2b): Ein Camp für
   * einen Kollegen ohne Freigabe scheitert beim Speichern an den Regeln —
   * die Auswahl darf ihn deshalb gar nicht erst anbieten. Ein Name, den man
   * anklicken kann und der dann eine Fehlermeldung bringt, ist schlechter
   * als kein Name.
   *
   * OHNE PLATTFORM-ADMINS: Ghost-Konten gehören keinem Gym-Team an
   * (Begründung an `isGhostAccount` in lib/admin.ts).
   */
  const staffEntries = useMemo(
    () =>
      filteredMembers
        .filter(
          (s) =>
            s.uid !== user?.uid &&
            isStaffEntry(s) &&
            !isGhostAccount(s) &&
            darfSehen(s.profileShares, "wettkampf", user?.uid ?? ""),
        )
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
        // Das Level kommt aus dem EINZELN geladenen Profil — Listen tragen
        // es nicht mehr (lib/admin.ts, StudentEntry.athlete). Ein Read.
        athleteLevel:
          (await getStudentEntry(studentUid).catch(() => null))?.athlete
            ?.level ?? null,
        analysis,
        opponent: snapshot,
      });
      const created = await createFightCamp({
        ...base,
        gymId,
        opponentId: opponent.id,
        // Dieselbe Bedingung wie `istStabKonto()` in den Firestore-Regeln:
        // trainer ODER verwaltung ODER admin. Nicht `isStaffEntry` — das
        // prüft nur das Trainer-Häkchen und ließe eine reine Verwaltung als
        // Athletin durchgehen (lib/fight-camp.ts, Kopfkommentar).
        ownerIsStaff: hasAnyRight(
          members?.find((m) => m.uid === studentUid)?.rights ?? {
            trainer: false,
            verwaltung: false,
            admin: false,
          },
        ),
      });

      router.push(`/trainer/competitions/${studentUid}/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wettkampf konnte nicht erstellt werden");
      setSubmitting(false);
    }
  }

  return (
    <main
      className="min-h-screen"
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      <PageHead
        lane="narrow"
        back={{ href: "/trainer/competitions", label: "Wettkampfbereich" }}
        title="Neuer Wettkampf"
      />

      <div className="mx-auto max-w-3xl px-4 py-7 sm:px-6">
        {error && (
          <div className="mb-5">
            <ErrorState title="Fehler" message={error} onRetry={load} />
          </div>
        )}

        {members === null || opponents === null ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-40 w-full rounded-card" />
            <Skeleton className="h-40 w-full rounded-card" />
          </div>
        ) : (
          <div className="flex flex-col gap-7">
            {/* Schritt 1: Athlet */}
            <section>
              <StepHeader n={1} title="Athlet" />
              <div className="mb-3">
                <GooeySearch
                  value={studentSearch}
                  onChange={setStudentSearch}
                  placeholder="Athlet suchen…"
                />
              </div>
              {filteredMembers.length === 0 ? (
                <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                  Kein Athlet zu diesem Suchbegriff. Such nach einem anderen
                  Namen oder leer die Suche.
                </p>
              ) : (
                // Deckel wächst mit dem Bildschirm (MOTION-BRIEF §4): `max-h-72`
                // war auf jedem Gerät gleich klein — auf dem Desktop drei
                // sichtbare Zeilen neben viel leerem Platz. 50vh lässt auf dem
                // Handy die Schritte 2–4 im Blick und verdoppelt am Monitor die
                // Liste.
                <div className="flex max-h-[50vh] flex-col gap-4 overflow-y-auto">
                  <AthleteGroup
                    title="Ich selbst"
                    accent="var(--accent)"
                    entries={selfEntry ? [selfEntry] : []}
                    selectedUid={studentUid}
                    onSelect={setStudentUid}
                  />
                  {/* Kein eigenes Violett mehr: Das gehoert app-weit
                      DeepFight (dieselbe Entscheidung wie bei „Archiviert" in
                      der Uebersicht). Die Gruppen trennt ihre Ueberschrift,
                      nicht eine dritte Farbe. */}
                  <AthleteGroup
                    title="Trainer & Coaches"
                    accent="var(--text-2)"
                    entries={staffEntries}
                    selectedUid={studentUid}
                    onSelect={setStudentUid}
                  />
                  <AthleteGroup
                    title="Athlet"
                    accent="var(--text-3)"
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
                className="mb-3 inline-flex gap-1 rounded-field p-1"
                style={{
                  background: "var(--surface-raised)",
                  border: "1px solid var(--line)",
                }}
              >
                {([
                  ["existing", "Bestehende auswählen"],
                  ["new", "Neu anlegen"],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setOppMode(id)}
                    aria-pressed={oppMode === id}
                    className="t-interactive rounded-badge px-3 py-2"
                    style={{
                      ...META_FONT,
                      background: oppMode === id ? "var(--accent)" : "transparent",
                      color: oppMode === id ? "var(--on-accent)" : "var(--text-2)",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Der Wechsel zwischen Auswahl und Editor ist ein Formwechsel,
                  kein Umschalten (MOTION-BRIEF §1.1). `activeKey` ist der
                  Modus — ohne ihn merkt AnimatePresence nichts. */}
              <MorphSwap activeKey={oppMode}>
              {oppMode === "existing" ? (
                <>
                  <div className="mb-3">
                    <GooeySearch
                      value={oppSearch}
                      onChange={setOppSearch}
                      placeholder="Gegner suchen…"
                    />
                  </div>
                  {filteredOpponents.length === 0 ? (
                    <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                      Noch kein DeepFight-Profil im Gym.{" "}
                      <button
                        type="button"
                        onClick={() => setOppMode("new")}
                        style={{
                          color: "var(--accent-text)",
                          textDecoration: "underline",
                        }}
                      >
                        Jetzt eins anlegen
                      </button>
                    </p>
                  ) : (
                    <StaggerFlow className="grid max-h-[50vh] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                      {filteredOpponents.map((o, i) => {
                        const active = o.id === selectedOpponentId;
                        return (
                          <FlowItem key={o.id} index={i}>
                            <button
                              type="button"
                              onClick={() => setSelectedOpponentId(o.id)}
                              aria-pressed={active}
                              data-press="surface"
                              className="t-interactive min-h-hit w-full rounded-field px-3 py-2.5 text-left"
                              style={{
                                background: active
                                  ? "var(--accent-subtle)"
                                  : "var(--surface-raised)",
                                border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
                              }}
                            >
                              <span
                                className="block truncate"
                                style={{
                                  font: "var(--type-body-strong)",
                                  color: active ? "var(--accent-text)" : "var(--text-body)",
                                }}
                              >
                                {o.name}
                              </span>
                              <span
                                className="block truncate"
                                style={{ ...META_FONT, color: "var(--text-3)" }}
                              >
                                {FIGHT_STYLE_LABEL[o.style]} · DNA {dnaCompleteness(o.dna)} %
                              </span>
                            </button>
                          </FlowItem>
                        );
                      })}
                    </StaggerFlow>
                  )}
                </>
              ) : (
                <div className="mt-1">
                  <p
                    className="mb-4"
                    style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                  >
                    Neues Gegnerprofil — dein ganzes Trainerteam arbeitet
                    damit, und für diesen Wettkampf steht es nach dem Speichern
                    schon bereit.
                  </p>
                  <OpponentEditor
                    busy={creatingOpp}
                    submitLabel="DeepFight-Profil speichern & auswählen"
                    onSubmit={handleCreateOpponent}
                  />
                </div>
              )}
              </MorphSwap>
            </section>

            {/* Schritt 3: Details */}
            <section>
              <StepHeader n={3} title="Wettkampf-Details" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="t-label">Wettkampf-Name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="z.B. Fight Night München"
                    className="min-h-hit rounded-field px-3"
                    style={fieldStyle}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="t-label">Kampfdatum</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="min-h-hit rounded-field px-3"
                    style={fieldStyle}
                  />
                </label>
              </div>
            </section>

            {/* Zusammenfassung + Erstellen */}
            {/* Die Zusammenfassung klebt unten — sie ist die einzige Stelle,
                an der man sieht, ob Athlet UND Gegner stehen, und sie darf
                beim Scrollen durch lange Listen nicht verschwinden.
                `t-glass` statt einer eigenen Karte: Sie liegt ÜBER dem
                Inhalt, und der soll dahinter durchscheinen. */}
            <div className="t-glass sticky bottom-3 p-4">
              <div
                className="mb-3 flex flex-wrap gap-x-4 gap-y-1"
                style={{ ...META_FONT, color: "var(--text-3)" }}
              >
                <span>
                  Athlet:{" "}
                  <span
                    style={{
                      color: selectedStudent ? "var(--accent-text)" : "var(--text-3)",
                    }}
                  >
                    {selectedStudent ? studentLabel(selectedStudent) : "—"}
                  </span>
                </span>
                <span>
                  Gegner:{" "}
                  <span
                    style={{
                      color: selectedOpponent ? "var(--accent-text)" : "var(--text-3)",
                    }}
                  >
                    {selectedOpponent?.name ?? "—"}
                  </span>
                </span>
              </div>
              <button
                type="button"
                onClick={handleCreateCompetition}
                disabled={!canSubmit || submitting}
                className="t-interactive min-h-hit w-full rounded-field px-5 disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  ...BTN_FONT,
                  background: "var(--accent)",
                  color: "var(--on-accent)",
                  boxShadow: "var(--accent-glow)",
                }}
              >
                {submitting ? "Erstelle Wettkampf + Plan…" : "Wettkampf erstellen"}
              </button>
              {!canSubmit && (
                <p
                  className="mt-2 text-center"
                  style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                >
                  Wähl Athlet, DeepFight-Profil, Name und Datum — dann geht es los.
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
