"use client";

import { useRights } from "@/lib/auth-context";
import { useTrainerHint } from "@/lib/use-trainer-hints";

/**
 * Dismissibler Hinweis nur für Trainer/Admins.
 *
 * Ein Hint wird genau einmal pro Browser gezeigt — `id` ist der Marker.
 * Nicht-Trainer sehen den Hinweis nie.
 *
 * Beispiel:
 *   <TrainerHint id="schedule-overview" title="Stundenplan">
 *     Klicke auf einen Kurs, um Techniken hinzuzufügen.
 *   </TrainerHint>
 */
export default function TrainerHint({
  id,
  title,
  children,
}: {
  id: string;
  title?: string;
  children: React.ReactNode;
}) {
  
  const isTrainer = useRights().trainer;
  const { seen, dismiss } = useTrainerHint(id);

  if (!isTrainer) return null;
  if (seen) return null;

  return (
    <div
      role="status"
      className="animate-fade-in mb-4 flex items-start gap-3 rounded-xl px-4 py-3"
      style={{
        background: "rgba(35,196,206,0.06)",
        border: "1px solid rgba(35,196,206,0.3)",
      }}
    >
      <span
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black"
        style={{ background: "var(--ta-cyan)", color: "var(--ink-1)" }}
        aria-hidden
      >
        i
      </span>
      <div className="flex-1 min-w-0">
        {title && (
          <div
            className="font-mono-ta text-[10px] font-bold uppercase"
            style={{ letterSpacing: "0.18em", color: "var(--ta-cyan)" }}
          >
            Trainer-Tipp · {title}
          </div>
        )}
        <div className="mt-0.5 text-sm" style={{ color: "var(--fg-2)" }}>
          {children}
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label="Hinweis ausblenden"
        className="shrink-0 rounded-md px-2 py-1 text-xs uppercase tracking-widest transition-colors"
        style={{
          color: "var(--fg-4)",
          background: "transparent",
          border: "1px solid var(--ink-5)",
        }}
      >
        Verstanden
      </button>
    </div>
  );
}
