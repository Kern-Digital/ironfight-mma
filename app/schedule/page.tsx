"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  TRAINING_BLOCKS,
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
  getBlocksForDay,
  getCurrentWeekday,
  getWeekIdentifier,
} from "@/lib/schedule";
import {
  addSessionExercisesToLibrary,
  getTrainingSession,
  hasParticipated,
  recordParticipation,
  setSessionExercises,
} from "@/lib/training-sessions";
import { EXERCISES, getExerciseById } from "@/lib/exercises";
import type { Exercise, TrainingBlock, TrainingSession } from "@/lib/types";

// ─── Visuelle Hilfskonstanten ──────────────────────────────────────────────

const LEVEL_STYLE: Record<string, { label: string; color: string }> = {
  kids:     { label: "Kids",     color: "#FF2D78" },
  teens:    { label: "Teens",    color: "#FBBF24" },
  adult:    { label: "Adult",    color: "#00D4E6" },
  advanced: { label: "Advanced", color: "#F3F4F6" },
  mixed:    { label: "Mixed",    color: "#A78BFA" },
};

const CATEGORY_STYLE: Record<string, { label: string; color: string }> = {
  boxing:      { label: "Box",       color: "#FB923C" },
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

// ─── Typen ─────────────────────────────────────────────────────────────────

type ModalState =
  | { phase: "idle" }
  | { phase: "loading"; block: TrainingBlock }
  | {
      phase: "ready";
      block: TrainingBlock;
      session: TrainingSession | null;
      participated: boolean;
    };

// ─── Komponente ────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const { user, profile } = useAuth();
  const todayWeekday = getCurrentWeekday();
  const isTrainer =
    profile?.role === "trainer" || profile?.role === "admin";

  const [modal, setModal] = useState<ModalState>({ phase: "idle" });
  const [attending, setAttending] = useState(false);
  const [attendResult, setAttendResult] = useState<number | null>(null);

  // Trainer: Übungen bearbeiten
  const [editMode, setEditMode] = useState(false);
  const [editIds, setEditIds] = useState<string[]>([]);
  const [editSearch, setEditSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Fokus-Ref für Accessibility
  const modalRef = useRef<HTMLDivElement>(null);

  const openBlock = useCallback(
    async (block: TrainingBlock) => {
      setModal({ phase: "loading", block });
      setAttendResult(null);
      setEditMode(false);
      setEditIds([]);
      setEditSearch("");

      const weekId = getWeekIdentifier();
      const sessionId = `${block.id}_${weekId}`;

      const [session, participated] = await Promise.all([
        getTrainingSession(block.id, weekId),
        user ? hasParticipated(user.uid, sessionId) : Promise.resolve(false),
      ]);

      setModal({ phase: "ready", block, session, participated });
    },
    [user],
  );

  const closeModal = useCallback(() => {
    setModal({ phase: "idle" });
    setEditMode(false);
    setEditIds([]);
    setEditSearch("");
    setAttendResult(null);
  }, []);

  // Esc schließt Modal
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeModal]);

  async function handleAttend() {
    if (!user || modal.phase !== "ready") return;
    setAttending(true);
    try {
      const weekId = getWeekIdentifier();
      const block = modal.block;

      // Session holen oder leer anlegen
      let session = modal.session;
      if (!session) {
        session = {
          id: `${block.id}_${weekId}`,
          trainingBlockId: block.id,
          weekIdentifier: weekId,
          exerciseIds: [],
        };
      }

      await recordParticipation(user.uid, session, block.title);

      const added =
        session.exerciseIds.length > 0
          ? await addSessionExercisesToLibrary(user.uid, session, block.title)
          : 0;

      setAttendResult(added);
      setModal((prev) =>
        prev.phase === "ready" ? { ...prev, participated: true } : prev,
      );
    } finally {
      setAttending(false);
    }
  }

  async function handleSaveExercises() {
    if (!user || modal.phase !== "ready") return;
    setSaving(true);
    try {
      const weekId = getWeekIdentifier();
      const updated = await setSessionExercises(
        modal.block.id,
        weekId,
        editIds,
        user.uid,
      );
      setModal((prev) =>
        prev.phase === "ready" ? { ...prev, session: updated } : prev,
      );
      setEditMode(false);
    } finally {
      setSaving(false);
    }
  }

  function startEdit() {
    if (modal.phase !== "ready") return;
    setEditIds(modal.session?.exerciseIds ?? []);
    setEditMode(true);
  }

  function toggleEditId(id: string) {
    setEditIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen" style={{ background: "var(--ink-1)" }}>
      {/* Header */}
      <div
        className="border-b px-4 py-8 sm:px-6"
        style={{ borderColor: "var(--ink-4)" }}
      >
        <div className="mx-auto max-w-7xl">
          <p
            className="mb-1 font-mono-ta text-xs uppercase"
            style={{ letterSpacing: "0.25em", color: "var(--ta-cyan)" }}
          >
            Diese Woche
          </p>
          <h1
            className="font-display-ta text-3xl font-black uppercase sm:text-4xl"
            style={{ letterSpacing: "0.04em", color: "var(--fg-1)" }}
          >
            Stundenplan
          </h1>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--fg-3)" }}
          >
            Klicke auf ein Training um teilzunehmen und Übungen in deine Bibliothek zu übernehmen.
          </p>
        </div>
      </div>

      {/* Wochengitter */}
      <div className="mx-auto max-w-7xl px-2 py-6 sm:px-4">
        {/* Desktop: 7 Spalten */}
        <div className="hidden gap-2 lg:grid lg:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => (
            <DayColumn
              key={i}
              weekday={i}
              blocks={getBlocksForDay(i)}
              isToday={i === todayWeekday}
              onBlockClick={openBlock}
              label={WEEKDAY_LABELS[i]}
              short={WEEKDAY_SHORT[i]}
            />
          ))}
        </div>

        {/* Tablet: 2 Spalten (Mi/Sa als Sonderfall) */}
        <div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:hidden">
          {Array.from({ length: 7 }, (_, i) => (
            <DayColumn
              key={i}
              weekday={i}
              blocks={getBlocksForDay(i)}
              isToday={i === todayWeekday}
              onBlockClick={openBlock}
              label={WEEKDAY_LABELS[i]}
              short={WEEKDAY_SHORT[i]}
            />
          ))}
        </div>

        {/* Mobile: Einzelspalte */}
        <div className="flex flex-col gap-3 sm:hidden">
          {Array.from({ length: 7 }, (_, i) => (
            <DayColumn
              key={i}
              weekday={i}
              blocks={getBlocksForDay(i)}
              isToday={i === todayWeekday}
              onBlockClick={openBlock}
              label={WEEKDAY_LABELS[i]}
              short={WEEKDAY_SHORT[i]}
            />
          ))}
        </div>
      </div>

      {/* Modal — immer zentriert (kein Bottom-Sheet auf Mobile) */}
      {modal.phase !== "idle" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(3,4,6,0.85)" }}
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div
            ref={modalRef}
            className="w-full max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg"
            style={{
              background: "var(--ink-2)",
              border: "1px solid var(--ink-4)",
            }}
          >
            {modal.phase === "loading" && (
              <ModalSkeleton block={modal.block} onClose={closeModal} />
            )}
            {modal.phase === "ready" && (
              <ModalReady
                block={modal.block}
                session={modal.session}
                participated={modal.participated}
                attendResult={attendResult}
                attending={attending}
                isTrainer={isTrainer}
                isLoggedIn={!!user}
                editMode={editMode}
                editIds={editIds}
                editSearch={editSearch}
                saving={saving}
                onClose={closeModal}
                onAttend={handleAttend}
                onStartEdit={startEdit}
                onToggleEditId={toggleEditId}
                onEditSearchChange={setEditSearch}
                onSaveExercises={handleSaveExercises}
                onCancelEdit={() => setEditMode(false)}
              />
            )}
          </div>
        </div>
      )}
    </main>
  );
}

// ─── DayColumn ────────────────────────────────────────────────────────────

function DayColumn({
  weekday,
  blocks,
  isToday,
  onBlockClick,
  label,
  short: _short,
}: {
  weekday: number;
  blocks: TrainingBlock[];
  isToday: boolean;
  onBlockClick: (b: TrainingBlock) => void;
  label: string;
  short: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      {/* Tages-Header */}
      <div
        className="rounded-lg px-2 py-1.5 text-center text-xs font-black uppercase"
        style={{
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.12em",
          background: isToday ? "rgba(0,212,230,.12)" : "var(--ink-3)",
          border: `1px solid ${isToday ? "rgba(0,212,230,.4)" : "var(--ink-4)"}`,
          color: isToday ? "var(--ta-cyan)" : "var(--fg-3)",
        }}
      >
        {label}
        {isToday && (
          <span
            className="ml-1 inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--ta-cyan)", verticalAlign: "middle" }}
          />
        )}
      </div>

      {/* Trainingsblöcke */}
      {blocks.length === 0 ? (
        <div
          className="flex flex-1 items-center justify-center rounded-lg py-4 text-xs"
          style={{ color: "var(--fg-4)", background: "var(--ink-2)" }}
        >
          —
        </div>
      ) : (
        blocks.map((block) => (
          <BlockCard
            key={block.id}
            block={block}
            isToday={isToday}
            onClick={() => onBlockClick(block)}
          />
        ))
      )}
    </div>
  );
}

// ─── BlockCard ────────────────────────────────────────────────────────────

function BlockCard({
  block,
  isToday,
  onClick,
}: {
  block: TrainingBlock;
  isToday: boolean;
  onClick: () => void;
}) {
  const levelStyle = block.level ? LEVEL_STYLE[block.level] : null;
  const catStyle = block.category ? CATEGORY_STYLE[block.category] : null;
  const accentColor = catStyle?.color ?? levelStyle?.color ?? "var(--fg-4)";

  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg p-2 text-left transition-all"
      style={{
        background: "var(--ink-3)",
        border: `1px solid ${isToday ? "rgba(0,212,230,.2)" : "var(--ink-4)"}`,
        borderLeft: `3px solid ${accentColor}`,
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--ink-4)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--ink-3)";
      }}
    >
      <div
        className="mb-0.5 font-mono-ta text-[10px]"
        style={{ color: "var(--fg-4)", letterSpacing: "0.08em" }}
      >
        {block.startTime}–{block.endTime}
      </div>
      <div
        className="text-xs font-bold leading-tight"
        style={{ color: "var(--fg-1)" }}
      >
        {block.title}
      </div>
      {(levelStyle || catStyle) && (
        <div className="mt-1 flex flex-wrap gap-1">
          {levelStyle && (
            <span
              className="rounded px-1 py-0.5 text-[9px] font-bold uppercase"
              style={{
                background: `${levelStyle.color}22`,
                color: levelStyle.color,
                letterSpacing: "0.08em",
              }}
            >
              {levelStyle.label}
            </span>
          )}
          {catStyle && (
            <span
              className="rounded px-1 py-0.5 text-[9px] font-bold uppercase"
              style={{
                background: `${catStyle.color}22`,
                color: catStyle.color,
                letterSpacing: "0.08em",
              }}
            >
              {catStyle.label}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

// ─── ModalSkeleton ────────────────────────────────────────────────────────

function ModalSkeleton({
  block,
  onClose,
}: {
  block: TrainingBlock;
  onClose: () => void;
}) {
  return (
    <div className="p-5">
      <ModalHeader block={block} onClose={onClose} />
      <div className="mt-4 space-y-2">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="h-10 animate-pulse rounded-lg"
            style={{ background: "var(--ink-4)" }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── ModalReady ───────────────────────────────────────────────────────────

function ModalReady({
  block,
  session,
  participated,
  attendResult,
  attending,
  isTrainer,
  isLoggedIn,
  editMode,
  editIds,
  editSearch,
  saving,
  onClose,
  onAttend,
  onStartEdit,
  onToggleEditId,
  onEditSearchChange,
  onSaveExercises,
  onCancelEdit,
}: {
  block: TrainingBlock;
  session: TrainingSession | null;
  participated: boolean;
  attendResult: number | null;
  attending: boolean;
  isTrainer: boolean;
  isLoggedIn: boolean;
  editMode: boolean;
  editIds: string[];
  editSearch: string;
  saving: boolean;
  onClose: () => void;
  onAttend: () => void;
  onStartEdit: () => void;
  onToggleEditId: (id: string) => void;
  onEditSearchChange: (v: string) => void;
  onSaveExercises: () => void;
  onCancelEdit: () => void;
}) {
  const exercises: Exercise[] = (session?.exerciseIds ?? [])
    .map((id) => getExerciseById(id))
    .filter((e): e is Exercise => Boolean(e));

  const filteredAll = EXERCISES.filter((e) =>
    e.name.toLowerCase().includes(editSearch.toLowerCase()) ||
    e.id.toLowerCase().includes(editSearch.toLowerCase()),
  );

  return (
    <div className="p-5">
      <ModalHeader block={block} onClose={onClose} />

      {/* Im Edit-Modus: Bearbeitungsbereich direkt nach dem Header (kein Scrollen nötig) */}
      {isTrainer && editMode ? (
        <>
          <div
            className="mt-4 rounded-xl p-3"
            style={{
              background: "var(--ink-3)",
              border: "1px solid rgba(0,212,230,.3)",
            }}
          >
            <p
              className="mb-2 text-xs font-bold uppercase"
              style={{
                color: "var(--ta-cyan)",
                letterSpacing: "0.1em",
                fontFamily: "var(--font-mono)",
              }}
            >
              Übungen auswählen · {editIds.length} gewählt
            </p>
            <input
              type="text"
              placeholder="Übung suchen…"
              value={editSearch}
              onChange={(e) => onEditSearchChange(e.target.value)}
              className="mb-2 w-full rounded-lg px-3 py-2 text-sm"
              style={{
                background: "var(--ink-2)",
                border: "1px solid var(--ink-5)",
                color: "var(--fg-1)",
                outline: "none",
              }}
              autoFocus
            />
            <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
              {filteredAll.map((ex) => {
                const selected = editIds.includes(ex.id);
                return (
                  <button
                    key={ex.id}
                    onClick={() => onToggleEditId(ex.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors"
                    style={{
                      background: selected ? "rgba(0,212,230,.12)" : "transparent",
                      border: `1px solid ${selected ? "rgba(0,212,230,.4)" : "transparent"}`,
                      color: "var(--fg-2)",
                    }}
                  >
                    <span
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded"
                      style={{
                        background: selected ? "var(--ta-cyan)" : "var(--ink-4)",
                        color: selected ? "var(--ink-1)" : "transparent",
                        fontSize: "10px",
                      }}
                    >
                      {selected ? "✓" : ""}
                    </span>
                    <span className="flex-1 truncate">{ex.name}</span>
                    <span className="text-[10px]" style={{ color: "var(--fg-4)" }}>
                      {KIND_LABEL[ex.kind] ?? ex.kind}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={onSaveExercises}
                disabled={saving}
                className="flex-1 rounded-xl py-2 text-xs font-bold uppercase transition-opacity"
                style={{
                  background: "var(--ta-cyan)",
                  color: "var(--ink-1)",
                  letterSpacing: "0.1em",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "Speichern…" : `Speichern (${editIds.length})`}
              </button>
              <button
                onClick={onCancelEdit}
                className="rounded-xl px-4 py-2 text-xs font-bold uppercase"
                style={{
                  background: "var(--ink-4)",
                  color: "var(--fg-3)",
                  letterSpacing: "0.1em",
                }}
              >
                Abbrechen
              </button>
            </div>
          </div>

          {/* Vorschau der bereits ausgewählten Übungen */}
          {editIds.length > 0 && (
            <div className="mt-3">
              <p
                className="mb-1.5 text-[10px] font-bold uppercase"
                style={{ color: "var(--fg-4)", letterSpacing: "0.1em", fontFamily: "var(--font-mono)" }}
              >
                Aktuelle Auswahl
              </p>
              <div className="flex flex-wrap gap-1.5">
                {editIds.map((id) => {
                  const ex = filteredAll.find((e) => e.id === id);
                  return (
                    <span
                      key={id}
                      className="rounded-lg px-2 py-1 text-[11px]"
                      style={{
                        background: "rgba(0,212,230,.1)",
                        border: "1px solid rgba(0,212,230,.3)",
                        color: "var(--ta-cyan)",
                      }}
                    >
                      {ex?.name ?? id}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Normal-Ansicht: Übungen der Einheit */}
          <div className="mt-4">
            {exercises.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--fg-4)" }}>
                {isTrainer
                  ? "Noch keine Übungen für diese Einheit — füge sie über den Button unten hinzu."
                  : "Für diese Einheit wurden noch keine Übungen hinterlegt."}
              </p>
            ) : (
              <div className="space-y-2">
                <p
                  className="mb-2 text-xs font-bold uppercase"
                  style={{
                    color: "var(--fg-3)",
                    letterSpacing: "0.1em",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  Übungen dieser Einheit
                </p>
                {exercises.map((ex) => (
                  <ExerciseRow key={ex.id} exercise={ex} />
                ))}
              </div>
            )}
          </div>

          {/* Aktions-Buttons */}
          <div className="mt-5 flex flex-col gap-2">
            {/* Trainer: Bearbeiten */}
            {isTrainer && (
              <button
                onClick={onStartEdit}
                className="w-full rounded-xl py-2.5 text-xs font-bold uppercase transition-colors"
                style={{
                  background: "var(--ink-4)",
                  border: "1px solid var(--ta-cyan)",
                  color: "var(--ta-cyan)",
                  letterSpacing: "0.1em",
                }}
              >
                Übungen bearbeiten
              </button>
            )}

            {/* Nutzer: Teilnahme */}
            {isLoggedIn ? (
              participated ? (
                <div
                  className="rounded-xl py-2.5 text-center text-xs font-bold uppercase"
                  style={{
                    background: "rgba(0,212,230,.08)",
                    border: "1px solid rgba(0,212,230,.3)",
                    color: "var(--ta-cyan)",
                    letterSpacing: "0.1em",
                  }}
                >
                  ✓ Teilgenommen
                  {attendResult !== null && attendResult > 0 && (
                    <span style={{ color: "var(--fg-3)" }}>
                      {" "}— {attendResult} Übung{attendResult !== 1 ? "en" : ""} zur Bibliothek hinzugefügt
                    </span>
                  )}
                  {attendResult === 0 && (
                    <span style={{ color: "var(--fg-4)" }}>
                      {" "}(alle Übungen bereits in deiner Bibliothek)
                    </span>
                  )}
                </div>
              ) : (
                <button
                  onClick={onAttend}
                  disabled={attending}
                  className="w-full rounded-xl py-2.5 text-xs font-bold uppercase transition-opacity"
                  style={{
                    background: "var(--ta-cyan)",
                    color: "var(--ink-1)",
                    letterSpacing: "0.1em",
                    opacity: attending ? 0.6 : 1,
                  }}
                >
                  {attending
                    ? "Wird gespeichert…"
                    : exercises.length > 0
                      ? `Ich nehme teil — ${exercises.length} Übung${exercises.length !== 1 ? "en" : ""} übernehmen`
                      : "Ich nehme teil"}
                </button>
              )
            ) : (
              <Link
                href="/login"
                className="block w-full rounded-xl py-2.5 text-center text-xs font-bold uppercase"
                style={{
                  background: "var(--ta-cyan)",
                  color: "var(--ink-1)",
                  letterSpacing: "0.1em",
                  textDecoration: "none",
                }}
                onClick={onClose}
              >
                Anmelden zum Teilnehmen
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── ModalHeader ──────────────────────────────────────────────────────────

function ModalHeader({
  block,
  onClose,
}: {
  block: TrainingBlock;
  onClose: () => void;
}) {
  const levelStyle = block.level ? LEVEL_STYLE[block.level] : null;
  const catStyle = block.category ? CATEGORY_STYLE[block.category] : null;

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {levelStyle && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
              style={{
                background: `${levelStyle.color}22`,
                color: levelStyle.color,
                letterSpacing: "0.08em",
              }}
            >
              {levelStyle.label}
            </span>
          )}
          {catStyle && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
              style={{
                background: `${catStyle.color}22`,
                color: catStyle.color,
                letterSpacing: "0.08em",
              }}
            >
              {catStyle.label}
            </span>
          )}
        </div>
        <h2
          className="mt-1 font-display-ta text-xl font-black uppercase leading-tight"
          style={{ color: "var(--fg-1)", letterSpacing: "0.04em" }}
        >
          {block.title}
        </h2>
        <p
          className="mt-0.5 font-mono-ta text-sm"
          style={{ color: "var(--fg-3)", letterSpacing: "0.08em" }}
        >
          {block.startTime}–{block.endTime} Uhr
          <span
            className="ml-2"
            style={{ color: "var(--fg-4)" }}
          >
            · Diese Woche
          </span>
        </p>
      </div>
      <button
        onClick={onClose}
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm transition-colors"
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
  );
}

// ─── ExerciseRow ──────────────────────────────────────────────────────────

function ExerciseRow({ exercise }: { exercise: Exercise }) {
  const catStyle = exercise.category !== "any"
    ? CATEGORY_STYLE[exercise.category]
    : null;

  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2"
      style={{
        background: "var(--ink-3)",
        border: "1px solid var(--ink-4)",
      }}
    >
      <div
        className="h-2 w-2 shrink-0 rounded-full"
        style={{
          background: catStyle?.color ?? "var(--fg-4)",
        }}
      />
      <div className="flex-1 min-w-0">
        <span
          className="text-sm font-medium"
          style={{ color: "var(--fg-1)" }}
        >
          {exercise.name}
        </span>
      </div>
      <span
        className="shrink-0 text-[10px] uppercase"
        style={{
          color: "var(--fg-4)",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.08em",
        }}
      >
        {KIND_LABEL[exercise.kind] ?? exercise.kind}
      </span>
    </div>
  );
}
