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
 * Feste Zonen-Farben (RGB-Tripel) — Heatmap und Prozent-Legende nutzen
 * dieselbe Farbe je Zone, damit sich Anteil und Ort direkt zuordnen lassen.
 */
const ZONE_RGB: Record<CageZone, string> = {
  center: "35,196,206", // Cyan — innerer Kreis
  open: "157,123,250", // Violett — mittlerer Ring
  cage: "255,79,168", // Pink — äußerer Ring
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

      {/* §5 Käfig-Heatmap */}
      {zoneTotal > 0 && (
        <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-4">
          <CageHeatmap zones={zones} total={zoneTotal} />
          <div className="flex flex-col gap-1.5">
            <div
              className="font-mono-ta text-[10px] uppercase"
              style={{ letterSpacing: "0.15em", color: "var(--fg-4)" }}
            >
              Wo passiert die Aktion
            </div>
            {(["cage", "open", "center"] as CageZone[])
              .sort((a, b) => zones[b] - zones[a])
              .map((z, i) => {
                const dominant = i === 0 && zones[z] > 0;
                return (
                  <div
                    key={z}
                    className="flex items-center gap-2"
                    style={{ opacity: zones[z] > 0 ? 1 : 0.45 }}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ background: `rgb(${ZONE_RGB[z]})` }}
                      aria-hidden
                    />
                    <span
                      className="font-mono-ta w-9 text-right text-xs"
                      style={{
                        color: `rgb(${ZONE_RGB[z]})`,
                        fontWeight: dominant ? 700 : 400,
                      }}
                    >
                      {Math.round((zones[z] / zoneTotal) * 100)}%
                    </span>
                    <span
                      className="text-xs"
                      style={{
                        color: dominant ? "var(--fg-1)" : "var(--fg-2)",
                        fontWeight: dominant ? 700 : 400,
                      }}
                    >
                      {CAGE_ZONE_LABEL[z]}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

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
  // Jede Zone hat ihre feste Farbe (siehe ZONE_RGB); der Anteil steuert die
  // Deckkraft. Die dominante Zone bekommt zusätzlich eine kräftige Kontur.
  const share = (z: CageZone) => (total > 0 ? zones[z] / total : 0);
  const alpha = (z: CageZone) => 0.14 + 0.7 * share(z);
  const dominant = (["cage", "open", "center"] as CageZone[]).reduce((a, b) =>
    zones[b] > zones[a] ? b : a,
  );
  const outline = (z: CageZone) =>
    z === dominant && zones[z] > 0
      ? { stroke: `rgb(${ZONE_RGB[z]})`, width: 2 }
      : { stroke: "rgba(255,255,255,0.14)", width: 0.75 };

  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 100 100"
      role="img"
      aria-label="Käfig-Heatmap: Verteilung der Aktionen nach Zone"
    >
      {/* Cage-Ring (äußerste Zone) */}
      <polygon points={octagon(44)} fill={`rgba(${ZONE_RGB.cage},${alpha("cage")})`} />
      {/* Open-Ring */}
      <polygon points={octagon(30)} fill={`rgba(${ZONE_RGB.open},${alpha("open")})`} />
      {/* Center */}
      <circle cx="50" cy="50" r="15" fill={`rgba(${ZONE_RGB.center},${alpha("center")})`} />
      {/* Konturen — die dominante Zone wird farbig hervorgehoben */}
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
    </svg>
  );
}
