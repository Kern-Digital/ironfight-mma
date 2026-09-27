"use client";

/**
 * Kurs-Zuordnung eines Trainer-Plans (Leon 19.09.) — im Editier-Kopf unter
 * Disziplin.
 *
 * ZUORDNUNG IST NICHT FREIGABE (Leons Entscheidung 19.09.): Der Kurs ordnet
 * den Plan nur ein — für die Ansicht „Nach Kursen" auf /trainer/plans.
 * Sehen können ihn Athleten erst über die Freigabe, und die darf an diesen,
 * an andere oder an mehrere Kurse und einzelne Athleten gehen.
 *
 * EIN CHIP JE KURSNAME, nicht je Termin (Regel in lib/schedule.ts): Wer
 * „MMA Teens" wählt, ordnet den Plan allen vier Terminen zu. Mehrere Kurse
 * gehen gleichzeitig — jeder Chip schaltet für sich.
 *
 * Kein X zum Entfernen: Ein gewählter Chip schaltet per Tipp wieder ab, der
 * Akzent trägt den Zustand (wie die Kurs-Chips im Freigabe-Dialog). OHNE
 * RAHMEN (Leon 19.09.: „weniger Kästen") — nur die Fläche wechselt.
 */

import { Collapse } from "@/components/motion";
import {
  blockById,
  blocksForCourse,
  courseTitles,
  courseTitlesOf,
} from "@/lib/schedule";
import { useKursplan } from "@/lib/kursplan-context";
import { useState } from "react";

const CHIP_FONT = "600 12px/1.2 var(--font-archivo), system-ui, sans-serif";

/** Kursnamen als Aufzählung im Satz: „A", „B" und „C" */
function aufzaehlung(titel: string[]): string {
  const q = titel.map((t) => `„${t}"`);
  if (q.length <= 1) return q.join("");
  return `${q.slice(0, -1).join(", ")} und ${q[q.length - 1]}`;
}

export default function PlanKursZuordnung({
  ids,
  onChange,
}: {
  /** Gespeicherte Termin-IDs aus dem Kursplan des Gyms */
  ids: string[];
  onChange: (ids: string[]) => void;
}) {
  const { kurse } = useKursplan();
  const gewaehlt = courseTitlesOf(kurse, ids);
  const [offen, setOffen] = useState(false);

  function umschalten(titel: string) {
    if (gewaehlt.includes(titel)) {
      // Nur die Termine DIESES Kurses gehen raus. IDs, die sich nicht mehr
      // auflösen (Kurs aus dem Plan genommen), bleiben unangetastet liegen.
      onChange(ids.filter((id) => blockById(kurse, id)?.title !== titel));
      return;
    }
    const neu = blocksForCourse(kurse, titel)
      .map((b) => b.id)
      .filter((id) => !ids.includes(id));
    onChange([...ids, ...neu]);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Zugeklappt steht hier NUR die Zuordnung als Text — die Wand aus
          achtzehn Kurs-Chips erscheint erst auf Wunsch (Leon 19.09.:
          „weniger Kästen"). */}
      <div className="flex items-center justify-between gap-3">
        <span className="t-label">Kurse</span>
        <button
          type="button"
          data-press
          onClick={() => setOffen((v) => !v)}
          aria-expanded={offen}
          className="t-interactive -mr-2 inline-flex min-h-hit items-center rounded-field px-2"
          style={{
            font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--accent-text)",
          }}
        >
          {offen ? "Fertig" : gewaehlt.length > 0 ? "Ändern" : "Zuordnen"}
        </button>
      </div>
      <p style={{ font: "var(--type-body)", color: "var(--text-body)" }}>
        {gewaehlt.length > 0 ? (
          aufzaehlung(gewaehlt)
        ) : (
          <span style={{ color: "var(--text-3)" }}>Keinem Kurs zugeordnet</span>
        )}
      </p>
      {/* Der Hilfstext folgt der Auswahl (Hilfstext-Regel) */}
      <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
        {gewaehlt.length === 0
          ? "Ordne den Plan einem oder mehreren Kursen zu — so findest du ihn unter „Nach Kursen“. Sehen können ihn deine Athleten ab der Freigabe."
          : "Die Zuordnung sortiert nur deine Liste. Sehen können den Plan deine Athleten ab der Freigabe."}
      </p>
      <Collapse open={offen}>
        <div
          role="group"
          aria-label="Kurse"
          className="flex flex-wrap gap-2 pt-1"
        >
          {courseTitles(kurse).map((titel) => {
            const active = gewaehlt.includes(titel);
            return (
              <button
                key={titel}
                type="button"
                data-press
                onClick={() => umschalten(titel)}
                aria-pressed={active}
                className="t-interactive whitespace-nowrap rounded-field px-3 py-2"
                style={{
                  font: CHIP_FONT,
                  background: active
                    ? "var(--accent-subtle)"
                    : "var(--surface-raised)",
                  color: active ? "var(--accent-text)" : "var(--text-2)",
                }}
              >
                {titel}
              </button>
            );
          })}
        </div>
      </Collapse>
    </div>
  );
}
