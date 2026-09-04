"use client";

/**
 * Dev-only Sichtprüfung für die Sheet-Choreografie (Motion-System, 2026-09-04).
 *
 * Rendert das Übungs-Detail ohne Firebase-Login mit einer Übung aus der
 * Übungs-DB, die verlinkte Techniken hat — damit lässt sich der
 * Kartei-Stapel (Detail → Technik davor) headless screenshotten:
 * scripts/motion-sheet-shots.mjs fährt die Zustände ab. In Produktion
 * liefert die Route 404; sie liegt bewusst außerhalb des
 * Middleware-Matchers (wie /dev/helix).
 */

import { notFound } from "next/navigation";
import { useState } from "react";
import ExerciseDetailSheet from "@/components/ExerciseDetailSheet";
import { getExerciseById } from "@/lib/exercises";

export default function MotionSheetDevPage() {
  const [open, setOpen] = useState(false);
  const [restSeconds, setRestSeconds] = useState(60);
  // Schattenboxen trägt drei Techniken — genug für den Stapel-Test.
  const exercise = getExerciseById("warmup_shadowbox") ?? null;

  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main
      className="min-h-screen px-4 py-8"
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <h1 className="t-label">Motion-Sheet · Dev</h1>
        <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
          Übungs-Detail öffnen, dann eine Technik antippen — das Detail stellt
          sich hinten an. Schließen federt beides zurück.
        </p>
        <button
          type="button"
          data-testid="sheet-open"
          onClick={() => setOpen(true)}
          className="t-interactive inline-flex min-h-hit items-center justify-center rounded-field px-5"
          style={{
            font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            background: "var(--accent)",
            color: "var(--on-accent)",
            boxShadow: "var(--accent-glow)",
          }}
        >
          Übungs-Detail öffnen
        </button>
      </div>

      <ExerciseDetailSheet
        exercise={open ? exercise : null}
        onClose={() => setOpen(false)}
        rest={{
          label: "Pause zwischen den Runden",
          sub: "Gilt nur für diese Übung",
          seconds: restSeconds,
          onChange: setRestSeconds,
        }}
      />
    </main>
  );
}
