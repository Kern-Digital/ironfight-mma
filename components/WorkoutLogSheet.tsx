"use client";

/**
 * Letzte Workouts (Leons Vorgaben 2026-08-28) — zwei Bausteine, geteilt
 * zwischen Hub-Stapel, Verlaufsseite und Fertig-Screen-Umfeld:
 *
 *  • WorkoutLogTile: Kachel in voller Breite — über dem Workout-Namen
 *    stehen Datum + Uhrzeit des STARTS (ältere Logs ohne startedAt fallen
 *    auf completedAt zurück), rechts das Herz. Keine Detail-Zeile mehr;
 *    abgebrochene Workouts werden mitgezeigt und nur markiert.
 *  • WorkoutLogSheet (Default): Detail-Popup zu einem Log-Eintrag — Name,
 *    Start, Status und die Blockstruktur (über workoutSessionToPlan, damit
 *    auch Alt-Logs mit definition/flacher Liste sauber rendern); Herz oben
 *    rechts. Mobil Bottom-Sheet, am Desktop zentriertes Fenster (gleiches
 *    Muster wie ExerciseDetailSheet).
 */

import Icon from "@/components/ui/Icon";
import { getExerciseById } from "@/lib/exercises";
import { workoutSessionToPlan } from "@/lib/workout-plans";
import type { WorkoutSession } from "@/lib/workouts";

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

/** „Heute · 17:32" / „Gestern · 09:10" / „28.08. · 17:32" — Startzeitpunkt */
export function startTimeLabel(session: WorkoutSession): string {
  const d = session.startedAt ?? session.completedAt;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - day.getTime()) / 86400000);
  const time = d.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const date =
    diffDays <= 0
      ? "Heute"
      : diffDays === 1
        ? "Gestern"
        : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  return `${date} · ${time} Uhr`;
}

export function WorkoutLogTile({
  session,
  heartColor,
  heartBusy,
  onToggleFavorite,
  onOpen,
  className,
  style,
}: {
  session: WorkoutSession;
  heartColor: string;
  heartBusy: boolean;
  onToggleFavorite: () => void;
  onOpen: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const saved = Boolean(session.savedPlanId);
  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={`Details zu „${session.label ?? "Workout"}" öffnen`}
      className={`t-card t-interactive relative w-full cursor-pointer p-4 pr-14 text-left${className ? ` ${className}` : ""}`}
      style={style}
    >
      <button
        type="button"
        aria-pressed={saved}
        aria-label={
          saved
            ? `„${session.label ?? "Workout"}" aus den Favoriten entfernen`
            : `„${session.label ?? "Workout"}" als Favorit speichern`
        }
        onClick={(e) => {
          // nicht zusätzlich das Detail-Popup öffnen
          e.stopPropagation();
          onToggleFavorite();
        }}
        disabled={heartBusy}
        className="t-interactive absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-field"
        style={{
          color: saved ? heartColor : "var(--text-3)",
          opacity: heartBusy ? 0.5 : undefined,
        }}
      >
        <Icon
          name="heart"
          size={20}
          strokeWidth={2}
          style={saved ? { fill: "currentColor" } : undefined}
        />
      </button>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span style={{ ...META_FONT, color: "var(--text-3)" }}>
          {startTimeLabel(session)}
          {session.status === "aborted" && (
            <span style={{ color: "var(--negative)" }}> · abgebrochen</span>
          )}
        </span>
        <span className="truncate" style={{ font: "var(--type-body-strong)" }}>
          {session.label ?? "Workout"}
        </span>
      </div>
    </div>
  );
}

export default function WorkoutLogSheet({
  session,
  heartColor,
  heartBusy,
  onToggleFavorite,
  onClose,
  zIndex = 50,
}: {
  session: WorkoutSession;
  heartColor: string;
  heartBusy: boolean;
  onToggleFavorite: () => void;
  onClose: () => void;
  zIndex?: number;
}) {
  const saved = Boolean(session.savedPlanId);
  // Blockstruktur fürs Rendern — Alt-Logs (definition/flache Liste) werden
  // vom selben Konverter in die Plan-Form gehoben wie fürs Herz
  const plan = workoutSessionToPlan(session);

  return (
    <div
      className="fixed inset-0 flex flex-col justify-end sm:items-center sm:justify-center sm:p-6"
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      aria-label={`Details zu „${session.label ?? "Workout"}"`}
    >
      <button
        type="button"
        aria-label="Workout-Details schließen"
        className="absolute inset-0"
        style={{
          background: "var(--overlay)",
          animation: "fade-in 0.2s ease-out both",
        }}
        onClick={onClose}
      />
      <div className="pointer-events-none relative flex w-full justify-center">
        <div
          className="pointer-events-auto animate-slide-up relative flex w-full max-h-[75vh] flex-col overflow-hidden rounded-t-[var(--r-xl)] sm:max-w-xl sm:rounded-[var(--r-xl)]"
          style={{
            maxHeight: "75dvh",
            background: "var(--surface-card)",
            boxShadow: "var(--glass-shadow)",
          }}
        >
          <div className="flex items-center justify-between gap-3 px-5 pt-3">
            <div className="flex flex-col items-start">
              <div
                aria-hidden
                className="mb-2 h-1 w-10 rounded-full sm:invisible"
                style={{ background: "var(--line-strong)" }}
              />
              <span className="t-label">Workout</span>
            </div>
            <div className="flex items-center gap-1">
              {/* Herz oben rechts — gleicher Favoriten-Mechanismus wie überall */}
              <button
                type="button"
                aria-pressed={saved}
                aria-label={
                  saved
                    ? "Workout aus den Favoriten entfernen"
                    : "Workout als eigenen Plan speichern"
                }
                onClick={onToggleFavorite}
                disabled={heartBusy}
                className="t-interactive inline-flex h-11 w-11 items-center justify-center rounded-field"
                style={{
                  color: saved ? heartColor : "var(--text-3)",
                  opacity: heartBusy ? 0.5 : undefined,
                }}
              >
                <Icon
                  name="heart"
                  size={22}
                  strokeWidth={2}
                  style={saved ? { fill: "currentColor" } : undefined}
                />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Schließen"
                className="t-interactive inline-flex h-10 w-10 items-center justify-center rounded-field"
                style={{ color: "var(--text-3)" }}
              >
                <Icon name="x" size={16} strokeWidth={2.2} />
              </button>
            </div>
          </div>
          <div
            className="overflow-y-auto px-5 pt-2"
            style={{
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
            }}
          >
            <h2
              style={{
                font: "var(--type-h2)",
                letterSpacing: "var(--ls-display)",
                textTransform: "uppercase",
              }}
            >
              {session.label ?? "Workout"}
            </h2>
            <p className="mt-1" style={{ ...META_FONT, color: "var(--text-3)" }}>
              {startTimeLabel(session)}
              {" · "}
              {session.status === "aborted" ? (
                <span style={{ color: "var(--negative)" }}>abgebrochen</span>
              ) : (
                <span style={{ color: "var(--positive)" }}>abgeschlossen</span>
              )}
            </p>

            <div className="mt-4 flex flex-col gap-4">
              {plan.blocks.map((block, bi) => (
                <div key={`${block.title}-${bi}`} className="flex flex-col gap-1">
                  {/* Keine Pausen-Angabe: die Rundenpause ist pro Übung */}
                  <span className="t-label" style={{ color: "var(--accent-text)" }}>
                    {block.title}
                  </span>
                  <div
                    className="rounded-field px-3.5 py-1"
                    style={{
                      background: "var(--surface-raised)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    {block.exerciseIds.map((id, i) => {
                      const ex = getExerciseById(id);
                      if (!ex) return null;
                      return (
                        <div
                          key={`${id}-${i}`}
                          className="flex items-center justify-between gap-3 py-2"
                          style={
                            i > 0
                              ? { borderTop: "1px solid var(--line)" }
                              : undefined
                          }
                        >
                          <span
                            className="min-w-0 flex-1 truncate"
                            style={{ font: "var(--type-body)" }}
                          >
                            {ex.name}
                          </span>
                          <span
                            className="shrink-0"
                            style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                          >
                            {ex.defaultRounds}× {ex.durationSeconds}s
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
