"use client";

import { useState } from "react";
import {
  FIGHTER_STANCE_LABEL,
  FIGHT_STYLE_LABEL,
  type FighterStance,
  type FightStyle,
  type OpponentProfile,
} from "@/lib/fight-camp";

export interface FightCampFormValue {
  competitionName: string;
  competitionDate: string; // yyyy-mm-dd
  opponent: OpponentProfile;
}

export default function FightCampForm({
  initial,
  busy,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<FightCampFormValue>;
  busy?: boolean;
  onSubmit: (value: FightCampFormValue) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const today = new Date();
  const defaultDate = new Date(
    today.getTime() + 120 * 24 * 3600 * 1000,
  )
    .toISOString()
    .slice(0, 10);

  const [name, setName] = useState(initial?.competitionName ?? "");
  const [date, setDate] = useState(initial?.competitionDate ?? defaultDate);
  const [oppName, setOppName] = useState(initial?.opponent?.name ?? "");
  const [oppStyle, setOppStyle] = useState<FightStyle>(
    initial?.opponent?.style ?? "all-rounder",
  );
  const [oppStance, setOppStance] = useState<FighterStance>(
    initial?.opponent?.stance ?? "orthodox",
  );
  const [oppHeight, setOppHeight] = useState<string>(
    initial?.opponent?.heightCm != null
      ? String(initial.opponent.heightCm)
      : "",
  );
  const [oppWeight, setOppWeight] = useState<string>(
    initial?.opponent?.weightKg != null
      ? String(initial.opponent.weightKg)
      : "",
  );
  const [oppReach, setOppReach] = useState<string>(
    initial?.opponent?.reachCm != null ? String(initial.opponent.reachCm) : "",
  );
  const [oppStrengths, setOppStrengths] = useState<string>(
    initial?.opponent?.strengths?.join(", ") ?? "",
  );
  const [oppWeaknesses, setOppWeaknesses] = useState<string>(
    initial?.opponent?.weaknesses?.join(", ") ?? "",
  );
  const [oppFavorites, setOppFavorites] = useState<string>(
    initial?.opponent?.favoriteAttacks?.join(", ") ?? "",
  );
  const [oppNotes, setOppNotes] = useState<string>(
    initial?.opponent?.notes ?? "",
  );

  function parseTags(s: string): string[] {
    return s
      .split(/[,;\n]/)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      competitionName: name.trim() || "Wettkampf",
      competitionDate: date,
      opponent: {
        name: oppName.trim() || "Unbekannter Gegner",
        style: oppStyle,
        stance: oppStance,
        heightCm: oppHeight ? Number(oppHeight) : null,
        weightKg: oppWeight ? Number(oppWeight) : null,
        reachCm: oppReach ? Number(oppReach) : null,
        strengths: parseTags(oppStrengths),
        weaknesses: parseTags(oppWeaknesses),
        favoriteAttacks: parseTags(oppFavorites),
        notes: oppNotes.trim() || undefined,
      },
    });
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase" style={labelStyle}>
            Wettkampf-Name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Fight Night München"
            className="rounded-lg px-3 py-2 text-sm"
            style={fieldStyle}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase" style={labelStyle}>
            Datum
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm"
            style={fieldStyle}
          />
        </label>
      </div>

      <div>
        <div
          className="font-mono-ta mb-3 text-[10px] font-bold uppercase"
          style={{ letterSpacing: "0.2em", color: "var(--ta-pink)" }}
        >
          Gegner-Profil
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase" style={labelStyle}>
              Name / Bezeichnung
            </span>
            <input
              type="text"
              value={oppName}
              onChange={(e) => setOppName(e.target.value)}
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
              value={oppStyle}
              onChange={(e) => setOppStyle(e.target.value as FightStyle)}
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
              value={oppStance}
              onChange={(e) => setOppStance(e.target.value as FighterStance)}
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
                value={oppHeight}
                onChange={(e) => setOppHeight(e.target.value)}
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
                value={oppWeight}
                onChange={(e) => setOppWeight(e.target.value)}
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
                value={oppReach}
                onChange={(e) => setOppReach(e.target.value)}
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
            value={oppStrengths}
            onChange={(e) => setOppStrengths(e.target.value)}
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
            value={oppWeaknesses}
            onChange={(e) => setOppWeaknesses(e.target.value)}
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
            value={oppFavorites}
            onChange={(e) => setOppFavorites(e.target.value)}
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
            value={oppNotes}
            onChange={(e) => setOppNotes(e.target.value)}
            placeholder="Frei-Text, Video-Notes, weitere Beobachtungen…"
            className="rounded-lg px-3 py-2 text-sm"
            style={{ ...fieldStyle, minHeight: "80px" }}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          className="btn-primary px-5 py-2 text-sm"
          style={{
            opacity: busy ? 0.6 : 1,
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Erzeuge Plan…" : "Camp + Plan generieren"}
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
