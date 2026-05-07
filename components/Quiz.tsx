"use client";

import { useState } from "react";
import type { QuizQuestion } from "@/lib/quiz-data";

export function Quiz({ questions }: { questions: QuizQuestion[] }) {
  const [answers, setAnswers] = useState<(number | null)[]>(
    Array(questions.length).fill(null),
  );
  const [submitted, setSubmitted] = useState(false);

  function selectAnswer(qIdx: number, optIdx: number) {
    if (submitted) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[qIdx] = optIdx;
      return next;
    });
  }

  function handleSubmit() {
    if (answers.some((a) => a === null)) return;
    setSubmitted(true);
  }

  function handleReset() {
    setAnswers(Array(questions.length).fill(null));
    setSubmitted(false);
  }

  const score = submitted
    ? answers.filter((a, i) => a === questions[i].correct).length
    : 0;
  const pct = submitted ? Math.round((score / questions.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {questions.map((q, qIdx) => {
        const selected = answers[qIdx];
        const isCorrect = submitted && selected === q.correct;
        const isWrong = submitted && selected !== null && selected !== q.correct;

        return (
          <div
            key={qIdx}
            className={`rounded-xl border p-5 transition-colors ${
              submitted
                ? isCorrect
                  ? "border-green-500/60 bg-green-500/10"
                  : isWrong
                    ? "border-red-500/60 bg-red-500/10"
                    : "border-carbon-500 bg-carbon-700/40"
                : "border-carbon-500 bg-carbon-700/40"
            }`}
          >
            <p className="text-sm font-bold">
              <span className="mr-2 text-foreground/50">{qIdx + 1}.</span>
              {q.question}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {q.options.map((opt, optIdx) => {
                const isSelected = selected === optIdx;
                const isCorrectOpt = submitted && optIdx === q.correct;
                const isWrongOpt = submitted && isSelected && optIdx !== q.correct;

                let cls =
                  "rounded-lg border px-4 py-2 text-sm text-left transition-all ";
                if (isCorrectOpt) {
                  cls += "border-green-500 bg-green-500/15 text-green-300 font-bold";
                } else if (isWrongOpt) {
                  cls += "border-red-500 bg-red-500/15 text-red-300 line-through";
                } else if (isSelected && !submitted) {
                  cls += "border-blood bg-blood/15 text-blood font-bold";
                } else {
                  cls +=
                    "border-carbon-400 bg-carbon-800/60 text-foreground/80 hover:border-blood/60 hover:text-foreground";
                }

                return (
                  <button
                    key={optIdx}
                    onClick={() => selectAnswer(qIdx, optIdx)}
                    disabled={submitted}
                    className={cls}
                  >
                    <span className="mr-2 text-xs text-foreground/40">
                      {String.fromCharCode(65 + optIdx)})
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>

            {submitted && (
              <div
                className={`mt-3 text-xs ${isCorrect ? "text-green-300" : "text-red-300"}`}
              >
                {isCorrect ? "✓ Richtig!" : "✗ Falsch."}{" "}
                <span className="text-foreground/70">{q.explanation}</span>
              </div>
            )}
          </div>
        );
      })}

      {!submitted ? (
        <button
          onClick={handleSubmit}
          disabled={answers.some((a) => a === null)}
          className="btn-primary w-full disabled:opacity-40"
        >
          Quiz auswerten
        </button>
      ) : (
        <div className="rounded-xl border border-carbon-500 bg-carbon-700/40 p-6 text-center">
          <div
            className={`font-display text-5xl font-black ${
              pct >= 80
                ? "text-green-400"
                : pct >= 50
                  ? "text-yellow-400"
                  : "text-blood"
            }`}
          >
            {score} / {questions.length}
          </div>
          <div className="mt-1 text-sm text-foreground/70">
            {pct}% richtig —{" "}
            {pct === 100
              ? "Perfekt! Du kennst die Regeln genau."
              : pct >= 80
                ? "Sehr gut! Schau dir die Fehler nochmal an."
                : pct >= 50
                  ? "Gut — aber noch Luft nach oben."
                  : "Lies nochmal die Regeln und versuche es erneut."}
          </div>
          <button
            onClick={handleReset}
            className="btn-secondary mt-4 px-6 py-2 text-sm"
          >
            Nochmal versuchen
          </button>
        </div>
      )}
    </div>
  );
}
