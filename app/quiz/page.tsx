"use client";

import PageHeader from "@/components/PageHeader";
import {
  KopfNavigation,
  KopfUmschalter,
  useHatKopf,
} from "@/components/shell/KopfNavigation";
import Link from "next/link";
import { useState } from "react";
import { SPORT_QUIZZES } from "@/lib/quiz-data";
import Icon from "@/components/ui/Icon";
import { Quiz } from "@/components/Quiz";

export default function QuizPage() {
  const hatKopf = useHatKopf();
  const [activeSport, setActiveSport] = useState("mma");
  const sport = SPORT_QUIZZES.find((s) => s.id === activeSport)!;

  return (
    <>
      <PageHeader
        eyebrow="Lernen"
        title="Quiz"
        description="Teste dein Regelwerk-Wissen in MMA, BJJ und Boxen. Wähle eine Disziplin und beantworte alle Fragen."
      />

      {/* Die Disziplin wechselt das ganze Quiz — ab `lg` steht die Wahl im
          Kopf der Hülle (siehe app/regeln/page.tsx). */}
      <KopfNavigation rang={3}>
        <KopfUmschalter
          label="Quiz"
          wahlen={SPORT_QUIZZES.map((s) => ({ id: s.id, label: s.name, aktiv: activeSport === s.id }))}
          onWahl={setActiveSport}
        />
      </KopfNavigation>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Sport-Auswahl */}
        <div className={`mb-8 flex flex-wrap gap-2 ${hatKopf ? "lg:hidden" : ""}`}>
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
              <Icon name={s.icon} size={18} />
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
        <div className="mt-10">
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
