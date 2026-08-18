"use client";

import { ALL_TECHNIQUES } from "@/lib/techniques";
import { EXERCISES } from "@/lib/exercises";
import {
  fightCampProgress,
  FIGHT_STYLE_LABEL,
  FIGHTER_STANCE_LABEL,
  PHASE_LABEL,
  type FightCamp,
  type FightCampPhase,
} from "@/lib/fight-camp";
import { TRAINING_AREA_LABEL } from "@/lib/types";

function formatDate(d: Date): string {
  return d.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const TECH_BY_ID = new Map(ALL_TECHNIQUES.map((t) => [t.id, t]));
const EX_BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

const PHASE_ACCENT: Record<FightCampPhase, string> = {
  foundation: "var(--ta-cyan)",
  "specific-prep": "var(--ta-pink)",
  "sparring-simulation": "#8A63E8",
  taper: "#9D7BFA",
};

const PHASE_ACCENT_BG: Record<FightCampPhase, string> = {
  foundation: "rgba(35,196,206,0.08)",
  "specific-prep": "rgba(255,79,168,0.08)",
  "sparring-simulation": "rgba(138,99,232,0.08)",
  taper: "rgba(157,123,250,0.08)",
};

const PHASE_ACCENT_BORDER: Record<FightCampPhase, string> = {
  foundation: "rgba(35,196,206,0.35)",
  "specific-prep": "rgba(255,79,168,0.35)",
  "sparring-simulation": "rgba(138,99,232,0.35)",
  taper: "rgba(157,123,250,0.35)",
};

export default function FightCampPlanView({
  camp,
  onDelete,
  showOpponent = true,
}: {
  camp: FightCamp;
  onDelete?: () => void;
  /** Gegner-Zusammenfassung anzeigen. Im Wettkampf-Detail aus, da dort die
   *  vollständige Gegner-DNA bereits separat dargestellt wird. */
  showOpponent?: boolean;
}) {
  const progress = fightCampProgress(camp);

  return (
    <div className="flex flex-col gap-4">
      {/* Camp-Header */}
      <div
        className="rounded-2xl p-5"
        style={{
          background:
            "radial-gradient(400px 200px at 100% 0%, rgba(255,79,168,0.15), transparent 60%), linear-gradient(160deg, var(--ink-3), var(--ink-2))",
          border: "1px solid rgba(255,79,168,0.35)",
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div
              className="font-mono-ta text-[10px] uppercase"
              style={{ letterSpacing: "0.2em", color: "var(--ta-pink)" }}
            >
              Wettkampf-Vorbereitung
            </div>
            <h2
              className="font-display-ta mt-1 font-black uppercase"
              style={{ fontSize: "22px", letterSpacing: "0.04em" }}
            >
              {camp.competitionName}
            </h2>
            <div
              className="font-mono-ta mt-1 text-[11px]"
              style={{ letterSpacing: "0.15em", color: "var(--fg-3)" }}
            >
              {formatDate(camp.competitionDate)} ·{" "}
              {progress.daysRemaining > 0
                ? `${progress.daysRemaining} Tage übrig`
                : "Kampftag erreicht"}{" "}
              · {camp.weeksTotal} Wochen Plan
            </div>
          </div>
          {onDelete && (
            <button
              onClick={onDelete}
              className="font-mono-ta rounded-lg px-3 py-1.5 text-[10px] uppercase transition-colors"
              style={{
                letterSpacing: "0.15em",
                background: "transparent",
                border: "1px solid var(--ink-5)",
                color: "var(--fg-4)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--ta-pink)";
                e.currentTarget.style.borderColor = "rgba(255,79,168,0.35)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--fg-4)";
                e.currentTarget.style.borderColor = "var(--ink-5)";
              }}
            >
              Camp löschen
            </button>
          )}
        </div>

        {/* Progress-Bar */}
        <div className="mt-4">
          <div
            className="overflow-hidden rounded-full"
            style={{
              height: "10px",
              background: "var(--ink-3)",
              border: "1px solid var(--ink-5)",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.round(progress.ratio * 100)}%`,
                background:
                  "linear-gradient(90deg, var(--ta-cyan), var(--ta-pink))",
                transition: "width 0.5s",
              }}
            />
          </div>
          <div
            className="font-mono-ta mt-1 flex justify-between text-[9px] uppercase"
            style={{ letterSpacing: "0.15em", color: "var(--fg-4)" }}
          >
            <span>Start: {formatDate(camp.startedAt)}</span>
            <span>{Math.round(progress.ratio * 100)}% absolviert</span>
            <span>Kampf: {formatDate(camp.competitionDate)}</span>
          </div>
        </div>

        {/* Opponent summary */}
        {showOpponent && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div
            className="rounded-xl p-3"
            style={{
              background: "var(--ink-3)",
              border: "1px solid var(--ink-4)",
            }}
          >
            <div
              className="font-mono-ta text-[9px] uppercase"
              style={{ letterSpacing: "0.2em", color: "var(--ta-pink)" }}
            >
              Gegner
            </div>
            <div
              className="font-display-ta mt-1 truncate font-bold uppercase"
              style={{ fontSize: "16px", letterSpacing: "0.04em" }}
            >
              {camp.opponent.name}
            </div>
            <div
              className="font-mono-ta mt-1 text-[10px]"
              style={{ color: "var(--fg-3)" }}
            >
              {FIGHT_STYLE_LABEL[camp.opponent.style]} ·{" "}
              {FIGHTER_STANCE_LABEL[camp.opponent.stance]}
            </div>
            <div
              className="font-mono-ta mt-1 text-[10px]"
              style={{ color: "var(--fg-4)" }}
            >
              {[
                camp.opponent.heightCm && `${camp.opponent.heightCm} cm`,
                camp.opponent.weightKg && `${camp.opponent.weightKg} kg`,
                camp.opponent.reachCm && `Reach ${camp.opponent.reachCm} cm`,
              ]
                .filter(Boolean)
                .join(" · ") || "Keine Maße erfasst"}
            </div>
          </div>

          <div
            className="rounded-xl p-3"
            style={{
              background: "var(--ink-3)",
              border: "1px solid var(--ink-4)",
            }}
          >
            <div
              className="font-mono-ta text-[9px] uppercase"
              style={{ letterSpacing: "0.2em", color: "var(--ta-cyan)" }}
            >
              Stärken / Schwächen / Lieblings-Angriffe
            </div>
            <div className="mt-1 flex flex-col gap-1 text-xs">
              {camp.opponent.strengths.length > 0 && (
                <div>
                  <span style={{ color: "var(--ta-cyan)" }}>+ </span>
                  <span style={{ color: "var(--fg-2)" }}>
                    {camp.opponent.strengths.join(", ")}
                  </span>
                </div>
              )}
              {camp.opponent.weaknesses.length > 0 && (
                <div>
                  <span style={{ color: "var(--ta-pink)" }}>− </span>
                  <span style={{ color: "var(--fg-2)" }}>
                    {camp.opponent.weaknesses.join(", ")}
                  </span>
                </div>
              )}
              {camp.opponent.favoriteAttacks.length > 0 && (
                <div>
                  <span style={{ color: "#8A63E8" }}>★ </span>
                  <span style={{ color: "var(--fg-2)" }}>
                    {camp.opponent.favoriteAttacks.join(", ")}
                  </span>
                </div>
              )}
              {camp.opponent.notes && (
                <div
                  className="mt-1 italic"
                  style={{ color: "var(--fg-4)", fontSize: "11px" }}
                >
                  &bdquo;{camp.opponent.notes}&ldquo;
                </div>
              )}
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Phasen */}
      {camp.phases.map((phase, idx) => {
        const accent = PHASE_ACCENT[phase.phase];
        const accentBg = PHASE_ACCENT_BG[phase.phase];
        const accentBorder = PHASE_ACCENT_BORDER[phase.phase];
        const isCurrent = progress.currentPhase === phase.phase;

        return (
          <div
            key={`${phase.phase}-${idx}`}
            className="rounded-2xl p-5"
            style={{
              background: isCurrent
                ? `linear-gradient(160deg, ${accentBg}, var(--ink-2))`
                : "var(--ink-2)",
              border: `1px solid ${isCurrent ? accentBorder : "var(--ink-4)"}`,
            }}
          >
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg font-display-ta text-sm font-black"
                  style={{
                    background: accentBg,
                    border: `1px solid ${accentBorder}`,
                    color: accent,
                  }}
                >
                  {idx + 1}
                </div>
                <div>
                  <h3
                    className="font-display-ta font-black uppercase"
                    style={{
                      fontSize: "16px",
                      letterSpacing: "0.06em",
                      color: isCurrent ? accent : "var(--fg-1)",
                    }}
                  >
                    {PHASE_LABEL[phase.phase]}
                  </h3>
                  <div
                    className="font-mono-ta text-[10px] uppercase"
                    style={{ letterSpacing: "0.15em", color: "var(--fg-3)" }}
                  >
                    Woche {idx === 0 ? 1 : "…"} · {phase.weeks}{" "}
                    {phase.weeks === 1 ? "Woche" : "Wochen"} ·{" "}
                    {formatDate(phase.startsAt)} → {formatDate(phase.endsAt)}
                  </div>
                </div>
              </div>
              {isCurrent && (
                <span
                  className="font-mono-ta rounded-md px-2 py-1 text-[10px] font-black uppercase"
                  style={{
                    letterSpacing: "0.2em",
                    background: accentBg,
                    border: `1px solid ${accentBorder}`,
                    color: accent,
                  }}
                >
                  Aktuelle Phase
                </span>
              )}
            </div>

            {/* Focus */}
            <p
              className="mt-3 text-xs leading-relaxed"
              style={{ color: "var(--fg-2)" }}
            >
              {phase.focus}
            </p>

            {/* Stats */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div
                className="rounded-lg px-2 py-1.5 text-center"
                style={{
                  background: "var(--ink-3)",
                  border: "1px solid var(--ink-4)",
                }}
              >
                <div
                  className="font-display-ta text-sm font-black"
                  style={{ color: accent }}
                >
                  {phase.sessionsPerWeek}×
                </div>
                <div
                  className="font-mono-ta text-[9px] uppercase"
                  style={{ letterSpacing: "0.15em", color: "var(--fg-4)" }}
                >
                  /Woche
                </div>
              </div>
              <div
                className="rounded-lg px-2 py-1.5 text-center"
                style={{
                  background: "var(--ink-3)",
                  border: "1px solid var(--ink-4)",
                }}
              >
                <div
                  className="font-display-ta text-sm font-black"
                  style={{ color: accent }}
                >
                  {Math.round(phase.sparringRatio * 100)}%
                </div>
                <div
                  className="font-mono-ta text-[9px] uppercase"
                  style={{ letterSpacing: "0.15em", color: "var(--fg-4)" }}
                >
                  Sparring
                </div>
              </div>
              <div
                className="rounded-lg px-2 py-1.5 text-center"
                style={{
                  background: "var(--ink-3)",
                  border: "1px solid var(--ink-4)",
                }}
              >
                <div
                  className="font-display-ta text-sm font-black"
                  style={{ color: accent }}
                >
                  {phase.techniqueIds.length + phase.exerciseIds.length}
                </div>
                <div
                  className="font-mono-ta text-[9px] uppercase"
                  style={{ letterSpacing: "0.15em", color: "var(--fg-4)" }}
                >
                  Inhalte
                </div>
              </div>
            </div>

            {/* Training areas tags */}
            {phase.trainingAreas.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {phase.trainingAreas.map((a) => (
                  <span
                    key={a}
                    className="font-mono-ta rounded px-1.5 py-0.5 text-[9px] uppercase"
                    style={{
                      letterSpacing: "0.12em",
                      background: accentBg,
                      border: `1px solid ${accentBorder}`,
                      color: accent,
                    }}
                  >
                    {TRAINING_AREA_LABEL[a]}
                  </span>
                ))}
              </div>
            )}

            {/* Techniques */}
            {phase.techniqueIds.length > 0 && (
              <div className="mt-4">
                <div
                  className="font-mono-ta mb-2 text-[10px] font-bold uppercase"
                  style={{ letterSpacing: "0.18em", color: "var(--fg-3)" }}
                >
                  Empfohlene Techniken
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {phase.techniqueIds.map((id) => {
                    const t = TECH_BY_ID.get(id);
                    return (
                      <span
                        key={id}
                        className="rounded-lg px-2 py-1 text-[11px]"
                        style={{
                          background: "var(--ink-3)",
                          border: "1px solid var(--ink-4)",
                          color: "var(--fg-2)",
                        }}
                      >
                        {t?.name ?? id}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Exercises */}
            {phase.exerciseIds.length > 0 && (
              <div className="mt-4">
                <div
                  className="font-mono-ta mb-2 text-[10px] font-bold uppercase"
                  style={{ letterSpacing: "0.18em", color: "var(--fg-3)" }}
                >
                  Empfohlene Übungen
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {phase.exerciseIds.map((id) => {
                    const e = EX_BY_ID.get(id);
                    return (
                      <span
                        key={id}
                        className="rounded-lg px-2 py-1 text-[11px]"
                        style={{
                          background: "var(--ink-3)",
                          border: "1px solid var(--ink-4)",
                          color: "var(--fg-2)",
                        }}
                      >
                        {e?.name ?? id}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Disclaimer */}
      <div
        className="rounded-xl p-3 text-[10px]"
        style={{
          background: "var(--ink-2)",
          border: "1px solid var(--ink-4)",
          color: "var(--fg-4)",
        }}
      >
        <strong style={{ color: "var(--fg-3)" }}>Methodischer Hinweis:</strong>{" "}
        Der Plan wird automatisch aus der Trainings-Historie des Schülers und
        dem Gegnerstil generiert (Heuristik, keine wissenschaftliche Aussage).
        Trainer sollten Phasen-Inhalte vor dem Einsatz prüfen und ggf. an die
        individuelle Belastbarkeit, Verletzungshistorie und Tages-Form
        anpassen.
      </div>
    </div>
  );
}
