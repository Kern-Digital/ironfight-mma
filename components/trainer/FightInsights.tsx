"use client";

import {
  CAGE_ZONE_LABEL,
  deriveSuggestions,
  deriveTendencies,
  zoneDistribution,
  type ActionStat,
  type CageZone,
  type DnaSplit,
  type TendencyTone,
} from "@/lib/fight-stats";

const TONE_COLOR: Record<TendencyTone, string> = {
  weapon: "#8A63E8",
  success: "#3EE06B",
  zone: "var(--ta-cyan)",
  setup: "#9D7BFA",
  warning: "var(--ta-pink)",
};

/**
 * Heat-Prinzip der Käfig-Karte: EINE Farbe (Cyan), Deckkraft = Anteil —
 * „kräftiger = mehr" braucht keine Legende. 0 % bleibt bewusst ungefüllt.
 */
const HEAT_RGB = "35,196,206"; // --ta-cyan

const heatAlpha = (share: number) => (share > 0 ? 0.16 + 0.62 * share : 0);

/** Ortsangabe für die Hero-Zeile („54 % der Aktionen im offenen Raum"). */
const ZONE_PHRASE: Record<CageZone, string> = {
  center: "im Center",
  open: "im offenen Raum",
  cage: "am Cage",
};

/**
 * §3 Tendenzen + §4 Vorschläge + §5 Käfig-Heatmap.
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
    <div>
      <div
        className="font-mono-ta mb-3 text-[10px] font-bold uppercase"
        style={{ letterSpacing: "0.2em", color: "var(--ta-cyan)" }}
      >
        Auto-Insights
      </div>

      {/* §3 Tendenzen */}
      {tendencies.length > 0 && (
        <div className="flex flex-col gap-2">
          {tendencies.map((t) => (
            <div key={t.id} className="flex items-start gap-2">
              <span
                className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: TONE_COLOR[t.tone] }}
              />
              <span className="text-sm leading-relaxed" style={{ color: "var(--fg-1)" }}>
                {t.text}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* §5 Käfig-Karte — Hero-Zahl + Heat-Octagon (Aussage zuerst) */}
      {zoneTotal > 0 &&
        (() => {
          const order = (["cage", "open", "center"] as CageZone[]).sort(
            (a, b) => zones[b] - zones[a],
          );
          const dom = order[0];
          const domPct = Math.round((zones[dom] / zoneTotal) * 100);
          return (
            <div className="mt-4">
              <div
                className="font-mono-ta text-[10px] uppercase"
                style={{ letterSpacing: "0.15em", color: "var(--fg-4)" }}
              >
                Wo passiert die Aktion
              </div>
              <div className="mt-2 flex items-center gap-5">
                <div className="min-w-0 flex-1">
                  <div
                    className="font-mono-ta text-[40px] font-bold leading-none"
                    style={{ color: "var(--ta-cyan)", letterSpacing: "-0.02em" }}
                  >
                    {domPct}
                    <span className="text-[22px]" style={{ color: "var(--fg)" }}>
                      %
                    </span>
                  </div>
                  <div className="mt-1 text-sm" style={{ color: "var(--fg-3)" }}>
                    der Aktionen{" "}
                    <span style={{ color: "var(--fg)", fontWeight: 600 }}>
                      {ZONE_PHRASE[dom]}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-col gap-1">
                    {order.slice(1).map((z) => (
                      <div
                        key={z}
                        className="flex items-center gap-2"
                        style={{ opacity: zones[z] > 0 ? 1 : 0.5 }}
                      >
                        <span
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{
                            background:
                              zones[z] > 0
                                ? `rgba(${HEAT_RGB},${heatAlpha(zones[z] / zoneTotal)})`
                                : "rgba(255,255,255,0.08)",
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

      {/* §4 Gameplan- & Drill-Vorschläge */}
      {suggestions.length > 0 && (
        <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--ink-4)" }}>
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
                    background: s.kind === "drill" ? "rgba(35,196,206,0.12)" : "rgba(255,79,168,0.12)",
                    border: `1px solid ${s.kind === "drill" ? "var(--ta-cyan)" : "var(--ta-pink)"}`,
                    color: s.kind === "drill" ? "var(--ta-cyan)" : "var(--ta-pink)",
                  }}
                >
                  {s.kind === "drill" ? "Drill" : "Plan"}
                </span>
                <span className="text-sm leading-relaxed" style={{ color: "var(--fg-1)" }}>
                  {s.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── §5 Käfig-Heatmap (SVG) ──────────────────────────────────────────────────

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
  // Heat-Prinzip: eine Farbe, Deckkraft = Anteil; 0 % bleibt ungefüllt.
  // Die Prozente stehen direkt in den Zonen (vertikale Lese-Achse), die
  // dominante Zone bekommt die helle Kontur und die fette Zahl.
  const share = (z: CageZone) => (total > 0 ? zones[z] / total : 0);
  const fill = (z: CageZone) =>
    share(z) > 0 ? `rgba(${HEAT_RGB},${heatAlpha(share(z)).toFixed(3)})` : "none";
  const dominant = (["cage", "open", "center"] as CageZone[]).reduce((a, b) =>
    zones[b] > zones[a] ? b : a,
  );
  const outline = (z: CageZone) =>
    z === dominant && zones[z] > 0
      ? { stroke: "var(--ta-cyan-bright)", width: 1.5 }
      : { stroke: "rgba(255,255,255,0.14)", width: 0.75 };
  // Auf kräftiger Füllung (dominant ab 50 %) liest sich dunkle Schrift besser.
  const labelColor = (z: CageZone) => {
    if (zones[z] === 0) return "var(--fg-4)";
    if (z === dominant) return share(z) >= 0.5 ? "#07040D" : "var(--fg)";
    return "var(--fg-2)";
  };
  const label = (z: CageZone, x: number, y: number) => (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize={z === dominant ? 8.4 : 6.8}
      fontWeight={z === dominant ? 700 : 400}
      fill={labelColor(z)}
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {Math.round(share(z) * 100)}%
    </text>
  );

  return (
    <svg
      width="128"
      height="128"
      viewBox="0 0 100 100"
      role="img"
      aria-label="Käfig-Karte: Verteilung der Aktionen nach Zone"
    >
      {/* Cage-Ring (äußerste Zone) */}
      <polygon points={octagon(44)} fill={fill("cage")} />
      {/* Open-Ring */}
      <polygon points={octagon(30)} fill={fill("open")} />
      {/* Center */}
      <circle cx="50" cy="50" r="15" fill={fill("center")} />
      {/* Konturen — die dominante Zone wird hell hervorgehoben */}
      <polygon
        points={octagon(44)}
        fill="none"
        stroke={outline("cage").stroke}
        strokeWidth={outline("cage").width}
      />
      <polygon
        points={octagon(30)}
        fill="none"
        stroke={outline("open").stroke}
        strokeWidth={outline("open").width}
      />
      <circle
        cx="50"
        cy="50"
        r="15"
        fill="none"
        stroke={outline("center").stroke}
        strokeWidth={outline("center").width}
      />
      {/* Prozente in den Zonen: Cage-Band oben, Open-Band darunter, Center mittig */}
      {label("cage", 50, 19)}
      {label("open", 50, 32.8)}
      {label("center", 50, 52.6)}
    </svg>
  );
}
