"use client";

import {
  deriveSuggestions,
  deriveTendencies,
  zoneDistribution,
  type ActionStat,
  type CageZone,
  type DnaSplit,
  type TendencyTone,
} from "@/lib/fight-stats";
import Icon, { type IconName } from "@/components/ui/Icon";
import {
  begriffe,
  gesperrteGruppen,
  zonenLabel,
  zonenPhrase,
  type Flaeche,
} from "@/lib/kampfart-steckbrief";
import type { Sport } from "@/lib/video-analysis";

/**
 * ZWEI FARBEN FÜR FÜNF TÖNE (Rollout-Etappe 3a, 04.09.2026).
 *
 * Vorher trug jeder der fünf Töne eine eigene Farbe: Violett, Grün, Cyan,
 * nochmal Violett, Pink. Fünf Akzente in einer Liste, zwei davon in der Farbe,
 * die app-weit DeepFight bedeutet — direkt unter der DeepFight-Wortmarke.
 *
 * Die Töne sind aber keine Skala, sondern fünf ARTEN von Aussage: „seine
 * häufigste Waffe", „seine Trefferquote", „wo es passiert", „wie er
 * vorbereitet" — und, als einziges, „Hauptbedrohung". Nur der letzte ist ein
 * Alarm. Also färbt der ZUSTAND und nicht die Art (dieselbe Regel wie bei den
 * Camp-Phasen): Warnung rot, alles andere Gym-Akzent. Unterschieden bleiben
 * die Töne durch ihr Symbol, das sie ohnehin schon tragen.
 */
const TONE_COLOR: Record<TendencyTone, string> = {
  weapon: "var(--accent-text)",
  success: "var(--accent-text)",
  zone: "var(--accent-text)",
  setup: "var(--accent-text)",
  warning: "var(--negative)",
};

const TONE_ICON: Record<TendencyTone, IconName> = {
  weapon: "glove",
  success: "target",
  zone: "check",
  setup: "spark",
  warning: "warn",
};

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

/**
 * Heat-Prinzip der Käfig-Karte: EINE Farbe, Deckkraft streng nach RANG der
 * Anteile (hellste Zone = größter Anteil) — „kräftiger = mehr" braucht keine
 * Legende. 0 % bleibt bewusst ungefüllt.
 *
 * Die Farbe ist seit Etappe 3a der Gym-Akzent statt des festen Tidal-Cyan:
 * Heute sieht das identisch aus (der Akzent IST dieses Cyan), aber ein Gym mit
 * eigenem Branding bekommt seine Käfig-Karte mit (DESIGN-BRIEF §1.1). Die
 * Deckkraft-Stufen laufen deshalb über `color-mix` statt über einen
 * rgba()-Dreiklang, in den sich kein Token einsetzen ließe.
 */
function heat(alpha: number): string {
  return `color-mix(in oklab, var(--accent) ${Math.round(alpha * 100)}%, transparent)`;
}

/**
 * §3 Tendenzen + §4 Vorschläge + §5 Käfig-Karte.
 *
 * Rein abgeleitete Read-Ansicht: berechnet sich vollständig aus Split + Stats.
 * Rendert nichts, wenn keine Datengrundlage vorhanden ist.
 *
 * Rollout-Etappe 3a: `frameless` ist weg — der Block bringt weder Fläche noch
 * Kopfzeile mit (Begründung im Kopf von FightDnaSplit.tsx).
 */
export default function FightInsights({
  split,
  stats,
  only,
  sport = null,
  flaeche = null,
}: {
  split: DnaSplit | null | undefined;
  stats: ActionStat[];
  /**
   * Kampfart des Profils (Kampfart-Steckbriefe, 17.09.2026): keine Karte im
   * BJJ, kein Boden-Plan im Boxen. null = Gegnerprofil oder Gesamtprofil.
   */
  sport?: Sport | null;
  /**
   * Fläche des Profils (Käfig, Ring, Matte — Leon 17.09.2026: „Käfig nur, wenn
   * einer da ist"): Wörter der Zonen und Form der Karte. null = neutral.
   */
  flaeche?: Flaeche | null;
  /** Nur einen Teil rendern: "insights" (§3+§4) bzw. "zones" (§5 Käfig-Karte)
   * — FightProfileView platziert die Käfig-Karte separat als festen Block. */
  only?: "insights" | "zones";
}) {
  // BJJ hat keine Zone (Rand = Neustart) → keine Karte.
  const label = zonenLabel(sport, flaeche);
  const phrase = zonenPhrase(sport, flaeche);
  const tendencies = deriveTendencies(stats, phrase ?? undefined);
  const suggestions = deriveSuggestions(split, stats, {
    zonenPhrase: phrase ?? undefined,
    mitTakedowns: !gesperrteGruppen(sport).includes("takedown"),
    grappling: gesperrteGruppen(sport).includes("strike"),
  });
  const zones = zoneDistribution(stats);
  const zoneTotal = label ? zones.center + zones.open + zones.cage : 0;

  if (tendencies.length === 0 && suggestions.length === 0 && zoneTotal === 0)
    return null;

  const showInsights = only !== "zones";
  const showZones = only !== "insights";
  const hasInsightCard =
    showInsights && (tendencies.length > 0 || suggestions.length > 0);

  return (
    <div className="flex flex-col gap-4">
      {/* §3 Auto-Insights — Icon-Badges mit Glow, Trennlinien zwischen den Zeilen */}
      {hasInsightCard && (
        <div>
          {tendencies.map((t, i) => (
            <div
              key={t.id}
              className="flex items-center gap-3.5 py-3"
              style={{
                borderTop: i > 0 ? "1px dashed var(--line)" : "none",
              }}
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{
                  color: TONE_COLOR[t.tone],
                  border: `1.5px solid ${TONE_COLOR[t.tone]}`,
                  background: "var(--surface-card)",
                  boxShadow: `0 0 12px color-mix(in oklab, ${TONE_COLOR[t.tone]} 27%, transparent), inset 0 0 10px color-mix(in oklab, ${TONE_COLOR[t.tone]} 13%, transparent)`,
                }}
                aria-hidden
              >
                <Icon name={TONE_ICON[t.tone]} size={19} />
              </span>
              <span
                style={{ font: "var(--type-body)", color: "var(--text-1)" }}
              >
                {t.text}
              </span>
            </div>
          ))}

          {/* §4 Gameplan- & Drill-Vorschläge */}
          {suggestions.length > 0 && (
            <div
              className={tendencies.length > 0 ? "mt-2 border-t pt-3" : ""}
              style={{ borderColor: "var(--line)" }}
            >
              <div className="mb-2 t-label">Vorschläge · frei anpassbar</div>
              <div className="flex flex-col gap-2">
                {suggestions.map((s) => (
                  <div key={s.id} className="flex items-start gap-2">
                    {/* Das Schild sagt „Drill" oder „Plan" — das ist der
                        Unterschied. Zwei Farben daneben wären dieselbe
                        Auskunft ein zweites Mal. */}
                    <span
                      className="mt-0.5 shrink-0 rounded-badge px-1.5 py-0.5"
                      style={{
                        ...META_FONT,
                        background: "var(--surface-raised)",
                        border: "1px solid var(--line)",
                        color: "var(--text-2)",
                      }}
                    >
                      {s.kind === "drill" ? "Drill" : "Plan"}
                    </span>
                    <span
                      style={{ font: "var(--type-body)", color: "var(--text-1)" }}
                    >
                      {s.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Haarlinie zwischen Insights und Käfig-Karte, wenn beide in derselben
          Fläche liegen */}
      {hasInsightCard && showZones && zoneTotal > 0 && (
        <div aria-hidden style={{ height: "1px", background: "var(--line)" }} />
      )}

      {/* §5 Käfig-Karte — Hero-Zahl mit Glow + Neon-Octagon */}
      {showZones &&
        zoneTotal > 0 &&
        (() => {
          const order = (["cage", "open", "center"] as CageZone[]).sort(
            (a, b) => zones[b] - zones[a],
          );
          const dom = order[0];
          const domPct = Math.round((zones[dom] / zoneTotal) * 100);
          return (
            <div>
              <div className="flex items-center gap-4">
                <div className="relative min-w-0 flex-1">
                  {/* Speed-Lines hinter der Hero-Zahl */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-0 top-3 h-14 w-full"
                    style={{
                      background: `repeating-linear-gradient(90deg, ${heat(0.1)} 0 3px, transparent 3px 15px)`,
                      transform: "skewX(-24deg)",
                      maskImage:
                        "linear-gradient(90deg, transparent, black 25%, black 60%, transparent 95%)",
                      WebkitMaskImage:
                        "linear-gradient(90deg, transparent, black 25%, black 60%, transparent 95%)",
                    }}
                  />
                  {/* Bewusst GRÖSSER als jede Stufe der Typo-Skala: Die Zahl
                      ist hier die Aussage, nicht eine Überschrift (Leons
                      Käfig-Karten-Vorlage). Als Shorthand auf der Body-Schrift
                      formuliert — dasselbe Muster wie `.join-slot` in
                      globals.css, wo ein Hero-Element ebenfalls ein eigenes
                      clamp() trägt. */}
                  <div
                    className="relative"
                    style={{
                      font: "800 clamp(54px, 11vw, 82px)/1 var(--font-body)",
                      fontVariantNumeric: "tabular-nums",
                      color: "var(--accent)",
                      textShadow: `0 0 28px ${heat(0.5)}`,
                    }}
                  >
                    {domPct}
                    <span style={{ fontSize: "0.52em" }}>%</span>
                  </div>
                  <div
                    className="mt-1"
                    style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
                  >
                    der Aktionen
                  </div>
                  <div
                    style={{
                      font: "var(--type-body-strong)",
                      color: "var(--text-1)",
                    }}
                  >
                    {phrase?.[dom]}
                  </div>
                  <div className="mt-3 flex flex-col gap-1.5">
                    {order.slice(1).map((z, i) => (
                      <div
                        key={z}
                        className="flex items-center gap-2"
                        style={{ opacity: zones[z] > 0 ? 1 : 0.5 }}
                      >
                        <span
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{
                            // Rang-Leiter wie im Octagon: Platz 2 heller als Platz 3
                            background:
                              zones[z] > 0
                                ? heat(i === 0 ? 0.6 : 0.3)
                                : "var(--line)",
                          }}
                          aria-hidden
                        />
                        <span
                          style={{
                            font: "var(--type-sub)",
                            fontVariantNumeric: "tabular-nums",
                            color: "var(--text-2)",
                          }}
                        >
                          {Math.round((zones[z] / zoneTotal) * 100)}%
                        </span>
                        <span
                          style={{
                            font: "var(--type-sub)",
                            color: "var(--text-3)",
                          }}
                        >
                          {label?.[z]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <CageHeatmap zones={zones} total={zoneTotal} seiten={kartenSeiten(flaeche)} flaeche={begriffe(sport, flaeche).flaeche} />
              </div>
            </div>
          );
        })()}
    </div>
  );
}

// ─── §5 Käfig-Karte (SVG) ────────────────────────────────────────────────────

/**
 * Form der Karte je Fläche des Videos (Leon 17.09.2026): Käfig = Achteck,
 * Ring = Quadrat, Matte = Kreis (48 Ecken). Ohne erkannte Fläche bleibt das
 * Achteck, das Leon als Karte kennt.
 */
function kartenSeiten(flaeche: Flaeche | null): number {
  if (flaeche === "ring") return 4;
  if (flaeche === "matte") return 48;
  return 8;
}

/** Punkte eines regelmäßigen Vielecks (Seite unten waagrecht) mit Radius r um (50,50). */
function octagon(r: number, seiten = 8): string {
  const pts: string[] = [];
  const schritt = 360 / seiten;
  for (let k = 0; k < seiten; k++) {
    const a = ((schritt / 2 + k * schritt) * Math.PI) / 180;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

/** Vieleck als Pfad-Subpath — für Ring-Füllungen (außen minus innen). */
function octagonPathD(r: number, seiten = 8): string {
  return `M${octagon(r, seiten).split(" ").join("L")}Z`;
}

function CageHeatmap({
  zones,
  total,
  seiten,
  flaeche,
}: {
  zones: Record<CageZone, number>;
  total: number;
  /** 8 = Käfig, 4 = Ring, 48 = Matte (kartenSeiten). */
  seiten: number;
  /** „Käfig", „Ring", „Matte" — für die Bildbeschreibung. */
  flaeche: string;
}) {
  // Neon-Look: Deckkraft streng nach RANG — hellster Ring = größter Anteil,
  // zweithellster = zweitgrößter, schwächster = kleinster (0 % bleibt leer).
  // Die Ringe sind echte Ringe (Pfad mit Loch), damit sich die Flächen nicht
  // stapeln und die wahrgenommene Helligkeit wirklich der Rangfolge folgt.
  // Die dominante Zone trägt zusätzlich die glühende Akzent-Kontur.
  //
  // FARBEN LIEGEN IM `style`, NICHT IM ATTRIBUT: `fill="…"` ist eine
  // Präsentations-Attribut-Kurzform, und `color-mix()` darin ist nicht überall
  // verlässlich geparst. Als CSS-Deklaration ist es eindeutig.
  const share = (z: CageZone) => (total > 0 ? zones[z] / total : 0);
  const ranked = (["cage", "open", "center"] as CageZone[]).sort(
    (a, b) => zones[b] - zones[a],
  );
  const RANK_ALPHA = [0.5, 0.2, 0.08];
  const fill = (z: CageZone) =>
    zones[z] > 0 ? heat(RANK_ALPHA[ranked.indexOf(z)]) : "none";
  const dominant = ranked[0];
  const isDom = (z: CageZone) => z === dominant && zones[z] > 0;
  const outline = (z: CageZone): React.CSSProperties =>
    isDom(z)
      ? {
          fill: "none",
          stroke: "var(--accent)",
          strokeWidth: 2,
          filter: `drop-shadow(0 0 4px ${heat(0.9)}) drop-shadow(0 0 12px ${heat(0.45)})`,
        }
      : {
          fill: "none",
          stroke: "var(--line-strong)",
          strokeWidth: 0.75,
        };
  /**
   * DIE DOMINANTE ZAHL STEHT IN DER TEXTFARBE, NICHT IM AKZENT — nachgemessen
   * am 04.09.2026 per Canvas-Pixel (getComputedStyle gibt oklch() unaufgelöst
   * zurück, also ist Malen die einzige ehrliche Messung).
   *
   * Sie sitzt IM gefüllten Ring, und dessen Fläche ist der Akzent bei halber
   * Deckkraft — in beiden Themes ein Mittelton. Akzentfarbe darauf ergab
   * **3,18:1 im Dunkeln und 2,35:1 im Hellen**; bei 14 px fett verlangt WCAG AA
   * 4,5:1. Der Wert war schon vor dem Umbau zu niedrig (dort lag das helle
   * Tidal-Cyan auf demselben Halbton) — er fällt hier nur auf, weil die Stelle
   * ohnehin angefasst wurde.
   *
   * `--text-1` trägt in BEIDEN Themes: hell 6,1:1, dunkel 5,5:1 — die
   * Textfarbe ist per Definition die, die gegen jede Fläche des Systems steht.
   * Verloren geht dabei nichts: Die dominante Zone ist schon an drei anderen
   * Merkmalen zu erkennen — größere Schrift, fetterer Schnitt und die glühende
   * Akzent-Kontur um ihren Ring. Die Farbe war das vierte und einzige, das
   * Lesbarkeit gekostet hat.
   */
  const label = (z: CageZone, y: number) => (
    <text
      x={50}
      y={y}
      textAnchor="middle"
      fontSize={isDom(z) ? 8.4 : 6.6}
      fontWeight={isDom(z) ? 700 : 400}
      style={{
        fontFamily: "var(--font-mono)",
        fill:
          zones[z] === 0
            ? "var(--text-3)"
            : isDom(z)
              ? "var(--text-1)"
              : "var(--text-2)",
      }}
    >
      {Math.round(share(z) * 100)}%
    </text>
  );

  return (
    <svg
      width="172"
      height="172"
      viewBox="0 0 100 100"
      role="img"
      aria-label={`Karte ${flaeche}: Verteilung der Aktionen nach Zone`}
      style={{ overflow: "visible", flexShrink: 0 }}
    >
      {/* Cage-Ring (äußerste Zone) — Ring mit Loch, keine Stapelung */}
      <path
        d={`${octagonPathD(44, seiten)} ${octagonPathD(30, seiten)}`}
        fillRule="evenodd"
        style={{ fill: fill("cage") }}
      />
      {/* Open-Ring */}
      <path
        d={`${octagonPathD(30, seiten)} ${octagonPathD(15, seiten)}`}
        fillRule="evenodd"
        style={{ fill: fill("open") }}
      />
      {/* Center */}
      <polygon points={octagon(15, seiten)} style={{ fill: fill("center") }} />
      {/* Konturen — die dominante Zone glüht */}
      <polygon points={octagon(44, seiten)} style={outline("cage")} />
      <polygon points={octagon(30, seiten)} style={outline("open")} />
      <polygon points={octagon(15, seiten)} style={outline("center")} />
      {/* Prozente: Cage über dem Ring, Open im Band, Center mittig */}
      {label("cage", 5.8)}
      {label("open", 33.2)}
      {label("center", 52.6)}
    </svg>
  );
}
