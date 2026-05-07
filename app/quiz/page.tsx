"use client";

import PageHeader from "@/components/PageHeader";
import Link from "next/link";
import { useState } from "react";
import { SPORT_QUIZZES } from "@/lib/quiz-data";
import { Quiz } from "@/components/Quiz";

export default function QuizPage() {
  const [activeSport, setActiveSport] = useState("mma");
  const sport = SPORT_QUIZZES.find((s) => s.id === activeSport)!;

  return (
    <>
      <PageHeader
        eyebrow="Lernen"
        title="Quiz"
        description="Teste dein Regelwerk-Wissen in MMA, BJJ und Boxen. Wähle eine Disziplin und beantworte alle Fragen."
      />

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Sport-Auswahl */}
        <div className="mb-8 flex flex-wrap gap-2">
          {SPORT_QUIZZES.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSport(s.id)}
              className={`flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-bold uppercase tracking-wider transition-all ${
                activeSport === s.id
                  ? s.color
                  : "border-carbon-400 bg-carbon-700/40 text-foreground/70 hover:border-blood/60 hover:text-foreground"
              }`}
            >
              <span>{s.icon}</span>
              <span>{s.name}</span>
            </button>
          ))}
        </div>

        {/* Quiz Header */}
        <div className="mb-6">
          <h2 className="heading-display text-3xl font-black">{sport.name} Quiz</h2>
          <p className="mt-1 text-xs uppercase tracking-widest text-foreground/50">
            {sport.quiz.length} Fragen · Alle Antworten auswählen, dann auswerten
          </p>
        </div>

        {/* Quiz */}
        <Quiz key={activeSport} questions={sport.quiz} />

        {/* Link zu Regeln */}
        <div className="mt-10 rounded-xl border border-carbon-500 bg-carbon-700/40 p-5">
          <p className="text-sm text-foreground/70">
            Noch unsicher bei den Regeln?{" "}
            <Link href="/regeln" className="font-bold text-blood hover:underline">
              Zum vollständigen Regelwerk →
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
