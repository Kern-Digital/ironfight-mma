"use client";

import PageHeader from "@/components/PageHeader";
import {
  ALL_TECHNIQUES,
  CATEGORY_LABEL,
  DISCIPLINE_LABEL,
  searchTechniques,
} from "@/lib/techniques";
import {
  DIFFICULTY_LABEL,
  TECHNIQUE_LEVEL_LABEL,
  type Difficulty,
  type Discipline,
  type TechniqueLevel,
} from "@/lib/types";
import Link from "next/link";
import { useMemo, useState } from "react";

/** Alle Disziplinen die tatsächlich in der Datenbank vorkommen */
const ALL_DISCIPLINES: Discipline[] = [
  "boxing",
  "kickboxen",
  "muay-thai",
  "mma",
  "wrestling",
  "bjj",
  "fitness-kickboxen",
];

const DIFFICULTIES: Difficulty[] = ["anfaenger", "fortgeschritten", "pro"];

/** Primäre Disziplin einer Technik — nimmt disciplines[0] oder mapped category */
function primaryDiscipline(t: (typeof ALL_TECHNIQUES)[0]): Discipline {
  if (t.disciplines && t.disciplines.length > 0) return t.disciplines[0];
  const map: Record<string, Discipline> = {
    boxing: "boxing",
    wrestling: "wrestling",
    bjj: "bjj",
    "muay-thai": "muay-thai",
  };
  return map[t.category] ?? "boxing";
}

export default function TechniquesPage() {
  const [search, setSearch] = useState("");
  const [activeDiscipline, setActiveDiscipline] = useState<Discipline | "all">("all");
  const [activeDiff, setActiveDiff] = useState<Difficulty | "all">("all");

  const techniques = useMemo(() => {
    let list = searchTechniques(search);

    if (activeDiscipline !== "all") {
      list = list.filter((t) => {
        if (t.disciplines && t.disciplines.length > 0) {
          return t.disciplines.includes(activeDiscipline);
        }
        // Fallback: category-basiertes Matching
        const map: Record<string, Discipline> = {
          boxing: "boxing",
          wrestling: "wrestling",
          bjj: "bjj",
          "muay-thai": "muay-thai",
        };
        return map[t.category] === activeDiscipline;
      });
    }

    if (activeDiff !== "all") {
      list = list.filter((t) => {
        // Neues level-Feld hat Vorrang
        if (t.level) {
          const levelToDiff: Record<TechniqueLevel, Difficulty | null> = {
            anfaenger: "anfaenger",
            aufbau: "anfaenger",
            fortgeschritten: "fortgeschritten",
            advanced: "fortgeschritten",
            pro: "pro",
          };
          return levelToDiff[t.level] === activeDiff;
        }
        return t.difficulty === activeDiff;
      });
    }

    return list;
  }, [search, activeDiscipline, activeDiff]);

  /** Techniken nach primärer Disziplin gruppieren */
  const grouped = useMemo(() => {
    const map = new Map<Discipline, typeof ALL_TECHNIQUES>();
    for (const t of techniques) {
      const disc = primaryDiscipline(t);
      const arr = map.get(disc) ?? [];
      arr.push(t);
      map.set(disc, arr);
    }
    return map;
  }, [techniques]);

  /** Reihenfolge der Disziplin-Sektionen — nur die die tatsächlich Techniken haben */
  const disciplineOrder: Discipline[] = ALL_DISCIPLINES.filter(
    (d) => grouped.has(d),
  );

  const DISC_TAG: Partial<Record<Discipline, string>> = {
    boxing: "Stand-Up",
    kickboxen: "Stand-Up",
    "muay-thai": "Stand-Up",
    mma: "Mixed",
    wrestling: "Grappling",
    bjj: "Ground",
    "fitness-kickboxen": "Fitness",
  };

  return (
    <>
      <PageHeader
        eyebrow="Bibliothek"
        title="Techniken"
        description="Alle Techniken nach Disziplin und Level. Klicke eine Technik für Schritt-für-Schritt-Anleitung, typische Fehler und Anwendung."
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

          {/* Disziplin-Filter */}
          <div className="flex flex-wrap gap-2">
            <FilterChip
              label="Alle Disziplinen"
              active={activeDiscipline === "all"}
              onClick={() => setActiveDiscipline("all")}
            />
            {ALL_DISCIPLINES.map((d) => (
              <FilterChip
                key={d}
                label={DISCIPLINE_LABEL[d]}
                active={activeDiscipline === d}
                onClick={() => setActiveDiscipline(d)}
              />
            ))}
          </div>

          {/* Level-Filter */}
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

        {/* Gesamt-Count */}
        <div className="mb-6 text-xs uppercase tracking-widest text-foreground/50">
          {techniques.length} {techniques.length === 1 ? "Technik" : "Techniken"} gefunden
        </div>

        {/* Empty State */}
        {techniques.length === 0 && (
          <div className="card text-center text-foreground/60">
            Keine Techniken gefunden. Filter zurücksetzen oder Suchbegriff ändern.
          </div>
        )}

        {/* Gruppiert nach Disziplin */}
        <div className="space-y-12">
          {disciplineOrder.map((disc) => {
            const list = grouped.get(disc);
            if (!list?.length) return null;
            return (
              <section key={disc}>
                <div className="mb-4 flex items-baseline gap-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-blood">
                    {DISC_TAG[disc] ?? "Kampfsport"}
                  </span>
                  <h2 className="heading-display text-3xl font-black">
                    {DISCIPLINE_LABEL[disc]}
                  </h2>
                  <span className="text-xs uppercase tracking-widest text-foreground/40">
                    {list.length} {list.length === 1 ? "Technik" : "Techniken"}
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
                        <DifficultyBadge technique={t} />
                      </div>
                      {t.trainingArea && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {(Array.isArray(t.trainingArea)
                            ? t.trainingArea.slice(0, 2)
                            : [t.trainingArea]
                          ).map((area) => (
                            <span
                              key={area}
                              className="text-[9px] font-bold uppercase tracking-widest text-foreground/40"
                            >
                              {area}
                            </span>
                          ))}
                        </div>
                      )}
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

function DifficultyBadge({
  technique,
}: {
  technique: (typeof ALL_TECHNIQUES)[0];
}) {
  const level = technique.level ?? null;
  const diff = technique.difficulty;

  const label = level
    ? (() => {
        const map: Record<string, string> = {
          anfaenger: "Anfänger",
          aufbau: "Aufbau",
          fortgeschritten: "Fortgeschritten",
          advanced: "Advanced",
          pro: "Pro",
        };
        return map[level] ?? DIFFICULTY_LABEL[diff];
      })()
    : DIFFICULTY_LABEL[diff];

  const color =
    diff === "anfaenger" || level === "anfaenger" || level === "aufbau"
      ? "border-green-500/40 bg-green-500/10 text-green-300"
      : diff === "pro" || level === "pro" || level === "advanced"
        ? "border-blood/60 bg-blood/15 text-blood"
        : "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";

  return (
    <span
      className={`rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${color}`}
    >
      {label}
    </span>
  );
}
