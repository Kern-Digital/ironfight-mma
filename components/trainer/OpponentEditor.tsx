"use client";

import { useState } from "react";
import {
  FIGHTER_STANCE_LABEL,
  FIGHT_STYLE_LABEL,
  type FighterStance,
  type FightStyle,
} from "@/lib/fight-camp";
import type { GegnerDnaAnswers } from "@/lib/gegner-dna";
import type { ActionStat, DnaSplit } from "@/lib/fight-stats";
import GegnerDnaAccordion from "./GegnerDnaAccordion";
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

const fieldStyle: React.CSSProperties = {
  background: "var(--ink-3)",
  border: "1px solid var(--ink-5)",
  color: "var(--fg-1)",
  outline: "none",
};
const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  letterSpacing: "0.15em",
  color: "var(--fg-3)",
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
  const [dnaSplit, setDnaSplit] = useState<DnaSplit | null>(
    initial?.dnaSplit ?? null,
  );
  const [actionStats, setActionStats] = useState<ActionStat[]>(
    initial?.actionStats ?? [],
  );

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
      <div
        className="rounded-2xl p-4 sm:p-5"
        style={{ background: "var(--ink-2)", border: "1px solid var(--ink-4)" }}
      >
        <div
          className="font-mono-ta mb-3 text-[10px] font-bold uppercase"
          style={{ letterSpacing: "0.2em", color: "var(--ta-pink)" }}
        >
          Gegnerprofil
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase" style={labelStyle}>
              Name / Bezeichnung
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Marco K."
              className="rounded-lg px-3 py-2 text-sm"
              style={fieldStyle}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase" style={labelStyle}>
              Stil
            </span>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value as FightStyle)}
              className="rounded-lg px-3 py-2 text-sm"
              style={fieldStyle}
            >
              {Object.entries(FIGHT_STYLE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase" style={labelStyle}>
              Auslage
            </span>
            <select
              value={stance}
              onChange={(e) => setStance(e.target.value as FighterStance)}
              className="rounded-lg px-3 py-2 text-sm"
              style={fieldStyle}
            >
              {Object.entries(FIGHTER_STANCE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase" style={labelStyle}>
                Größe cm
              </span>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="rounded-lg px-2 py-2 text-sm"
                style={fieldStyle}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase" style={labelStyle}>
                Gewicht kg
              </span>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="rounded-lg px-2 py-2 text-sm"
                style={fieldStyle}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase" style={labelStyle}>
                Reach cm
              </span>
              <input
                type="number"
                value={reach}
                onChange={(e) => setReach(e.target.value)}
                className="rounded-lg px-2 py-2 text-sm"
                style={fieldStyle}
              />
            </label>
          </div>
        </div>

        <label className="mt-3 flex flex-col gap-1">
          <span className="text-[10px] uppercase" style={labelStyle}>
            Stärken (kommagetrennt)
          </span>
          <input
            type="text"
            value={strengths}
            onChange={(e) => setStrengths(e.target.value)}
            placeholder="z.B. harter Cross, gutes Footwork, Konter"
            className="rounded-lg px-3 py-2 text-sm"
            style={fieldStyle}
          />
        </label>
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-[10px] uppercase" style={labelStyle}>
            Schwächen (kommagetrennt)
          </span>
          <input
            type="text"
            value={weaknesses}
            onChange={(e) => setWeaknesses(e.target.value)}
            placeholder="z.B. Bodenlage schwach, lässt Kicks zu"
            className="rounded-lg px-3 py-2 text-sm"
            style={fieldStyle}
          />
        </label>
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-[10px] uppercase" style={labelStyle}>
            Bevorzugte Angriffe
          </span>
          <input
            type="text"
            value={favorites}
            onChange={(e) => setFavorites(e.target.value)}
            placeholder="z.B. Jab-Cross, Double-Leg, Roundhouse"
            className="rounded-lg px-3 py-2 text-sm"
            style={fieldStyle}
          />
        </label>
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-[10px] uppercase" style={labelStyle}>
            Notizen
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Frei-Text, Video-Notes, weitere Beobachtungen…"
            className="rounded-lg px-3 py-2 text-sm"
            style={{ ...fieldStyle, minHeight: "70px", resize: "vertical" }}
          />
        </label>
      </div>

      {/* ── §1 Fight-DNA-Split ── */}
      <FightDnaSplit split={dnaSplit} mode="edit" onChange={setDnaSplit} />

      {/* ── §2 Technik-Statistik ── */}
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h3
            className="font-display-ta font-black uppercase"
            style={{ fontSize: "15px", letterSpacing: "0.06em" }}
          >
            Technik-Statistik
          </h3>
          <span
            className="font-mono-ta text-[10px]"
            style={{ letterSpacing: "0.12em", color: "var(--fg-4)" }}
          >
            Versuche · Treffer · Zone · Setup
          </span>
        </div>
        <FightStatsBlock stats={actionStats} mode="edit" onChange={setActionStats} />
      </div>

      {/* ── §3/§4/§5 Live-Auswertung der eingegebenen Zahlen ── */}
      <FightInsights split={dnaSplit} stats={actionStats} />

      {/* ── Gegner-DNA (ausklappbare Kategorien) ── */}
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h3
            className="font-display-ta font-black uppercase"
            style={{ fontSize: "15px", letterSpacing: "0.06em" }}
          >
            Gegner-DNA
          </h3>
          <span
            className="font-mono-ta text-[10px]"
            style={{ letterSpacing: "0.12em", color: "var(--fg-4)" }}
          >
            Optional · nur ausfüllen was bekannt ist
          </span>
        </div>
        <GegnerDnaAccordion answers={dna} mode="edit" onChange={setDna} />
      </div>

      {/* ── Aktionen ── */}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          className="btn-primary px-5 py-2 text-sm"
          style={{ opacity: busy ? 0.6 : 1, cursor: busy ? "not-allowed" : "pointer" }}
        >
          {busy ? "Speichere…" : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="btn-secondary px-5 py-2 text-sm"
          >
            Abbrechen
          </button>
        )}
      </div>
    </form>
  );
}
