"use client";

import { useEffect, useRef, useState } from "react";
import {
  FIGHTER_STANCE_LABEL,
  FIGHT_STYLE_LABEL,
  type FighterStance,
  type FightStyle,
} from "@/lib/fight-camp";
import type { GegnerDnaAnswers } from "@/lib/gegner-dna";
import type { ActionStat, DnaSplit } from "@/lib/fight-stats";
import GegnerDnaAccordion from "./GegnerDnaAccordion";
import DeepFightWordmark from "@/components/DeepFightWordmark";
import Select from "@/components/ui/Select";
import WachsendesFeld from "@/components/ui/WachsendesFeld";

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
 * Der Gegnerprofil-Editor: Grunddaten + die DeepFight-Kategorien zum
 * Ausfüllen. Wird beim Anlegen (Bibliothek, „Neuer Wettkampf") UND beim
 * Bearbeiten eines Gegnerprofils genutzt.
 *
 * ZWEI ARTEN ZU SPEICHERN — die Frage ist, ob es das Dokument schon gibt:
 *   · `onSubmit` (Anlegen): Knöpfe am Fuß, gespeichert wird auf Druck. Vor
 *     dem ersten Speichern gibt es nichts, wohin ein Tastendruck gehen könnte.
 *   · `onChange` (Bearbeiten, Leon 18.09.2026: „der Speichern- und
 *     Abbrechen-Button soll weg, da automatisch gespeichert werden soll"):
 *     KEINE Knöpfe — jede Änderung geht sofort an den Aufrufer, und der
 *     speichert mit kurzem Aufschub. Den Namen gibt der Editor dabei
 *     ungekürzt weiter, auch leer: Ob ein leeres Feld „Unbekannter Gegner"
 *     heißen soll, entscheidet beim Anlegen das Formular — beim Bearbeiten
 *     wartet der Aufrufer, bis wieder ein Name dasteht.
 *
 * WAS HIER NICHT MEHR STEHT (Leon 18.09.2026: „Dinge wie die Fight-DNA sollen
 * nicht beim Bearbeiten stehen"): Split, Technik-Statistik und Auto-Insights.
 * Sie kommen allein aus den Video-Analysen, niemand kann sie hier ändern —
 * zwischen den Feldern waren sie Lesestoff, der das Formular doppelt so lang
 * machte. Beim Anlegen waren sie ohnehin leer. Split und Zähler reicht der
 * Editor weiter unverändert durch (`OpponentEditorValue`), geschrieben werden
 * sie von `updateOpponent` nicht (sie gehören der Profilrechnung).
 *
 * Alle Textfelder WACHSEN mit ihrem Inhalt (`WachsendesFeld`) — Leon: „die
 * Schreibfelder größer, angepasster an den nötigen Platz vom Text".
 */
export default function OpponentEditor({
  initial,
  busy,
  submitLabel = "Speichern",
  onSubmit,
  onCancel,
  onChange,
}: {
  initial?: OpponentEditorInitial;
  busy?: boolean;
  submitLabel?: string;
  /** Anlegen: gespeichert wird auf Druck. */
  onSubmit?: (value: OpponentEditorValue) => void | Promise<void>;
  onCancel?: () => void;
  /** Bearbeiten: jede Änderung sofort — der Aufrufer speichert selbst. */
  onChange?: (value: OpponentEditorValue) => void;
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
  // Split und Stats sind NICHT editierbar — einzige Quelle ist die
  // Video-Analyse. Sie werden nur durchgereicht (siehe Kopf).
  const dnaSplit: DnaSplit | null = initial?.dnaSplit ?? null;
  const actionStats: ActionStat[] = initial?.actionStats ?? [];

  const wert = (): OpponentEditorValue => ({
    name: name.trim(),
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

  // Live-Modus: jede Änderung an den Aufrufer — außer beim Einhängen, da hat
  // sich noch nichts geändert. Der Aufrufer steht im Ref, damit ein neuer
  // Handler je Rendern keine Meldung auslöst.
  const meldeRef = useRef(onChange);
  meldeRef.current = onChange;
  const erstesMal = useRef(true);
  useEffect(() => {
    if (erstesMal.current) {
      erstesMal.current = false;
      return;
    }
    meldeRef.current?.(wert());
    // `wert` liest genau diese Felder — sie sind die Abhängigkeiten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, style, stance, height, weight, reach, strengths, weaknesses, favorites, notes, dna]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!onSubmit) return;
    const v = wert();
    onSubmit({ ...v, name: v.name || "Unbekannter Gegner" });
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

        {/* Die drei Listen wachsen mit — ein langes „Stärken" verschwand
            vorher rechts aus dem einzeiligen Feld. Komma, Semikolon und
            Zeilenumbruch trennen gleichermaßen (`parseTags`). */}
        <label className="mt-3 flex flex-col gap-1.5">
          <span className="t-label">
            Stärken (kommagetrennt)
          </span>
          <WachsendesFeld
            value={strengths}
            onChange={(e) => setStrengths(e.target.value)}
            placeholder="z.B. harter Cross, gutes Footwork, Konter"
            className="rounded-field px-3 py-2.5"
            style={fieldStyle}
          />
        </label>
        <label className="mt-3 flex flex-col gap-1.5">
          <span className="t-label">
            Schwächen (kommagetrennt)
          </span>
          <WachsendesFeld
            value={weaknesses}
            onChange={(e) => setWeaknesses(e.target.value)}
            placeholder="z.B. Bodenlage schwach, lässt Kicks zu"
            className="rounded-field px-3 py-2.5"
            style={fieldStyle}
          />
        </label>
        <label className="mt-3 flex flex-col gap-1.5">
          <span className="t-label">
            Bevorzugte Angriffe
          </span>
          <WachsendesFeld
            value={favorites}
            onChange={(e) => setFavorites(e.target.value)}
            placeholder="z.B. Jab-Cross, Double-Leg, Roundhouse"
            className="rounded-field px-3 py-2.5"
            style={fieldStyle}
          />
        </label>
        <label className="mt-3 flex flex-col gap-1.5">
          <span className="t-label">
            Notizen
          </span>
          <WachsendesFeld
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Frei-Text, Video-Notes, weitere Beobachtungen…"
            minZeilen={3}
            className="rounded-field px-3 py-2.5"
            style={fieldStyle}
          />
        </label>
      </div>

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

      {/* ── Aktionen — nur beim Anlegen ── */}
      {/* Dieselben zwei Knöpfe wie am Fuß von „Neuer Wettkampf": der eine
          trägt den Akzent, der andere nur eine Kante. */}
      {onSubmit && (
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
      )}
    </form>
  );
}
