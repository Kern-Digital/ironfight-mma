"use client";

/**
 * Eine Phase des Trainingsplans von Hand ändern (Leon 17.09.2026: „Wettkampf-
 * Plan bearbeiten, Stufe 1"). Fokus, Einheiten pro Woche, Sparring-Anteil und
 * eine Notiz — Techniken-Auswahl, Kampfdatum und Phasenlängen kommen in
 * späteren Stufen (Gedächtnis `wettkampfplan-bearbeiten`).
 *
 * Steht an derselben Stelle wie die Ansicht der Phase (MorphSwap in
 * FightCampPlanView). Gespeichert wird nur diese eine Phase
 * (lib/fight-camp.ts `updateFightCampPhase`); der Athlet sieht sie sofort.
 */

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import {
  PHASE_GRENZEN,
  PHASE_LABEL,
  saeubereAenderung,
  type FightCampPhaseBlock,
  type PhasenAenderung,
} from "@/lib/fight-camp";

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const FELD: React.CSSProperties = {
  background: "var(--surface-raised)",
  border: "1px solid var(--line)",
  color: "var(--text-body)",
  font: "var(--type-body)",
  outline: "none",
};

/** Die Textfläche wächst mit dem Inhalt — kein Scrollbalken im Feld. */
function wachsen(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function Stepper({
  label,
  wert,
  anzeige,
  onChange,
  schritt,
  min,
  max,
  feld,
}: {
  label: string;
  wert: number;
  anzeige: string;
  onChange: (n: number) => void;
  schritt: number;
  min: number;
  max: number;
  feld: string;
}) {
  const knopf = (richtung: -1 | 1) => {
    const ziel = Math.round((wert + richtung * schritt) * 100) / 100;
    const aus = richtung < 0 ? ziel < min : ziel > max;
    return (
      <button
        type="button"
        onClick={() => onChange(ziel)}
        disabled={aus}
        data-press
        aria-label={`${label} ${richtung < 0 ? "weniger" : "mehr"}`}
        className="t-interactive inline-flex h-hit w-hit shrink-0 items-center justify-center rounded-field disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: "var(--surface-card)", border: "1px solid var(--line)", color: "var(--text-body)" }}
      >
        <Icon name={richtung < 0 ? "minus" : "plus"} size={16} strokeWidth={2.4} />
      </button>
    );
  };
  return (
    <div className="flex min-w-0 flex-col gap-1.5" role="group" aria-label={label} data-feld={feld}>
      <span className="t-label">{label}</span>
      <div className="flex items-center gap-2 rounded-field p-1" style={{ background: "var(--surface-raised)", border: "1px solid var(--line)" }}>
        {knopf(-1)}
        <span
          aria-live="polite"
          className="flex-1 text-center"
          style={{ font: "var(--type-body-strong)", fontVariantNumeric: "tabular-nums" }}
        >
          {anzeige}
        </span>
        {knopf(1)}
      </div>
    </div>
  );
}

export default function PhasenEditor({
  phase,
  onSpeichern,
  onAbbrechen,
}: {
  phase: FightCampPhaseBlock;
  onSpeichern: (aenderung: PhasenAenderung) => Promise<void>;
  onAbbrechen: () => void;
}) {
  const [fokus, setFokus] = useState(phase.focus);
  const [einheiten, setEinheiten] = useState(phase.sessionsPerWeek);
  // In Prozent geführt — 5-%-Schritte ohne Kommazahlen-Rauschen.
  const [sparring, setSparring] = useState(Math.round(phase.sparringRatio * 20) * 5);
  const [notiz, setNotiz] = useState(phase.notes ?? "");
  const [speichert, setSpeichert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function speichern() {
    if (speichert) return;
    setSpeichert(true);
    setFehler(null);
    try {
      await onSpeichern(
        saeubereAenderung(phase.phase, {
          focus: fokus,
          sessionsPerWeek: einheiten,
          sparringRatio: sparring / 100,
          notes: notiz,
        }),
      );
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Phase konnte nicht gespeichert werden.");
      setSpeichert(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      data-phasen-editor={phase.phase}
      aria-label={`${PHASE_LABEL[phase.phase]} bearbeiten`}
      onSubmit={(e) => {
        e.preventDefault();
        void speichern();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onAbbrechen();
        }
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="t-label">Fokus</span>
        <textarea
          ref={wachsen}
          value={fokus}
          rows={2}
          maxLength={PHASE_GRENZEN.fokusMax}
          data-feld="fokus"
          onChange={(e) => {
            setFokus(e.target.value);
            wachsen(e.target);
          }}
          className="resize-none rounded-field px-3 py-2.5"
          style={FELD}
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Stepper
          label="Einheiten pro Woche"
          feld="einheiten"
          wert={einheiten}
          anzeige={`${einheiten}×`}
          onChange={setEinheiten}
          schritt={1}
          min={0}
          max={PHASE_GRENZEN.einheitenMax}
        />
        <Stepper
          label="Sparring-Anteil"
          feld="sparring"
          wert={sparring}
          anzeige={`${sparring} %`}
          onChange={setSparring}
          schritt={5}
          min={0}
          max={100}
        />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="t-label">Notiz für diese Phase</span>
        <textarea
          ref={wachsen}
          value={notiz}
          rows={2}
          maxLength={PHASE_GRENZEN.notizMax}
          data-feld="notiz"
          placeholder="z. B. Sparring nur mit Kopfschutz, montags Technik statt Kraft"
          onChange={(e) => {
            setNotiz(e.target.value);
            wachsen(e.target);
          }}
          className="resize-none rounded-field px-3 py-2.5"
          style={FELD}
        />
      </label>

      <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
        Dein Athlet sieht die Änderung sofort in seinem Trainingsplan.
      </p>

      {fehler && (
        <p role="alert" style={{ font: "var(--type-sub)", color: "var(--negative)" }}>
          {fehler}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={speichert}
          data-press
          data-aktion="phase-speichern"
          className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-4 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ ...BTN_FONT, background: "var(--accent)", color: "var(--on-accent)", boxShadow: "var(--accent-glow)" }}
        >
          <Icon name="check" size={14} strokeWidth={2.4} />
          {speichert ? "Speichert…" : "Speichern"}
        </button>
        <button
          type="button"
          onClick={onAbbrechen}
          disabled={speichert}
          data-press
          className="t-interactive inline-flex min-h-hit items-center rounded-field px-4 disabled:opacity-60"
          style={{ ...BTN_FONT, background: "var(--surface-raised)", border: "1px solid var(--line)", color: "var(--text-body)" }}
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
