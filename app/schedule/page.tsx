"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth, useRights } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import AthleteTabBar from "@/components/AthleteTabBar";
import Icon from "@/components/ui/Icon";
import {
  WEEKDAY_LABELS,
  getBlocksForDay,
  getCurrentWeekday,
  getWeekIdentifier,
} from "@/lib/schedule";
import {
  addSessionExercisesToLibrary,
  addSessionTechniquesToLibrary,
  getTrainingSession,
  hasParticipated,
  isSubscribedToBlock,
  recordParticipation,
  setSessionTechniques,
  subscribeToBlock,
  unsubscribeFromBlock,
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
import { CATEGORY_COLOR, DISCIPLINE_COLOR } from "@/lib/discipline-colors";
import TrainerHint from "@/components/TrainerHint";

// ─── Visuelle Hilfskonstanten ──────────────────────────────────────────────

const LEVEL_LABEL: Record<string, string> = {
  kids: "Kids",
  teens: "Teens",
  adult: "Adult",
  advanced: "Advanced",
  mixed: "Mixed",
};

// Farben zentral aus lib/discipline-colors.ts — eine Rubrik = app-weit eine Farbe.
const CATEGORY_STYLE: Record<string, { label: string; color: string }> = {
  boxing:      { label: "Box",       color: CATEGORY_COLOR.boxing },
  wrestling:   { label: "Ringen",    color: CATEGORY_COLOR.wrestling },
  bjj:         { label: "BJJ",       color: CATEGORY_COLOR.bjj },
  "muay-thai": { label: "Muay Thai", color: CATEGORY_COLOR["muay-thai"] },
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

// Technik-Level laufen über die Semantik-Tokens (keine eigenen Farbwerte)
const TECHNIQUE_LEVEL_COLOR: Record<string, string> = {
  anfaenger:       "var(--positive)",
  aufbau:          "var(--accent-text)",
  fortgeschritten: "var(--warning)",
  advanced:        "var(--accent-2)",
  pro:             "var(--negative)",
};

// Versalien-Button-Typo (Muster der Referenzseite)
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

const MONO_TIME: React.CSSProperties = {
  font: "600 13px/1.2 var(--font-mono), ui-monospace, monospace",
};

/**
 * Meta-Zeile eines Kurses + Farbpunkt der Disziplin. Der Text trägt die
 * Information, die Farbe verstärkt nur (Multi-Gym: Rubriken sind später frei
 * konfigurierbar). Gezeigt wird NUR, was der Kurstitel nicht schon selbst
 * sagt — Titel wie „Kickboxen Adult" bekommen keine Echo-Unterzeile.
 */
function blockMeta(block: TrainingBlock): { dotColor: string; meta: string } {
  const catStyle = block.category ? CATEGORY_STYLE[block.category] : null;
  const dotColor =
    (block.discipline ? DISCIPLINE_COLOR[block.discipline] : null) ??
    catStyle?.color ??
    "var(--text-3)";
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöüß]/g, "");
  const title = norm(block.title);
  const levelLabel = block.level ? LEVEL_LABEL[block.level] ?? block.level : null;
  const disciplineLabel = block.discipline
    ? DISCIPLINE_LABEL[block.discipline] ?? block.discipline
    : catStyle?.label ?? null;
  const meta = [levelLabel, disciplineLabel]
    .filter((part): part is string => Boolean(part && !title.includes(norm(part))))
    .join(" · ");
  return { dotColor, meta };
}

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
      subscribed: boolean;
    };

const TRAINER_BLOCK_DESCRIPTION =
  "Füge diesem Kurs Techniken für diese Woche hinzu. Deine Schüler erhalten die Inhalte anschließend automatisch in ihrer Bibliothek.";

// ─── Hauptkomponente ───────────────────────────────────────────────────────

export default function SchedulePage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const todayWeekday = getCurrentWeekday();
  const isTrainer = useRights().trainer;

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

      const [session, participated, subscribed] = await Promise.all([
        getTrainingSession(block.id, weekId),
        user ? hasParticipated(user.uid, sessionId) : Promise.resolve(false),
        user ? isSubscribedToBlock(user.uid, block.id) : Promise.resolve(false),
      ]);

      setModal({ phase: "ready", block, session, participated, subscribed });
    },
    [user],
  );

  const [subscribing, setSubscribing] = useState(false);

  async function handleToggleSubscribe() {
    if (!user || modal.phase !== "ready") return;
    setSubscribing(true);
    try {
      const blockId = modal.block.id;
      if (modal.subscribed) {
        await unsubscribeFromBlock(user.uid, blockId);
      } else {
        await subscribeToBlock(user.uid, blockId);
      }
      setModal((prev) =>
        prev.phase === "ready" ? { ...prev, subscribed: !prev.subscribed } : prev,
      );
    } finally {
      setSubscribing(false);
    }
  }

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
    <main
      className={isTrainer ? "min-h-screen pb-12" : "min-h-screen pb-32"}
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      {/* Kopfbereich mit Ambient-Schicht — der Clip-Container umschließt NUR
          die Ambient-Ebene, nie die ganze Sektion (Muster der Referenzseite). */}
      <section className="relative">
        <div className="absolute inset-0 overflow-hidden" aria-hidden>
          <div data-ambient style={{ background: "var(--ambient)" }} />
        </div>
        <div className="relative mx-auto flex w-full max-w-2xl items-start gap-3 px-4 pb-5 pt-6 lg:max-w-7xl lg:px-6 lg:pb-7 lg:pt-8">
          <div className="flex flex-1 flex-col gap-1">
            <span className="t-label">Diese Woche</span>
            <h1
              style={{
                font: "var(--type-display)",
                letterSpacing: "var(--ls-display)",
                textTransform: "uppercase",
              }}
            >
              Kursplan
            </h1>
            <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
              {isTrainer
                ? "Klicke auf einen Kurs, um Details zu öffnen und Techniken für diese Woche hinzuzufügen."
                : "Klicke auf ein Training um teilzunehmen und Techniken in deine Bibliothek zu übernehmen."}
            </p>
          </div>
          {/* Mobil: Theme-Umschalter im Seitenkopf (Desktop: in der Tab-Bar) */}
          {!isTrainer && (
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                theme === "dark" ? "Helles Design aktivieren" : "Dunkles Design aktivieren"
              }
              className="t-glass t-interactive inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-field lg:hidden"
              style={{ color: "var(--text-2)" }}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} size={20} />
            </button>
          )}
        </div>
      </section>

      {/* Trainer-Hinweis: Übersicht (nur einmal pro Browser) */}
      {isTrainer && (
        <div className="mx-auto w-full max-w-2xl px-4 lg:max-w-7xl lg:px-6">
          <TrainerHint id="schedule-overview" title="Kursplan">
            Klicke auf einen Kurs, um Details zu sehen und Techniken für diese
            Woche hinzuzufügen — sie landen automatisch in den Bibliotheken
            deiner Schüler.
          </TrainerHint>
        </div>
      )}

      {/* Wochengitter */}
      <div className="mx-auto grid w-full max-w-2xl grid-cols-1 gap-5 px-4 pt-1 sm:grid-cols-2 lg:max-w-7xl lg:grid-cols-7 lg:gap-2.5 lg:px-6">
        {Array.from({ length: 7 }, (_, i) => (
          <DayColumn
            key={i}
            blocks={getBlocksForDay(i)}
            isToday={i === todayWeekday}
            onBlockClick={openBlock}
            label={WEEKDAY_LABELS[i]}
          />
        ))}
      </div>

      {/* Modal */}
      {modal.phase !== "idle" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "var(--overlay)" }}
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div
            ref={modalRef}
            className="t-card max-h-[90vh] w-full overflow-y-auto rounded-modal sm:max-w-xl"
            style={{ boxShadow: "var(--glass-shadow)" }}
          >
            {modal.phase === "loading" && (
              <ModalSkeleton block={modal.block} onClose={closeModal} />
            )}
            {modal.phase === "ready" && (
              <ModalReady
                block={modal.block}
                session={modal.session}
                participated={modal.participated}
                subscribed={modal.subscribed}
                subscribing={subscribing}
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
                onToggleSubscribe={handleToggleSubscribe}
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

      {!isTrainer && <AthleteTabBar />}
    </main>
  );
}

// ─── DayColumn ────────────────────────────────────────────────────────────

function DayColumn({
  blocks,
  isToday,
  onBlockClick,
  label,
}: {
  blocks: TrainingBlock[];
  isToday: boolean;
  onBlockClick: (b: TrainingBlock) => void;
  label: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span
          className="t-label"
          style={isToday ? { color: "var(--accent-text)" } : undefined}
        >
          {label}
        </span>
        {isToday && (
          <span
            className="h-[5px] w-[5px] rounded-full"
            style={{ background: "var(--accent)" }}
            aria-hidden
          />
        )}
      </div>
      <div className="t-card flex-1 px-3.5 py-0.5">
        {blocks.length === 0 ? (
          <div
            className="flex items-center justify-center py-5"
            style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
          >
            Frei
          </div>
        ) : (
          blocks.map((block, i) => (
            <Fragment key={block.id}>
              {/* Trennlinie als eigenes Element — läge sie als border-top auf
                  der gerundeten Zeile, würden ihre Enden mitgerundet */}
              {i > 0 && (
                <div aria-hidden style={{ height: "1px", background: "var(--line)" }} />
              )}
              <BlockRow block={block} onClick={() => onBlockClick(block)} />
            </Fragment>
          ))
        )}
      </div>
    </section>
  );
}

// ─── BlockRow ─────────────────────────────────────────────────────────────

function BlockRow({
  block,
  onClick,
}: {
  block: TrainingBlock;
  onClick: () => void;
}) {
  const { dotColor, meta } = blockMeta(block);

  return (
    <button
      type="button"
      onClick={onClick}
      className="t-interactive flex min-h-hit w-full items-start gap-3 rounded-badge py-3 text-left"
    >
      <div className="flex w-11 shrink-0 flex-col gap-0.5">
        <span style={{ ...MONO_TIME, color: "var(--accent-text)" }}>
          {block.startTime}
        </span>
        <span
          style={{
            font: "500 11px/1.2 var(--font-mono), ui-monospace, monospace",
            color: "var(--text-3)",
          }}
        >
          {block.endTime}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span style={{ font: "var(--type-body-strong)" }}>{block.title}</span>
        {meta && (
          <span
            className="inline-flex items-center gap-1.5"
            style={{ ...META_FONT, color: "var(--text-3)" }}
          >
            <span
              className="h-[5px] w-[5px] shrink-0 rounded-full"
              style={{ background: dotColor }}
              aria-hidden
            />
            {meta}
          </span>
        )}
      </div>
    </button>
  );
}

// ─── ModalSkeleton ────────────────────────────────────────────────────────

function ModalSkeleton({ block, onClose }: { block: TrainingBlock; onClose: () => void }) {
  return (
    <div className="p-5">
      <ModalHeader block={block} onClose={onClose} />
      <div className="mt-4 flex flex-col gap-2">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="h-10 animate-pulse rounded-badge"
            style={{ background: "var(--surface-raised)" }}
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
  subscribed,
  subscribing,
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
  onToggleSubscribe,
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
  subscribed: boolean;
  subscribing: boolean;
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
  onToggleSubscribe: () => void;
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
        <>
          <TrainerHint id="course-edit-techniques" title="Techniken auswählen">
            Wähle hier die Techniken aus, die deine Schüler diese Woche üben
            sollen. Mit „Speichern" landen sie in den Bibliotheken aller
            abonnierten Schüler.
          </TrainerHint>
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
        </>
      ) : (
        // ── ANZEIGE-MODUS ─────────────────────────────────────────────────
        <>
          {isTrainer && (
            <div
              className="mt-4 rounded-field px-3.5 py-3"
              style={{
                background: "var(--accent-subtle)",
                font: "var(--type-sub)",
                color: "var(--text-2)",
              }}
            >
              <span className="t-label mr-1.5" style={{ color: "var(--accent-text)" }}>
                Trainer-Aktion:
              </span>
              {TRAINER_BLOCK_DESCRIPTION}
            </div>
          )}

          {isTrainer && (
            <TrainerHint id="course-detail" title="Kurs-Details">
              Hier siehst du alle Infos zu diesem Kurs. Über „Techniken
              bearbeiten" weist du Inhalte für diese Woche zu.
            </TrainerHint>
          )}

          <div className="mt-4">
            {techniques.length === 0 ? (
              <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                {isTrainer
                  ? "Noch keine Techniken für diese Einheit hinterlegt — füge sie über den Button unten hinzu."
                  : "Für diese Einheit wurden noch keine Techniken hinterlegt."}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <span className="t-label">
                  Techniken dieser Einheit ({techniques.length})
                </span>
                {/* Liste = EINE Fläche mit Haarlinien-Trennern */}
                <div
                  className="rounded-card px-3.5 py-0.5"
                  style={{ background: "var(--surface-raised)" }}
                >
                  {techniques.map((t, i) => (
                    <TechniqueRow key={t.id} technique={t} first={i === 0} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-2">
            {/* Schüler-Funktion: Kurs-Abo (nur für Nicht-Trainer) */}
            {isLoggedIn && !isTrainer && (
              <button
                type="button"
                onClick={onToggleSubscribe}
                disabled={subscribing}
                className="t-interactive flex min-h-hit w-full items-center justify-center gap-2 rounded-field px-4 disabled:opacity-50"
                style={
                  subscribed
                    ? {
                        ...BTN_FONT,
                        background: "var(--accent-subtle)",
                        border: "1px solid var(--accent)",
                        color: "var(--accent-text)",
                      }
                    : {
                        ...BTN_FONT,
                        background: "var(--surface-raised)",
                        border: "1px solid var(--line)",
                        color: "var(--text-2)",
                      }
                }
                title={
                  subscribed
                    ? "Du bekommst neue Techniken aus diesem Kurs automatisch in deine Bibliothek"
                    : "Folge diesem Kurs — neue Techniken landen automatisch in deiner Bibliothek"
                }
              >
                <Icon name="star" size={14} strokeWidth={2.4} />
                {subscribing
                  ? "…"
                  : subscribed
                    ? "Kurs abonniert — Auto-Sync aktiv"
                    : "Kurs abonnieren (Auto-Sync)"}
              </button>
            )}

            {isTrainer && (
              <button
                type="button"
                onClick={onStartEdit}
                className="t-interactive flex min-h-hit w-full items-center justify-center gap-2 rounded-field px-4"
                style={{
                  ...BTN_FONT,
                  background: "transparent",
                  border: "1px solid var(--accent)",
                  color: "var(--accent-text)",
                }}
              >
                <Icon name="edit" size={14} strokeWidth={2.4} />
                Techniken bearbeiten
              </button>
            )}

            {/* Schüler-Funktion: Teilnahme (nur für Nicht-Trainer) */}
            {!isTrainer &&
              (isLoggedIn ? (
                participated ? (
                  <div
                    className="flex min-h-hit w-full flex-wrap items-center justify-center gap-1.5 rounded-field px-4 py-2.5 text-center"
                    style={{
                      ...BTN_FONT,
                      background: "var(--accent-subtle)",
                      color: "var(--accent-text)",
                    }}
                  >
                    <Icon name="check" size={14} strokeWidth={2.6} />
                    Teilgenommen
                    {attendResult !== null && attendResult > 0 && (
                      <span
                        style={{
                          font: "var(--type-sub)",
                          letterSpacing: 0,
                          textTransform: "none",
                          color: "var(--text-2)",
                        }}
                      >
                        — {attendResult} Technik{attendResult !== 1 ? "en" : ""} zur
                        Bibliothek hinzugefügt
                      </span>
                    )}
                    {attendResult === 0 && (
                      <span
                        style={{
                          font: "var(--type-sub)",
                          letterSpacing: 0,
                          textTransform: "none",
                          color: "var(--text-3)",
                        }}
                      >
                        (alle bereits in deiner Bibliothek)
                      </span>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onAttend}
                    disabled={attending}
                    className="t-interactive flex min-h-hit w-full items-center justify-center rounded-field px-4 disabled:opacity-60"
                    style={{
                      ...BTN_FONT,
                      background: "var(--accent)",
                      color: "var(--on-accent)",
                      boxShadow: "var(--accent-glow)",
                    }}
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
                  className="t-interactive flex min-h-hit w-full items-center justify-center rounded-field px-4"
                  style={{
                    ...BTN_FONT,
                    background: "var(--accent)",
                    color: "var(--on-accent)",
                    boxShadow: "var(--accent-glow)",
                    textDecoration: "none",
                  }}
                  onClick={onClose}
                >
                  Anmelden zum Teilnehmen
                </Link>
              ))}
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
          return (
            <button
              key={d}
              type="button"
              onClick={() => onDisciplineChange(d)}
              className="t-interactive min-h-hit rounded-pill px-3.5"
              style={{
                font: "600 11px/1.2 var(--font-archivo), system-ui, sans-serif",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                background: active ? "var(--accent-subtle)" : "transparent",
                border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
                color: active ? "var(--accent-text)" : "var(--text-3)",
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
        className="t-interactive mb-3 min-h-hit w-full rounded-field px-3.5"
        style={{
          font: "var(--type-body)",
          background: "var(--surface-raised)",
          border: "1px solid var(--line)",
          color: "var(--text-body)",
          outline: "none",
        }}
        autoFocus
      />

      {/* Status-Zeile */}
      <div className="mb-2 flex items-baseline justify-between">
        <span className="t-label" style={{ color: "var(--accent-text)" }}>
          {selectedIds.length} gewählt
        </span>
        <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
          {totalVisible} Techniken
        </span>
      </div>

      {/* Gruppierte Technik-Liste */}
      <div
        className="max-h-64 space-y-3 overflow-y-auto pr-1"
        style={{ scrollbarWidth: "thin" }}
      >
        {groups.length === 0 ? (
          <p
            className="py-4 text-center"
            style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
          >
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
        <div className="mt-3 flex flex-col gap-1.5">
          <span className="t-label">Auswahl</span>
          <div className="flex flex-wrap gap-1.5">
            {selectedIds.map((id) => {
              const t = getTechniqueById(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onToggle(id)}
                  className="t-interactive inline-flex min-h-hit items-center gap-1.5 rounded-pill px-3.5"
                  style={{
                    font: "var(--type-sub)",
                    background: "var(--accent-subtle)",
                    color: "var(--accent-text)",
                  }}
                  title="Entfernen"
                >
                  {t?.name ?? id}
                  <Icon name="x" size={12} strokeWidth={2.4} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Speichern / Abbrechen */}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="t-interactive flex min-h-hit flex-1 items-center justify-center rounded-field px-4 disabled:opacity-60"
          style={{
            ...BTN_FONT,
            background: "var(--accent)",
            color: "var(--on-accent)",
            boxShadow: "var(--accent-glow)",
          }}
        >
          {saving ? "Speichern…" : `Speichern (${selectedIds.length})`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="t-interactive flex min-h-hit items-center justify-center rounded-field px-4"
          style={{
            ...BTN_FONT,
            background: "var(--surface-raised)",
            color: "var(--text-2)",
          }}
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
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="t-interactive flex min-h-hit w-full items-center gap-2 rounded-badge"
      >
        <span className="t-label">{group.label}</span>
        <span
          className="flex-1"
          style={{ height: "1px", background: "var(--line)" }}
          aria-hidden
        />
        {selectedInGroup > 0 && (
          <span
            className="rounded-badge px-1.5 py-0.5"
            style={{
              font: "var(--type-num)",
              fontVariantNumeric: "tabular-nums",
              background: "var(--accent-subtle)",
              color: "var(--accent-text)",
            }}
          >
            {selectedInGroup}
          </span>
        )}
        <span
          style={{
            color: "var(--text-3)",
            transform: collapsed ? "rotate(-90deg)" : "none",
            transition: "transform var(--dur-fast) var(--ease-out)",
          }}
        >
          <Icon name="chevron-down" size={14} strokeWidth={2.4} />
        </span>
      </button>

      {/* Techniken */}
      {!collapsed && (
        <div className="space-y-0.5">
          {group.techniques.map((t) => {
            const selected = selectedIds.includes(t.id);
            const levelColor = TECHNIQUE_LEVEL_COLOR[t.level ?? ""] ?? "var(--text-3)";
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onToggle(t.id)}
                className="t-interactive flex min-h-hit w-full items-center gap-2.5 rounded-badge px-2 py-1.5 text-left"
                style={{
                  background: selected ? "var(--accent-subtle)" : "transparent",
                }}
              >
                {/* Checkbox */}
                <span
                  className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded"
                  style={{
                    background: selected ? "var(--accent)" : "var(--surface-raised)",
                    border: selected ? "none" : "1px solid var(--line)",
                    color: selected ? "var(--on-accent)" : "transparent",
                  }}
                >
                  {selected && <Icon name="check" size={12} strokeWidth={3} />}
                </span>

                {/* Name */}
                <span
                  className="min-w-0 flex-1 truncate"
                  style={{ font: "var(--type-body)" }}
                >
                  {t.name}
                </span>

                {/* Level-Badge */}
                {t.level && (
                  <span
                    className="shrink-0"
                    style={{ ...META_FONT, letterSpacing: "0.06em", color: levelColor }}
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
  const { dotColor, meta } = blockMeta(block);

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {meta && (
          <span className="t-label inline-flex items-center gap-1.5">
            <span
              className="h-[5px] w-[5px] shrink-0 rounded-full"
              style={{ background: dotColor }}
              aria-hidden
            />
            {meta}
          </span>
        )}
        <h2
          style={{
            font: "var(--type-h2)",
            letterSpacing: "var(--ls-display)",
            textTransform: "uppercase",
          }}
        >
          {block.title}
        </h2>
        <p style={{ ...MONO_TIME, color: "var(--text-2)" }}>
          {block.startTime}–{block.endTime} Uhr
          <span style={{ color: "var(--text-3)" }}> · Diese Woche</span>
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="t-interactive flex h-11 w-11 shrink-0 items-center justify-center rounded-field"
        style={{ background: "var(--surface-raised)", color: "var(--text-2)" }}
        aria-label="Schließen"
      >
        <Icon name="x" size={18} />
      </button>
    </div>
  );
}

// ─── TechniqueRow ─────────────────────────────────────────────────────────

function TechniqueRow({ technique, first }: { technique: Technique; first: boolean }) {
  const catStyle = CATEGORY_STYLE[technique.category] ?? null;
  const levelColor = TECHNIQUE_LEVEL_COLOR[technique.level ?? ""] ?? "var(--text-3)";

  return (
    <div
      className="flex min-h-hit items-center gap-2.5 py-2.5"
      style={first ? undefined : { borderTop: "1px solid var(--line)" }}
    >
      <span
        className="h-[5px] w-[5px] shrink-0 rounded-full"
        style={{ background: catStyle?.color ?? "var(--text-3)" }}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate" style={{ font: "var(--type-body)" }}>
        {technique.name}
      </span>
      {technique.level && (
        <span
          className="shrink-0"
          style={{ ...META_FONT, letterSpacing: "0.06em", color: levelColor }}
        >
          {TECHNIQUE_LEVEL_LABEL[technique.level] ?? technique.level}
        </span>
      )}
      {catStyle && (
        <span className="shrink-0" style={{ ...META_FONT, color: "var(--text-3)" }}>
          {catStyle.label}
        </span>
      )}
    </div>
  );
}
