"use client";

/**
 * Client-Ansicht der Trainingsplan-Seite (neues Token-System, Etappe 4;
 * seit der Workout-Pläne-Etappe auf dem WorkoutPlan-Modell: Übungen kommen
 * als IDs aus lib/exercises, die Pause ist ein Feld pro Block, die
 * Gesamtdauer wird berechnet).
 * Die Seite selbst bleibt Server-Komponente (generateStaticParams/-Metadata);
 * hier lebt alles, was die Athleten-Shell braucht (Rolle, Theme, Tab-Bar).
 *
 * Drei Editier-Wege über EINEN Editor (Teilschritt 3, Leons Vorgabe):
 *   • allowEdit (Start-/Gym-Pläne): der Editor ist DIREKT aktiv (Leons
 *     Vorgabe 2026-08-28, kein „Bearbeiten"-Zwischenschritt mehr) — alle
 *     Funktionen wie beim eigenen Workoutplan. Der Entwurf bleibt FLÜCHTIG,
 *     nichts wird automatisch gespeichert; „Workout starten" nutzt die
 *     Änderungen direkt, „Als eigenen Plan speichern"/„Verwerfen" erscheinen
 *     erst bei einer Änderung (Kopie → dort greift der Auto-Save).
 *   • editing mit autoSave (persönliche Kopie /workout/eigene/[id]): die
 *     Seite hält den Plan-State und speichert debounced.
 *   • editing mit create (/workout/eigene/neu): lokaler Entwurf, expliziter
 *     „Plan speichern"-Knopf legt das Dokument an.
 */

import AthleteTabBar from "@/components/AthleteTabBar";
import ExerciseDetailSheet from "@/components/ExerciseDetailSheet";
import ExercisePicker from "@/components/ExercisePicker";
import SwipeAction from "@/components/SwipeAction";
import Icon from "@/components/ui/Icon";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { DISCIPLINE_COLOR } from "@/lib/discipline-colors";
import { getExerciseById } from "@/lib/exercises";
import { getWorkoutDiscipline } from "@/lib/workout-plan-defaults";
import {
  planDurationSeconds,
  planExerciseCount,
  planToWorkoutDefinition,
  planWithAddedExercise,
  planWithDuplicatedExercise,
  planWithMovedExercise,
  planWithRemovedExercise,
  upsertPersonalWorkoutPlan,
  type WorkoutPlan,
} from "@/lib/workout-plans";
import type { Exercise } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const META_FONT: React.CSSProperties = {
  font: "600 10px/1.2 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

const STATUS_FONT: React.CSSProperties = {
  font: "600 11px/1.2 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

/**
 * Editier-Modus von außen (persönliche Kopie / Neu-Erstellen): die Seite
 * hält den Plan-State, PlanView rendert Eingaben + Status. Übungen: Tippen
 * im Picker bzw. x (Desktop), Wischen rechts/links (Touch — SwipeAction).
 * Halten-zum-Verschieben kommt in Teilschritt 4 in denselben Editor.
 */
export interface PlanEditing {
  onNameChange: (name: string) => void;
  onRestChange: (blockIndex: number, restSeconds: number) => void;
  onAddExercise: (blockIndex: number, exerciseId: string) => void;
  onRemoveExercise: (blockIndex: number, exerciseIndex: number) => void;
  /** Rechts wischen auf einer Plan-Übung = direkt dahinter duplizieren */
  onDuplicateExercise: (blockIndex: number, exerciseIndex: number) => void;
  /** Halten + ▲/▼: verschieben, auch über Blockgrenzen (Ziel gilt NACH
      dem Entfernen an der Quelle) */
  onMoveExercise: (
    from: { block: number; index: number },
    to: { block: number; index: number },
  ) => void;
  /** Auto-Save-Statuszeile (persönliche Kopie) — fehlt bei Entwurf/Erstellen */
  autoSave?: { saving: boolean; saved: boolean };
  error?: string | null;
  /** Kopie löschen (nur persönliche Kopie) */
  onDelete?: () => void;
  /** Expliziter Erstellen-Knopf (Neu-Erstellen statt Auto-Save) */
  create?: { onSave: () => void; saving: boolean };
}

/** Blockpause: 15-s-Raster, 0–5 min — genug Spielraum ohne Unsinnswerte. */
const REST_STEP = 15;
const REST_MAX = 300;

/** Ziel-Slot beim Ziehen: schmaler als eine echte Zeile … */
const DROP_SLOT_HEIGHT = 36;
/** … plus Außenabstand — fließt in die Mitzieh-Korrektur ein */
const DROP_SLOT_TOTAL = DROP_SLOT_HEIGHT + 8;

/**
 * Leerer Ziel-Slot beim Ziehen — ECHTES Layout-Element (kein Overlay):
 * schiebt die folgenden Zeilen und Blöcke wirklich auseinander, damit man
 * die künftige Position der gehaltenen Übung sofort sieht.
 */
function DropSlot() {
  return (
    <div
      aria-hidden
      className="animate-drop-slot pointer-events-none rounded-field"
      style={{
        height: DROP_SLOT_HEIGHT,
        margin: "4px 0",
        border: "1.5px solid var(--accent)",
        background: "var(--accent-subtle)",
        boxShadow: "var(--accent-glow)",
      }}
    />
  );
}

function Hairline() {
  return <div aria-hidden style={{ height: "1px", background: "var(--line)" }} />;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} s`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s} s`;
}

/**
 * Eckdaten-Kachel: Zahl in num-xl, Präfix/Einheit eine Stufe kleiner
 * (Muster der Trainingsdauer-Anzeige im Generator) — bleibt dadurch
 * IMMER einzeilig, auch „≈ 68 min" in der 3-Spalten-Karte auf 360px.
 */
function Stat({
  label,
  value,
  unit,
  prefix,
}: {
  label: string;
  value: string;
  unit?: string;
  prefix?: string;
}) {
  const smallFont: React.CSSProperties = {
    font: "var(--type-body-strong)",
    color: "var(--text-3)",
  };
  return (
    <div className="flex flex-col gap-1">
      <span className="t-label">{label}</span>
      <span
        className="whitespace-nowrap tabular-nums"
        style={{ font: "var(--type-num-xl)", color: "var(--accent-text)" }}
      >
        {prefix && <span style={smallFont}>{prefix} </span>}
        {value}
        {unit && <span style={smallFont}> {unit}</span>}
      </span>
    </div>
  );
}

export default function PlanView({
  plan,
  sessionPayload,
  backHref,
  backLabel,
  allowEdit,
  editing,
}: {
  plan: WorkoutPlan;
  /** Original-Payload einer laufenden Session (Detail-Ansicht /workout):
      hält beim Wiedereinstieg die exakten Timerwerte, statt sie aus dem
      Plan neu abzuleiten */
  sessionPayload?: string;
  /** Zurück-Ziel überschreiben (Detail-Ansicht generierter Workouts) */
  backHref?: string;
  backLabel?: string;
  /** Editor direkt aktiv (Start-/Gym-Pläne): flüchtiger Entwurf,
      „Als eigenen Plan speichern" bei Änderung — nie zusammen mit `editing` */
  allowEdit?: boolean;
  /** Editier-Modus von außen (persönliche Kopie / Neu-Erstellen) */
  editing?: PlanEditing;
}) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isTrainer = profile?.role === "trainer" || profile?.role === "admin";

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pickerBlock, setPickerBlock] = useState<number | null>(null);
  // Übungs-Detail-Sheet: Tipp/Klick auf eine Übungszeile (Leons Wahl
  // 2026-08-28 — gleiche Geste wie im Picker; Wischen/Halten unberührt)
  const [detailExercise, setDetailExercise] = useState<Exercise | null>(null);

  // ── Zeilen-Interaktion im Editor (Leons Vorgaben 2026-08-28):
  //    selectedRow = per Halten ausgewählt (▲/▼ verschieben), removingRow =
  //    Lösch-Animation läuft, rowFlash = Dupliziere-Feedback (Glow + „+1").
  const [selectedRow, setSelectedRow] = useState<{
    block: number;
    index: number;
  } | null>(null);
  const [removingRow, setRemovingRow] = useState<{
    block: number;
    index: number;
  } | null>(null);
  const [rowFlash, setRowFlash] = useState<{ key: string; tick: number } | null>(
    null,
  );
  // Einfüge-Ziel während des Drags (leuchtende Linie); platziert wird
  // erst beim Loslassen
  const [dropTarget, setDropTarget] = useState<{
    block: number;
    index: number;
  } | null>(null);
  const rowFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const removeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (rowFlashTimer.current) clearTimeout(rowFlashTimer.current);
      if (removeTimer.current) clearTimeout(removeTimer.current);
    },
    [],
  );

  // ── Flüchtiger Entwurf (allowEdit): Blöcke tief genug kopieren, damit
  //    Änderungen nie in das (statisch gerenderte) Original durchschlagen.
  //    Der Editor ist direkt aktiv — der Entwurf entsteht automatisch,
  //    sobald der eingeloggte User feststeht (statische Seite: Auth kommt
  //    erst clientseitig an).
  const [draft, setDraft] = useState<WorkoutPlan | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  function startDraft() {
    setDraft({
      ...plan,
      blocks: plan.blocks.map((b) => ({ ...b, exerciseIds: [...b.exerciseIds] })),
    });
  }

  useEffect(() => {
    if (!allowEdit || editing || !user) return;
    setDraft(
      (d) =>
        d ?? {
          ...plan,
          blocks: plan.blocks.map((b) => ({
            ...b,
            exerciseIds: [...b.exerciseIds],
          })),
        },
    );
  }, [allowEdit, editing, user, plan]);

  function patchDraft(patch: (d: WorkoutPlan) => WorkoutPlan) {
    setDraft((d) => (d ? patch(d) : d));
  }

  const draftEditing: PlanEditing | undefined = draft
    ? {
        onNameChange: (name) => patchDraft((d) => ({ ...d, name })),
        onRestChange: (i, restSeconds) =>
          patchDraft((d) => ({
            ...d,
            blocks: d.blocks.map((b, bi) =>
              bi === i ? { ...b, restSeconds } : b,
            ),
          })),
        onAddExercise: (i, exerciseId) =>
          patchDraft((d) => planWithAddedExercise(d, i, exerciseId)),
        onRemoveExercise: (i, exerciseIndex) =>
          patchDraft((d) => planWithRemovedExercise(d, i, exerciseIndex)),
        onDuplicateExercise: (i, exerciseIndex) =>
          patchDraft((d) => planWithDuplicatedExercise(d, i, exerciseIndex)),
        onMoveExercise: (from, to) =>
          patchDraft((d) => planWithMovedExercise(d, from, to)),
      }
    : undefined;

  // Externer Editier-Modus hat Vorrang; sonst ggf. der interne Entwurf
  const edit = editing ?? draftEditing;
  const shown = editing ? plan : draft ?? plan;

  // Speichern/Verwerfen erst zeigen, wenn wirklich etwas geändert wurde —
  // der Entwurf startet als strukturgleiche Kopie des Plans, ein purer
  // JSON-Vergleich reicht daher als Änderungs-Erkennung
  const draftDirty =
    draft !== null && JSON.stringify(draft) !== JSON.stringify(plan);

  // Löschen mit kurzer Raus-Animation; solange sie läuft, keine weitere
  // Löschung (die Indizes würden sonst unter dem Timer wegrutschen)
  function handleRemoveRow(blockIndex: number, exerciseIndex: number) {
    if (!edit || removingRow) return;
    setSelectedRow(null);
    setRemovingRow({ block: blockIndex, index: exerciseIndex });
    removeTimer.current = setTimeout(() => {
      setRemovingRow(null);
      edit.onRemoveExercise(blockIndex, exerciseIndex);
    }, 220);
  }

  // Duplizieren (rechts wischen): Feedback auf der NEUEN Zeile (i+1)
  function handleDuplicateRow(blockIndex: number, exerciseIndex: number) {
    if (!edit) return;
    setSelectedRow(null);
    edit.onDuplicateExercise(blockIndex, exerciseIndex);
    flashRow(`${blockIndex}:${exerciseIndex + 1}`);
  }

  function flashRow(key: string) {
    setRowFlash((f) => ({ key, tick: (f?.tick ?? 0) + 1 }));
    if (rowFlashTimer.current) clearTimeout(rowFlashTimer.current);
    rowFlashTimer.current = setTimeout(() => setRowFlash(null), 900);
  }

  // ── Halten & Ziehen (Leons Vorgabe 2026-08-28): die angehobene Übung
  //    folgt dem Zeiger (Transform), eine leuchtende Linie zeigt das Ziel,
  //    PLATZIERT wird erst beim Loslassen — auch über Blockgrenzen. Nahe
  //    der Bildschirmkante scrollt die Seite automatisch weiter.
  //    Bewusst KEIN Live-Umsortieren während des Drags: das würde das
  //    DOM-Element unter dem Finger austauschen und die Touch-Events der
  //    laufenden Geste abreißen lassen. Während des Drags verhindert ein
  //    NICHT-passiver Dokument-touchmove-Listener das native Scrollen
  //    (React-Handler sind passiv, preventDefault ginge dort ins Leere).
  const editRef = useRef(edit);
  editRef.current = edit;
  const dragRef = useRef<{
    /** Quelle — bleibt während des Drags konstant */
    pos: { block: number; index: number };
    /** aktuelles Einfüge-Ziel (Koordinaten NACH Entfernen an der Quelle) */
    target: { block: number; index: number } | null;
    pointerY: number;
    /** Zeilen-Element + Ausgangslage für die Mitzieh-Transform */
    el: HTMLElement | null;
    grabOffset: number;
    baseTop: number;
    baseScroll: number;
    rowHeight: number;
    /** Zugrichtung: der Ziel-Slot wird „vor sich hergeschoben" */
    lastY: number;
    dir: -1 | 0 | 1;
    raf: number | null;
    cleanup: () => void;
  } | null>(null);

  function dragTarget(pointerY: number): { block: number; index: number } | null {
    const d = dragRef.current;
    if (!d) return null;
    const blockEls = Array.from(
      document.querySelectorAll<HTMLElement>("[data-plan-block]"),
    );
    if (blockEls.length === 0) return null;
    // Block unter dem Zeiger, sonst der nächstgelegene
    let blockEl: HTMLElement | null = null;
    let best = Infinity;
    for (const el of blockEls) {
      const r = el.getBoundingClientRect();
      if (pointerY >= r.top && pointerY <= r.bottom) {
        blockEl = el;
        break;
      }
      const dist = pointerY < r.top ? r.top - pointerY : pointerY - r.bottom;
      if (dist < best) {
        best = dist;
        blockEl = el;
      }
    }
    if (!blockEl) return null;
    const block = Number(blockEl.dataset.planBlock);
    // Einfüge-Index = Zeilen dieses Blocks (ohne die gezogene), deren
    // Mitte über dem Zeiger liegt → Ziel gilt NACH Entfernen an der Quelle
    let index = 0;
    for (const el of Array.from(
      blockEl.querySelectorAll<HTMLElement>("[data-plan-row]"),
    )) {
      if (el.dataset.planRow === `${d.pos.block}:${d.pos.index}`) continue;
      const r = el.getBoundingClientRect();
      if (pointerY > r.top + r.height / 2) index += 1;
    }
    return { block, index };
  }

  function dragFrame() {
    const d = dragRef.current;
    if (!d) return;
    // Auto-Scroll nahe der Kante, Tempo steigt zur Kante hin
    const EDGE = 80;
    const MAX_SPEED = 14;
    const y = d.pointerY;
    if (y < EDGE) {
      window.scrollBy(0, -Math.ceil(((EDGE - y) / EDGE) * MAX_SPEED));
    } else if (y > window.innerHeight - EDGE) {
      window.scrollBy(
        0,
        Math.ceil(((y - (window.innerHeight - EDGE)) / EDGE) * MAX_SPEED),
      );
    }
    // Zeile folgt dem Zeiger — Scrollversatz eingerechnet. Liegt der
    // Ziel-Slot OBERHALB der Zeile, drückt er ihre natürliche Lage nach
    // unten → gegenrechnen, sonst springt sie unter dem Finger weg.
    if (d.el) {
      const t = d.target;
      const slotAbove =
        t !== null &&
        !(t.block === d.pos.block && t.index === d.pos.index) &&
        (t.block < d.pos.block ||
          (t.block === d.pos.block && t.index < d.pos.index));
      const originTop =
        d.baseTop -
        (window.scrollY - d.baseScroll) +
        (slotAbove ? DROP_SLOT_TOTAL : 0);
      const shift = y - d.grabOffset - originTop;
      d.el.style.transform = `translateY(${shift}px) scale(1.02)`;
    }
    // Zugrichtung merken — kleines Zittern flippt sie nicht
    const dy = y - d.lastY;
    if (Math.abs(dy) > 3) {
      d.dir = dy > 0 ? 1 : -1;
      d.lastY = y;
    }
    // Der Slot läuft der schwebenden Zeile VORAUS (Leon 2026-08-28):
    // Ziel an deren vorderer Kante suchen — abwärts die Unterkante,
    // aufwärts die Oberkante; um ein Drittel Slot-Höhe eingerückt, mehr
    // darf der Slot nicht hinter der Zeile verschwinden.
    const floatTop = y - d.grabOffset;
    const probe =
      d.dir > 0
        ? floatTop + d.rowHeight - DROP_SLOT_HEIGHT / 3
        : d.dir < 0
          ? floatTop + DROP_SLOT_HEIGHT / 3
          : y;
    const target = dragTarget(probe);
    const changed =
      (target === null) !== (d.target === null) ||
      (target &&
        d.target &&
        (target.block !== d.target.block || target.index !== d.target.index));
    if (changed) {
      d.target = target;
      setDropTarget(target);
    }
    d.raf = requestAnimationFrame(dragFrame);
  }

  function startDrag(block: number, index: number, startY: number) {
    if (!edit || dragRef.current) return;
    setSelectedRow({ block, index });
    const el = document.querySelector<HTMLElement>(
      `[data-plan-row="${block}:${index}"]`,
    );
    if (el) el.style.zIndex = "30";
    const onTouchMoveDoc = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      if (dragRef.current && t) dragRef.current.pointerY = t.clientY;
    };
    const onMouseMoveDoc = (e: MouseEvent) => {
      if (dragRef.current) dragRef.current.pointerY = e.clientY;
    };
    const finish = () => stopDrag();
    document.addEventListener("touchmove", onTouchMoveDoc, { passive: false });
    document.addEventListener("touchend", finish);
    document.addEventListener("touchcancel", finish);
    document.addEventListener("mousemove", onMouseMoveDoc);
    document.addEventListener("mouseup", finish);
    dragRef.current = {
      pos: { block, index },
      target: null,
      pointerY: startY,
      el,
      grabOffset: el ? startY - el.getBoundingClientRect().top : 0,
      baseTop: el ? el.getBoundingClientRect().top : 0,
      baseScroll: window.scrollY,
      rowHeight: el ? el.getBoundingClientRect().height : 0,
      lastY: startY,
      dir: 0,
      raf: null,
      cleanup: () => {
        document.removeEventListener("touchmove", onTouchMoveDoc);
        document.removeEventListener("touchend", finish);
        document.removeEventListener("touchcancel", finish);
        document.removeEventListener("mousemove", onMouseMoveDoc);
        document.removeEventListener("mouseup", finish);
      },
    };
    dragRef.current.raf = requestAnimationFrame(dragFrame);
  }

  function stopDrag() {
    const d = dragRef.current;
    if (!d) return;
    if (d.raf !== null) cancelAnimationFrame(d.raf);
    d.cleanup();
    if (d.el) {
      d.el.style.transform = "";
      d.el.style.zIndex = "";
    }
    // Loslassen platziert die Übung am Ziel (falls es eines gibt und es
    // nicht der Ausgangsplatz ist)
    const src = d.pos;
    const tgt = d.target;
    dragRef.current = null;
    setSelectedRow(null);
    setDropTarget(null);
    if (tgt && (tgt.block !== src.block || tgt.index !== src.index)) {
      editRef.current?.onMoveExercise(src, tgt);
    }
  }

  // Aufräumen, falls die Seite mitten im Drag verlassen wird
  useEffect(
    () => () => {
      const d = dragRef.current;
      if (d) {
        if (d.raf !== null) cancelAnimationFrame(d.raf);
        d.cleanup();
        dragRef.current = null;
      }
    },
    [],
  );

  // Entwurf als persönliche Kopie sichern und direkt hinein — dort greift
  // der Auto-Save. `savingDraft` bleibt bei Erfolg stehen (Navigation läuft).
  async function saveDraftAsOwn() {
    if (!user || !draft || savingDraft) return;
    setSavingDraft(true);
    setDraftError(null);
    try {
      const id = await upsertPersonalWorkoutPlan(
        user.uid,
        { ...draft, id: "" },
        { sourcePlanId: plan.id },
      );
      router.push(`/workout/eigene/${id}`);
    } catch (err) {
      setSavingDraft(false);
      setDraftError(
        err instanceof Error ? err.message : "Speichern fehlgeschlagen",
      );
    }
  }

  const totalExercises = planExerciseCount(shown);
  const totalMinutes = Math.round(planDurationSeconds(shown) / 60);
  const disciplineInfo = getWorkoutDiscipline(shown.discipline);
  const canCreate = shown.name.trim().length > 0 && totalExercises > 0;

  // Gleiches Payload-Muster wie der Generator — der geführte Runner
  // (/workout/session) läuft bis zu seiner Umstellung (Schritt 4) über die
  // WorkoutDefinition-Brücke. Entwurfs-Änderungen fließen hier mit ein.
  const sessionHref = useMemo(() => {
    const p = new URLSearchParams();
    p.set(
      "payload",
      sessionPayload ??
        encodeURIComponent(JSON.stringify(planToWorkoutDefinition(shown))),
    );
    return `/workout/session?${p.toString()}`;
  }, [shown, sessionPayload]);

  return (
    <main
      className={isTrainer ? "min-h-screen pb-12" : "min-h-screen pb-32"}
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      {/* Kopfbereich mit Ambient-Schicht */}
      <section className="relative">
        {/* Maske statt harter Kante: Schein + Ambient laufen zur Unterkante
            des Kopfbereichs weich aus (Leon-Feedback 2026-08-27) */}
        <div
          className="absolute inset-0 overflow-hidden"
          aria-hidden
          style={{
            maskImage:
              "linear-gradient(to bottom, black 55%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black 55%, transparent 100%)",
          }}
        >
          <div data-ambient style={{ background: "var(--ambient)" }} />
          {/* Rubrik-Farbe als Schein von links — gleiche Sprache wie die
              Plan-Karten im Hub (kein Farbpunkt) */}
          <div data-ambient>
            <span
              data-glow
              style={{
                left: "-12%",
                top: "-30%",
                width: "55%",
                height: "160%",
                background: `color-mix(in oklab, ${DISCIPLINE_COLOR[shown.discipline]} var(--cat-glow-mix), transparent)`,
              }}
            />
          </div>
        </div>
        <div className="relative mx-auto flex w-full max-w-2xl items-start gap-3 px-4 pb-5 pt-4 lg:max-w-5xl lg:px-6 lg:pb-7 lg:pt-6">
          <div className="flex flex-1 flex-col gap-1">
            {/* Zurück-Weg: eine Ebene hoch zur Disziplin-Seite (Ebene 2);
                unbekannte Disziplin (eigene/künftige Gym-Pläne) fällt auf
                den Hub */}
            <Link
              href={
                backHref ??
                (disciplineInfo
                  ? `/workout/disziplin/${shown.discipline}`
                  : "/workout/generator")
              }
              className="t-interactive -ml-2 mb-1 inline-flex min-h-hit items-center gap-1.5 self-start rounded-field px-2"
              style={{ ...BTN_FONT, color: "var(--text-3)", textDecoration: "none" }}
            >
              <Icon name="arrow-left" size={14} strokeWidth={2.2} />
              {backLabel ?? disciplineInfo?.name ?? "Workout"}
            </Link>
            <h1
              style={{
                font: "var(--type-display)",
                letterSpacing: "var(--ls-display)",
                textTransform: "uppercase",
              }}
            >
              {shown.name || (edit ? "Neues Workout" : "Workout")}
            </h1>
            {shown.description && (
              <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                {shown.description}
              </p>
            )}
          </div>
          {!isTrainer && (
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? "Helles Design aktivieren"
                  : "Dunkles Design aktivieren"
              }
              className="t-glass t-interactive inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-field lg:hidden"
              style={{ color: "var(--text-2)" }}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} size={20} />
            </button>
          )}
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pt-4 lg:max-w-5xl lg:px-6 lg:pt-5">
        {/* Editier-Kopf: Name (+ ggf. Disziplin/Level) + Speicher-Status */}
        {edit && (
          <section className="flex flex-col gap-3">
            <label className="flex flex-col gap-2">
              <span className="t-label">Name</span>
              <input
                type="text"
                maxLength={60}
                value={shown.name}
                onChange={(e) => edit.onNameChange(e.target.value)}
                placeholder="z. B. Mein Boxprogramm"
                className="t-interactive w-full min-h-hit rounded-field px-3.5"
                style={{
                  font: "var(--type-body)",
                  background: "var(--surface-raised)",
                  border: "1px solid var(--line)",
                  color: "var(--text-body)",
                  outline: "none",
                }}
              />
            </label>
            {edit.error && (
              <div
                className="rounded-field px-3.5 py-2.5"
                style={{
                  font: "var(--type-sub)",
                  background:
                    "color-mix(in oklab, var(--negative) 12%, transparent)",
                  border:
                    "1px solid color-mix(in oklab, var(--negative) 40%, transparent)",
                  color: "var(--negative)",
                }}
              >
                {edit.error}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                {edit.autoSave
                  ? "Änderungen werden automatisch gespeichert."
                  : edit.create
                    ? `„Plan speichern" legt den Plan unter „Eigene Workoutpläne" an.`
                    : `Änderungen werden nicht automatisch gespeichert — „Als eigenen Plan speichern" behält sie.`}
              </span>
              {edit.autoSave?.saving ? (
                <span
                  className="inline-flex items-center gap-1.5"
                  style={{ ...STATUS_FONT, color: "var(--text-3)" }}
                >
                  <Icon name="refresh" size={14} strokeWidth={2.2} />
                  Speichere…
                </span>
              ) : edit.autoSave?.saved ? (
                <span
                  className="inline-flex items-center gap-1.5"
                  style={{ ...STATUS_FONT, color: "var(--positive)" }}
                >
                  <Icon name="check" size={14} strokeWidth={2.6} />
                  Gespeichert
                </span>
              ) : null}
            </div>
          </section>
        )}

        {/* Eckdaten + Aktionen */}
        <section className="flex flex-col gap-5">
          <div className="t-card grid grid-cols-3 gap-4 p-4 sm:p-5">
            <Stat label="Dauer" value={String(totalMinutes)} prefix="≈" unit="min" />
            <Stat label="Übungen" value={String(totalExercises)} />
            <Stat label="Blöcke" value={String(shown.blocks.length)} />
          </div>
          <div className="flex flex-wrap gap-2">
            {edit?.create ? (
              <button
                type="button"
                onClick={edit.create.onSave}
                disabled={!canCreate || edit.create.saving}
                className="t-interactive inline-flex min-h-hit items-center justify-center gap-2 rounded-field px-5 disabled:opacity-50"
                style={{
                  ...BTN_FONT,
                  background: "var(--accent)",
                  color: "var(--on-accent)",
                  boxShadow: "var(--accent-glow)",
                }}
              >
                <Icon name="check" size={13} strokeWidth={2.4} />
                {edit.create.saving ? "Speichere…" : "Plan speichern"}
              </button>
            ) : (
              <>
                {totalExercises > 0 ? (
                  <Link
                    href={sessionHref}
                    className="t-interactive inline-flex min-h-hit items-center justify-center gap-2 rounded-field px-5"
                    style={{
                      ...BTN_FONT,
                      background: "var(--accent)",
                      color: "var(--on-accent)",
                      boxShadow: "var(--accent-glow)",
                      textDecoration: "none",
                    }}
                  >
                    <Icon name="play" size={13} strokeWidth={2.2} />
                    Workout starten
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex min-h-hit items-center justify-center gap-2 rounded-field px-5 opacity-50"
                    style={{
                      ...BTN_FONT,
                      background: "var(--accent)",
                      color: "var(--on-accent)",
                    }}
                  >
                    <Icon name="play" size={13} strokeWidth={2.2} />
                    Workout starten
                  </button>
                )}
                {/* Erst bei einer Änderung: Entwurf sichern oder auf das
                    Original zurücksetzen (Editor bleibt aktiv) */}
                {draft && !editing && draftDirty && (
                  <>
                    <button
                      type="button"
                      onClick={() => void saveDraftAsOwn()}
                      disabled={savingDraft}
                      className="t-interactive inline-flex min-h-hit items-center justify-center gap-2 rounded-field px-5"
                      style={{
                        ...BTN_FONT,
                        background: "var(--accent-subtle)",
                        border: "1px solid var(--accent)",
                        color: "var(--accent-text)",
                        opacity: savingDraft ? 0.6 : undefined,
                      }}
                    >
                      <Icon name="copy" size={13} strokeWidth={2.2} />
                      {savingDraft ? "Speichere…" : "Als eigenen Plan speichern"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        startDraft();
                        setDraftError(null);
                        setPickerBlock(null);
                        setSelectedRow(null);
                      }}
                      className="t-interactive inline-flex min-h-hit items-center justify-center rounded-field px-5"
                      style={{
                        ...BTN_FONT,
                        background: "var(--surface-raised)",
                        border: "1px solid var(--line)",
                        color: "var(--text-2)",
                      }}
                    >
                      Verwerfen
                    </button>
                  </>
                )}
              </>
            )}
          </div>
          {edit?.create && !canCreate && (
            <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              Gib dem Plan einen Namen und füge mindestens eine Übung hinzu.
            </p>
          )}
          {draftError && (
            <p style={{ font: "var(--type-sub)", color: "var(--negative)" }}>
              {draftError}
            </p>
          )}
        </section>

        {/* Blöcke — pro Block EINE Karte mit Haarlinien-Trennern */}
        <div className="flex flex-col gap-8">
          {shown.blocks.map((block, idx) => {
            // Über die IDs iterieren (nicht die aufgelösten Übungen), damit
            // der Entfernen-Index auch bei unbekannten IDs stimmt
            const rows = block.exerciseIds
              .map((id, i) => ({ exercise: getExerciseById(id), i }))
              .filter((r): r is { exercise: Exercise; i: number } =>
                Boolean(r.exercise),
              );
            // Drag-Ziel-Linie: Ordinalzahlen zählen OHNE die gezogene Zeile
            // (Ziel-Koordinaten gelten nach Entfernen an der Quelle); zeigt
            // das Ziel dem Ausgangsplatz gleich, bleibt die Linie aus.
            const draggedInBlock =
              selectedRow && selectedRow.block === idx
                ? selectedRow.index
                : null;
            const lineTarget =
              dropTarget &&
              dropTarget.block === idx &&
              !(
                selectedRow &&
                dropTarget.block === selectedRow.block &&
                dropTarget.index === selectedRow.index
              )
                ? dropTarget.index
                : null;
            const endOrdinal = rows.length - (draggedInBlock !== null ? 1 : 0);
            return (
              <section key={`${block.phase}-${idx}`} className="flex flex-col gap-3">
                {/* Editier-Modus: Stepper statt Text — Controls dürfen auf
                    schmalen Screens in die zweite Zeile umbrechen */}
                <div
                  className={
                    edit
                      ? "flex flex-wrap items-center gap-x-3 gap-y-2"
                      : "flex items-baseline gap-3"
                  }
                >
                  <span
                    className="tabular-nums"
                    style={{ font: "var(--type-num-xl)", color: "var(--accent-text)" }}
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <h2
                    style={{
                      font: "var(--type-h2)",
                      letterSpacing: "var(--ls-display)",
                      textTransform: "uppercase",
                    }}
                  >
                    {block.title}
                  </h2>
                  {/* Blockpause — im Editier-Modus als Stepper */}
                  {edit ? (
                    <div className="ml-auto flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label={`Pause in „${block.title}" verkürzen`}
                        disabled={block.restSeconds <= 0}
                        onClick={() =>
                          edit.onRestChange(
                            idx,
                            Math.max(0, block.restSeconds - REST_STEP),
                          )
                        }
                        className="t-interactive flex h-11 w-11 items-center justify-center rounded-field disabled:opacity-40"
                        style={{
                          background: "var(--surface-raised)",
                          border: "1px solid var(--line)",
                          color: "var(--text-2)",
                        }}
                      >
                        <Icon name="minus" size={14} strokeWidth={2.2} />
                      </button>
                      <span
                        className="tabular-nums text-center"
                        style={{
                          ...META_FONT,
                          color: "var(--text-2)",
                          minWidth: "4.5rem",
                        }}
                      >
                        Pause {formatDuration(block.restSeconds)}
                      </span>
                      <button
                        type="button"
                        aria-label={`Pause in „${block.title}" verlängern`}
                        disabled={block.restSeconds >= REST_MAX}
                        onClick={() =>
                          edit.onRestChange(
                            idx,
                            Math.min(REST_MAX, block.restSeconds + REST_STEP),
                          )
                        }
                        className="t-interactive flex h-11 w-11 items-center justify-center rounded-field disabled:opacity-40"
                        style={{
                          background: "var(--surface-raised)",
                          border: "1px solid var(--line)",
                          color: "var(--text-2)",
                        }}
                      >
                        <Icon name="plus" size={14} strokeWidth={2.2} />
                      </button>
                    </div>
                  ) : (
                    <span
                      className="ml-auto"
                      style={{ ...META_FONT, color: "var(--text-3)" }}
                    >
                      Pause {formatDuration(block.restSeconds)}
                    </span>
                  )}
                </div>
                <div data-plan-block={idx} className="t-card px-3.5 py-0.5">
                  {rows.length === 0 && edit && (
                    <p
                      className="py-3"
                      style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                    >
                      Noch keine Übungen in diesem Block.
                    </p>
                  )}
                  {rows.map(({ exercise: ex, i }, pos) => {
                    const isSelected =
                      selectedRow?.block === idx && selectedRow?.index === i;
                    const isRemoving =
                      removingRow?.block === idx && removingRow?.index === i;
                    const flashTick =
                      rowFlash && rowFlash.key === `${idx}:${i}`
                        ? rowFlash.tick
                        : null;
                    const ordinal =
                      draggedInBlock !== null && i > draggedInBlock ? i - 1 : i;
                    const showSlotBefore =
                      lineTarget !== null &&
                      i !== draggedInBlock &&
                      ordinal === lineTarget;
                    const row = (
                      <div
                        key={flashTick ?? undefined}
                        data-plan-row={`${idx}:${i}`}
                        // Tipp/Klick = Übungs-Detail; SwipeAction unterdrückt
                        // Klicks nach Wisch/Halten, daher kein Gesten-Konflikt
                        onClick={() => {
                          if (isSelected || isRemoving) return;
                          setDetailExercise(ex);
                        }}
                        className={`t-interactive relative flex min-h-hit cursor-pointer flex-col gap-1.5 py-2.5 sm:flex-row sm:items-center sm:gap-4${
                          isRemoving ? " animate-remove-row" : ""
                        }${flashTick !== null ? " animate-add-glow" : ""}${
                          isSelected ? " rounded-field px-2" : ""
                        }`}
                        style={
                          isSelected
                            ? {
                                // Angehoben: folgt beim Ziehen dem Zeiger —
                                // KEIN transition/transform hier, die
                                // Mitzieh-Transform läuft imperativ pro Frame
                                background: "var(--surface-raised)",
                                border: "1px solid var(--accent)",
                                boxShadow: "var(--accent-glow)",
                              }
                            : undefined
                        }
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span style={{ font: "var(--type-body-strong)" }}>
                            {ex.name}
                          </span>
                          {ex.focus.length > 0 && (
                            <span
                              style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                            >
                              {ex.focus.join(" · ")}
                            </span>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 self-start sm:self-center">
                          <span
                            className="rounded-badge px-2 py-1"
                            style={{
                              ...META_FONT,
                              background: "var(--surface-raised)",
                              border: "1px solid var(--line)",
                              color: "var(--accent-text)",
                            }}
                          >
                            {ex.defaultRounds} × {formatDuration(ex.durationSeconds)}
                          </span>
                          {edit && (
                            // Desktop-Weg; auf Touch übernimmt die Wisch-Geste
                            <button
                              type="button"
                              aria-label={`${ex.name} entfernen`}
                              onClick={(e) => {
                                // nicht zusätzlich das Detail-Sheet öffnen
                                e.stopPropagation();
                                handleRemoveRow(idx, i);
                              }}
                              className="t-interactive hidden h-9 w-9 items-center justify-center rounded-field sm:flex"
                              style={{ color: "var(--gesture-delete)" }}
                            >
                              <Icon name="x" size={15} strokeWidth={2.2} />
                            </button>
                          )}
                        </div>
                        {/* „+1" — Dupliziere-Feedback, groß und leuchtend */}
                        {flashTick !== null && (
                          <span
                            aria-hidden
                            className="animate-plus-one pointer-events-none absolute right-12 top-0 z-10"
                            style={{
                              font: "800 28px/1 var(--font-archivo), system-ui, sans-serif",
                              color: "var(--gesture-add)",
                            }}
                          >
                            +1
                          </span>
                        )}
                      </div>
                    );
                    return (
                      <Fragment key={`${ex.id}-${i}`}>
                        {pos > 0 && <Hairline />}
                        {showSlotBefore && <DropSlot />}
                        {edit ? (
                          // Links wischen = löschen (rot/x), rechts wischen =
                          // duplizieren (grün/Kopie), kurz halten = auswählen
                          <SwipeAction
                            left={{
                              color: "var(--gesture-delete)",
                              icon: "x",
                              onTrigger: () => handleRemoveRow(idx, i),
                            }}
                            right={{
                              color: "var(--gesture-add)",
                              icon: "copy",
                              onTrigger: () => handleDuplicateRow(idx, i),
                            }}
                            onHold={(start) => startDrag(idx, i, start.y)}
                            disabled={isSelected || isRemoving}
                          >
                            {row}
                          </SwipeAction>
                        ) : (
                          row
                        )}
                      </Fragment>
                    );
                  })}
                  {/* „+ Übung hinzufügen" unter jeder Rubrik (Spec-Punkt 4) */}
                  {edit && (
                    <>
                      {rows.length > 0 && <Hairline />}
                      {/* Ziel-Slot am Blockende (auch leerer Block) */}
                      {lineTarget !== null && lineTarget === endOrdinal && (
                        <DropSlot />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRow(null);
                          setPickerBlock(idx);
                        }}
                        className="t-interactive flex min-h-hit w-full items-center gap-2 rounded-field px-1 py-2.5 text-left"
                        style={{ color: "var(--accent-text)" }}
                      >
                        <Icon name="plus" size={15} strokeWidth={2.2} />
                        <span style={{ font: "var(--type-body-strong)" }}>
                          Übung hinzufügen
                        </span>
                      </button>
                    </>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        {/* Kopie löschen — Inline-Bestätigung statt Popup (App-Regel);
            die Undo-Leiste kommt mit den Listen-Gesten in Teilschritt 4 */}
        {edit?.onDelete && (
          <section className="flex flex-wrap items-center gap-2 pt-2">
            {confirmDelete ? (
              <>
                <button
                  type="button"
                  onClick={edit.onDelete}
                  className="t-interactive inline-flex min-h-hit items-center justify-center gap-2 rounded-field px-5"
                  style={{
                    ...BTN_FONT,
                    background: "var(--negative)",
                    color: "var(--on-accent)",
                  }}
                >
                  <Icon name="trash" size={13} strokeWidth={2.2} />
                  Wirklich löschen
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="t-interactive inline-flex min-h-hit items-center justify-center rounded-field px-5"
                  style={{
                    ...BTN_FONT,
                    background: "var(--surface-raised)",
                    border: "1px solid var(--line)",
                    color: "var(--text-2)",
                  }}
                >
                  Abbrechen
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="t-interactive -ml-2 inline-flex min-h-hit items-center gap-2 rounded-field px-2"
                style={{ ...BTN_FONT, color: "var(--negative)" }}
              >
                <Icon name="trash" size={13} strokeWidth={2.2} />
                Kopie löschen
              </button>
            )}
          </section>
        )}
      </div>

      {/* Übungs-Picker — gesamte Bibliothek, Ziel ist der gewählte Block */}
      {edit && pickerBlock !== null && shown.blocks[pickerBlock] && (
        <ExercisePicker
          open
          blockTitle={shown.blocks[pickerBlock].title}
          blockCount={shown.blocks[pickerBlock].exerciseIds.length}
          onPick={(exerciseId) => edit.onAddExercise(pickerBlock, exerciseId)}
          onClose={() => setPickerBlock(null)}
        />
      )}

      {/* Übungs-Detail — Tipp/Klick auf eine Übungszeile */}
      {detailExercise && (
        <ExerciseDetailSheet
          exercise={detailExercise}
          onClose={() => setDetailExercise(null)}
        />
      )}

      {!isTrainer && <AthleteTabBar />}
    </main>
  );
}
