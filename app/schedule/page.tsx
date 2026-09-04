"use client";

import AuswahlChips from "@/components/schedule/AuswahlChips";
import GooeySearch from "@/components/ui/GooeySearch";
import { Collapse, MorphSwap } from "@/components/motion";
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useAuth, useHasStaffShell, useRights } from "@/lib/auth-context";
import { isPermissionDenied } from "@/lib/admin";
import { resolveGymId } from "@/lib/gym";
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

/**
 * Zerlegt einen Kurstitel an den Stellen, an denen er umbrechen DARF.
 *
 * Kurstitel sind keine normalen Wörter: „MMA/Kickboxen Sparring" und
 * „(Fitness-)Kickboxen" haben für den Browser keinen einzigen regulären
 * Umbruchpunkt — nach einem Schrägstrich bricht er nicht, und der Bindestrich
 * in „(Fitness-)" ist durch die Klammer dahinter blockiert. In einer 145 px
 * schmalen Tagesspalte kam deshalb erst gar kein Umbruch zustande (der Titel
 * wurde bis 02.09. am Kartenrand abgeschnitten) und danach, mit
 * `overflow-wrap: anywhere`, einer mitten im Wort: „MMA/Kickboxe | n".
 *
 * Die Rückgabe wird mit `<wbr />` verbunden — dem HTML-Element, das genau
 * das sagt: „hier darfst du trennen, musst aber nicht". Anders als ein
 * eingefügtes Nullbreiten-Leerzeichen landet es nicht im kopierten Text.
 */
function titleParts(title: string): string[] {
  // Nach Schrägstrich, Bindestrich und schließender Klammer darf getrennt
  // werden — das sind die Fugen, die ein Mensch selbst wählen würde. Echte
  // Wortzwischenräume bleiben INNERHALB der Stücke: würde man auch an ihnen
  // trennen, klebten die Wörter beim Zusammensetzen aneinander.
  const parts: string[] = [];
  let current = "";
  for (const ch of title) {
    current += ch;
    if (ch === "/" || ch === "-" || ch === ")") {
      parts.push(current);
      current = "";
    }
  }
  if (current) parts.push(current);
  return parts;
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
  // Ohne diesen Zweig blieb das Fenster bei einem geworfenen Read ewig im
  // Ladezustand stehen (gefunden 04.09.): `openBlock` hatte kein `catch`, die
  // abgelehnte Promise verpuffte in der Konsole und `setModal({phase:"ready"})`
  // lief nie. Häufigster Auslöser: kein Login — dann verweigert Firestore die
  // Session-Daten. `denied` trennt die beiden Fälle, weil sie verschiedene
  // Antworten verdienen: anmelden oder es noch einmal versuchen.
  | { phase: "error"; block: TrainingBlock; denied: boolean }
  | {
      phase: "ready";
      block: TrainingBlock;
      session: TrainingSession | null;
      participated: boolean;
      subscribed: boolean;
    };

/**
 * Steht im Kurs-Fenster über dem Bearbeiten-Knopf. Bewusst OHNE „deine
 * Schüler“: Den Satz liest seit 02.09. auch eine reine Verwaltung, die
 * Kursinhalte pflegt, ohne selbst zu unterrichten.
 */
const EDIT_BLOCK_DESCRIPTION =
  "Leg fest, was in dieser Einheit trainiert wird. Die Techniken landen automatisch in den Bibliotheken deiner Athleten.";

// ─── Hauptkomponente ───────────────────────────────────────────────────────

export default function SchedulePage() {
  const { user, profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const todayWeekday = getCurrentWeekday();
  // ZWEI FRAGEN, DIE NICHT DIESELBE SIND — bis 02.09.2026 beantwortete sie
  // hier ein einziges `isTrainer`, und das war der Fehler:
  //
  // `canEditSessions` — wer die KURSINHALTE pflegen darf. Das sind Trainer UND
  //   Verwaltung (Konzept §7: „Inhalte pflegen Verwaltung + Trainer,
  //   Aktivieren nur Verwaltung"). `firestore.rules` lässt beide seit dem
  //   01.09. an `trainingSessions` schreiben; dieses UI fragte danach weiter
  //   allein nach dem Trainer-Häkchen. Eine reine Verwaltung sah den Plan
  //   dadurch nur lesend, obwohl der Server ihr das Schreiben längst erlaubte
  //   — ein versteckter Knopf, kein Schutz (Konzept §3.1: der Client zeigt an,
  //   der Server entscheidet). Der Client darf WENIGER anbieten als die Regeln
  //   zulassen, aber dann ist es eine Gestaltungsentscheidung und keine
  //   vergessene Zeile.
  //
  // `isTrainer` — wer den Kurs GIBT, statt an ihm teilzunehmen. Daran hängen
  //   die beiden Schüler-Funktionen im Kurs-Fenster (Abo, Teilnahme), die für
  //   Trainer ausgeblendet sind. Eine reine Verwaltung ist Athletin ihres Gyms
  //   und behält sie — sie bekommt die Pflege DAZU, nicht anstelle.
  //
  // `hasStaffShell` beantwortet nur die Frage nach der Umrandung.
  const rights = useRights();
  const canEditSessions = rights.trainer || rights.verwaltung;
  const isTrainer = rights.trainer;
  const hasStaffShell = useHasStaffShell();

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

      try {
        const [session, participated, subscribed] = await Promise.all([
          getTrainingSession(block.id, weekId),
          user ? hasParticipated(user.uid, sessionId) : Promise.resolve(false),
          user ? isSubscribedToBlock(user.uid, block.id) : Promise.resolve(false),
        ]);

        setModal({ phase: "ready", block, session, participated, subscribed });
      } catch (err) {
        console.error("[schedule] Kurs konnte nicht geladen werden", err);
        setModal({ phase: "error", block, denied: isPermissionDenied(err) || !user });
      }
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

      // gymId muss MIT — sonst zählt die Teilnahme in keiner Gym-Kennzahl
      // (Begründung an `Participation.gymId` in lib/types.ts).
      await recordParticipation(user.uid, session, block.title, resolveGymId(profile));

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
      className={hasStaffShell ? "min-h-screen pb-12" : "min-h-screen pb-32"}
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      {/* `week-page` ist der Maßstab, an dem sich Lesespur und Wochenraster
          ausrichten (globals.css, „Wochenplan-Raster"): Ob sieben Tage
          nebeneinander passen, hängt am Platz NEBEN der Sidebar und nicht am
          Fenster — dieselben 1100 px heißen für einen Athleten 1100 px Inhalt
          und in der Stab-Hülle 772 px. */}
      <div className="week-page">
      {/* Kopfbereich mit Ambient-Schicht — der Clip-Container umschließt NUR
          die Ambient-Ebene, nie die ganze Sektion (Muster der Referenzseite). */}
      <section className="relative">
        <div className="absolute inset-0 overflow-hidden" aria-hidden>
          <div data-ambient style={{ background: "var(--ambient)" }} />
        </div>
        <div className="week-lane relative flex items-start gap-3 pb-5 pt-6 lg:pb-7 lg:pt-8">
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
              {canEditSessions
                ? "Was diese Woche auf dem Plan steht. Öffne einen Kurs und leg die Techniken fest."
                : "Deine Woche im Gym. Öffne einen Kurs, meld dich zurück und hol dir die Techniken in deine Bibliothek."}
            </p>
          </div>
          {/* Mobil: Theme-Umschalter im Seitenkopf (Desktop: in der Tab-Bar) */}
          {!hasStaffShell && (
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
      {canEditSessions && (
        <div className="week-lane">
          <TrainerHint id="schedule-overview" title="Kursplan">
            Öffne einen Kurs und leg fest, was diese Woche geübt wird. Die
            Techniken landen automatisch in den Bibliotheken deiner Athleten.
          </TrainerHint>
        </div>
      )}

      {/* Wochengitter */}
      <div className="week-lane week-grid pt-1">
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
            // Nimmt sich den Platz, den der Bildschirm hergibt (Leon 04.09.:
            // „warum machst du das Popup so klein, wenn der Desktop den Platz
            // hergibt?"). Muster wie alle Sheets: Das Panel selbst scrollt
            // NICHT (overflow-hidden), es ist eine Flex-Spalte — Kopf und Fuß
            // stehen fest, genau EIN Bereich in der Mitte scrollt und füllt
            // dabei die ganze Resthöhe bis 90vh.
            className="t-card flex max-h-[90vh] w-full flex-col overflow-hidden rounded-modal sm:max-w-xl lg:max-w-3xl"
            style={{ boxShadow: "var(--glass-shadow)" }}
          >
            {modal.phase === "loading" && (
              <ModalSkeleton block={modal.block} onClose={closeModal} />
            )}
            {modal.phase === "error" && (
              <ModalError
                block={modal.block}
                denied={modal.denied}
                onRetry={() => openBlock(modal.block)}
                onClose={closeModal}
              />
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
                canEdit={canEditSessions}
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

      {!hasStaffShell && <AthleteTabBar />}
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
      className="week-row t-interactive flex min-h-hit w-full items-start gap-3 rounded-badge py-3 text-left"
    >
      {/* Zeitspanne. In der Listen-Fassung eine schmale Spalte LINKS, im
          Wochenraster eine Zeile ÜBER dem Titel (globals.css `.week-row`) —
          die 56 px, die Spalte und Lücke dort kosten, fehlten dem Titel
          genau dort, wo er am wenigsten Platz hat. */}
      <div className="week-row-time flex w-11 shrink-0 flex-col gap-0.5">
        <span style={{ ...MONO_TIME, color: "var(--accent-text)" }}>
          {block.startTime}
        </span>
        <span
          className="week-row-dash"
          aria-hidden
          style={{ font: "var(--row-time-end)", color: "var(--text-3)" }}
        >
          –
        </span>
        <span style={{ font: "var(--row-time-end)", color: "var(--text-3)" }}>
          {block.endTime}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* `anywhere`: Kurstitel wie „MMA/Kickboxen Sparring" haben in einer
            schmalen Spalte keinen regulären Umbruchpunkt und wurden bis
            02.09. am Kartenrand ABGESCHNITTEN (gemessen: 9 von 30 Titeln bei
            1440 px). Lieber ein Umbruch mitten im Wort als ein halber Titel. */}
        <span
          style={{ font: "var(--type-body-strong)", overflowWrap: "anywhere" }}
        >
          {titleParts(block.title).map((part, i, all) => (
            <Fragment key={i}>
              {part}
              {i < all.length - 1 && <wbr />}
            </Fragment>
          ))}
        </span>
        {meta && (
          <span
            className="flex items-center gap-1.5"
            style={{ ...META_FONT, color: "var(--text-3)" }}
          >
            <span
              className="h-[5px] w-[5px] shrink-0 rounded-full"
              style={{ background: dotColor }}
              aria-hidden
            />
            <span className="min-w-0" style={{ overflowWrap: "anywhere" }}>
              {meta}
            </span>
          </span>
        )}
      </div>
    </button>
  );
}

// ─── ModalSkeleton ────────────────────────────────────────────────────────

function ModalSkeleton({ block, onClose }: { block: TrainingBlock; onClose: () => void }) {
  return (
    // Gleiche Flex-Spalte wie ModalReady, damit der Ladezustand im selben
    // Rahmen sitzt und beim Wechsel nichts springt.
    <div className="flex min-h-0 flex-1 flex-col p-5">
      <ModalHeader block={block} onClose={onClose} />
      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
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

// ─── ModalError ───────────────────────────────────────────────────────────

/**
 * Was der Kurs zeigt, wenn der Read schiefging. Zwei Fälle, zwei Antworten:
 * Ohne Login liegen Session, Teilnahme und Abo hinter der Firestore-Regel —
 * dann führt der Weg zur Anmeldung. Sonst hakt die Verbindung, und ein
 * zweiter Versuch reicht meist.
 */
function ModalError({
  block,
  denied,
  onRetry,
  onClose,
}: {
  block: TrainingBlock;
  denied: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col p-5">
      <ModalHeader block={block} onClose={onClose} />

      <div className="mt-6 flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto text-center">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: "var(--surface-raised)", color: "var(--text-2)" }}
          aria-hidden
        >
          <Icon name={denied ? "lock" : "warn"} size={20} />
        </span>
        <p style={{ font: "var(--type-body-strong)" }}>
          {denied ? "Melde dich an" : "Das hat gehakt"}
        </p>
        <p style={{ color: "var(--text-2)", maxWidth: "34ch" }}>
          {denied
            ? "Techniken, Teilnahme und Abo dieses Kurses gehören zu deinem Konto. Melde dich an, dann geht der Kurs auf."
            : "Die Verbindung war gerade zäh. Hol den Kurs einfach noch einmal."}
        </p>
      </div>

      <div className="mt-5 flex shrink-0 flex-col gap-2">
        {denied && (
          <Link
            href="/login"
            data-press
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
            Anmelden und dabei sein
          </Link>
        )}
        <button
          type="button"
          onClick={onRetry}
          className="t-interactive flex min-h-hit w-full items-center justify-center rounded-field px-4"
          style={{
            ...BTN_FONT,
            background: denied ? "var(--surface-raised)" : "var(--accent)",
            color: denied ? "var(--text-1)" : "var(--on-accent)",
            boxShadow: denied ? undefined : "var(--accent-glow)",
          }}
        >
          Noch einmal laden
        </button>
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
  canEdit,
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
  /** Darf Kursinhalte pflegen — Trainer ODER Verwaltung (Konzept §7). */
  canEdit: boolean;
  /** Gibt den Kurs, nimmt also nicht teil — blendet Abo und Teilnahme aus. */
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
    // min-h-0: Ohne das weigert sich ein Flex-Kind zu schrumpfen und der
    // innere Scrollbereich wächst aus dem Panel heraus, statt zu scrollen.
    <div className="flex min-h-0 flex-1 flex-col p-5">
      <ModalHeader block={block} onClose={onClose} />

      {/* Detail und Picker liegen am selben Platz und verwandeln sich
          ineinander. Beide Ebenen der Huelle tragen `flex min-h-0 flex-1
          flex-col`, weil der Wechsel MITTEN in der Flex-Kette des Panels
          sitzt: Ohne das reisst die Kette und der Scrollbereich waechst aus
          dem Fenster heraus (MOTION-BRIEF, Popup-Regel). */}
      <MorphSwap
        activeKey={canEdit && editMode ? "picker" : "detail"}
        className="flex min-h-0 flex-1 flex-col"
        innerClassName="flex min-h-0 flex-1 flex-col"
      >
      {canEdit && editMode ? (
        // ── EDIT-MODUS: Strukturierter Technik-Picker ──────────────────────
        <>
          {/* shrink-0: Der Hinweis behält seine Höhe, wenn die Liste
              darunter den Platz einfordert — sonst quetscht Flex ihn zusammen. */}
          <div className="shrink-0">
          <TrainerHint id="course-edit-techniques" title="Techniken auswählen">
            Stell die Techniken zusammen, die diese Woche dran sind. Mit
            „Speichern“ gehen sie an alle, die diesen Kurs abonniert haben.
          </TrainerHint>
          </div>
          <TechniquePicker
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
          {/* Alles über den Knöpfen scrollt gemeinsam — die Knopfreihe bleibt
              unten stehen und rutscht nie aus dem Bild. */}
          <div className="min-h-0 flex-1 overflow-y-auto">
          {canEdit && (
            <div
              className="mt-4 rounded-field px-3.5 py-3"
              style={{
                background: "var(--accent-subtle)",
                font: "var(--type-sub)",
                color: "var(--text-2)",
              }}
            >
              <span className="t-label mr-1.5" style={{ color: "var(--accent-text)" }}>
                Deine Einheit:
              </span>
              {EDIT_BLOCK_DESCRIPTION}
            </div>
          )}

          {canEdit && (
            <TrainerHint id="course-detail" title="Kurs-Details">
              Alles zu diesem Kurs auf einen Blick. Über „Techniken
              bearbeiten“ legst du fest, was diese Woche dran ist.
            </TrainerHint>
          )}

          <div className="mt-4">
            {techniques.length === 0 ? (
              <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                {canEdit
                  ? "Für diese Einheit steht noch nichts fest. Stell sie unten zusammen."
                  : "Für diese Einheit steht noch nichts fest."}
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

          </div>

          <div className="mt-5 flex shrink-0 flex-col gap-2">
            {/* Athleten-Funktion: Kurs-Abo (nur für Nicht-Trainer) */}
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
                    ? "Neue Techniken aus diesem Kurs landen automatisch in deiner Bibliothek"
                    : "Bleib dran — neue Techniken aus diesem Kurs landen dann automatisch in deiner Bibliothek"
                }
              >
                <Icon name="star" size={14} strokeWidth={2.4} />
                {subscribing
                  ? "…"
                  : subscribed
                    ? "Du bist dran — Auto-Sync läuft"
                    : "Kurs abonnieren (Auto-Sync)"}
              </button>
            )}

            {canEdit && (
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

            {/* Athleten-Funktion: Teilnahme (nur für Nicht-Trainer) */}
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
                        — {attendResult} Technik{attendResult !== 1 ? "en" : ""} in
                        deiner Bibliothek
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
                        (hattest du schon alle)
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
                      ? "Einen Moment…"
                      : displayCount > 0
                        ? `Ich nehme teil — ${displayCount} Technik${displayCount !== 1 ? "en" : ""} übernehmen`
                        : "Ich nehme teil"}
                  </button>
                )
              ) : (
                <Link
                  href="/login"
                  data-press
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
                  Anmelden und dabei sein
                </Link>
              ))}
          </div>
        </>
      )}
      </MorphSwap>
    </div>
  );
}

// ─── TechniquePicker ──────────────────────────────────────────────────────

function TechniquePicker({
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
    // Flex-Spalte: Tabs, Suche und Status stehen fest, die Technik-Liste
    // darunter nimmt die ganze Resthöhe des Modals ein.
    <div className="mt-4 flex min-h-0 flex-1 flex-col">
      {/* Disziplin-Tabs */}
      <div className="mb-3 flex shrink-0 flex-wrap gap-1.5">
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

      {/* Suchfeld — app-weiter Standard ist die Gooey-Pille (Leon 04.09.) */}
      <div className="mb-3 shrink-0">
        <GooeySearch
          value={search}
          onChange={onSearchChange}
          placeholder="Technik suchen…"
        />
      </div>

      {/* Status-Zeile */}
      <div className="mb-2 flex shrink-0 items-baseline justify-between">
        <span className="t-label" style={{ color: "var(--accent-text)" }}>
          {selectedIds.length} gewählt
        </span>
        <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
          {totalVisible} Techniken
        </span>
      </div>

      {/* Gruppierte Technik-Liste — der EINZIGE Scrollbereich des Modals.
          Vorher stand hier ein fester Deckel von 256 px (max-h-64): Auf
          jedem Bildschirm gleich klein, während das Modal ringsum noch
          Platz bis 90vh gehabt hätte. Jetzt füllt die Liste diesen Platz. */}
      <div
        className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1"
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
              searching={search.trim().length > 0}
            />
          ))
        )}
      </div>

      {/* Aktuelle Auswahl-Chips — bleiben unten stehen, scrollen nicht weg */}
      <AuswahlChips ids={selectedIds} onToggle={onToggle} />

      {/* Speichern / Abbrechen */}
      <div className="mt-4 flex shrink-0 gap-2">
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
          {saving ? "Einen Moment…" : `Speichern (${selectedIds.length})`}
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
  searching,
}: {
  group: TechniqueGroup;
  selectedIds: string[];
  onToggle: (id: string) => void;
  /** Suchtext aktiv → Treffer muessen sichtbar sein, Gruppe steht offen */
  searching: boolean;
}) {
  // Rubriken starten GESCHLOSSEN (Leon 04.09.) — die Liste zeigt erst die
  // Bereiche, der Trainer öffnet, was er braucht. Nur während einer Suche
  // stehen alle offen, sonst versteckte die zugeklappte Rubrik ihre Treffer.
  const [collapsed, setCollapsed] = useState(true);
  const open = !collapsed || searching;
  const selectedInGroup = group.techniques.filter((t) => selectedIds.includes(t.id)).length;

  return (
    <div>
      {/* Gruppen-Header — "quiet": hebt sich unter der Maus NICHT. Als
          normaler Knopf zoomte er um 2 % und lief links aus dem
          Scroll-Container (das F von „Footwork" war angefressen). */}
      <button
        type="button"
        data-press="quiet"
        aria-expanded={open}
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
            transform: open ? "none" : "rotate(-90deg)",
            transition: "transform var(--dur-fast) var(--ease-out)",
          }}
        >
          <Icon name="chevron-down" size={14} strokeWidth={2.4} />
        </span>
      </button>

      {/* Techniken — die Gruppe klappt weich (Collapse). Die Zeilen sind
          "quiet": Als normale Knöpfe hob die Grundhaptik jede Technik unter
          der Maus um 2 % an, in der dichten Liste poppte damit jede Zeile
          (Leon 04.09.: „das nervt"). Jetzt sinken sie nur beim Drücken ein;
          Hover ist die Flächen-Tönung von t-interactive. */}
      <Collapse open={open}>
        <div className="space-y-0.5">
          {group.techniques.map((t) => {
            const selected = selectedIds.includes(t.id);
            const levelColor = TECHNIQUE_LEVEL_COLOR[t.level ?? ""] ?? "var(--text-3)";
            return (
              <button
                key={t.id}
                type="button"
                data-press="quiet"
                aria-pressed={selected}
                onClick={() => onToggle(t.id)}
                // Kein Inline-Hintergrund im Ruhezustand: der schlüge die
                // Hover-Tönung (.picker-zeile:hover in globals.css). Leon
                // 04.09.: „die einzelne Technik soll farblich hervorgehoben
                // sein, wenn ich darüber hover."
                className="picker-zeile t-interactive flex min-h-hit w-full items-center gap-2.5 rounded-badge px-2 py-1.5 text-left"
                style={selected ? { background: "var(--accent-subtle)" } : undefined}
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
      </Collapse>
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
