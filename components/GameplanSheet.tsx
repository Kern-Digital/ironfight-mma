"use client";

/**
 * Das Wettkampf-Sheet des ATHLETEN — Trainingsplan und Gameplan seines
 * nächsten Kampfs, beides nur lesen.
 *
 *   • Gameplan (Leon 17.09.2026: „Ja, sofort über seine Wettkampf-Karte"):
 *     Lage, die drei Blöcke und die Drills. Den Inhalt schreibt Claude ohnehin
 *     in der Du-Form an den Athleten (lib/server/gameplan-prompt.ts).
 *   • Trainingsplan (Leon 11.09.: „Athlet sieht den Plan seines Wettkampfs",
 *     Änderungen „direkt mitgeändert"; 17.09.: „Ja, Stufe 1 jetzt"): die vier
 *     Phasen mit Fokus, Einheiten, Sparring, Notiz und „Geändert von …".
 *     LIVE aus dem Camp-Dokument, solange das Sheet offen ist — speichert der
 *     Trainer, steht die Änderung sofort hier.
 *
 * Das Dashboard zeigt auf der Karte „Dein Trainingsplan" und — sobald ein
 * Inhalt steht — „Dein Gameplan"; die Zeile wählt den Reiter. Die Reiter
 * erscheinen erst, wenn es beides gibt.
 *
 * LESEN OHNE NEUE REGEL: Der Inhaber liest seine fightCamps (Owner-Lesen) und
 * seine fightProfile-Dokumente — darunter `gameplan-{campId}`.
 *
 * Kein „Neu schreiben", kein „Bearbeiten": Das bleibt Trainersache
 * (Wettkampfseite). Schreibt Claude gerade neu, steht der letzte Stand mit
 * einer Zeile darüber.
 */

import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import XKnopf from "@/components/ui/XKnopf";
import { MorphSwap, SheetShell, useLetzterWert } from "@/components/motion";
import { GameplanBloecke, gameplanZeit } from "@/components/trainer/GameplanBlock";
import FightCampPlanView, { aenderungText } from "@/components/trainer/FightCampPlanView";
import {
  beobachteFightCamp,
  fightCampProgress,
  PHASE_LABEL,
  planZuletztGeaendert,
  type FightCamp,
} from "@/lib/fight-camp";
import { drillsFuerPhase, type Gameplan, type GameplanDrillPhase } from "@/lib/gameplan";
import { FLAECHE_LABEL, flaecheDesWettkampfs, flaecheWaehlbar } from "@/lib/kampfart-steckbrief";
import { SPORT_KURZ } from "@/lib/video-analysis";

export type WettkampfTab = "plan" | "gameplan";

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const DRILL_PHASEN: GameplanDrillPhase[] = ["specific-prep", "sparring-simulation"];

const videos = (n: number) => `${n} ${n === 1 ? "Video" : "Videos"}`;

function Drills({ gameplan }: { gameplan: Gameplan }) {
  const phasen = DRILL_PHASEN.map((p) => ({ phase: p, drills: drillsFuerPhase(gameplan, p) })).filter(
    (p) => p.drills.length > 0,
  );
  if (phasen.length === 0) return null;
  return (
    <div className="flex flex-col gap-4 border-t pt-4" style={{ borderColor: "var(--line)" }}>
      <div className="flex items-center gap-2">
        <span aria-hidden style={{ color: "var(--accent-2)", lineHeight: 0 }}>
          <Icon name="dumbbell" size={16} />
        </span>
        <span className="t-label">Deine Drills</span>
      </div>
      {phasen.map(({ phase, drills }) => (
        <div key={phase} className="flex flex-col gap-2.5">
          <span style={{ ...META_FONT, color: "var(--text-3)" }}>{PHASE_LABEL[phase]}</span>
          <ul className="flex flex-col gap-3">
            {drills.map((d, i) => (
              <li key={`${d.titel}-${i}`}>
                <div style={{ font: "var(--type-body-strong)" }}>{d.titel}</div>
                <p className="mt-0.5" style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                  {d.text}
                </p>
                {d.wofuer && (
                  <p className="mt-1" style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                    <span style={META_FONT}>Für</span> {d.wofuer}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function GameplanInhalt({ camp, gameplan }: { camp: FightCamp; gameplan: Gameplan }) {
  const inhalt = gameplan.inhalt;
  const gegner = camp.opponent?.name || "dein Gegner";
  const stand = gameplan.stand;
  return (
    <>
      {gameplan.status === "schreibt" && (
        <div className="mt-3 flex items-center gap-2" style={{ ...META_FONT, color: "var(--accent-text)" }}>
          <span aria-hidden className="h-2 w-2 rounded-full motion-safe:animate-pulse" style={{ background: "var(--accent)" }} />
          Claude schreibt deinen Gameplan gerade neu
        </div>
      )}
      {inhalt && (
        <div className="mt-4 flex flex-col gap-5">
          <GameplanBloecke inhalt={inhalt} spalten={false} />
          <Drills gameplan={gameplan} />
          <p style={{ ...META_FONT, color: "var(--text-3)" }}>
            {stand && `Aus ${videos(stand.athletAnalysen)} von dir · ${videos(stand.gegnerAnalysen)} von ${gegner}${stand.gegnerScouting ? " + Scouting" : ""}`}
            {gameplan.geschriebenAt && ` · geschrieben ${gameplanZeit(gameplan.geschriebenAt)}`}
          </p>
        </div>
      )}
    </>
  );
}

function PlanInhalt({ camp, gameplan }: { camp: FightCamp; gameplan: Gameplan | null }) {
  const progress = fightCampProgress(camp);
  const laufend = progress.currentPhase ? camp.phases.findIndex((p) => p.phase === progress.currentPhase) : -1;
  const zuletzt = planZuletztGeaendert(camp);
  return (
    <div className="mt-4 flex flex-col gap-4" data-athleten-plan={camp.id}>
      <p style={{ ...META_FONT, color: "var(--text-3)" }}>
        {laufend >= 0
          ? `Phase ${laufend + 1} von ${camp.phases.length} · ${PHASE_LABEL[camp.phases[laufend].phase]} · ${progress.daysRemaining} ${progress.daysRemaining === 1 ? "Tag" : "Tage"} bis zum Kampf`
          : `${camp.weeksTotal} Wochen Plan · ${progress.daysRemaining} ${progress.daysRemaining === 1 ? "Tag" : "Tage"} bis zum Kampf`}
        {zuletzt && ` · ${aenderungText(zuletzt)}`}
      </p>
      <FightCampPlanView
        camp={camp}
        showOpponent={false}
        kopf={false}
        sicht="athlet"
        drillsFuer={gameplan ? (phase) => drillsFuerPhase(gameplan, phase) : undefined}
      />
    </div>
  );
}

function SheetInhalt({
  camp,
  gameplan,
  tab,
  onTab,
  onClose,
}: {
  camp: FightCamp;
  gameplan: Gameplan | null;
  tab: WettkampfTab;
  onTab: (t: WettkampfTab) => void;
  onClose: () => void;
}) {
  const flaeche = flaecheWaehlbar(camp.sport) ? flaecheDesWettkampfs(camp) : null;
  const gegner = camp.opponent?.name || "dein Gegner";
  const kopf = [camp.sport ? SPORT_KURZ[camp.sport] : null, flaeche ? FLAECHE_LABEL[flaeche] : null, `gegen ${gegner}`]
    .filter(Boolean)
    .join(" · ");
  // Ohne Gameplan-Inhalt gibt es nur den Plan — dann auch keine Reiter.
  const aktiv: WettkampfTab = gameplan?.inhalt ? tab : "plan";

  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-3">
        <div className="flex flex-col items-start">
          <div aria-hidden className="mb-2 h-1 w-10 rounded-full sm:invisible" style={{ background: "var(--line-strong)" }} />
          <span className="t-label">{camp.competitionName}</span>
        </div>
        <XKnopf onClick={onClose} ariaLabel="Schließen" wort="Schließen" drehung="roll" style={{ color: "var(--text-2)" }} />
      </div>
      {gameplan?.inhalt && (
        <div className="flex shrink-0 gap-2 px-5 pt-3" role="group" aria-label="Ansicht wählen">
          {(
            [
              ["plan", "Trainingsplan"],
              ["gameplan", "Gameplan"],
            ] as const
          ).map(([wert, label]) => {
            const an = aktiv === wert;
            return (
              <button
                key={wert}
                type="button"
                onClick={() => onTab(wert)}
                aria-pressed={an}
                data-press
                data-reiter={wert}
                className="t-interactive inline-flex min-h-hit flex-1 items-center justify-center rounded-field px-3"
                style={{
                  ...BTN_FONT,
                  background: an ? "var(--accent)" : "var(--surface-raised)",
                  color: an ? "var(--on-accent)" : "var(--text-2)",
                  border: `1px solid ${an ? "var(--accent)" : "var(--line)"}`,
                  transition:
                    "background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
      <div
        className="min-h-0 flex-1 overflow-y-auto px-5 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
      >
        <MorphSwap activeKey={aktiv}>
          <h2 className="t-sheet-title">{aktiv === "plan" ? "Dein Trainingsplan" : "Dein Gameplan"}</h2>
          <p className="mt-1" style={{ ...META_FONT, color: "var(--text-3)" }}>
            {kopf}
          </p>
          {aktiv === "plan" || !gameplan ? (
            <PlanInhalt camp={camp} gameplan={gameplan} />
          ) : (
            <GameplanInhalt camp={camp} gameplan={gameplan} />
          )}
        </MorphSwap>
      </div>
    </>
  );
}

export default function GameplanSheet({
  camp,
  gameplan,
  tab,
  onTab,
  onClose,
}: {
  camp: FightCamp;
  /** Nur mit Inhalt übergeben — sonst null. */
  gameplan: Gameplan | null;
  /** null = zu. */
  tab: WettkampfTab | null;
  onTab: (t: WettkampfTab) => void;
  onClose: () => void;
}) {
  const offen = tab !== null;
  // Solange das Sheet offen ist, kommt das Camp live — der Trainer kann den
  // Plan gerade bearbeiten. Zu = kein Abo.
  const [live, setLive] = useState<FightCamp | null>(null);
  useEffect(() => {
    if (!offen) return;
    return beobachteFightCamp(
      camp.studentUid,
      camp.id,
      (c) => setLive(c),
      () => setLive(null),
    );
  }, [offen, camp.studentUid, camp.id]);
  const aktuell = live && live.id === camp.id ? live : camp;

  // Während der Austritts-Feder bleibt der letzte Inhalt stehen.
  const zeigen = useLetzterWert(offen ? { camp: aktuell, gameplan, tab } : null);

  return (
    <SheetShell
      open={offen}
      onClose={onClose}
      label={tab === "gameplan" ? "Dein Gameplan" : "Dein Trainingsplan"}
      panelClassName="pointer-events-auto relative flex w-full max-h-[85vh] flex-col overflow-hidden rounded-t-[var(--r-xl)] sm:max-w-xl sm:rounded-[var(--r-xl)]"
      panelStyle={{ maxHeight: "85dvh", background: "var(--surface-card)", boxShadow: "var(--glass-shadow)" }}
    >
      {zeigen && (
        <SheetInhalt camp={zeigen.camp} gameplan={zeigen.gameplan} tab={zeigen.tab} onTab={onTab} onClose={onClose} />
      )}
    </SheetShell>
  );
}
