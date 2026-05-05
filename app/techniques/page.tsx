"use client";

import PageHeader from "@/components/PageHeader";
import {
  ALL_TECHNIQUES,
  CATEGORY_LABEL,
  CATEGORY_TAG,
  searchTechniques,
} from "@/lib/techniques";
import {
  DIFFICULTY_LABEL,
  type Category,
  type Difficulty,
} from "@/lib/types";
import Link from "next/link";
import { useMemo, useState } from "react";

const CATEGORIES: Category[] = ["boxing", "wrestling", "bjj", "muay-thai"];
const DIFFICULTIES: Difficulty[] = ["anfaenger", "fortgeschritten", "pro"];

export default function TechniquesPage() {
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<Category | "all">("all");
  const [activeDiff, setActiveDiff] = useState<Difficulty | "all">("all");

  const techniques = useMemo(() => {
    let list = searchTechniques(search);
    if (activeCat !== "all") list = list.filter((t) => t.category === activeCat);
    if (activeDiff !== "all")
      list = list.filter((t) => t.difficulty === activeDiff);
    return list;
  }, [search, activeCat, activeDiff]);

  const grouped = useMemo(() => {
    const map = new Map<Category, typeof ALL_TECHNIQUES>();
    for (const t of techniques) {
      const arr = map.get(t.category) ?? [];
      arr.push(t);
      map.set(t.category, arr);
    }
    return map;
  }, [techniques]);

  return (
    <>
      <PageHeader
        eyebrow="Bibliothek"
        title="Techniken"
        description="Alle Techniken nach Disziplin und Schwierigkeit. Klicke eine Technik für Schritt-für-Schritt-Anleitung, typische Fehler und Anwendung."
      />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {/* Filter & Suche */}
        <div className="mb-8 space-y-4">
          <input
            type="search"
            placeholder="Technik suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-sm border border-carbon-400 bg-carbon-800 px-4 py-3 text-sm focus:border-blood focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            <FilterChip
              label="Alle Disziplinen"
              active={activeCat === "all"}
              onClick={() => setActiveCat("all")}
            />
            {CATEGORIES.map((c) => (
              <FilterChip
                key={c}
                label={CATEGORY_LABEL[c]}
                active={activeCat === c}
                onClick={() => setActiveCat(c)}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterChip
              label="Alle Level"
              active={activeDiff === "all"}
              onClick={() => setActiveDiff("all")}
            />
            {DIFFICULTIES.map((d) => (
              <FilterChip
                key={d}
                label={DIFFICULTY_LABEL[d]}
                active={activeDiff === d}
                onClick={() => setActiveDiff(d)}
              />
            ))}
          </div>
        </div>

        {/* Empty State */}
        {techniques.length === 0 && (
          <div className="card text-center text-foreground/60">
            Keine Techniken gefunden. Filter zurücksetzen oder Suchbegriff ändern.
          </div>
        )}

        {/* Gruppiert nach Kategorie */}
        <div className="space-y-12">
          {CATEGORIES.map((cat) => {
            const list = grouped.get(cat);
            if (!list?.length) return null;
            return (
              <section key={cat}>
                <div className="mb-4 flex items-baseline gap-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-blood">
                    {CATEGORY_TAG[cat]}
                  </span>
                  <h2 className="heading-display text-3xl font-black">
                    {CATEGORY_LABEL[cat]}
                  </h2>
                  <span className="text-xs uppercase tracking-widest text-foreground/40">
                    {list.length} Techniken
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((t) => (
                    <Link
                      key={t.id}
                      href={`/techniques/${t.id}`}
                      className="group rounded-sm border border-carbon-500 bg-carbon-700/60 p-5 transition-all hover:border-blood/60"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="heading-display text-xl font-black group-hover:text-blood">
                          {t.name}
                        </h3>
                        <DifficultyBadge difficulty={t.difficulty} />
                      </div>
                      <p className="mt-2 text-sm text-foreground/70 line-clamp-2">
                        {t.description}
                      </p>
                      <div className="mt-4 flex items-center justify-between text-xs uppercase tracking-widest">
                        <span className="text-foreground/50">
                          {t.steps.length} Schritte
                        </span>
                        <span className="text-foreground/70 group-hover:text-blood">
                          Detail →
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-sm border px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
        active
          ? "border-blood bg-blood/15 text-blood"
          : "border-carbon-400 bg-carbon-700/40 text-foreground/70 hover:border-blood/60 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const color =
    difficulty === "anfaenger"
      ? "border-green-500/40 bg-green-500/10 text-green-300"
      : difficulty === "fortgeschritten"
        ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
        : "border-blood/60 bg-blood/15 text-blood";
  return (
    <span
      className={`rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${color}`}
    >
      {DIFFICULTY_LABEL[difficulty]}
    </span>
  );
}
