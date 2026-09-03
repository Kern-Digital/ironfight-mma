"use client";

import Icon from "@/components/ui/Icon";
import { useRights } from "@/lib/auth-context";
import { useTrainerHint } from "@/lib/use-trainer-hints";

/**
 * Dismissibler Hinweis für die Stab-Rollen — Trainer UND Verwaltung.
 *
 * Ein Hint wird genau einmal pro Browser gezeigt — `id` ist der Marker.
 * Athleten sehen den Hinweis nie.
 *
 * WARUM AUCH DIE VERWALTUNG (seit 02.09.2026): Der Hinweis erklärt ein
 * Werkzeug in dem Moment, in dem jemand es zum ersten Mal sieht. Seit die
 * Verwaltung den Kursplan pflegen darf (Konzept §7), bekäme sie sonst neue
 * Knöpfe ohne ein Wort dazu. Vier der fünf Einsatzorte liegen unter
 * `/trainer/*` und ändern sich dadurch nicht — dorthin kommt eine reine
 * Verwaltung gar nicht erst (Middleware). Die Beschriftung folgt dem Leser:
 * „Trainer-Tipp" nur, wenn wirklich ein Trainer davorsitzt.
 *
 * Token-Look (Coach-Redesign): Der Rahmen bleibt — ein Hinweis ist ein
 * hervorgehobener, wegklickbarer Zustand, kein Inhaltsblock (Rahmen-Regel).
 * Er trägt den Gym-Akzent, damit er einem Branding folgt.
 *
 * Beispiel:
 *   <TrainerHint id="schedule-overview" title="Kursplan">
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
  const rights = useRights();
  const { seen, dismiss } = useTrainerHint(id);

  if (!rights.trainer && !rights.verwaltung) return null;
  if (seen) return null;

  return (
    <div
      role="status"
      // Auf dem Handy steht „Verstanden" UNTER dem Text: als dritte Spalte
      // presste der Knopf den Satz auf drei Wörter pro Zeile (gemessen auf
      // 390 px). Ab sm ist Platz, dort sitzt er wieder rechts.
      className="animate-fade-in flex flex-col gap-2 rounded-card p-4 sm:flex-row sm:items-start sm:gap-3"
      style={{
        background: "var(--accent-subtle)",
        border: "1px solid color-mix(in oklab, var(--accent) 45%, transparent)",
      }}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
      <span
        aria-hidden
        className="mt-0.5 shrink-0"
        style={{ color: "var(--accent-text)" }}
      >
        <Icon name="info" size={20} strokeWidth={2} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title && (
          <span className="t-label" style={{ color: "var(--accent-text)" }}>
            {rights.trainer ? "Trainer-Tipp" : "Tipp"} · {title}
          </span>
        )}
        <span style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
          {children}
        </span>
      </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hinweis ausblenden"
        className="t-interactive -ml-3 shrink-0 self-start rounded-field px-3 py-2 sm:-ml-0 sm:-mr-1 sm:-mt-1"
        style={{
          font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-3)",
          background: "transparent",
        }}
      >
        Verstanden
      </button>
    </div>
  );
}
