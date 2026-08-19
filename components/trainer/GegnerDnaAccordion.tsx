"use client";

import { useState } from "react";
import {
  DNA_CATEGORIES,
  answeredCount,
  answeredQuestions,
  type DnaCategory,
  type GegnerDnaAnswers,
} from "@/lib/gegner-dna";
import DnaCategoryIcon from "./DnaCategoryIcon";

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/**
 * Gegner-DNA als ausklappbare Hauptkategorien.
 *
 * mode="view"  → nur beantwortete Fragen, leere Kategorien werden ausgeblendet.
 *                Wirkt wie ein fertiger Gegnerbericht.
 * mode="edit"  → alle Kategorien + alle Fragen als Eingabefelder. `onChange`
 *                liefert die aktualisierten Antworten (Speichern macht der Parent).
 */
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
    <div className="flex flex-col gap-2.5">
      {visibleCategories.map((category) => {
        const open = openIds.has(category.id);
        const count = answeredCount(category, answers);
        const total = category.questions.length;
        const answered = answeredQuestions(category, answers);

        return (
          <div
            key={category.id}
            className="overflow-hidden rounded-2xl"
            style={{
              background: "linear-gradient(180deg, var(--ink-3), var(--ink-2))",
              border: `1px solid ${count > 0 ? "var(--ink-5)" : "var(--ink-4)"}`,
            }}
          >
            {/* Kategorie-Kopf (klickbar) */}
            <button
              type="button"
              onClick={() => toggle(category.id)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
              aria-expanded={open}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: "var(--ink-4)",
                  border: `1px solid ${category.accent}`,
                  color: category.accent,
                }}
                aria-hidden
              >
                <DnaCategoryIcon id={category.id} size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="font-display-ta block truncate font-bold uppercase"
                  style={{
                    fontSize: "15.5px",
                    letterSpacing: "0.08em",
                    color: count > 0 ? "var(--fg-2)" : "var(--fg-3)",
                  }}
                >
                  {category.label}
                </span>
                <span
                  className="font-mono-ta mt-0.5 block truncate text-[10px]"
                  style={{ letterSpacing: "0.12em", color: "var(--fg-4)" }}
                >
                  {category.hint}
                </span>
              </span>
              {/* Status-Badge */}
              <span
                className="font-mono-ta shrink-0 rounded-md px-2 py-1 text-[10px] font-bold uppercase"
                style={{
                  letterSpacing: "0.1em",
                  background: count > 0 ? "var(--ink-4)" : "transparent",
                  border: `1px solid ${count > 0 ? category.accent : "var(--ink-5)"}`,
                  color: count > 0 ? category.accent : "var(--fg-4)",
                }}
              >
                {mode === "edit" ? `${count}/${total}` : `${count}`}
              </span>
              <span className="shrink-0" style={{ color: "var(--fg-4)" }}>
                <IconChevron open={open} />
              </span>
            </button>

            {/* Inhalt */}
            {open && (
              <div
                className="border-t px-4 py-4"
                style={{ borderColor: "var(--ink-4)" }}
              >
                {mode === "view" ? (
                  <div className="flex flex-col gap-4">
                    {answered.map(({ question, value }) => (
                      <div key={question.id}>
                        <div
                          className="font-mono-ta text-[13px] font-bold uppercase leading-snug"
                          style={{ color: category.accent }}
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
                ) : (
                  <div className="flex flex-col gap-3">
                    {category.questions.map((question) => (
                      <label key={question.id} className="flex flex-col gap-1">
                        <span
                          className="text-[11px]"
                          style={{ color: "var(--fg-3)" }}
                        >
                          {question.label}
                        </span>
                        <textarea
                          value={answers[question.id] ?? ""}
                          onChange={(e) =>
                            setAnswer(question.id, e.target.value)
                          }
                          placeholder={question.placeholder ?? "Nur ausfüllen, wenn bekannt…"}
                          rows={2}
                          className="rounded-lg px-3 py-2 text-sm"
                          style={{
                            background: "var(--ink-3)",
                            border: "1px solid var(--ink-5)",
                            color: "var(--fg-1)",
                            outline: "none",
                            resize: "vertical",
                            minHeight: "44px",
                          }}
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
