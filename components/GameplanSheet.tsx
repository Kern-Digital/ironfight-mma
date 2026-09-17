"use client";

/**
 * Der Gameplan für den ATHLETEN (Leon 17.09.2026: „Ja, sofort über seine
 * Wettkampf-Karte"). Das Dashboard zeigt auf der Karte des nächsten Kampfs
 * „Dein Gameplan", ein Tipp öffnet dieses Sheet: Lage, die drei Blöcke und
 * die Drills — nur lesen. Den Inhalt schreibt Claude ohnehin in der Du-Form
 * an den Athleten (lib/server/gameplan-prompt.ts).
 *
 * LESEN OHNE NEUE REGEL: Der Gameplan liegt unter
 * `users/{uid}/fightProfile/gameplan-{campId}`, und der Inhaber liest seine
 * fightProfile-Dokumente schon heute. Das Wettkampf-Dokument mit dem
 * Gegner-Snapshot liest er ebenfalls — der Gameplan zeigt ihm nichts, was
 * sein Wettkampf nicht schon trägt.
 *
 * Kein „Neu schreiben": Das bleibt Trainersache (Wettkampfseite). Schreibt
 * Claude gerade neu, steht der letzte Stand mit einer Zeile darüber.
 */

import Icon from "@/components/ui/Icon";
import XKnopf from "@/components/ui/XKnopf";
import { SheetShell, useLetzterWert } from "@/components/motion";
import { GameplanBloecke, gameplanZeit } from "@/components/trainer/GameplanBlock";
import { PHASE_LABEL, type FightCamp } from "@/lib/fight-camp";
import { drillsFuerPhase, type Gameplan, type GameplanDrillPhase } from "@/lib/gameplan";
import { FLAECHE_LABEL, flaecheDesWettkampfs, flaecheWaehlbar } from "@/lib/kampfart-steckbrief";
import { SPORT_KURZ } from "@/lib/video-analysis";

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
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

function GameplanSheetInhalt({
  camp,
  gameplan,
  onClose,
}: {
  camp: FightCamp;
  gameplan: Gameplan;
  onClose: () => void;
}) {
  const inhalt = gameplan.inhalt;
  const flaeche = flaecheWaehlbar(camp.sport) ? flaecheDesWettkampfs(camp) : null;
  const gegner = camp.opponent?.name || "dein Gegner";
  const kopf = [camp.sport ? SPORT_KURZ[camp.sport] : null, flaeche ? FLAECHE_LABEL[flaeche] : null, `gegen ${gegner}`]
    .filter(Boolean)
    .join(" · ");
  const stand = gameplan.stand;

  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-3">
        <div className="flex flex-col items-start">
          <div aria-hidden className="mb-2 h-1 w-10 rounded-full sm:invisible" style={{ background: "var(--line-strong)" }} />
          <span className="t-label">{camp.competitionName}</span>
        </div>
        <XKnopf onClick={onClose} ariaLabel="Schließen" wort="Schließen" drehung="roll" style={{ color: "var(--text-2)" }} />
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto px-5 pt-2"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
      >
        <h2 className="t-sheet-title">Dein Gameplan</h2>
        <p className="mt-1" style={{ ...META_FONT, color: "var(--text-3)" }}>
          {kopf}
        </p>

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
      </div>
    </>
  );
}

export default function GameplanSheet({
  camp,
  gameplan,
  offen,
  onClose,
}: {
  camp: FightCamp;
  gameplan: Gameplan | null;
  offen: boolean;
  onClose: () => void;
}) {
  // Während der Austritts-Feder bleibt der letzte Inhalt stehen.
  const zeigen = useLetzterWert(offen && gameplan?.inhalt ? gameplan : null);

  return (
    <SheetShell
      open={offen && !!gameplan?.inhalt}
      onClose={onClose}
      label="Dein Gameplan"
      panelClassName="pointer-events-auto relative flex w-full max-h-[85vh] flex-col overflow-hidden rounded-t-[var(--r-xl)] sm:max-w-xl sm:rounded-[var(--r-xl)]"
      panelStyle={{ maxHeight: "85dvh", background: "var(--surface-card)", boxShadow: "var(--glass-shadow)" }}
    >
      {zeigen && <GameplanSheetInhalt camp={camp} gameplan={zeigen} onClose={onClose} />}
    </SheetShell>
  );
}
