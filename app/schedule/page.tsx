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
  addSessionTechniquesToLibrary,
  getTrainingSession,
  hasParticipated,
  recordParticipation,
  setSessionTechniques,
} from "@/lib/training-sessions";
import { ALL_TECHNIQUES, getTechniqueById } from "@/lib/techniques";
import type {
  Discipline,
  Technique,
  TrainingArea,
  TrainingBlock,
  TrainingSession,
} from "@/lib/types";
import { TRAINING_AREA_LABEL, TECHNIQUE_LEVEL_LABEL } from "@/lib/types";

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

const DISCIPLINE_COLOR: Record<string, string> = {
  boxing:            "#FB923C",
  kickboxen:         "#FBBF24",
  "muay-thai":       "#F87171",
  "fitness-kickboxen": "#FCD34D",
  wrestling:         "#60A5FA",
  bjj:               "#C084FC",
  mma:               "#00D4E6",
  karate:            "#A78BFA",
  "wing-tsung":      "#34D399",
  "self-defense":    "#9CA3AF",
};

const DISCIPLINE_LABEL: Record<string, string> = {
  boxing:            "Boxing",
  kickboxen:         "Kickboxen",
  "muay-thai":       "Muay Thai",
  "fitness-kickboxen": "Fitness-KB",
  wrestling:         "Wrestling",
  bjj:               "BJJ",
  mma:               "MMA",
  karate:            "Karate",
  "wing-tsung":      "Wing Tsung",
  "self-defense":    "Self-Defense",
};

const TECHNIQUE_LEVEL_COLOR: Record<string, string> = {
  anfaenger:     "#4ade80",
  aufbau:        "#60a5fa",
  fortgeschritten: "#f59e0b",
  advanced:      "#f97316",
  pro:           "#ef4444",
};

// ─── Struktur-Hilfsfunktionen ──────────────────────────────────────────────

/** Gibt geordnete Disziplinen zurück, die für einen Trainingsblock relevant sind. */
function getBlockDisciplines(block: TrainingBlock): Discipline[] {
  if (block.category === "boxing") {
    const t = block.title.toLowerCase();
    if (t.includes("muay")) return ["muay-thai", "boxing"];
    if (t.includes("kickbox") || t.includes("fitness")) return ["kickboxen", "boxing", "fitness-kickboxen"];
    return ["boxing", "kickboxen"];
  }
  if (block.category === "wrestling") return ["wrestling", "bjj", "mma"];
  if (block.category === "muay-thai") return ["muay-thai", "boxing", "kickboxen"];
  const t = block.title.toLowerCase();
  if (t.includes("mma")) return ["mma", "boxing", "kickboxen", "muay-thai", "wrestling", "bjj"];
  if (t.includes("kickbox")) return ["kickboxen", "boxing", "fitness-kickboxen"];
  if (t.includes("muay")) return ["muay-thai", "boxing"];
  return ["boxing", "kickboxen", "muay-thai", "wrestling", "bjj", "mma"];
}

/** Prüft ob eine Technik zur Disziplin passt. */
function matchesDiscipline(t: Technique, discipline: string): boolean {
  if (t.disciplines && t.disciplines.length > 0) {
    return t.disciplines.includes(discipline as Discipline);
  }
  return t.category === discipline;
}

const AREA_ORDER: TrainingArea[] = [
  "punches", "kicks", "knees", "elbows", "combos",
  "footwork", "stand-up", "defense", "clinch",
  "takedowns", "takedown-defense",
  "ground-control", "guard", "sweeps", "submissions", "escapes", "transitions",
  "drills",
];

const LEVEL_SORT: Record<string, number> = {
  anfaenger: 0, aufbau: 1, fortgeschritten: 2, advanced: 3, pro: 4,
};

interface TechniqueGroup {
  area: string;
  label: string;
  techniques: Technique[];
}

/** Gibt Techniken einer Disziplin nach Trainingsbereich gruppiert zurück. */
function getTechniqueGroups(discipline: string, search: string): TechniqueGroup[] {
  const needle = search.trim().toLowerCase();
  const filtered = ALL_TECHNIQUES.filter((t) => {
    if (!matchesDiscipline(t, discipline)) return false;
    if (needle && !t.name.toLowerCase().includes(needle)) return false;
    return true;
  });

  const groupMap = new Map<string, Technique[]>();
  for (const t of filtered) {
    const areas = t.trainingArea
      ? (Array.isArray(t.trainingArea) ? t.trainingArea : [t.trainingArea])
      : [];
    const area: string = (areas[0] as string | undefined) ?? "other";
    if (!groupMap.has(area)) groupMap.set(area, []);
    groupMap.get(area)!.push(t);
  }

  // Innerhalb Gruppen nach Level sortieren
  Array.from(groupMap.values()).forEach((techs: Technique[]) => {
    techs.sort((a: Technique, b: Technique) => (LEVEL_SORT[a.level ?? ""] ?? 2) - (LEVEL_SORT[b.level ?? ""] ?? 2));
  });

  // Gruppen in definierter Reihenfolge ausgeben
  const ordered: TechniqueGroup[] = [];
  for (const area of AREA_ORDER) {
    if (groupMap.has(area)) {
      ordered.push({
        area,
        label: TRAINING_AREA_LABEL[area] ?? area,
        techniques: groupMap.get(area)!,
      });
      groupMap.delete(area);
    }
  }
  // Restliche Gruppen anhängen
  Array.from(groupMap.entries()).forEach(([area, techniques]: [string, Technique[]]) => {
    ordered.push({
      area,
      label: TRAINING_AREA_LABEL[area as TrainingArea] ?? area,
      techniques,
    });
  });

  return ordered;
}

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

// ─── Hauptkomponente ───────────────────────────────────────────────────────

export default function SchedulePage() {
  const { user, profile } = useAuth();
  const todayWeekday = getCurrentWeekday();
  const isTrainer = profile?.role === "trainer" || profile?.role === "admin";

  const [modal, setModal] = useState<ModalState>({ phase: "idle" });
  const [attending, setAttending] = useState(false);
  const [attendResult, setAttendResult] = useState<number | null>(null);

  // Trainer: Techniken bearbeiten
  const [editMode, setEditMode] = useState(false);
  const [editIds, setEditIds] = useState<string[]>([]);
  const [editSearch, setEditSearch] = useState("");
  const [editDiscipline, setEditDiscipline] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

  const openBlock = useCallback(
    async (block: TrainingBlock) => {
      setModal({ phase: "loading", block });
      setAttendResult(null);
      setEditMode(false);
      setEditIds([]);
      setEditSearch("");
      setEditDiscipline(getBlockDisciplines(block)[0] ?? "boxing");

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

      let session = modal.session;
      if (!session) {
        session = {
          id: `${block.id}_${weekId}`,
          trainingBlockId: block.id,
          weekIdentifier: weekId,
          exerciseIds: [],
          techniqueIds: [],
        };
      }

      await recordParticipation(user.uid, session, block.title);

      // Techniken bevorzugen (neues System), Übungen als Fallback (Altdaten)
      const techniqueCount = session.techniqueIds?.length ?? 0;
      let added = 0;
      if (techniqueCount > 0) {
        added = await addSessionTechniquesToLibrary(user.uid, session, block.title);
      } else if (session.exerciseIds.length > 0) {
        added = await addSessionExercisesToLibrary(user.uid, session, block.title);
      }

      setAttendResult(added);
      setModal((prev) =>
        prev.phase === "ready" ? { ...prev, participated: true } : prev,
      );
    } finally {
      setAttending(false);
    }
  }

  async function handleSaveTechniques() {
    if (!user || modal.phase !== "ready") return;
    setSaving(true);
    try {
      const weekId = getWeekIdentifier();
      const updated = await setSessionTechniques(
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
    setEditIds(modal.session?.techniqueIds ?? []);
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
          <p className="mt-1 text-sm" style={{ color: "var(--fg-3)" }}>
            Klicke auf ein Training um teilzunehmen und Techniken in deine Bibliothek zu übernehmen.
          </p>
        </div>
      </div>

      {/* Wochengitter */}
      <div className="mx-auto max-w-7xl px-2 py-6 sm:px-4">
        <div className="hidden gap-2 lg:grid lg:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => (
            <DayColumn key={i} weekday={i} blocks={getBlocksForDay(i)} isToday={i === todayWeekday} onBlockClick={openBlock} label={WEEKDAY_LABELS[i]} short={WEEKDAY_SHORT[i]} />
          ))}
        </div>
        <div className="hidden gap-3 sm:grid sm:grid-cols-2 lg:hidden">
          {Array.from({ length: 7 }, (_, i) => (
            <DayColumn key={i} weekday={i} blocks={getBlocksForDay(i)} isToday={i === todayWeekday} onBlockClick={openBlock} label={WEEKDAY_LABELS[i]} short={WEEKDAY_SHORT[i]} />
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:hidden">
          {Array.from({ length: 7 }, (_, i) => (
            <DayColumn key={i} weekday={i} blocks={getBlocksForDay(i)} isToday={i === todayWeekday} onBlockClick={openBlock} label={WEEKDAY_LABELS[i]} short={WEEKDAY_SHORT[i]} />
          ))}
        </div>
      </div>

      {/* Modal */}
      {modal.phase !== "idle" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(3,4,6,0.85)" }}
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div
            ref={modalRef}
            className="w-full max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-xl"
            style={{ background: "var(--ink-2)", border: "1px solid var(--ink-4)" }}
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
                editDiscipline={editDiscipline}
                saving={saving}
                onClose={closeModal}
                onAttend={handleAttend}
                onStartEdit={startEdit}
                onToggleEditId={toggleEditId}
                onEditSearchChange={setEditSearch}
                onDisciplineChange={setEditDiscipline}
                onSaveTechniques={handleSaveTechniques}
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
      {blocks.length === 0 ? (
        <div
          className="flex flex-1 items-center justify-center rounded-lg py-4 text-xs"
          style={{ color: "var(--fg-4)", background: "var(--ink-2)" }}
        >
          —
        </div>
      ) : (
        blocks.map((block) => (
          <BlockCard key={block.id} block={block} isToday={isToday} onClick={() => onBlockClick(block)} />
        ))
      )}
    </div>
  );
}

// ─── BlockCard ────────────────────────────────────────────────────────────

function BlockCard({ block, isToday, onClick }: { block: TrainingBlock; isToday: boolean; onClick: () => void }) {
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
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--ink-4)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--ink-3)"; }}
    >
      <div className="mb-0.5 font-mono-ta text-[10px]" style={{ color: "var(--fg-4)", letterSpacing: "0.08em" }}>
        {block.startTime}–{block.endTime}
      </div>
      <div className="text-xs font-bold leading-tight" style={{ color: "var(--fg-1)" }}>
        {block.title}
      </div>
      {(levelStyle || catStyle) && (
        <div className="mt-1 flex flex-wrap gap-1">
          {levelStyle && (
            <span className="rounded px-1 py-0.5 text-[9px] font-bold uppercase" style={{ background: `${levelStyle.color}22`, color: levelStyle.color, letterSpacing: "0.08em" }}>
              {levelStyle.label}
            </span>
          )}
          {catStyle && (
            <span className="rounded px-1 py-0.5 text-[9px] font-bold uppercase" style={{ background: `${catStyle.color}22`, color: catStyle.color, letterSpacing: "0.08em" }}>
              {catStyle.label}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

// ─── ModalSkeleton ────────────────────────────────────────────────────────

function ModalSkeleton({ block, onClose }: { block: TrainingBlock; onClose: () => void }) {
  return (
    <div className="p-5">
      <ModalHeader block={block} onClose={onClose} />
      <div className="mt-4 space-y-2">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-10 animate-pulse rounded-lg" style={{ background: "var(--ink-4)" }} />
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
  editDiscipline,
  saving,
  onClose,
  onAttend,
  onStartEdit,
  onToggleEditId,
  onEditSearchChange,
  onDisciplineChange,
  onSaveTechniques,
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
  editDiscipline: string;
  saving: boolean;
  onClose: () => void;
  onAttend: () => void;
  onStartEdit: () => void;
  onToggleEditId: (id: string) => void;
  onEditSearchChange: (v: string) => void;
  onDisciplineChange: (d: string) => void;
  onSaveTechniques: () => void;
  onCancelEdit: () => void;
}) {
  // Aktuell gespeicherte Techniken (für Anzeige-Modus)
  const techniques: Technique[] = (session?.techniqueIds ?? [])
    .map((id) => getTechniqueById(id))
    .filter((t): t is Technique => Boolean(t));

  const techniqueCount = session?.techniqueIds?.length ?? 0;
  const exerciseCount = session?.exerciseIds?.length ?? 0;
  const displayCount = techniqueCount > 0 ? techniqueCount : exerciseCount;

  const relevantDisciplines = getBlockDisciplines(block);

  return (
    <div className="p-5">
      <ModalHeader block={block} onClose={onClose} />

      {isTrainer && editMode ? (
        // ── EDIT-MODUS: Strukturierter Technik-Picker ──────────────────────
        <TechniquePicker
          block={block}
          relevantDisciplines={relevantDisciplines}
          activeDiscipline={editDiscipline}
          selectedIds={editIds}
          search={editSearch}
          saving={saving}
          onDisciplineChange={onDisciplineChange}
          onSearchChange={onEditSearchChange}
          onToggle={onToggleEditId}
          onSave={onSaveTechniques}
          onCancel={onCancelEdit}
        />
      ) : (
        // ── ANZEIGE-MODUS ─────────────────────────────────────────────────
        <>
          <div className="mt-4">
            {techniques.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--fg-4)" }}>
                {isTrainer
                  ? "Noch keine Techniken für diese Einheit hinterlegt — füge sie über den Button unten hinzu."
                  : "Für diese Einheit wurden noch keine Techniken hinterlegt."}
              </p>
            ) : (
              <div className="space-y-2">
                <p className="mb-2 text-xs font-bold uppercase" style={{ color: "var(--fg-3)", letterSpacing: "0.1em", fontFamily: "var(--font-mono)" }}>
                  Techniken dieser Einheit ({techniques.length})
                </p>
                {techniques.map((t) => (
                  <TechniqueRow key={t.id} technique={t} />
                ))}
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-2">
            {isTrainer && (
              <button
                onClick={onStartEdit}
                className="w-full rounded-xl py-2.5 text-xs font-bold uppercase transition-colors"
                style={{ background: "var(--ink-4)", border: "1px solid var(--ta-cyan)", color: "var(--ta-cyan)", letterSpacing: "0.1em" }}
              >
                Techniken bearbeiten
              </button>
            )}

            {isLoggedIn ? (
              participated ? (
                <div
                  className="rounded-xl py-2.5 text-center text-xs font-bold uppercase"
                  style={{ background: "rgba(0,212,230,.08)", border: "1px solid rgba(0,212,230,.3)", color: "var(--ta-cyan)", letterSpacing: "0.1em" }}
                >
                  ✓ Teilgenommen
                  {attendResult !== null && attendResult > 0 && (
                    <span style={{ color: "var(--fg-3)" }}>
                      {" "}— {attendResult} Technik{attendResult !== 1 ? "en" : ""} zur Bibliothek hinzugefügt
                    </span>
                  )}
                  {attendResult === 0 && (
                    <span style={{ color: "var(--fg-4)" }}>{" "}(alle bereits in deiner Bibliothek)</span>
                  )}
                </div>
              ) : (
                <button
                  onClick={onAttend}
                  disabled={attending}
                  className="w-full rounded-xl py-2.5 text-xs font-bold uppercase transition-opacity"
                  style={{ background: "var(--ta-cyan)", color: "var(--ink-1)", letterSpacing: "0.1em", opacity: attending ? 0.6 : 1 }}
                >
                  {attending
                    ? "Wird gespeichert…"
                    : displayCount > 0
                      ? `Ich nehme teil — ${displayCount} Technik${displayCount !== 1 ? "en" : ""} übernehmen`
                      : "Ich nehme teil"}
                </button>
              )
            ) : (
              <Link
                href="/login"
                className="block w-full rounded-xl py-2.5 text-center text-xs font-bold uppercase"
                style={{ background: "var(--ta-cyan)", color: "var(--ink-1)", letterSpacing: "0.1em", textDecoration: "none" }}
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

// ─── TechniquePicker ──────────────────────────────────────────────────────

function TechniquePicker({
  block: _block,
  relevantDisciplines,
  activeDiscipline,
  selectedIds,
  search,
  saving,
  onDisciplineChange,
  onSearchChange,
  onToggle,
  onSave,
  onCancel,
}: {
  block: TrainingBlock;
  relevantDisciplines: Discipline[];
  activeDiscipline: string;
  selectedIds: string[];
  search: string;
  saving: boolean;
  onDisciplineChange: (d: string) => void;
  onSearchChange: (v: string) => void;
  onToggle: (id: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const groups = getTechniqueGroups(activeDiscipline, search);
  const totalVisible = groups.reduce((n, g) => n + g.techniques.length, 0);

  return (
    <div className="mt-4">
      {/* Disziplin-Tabs */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {relevantDisciplines.map((d) => {
          const active = d === activeDiscipline;
          const color = DISCIPLINE_COLOR[d] ?? "var(--ta-cyan)";
          return (
            <button
              key={d}
              onClick={() => onDisciplineChange(d)}
              className="rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase transition-colors"
              style={{
                background: active ? `${color}22` : "var(--ink-3)",
                border: `1px solid ${active ? color : "var(--ink-5)"}`,
                color: active ? color : "var(--fg-3)",
                letterSpacing: "0.08em",
              }}
            >
              {DISCIPLINE_LABEL[d] ?? d}
            </button>
          );
        })}
      </div>

      {/* Suchfeld */}
      <input
        type="text"
        placeholder="Technik suchen…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="mb-3 w-full rounded-lg px-3 py-2 text-sm"
        style={{ background: "var(--ink-3)", border: "1px solid var(--ink-5)", color: "var(--fg-1)", outline: "none" }}
        autoFocus
      />

      {/* Status-Zeile */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold uppercase" style={{ color: "var(--ta-cyan)", letterSpacing: "0.1em", fontFamily: "var(--font-mono)" }}>
          {selectedIds.length} gewählt
        </span>
        <span className="text-[11px]" style={{ color: "var(--fg-4)" }}>
          {totalVisible} Techniken
        </span>
      </div>

      {/* Gruppierte Technik-Liste */}
      <div
        className="max-h-64 space-y-3 overflow-y-auto pr-1"
        style={{ scrollbarWidth: "thin" }}
      >
        {groups.length === 0 ? (
          <p className="py-4 text-center text-sm" style={{ color: "var(--fg-4)" }}>
            Keine Techniken gefunden.
          </p>
        ) : (
          groups.map((group) => (
            <TechniqueGroup
              key={group.area}
              group={group}
              selectedIds={selectedIds}
              onToggle={onToggle}
            />
          ))
        )}
      </div>

      {/* Aktuelle Auswahl-Chips */}
      {selectedIds.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[10px] font-bold uppercase" style={{ color: "var(--fg-4)", letterSpacing: "0.1em", fontFamily: "var(--font-mono)" }}>
            Auswahl
          </p>
          <div className="flex flex-wrap gap-1.5">
            {selectedIds.map((id) => {
              const t = getTechniqueById(id);
              return (
                <button
                  key={id}
                  onClick={() => onToggle(id)}
                  className="rounded-lg px-2 py-1 text-[11px] transition-opacity hover:opacity-70"
                  style={{ background: "rgba(0,212,230,.1)", border: "1px solid rgba(0,212,230,.3)", color: "var(--ta-cyan)" }}
                  title="Entfernen"
                >
                  {t?.name ?? id} ✕
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Speichern / Abbrechen */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 rounded-xl py-2.5 text-xs font-bold uppercase transition-opacity"
          style={{ background: "var(--ta-cyan)", color: "var(--ink-1)", letterSpacing: "0.1em", opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "Speichern…" : `Speichern (${selectedIds.length})`}
        </button>
        <button
          onClick={onCancel}
          className="rounded-xl px-4 py-2.5 text-xs font-bold uppercase"
          style={{ background: "var(--ink-4)", color: "var(--fg-3)", letterSpacing: "0.1em" }}
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}

// ─── TechniqueGroup ───────────────────────────────────────────────────────

function TechniqueGroup({
  group,
  selectedIds,
  onToggle,
}: {
  group: TechniqueGroup;
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const selectedInGroup = group.techniques.filter((t) => selectedIds.includes(t.id)).length;

  return (
    <div>
      {/* Gruppen-Header */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center gap-2 py-1"
      >
        <span
          className="text-[11px] font-bold uppercase"
          style={{ color: "var(--fg-3)", letterSpacing: "0.1em", fontFamily: "var(--font-mono)" }}
        >
          {group.label}
        </span>
        <span
          className="flex-1"
          style={{ height: "1px", background: "var(--ink-4)" }}
        />
        {selectedInGroup > 0 && (
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-bold"
            style={{ background: "rgba(0,212,230,.15)", color: "var(--ta-cyan)" }}
          >
            {selectedInGroup}
          </span>
        )}
        <span className="text-[10px]" style={{ color: "var(--fg-4)" }}>
          {collapsed ? "▶" : "▼"}
        </span>
      </button>

      {/* Techniken */}
      {!collapsed && (
        <div className="space-y-0.5">
          {group.techniques.map((t) => {
            const selected = selectedIds.includes(t.id);
            const levelColor = TECHNIQUE_LEVEL_COLOR[t.level ?? ""] ?? "var(--fg-4)";
            return (
              <button
                key={t.id}
                onClick={() => onToggle(t.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors"
                style={{
                  background: selected ? "rgba(0,212,230,.1)" : "transparent",
                  border: `1px solid ${selected ? "rgba(0,212,230,.3)" : "transparent"}`,
                }}
              >
                {/* Checkbox */}
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px]"
                  style={{
                    background: selected ? "var(--ta-cyan)" : "var(--ink-4)",
                    color: selected ? "var(--ink-1)" : "transparent",
                  }}
                >
                  {selected ? "✓" : ""}
                </span>

                {/* Name */}
                <span className="flex-1 truncate text-sm" style={{ color: "var(--fg-1)" }}>
                  {t.name}
                </span>

                {/* Level-Badge */}
                {t.level && (
                  <span
                    className="shrink-0 text-[9px] font-bold uppercase"
                    style={{ color: levelColor, letterSpacing: "0.06em" }}
                  >
                    {TECHNIQUE_LEVEL_LABEL[t.level] ?? t.level}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── ModalHeader ──────────────────────────────────────────────────────────

function ModalHeader({ block, onClose }: { block: TrainingBlock; onClose: () => void }) {
  const levelStyle = block.level ? LEVEL_STYLE[block.level] : null;
  const catStyle = block.category ? CATEGORY_STYLE[block.category] : null;

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {levelStyle && (
            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: `${levelStyle.color}22`, color: levelStyle.color, letterSpacing: "0.08em" }}>
              {levelStyle.label}
            </span>
          )}
          {catStyle && (
            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: `${catStyle.color}22`, color: catStyle.color, letterSpacing: "0.08em" }}>
              {catStyle.label}
            </span>
          )}
        </div>
        <h2 className="mt-1 font-display-ta text-xl font-black uppercase leading-tight" style={{ color: "var(--fg-1)", letterSpacing: "0.04em" }}>
          {block.title}
        </h2>
        <p className="mt-0.5 font-mono-ta text-sm" style={{ color: "var(--fg-3)", letterSpacing: "0.08em" }}>
          {block.startTime}–{block.endTime} Uhr
          <span className="ml-2" style={{ color: "var(--fg-4)" }}>· Diese Woche</span>
        </p>
      </div>
      <button
        onClick={onClose}
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm transition-colors"
        style={{ background: "var(--ink-4)", color: "var(--fg-3)", border: "1px solid var(--ink-5)" }}
        aria-label="Schließen"
      >
        ✕
      </button>
    </div>
  );
}

// ─── TechniqueRow ─────────────────────────────────────────────────────────

function TechniqueRow({ technique }: { technique: Technique }) {
  const catStyle = CATEGORY_STYLE[technique.category] ?? null;
  const levelColor = TECHNIQUE_LEVEL_COLOR[technique.level ?? ""] ?? "var(--fg-4)";

  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2"
      style={{ background: "var(--ink-3)", border: "1px solid var(--ink-4)", borderLeft: `3px solid ${catStyle?.color ?? "var(--fg-4)"}` }}
    >
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium" style={{ color: "var(--fg-1)" }}>
          {technique.name}
        </span>
      </div>
      {technique.level && (
        <span
          className="shrink-0 text-[10px] font-bold uppercase"
          style={{ color: levelColor, fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}
        >
          {TECHNIQUE_LEVEL_LABEL[technique.level] ?? technique.level}
        </span>
      )}
      {catStyle && (
        <span
          className="shrink-0 text-[9px] font-bold uppercase"
          style={{ color: catStyle.color, fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}
        >
          {catStyle.label}
        </span>
      )}
    </div>
  );
}
