"use client";

import { useState } from "react";
import { ALL_TECHNIQUES } from "@/lib/techniques";
import { EXERCISES } from "@/lib/exercises";
import {
  fightCampProgress,
  FIGHT_STYLE_LABEL,
  FIGHTER_STANCE_LABEL,
  PHASE_LABEL,
  verschiebungText,
  wannText,
  type FightCamp,
  type FightCampPhase,
  type PhasenAenderung,
  type PlanAenderung,
} from "@/lib/fight-camp";
import type { GameplanDrill } from "@/lib/gameplan";
import { TRAINING_AREA_LABEL } from "@/lib/types";
import { MorphSwap } from "@/components/motion";
import Icon from "@/components/ui/Icon";
import PhasenEditor from "@/components/trainer/PhasenEditor";

function formatDate(d: Date): string {
  return d.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** „Geändert von Leon · heute" — für die Phase und den Kopf des Athleten-Sheets. */
export function aenderungText(g: PlanAenderung, jetzt = new Date()): string {
  return `Geändert von ${g.name} · ${wannText(g.at, jetzt)}`;
}

/**
 * „Woche 1–4 · 4 Wochen" aus den DATEN der Phase, nicht aus `weeks`: Nach einer
 * Verschiebung (Stufe 2) stimmen die Wochen nur, wenn sie aus startsAt/endsAt
 * kommen — und eine angebrochene Phase heißt dann „5 Tage" statt „1 Woche".
 */
function phasenSpanne(
  phase: FightCamp["phases"][number],
  startedAt: Date,
): string {
  const tage = Math.max(1, Math.round((phase.endsAt.getTime() - phase.startsAt.getTime()) / 86_400_000));
  // Unter einer Woche sagt die Wochen-Spanne nichts mehr („Woche 1–2 · 6 Tage")
  // — dann steht nur die Dauer, das Datum daneben sagt den Rest.
  if (tage < 7) return `${tage} ${tage === 1 ? "Tag" : "Tage"}`;
  const dauer = `${Math.round(tage / 7)} ${Math.round(tage / 7) === 1 ? "Woche" : "Wochen"}`;
  const woche = (d: Date) =>
    Math.max(1, Math.floor((d.getTime() - startedAt.getTime()) / (7 * 86_400_000)) + 1);
  const von = woche(phase.startsAt);
  const bis = Math.max(von, woche(new Date(phase.endsAt.getTime() - 86_400_000)));
  return `Woche ${von === bis ? von : `${von}–${bis}`} · ${dauer}`;
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

/**
 * Anker einer Phase im Dokument — der Knopf „Trainingsplan" im Kopf der
 * Wettkampfseite (Leon 11.09.2026) springt damit auf die LAUFENDE Phase,
 * nicht bloß auf die Überschrift des Plans. Eine Funktion statt eines
 * Strings an zwei Orten: Der Knopf und dieser Block müssen denselben Namen
 * bilden, sonst läuft der Sprung ins Leere.
 */
export function phaseAnchorId(phase: FightCampPhase): string {
  return `plan-phase-${phase}`;
}

export default function FightCampPlanView({
  camp,
  showOpponent = true,
  drillsFuer,
  sicht = "trainer",
  kopf = true,
  onPhaseSpeichern,
}: {
  camp: FightCamp;
  /** Gegner-Zusammenfassung anzeigen. Im Wettkampf-Detail aus, da dort die
   *  vollständige Gegner-DNA bereits separat dargestellt wird. */
  showOpponent?: boolean;
  /**
   * Drills aus dem Gameplan je Phase (Leon 17.09.2026: „Drills in den Plan",
   * Phase 2 gegnerspezifisch, Phase 3 Sparring). Sie stehen NICHT im
   * Camp-Dokument, sondern kommen live aus dem Gameplan — ein neuer Gameplan
   * ersetzt sie, ohne den Plan anzufassen.
   */
  drillsFuer?: (phase: FightCampPhase) => GameplanDrill[];
  /** „athlet" = der Plan im Sheet des Athleten (Leon 11.09.: „Athlet sieht den Plan seines Wettkampfs"). */
  sicht?: "trainer" | "athlet";
  /** Die Kopfkarte mit Name und Fortschritt — im Sheet steht beides schon darüber. */
  kopf?: boolean;
  /**
   * Phase von Hand ändern (Leon 17.09.2026: „Wettkampf-Plan bearbeiten,
   * Stufe 1"). Ohne diese Funktion bleibt der Plan reine Anzeige.
   */
  onPhaseSpeichern?: (phase: FightCampPhase, aenderung: PhasenAenderung) => Promise<void>;
}) {
  const progress = fightCampProgress(camp);
  // Immer nur EINE Phase im Editor — zwei offene Formulare laden zum Verlieren ein.
  const [bearbeitet, setBearbeitet] = useState<FightCampPhase | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {/* Camp-Kopf. Kein Verlauf mehr als Flächenfüllung (DESIGN-BRIEF §3):
          eine Karte, und die Betonung macht die Typo. */}
      {kopf && (
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
            {camp.verschoben && (
              <div
                className="mt-1"
                data-plan-verschoben
                style={{ ...META_FONT, color: "var(--text-3)" }}
              >
                {verschiebungText(camp.verschoben)}
              </div>
            )}
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
      )}

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
        const imEditor = bearbeitet === phase.phase;

        return (
          <div
            key={`${phase.phase}-${idx}`}
            id={phaseAnchorId(phase.phase)}
            // scroll-mt: Der Anker landet nicht unter der Kopfleiste der
            // Hülle, sondern mit Luft darunter.
            className={isCurrent ? "t-card scroll-mt-24 p-5" : "scroll-mt-24"}
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
                    {phasenSpanne(phase, camp.startedAt)} · {formatDate(phase.startsAt)} →{" "}
                    {formatDate(phase.endsAt)}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
                {/* Dieselbe ruhige Pille wie „Bearbeiten" im Kopf der
                    Wettkampfseite — Wort und Stift, kein nacktes Zeichen. */}
                {onPhaseSpeichern && !imEditor && (
                  <button
                    type="button"
                    onClick={() => setBearbeitet(phase.phase)}
                    data-press
                    data-aktion="phase-bearbeiten"
                    data-phase={phase.phase}
                    aria-label={`${PHASE_LABEL[phase.phase]} bearbeiten`}
                    className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-pill px-3.5"
                    style={{
                      ...META_FONT,
                      border: "1px solid var(--line)",
                      color: "var(--text-body)",
                    }}
                  >
                    <Icon name="edit" size={16} strokeWidth={2.2} />
                    Bearbeiten
                  </button>
                )}
              </div>
            </div>

            {/* Fokus, Notiz und „geändert von" — der Editor steht an derselben Stelle. */}
            <MorphSwap activeKey={imEditor ? "editor" : "ansicht"} className="mt-3">
              {imEditor && onPhaseSpeichern ? (
                <PhasenEditor
                  phase={phase}
                  onSpeichern={async (a) => {
                    await onPhaseSpeichern(phase.phase, a);
                    setBearbeitet(null);
                  }}
                  onAbbrechen={() => setBearbeitet(null)}
                />
              ) : (
                <div className="flex flex-col gap-2">
                  <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                    {phase.focus}
                  </p>
                  {phase.notes && (
                    <div
                      className="rounded-field px-3 py-2.5"
                      data-phasen-notiz={phase.phase}
                      style={{ background: "var(--surface-raised)", border: "1px solid var(--line)" }}
                    >
                      <div className="t-label">
                        {sicht === "athlet" ? "Notiz von deinem Trainer" : "Notiz"}
                      </div>
                      <p
                        className="mt-1 whitespace-pre-line"
                        style={{ font: "var(--type-sub)", color: "var(--text-body)" }}
                      >
                        {phase.notes}
                      </p>
                    </div>
                  )}
                  {phase.geaendert && (
                    <div data-phasen-geaendert={phase.phase} style={{ ...META_FONT, color: "var(--text-3)" }}>
                      {aenderungText(phase.geaendert)}
                    </div>
                  )}
                </div>
              )}
            </MorphSwap>

            {/* Drills aus dem Gameplan — zuerst, weil sie genau diesem Gegner gelten. */}
            {(drillsFuer?.(phase.phase) ?? []).length > 0 && (
              <div className="mt-3" data-gameplan-drills={phase.phase}>
                <div className="t-label mb-2">Aus dem Gameplan</div>
                <ul className="flex flex-col gap-2">
                  {drillsFuer!(phase.phase).map((d, i) => (
                    <li
                      key={`${d.titel}-${i}`}
                      className="rounded-field px-3 py-2.5"
                      style={{ background: "var(--surface-raised)", border: "1px solid var(--line)" }}
                    >
                      <div style={{ font: "var(--type-body-strong)" }}>{d.titel}</div>
                      <p className="mt-0.5" style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                        {d.text}
                      </p>
                      {d.wofuer && (
                        <div className="mt-1" style={{ ...META_FONT, color: "var(--text-3)" }}>
                          Zahlt ein auf: {d.wofuer}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Stats — im Editor stehen Einheiten und Sparring als Stepper, hier nicht doppelt. */}
            {!imEditor && (
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
            )}

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
      {sicht === "athlet" ? (
        <div style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
          Dein Trainer plant die Phasen und passt sie an. Die Drills
          &bdquo;Aus dem Gameplan&ldquo; schreibt Claude aus deinem Profil und dem
          deines Gegners. Zwickt etwas, sprich mit deinem Trainer.
        </div>
      ) : (
        <div style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
          <strong style={{ color: "var(--text-2)" }}>Zur Einordnung:</strong>{" "}
          Dieser Plan entsteht aus der Trainings-Historie deines Athleten, dem
          Stil des Gegners und der Kampfart des Wettkampfs — eine Faustregel, kein
          wissenschaftliches Ergebnis. Die Drills &bdquo;Aus dem Gameplan&ldquo; schreibt
          Claude aus beiden DeepFight-Profilen.
          {onPhaseSpeichern
            ? " Pass jede Phase über „Bearbeiten“ an Belastbarkeit, Verletzungen und Tagesform an — dein Athlet sieht die Änderung sofort."
            : " Geh die Phasen durch, bevor du sie einsetzt, und pass sie an Belastbarkeit, Verletzungen und Tagesform an."}
        </div>
      )}
    </div>
  );
}
