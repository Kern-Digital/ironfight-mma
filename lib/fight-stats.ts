/**
 * Fight-Stats — quantitative Gegner-Analyse (Ergänzung zur qualitativen Gegner-DNA).
 *
 * Während `gegner-dna.ts` Freitext-Scouting abbildet, modelliert diese Datei den
 * messbaren Teil aus dem App-Konzept:
 *   §1 Fight-DNA-Split  → prozentuale Verteilung der Kampfbereiche (Boxen/Kick/…)
 *   §2 Action-Stats     → gezählte Techniken: Versuche, Treffer, Käfig-Zone, Setup
 *   §3 Tendenzen        → aus den Zahlen abgeleitete Klartext-Erkenntnisse
 *   §4 Vorschläge       → Gameplan-/Drill-Empfehlungen aus den Tendenzen
 *   §5 Zonen-Aggregation→ Käfig-Heatmap-Daten (Center / Open / Cage)
 *
 * Alles ist eine reine, erklärbare Heuristik (kein KI-System). Eingabe erfolgt
 * manuell durch den Trainer beim Videoschauen. IDs sind stabil — niemals ändern.
 */

import { FIGHT_FAMILY_COLOR } from "@/lib/discipline-colors";

// ─── §1 Fight-DNA-Split ──────────────────────────────────────────────────────

/** Prozentuale Verteilung der Kampfbereiche eines Gegners (Summe ~100). */
export interface DnaSplit {
  boxing: number;
  kicking: number;
  wrestling: number;
  ground: number;
  clinch: number;
}

export type DnaSplitKey = keyof DnaSplit;

export const DNA_SPLIT_KEYS: DnaSplitKey[] = [
  "boxing",
  "kicking",
  "wrestling",
  "ground",
  "clinch",
];

export const DNA_SPLIT_META: Record<
  DnaSplitKey,
  { label: string; color: string }
> = {
  // Farben kommen zentral aus lib/discipline-colors.ts — eine Rubrik hat
  // app-weit immer dieselbe Farbe, und ein Chart nie zwei ähnliche Töne.
  boxing: { label: "Boxen", color: FIGHT_FAMILY_COLOR.striking },
  kicking: { label: "Kicks", color: FIGHT_FAMILY_COLOR.kicks },
  wrestling: { label: "Wrestling", color: FIGHT_FAMILY_COLOR.wrestling },
  ground: { label: "Boden", color: FIGHT_FAMILY_COLOR.ground },
  clinch: { label: "Clinch", color: FIGHT_FAMILY_COLOR.clinch },
};

export const EMPTY_DNA_SPLIT: DnaSplit = {
  boxing: 0,
  kicking: 0,
  wrestling: 0,
  ground: 0,
  clinch: 0,
};

/** Summe aller Split-Werte. */
export function dnaSplitTotal(split: DnaSplit): number {
  return DNA_SPLIT_KEYS.reduce((sum, k) => sum + (split[k] || 0), 0);
}

/** True, wenn kein einziger Split-Wert gesetzt ist. */
export function isDnaSplitEmpty(split: DnaSplit | undefined | null): boolean {
  if (!split) return true;
  return dnaSplitTotal(split) === 0;
}

/** Normiert die Werte auf Prozent (0..100) relativ zur Gesamtsumme. */
export function normalizeDnaSplit(split: DnaSplit): Record<DnaSplitKey, number> {
  const total = dnaSplitTotal(split);
  const out = {} as Record<DnaSplitKey, number>;
  for (const k of DNA_SPLIT_KEYS) {
    out[k] = total > 0 ? Math.round(((split[k] || 0) / total) * 100) : 0;
  }
  return out;
}

/** Säubert einen Split für Firestore — clampt auf 0..100, ganze Zahlen. */
export function cleanDnaSplit(split: DnaSplit | undefined | null): DnaSplit {
  if (!split) return { ...EMPTY_DNA_SPLIT };
  const out = { ...EMPTY_DNA_SPLIT };
  for (const k of DNA_SPLIT_KEYS) {
    const v = Number(split[k]);
    out[k] = Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : 0;
  }
  return out;
}

// ─── §2 Action-Stats ─────────────────────────────────────────────────────────

export type ActionGroup = "strike" | "kick" | "takedown" | "ground";

export const ACTION_GROUP_META: Record<
  ActionGroup,
  { label: string; color: string }
> = {
  strike: { label: "Schläge", color: FIGHT_FAMILY_COLOR.striking },
  kick: { label: "Kicks", color: FIGHT_FAMILY_COLOR.kicks },
  takedown: { label: "Takedowns", color: FIGHT_FAMILY_COLOR.wrestling },
  ground: { label: "Boden", color: FIGHT_FAMILY_COLOR.ground },
};

export interface ActionDef {
  /** Stabile ID — NIEMALS ändern. */
  id: string;
  label: string;
  group: ActionGroup;
}

/** Technik-Katalog (aus Konzept §4 & §7). */
export const ACTION_CATALOG: ActionDef[] = [
  // Schläge
  { id: "jab", label: "Jab", group: "strike" },
  { id: "cross", label: "Cross", group: "strike" },
  { id: "hook", label: "Hook", group: "strike" },
  { id: "uppercut", label: "Uppercut", group: "strike" },
  { id: "overhand", label: "Overhand", group: "strike" },
  { id: "elbow", label: "Ellbogen", group: "strike" },
  // Kicks & Knie
  { id: "low-kick", label: "Low Kick", group: "kick" },
  { id: "body-kick", label: "Body Kick", group: "kick" },
  { id: "high-kick", label: "High Kick", group: "kick" },
  { id: "front-kick", label: "Front Kick (Teep)", group: "kick" },
  { id: "knee", label: "Knie", group: "kick" },
  // Takedowns
  { id: "single-leg", label: "Single Leg", group: "takedown" },
  { id: "double-leg", label: "Double Leg", group: "takedown" },
  { id: "body-lock", label: "Body Lock", group: "takedown" },
  { id: "trip", label: "Trip / Fußfeger", group: "takedown" },
  { id: "throw", label: "Wurf (Judo)", group: "takedown" },
  // Boden
  { id: "pass", label: "Guard Pass", group: "ground" },
  { id: "sweep", label: "Sweep", group: "ground" },
  { id: "submission", label: "Submission-Versuch", group: "ground" },
  { id: "ground-strikes", label: "Ground & Pound", group: "ground" },
];

export const ACTION_BY_ID: Map<string, ActionDef> = new Map(
  ACTION_CATALOG.map((a) => [a.id, a] as const),
);

export function actionLabel(id: string): string {
  return ACTION_BY_ID.get(id)?.label ?? id;
}

/** Käfig-Zone, in der eine Aktion überwiegend passiert (Konzept §4/§5). */
export type CageZone = "center" | "open" | "cage";

export const CAGE_ZONE_LABEL: Record<CageZone, string> = {
  center: "Center",
  open: "Offener Raum",
  cage: "Am Cage",
};

/** Eine gezählte Aktion, aggregiert über die hochgeladenen Kämpfe. */
export interface ActionStat {
  /** Katalog-ID (siehe ACTION_CATALOG). */
  id: string;
  /** Gesamtzahl der Versuche. */
  attempted: number;
  /** Davon erfolgreich (Treffer / erfolgreicher Takedown). */
  landed: number;
  /** Überwiegende Käfig-Zone (optional). */
  zone?: CageZone | null;
  /** Womit wird die Aktion vorbereitet — Freitext, z.B. „Linker Jab" (optional). */
  setup?: string | null;
}

/** Trefferquote 0..1 (0, wenn keine Versuche). */
export function successRate(s: Pick<ActionStat, "attempted" | "landed">): number {
  return s.attempted > 0 ? Math.max(0, Math.min(1, s.landed / s.attempted)) : 0;
}

/** True, wenn eine Aktion echte Daten trägt. */
export function hasActionData(s: ActionStat): boolean {
  return (s.attempted || 0) > 0 || (s.landed || 0) > 0;
}

/** Entfernt leere Aktionen & clampt Werte — Firestore-sicher (kein undefined). */
export function cleanActionStats(
  stats: ActionStat[] | undefined | null,
): ActionStat[] {
  if (!stats) return [];
  const out: ActionStat[] = [];
  for (const s of stats) {
    if (!ACTION_BY_ID.has(s.id)) continue;
    const attempted = Math.max(0, Math.round(Number(s.attempted) || 0));
    let landed = Math.max(0, Math.round(Number(s.landed) || 0));
    if (landed > attempted) landed = attempted;
    if (attempted === 0 && landed === 0) continue;
    const clean: ActionStat = { id: s.id, attempted, landed };
    if (s.zone === "center" || s.zone === "open" || s.zone === "cage")
      clean.zone = s.zone;
    if (typeof s.setup === "string" && s.setup.trim())
      clean.setup = s.setup.trim();
    out.push(clean);
  }
  return out;
}

/** True, wenn keine Aktion Daten trägt. */
export function isActionStatsEmpty(
  stats: ActionStat[] | undefined | null,
): boolean {
  return !stats || !stats.some(hasActionData);
}

/** Summen über eine Aktionsliste. */
export function actionTotals(stats: ActionStat[]): {
  attempted: number;
  landed: number;
  rate: number;
} {
  const attempted = stats.reduce((n, s) => n + (s.attempted || 0), 0);
  const landed = stats.reduce((n, s) => n + (s.landed || 0), 0);
  return { attempted, landed, rate: attempted > 0 ? landed / attempted : 0 };
}

/** Gruppiert Stats nach ActionGroup (nur Gruppen mit Daten). */
export function statsByGroup(
  stats: ActionStat[],
): { group: ActionGroup; stats: ActionStat[] }[] {
  const groups: ActionGroup[] = ["strike", "kick", "takedown", "ground"];
  return groups
    .map((group) => ({
      group,
      stats: stats.filter(
        (s) => ACTION_BY_ID.get(s.id)?.group === group && hasActionData(s),
      ),
    }))
    .filter((g) => g.stats.length > 0);
}

// ─── §5 Zonen-Aggregation (Käfig-Heatmap) ────────────────────────────────────

/** Versuche je Käfig-Zone — Basis der Heatmap. Aktionen ohne Zone bleiben außen vor. */
export function zoneDistribution(
  stats: ActionStat[],
): Record<CageZone, number> {
  const out: Record<CageZone, number> = { center: 0, open: 0, cage: 0 };
  for (const s of stats) {
    if (s.zone && hasActionData(s)) out[s.zone] += s.attempted || 0;
  }
  return out;
}

// ─── §3 Tendenzen ────────────────────────────────────────────────────────────

export type TendencyTone = "weapon" | "success" | "zone" | "setup" | "warning";

export interface Tendency {
  id: string;
  text: string;
  tone: TendencyTone;
}

const pct = (r: number) => `${Math.round(r * 100)}%`;

/**
 * Leitet Klartext-Erkenntnisse aus den Action-Stats ab (Konzept §9/§10).
 * Bewusst konservativ: nur Aussagen, die durch genug Versuche gestützt sind.
 */
export function deriveTendencies(stats: ActionStat[]): Tendency[] {
  const active = stats.filter(hasActionData);
  if (active.length === 0) return [];
  const out: Tendency[] = [];

  // Häufigste Waffe = meiste Versuche.
  const mostUsed = [...active].sort((a, b) => b.attempted - a.attempted)[0];
  if (mostUsed && mostUsed.attempted > 0) {
    out.push({
      id: "most-used",
      tone: "weapon",
      text: `Häufigste Waffe: ${actionLabel(mostUsed.id)} (${mostUsed.attempted} Versuche).`,
    });
  }

  // Gefährlichste Technik = höchste Trefferquote bei ausreichend Versuchen (≥3).
  const reliable = active.filter((s) => s.attempted >= 3);
  if (reliable.length > 0) {
    const best = [...reliable].sort(
      (a, b) => successRate(b) - successRate(a),
    )[0];
    if (best && successRate(best) >= 0.5) {
      out.push({
        id: "most-dangerous",
        tone: "success",
        text: `Gefährlichste Technik: ${actionLabel(best.id)} — ${pct(successRate(best))} Trefferquote (${best.landed}/${best.attempted}).`,
      });
    }
  }

  // Takedown-Profil (Konzept §9): Erfolgsrate + dominante Zone.
  const takedowns = active.filter(
    (s) => ACTION_BY_ID.get(s.id)?.group === "takedown",
  );
  if (takedowns.length > 0) {
    const t = actionTotals(takedowns);
    if (t.attempted >= 3) {
      out.push({
        id: "takedown-rate",
        tone: "success",
        text: `Takedowns: ${t.landed}/${t.attempted} erfolgreich (${pct(t.rate)}).`,
      });
    }
    const zones = zoneDistribution(takedowns);
    const zTotal = zones.center + zones.open + zones.cage;
    if (zTotal > 0) {
      const dom = (Object.keys(zones) as CageZone[]).sort(
        (a, b) => zones[b] - zones[a],
      )[0];
      if (zones[dom] / zTotal >= 0.6) {
        out.push({
          id: "takedown-zone",
          tone: "zone",
          text: `${pct(zones[dom] / zTotal)} der Takedowns passieren ${CAGE_ZONE_LABEL[dom].toLowerCase() === "am cage" ? "am Cage" : `im ${CAGE_ZONE_LABEL[dom]}`}.`,
        });
      }
    }
  }

  // Setup-Muster (Konzept §5): welche Vorbereitung taucht am häufigsten auf.
  const setups = new Map<string, number>();
  for (const s of active) {
    if (s.setup) setups.set(s.setup, (setups.get(s.setup) || 0) + s.attempted);
  }
  if (setups.size > 0) {
    const top = Array.from(setups.entries()).sort((a, b) => b[1] - a[1])[0];
    out.push({
      id: "setup",
      tone: "setup",
      text: `Häufige Vorbereitung: „${top[0]}" leitet viele Angriffe ein.`,
    });
  }

  // Warnung: Technik mit sehr hohem Volumen UND hoher Quote = klare Bedrohung.
  if (mostUsed && mostUsed.attempted >= 5 && successRate(mostUsed) >= 0.6) {
    out.push({
      id: "threat",
      tone: "warning",
      text: `Achtung: ${actionLabel(mostUsed.id)} kommt oft und trifft (${pct(successRate(mostUsed))}) — Hauptbedrohung.`,
    });
  }

  return out;
}

// ─── §4 Gameplan- & Drill-Vorschläge ─────────────────────────────────────────

export interface Suggestion {
  id: string;
  kind: "gameplan" | "drill";
  text: string;
}

/**
 * Erzeugt aus Split + Stats konkrete, editierbare Gameplan-/Drill-Vorschläge
 * (Konzept §10/§11). Reine Regel-Heuristik — der Trainer verfeinert frei.
 */
export function deriveSuggestions(
  split: DnaSplit | undefined | null,
  stats: ActionStat[],
): Suggestion[] {
  const out: Suggestion[] = [];
  const active = stats.filter(hasActionData);
  const norm = split ? normalizeDnaSplit(split) : null;

  const takedowns = active.filter(
    (s) => ACTION_BY_ID.get(s.id)?.group === "takedown",
  );
  const tdTotals = actionTotals(takedowns);
  const tdZones = zoneDistribution(takedowns);
  const tdZoneTotal = tdZones.center + tdZones.open + tdZones.cage;

  // Starker Ringer am Cage → Cage-Defense priorisieren.
  if (
    (norm && norm.wrestling >= 35) ||
    (tdTotals.attempted >= 4 && tdTotals.rate >= 0.5)
  ) {
    out.push({
      id: "td-defense",
      kind: "gameplan",
      text: "Takedown-Verteidigung priorisieren: nicht mit dem Rücken zum Cage stehen bleiben, Distanz im Center kontrollieren.",
    });
    if (tdZoneTotal > 0 && tdZones.cage / tdZoneTotal >= 0.5) {
      out.push({
        id: "drill-cage-defense",
        kind: "drill",
        text: "Drill: Cage-Wrestling — Underhooks, Wall-Walk, Wieder-Aufstehen + Knie-Konter auf den Entry.",
      });
    }
  }

  // Setup-Muster → genau diese Sequenz drillen (Konzept §10-Beispiel).
  const setupAction = active.find((s) => s.setup);
  if (setupAction?.setup) {
    out.push({
      id: "drill-setup",
      kind: "drill",
      text: `Drill: Reaktion auf „${setupAction.setup}" automatisieren — sobald das Setup kommt, Kopf sichern und kontern.`,
    });
  }

  // Striker-lastig → Defense gegen die häufigste Waffe.
  const mostUsed = [...active].sort((a, b) => b.attempted - a.attempted)[0];
  if (mostUsed && mostUsed.attempted >= 4) {
    const g = ACTION_BY_ID.get(mostUsed.id)?.group;
    if (g === "strike" || g === "kick") {
      out.push({
        id: "drill-counter-weapon",
        kind: "drill",
        text: `Drill: Defense & Konter gegen ${actionLabel(mostUsed.id)} — Timing lesen und mit eigenem Konter bestrafen.`,
      });
    }
  }

  // Schwache Bodenlage des Gegners ausnutzen.
  if (norm && norm.ground <= 15 && norm.wrestling <= 25) {
    out.push({
      id: "gameplan-ground",
      kind: "gameplan",
      text: "Bodenlage des Gegners wirkt schwach — eigene Takedowns + Ground & Pound als Sieg-Pfad einplanen.",
    });
  }

  return out;
}
