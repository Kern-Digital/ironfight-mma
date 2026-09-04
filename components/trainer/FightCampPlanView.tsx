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

/**
 * DER ZUSTAND FÄRBT, NICHT DIE PHASE (Leons Entscheidung 04.09.2026).
 *
 * Vorher trug jede der vier Phasen ihre eigene Farbe — Cyan, Pink und zweimal
 * Violett. Das waren vier Akzente in einer Ansicht, zwei davon in der Farbe,
 * die app-weit DeepFight bedeutet, direkt neben der DeepFight-Wortmarke.
 *
 * Vier Farben sagen „vier verschiedene Dinge". Die Phasen sind aber eine
 * REIHENFOLGE, kein Sortiment: Aufbau → Schwerpunkt → Sparring → Taper. Was
 * ein Trainer beim Blick auf den Plan wissen will, ist nicht „welche Phase ist
 * das", sondern „wo stehen wir gerade". Deshalb färbt jetzt der Zustand:
 * laufend trägt den vollen Gym-Akzent, erledigt steht gedimmt, kommend
 * neutral.
 */
type PhaseState = "done" | "current" | "upcoming";

function phaseState(
  phase: FightCampPhase,
  current: FightCampPhase | null,
  index: number,
  phases: FightCamp["phases"],
): PhaseState {
  if (phase === current) return "current";
  // Ohne laufende Phase (Camp noch nicht gestartet oder schon vorbei)
  // entscheidet das Enddatum — sonst stünde alles auf „kommend".
  const laufendIdx = current ? phases.findIndex((p) => p.phase === current) : -1;
  if (laufendIdx >= 0) return index < laufendIdx ? "done" : "upcoming";
  return phases[index].endsAt.getTime() < Date.now() ? "done" : "upcoming";
}

const PHASE_FG: Record<PhaseState, string> = {
  current: "var(--accent-text)",
  done: "var(--text-3)",
  upcoming: "var(--text-2)",
};

/** Fläche des Nummernkreises und der Chips. */
const PHASE_BG: Record<PhaseState, string> = {
  current: "var(--accent-subtle)",
  done: "var(--surface-raised)",
  upcoming: "var(--surface-raised)",
};

const PHASE_BORDER: Record<PhaseState, string> = {
  current: "color-mix(in oklab, var(--accent) 40%, transparent)",
  done: "var(--line)",
  upcoming: "var(--line)",
};

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

export default function FightCampPlanView({
  camp,
  showOpponent = true,
}: {
  camp: FightCamp;
  /** Gegner-Zusammenfassung anzeigen. Im Wettkampf-Detail aus, da dort die
   *  vollständige Gegner-DNA bereits separat dargestellt wird. */
  showOpponent?: boolean;
}) {
  const progress = fightCampProgress(camp);

  return (
    <div className="flex flex-col gap-4">
      {/* Camp-Kopf. Kein Verlauf mehr als Flächenfüllung (DESIGN-BRIEF §3):
          eine Karte, und die Betonung macht die Typo. */}
      <div className="t-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="t-label">Wettkampf-Vorbereitung</span>
            <h2
              className="mt-1"
              style={{
                font: "var(--type-h2)",
                letterSpacing: "var(--ls-display)",
                textTransform: "uppercase",
              }}
            >
              {camp.competitionName}
            </h2>
            <div
              className="mt-1"
              style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
            >
              {formatDate(camp.competitionDate)} ·{" "}
              {progress.daysRemaining > 0
                ? `${progress.daysRemaining} Tage übrig`
                : "Kampftag erreicht"}{" "}
              · {camp.weeksTotal} Wochen Plan
            </div>
          </div>
        </div>

        {/* Progress-Bar */}
        <div className="mt-4">
          {/* `.t-progress` ist der app-weite Balken — er traegt --grad-progress,
              also den tonalen Verlauf AUS DEM Gym-Akzent. Vorher lief hier
              Cyan → Pink, ein zweifarbiger Verlauf, den es im neuen System
              nicht mehr gibt. */}
          <div className="t-progress">
            <span style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
          </div>
          <div
            className="mt-1.5 flex flex-wrap justify-between gap-x-3"
            style={{ ...META_FONT, color: "var(--text-3)" }}
          >
            <span>Start: {formatDate(camp.startedAt)}</span>
            <span>{Math.round(progress.ratio * 100)}% absolviert</span>
            <span>Kampf: {formatDate(camp.competitionDate)}</span>
          </div>
        </div>

        {/* Opponent summary */}
        {showOpponent && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <span className="t-label">Gegner</span>
            <div
              className="mt-1 truncate"
              style={{ font: "var(--type-h3)" }}
            >
              {camp.opponent.name}
            </div>
            <div
              className="mt-1"
              style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
            >
              {FIGHT_STYLE_LABEL[camp.opponent.style]} ·{" "}
              {FIGHTER_STANCE_LABEL[camp.opponent.stance]}
            </div>
            <div
              className="mt-1"
              style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
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

          <div>
            <span className="t-label">Stärken / Schwächen / Lieblings-Angriffe</span>
            <div
              className="mt-1 flex flex-col gap-1"
              style={{ font: "var(--type-sub)" }}
            >
              {camp.opponent.strengths.length > 0 && (
                <div>
                  <span style={{ color: "var(--positive)" }}>+ </span>
                  <span style={{ color: "var(--text-2)" }}>
                    {camp.opponent.strengths.join(", ")}
                  </span>
                </div>
              )}
              {camp.opponent.weaknesses.length > 0 && (
                <div>
                  <span style={{ color: "var(--negative)" }}>− </span>
                  <span style={{ color: "var(--text-2)" }}>
                    {camp.opponent.weaknesses.join(", ")}
                  </span>
                </div>
              )}
              {camp.opponent.favoriteAttacks.length > 0 && (
                <div>
                  {/* Die drei Zeichen kommen aus der SEMANTIK-Reihe, nicht aus
                      den Marken-Akzenten: + Stärke (positive), − Schwäche
                      (negative), ★ Lieblings-Angriff (warning) — worauf sich
                      der Athlet vorbereiten muss. Vorher war der Stern ein
                      hartkodiertes Violett, also DeepFights Farbe. */}
                  <span style={{ color: "var(--warning)" }}>★ </span>
                  <span style={{ color: "var(--text-2)" }}>
                    {camp.opponent.favoriteAttacks.join(", ")}
                  </span>
                </div>
              )}
              {camp.opponent.notes && (
                <div
                  className="mt-1 italic"
                  style={{ color: "var(--text-3)" }}
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
        const zustand = phaseState(
          phase.phase,
          progress.currentPhase,
          idx,
          camp.phases,
        );
        const isCurrent = zustand === "current";
        const accent = PHASE_FG[zustand];
        const accentBg = PHASE_BG[zustand];
        const accentBorder = PHASE_BORDER[zustand];

        return (
          <div
            key={`${phase.phase}-${idx}`}
            className={isCurrent ? "t-card p-5" : undefined}
            style={
              isCurrent
                ? {
                    borderColor:
                      "color-mix(in oklab, var(--accent) 40%, transparent)",
                  }
                : // Erledigtes tritt zurueck, statt zu verschwinden: Der Plan
                  // soll als Ganzes lesbar bleiben.
                  { opacity: zustand === "done" ? 0.72 : 1 }
            }
          >
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-badge"
                  style={{
                    font: "var(--type-body-strong)",
                    background: accentBg,
                    border: `1px solid ${accentBorder}`,
                    color: accent,
                  }}
                >
                  {idx + 1}
                </div>
                <div>
                  <h3
                    style={{
                      font: "var(--type-h3)",
                      letterSpacing: "var(--ls-display)",
                      textTransform: "uppercase",
                      color: isCurrent ? accent : "var(--text-body)",
                    }}
                  >
                    {PHASE_LABEL[phase.phase]}
                  </h3>
                  <div style={{ ...META_FONT, color: "var(--text-3)" }}>
                    Woche {idx === 0 ? 1 : "…"} · {phase.weeks}{" "}
                    {phase.weeks === 1 ? "Woche" : "Wochen"} ·{" "}
                    {formatDate(phase.startsAt)} → {formatDate(phase.endsAt)}
                  </div>
                </div>
              </div>
              {isCurrent && (
                <span
                  className="rounded-badge px-2 py-1"
                  style={{
                    ...META_FONT,
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
              className="mt-3"
              style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
            >
              {phase.focus}
            </p>

            {/* Stats */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div
                className="rounded-field px-2 py-2 text-center"
                style={{ background: "var(--surface-raised)" }}
              >
                <div
                  style={{
                    font: "var(--type-body-strong)",
                    fontVariantNumeric: "tabular-nums",
                    color: accent,
                  }}
                >
                  {phase.sessionsPerWeek}×
                </div>
                <div style={{ ...META_FONT, color: "var(--text-3)" }}>
                  /Woche
                </div>
              </div>
              <div
                className="rounded-field px-2 py-2 text-center"
                style={{ background: "var(--surface-raised)" }}
              >
                <div
                  style={{
                    font: "var(--type-body-strong)",
                    fontVariantNumeric: "tabular-nums",
                    color: accent,
                  }}
                >
                  {Math.round(phase.sparringRatio * 100)}%
                </div>
                <div style={{ ...META_FONT, color: "var(--text-3)" }}>
                  Sparring
                </div>
              </div>
              <div
                className="rounded-field px-2 py-2 text-center"
                style={{ background: "var(--surface-raised)" }}
              >
                <div
                  style={{
                    font: "var(--type-body-strong)",
                    fontVariantNumeric: "tabular-nums",
                    color: accent,
                  }}
                >
                  {phase.techniqueIds.length + phase.exerciseIds.length}
                </div>
                <div style={{ ...META_FONT, color: "var(--text-3)" }}>
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
                    className="rounded-badge px-1.5 py-0.5"
                    style={{
                      ...META_FONT,
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
                <div className="t-label mb-2">
                  Empfohlene Techniken
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {phase.techniqueIds.map((id) => {
                    const t = TECH_BY_ID.get(id);
                    return (
                      <span
                        key={id}
                        className="rounded-badge px-2 py-1"
                        style={{
                          font: "var(--type-sub)",
                          background: "var(--surface-raised)",
                          border: "1px solid var(--line)",
                          color: "var(--text-2)",
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
                <div className="t-label mb-2">
                  Empfohlene Übungen
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {phase.exerciseIds.map((id) => {
                    const e = EX_BY_ID.get(id);
                    return (
                      <span
                        key={id}
                        className="rounded-badge px-2 py-1"
                        style={{
                          font: "var(--type-sub)",
                          background: "var(--surface-raised)",
                          border: "1px solid var(--line)",
                          color: "var(--text-2)",
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
      <div style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
        <strong style={{ color: "var(--text-2)" }}>Zur Einordnung:</strong>{" "}
        Dieser Plan entsteht aus der Trainings-Historie deines Athleten und dem
        Stil des Gegners — eine Faustregel, kein wissenschaftliches Ergebnis.
        Geh die Phasen durch, bevor du sie einsetzt, und pass sie an
        Belastbarkeit, Verletzungen und Tagesform an.
      </div>
    </div>
  );
}
