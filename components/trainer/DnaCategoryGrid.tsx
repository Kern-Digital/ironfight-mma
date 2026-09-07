"use client";

import { Collapse } from "@/components/motion";
import { useEffect, useRef, useState } from "react";
import {
  DNA_CATEGORIES,
  answeredCount,
  answeredQuestions,
  totalAnswered,
  type GegnerDnaAnswers,
} from "@/lib/gegner-dna";
import DnaCategoryIcon from "./DnaCategoryIcon";

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

/**
 * Gegner-DNA als scanbares Kategorien-Grid (Read-only-Ersatz für das
 * Accordion in der Profilansicht): 9 Karten mit Fortschritt und der ersten
 * Kernaussage als Vorschau. Klick öffnet die Kategorie im Detail-Panel
 * darunter. Leere Kategorien bleiben sichtbar (gedimmt) — Scouting-Lücken
 * sollen auffallen, nicht verschwinden.
 *
 * ─── DER ZUSTAND FÄRBT, NICHT DIE KATEGORIE (Leon, 04.09.2026) ─────────────
 *
 * Bis zur Rollout-Etappe 3a trug jede Kategorie eine Farbe aus
 * `DnaCategory.accent` — vier Farben, die sich über neun Kategorien im Kreis
 * wiederholten. „Real Habits", „Cage- und Raumverhalten" und „Drills" waren
 * deshalb alle drei cyan, ohne dass sie irgendetwas verbindet; zwei der vier
 * Farben waren Violett, also DeepFights eigene Farbe, mitten auf der
 * DeepFight-Seite.
 *
 * Eine Farbe, die nichts trennt, ist Dekoration. Was ein Trainer hier wirklich
 * wissen will, ist: WAS IST SCHON GESCOUTET? Also färbt jetzt der Zustand —
 * gescoutet trägt den Gym-Akzent, leer steht neutral und gedämpft, die
 * geöffnete Kategorie ist zusätzlich gefüllt. Unterschieden bleiben die
 * Kategorien durch das, was sie ohnehin schon unterscheidet: ihr Symbol, ihren
 * Namen und den Zähler.
 *
 * Dieselbe Regel wie bei den Camp-Phasen und bei „Archiviert" in der
 * Wettkampf-Übersicht (`components/trainer/FightCampPlanView.tsx`).
 *
 * Rollout-Etappe 3a: `frameless` ist ebenfalls weg (Begründung im Kopf von
 * FightDnaSplit.tsx).
 */
export default function DnaCategoryGrid({
  answers,
}: {
  answers: GegnerDnaAnswers;
}) {
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
        className="t-card p-6 text-center"
        style={{ borderStyle: "dashed", borderColor: "var(--line-strong)" }}
      >
        <p style={{ font: "var(--type-body-strong)" }}>
          Noch keine DeepFight-Daten erfasst.
        </p>
        <p
          className="mt-1"
          style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
        >
          Über &bdquo;Bearbeiten&ldquo; ergänzt du Scouting-Infos zum Gegner —
          nur was du wirklich weißt.
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
          // Drei Zustände, drei Mittel: leer = neutral und gedämpft ·
          // gescoutet = Akzent in Symbol, Zähler und Kante ·
          // geöffnet = zusätzlich gefüllte Fläche (Muster der Athleten-Auswahl
          // in „Neuer Wettkampf").
          const akzent = isEmpty ? "var(--text-3)" : "var(--accent-text)";

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedId(active ? null : category.id)}
              aria-expanded={active}
              data-press="surface"
              className="t-interactive flex flex-col rounded-card p-3.5 text-left"
              style={{
                background: active
                  ? "var(--accent-subtle)"
                  : "var(--surface-raised)",
                border: `1px solid ${
                  active
                    ? "var(--accent)"
                    : isEmpty
                      ? "var(--line)"
                      : "color-mix(in oklab, var(--accent) 30%, var(--line))"
                }`,
                opacity: isEmpty ? 0.6 : 1,
              }}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-field"
                  style={{
                    // Die Symbol-Kachel bleibt in BEIDEN Zuständen die
                    // Kartenfläche: Auf der gefüllten Akzent-Fläche der
                    // geöffneten Karte hebt sie sich dadurch ab, auf der
                    // ruhenden sinkt sie leicht ein.
                    background: "var(--surface-card)",
                    border: `1px solid ${
                      isEmpty
                        ? "var(--line)"
                        : "color-mix(in oklab, var(--accent) 35%, transparent)"
                    }`,
                    color: akzent,
                  }}
                  aria-hidden
                >
                  <DnaCategoryIcon id={category.id} size={16} />
                </span>
                <span
                  style={{
                    ...META_FONT,
                    fontVariantNumeric: "tabular-nums",
                    color: akzent,
                  }}
                >
                  {count}/{total}
                </span>
              </div>

              <span
                className="mt-2 block truncate"
                style={{
                  font: "var(--type-body-strong)",
                  color: isEmpty ? "var(--text-3)" : "var(--text-1)",
                }}
              >
                {category.label}
              </span>

              {/* Fortschritt */}
              <span
                className="t-progress mt-1.5 block"
                style={{ height: "4px" }}
                aria-hidden
              >
                <span
                  style={{
                    width: `${(count / total) * 100}%`,
                    background: isEmpty ? "var(--line)" : "var(--accent)",
                    transition: "width 0.3s ease",
                  }}
                />
              </span>

              {/* Kernaussage-Vorschau */}
              <span
                className="mt-2 block"
                style={{
                  font: "var(--type-sub)",
                  color: "var(--text-3)",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {first ? first.value : "Noch nicht gescoutet"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Detail-Panel der gewählten Kategorie. Der Inhalt wird auch bei
          `open={false}` ausgewertet — deshalb bleibt das `selected &&` stehen;
          die Austritts-Feder behält dabei die zuletzt gerenderte Fassung. */}
      <Collapse open={selected !== null}>
        {selected && (
          <div
            ref={panelRef}
            className="mt-3 rounded-card p-4 sm:p-5"
            style={{
              background: "var(--surface-raised)",
              border:
                "1px solid color-mix(in oklab, var(--accent) 45%, transparent)",
            }}
          >
            <div className="mb-3 flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field"
                style={{
                  background: "var(--surface-card)",
                  border:
                    "1px solid color-mix(in oklab, var(--accent) 40%, transparent)",
                  color: "var(--accent-text)",
                }}
                aria-hidden
              >
                <DnaCategoryIcon id={selected.id} size={18} />
              </span>
              <div className="min-w-0">
                <div
                  className="truncate"
                  style={{
                    font: "var(--type-h3)",
                    letterSpacing: "var(--ls-display)",
                    textTransform: "uppercase",
                  }}
                >
                  {selected.label}
                </div>
                <div
                  className="truncate"
                  style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                >
                  {selected.hint}
                </div>
              </div>
            </div>

            {answeredCount(selected, answers) === 0 ? (
              <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                Zu dieser Kategorie ist noch nichts gescoutet — über
                &bdquo;Bearbeiten&ldquo; ergänzt du sie.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {answeredQuestions(selected, answers).map(
                  ({ question, value }) => (
                    <div key={question.id}>
                      <div
                        className="t-label"
                        style={{ color: "var(--accent-text)" }}
                      >
                        {question.label}
                      </div>
                      {/* Stand bis 04.09.2026 auf einem Token namens „fg-1" —
                          das es in globals.css nie gab. */}
                      <p
                        className="mt-1 whitespace-pre-wrap"
                        style={{
                          font: "var(--type-body)",
                          color: "var(--text-1)",
                        }}
                      >
                        {value}
                      </p>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        )}
      </Collapse>
    </div>
  );
}
