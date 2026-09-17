"use client";

import Icon, { type IconName } from "@/components/ui/Icon";
import {
  FIGHTER_STANCE_LABEL,
  FIGHT_STYLE_LABEL,
  type FighterStance,
  type FightStyle,
} from "@/lib/fight-camp";
import type { GegnerDnaAnswers } from "@/lib/gegner-dna";
import {
  deriveSuggestions,
  deriveTendencies,
  hasActionData,
  isDnaSplitEmpty,
  zoneDistribution,
  type ActionStat,
  type DnaSplit,
} from "@/lib/fight-stats";
import {
  filtereTechnikStats,
  gesperrteGruppen,
  splitNachSteckbrief,
  zonenLabel,
  zonenPhrase,
  type Flaeche,
} from "@/lib/kampfart-steckbrief";
import type { Sport } from "@/lib/video-analysis";
import DnaCategoryGrid from "./DnaCategoryGrid";
import FightDnaSplit from "./FightDnaSplit";
import FightStatsBlock from "./FightStatsBlock";
import FightInsights from "./FightInsights";

/**
 * Eine Zeile mit Marker — Stärke, Schwäche, Lieblings-Angriff.
 *
 * Die drei Zeichen kamen bis zur Rollout-Etappe 3a aus drei handgezeichneten
 * SVGs in dieser Datei und trugen Cyan, Pink und ein hartkodiertes Violett.
 * Jetzt kommen sie aus der Icon-Registry (DESIGN-BRIEF §1.4) und aus der
 * SEMANTIK-Reihe — dieselbe Zuordnung, die `FightCampPlanView` für exakt
 * dieselben drei Felder schon trägt: `+` Stärke, `−` Schwäche, `★` das, worauf
 * sich der Athlet vorbereiten muss.
 */
function MarkerRow({
  icon,
  color,
  text,
}: {
  icon: IconName;
  color: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-1.5">
      <span
        aria-hidden
        style={{ color, flexShrink: 0, marginTop: "2px", lineHeight: 0 }}
      >
        <Icon name={icon} size={13} strokeWidth={2.8} />
      </span>
      <span style={{ color: "var(--text-2)" }}>{text}</span>
    </div>
  );
}

/**
 * Überschrift eines Blocks. Sie liegt seit Etappe 3a beim AUFRUFER und nicht
 * mehr im Block selbst — Begründung im Kopf von `FightDnaSplit.tsx`. Titel und
 * Unterzeile sind wortgleich zu `FightProfileView`, damit derselbe Block auf
 * dem Kampfprofil und im Gegnerbericht dasselbe heißt.
 */
function BlockHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-3">
      <div className="t-label">{title}</div>
      <div style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
        {sub}
      </div>
    </div>
  );
}

export interface OpponentView {
  name: string;
  style: FightStyle;
  stance: FighterStance;
  heightCm?: number | null;
  weightKg?: number | null;
  reachCm?: number | null;
  strengths?: string[];
  weaknesses?: string[];
  favoriteAttacks?: string[];
  notes?: string | null;
  dna?: GegnerDnaAnswers;
  dnaSplit?: DnaSplit | null;
  actionStats?: ActionStat[];
}

/** Teilansicht des Gegnerberichts (für die Tab-Darstellung im Gegner-Detail). */
export type OpponentViewSection = "all" | "overview" | "dna" | "stats";

/**
 * Read-only Gegnerbericht: Gegnerprofil-Zusammenfassung + Gegner-DNA in der
 * Profilansicht (nur beantwortete Fragen). Wird im Bibliotheks-Profil und in
 * der Wettkampf-Detailansicht (Snapshot) genutzt.
 *
 * `section` steuert, welcher Teil gerendert wird:
 *   • "all"      — kompletter Bericht (Snapshot-Ansicht im Wettkampf)
 *   • "overview" — Grunddaten + DNA-Split + Auto-Insights (Cockpit)
 *   • "dna"      — qualitativer Gegner-DNA-Accordion
 *   • "stats"    — Technik-Statistik
 */
export default function OpponentProfileView({
  opponent,
  showBasics = true,
  section = "all",
  sport = null,
  flaeche = null,
}: {
  opponent: OpponentView;
  /** Grunddaten-Kopf anzeigen (in der Wettkampf-Ansicht oft schon vorhanden). */
  showBasics?: boolean;
  section?: OpponentViewSection;
  /**
   * Kampfart der Ansicht (17.09.2026): im Wettkampf die des Wettkampfs, im
   * Gegnerprofil die EINZIGE Kampfart seiner Videos (sonst null). Filtert
   * Fragen, Zähler und Split nach dem Steckbrief — Techniken außerhalb der
   * Kampfart sind dort Foul oder Erkennungsfehler.
   */
  sport?: Sport | null;
  /**
   * Fläche aus den Videos des Gegners (`opponent.evidence.flaeche`, Leon
   * 17.09.2026: „Käfig nur, wenn einer da ist"): Achteck und „Am Käfig" nur
   * mit Käfig, Matte rund. null = neutral.
   */
  flaeche?: Flaeche | null;
}) {
  const measures = [
    opponent.heightCm ? `${opponent.heightCm} cm` : null,
    opponent.weightKg ? `${opponent.weightKg} kg` : null,
    opponent.reachCm ? `Reach ${opponent.reachCm} cm` : null,
  ].filter(Boolean);

  const strengths = opponent.strengths ?? [];
  const weaknesses = opponent.weaknesses ?? [];
  const favorites = opponent.favoriteAttacks ?? [];

  const showOverview = section === "all" || section === "overview";
  const showDna = section === "all" || section === "dna";
  const showStats = section === "all" || section === "stats";

  /**
   * Steht mehr als ein Block untereinander, braucht jeder seine Überschrift.
   * Zeigt die Ansicht dagegen genau EINEN Block (die Tabs „DNA" und „Stats" im
   * Gegner-Detail), sagt die Tab-Leiste darüber schon, was hier steht — eine
   * zweite Überschrift wäre dieselbe Auskunft direkt darunter.
   */
  const mehrereBloecke = section === "all" || section === "overview";

  /**
   * WAS NICHTS ZU ZEIGEN HAT, BEKOMMT AUCH KEINE ÜBERSCHRIFT. Jeder der drei
   * Blöcke gibt `null` zurück, wenn seine Datengrundlage fehlt — solange die
   * Überschrift im Block steckte, verschwand sie mit ihm. Jetzt steht sie
   * hier, also muss hier auch dieselbe Bedingung stehen; sonst bliebe
   * „Fight-DNA · Verteilung der Kampfbereiche" über einer leeren Fläche
   * stehen. Die Prüfungen sind genau die, die die Blöcke selbst anstellen.
   */
  const stats = sport
    ? filtereTechnikStats(opponent.actionStats ?? [], sport).stats
    : (opponent.actionStats ?? []);
  const split = sport ? splitNachSteckbrief(opponent.dnaSplit, sport) : (opponent.dnaSplit ?? null);
  const zonen = zoneDistribution(stats);
  const phrase = zonenPhrase(sport, flaeche) ?? undefined;
  const hatSplit = !!split && !isDnaSplitEmpty(split);
  const hatStats = stats.some(hasActionData);
  const hatInsights =
    deriveTendencies(stats, phrase).length > 0 ||
    deriveSuggestions(split, stats, {
      zonenPhrase: phrase,
      mitTakedowns: !gesperrteGruppen(sport).includes("takedown"),
      grappling: gesperrteGruppen(sport).includes("strike"),
    }).length > 0 ||
    (zonenLabel(sport, flaeche) ? zonen.center + zonen.open + zonen.cage : 0) > 0;

  return (
    <div className="flex flex-col gap-6">
      {showOverview && showBasics && (
        <div className="t-card p-4 sm:p-5">
          <div className="t-label">Gegner</div>
          {/* KEINE VERSALIEN: Ein Gegnername ist INHALT, keine Überschrift
              (Typo-Regel; nachgemessen an „Night of Champions" auf der
              Wettkampfkarte — Versalien plus Sperrung kosten rund ein Viertel
              der Breite). */}
          <div className="mt-1" style={{ font: "var(--type-h2)" }}>
            {opponent.name}
          </div>
          <div
            className="mt-1"
            style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
          >
            {FIGHT_STYLE_LABEL[opponent.style]} ·{" "}
            {FIGHTER_STANCE_LABEL[opponent.stance]}
          </div>
          {measures.length > 0 && (
            <div style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              {measures.join(" · ")}
            </div>
          )}

          {(strengths.length > 0 ||
            weaknesses.length > 0 ||
            favorites.length > 0 ||
            opponent.notes) && (
            <div
              className="mt-3 flex flex-col gap-1.5"
              style={{ font: "var(--type-sub)" }}
            >
              {strengths.length > 0 && (
                <MarkerRow
                  icon="plus"
                  color="var(--positive)"
                  text={strengths.join(", ")}
                />
              )}
              {weaknesses.length > 0 && (
                <MarkerRow
                  icon="minus"
                  color="var(--negative)"
                  text={weaknesses.join(", ")}
                />
              )}
              {favorites.length > 0 && (
                <MarkerRow
                  icon="star"
                  color="var(--warning)"
                  text={favorites.join(", ")}
                />
              )}
              {opponent.notes && (
                <div
                  className="mt-1 italic"
                  style={{ color: "var(--text-3)" }}
                >
                  &bdquo;{opponent.notes}&ldquo;
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showOverview && hatSplit && (
        /* §1 Fight-DNA-Split */
        <section>
          {mehrereBloecke && (
            <BlockHead title="Fight-DNA" sub="Verteilung der Kampfbereiche" />
          )}
          <FightDnaSplit split={split} />
        </section>
      )}

      {showOverview && hatInsights && (
        /* §3/§4/§5 Auto-Insights aus den Zahlen */
        <section>
          {mehrereBloecke && (
            <BlockHead
              title="Auto-Insights"
              sub="Abgeleitet aus Split und Statistik"
            />
          )}
          <FightInsights split={split} stats={stats} sport={sport} flaeche={flaeche} />
        </section>
      )}

      {/* §2 Technik-Statistik (Detailzahlen) */}
      {showStats && hatStats && (
        <section>
          {mehrereBloecke && (
            <BlockHead
              title="Technik-Statistik"
              sub="Gezählt aus den KI-Video-Analysen"
            />
          )}
          <FightStatsBlock stats={stats} sport={sport} flaeche={flaeche} />
        </section>
      )}

      {showDna && (
        /* Der Kategorien-Rost bleibt AUCH LEER stehen: Scouting-Lücken sollen
           auffallen, nicht verschwinden — er bringt dafür seinen eigenen
           Leerzustand mit. */
        <section>
          {mehrereBloecke && (
            <BlockHead title="Kampf-DNA" sub="Beobachtungen in 9 Kategorien" />
          )}
          <DnaCategoryGrid answers={opponent.dna ?? {}} sport={sport} flaeche={flaeche} />
        </section>
      )}
    </div>
  );
}
