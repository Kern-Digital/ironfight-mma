"use client";

/**
 * Übungs-Picker — hochschiebbares Sheet über der GESAMTEN Übungsbibliothek
 * (Etappe Workout-Pläne, Spec-Punkt 4; erster Einsatz im Plan-Editor).
 * Filter Disziplin + Equipment als ui/Select; hinzugefügt wird auf Touch
 * per Rechts-Wisch oder +-Knopf, am Desktop zusätzlich per Klick auf die
 * Zeile. ÜBUNGS-DETAILS (Leons Wahl 2026-08-28): auf Touch öffnet der
 * Zeilen-Tipp das Detail-Sheet (die Geste war frei), am Desktop das
 * Info-Icon neben dem + (der Zeilen-Klick fügt dort ja hinzu); im
 * Detail-Sheet gibt es unten einen Hinzufügen-Knopf. Das Sheet bleibt für
 * weitere Übungen offen (beim Zusammenstellen kommen selten einzelne
 * Übungen). Optik = Übungslisten-Sheet des Runners (Overlay, slide-up,
 * Grabber, x schließt).
 */

import ExerciseDetailSheet from "@/components/ExerciseDetailSheet";
import Icon from "@/components/ui/Icon";
import Select from "@/components/ui/Select";
import SwipeAction from "@/components/SwipeAction";
import { EXERCISES } from "@/lib/exercises";
import { ALL_EQUIPMENT, EQUIPMENT } from "@/lib/equipment";
import { CATEGORY_LABEL } from "@/lib/techniques";
import type { Category, EquipmentId, Exercise, ExerciseKind } from "@/lib/types";
import { useEffect, useRef, useState } from "react";

const META_FONT: React.CSSProperties = {
  font: "600 10px/1.2 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

const KIND_LABEL: Record<ExerciseKind, string> = {
  warmup: "Aufwärmen",
  technique: "Technik",
  conditioning: "Konditionierung",
  cooldown: "Cooldown",
};
const KIND_ORDER: ExerciseKind[] = [
  "warmup",
  "technique",
  "conditioning",
  "cooldown",
];

const CATEGORIES: Category[] = ["boxing", "wrestling", "bjj", "muay-thai"];

/**
 * Web/Maus-Klick vs. Touch-Tipp (Leon 2026-08-28): am Desktop fügt der
 * Klick auf die Zeile hinzu, auf Touch NICHT (dort Wisch oder +-Knopf).
 * Moderne Browser liefern den pointerType am click-Event; Fallback ist
 * die Eingabeart des Geräts.
 */
function isMouseLikeClick(e: React.MouseEvent): boolean {
  const pt = (e.nativeEvent as Partial<PointerEvent>).pointerType;
  if (pt) return pt === "mouse" || pt === "pen";
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

export default function ExercisePicker({
  open,
  blockTitle,
  blockCount,
  onPick,
  onClose,
}: {
  open: boolean;
  /** Ziel-Block (Anzeige im Kopf, damit klar ist, wohin die Übung geht) */
  blockTitle: string;
  /** Aktuelle Übungszahl des Blocks — Live-Feedback beim Hinzufügen */
  blockCount: number;
  onPick: (exerciseId: string) => void;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<Category | "all">("all");
  const [gear, setGear] = useState<EquipmentId | "all" | "none">("all");

  // Übungs-Detail-Sheet (liegt ÜBER dem Picker → zIndex 60)
  const [detail, setDetail] = useState<Exercise | null>(null);

  // Hinzufüge-Feedback (Leons Vorgabe 2026-08-28): Zeile leuchtet grün am
  // Rahmen + „+1" steigt auf; tick startet die Animation bei schnellen
  // Mehrfach-Hinzufügungen jedes Mal neu (keyed remount).
  const [flash, setFlash] = useState<{ id: string; tick: number } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  function handleAdd(exerciseId: string) {
    onPick(exerciseId);
    setFlash((f) => ({ id: exerciseId, tick: (f?.tick ?? 0) + 1 }));
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 800);
  }

  if (!open) return null;

  const matches = (ex: Exercise) => {
    if (category !== "all" && ex.category !== category && ex.category !== "any")
      return false;
    if (gear === "none" && ex.equipment.length > 0) return false;
    if (gear !== "all" && gear !== "none" && !ex.equipment.includes(gear))
      return false;
    return true;
  };
  const filtered = EXERCISES.filter(matches);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`Übung zu „${blockTitle}" hinzufügen`}
    >
      <button
        type="button"
        aria-label="Übungs-Picker schließen"
        className="absolute inset-0"
        style={{
          background: "var(--overlay)",
          animation: "fade-in 0.2s ease-out both",
        }}
        onClick={onClose}
      />
      {/* Kartei-Look (Leons Vorgabe 2026-08-28): liegt das Übungs-Detail
          davor, rückt der Picker sichtbar nach hinten-oben. Transform auf
          eigener Hülle — die Einblende-Animation des Panels (fill both)
          würde eine Panel-Transform überschreiben. */}
      <div
        className="relative flex w-full justify-center"
        style={{
          transform: detail ? "translateY(-44px) scaleX(0.9)" : undefined,
          transformOrigin: "50% 100%",
          transition: "transform .35s cubic-bezier(.22,.8,.3,1)",
        }}
      >
      <div
        className="animate-slide-up relative flex w-full max-h-[80vh] flex-col overflow-hidden"
        style={{
          maxHeight: "80dvh",
          // Hinten angestellt: volle Höhe erzwingen, damit die Oberkante
          // sicher über dem Detail-Sheet hervorschaut ("0px" statt auto —
          // auto→Länge springt statt zu animieren); heller, damit die
          // Karte trotz des Overlays klar sichtbar bleibt
          minHeight: detail ? "80dvh" : "0px",
          transition:
            "min-height .35s cubic-bezier(.22,.8,.3,1), background .35s ease, border-color .35s ease, box-shadow .35s ease",
          // Akzent-Tönung + leuchtende Kante — nur heller ging unterm
          // Overlay des vorderen Fensters unter (Leons Feedback)
          background: detail
            ? "color-mix(in oklab, var(--accent) 18%, color-mix(in oklab, white 10%, var(--surface-card)))"
            : "var(--surface-card)",
          border: "1px solid",
          borderColor: detail
            ? "color-mix(in oklab, var(--accent) 55%, transparent)"
            : "transparent",
          borderRadius: "var(--r-xl) var(--r-xl) 0 0",
          boxShadow: detail
            ? "var(--glass-shadow), var(--accent-glow)"
            : "var(--glass-shadow)",
        }}
      >
        {/* Kartei-Streifen: statt des Grabbers steht hier der Popup-Titel */}
        {detail && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-2.5"
            style={{ animation: "fade-in 0.3s ease-out both" }}
          >
            <span
              className="truncate px-6"
              style={{ ...META_FONT, color: "var(--accent-text)" }}
            >
              Übung hinzufügen
            </span>
          </div>
        )}
        <div
          className={`flex items-center justify-between gap-3 px-5 pt-3${detail ? " invisible" : ""}`}
        >
          <div className="flex min-w-0 flex-col items-start">
            <div
              aria-hidden
              className="mb-2 h-1 w-10 rounded-full"
              style={{ background: "var(--line-strong)" }}
            />
            <span className="t-label">Übung hinzufügen</span>
            <span style={{ ...META_FONT, color: "var(--text-3)" }}>
              {blockTitle} · {blockCount}{" "}
              {blockCount === 1 ? "Übung" : "Übungen"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fertig"
            className="t-interactive inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-field"
            style={{ color: "var(--text-3)" }}
          >
            <Icon name="x" size={16} strokeWidth={2.2} />
          </button>
        </div>

        {/* Filter — beide optional, „Alle" = kein Filter */}
        <div className="grid grid-cols-2 gap-2 px-4 pt-3">
          <Select
            value={category}
            onChange={(v) => setCategory(v as Category | "all")}
            options={[
              { value: "all", label: "Alle Disziplinen" },
              ...CATEGORIES.map((c) => ({
                value: c,
                label: CATEGORY_LABEL[c],
              })),
            ]}
          />
          <Select
            value={gear}
            onChange={(v) => setGear(v as EquipmentId | "all" | "none")}
            options={[
              { value: "all", label: "Alles Equipment" },
              { value: "none", label: "Keine Geräte" },
              ...ALL_EQUIPMENT.filter((eq) => eq.id !== "bodyweight").map(
                (eq) => ({ value: eq.id, label: eq.label }),
              ),
            ]}
          />
        </div>

        <div
          className="overflow-y-auto px-3 pt-2"
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
          }}
        >
          {filtered.length === 0 ? (
            <p
              className="px-2.5 py-8 text-center"
              style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
            >
              Keine Übung passt zu diesen Filtern.
            </p>
          ) : (
            KIND_ORDER.map((kind) => {
              const group = filtered.filter((ex) => ex.kind === kind);
              if (group.length === 0) return null;
              return (
                <div key={kind} className="mb-2">
                  <div
                    className="px-2.5 pb-1 pt-2"
                    style={{ ...META_FONT, color: "var(--text-3)" }}
                  >
                    {KIND_LABEL[kind]}
                  </div>
                  {group.map((ex) => {
                    const flashTick =
                      flash && flash.id === ex.id ? flash.tick : null;
                    return (
                      // Nach rechts wischen = hinzufügen (grüner Balken mit +);
                      // ein Tipp auf die ZEILE fügt nichts hinzu — nur der
                      // +-Knopf rechts (gezielter Desktop-/Fallback-Weg)
                      <SwipeAction
                        key={ex.id}
                        right={{
                          color: "var(--gesture-add)",
                          icon: "plus",
                          onTrigger: () => handleAdd(ex.id),
                        }}
                      >
                        <div
                          key={flashTick ?? undefined}
                          // Maus-Klick auf die Zeile fügt hinzu (Web-Ansicht);
                          // ein Touch-Tipp öffnet stattdessen die Details
                          onClick={(e) => {
                            if (isMouseLikeClick(e)) handleAdd(ex.id);
                            else setDetail(ex);
                          }}
                          className={`t-interactive relative flex min-h-hit w-full cursor-pointer items-center gap-3 rounded-field px-2.5 py-2${flashTick !== null ? " animate-add-glow" : ""}`}
                          style={{ color: "var(--text-body)" }}
                        >
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span
                              className="truncate"
                              style={{ font: "var(--type-body-strong)" }}
                            >
                              {ex.name}
                            </span>
                            <span
                              className="truncate"
                              style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                            >
                              {ex.equipment.length === 0
                                ? "Keine Geräte"
                                : ex.equipment
                                    .map((id) => EQUIPMENT[id]?.label)
                                    .filter(Boolean)
                                    .join(" · ")}
                            </span>
                          </div>
                          <span
                            className="shrink-0"
                            style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                          >
                            {ex.defaultRounds}× {ex.durationSeconds}s
                          </span>
                          {/* Desktop-Weg zu den Details (auf Touch: Zeilen-Tipp) */}
                          <button
                            type="button"
                            aria-label={`Details zu ${ex.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetail(ex);
                            }}
                            className="t-interactive hidden h-10 w-10 shrink-0 items-center justify-center rounded-field sm:flex"
                            style={{ color: "var(--text-3)" }}
                          >
                            <Icon name="info" size={16} strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            aria-label={`${ex.name} hinzufügen`}
                            onClick={(e) => {
                              // nicht zusätzlich den Zeilen-Klick auslösen
                              e.stopPropagation();
                              handleAdd(ex.id);
                            }}
                            className="t-interactive flex h-10 w-10 shrink-0 items-center justify-center rounded-field"
                            style={{ color: "var(--accent-text)" }}
                          >
                            <Icon name="plus" size={16} strokeWidth={2.2} />
                          </button>
                          {/* „+1" poppt groß auf und zieht nach oben weg */}
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
                      </SwipeAction>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
      </div>

      {/* Übungs-Detail über dem Picker — mit direktem Hinzufügen-Weg */}
      {detail && (
        <ExerciseDetailSheet
          exercise={detail}
          zIndex={60}
          onClose={() => setDetail(null)}
          action={{
            label: "Übung hinzufügen",
            icon: "plus",
            onClick: () => {
              handleAdd(detail.id);
              setDetail(null);
            },
          }}
        />
      )}
    </div>
  );
}
