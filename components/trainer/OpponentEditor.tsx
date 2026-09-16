"use client";

import { useState } from "react";
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
  zoneDistribution,
  type ActionStat,
  type DnaSplit,
} from "@/lib/fight-stats";
import GegnerDnaAccordion from "./GegnerDnaAccordion";
import DeepFightWordmark from "@/components/DeepFightWordmark";
import Select from "@/components/ui/Select";
import FightDnaSplit from "./FightDnaSplit";
import FightStatsBlock from "./FightStatsBlock";
import FightInsights from "./FightInsights";

export interface OpponentEditorValue {
  name: string;
  style: FightStyle;
  stance: FighterStance;
  heightCm: number | null;
  weightKg: number | null;
  reachCm: number | null;
  strengths: string[];
  weaknesses: string[];
  favoriteAttacks: string[];
  notes: string | null;
  dna: GegnerDnaAnswers;
  dnaSplit: DnaSplit | null;
  actionStats: ActionStat[];
}

export interface OpponentEditorInitial {
  name?: string;
  style?: FightStyle;
  stance?: FighterStance;
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

function parseTags(s: string): string[] {
  return s
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * ETAPPE 3b (Leons Befund 13.09.2026: „wenn ich auf neuen Gegner anlegen gehe,
 * kommt das Popup mit altem Fenster").
 *
 * Der Kommentar weiter unten kündigte es an — „Der Rest dieser Datei zieht in
 * Etappe 3b nach" —, und aufgefallen ist es genau dort, wo diese Datei in
 * einer fertigen Umgebung steht: im Popup „Neuer Gegner" der Wettkampf-Anlage,
 * zwischen Feldern, die seit Etappe 2b im Token-Look sind. Raus sind
 * `--ink-3/5`, `--fg-1/3/4`, `--ta-pink`, `font-mono-ta`, `font-display-ta`
 * und die festen Pixelgrößen. **`--fg-1` gab es nie** (derselbe Befund wie in
 * Etappe 3a) — die Eingaben standen also auf der geerbten Farbe.
 *
 * Die Maße sind die der Formulare in „Neuer Wettkampf": `min-h-hit
 * rounded-field px-3` auf `--surface-raised`/`--line`, Beschriftungen als
 * `.t-label`. Ein Formular in einem Popup soll aussehen wie ein Formular auf
 * einer Seite — es ist dasselbe Formular.
 */
const fieldStyle: React.CSSProperties = {
  background: "var(--surface-raised)",
  border: "1px solid var(--line)",
  color: "var(--text-body)",
  font: "var(--type-body)",
  outline: "none",
};
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

/**
 * Vollständiger Gegner-DNA-Editor: Gegnerprofil-Grunddaten + ausklappbare
 * Gegner-DNA. Wird beim Anlegen UND Bearbeiten eines Gegnerprofils genutzt.
 */
export default function OpponentEditor({
  initial,
  busy,
  submitLabel = "Speichern",
  onSubmit,
  onCancel,
}: {
  initial?: OpponentEditorInitial;
  busy?: boolean;
  submitLabel?: string;
  onSubmit: (value: OpponentEditorValue) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [style, setStyle] = useState<FightStyle>(initial?.style ?? "all-rounder");
  const [stance, setStance] = useState<FighterStance>(
    initial?.stance ?? "orthodox",
  );
  const [height, setHeight] = useState(
    initial?.heightCm != null ? String(initial.heightCm) : "",
  );
  const [weight, setWeight] = useState(
    initial?.weightKg != null ? String(initial.weightKg) : "",
  );
  const [reach, setReach] = useState(
    initial?.reachCm != null ? String(initial.reachCm) : "",
  );
  const [strengths, setStrengths] = useState(
    initial?.strengths?.join(", ") ?? "",
  );
  const [weaknesses, setWeaknesses] = useState(
    initial?.weaknesses?.join(", ") ?? "",
  );
  const [favorites, setFavorites] = useState(
    initial?.favoriteAttacks?.join(", ") ?? "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [dna, setDna] = useState<GegnerDnaAnswers>(initial?.dna ?? {});
  // Split ist NICHT editierbar — einzige Quelle ist die Video-Analyse
  // (gewichteter Merge). Der Wert wird nur durchgereicht, damit Speichern
  // anderer Felder ihn nicht löscht.
  const dnaSplit: DnaSplit | null = initial?.dnaSplit ?? null;
  // Stats sind NICHT editierbar — einzige Quelle ist die Video-Analyse
  // (Summen beim Übernehmen). Wert wird nur durchgereicht, damit Speichern
  // anderer Felder ihn nicht löscht.
  const actionStats: ActionStat[] = initial?.actionStats ?? [];

  // Dieselbe Bedingung, unter der FightInsights etwas rendert — sie steht hier,
  // damit die Überschrift darüber nicht allein stehen bleibt.
  const zonen = zoneDistribution(actionStats);
  const hatInsights =
    deriveTendencies(actionStats).length > 0 ||
    deriveSuggestions(dnaSplit, actionStats).length > 0 ||
    zonen.center + zonen.open + zonen.cage > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name: name.trim() || "Unbekannter Gegner",
      style,
      stance,
      heightCm: height ? Number(height) : null,
      weightKg: weight ? Number(weight) : null,
      reachCm: reach ? Number(reach) : null,
      strengths: parseTags(strengths),
      weaknesses: parseTags(weaknesses),
      favoriteAttacks: parseTags(favorites),
      notes: notes.trim() || null,
      dna,
      dnaSplit,
      actionStats,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* ── Gegnerprofil (Grunddaten) ── */}
      <div>
        <div className="t-label mb-3">Gegnerprofil</div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="t-label">
              Name / Bezeichnung
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Marco K."
              className="min-h-hit rounded-field px-3"
              style={fieldStyle}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="t-label">
              Stil
            </span>
            <Select
              value={style}
              onChange={(v) => setStyle(v as FightStyle)}
              options={Object.entries(FIGHT_STYLE_LABEL).map(([v, l]) => ({
                value: v,
                label: l,
              }))}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="t-label">
              Auslage
            </span>
            <Select
              value={stance}
              onChange={(v) => setStance(v as FighterStance)}
              options={Object.entries(FIGHTER_STANCE_LABEL).map(([v, l]) => ({
                value: v,
                label: l,
              }))}
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="t-label">
                Größe cm
              </span>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="min-h-hit rounded-field px-2"
                style={fieldStyle}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="t-label">
                Gewicht kg
              </span>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="min-h-hit rounded-field px-2"
                style={fieldStyle}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="t-label">
                Reach cm
              </span>
              <input
                type="number"
                value={reach}
                onChange={(e) => setReach(e.target.value)}
                className="min-h-hit rounded-field px-2"
                style={fieldStyle}
              />
            </label>
          </div>
        </div>

        <label className="mt-3 flex flex-col gap-1.5">
          <span className="t-label">
            Stärken (kommagetrennt)
          </span>
          <input
            type="text"
            value={strengths}
            onChange={(e) => setStrengths(e.target.value)}
            placeholder="z.B. harter Cross, gutes Footwork, Konter"
            className="min-h-hit rounded-field px-3"
            style={fieldStyle}
          />
        </label>
        <label className="mt-3 flex flex-col gap-1.5">
          <span className="t-label">
            Schwächen (kommagetrennt)
          </span>
          <input
            type="text"
            value={weaknesses}
            onChange={(e) => setWeaknesses(e.target.value)}
            placeholder="z.B. Bodenlage schwach, lässt Kicks zu"
            className="min-h-hit rounded-field px-3"
            style={fieldStyle}
          />
        </label>
        <label className="mt-3 flex flex-col gap-1.5">
          <span className="t-label">
            Bevorzugte Angriffe
          </span>
          <input
            type="text"
            value={favorites}
            onChange={(e) => setFavorites(e.target.value)}
            placeholder="z.B. Jab-Cross, Double-Leg, Roundhouse"
            className="min-h-hit rounded-field px-3"
            style={fieldStyle}
          />
        </label>
        <label className="mt-3 flex flex-col gap-1.5">
          <span className="t-label">
            Notizen
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Frei-Text, Video-Notes, weitere Beobachtungen…"
            className="rounded-field px-3 py-2.5"
            style={{ ...fieldStyle, minHeight: "84px", resize: "vertical" }}
          />
        </label>
      </div>

      {/* ── §1 Fight-DNA-Split (nur Anzeige — Quelle ist die Video-Analyse) ──
          DIE ÜBERSCHRIFTEN STEHEN SEIT ETAPPE 3a HIER: Die drei Blöcke brachten
          sie bis dahin selbst mit, solange sie ohne `frameless` gerendert
          wurden. Das Prop ist weg, die Blöcke sind reine Anzeige — wer sie
          platziert, benennt sie (Begründung im Kopf von FightDnaSplit.tsx).
          Etappe 3b hat den Rest dieser Datei nachgezogen (13.09.). */}
      <div>
        <div className="t-label mb-3">Fight-DNA</div>
        <FightDnaSplit split={dnaSplit} />
        <p
          className="mt-2"
          style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
        >
          Der Fight-DNA-Split kommt aus der KI-Video-Analyse — ein gewichteter
          Mittelwert, der mit jedem Video schärfer wird.
        </p>
      </div>

      {/* ── §2 Technik-Statistik (nur Anzeige — Quelle ist die Video-Analyse) ── */}
      <div>
        <div className="t-label mb-3">Technik-Statistik</div>
        <FightStatsBlock stats={actionStats} />
        <p
          className="mt-2"
          style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
        >
          Versuche, Treffer, Zone und Setup zählt die KI-Video-Analyse mit —
          jedes weitere Video macht das Bild vollständiger.
        </p>
      </div>

      {/* ── §3/§4/§5 Auswertung der gespeicherten Zahlen ──
          Anders als die beiden Blöcke darüber steht hier KEIN Erklärsatz, der
          die Überschrift auch ohne Daten trägt — deshalb dieselbe Bedingung,
          unter der FightInsights überhaupt etwas rendert. Bei einem frisch
          angelegten Gegner ist der ganze Abschnitt sonst nur ein Wort. */}
      {hatInsights && (
        <div>
          <div className="t-label mb-3">Auto-Insights</div>
          <FightInsights split={dnaSplit} stats={actionStats} />
        </div>
      )}

      {/* ── DeepFight-Analyse (ausklappbare Kategorien) ── */}
      <div>
        {/* Die Wortmarke bringt ihre Schrift selbst mit — eine zweite
            Größenangabe daneben hätte sie nur gestaucht. */}
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="t-label">
            <DeepFightWordmark />
          </h3>
          <span style={{ ...META_FONT, color: "var(--text-2)" }}>
            Optional · nur ausfüllen was bekannt ist
          </span>
        </div>
        <GegnerDnaAccordion answers={dna} mode="edit" onChange={setDna} />
      </div>

      {/* ── Aktionen ── */}
      {/* Dieselben zwei Knöpfe wie am Fuß von „Neuer Wettkampf": der eine
          trägt den Akzent, der andere nur eine Kante. */}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          data-press
          className="t-interactive min-h-hit rounded-field px-5 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            ...BTN_FONT,
            background: "var(--accent)",
            color: "var(--on-accent)",
            boxShadow: "var(--accent-glow)",
          }}
        >
          {busy ? "Speichere…" : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            data-press
            className="t-interactive min-h-hit rounded-field px-5 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              ...BTN_FONT,
              border: "1px solid var(--line)",
              color: "var(--text-body)",
            }}
          >
            Abbrechen
          </button>
        )}
      </div>
    </form>
  );
}
