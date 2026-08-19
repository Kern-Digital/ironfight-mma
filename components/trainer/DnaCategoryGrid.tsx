"use client";

import { useEffect, useRef, useState } from "react";
import {
  DNA_CATEGORIES,
  answeredCount,
  answeredQuestions,
  totalAnswered,
  type GegnerDnaAnswers,
} from "@/lib/gegner-dna";
import DnaCategoryIcon from "./DnaCategoryIcon";

/**
 * Gegner-DNA als scanbares Kategorien-Grid (Read-only-Ersatz für das
 * Accordion in der Profilansicht): 9 Karten mit Fortschritt und der ersten
 * Kernaussage als Vorschau. Klick öffnet die Kategorie im Detail-Panel
 * darunter. Leere Kategorien bleiben sichtbar (gedimmt) — Scouting-Lücken
 * sollen auffallen, nicht verschwinden.
 */
export default function DnaCategoryGrid({ answers }: { answers: GegnerDnaAnswers }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const selected = DNA_CATEGORIES.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    if (selected && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selected]);

  if (totalAnswered(answers) === 0) {
    return (
      <div
        className="rounded-2xl p-6 text-center"
        style={{ background: "var(--ink-2)", border: "1px dashed var(--ink-5)" }}
      >
        <p className="text-sm font-bold" style={{ color: "var(--fg-3)" }}>
          Noch keine DeepFight-Daten erfasst.
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--fg-4)" }}>
          Über &bdquo;Bearbeiten&ldquo; lassen sich Scouting-Infos zum Gegner
          ergänzen — nur was du wirklich weißt.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
        {DNA_CATEGORIES.map((category) => {
          const count = answeredCount(category, answers);
          const total = category.questions.length;
          const first = answeredQuestions(category, answers)[0];
          const active = selectedId === category.id;
          const isEmpty = count === 0;

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedId(active ? null : category.id)}
              aria-expanded={active}
              className="flex flex-col rounded-2xl p-3.5 text-left transition-colors"
              style={{
                background: active
                  ? "linear-gradient(180deg, var(--ink-4), var(--ink-3))"
                  : "linear-gradient(180deg, var(--ink-3), var(--ink-2))",
                border: `1px solid ${
                  active ? category.accent : isEmpty ? "var(--ink-4)" : "var(--ink-5)"
                }`,
                opacity: isEmpty ? 0.6 : 1,
              }}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: "var(--ink-4)",
                    border: `1px solid ${isEmpty ? "var(--ink-5)" : category.accent}`,
                    color: isEmpty ? "var(--fg-4)" : category.accent,
                  }}
                  aria-hidden
                >
                  <DnaCategoryIcon id={category.id} size={16} />
                </span>
                <span
                  className="font-mono-ta text-[10px] font-bold"
                  style={{
                    letterSpacing: "0.1em",
                    color: isEmpty ? "var(--fg-4)" : category.accent,
                  }}
                >
                  {count}/{total}
                </span>
              </div>

              <span
                className="font-display-ta mt-2 block truncate font-bold uppercase"
                style={{
                  fontSize: "13px",
                  letterSpacing: "0.06em",
                  color: isEmpty ? "var(--fg-3)" : "var(--fg-2)",
                }}
              >
                {category.label}
              </span>

              {/* Fortschritt */}
              <span
                className="mt-1.5 block h-1 w-full overflow-hidden rounded-full"
                style={{ background: "var(--ink-4)" }}
                aria-hidden
              >
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${(count / total) * 100}%`,
                    background: category.accent,
                    transition: "width 0.3s ease",
                  }}
                />
              </span>

              {/* Kernaussage-Vorschau */}
              <span
                className="mt-2 block text-[11px] leading-snug"
                style={{
                  color: isEmpty ? "var(--fg-4)" : "var(--fg-3)",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {first ? first.value : "— noch nicht gescoutet"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Detail-Panel der gewählten Kategorie */}
      {selected && (
        <div
          ref={panelRef}
          className="mt-3 rounded-2xl p-4 sm:p-5"
          style={{
            background: "linear-gradient(180deg, var(--ink-3), var(--ink-2))",
            border: `1px solid ${selected.accent}`,
          }}
        >
          <div className="mb-3 flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: "var(--ink-4)",
                border: `1px solid ${selected.accent}`,
                color: selected.accent,
              }}
              aria-hidden
            >
              <DnaCategoryIcon id={selected.id} size={18} />
            </span>
            <div className="min-w-0">
              <div
                className="font-display-ta truncate font-bold uppercase"
                style={{ fontSize: "15.5px", letterSpacing: "0.08em", color: "var(--fg-2)" }}
              >
                {selected.label}
              </div>
              <div
                className="font-mono-ta truncate text-[10px]"
                style={{ letterSpacing: "0.12em", color: "var(--fg-4)" }}
              >
                {selected.hint}
              </div>
            </div>
          </div>

          {answeredCount(selected, answers) === 0 ? (
            <p className="text-xs" style={{ color: "var(--fg-4)" }}>
              Zu dieser Kategorie ist noch nichts gescoutet — über
              &bdquo;Bearbeiten&ldquo; ergänzen.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {answeredQuestions(selected, answers).map(({ question, value }) => (
                <div key={question.id}>
                  <div
                    className="font-mono-ta text-[13px] font-bold uppercase leading-snug"
                    style={{ color: selected.accent }}
                  >
                    {question.label}
                  </div>
                  <p
                    className="mt-1 whitespace-pre-wrap text-sm leading-relaxed"
                    style={{ color: "var(--fg-1)" }}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
