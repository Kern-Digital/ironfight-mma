"use client";

/**
 * Technikbibliothek — alle Techniken nach Disziplin und Level
 * (Redesign-Etappe 5, Rollout im Muster der Referenzseiten /timer,
 * Disziplin-Seite und Workout-Hub):
 *  - Kopf mit Ambient-Schicht, „← Training"-Rücksprung, Athleten-Shell
 *    (Tab-Bar, Training aktiv); Trainer behalten die Navbar
 *  - „Meine Bibliothek" als gerahmtes Feld mit drei schräg geschnittenen
 *    Bildern rechts (Feedback 2026-08-29): von rechts (stark) nach links
 *    auslaufend — Bilder aus public/library/*.jpg (Pexels, frei nutzbar)
 *  - Disziplin-Filter als ui/Select (Standard „Alle"), Level als drei
 *    Toggles, standardmäßig ALLE aktiv; Aktiv-Leuchten gestuft
 *    (Anfänger dezent → Pro kräftig, Feedback 2026-08-29)
 *  - Level NIE farbcodiert, nur Text (Regel Rubrik-Farben/Slot-System);
 *    die Rubrik-Farbe leuchtet als Schein von links in die Karte
 *    (Muster Hub-Disziplinkarten) statt als Farbkante
 */

import AthleteTabBar from "@/components/AthleteTabBar";
import Icon from "@/components/ui/Icon";
import Select from "@/components/ui/Select";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import {
  ALL_TECHNIQUES,
  DISCIPLINE_LABEL,
  searchTechniques,
} from "@/lib/techniques";
import {
  DIFFICULTY_LABEL,
  TECHNIQUE_LEVEL_LABEL,
  TRAINING_AREA_LABEL,
  type Difficulty,
  type Discipline,
  type Technique,
  type TechniqueLevel,
} from "@/lib/types";
import { CATEGORY_COLOR, DISCIPLINE_COLOR } from "@/lib/discipline-colors";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

/** Alle Disziplinen, die tatsächlich in der Datenbank vorkommen */
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

const DISCIPLINE_OPTIONS = [
  { value: "all", label: "Alle Disziplinen" },
  ...ALL_DISCIPLINES.map((d) => ({ value: d, label: DISCIPLINE_LABEL[d] })),
];

/** Granulares Level → grobes Filter-Level (Anfänger/Fortgeschritten/Pro) */
const LEVEL_TO_DIFF: Record<TechniqueLevel, Difficulty> = {
  anfaenger: "anfaenger",
  aufbau: "anfaenger",
  fortgeschritten: "fortgeschritten",
  advanced: "fortgeschritten",
  pro: "pro",
};

/**
 * Gestuftes Aktiv-Leuchten der Level-Toggles (Leon 2026-08-29): Anfänger
 * dezent, Pro kräftig — alles Ableitungen aus dem Akzent-Token, keine
 * eigenen Farben.
 */
const LEVEL_ACTIVE_MIX: Record<
  Difficulty,
  { bg: number; border: number; glow: number }
> = {
  anfaenger: { bg: 10, border: 45, glow: 0 },
  fortgeschritten: { bg: 22, border: 70, glow: 20 },
  pro: { bg: 36, border: 100, glow: 38 },
};

const DISC_TAG: Partial<Record<Discipline, string>> = {
  boxing: "Stand-Up",
  kickboxen: "Stand-Up",
  "muay-thai": "Stand-Up",
  mma: "Mixed",
  wrestling: "Grappling",
  bjj: "Ground",
  "fitness-kickboxen": "Fitness",
};

/**
 * Bilder im „Meine Bibliothek"-Feld — fünf schräge Streifen, Reihenfolge
 * wird bei jedem Seitenaufruf neu gemischt (Leon 2026-08-29). Quelle:
 * Pexels (frei nutzbar, keine Attribution nötig); objectPosition legt das
 * Bild-Highlight mittig in den Streifen. ACHTUNG Pfad:
 * public/library-stack/ — /library/* läuft durch die Auth-Middleware
 * (matcher) und wäre ausgeloggt umgeleitet.
 */
const LIBRARY_IMAGE_POOL: { src: string; position: string }[] = [
  { src: "/library-stack/boxing.jpg", position: "50% 30%" },
  { src: "/library-stack/bjj.jpg", position: "50% 22%" },
  { src: "/library-stack/muay-thai.jpg", position: "50% 42%" },
  { src: "/library-stack/boxing-wraps.jpg", position: "50% 18%" },
  { src: "/library-stack/bjj-female.jpg", position: "50% 20%" },
];

/** Deckkraft je Streifen-Position (links → rechts): nur die zwei rechten
    klar, ab dem dritten von rechts deutlich verdunkelt (Leon 2026-08-29) */
const STACK_OPACITY = [0.22, 0.32, 0.5, 0.9, 1];

// ─── Typo-Konstanten (Muster der Referenzseiten) ──────────────────────────────

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const META_FONT: React.CSSProperties = {
  font: "600 10px/1.2 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

// ─── Helfer ───────────────────────────────────────────────────────────────────

/** Primäre Disziplin einer Technik — disciplines[0] oder Kategorie-Mapping */
function primaryDiscipline(t: Technique): Discipline {
  if (t.disciplines && t.disciplines.length > 0) return t.disciplines[0];
  const map: Partial<Record<string, Discipline>> = {
    boxing: "boxing",
    wrestling: "wrestling",
    bjj: "bjj",
    "muay-thai": "muay-thai",
  };
  return map[t.category] ?? "boxing";
}

/** Level als TEXT — das granulare Feld hat Vorrang (nie farbcodiert) */
function levelLabel(t: Technique): string {
  return t.level
    ? TECHNIQUE_LEVEL_LABEL[t.level] ?? DIFFICULTY_LABEL[t.difficulty]
    : DIFFICULTY_LABEL[t.difficulty];
}

// ─── Seite ────────────────────────────────────────────────────────────────────

export default function TechniquesPage() {
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isTrainer = profile?.role === "trainer" || profile?.role === "admin";

  const [search, setSearch] = useState("");
  const [activeDiscipline, setActiveDiscipline] = useState<Discipline | "all">(
    "all",
  );
  // Alle drei Level sind standardmäßig aktiv — Abwählen blendet aus
  // (Leon 2026-08-29: Toggles statt „Alle Level"-Chip)
  const [activeLevels, setActiveLevels] = useState<ReadonlySet<Difficulty>>(
    () => new Set(DIFFICULTIES),
  );

  // Bilder-Reihenfolge pro Seitenaufruf neu mischen — erst NACH dem Mount
  // (Server-HTML und Client-Hydration müssen übereinstimmen, Zufall auf
  // beiden Seiten gäbe einen Hydration-Fehler)
  const [stack, setStack] = useState<typeof LIBRARY_IMAGE_POOL | null>(null);
  useEffect(() => {
    const arr = [...LIBRARY_IMAGE_POOL];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setStack(arr);
  }, []);

  function toggleLevel(d: Difficulty) {
    setActiveLevels((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  const techniques = useMemo(() => {
    let list = searchTechniques(search);

    if (activeDiscipline !== "all") {
      list = list.filter((t) => {
        if (t.disciplines && t.disciplines.length > 0) {
          return t.disciplines.includes(activeDiscipline);
        }
        // Fallback: kategorie-basiertes Matching (alte Datensätze)
        return primaryDiscipline(t) === activeDiscipline;
      });
    }

    if (activeLevels.size < DIFFICULTIES.length) {
      list = list.filter((t) =>
        activeLevels.has(t.level ? LEVEL_TO_DIFF[t.level] : t.difficulty),
      );
    }

    return list;
  }, [search, activeDiscipline, activeLevels]);

  /** Techniken nach primärer Disziplin gruppieren */
  const grouped = useMemo(() => {
    const map = new Map<Discipline, Technique[]>();
    for (const t of techniques) {
      const disc = primaryDiscipline(t);
      const arr = map.get(disc) ?? [];
      arr.push(t);
      map.set(disc, arr);
    }
    return map;
  }, [techniques]);

  const disciplineOrder = ALL_DISCIPLINES.filter((d) => grouped.has(d));

  return (
    <main
      className={isTrainer ? "min-h-screen pb-12" : "min-h-screen pb-32"}
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      {/* ── Kopf — Muster der Referenzseiten (Ambient, Rücksprung, Titel) ── */}
      <section className="relative">
        <div
          className="absolute inset-0 overflow-hidden"
          aria-hidden
          style={{
            maskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
          }}
        >
          <div data-ambient style={{ background: "var(--ambient)" }} />
        </div>
        <div className="relative mx-auto flex w-full max-w-2xl items-start gap-3 px-4 pb-5 pt-4 lg:max-w-5xl lg:px-6 lg:pb-7 lg:pt-6">
          <div className="flex flex-1 flex-col gap-1">
            <Link
              href="/dashboard"
              className="t-interactive -ml-2 mb-1 inline-flex min-h-hit items-center gap-1.5 self-start rounded-field px-2"
              style={{ ...BTN_FONT, color: "var(--text-3)", textDecoration: "none" }}
            >
              <Icon name="arrow-left" size={14} strokeWidth={2.2} />
              Training
            </Link>
            <h1
              style={{
                font: "var(--type-display)",
                letterSpacing: "var(--ls-display)",
                textTransform: "uppercase",
              }}
            >
              Techniken
            </h1>
          </div>
          {!isTrainer && (
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? "Helles Design aktivieren"
                  : "Dunkles Design aktivieren"
              }
              className="t-glass t-interactive inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-field lg:hidden"
              style={{ color: "var(--text-2)" }}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} size={20} />
            </button>
          )}
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-4 lg:max-w-5xl lg:px-6 lg:pt-5">
        {/* ── Meine Bibliothek — gespeicherte Techniken (Muster „Meine
            Workouts"-Feld im Hub); rechts drei schräg geschnittene Bilder,
            von rechts stark nach links auslaufend (Leon 2026-08-29) ── */}
        <Link
          href="/library"
          className="t-card t-interactive relative flex min-h-[7rem] items-center gap-4 overflow-hidden p-4 sm:min-h-[8rem] sm:p-5"
          style={{
            border: "1px solid color-mix(in oklab, var(--accent) 60%, transparent)",
            textDecoration: "none",
            color: "var(--text-body)",
          }}
        >
          {stack && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 -right-6 flex w-[72%] gap-[3px] sm:w-[60%]"
              style={{
                maskImage: "linear-gradient(to left, black 55%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to left, black 55%, transparent 100%)",
              }}
            >
              {stack.map((img, i) => (
                <div
                  key={img.src}
                  className="relative h-full flex-1 overflow-hidden"
                  style={{ transform: "skewX(-12deg)", opacity: STACK_OPACITY[i] }}
                >
                  <Image
                    src={img.src}
                    alt=""
                    fill
                    sizes="120px"
                    className="object-cover"
                    style={{
                      transform: "skewX(12deg) scale(1.4)",
                      objectPosition: img.position,
                    }}
                  />
                </div>
              ))}
            </div>
          )}
          <span
            aria-hidden
            className="relative shrink-0"
            style={{ color: "var(--accent-text)", lineHeight: 0 }}
          >
            <Icon name="book" size={22} />
          </span>
          <h2
            className="relative min-w-0 flex-1"
            style={{
              font: "var(--type-h2)",
              letterSpacing: "var(--ls-display)",
              textTransform: "uppercase",
            }}
          >
            Meine Bibliothek
          </h2>
        </Link>

        {/* ── Suche & Filter ── */}
        <div className="flex flex-col gap-3">
          {/* Große Lupe statt Platzhalter-Text (Leon 2026-08-29) */}
          <div className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-3)", lineHeight: 0 }}
            >
              <Icon name="search" size={24} strokeWidth={2} />
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Technik suchen"
              className="t-interactive w-full min-h-hit rounded-field pl-12 pr-3.5"
              style={{
                font: "var(--type-body)",
                background: "var(--surface-raised)",
                border: "1px solid var(--line)",
                color: "var(--text-body)",
                outline: "none",
              }}
            />
          </div>

          {/* Disziplin als Aufklapp-Menü (ui/Select-Standard, Leon 2026-08-29) */}
          <Select
            value={activeDiscipline}
            onChange={(v) => setActiveDiscipline(v as Discipline | "all")}
            options={DISCIPLINE_OPTIONS}
          />

          {/* Level-Toggles — alle aktiv als Standard, Leuchten gestuft */}
          <div className="flex flex-col gap-2">
            <span className="t-label">Level</span>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTIES.map((d) => {
                const active = activeLevels.has(d);
                const mix = LEVEL_ACTIVE_MIX[d];
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleLevel(d)}
                    aria-pressed={active}
                    className="t-interactive min-h-hit flex-1 whitespace-nowrap rounded-field px-3"
                    style={{
                      ...BTN_FONT,
                      background: active
                        ? `color-mix(in oklab, var(--accent) ${mix.bg}%, var(--surface-raised))`
                        : "var(--surface-raised)",
                      border: "1px solid",
                      borderColor: active
                        ? mix.border >= 100
                          ? "var(--accent)"
                          : `color-mix(in oklab, var(--accent) ${mix.border}%, var(--line))`
                        : "var(--line)",
                      color: active ? "var(--accent-text)" : "var(--text-2)",
                      boxShadow:
                        active && mix.glow > 0
                          ? `0 0 14px color-mix(in oklab, var(--accent) ${mix.glow}%, transparent)`
                          : undefined,
                    }}
                  >
                    {DIFFICULTY_LABEL[d]}
                  </button>
                );
              })}
            </div>
          </div>

          <span style={{ ...META_FONT, color: "var(--text-3)" }}>
            {techniques.length}{" "}
            {techniques.length === 1 ? "Technik" : "Techniken"} gefunden
          </span>
        </div>

        {/* ── Leerzustand ── */}
        {techniques.length === 0 && (
          <p
            className="py-8 text-center"
            style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
          >
            Keine Techniken gefunden. Filter zurücksetzen oder Suchbegriff
            ändern.
          </p>
        )}

        {/* ── Gruppiert nach Disziplin ── */}
        <div className="flex flex-col gap-10">
          {disciplineOrder.map((disc) => {
            const list = grouped.get(disc);
            if (!list?.length) return null;
            return (
              <section key={disc} className="flex flex-col gap-4">
                <div className="flex flex-col">
                  {/* Rubrik-Farbe nur als Verstärkung des Tags — der Text
                      trägt die Information (Muster Hub-Disziplinkarten) */}
                  <span
                    style={{ ...META_FONT, color: DISCIPLINE_COLOR[disc] }}
                  >
                    {DISC_TAG[disc] ?? "Kampfsport"}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <h2
                      style={{
                        font: "var(--type-h2)",
                        letterSpacing: "var(--ls-display)",
                        textTransform: "uppercase",
                      }}
                    >
                      {DISCIPLINE_LABEL[disc]}
                    </h2>
                    <span
                      style={{
                        font: "700 16px/1.2 var(--font-archivo), system-ui, sans-serif",
                        letterSpacing: "var(--ls-label)",
                        color: "var(--text-3)",
                      }}
                    >
                      /{list.length}
                    </span>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((t) => {
                    // Nur der ERSTE Trainingsbereich — Meta bewusst knapp:
                    // „Level · Bereich" (Leon 2026-08-29)
                    const area = t.trainingArea
                      ? Array.isArray(t.trainingArea)
                        ? t.trainingArea[0]
                        : t.trainingArea
                      : null;
                    return (
                      <Link
                        key={t.id}
                        href={`/techniques/${t.id}`}
                        className="t-card t-interactive relative flex flex-col gap-1 overflow-hidden p-4 sm:p-5"
                        style={{
                          textDecoration: "none",
                          color: "var(--text-body)",
                        }}
                      >
                        {/* Rubrik-Farbe leuchtet von links in die Karte und
                            läuft vor der Schrift aus (Leon 2026-08-29,
                            Muster Hub-Disziplinkarten) — Farbe zentral aus
                            lib/discipline-colors.ts */}
                        <div aria-hidden data-ambient className="overflow-hidden">
                          <span
                            data-glow
                            style={{
                              left: "-22%",
                              top: "-30%",
                              width: "32%",
                              height: "160%",
                              background: `color-mix(in oklab, ${CATEGORY_COLOR[t.category]} var(--cat-glow-mix), transparent)`,
                            }}
                          />
                        </div>
                        <div className="relative flex min-w-0 flex-col gap-1">
                          <h3
                            style={{
                              font: "var(--type-h3)",
                              letterSpacing: "var(--ls-display)",
                              textTransform: "uppercase",
                            }}
                          >
                            {t.name}
                          </h3>
                          <p
                            className="line-clamp-2"
                            style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
                          >
                            {t.description}
                          </p>
                          <span
                            className="mt-2"
                            style={{ ...META_FONT, color: "var(--text-2)" }}
                          >
                            {levelLabel(t)}
                            {area && ` · ${TRAINING_AREA_LABEL[area]}`}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {!isTrainer && <AthleteTabBar />}
    </main>
  );
}
