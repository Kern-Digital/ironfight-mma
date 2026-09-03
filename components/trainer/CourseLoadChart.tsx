"use client";

/**
 * Balkenliste „Auslastung je Kurs" — das zweite Diagramm der Trainer-
 * Übersicht. Ein Balken je Kurs, absteigend sortiert (lib/gym-stats.ts
 * liefert die Reihenfolge), der Wert steht an der Balkenspitze.
 *
 * KURSE OHNE RÜCKMELDUNG FALLEN NICHT HERAUS — sie sind der eigentliche
 * Befund: Entweder ist der Kurs unbeliebt, oder niemand kennt den
 * „Teilnehmen"-Knopf. Sie stehen unten als eigener Abschnitt in ganzen
 * Sätzen, statt als zwei Dutzend Null-Balken die Karte zu sprengen.
 *
 * Eingeklappt zeigt die Liste die ersten acht Kurse; „Alle anzeigen" holt
 * den Rest. So bleibt die Karte neben der Wochenkurve in Balance, ohne dass
 * etwas verschwindet. Balken nutzen den App-Standard `.t-progress`
 * (Akzent-Verlauf auf --surface-raised) und wachsen beim Laden gestaffelt
 * auf ihre Länge — angehalten bei prefers-reduced-motion.
 */

import Icon from "@/components/ui/Icon";
import type { CourseLoad } from "@/lib/gym-stats";
import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

const WEEKDAY_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const COLLAPSED_ROWS = 8;

function courseSlot(c: CourseLoad): string {
  return `${WEEKDAY_SHORT[c.weekday] ?? ""} ${c.startTime}`;
}

export default function CourseLoadChart({
  courses,
}: {
  courses: CourseLoad[];
}) {
  const [expanded, setExpanded] = useState(false);
  const reduced = useReducedMotion();

  const withFeedback = courses.filter((c) => c.count > 0);
  const silent = courses.filter((c) => c.count === 0);
  const visible = expanded
    ? withFeedback
    : withFeedback.slice(0, COLLAPSED_ROWS);
  const maxCount = withFeedback[0]?.count ?? 0;

  return (
    <div className="flex flex-col gap-3">
      {withFeedback.length === 0 ? (
        <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
          Noch hat sich niemand über den Kursplan zurückgemeldet. Sobald
          Mitglieder dort auf „Teilnehmen" tippen, siehst du hier, welche
          Kurse laufen.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {visible.map((c, i) => (
            <div
              key={c.trainingBlockId}
              className="grid items-center gap-3"
              style={{ gridTemplateColumns: "minmax(0, 45%) 1fr auto" }}
            >
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span
                  className="shrink-0"
                  style={{
                    font: "var(--type-nav-meta)",
                    color: "var(--text-3)",
                  }}
                >
                  {courseSlot(c)}
                </span>
                <span
                  className="truncate"
                  style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
                >
                  {c.title}
                </span>
              </span>
              <div className="t-progress">
                <motion.span
                  initial={reduced ? false : { width: "0%" }}
                  animate={{
                    width: `${maxCount > 0 ? (c.count / maxCount) * 100 : 0}%`,
                  }}
                  transition={{
                    duration: 0.6,
                    delay: i * 0.04,
                    ease: [0.2, 0.8, 0.2, 1],
                  }}
                />
              </div>
              <span
                className="w-8 text-right"
                style={{
                  font: "var(--type-num)",
                  fontVariantNumeric: "tabular-nums",
                  color: "var(--text-2)",
                }}
              >
                {c.count}
              </span>
            </div>
          ))}
        </div>
      )}

      {withFeedback.length > COLLAPSED_ROWS && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="t-interactive -ml-2 inline-flex min-h-hit items-center gap-1.5 self-start rounded-field px-2"
          style={{
            font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          {expanded
            ? "Weniger anzeigen"
            : `Alle ${withFeedback.length} Kurse anzeigen`}
          <span
            aria-hidden
            className="flex items-center"
            style={{
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 200ms var(--ease-out)",
            }}
          >
            <Icon name="chevron-down" size={14} strokeWidth={2.2} />
          </span>
        </button>
      )}

      {silent.length > 0 && (
        <div
          className="flex flex-col gap-1.5"
          style={{ borderTop: "1px solid var(--line)", paddingTop: "var(--sp-3)" }}
        >
          <span className="t-label">Ohne Rückmeldung</span>
          <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
            {silent.length === 1
              ? "Aus diesem Kurs kam im ganzen Zeitraum keine einzige Rückmeldung"
              : `Aus diesen ${silent.length} Kursen kam im ganzen Zeitraum keine einzige Rückmeldung`}{" "}
            — entweder nutzt dort niemand den „Teilnehmen"-Knopf, oder der
            Kurs erreicht seine Leute nicht:{" "}
            <span style={{ color: "var(--text-2)" }}>
              {silent.map((c) => `${courseSlot(c)} ${c.title}`).join(" · ")}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
