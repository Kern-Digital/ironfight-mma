"use client";

/**
 * Dev-only Smoke-Ziel fuer die DeepFight-Helix (scripts/smoke.mjs).
 *
 * Rendert FightDnaHelix ohne Firebase-Login mit einem deterministischen
 * Mock-Profil (~83 % beantwortet — der Abnahme-Zustand des Prototyps).
 * In Produktion liefert die Route 404; sie liegt bewusst ausserhalb des
 * Middleware-Matchers, damit der headless Browser ohne Session drankommt.
 *
 * ?renderer=webgl|svg erzwingt den jeweiligen Renderer (nutzt der Smoke-Test).
 * ?size=sm|md|lg wählt die Größenstufe (Default lg).
 *
 * „Wachsen"-Button (Etappe B): beantwortet pro Klick bis zu drei offene
 * Fragen und reicht deren IDs als grownQuestionIds durch — exakt der
 * diffHelixModels-Pfad der Trainer-Athletendetailseite, nur ohne Firestore.
 */

import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import FightDnaHelix from "@/components/deepfight/FightDnaHelix";
import { buildHelixModel, diffHelixModels } from "@/lib/fight-dna-helix";
import { DNA_CATEGORIES, isAnswered, type GegnerDnaAnswers } from "@/lib/gegner-dna";

function buildMockAnswers(): GegnerDnaAnswers {
  const answers: GegnerDnaAnswers = {};
  let index = 0;
  for (const category of DNA_CATEGORIES) {
    for (const question of category.questions) {
      // Jede sechste Frage bleibt offen → ~83 % Profilstaerke, stabil pro Lauf.
      if (index % 6 !== 5) answers[question.id] = "Smoke-Mock";
      index += 1;
    }
  }
  return answers;
}

const MOCK_PROFILE = {
  dna: buildMockAnswers(),
  dnaSplit: { boxing: 34, kicking: 26, wrestling: 16, ground: 14, clinch: 10 },
  dnaSplitWeight: 6,
};

export default function HelixSmokePage() {
  const [renderer, setRenderer] = useState<"auto" | "svg" | "webgl">("auto");
  const [size, setSize] = useState<"sm" | "md" | "lg">("lg");
  const [profile, setProfile] = useState(MOCK_PROFILE);
  const [grownQuestionIds, setGrownQuestionIds] = useState<string[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get("renderer");
    if (value === "svg" || value === "webgl") setRenderer(value);
    const sizeValue = params.get("size");
    if (sizeValue === "sm" || sizeValue === "md" || sizeValue === "lg") setSize(sizeValue);
  }, []);

  const grow = () => {
    const dna: GegnerDnaAnswers = { ...profile.dna };
    let added = 0;
    outer: for (const category of DNA_CATEGORIES) {
      for (const question of category.questions) {
        if (isAnswered(dna[question.id])) continue;
        dna[question.id] = "Grow-Mock";
        added += 1;
        if (added >= 3) break outer;
      }
    }
    if (added === 0) return;
    const next = { ...profile, dna };
    setGrownQuestionIds(
      diffHelixModels(buildHelixModel(profile), buildHelixModel(next)).grown,
    );
    setProfile(next);
  };

  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <FightDnaHelix
        profile={profile}
        variant="athlete"
        size={size}
        grownQuestionIds={grownQuestionIds}
        forceRenderer={renderer}
      />
      <button
        type="button"
        data-testid="helix-grow"
        onClick={grow}
        className="mt-4 rounded px-3 py-2 text-xs uppercase"
        style={{
          letterSpacing: "0.12em",
          background: "var(--bg-1)",
          border: "1px solid var(--line-strong)",
          color: "var(--text-2)",
        }}
      >
        Wachsen (+3 Antworten)
      </button>
    </main>
  );
}
