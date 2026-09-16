"use client";

/**
 * Gegner-DNA als ausklappbare Hauptkategorien.
 *
 * mode="view"  → nur beantwortete Fragen, leere Kategorien werden ausgeblendet.
 *                Wirkt wie ein fertiger Gegnerbericht.
 * mode="edit"  → alle Kategorien + alle Fragen als Eingabefelder. `onChange`
 *                liefert die aktualisierten Antworten (Speichern macht der Parent).
 *
 * ─── ETAPPE 3b (Leons Befund 13.09.2026: „wenn ich auf neuen Gegner anlegen
 * gehe, kommt das Popup mit altem Fenster") ─────────────────────────────────
 *
 * Diese Datei war der letzte große Rest des alten Looks im DeepFight-Bereich
 * — und sie fiel genau dort auf, wo der Rest schon neu ist: im Popup „Neuer
 * Gegner" der Wettkampf-Anlage. Raus sind `--ink-2…5`, `--fg-2…4`,
 * `font-mono-ta`, `font-display-ta`, die festen Pixelgrößen und `rounded-2xl`.
 * **`--fg-1` gab es dabei nie** — der Fragetext stand also die ganze Zeit auf
 * der geerbten Farbe (derselbe Befund wie in Etappe 3a).
 *
 * DIE KATEGORIE TRÄGT KEINE FARBE MEHR, DER ZUSTAND TRÄGT SIE. `category.accent`
 * — vier Farben, die sich über neun Kategorien im Kreis wiederholten — ist
 * hier weg, wie schon in `DnaCategoryGrid` (Etappe 3a): Die Farbe behauptete
 * eine Ordnung, die es nicht gibt, und beantwortete nicht die eine Frage, die
 * man an diese Liste hat — WAS IST SCHON GESCOUTET? Also: leer = gedämpft und
 * neutral (`--text-3`, `--line`), gescoutet = Akzent in Symbol, Zähler und
 * Kante. Dasselbe Muster, dieselben drei Mittel.
 */

import { Collapse } from "@/components/motion";
import Icon from "@/components/ui/Icon";
import { useState } from "react";
import {
  DNA_CATEGORIES,
  answeredCount,
  answeredQuestions,
  type DnaCategory,
  type GegnerDnaAnswers,
} from "@/lib/gegner-dna";
import DnaCategoryIcon from "./DnaCategoryIcon";

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

/** Die Eingabefläche der Fragen — dasselbe Maß wie in „Neuer Wettkampf". */
const FELD_STYLE: React.CSSProperties = {
  background: "var(--surface-raised)",
  border: "1px solid var(--line)",
  color: "var(--text-body)",
  font: "var(--type-body)",
  outline: "none",
  resize: "vertical",
  minHeight: "var(--hit-min)",
};

export default function GegnerDnaAccordion({
  answers,
  mode,
  onChange,
}: {
  answers: GegnerDnaAnswers;
  mode: "view" | "edit";
  onChange?: (next: GegnerDnaAnswers) => void;
}) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setAnswer(questionId: string, value: string) {
    onChange?.({ ...answers, [questionId]: value });
  }

  // Profilansicht: Kategorien ohne Antworten komplett ausblenden.
  const visibleCategories: DnaCategory[] =
    mode === "view"
      ? DNA_CATEGORIES.filter((c) => answeredCount(c, answers) > 0)
      : DNA_CATEGORIES;

  if (mode === "view" && visibleCategories.length === 0) {
    return (
      <div
        className="rounded-card p-6 text-center"
        style={{
          background: "var(--surface-raised)",
          border: "1px dashed var(--line)",
        }}
      >
        <p style={{ font: "var(--type-body-strong)" }}>
          Noch keine DeepFight-Daten erfasst.
        </p>
        <p
          className="mt-1"
          style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
        >
          Über &bdquo;Bearbeiten&ldquo; lassen sich Scouting-Infos zum Gegner
          ergänzen — nur was du wirklich weißt.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {visibleCategories.map((category) => {
        const open = openIds.has(category.id);
        const count = answeredCount(category, answers);
        const total = category.questions.length;
        const answered = answeredQuestions(category, answers);
        const isEmpty = count === 0;
        const akzent = isEmpty ? "var(--text-3)" : "var(--accent-text)";

        return (
          <div
            key={category.id}
            className="overflow-hidden rounded-card"
            style={{
              background: "var(--surface-card)",
              border: `1px solid ${
                isEmpty
                  ? "var(--line)"
                  : "color-mix(in oklab, var(--accent) 30%, var(--line))"
              }`,
            }}
          >
            {/* Kategorie-Kopf (klickbar) */}
            <button
              type="button"
              onClick={() => toggle(category.id)}
              data-press="quiet"
              className="t-interactive flex w-full items-center gap-3 px-4 py-3.5 text-left"
              aria-expanded={open}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field"
                style={{
                  background: "var(--surface-raised)",
                  border: `1px solid ${
                    isEmpty
                      ? "var(--line)"
                      : "color-mix(in oklab, var(--accent) 35%, transparent)"
                  }`,
                  color: akzent,
                }}
                aria-hidden
              >
                <DnaCategoryIcon id={category.id} size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block truncate"
                  style={{
                    font: "var(--type-body-strong)",
                    color: isEmpty ? "var(--text-3)" : "var(--text-1)",
                  }}
                >
                  {category.label}
                </span>
                <span
                  className="mt-0.5 block truncate"
                  style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
                >
                  {category.hint}
                </span>
              </span>
              {/* Der Zähler: im Bearbeiten-Modus „3/7", in der Ansicht die
                  Zahl allein — dort gibt es keine offenen Fragen. */}
              <span
                className="shrink-0 rounded-badge px-2 py-1"
                style={{
                  ...META_FONT,
                  fontVariantNumeric: "tabular-nums",
                  background: isEmpty ? "transparent" : "var(--accent-subtle)",
                  border: `1px solid ${
                    isEmpty
                      ? "var(--line)"
                      : "color-mix(in oklab, var(--accent) 40%, transparent)"
                  }`,
                  color: akzent,
                }}
              >
                {mode === "edit" ? `${count}/${total}` : `${count}`}
              </span>
              <span
                className="shrink-0"
                style={{
                  color: "var(--text-3)",
                  lineHeight: 0,
                  transition: "transform var(--dur-fast) var(--ease-out)",
                  transform: open ? "rotate(180deg)" : "none",
                }}
                aria-hidden
              >
                <Icon name="chevron-down" size={16} strokeWidth={2.2} />
              </span>
            </button>

            {/* Inhalt */}
            <Collapse open={open}>
              <div
                className="border-t px-4 py-4"
                style={{ borderColor: "var(--line)" }}
              >
                {mode === "view" ? (
                  <div className="flex flex-col gap-4">
                    {answered.map(({ question, value }) => (
                      <div key={question.id}>
                        <div className="t-label">{question.label}</div>
                        <p
                          className="mt-1 whitespace-pre-wrap"
                          style={{
                            font: "var(--type-body)",
                            color: "var(--text-body)",
                          }}
                        >
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {category.questions.map((question) => (
                      <label key={question.id} className="flex flex-col gap-1.5">
                        <span
                          style={{
                            font: "var(--type-sub)",
                            color: "var(--text-2)",
                          }}
                        >
                          {question.label}
                        </span>
                        <textarea
                          value={answers[question.id] ?? ""}
                          onChange={(e) =>
                            setAnswer(question.id, e.target.value)
                          }
                          placeholder={
                            question.placeholder ?? "Nur ausfüllen, wenn bekannt…"
                          }
                          rows={2}
                          className="rounded-field px-3 py-2"
                          style={FELD_STYLE}
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </Collapse>
          </div>
        );
      })}
    </div>
  );
}
