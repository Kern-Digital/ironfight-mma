"use client";

import {
  CAGE_ZONE_LABEL,
  CAGE_ZONE_PHRASE,
  deriveSuggestions,
  deriveTendencies,
  zoneDistribution,
  type ActionStat,
  type CageZone,
  type DnaSplit,
  type TendencyTone,
} from "@/lib/fight-stats";
import Icon, { type IconName } from "@/components/ui/Icon";

// Ton-Farben als Hex, damit Glow-Schatten (#RRGGBBAA) daraus ableitbar sind.
const TONE_COLOR: Record<TendencyTone, string> = {
  weapon: "#8A63E8",
  success: "#3EE06B",
  zone: "#23C4CE",
  setup: "#9D7BFA",
  warning: "#FF4FA8",
};

const TONE_ICON: Record<TendencyTone, IconName> = {
  weapon: "glove",
  success: "target",
  zone: "check",
  setup: "spark",
  warning: "warn",
};

/** Gemeinsame Karten-Fläche der Insight-Panels (siehe Referenz-Design). */
const CARD_STYLE: React.CSSProperties = {
  background: "linear-gradient(180deg, var(--ink-2), var(--ink-1))",
  border: "1px solid var(--ink-4)",
};

/**
 * Heat-Prinzip der Käfig-Karte: EINE Farbe (Cyan), Deckkraft = Anteil —
 * „kräftiger = mehr" braucht keine Legende. 0 % bleibt bewusst ungefüllt.
 */
const HEAT_RGB = "35,196,206"; // --ta-cyan

/** Kleiner Info-Punkt oben rechts in den Karten (Tooltip via title). */
function InfoDot({ text }: { text: string }) {
  return (
    <span
      className="font-mono-ta flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]"
      title={text}
      style={{ border: "1px solid var(--ink-6)", color: "var(--fg-4)" }}
    >
      i
    </span>
  );
}

/**
 * §3 Tendenzen + §4 Vorschläge + §5 Käfig-Karte.
 *
 * Rein abgeleitete Read-Ansicht: berechnet sich vollständig aus Split + Stats.
 * Rendert nichts, wenn keine Datengrundlage vorhanden ist.
 */
export default function FightInsights({
  split,
  stats,
}: {
  split: DnaSplit | null | undefined;
  stats: ActionStat[];
}) {
  const tendencies = deriveTendencies(stats);
  const suggestions = deriveSuggestions(split, stats);
  const zones = zoneDistribution(stats);
  const zoneTotal = zones.center + zones.open + zones.cage;

  if (tendencies.length === 0 && suggestions.length === 0 && zoneTotal === 0)
    return null;

  return (
    <div className="flex flex-col gap-4">
      {/* §3 Auto-Insights — Icon-Badges mit Glow, Trennlinien zwischen den Zeilen */}
      {(tendencies.length > 0 || suggestions.length > 0) && (
        <div className="rounded-2xl p-4 sm:p-5" style={CARD_STYLE}>
          <div className="mb-1 flex items-center justify-between">
            <div
              className="font-mono-ta text-[11px] font-bold uppercase"
              style={{ letterSpacing: "0.2em", color: "var(--ta-cyan)" }}
            >
              Auto-Insights
            </div>
            <InfoDot text="Automatisch abgeleitet aus Fight-DNA-Split und Technik-Statistik." />
          </div>

          {tendencies.map((t, i) => (
            <div
              key={t.id}
              className="flex items-center gap-3.5 py-3"
              style={{
                borderTop: i > 0 ? "1px dashed rgba(255,255,255,0.10)" : "none",
              }}
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{
                  color: TONE_COLOR[t.tone],
                  border: `1.5px solid ${TONE_COLOR[t.tone]}`,
                  background: "var(--ink-1)",
                  boxShadow: `0 0 12px ${TONE_COLOR[t.tone]}44, inset 0 0 10px ${TONE_COLOR[t.tone]}22`,
                }}
                aria-hidden
              >
                <Icon name={TONE_ICON[t.tone]} size={19} />
              </span>
              <span className="text-sm leading-relaxed" style={{ color: "var(--fg)" }}>
                {t.text}
              </span>
            </div>
          ))}

          {/* §4 Gameplan- & Drill-Vorschläge */}
          {suggestions.length > 0 && (
            <div
              className={tendencies.length > 0 ? "mt-2 border-t pt-3" : ""}
              style={{ borderColor: "var(--ink-4)" }}
            >
              <div
                className="font-mono-ta mb-2 text-[10px] uppercase"
                style={{ letterSpacing: "0.15em", color: "var(--fg-4)" }}
              >
                Vorschläge · frei anpassbar
              </div>
              <div className="flex flex-col gap-2">
                {suggestions.map((s) => (
                  <div key={s.id} className="flex items-start gap-2">
                    <span
                      className="font-mono-ta mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                      style={{
                        letterSpacing: "0.08em",
                        background:
                          s.kind === "drill"
                            ? "rgba(35,196,206,0.12)"
                            : "rgba(255,79,168,0.12)",
                        border: `1px solid ${s.kind === "drill" ? "var(--ta-cyan)" : "var(--ta-pink)"}`,
                        color: s.kind === "drill" ? "var(--ta-cyan)" : "var(--ta-pink)",
                      }}
                    >
                      {s.kind === "drill" ? "Drill" : "Plan"}
                    </span>
                    <span
                      className="text-sm leading-relaxed"
                      style={{ color: "var(--fg)" }}
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

      {/* §5 Käfig-Karte — Hero-Zahl mit Glow + Neon-Octagon */}
      {zoneTotal > 0 &&
        (() => {
          const order = (["cage", "open", "center"] as CageZone[]).sort(
            (a, b) => zones[b] - zones[a],
          );
          const dom = order[0];
          const domPct = Math.round((zones[dom] / zoneTotal) * 100);
          return (
            <div className="rounded-2xl p-4 sm:p-5" style={CARD_STYLE}>
              <div
                className="font-mono-ta text-[12px] font-bold uppercase"
                style={{ letterSpacing: "0.2em", color: "var(--ta-cyan)" }}
              >
                Wo passiert die Aktion
              </div>
              <div className="mt-3 flex items-center gap-4">
                <div className="relative min-w-0 flex-1">
                  {/* Speed-Lines hinter der Hero-Zahl */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-0 top-3 h-14 w-full"
                    style={{
                      background:
                        "repeating-linear-gradient(90deg, rgba(35,196,206,0.10) 0 3px, transparent 3px 15px)",
                      transform: "skewX(-24deg)",
                      maskImage:
                        "linear-gradient(90deg, transparent, black 25%, black 60%, transparent 95%)",
                      WebkitMaskImage:
                        "linear-gradient(90deg, transparent, black 25%, black 60%, transparent 95%)",
                    }}
                  />
                  <div
                    className="font-display-ta relative font-bold leading-none"
                    style={{
                      fontSize: "clamp(54px, 11vw, 82px)",
                      color: "var(--ta-cyan)",
                      textShadow: "0 0 28px rgba(35,196,206,0.5)",
                    }}
                  >
                    {domPct}
                    <span style={{ fontSize: "0.52em" }}>%</span>
                  </div>
                  <div className="mt-1 text-sm" style={{ color: "var(--fg-3)" }}>
                    der Aktionen
                  </div>
                  <div
                    className="text-base font-bold"
                    style={{ color: "var(--fg)" }}
                  >
                    {CAGE_ZONE_PHRASE[dom]}
                  </div>
                  <div className="mt-3 flex flex-col gap-1.5">
                    {order.slice(1).map((z) => (
                      <div
                        key={z}
                        className="flex items-center gap-2"
                        style={{ opacity: zones[z] > 0 ? 1 : 0.5 }}
                      >
                        <span
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{
                            background:
                              zones[z] > 0
                                ? `rgba(${HEAT_RGB},${0.25 + 0.6 * (zones[z] / zoneTotal)})`
                                : "rgba(255,255,255,0.10)",
                          }}
                          aria-hidden
                        />
                        <span
                          className="font-mono-ta text-xs tabular-nums"
                          style={{ color: "var(--fg-2)" }}
                        >
                          {Math.round((zones[z] / zoneTotal) * 100)}%
                        </span>
                        <span className="text-xs" style={{ color: "var(--fg-3)" }}>
                          {CAGE_ZONE_LABEL[z]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <CageHeatmap zones={zones} total={zoneTotal} />
              </div>
            </div>
          );
        })()}
    </div>
  );
}

// ─── §5 Käfig-Karte (SVG) ────────────────────────────────────────────────────

/** Punkte eines regelmäßigen Octagons mit Radius r um den Mittelpunkt (50,50). */
function octagon(r: number): string {
  const pts: string[] = [];
  for (let k = 0; k < 8; k++) {
    const a = ((22.5 + k * 45) * Math.PI) / 180;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

function CageHeatmap({
  zones,
  total,
}: {
  zones: Record<CageZone, number>;
  total: number;
}) {
  // Neon-Look: Füllungen bleiben zurückhaltend (Deckkraft = Anteil), die
  // dominante Zone trägt die glühende Cyan-Kontur. Prozente stehen direkt
  // an den Zonen; der Cage-Wert sitzt über dem äußeren Ring.
  const share = (z: CageZone) => (total > 0 ? zones[z] / total : 0);
  const fill = (z: CageZone) =>
    share(z) > 0
      ? `rgba(${HEAT_RGB},${(0.08 + 0.3 * share(z)).toFixed(3)})`
      : "none";
  const dominant = (["cage", "open", "center"] as CageZone[]).reduce((a, b) =>
    zones[b] > zones[a] ? b : a,
  );
  const isDom = (z: CageZone) => z === dominant && zones[z] > 0;
  const outline = (z: CageZone) =>
    isDom(z)
      ? { stroke: "var(--ta-cyan)", width: 2 }
      : { stroke: "rgba(140,210,220,0.28)", width: 0.75 };
  const glow = (z: CageZone): React.CSSProperties | undefined =>
    isDom(z)
      ? {
          filter:
            "drop-shadow(0 0 4px rgba(35,196,206,0.9)) drop-shadow(0 0 12px rgba(35,196,206,0.45))",
        }
      : undefined;
  const label = (z: CageZone, y: number) => (
    <text
      x={50}
      y={y}
      textAnchor="middle"
      fontSize={isDom(z) ? 8.4 : 6.6}
      fontWeight={isDom(z) ? 700 : 400}
      fill={
        zones[z] === 0
          ? "var(--fg-4)"
          : isDom(z)
            ? "var(--ta-cyan-bright)"
            : "var(--fg-2)"
      }
      style={{ fontFamily: "var(--font-mono)" }}
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
      aria-label="Käfig-Karte: Verteilung der Aktionen nach Zone"
      style={{ overflow: "visible", flexShrink: 0 }}
    >
      {/* Cage-Ring (äußerste Zone) */}
      <polygon points={octagon(44)} fill={fill("cage")} />
      {/* Open-Ring */}
      <polygon points={octagon(30)} fill={fill("open")} />
      {/* Center */}
      <polygon points={octagon(15)} fill={fill("center")} />
      {/* Konturen — die dominante Zone glüht */}
      <polygon
        points={octagon(44)}
        fill="none"
        stroke={outline("cage").stroke}
        strokeWidth={outline("cage").width}
        style={glow("cage")}
      />
      <polygon
        points={octagon(30)}
        fill="none"
        stroke={outline("open").stroke}
        strokeWidth={outline("open").width}
        style={glow("open")}
      />
      <polygon
        points={octagon(15)}
        fill="none"
        stroke={outline("center").stroke}
        strokeWidth={outline("center").width}
        style={glow("center")}
      />
      {/* Prozente: Cage über dem Ring, Open im Band, Center mittig */}
      {label("cage", 5.8)}
      {label("open", 33.2)}
      {label("center", 52.6)}
    </svg>
  );
}
