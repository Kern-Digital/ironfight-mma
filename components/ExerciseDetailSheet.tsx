"use client";

/**
 * Übungs-Detail — Sheet mit allem, was die Übungs-DB zu einer Übung weiß:
 * Eckdaten, Notizen, Cues („Darauf achten"), Fokus, Equipment und verlinkte
 * Techniken. Aus dem Runner extrahiert (Leons Ansage 2026-08-28): EINE
 * Komponente für Runner, Übungs-Picker und Plan-Editor.
 *
 * Darstellung (Leons Feedback 2026-08-28): mobil ein Bottom-Sheet in voller
 * Breite, am Desktop ein ZENTRIERTES Fenster mit begrenzter Breite — nie
 * die ganze Fläche. „Ansehen" bei einer Technik öffnet ein weiteres Popup
 * NUR mit dieser Technik (keine Navigation auf die Technik-Seite; die
 * laufende Session / der Editor bleiben unangetastet).
 */

import Icon, { type IconName } from "@/components/ui/Icon";
import { EQUIPMENT } from "@/lib/equipment";
import { CATEGORY_LABEL, getTechniqueById } from "@/lib/techniques";
import { DIFFICULTY_LABEL, type Exercise, type Technique } from "@/lib/types";
import { useState } from "react";

const META_FONT: React.CSSProperties = {
  font: "600 10px/1.2 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const INTENSITY_LABEL: Record<string, string> = {
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
};

/**
 * Kartei-Effekt (Leons Vorgabe 2026-08-28): Steht ein weiteres Popup vor
 * diesem Sheet, rückt es leicht nach oben und wird etwas schmaler — wie
 * ein hinten angestellter Ordner sichtbar hinter dem vorderen Fenster.
 * Nur scaleX (keine Höhen-Skalierung), damit die Oberkante wirklich über
 * dem vorderen Sheet hervorschaut; das Overlay des vorderen Fensters
 * dunkelt den Stapel automatisch ab. WICHTIG: Das hintere Sheet zieht
 * sich dabei per min-height auf die volle Sheet-Höhe auf — sonst
 * verschwindet ein kurzes Sheet komplett hinter einem längeren
 * (Leons Fund am Handy: „ich sehe nichts").
 */
const STACKED_TRANSFORM = "translateY(-44px) scaleX(0.92)";
const STACK_TRANSITION = "transform .35s cubic-bezier(.22,.8,.3,1)";
const STACK_MIN_HEIGHT_TRANSITION = "min-height .35s cubic-bezier(.22,.8,.3,1)";
/** Vorderes Fenster wirft Schatten NACH OBEN auf die Karte dahinter —
    erst dadurch liest sich der Stapel als „Karte schiebt sich unter" */
const FRONT_SHADOW = "0 -16px 36px rgba(0, 0, 0, 0.45), var(--glass-shadow)";

/**
 * Gemeinsame Hülle beider Ebenen: Overlay + Panel (mobil Bottom-Sheet,
 * ab sm zentriertes Fenster mit max-w).
 */
function SheetShell({
  label,
  ariaLabel,
  zIndex,
  stacked,
  stackTitle,
  onClose,
  children,
  footer,
}: {
  /** Kopfzeilen-Label („Übungs-Detail", „Technik") */
  label: string;
  ariaLabel: string;
  zIndex: number;
  /** Ein weiteres Popup liegt davor → hinten anstellen (Kartei-Look) */
  stacked?: boolean;
  /** Titel im sichtbaren Kartei-Streifen (Fallback: label) */
  stackTitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 flex flex-col justify-end sm:items-center sm:justify-center sm:p-6"
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        aria-label={`${label} schließen`}
        className="absolute inset-0"
        style={{
          background: "var(--overlay)",
          animation: "fade-in 0.2s ease-out both",
        }}
        onClick={onClose}
      />
      {/* Transform auf einer eigenen Hülle — die Einblende-Animation des
          Panels (fill both) würde eine Panel-Transform überschreiben */}
      <div
        className="relative flex w-full justify-center"
        style={{
          transform: stacked ? STACKED_TRANSFORM : undefined,
          transformOrigin: "50% 100%",
          transition: STACK_TRANSITION,
        }}
      >
      <div
        className="animate-slide-up relative flex w-full max-h-[75vh] flex-col overflow-hidden rounded-t-[var(--r-xl)] sm:max-w-xl sm:rounded-[var(--r-xl)]"
        style={{
          maxHeight: "75dvh",
          // "0px" statt auto — auto→Länge springt statt zu animieren
          minHeight: stacked ? "75dvh" : "0px",
          transition: `${STACK_MIN_HEIGHT_TRANSITION}, background .35s ease, border-color .35s ease, box-shadow .35s ease`,
          // Hinten angestellt: Akzent-Tönung + leuchtende Kante — nur
          // heller reichte nicht, das Overlay des vorderen Fensters glich
          // die Flächen wieder an (Leons Feedback)
          background: stacked
            ? "color-mix(in oklab, var(--accent) 18%, color-mix(in oklab, white 10%, var(--surface-card)))"
            : "var(--surface-card)",
          border: "1px solid",
          borderColor: stacked
            ? "color-mix(in oklab, var(--accent) 55%, transparent)"
            : "transparent",
          boxShadow: stacked
            ? "var(--glass-shadow), var(--accent-glow)"
            : FRONT_SHADOW,
        }}
      >
        {/* Kartei-Streifen: statt des Grabbers steht hier der Popup-Titel */}
        {stacked && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-2.5"
            style={{ animation: "fade-in 0.3s ease-out both" }}
          >
            <span
              className="truncate px-6"
              style={{ ...META_FONT, color: "var(--accent-text)" }}
            >
              {stackTitle ?? label}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 px-5 pt-3">
          <div className="flex flex-col items-start">
            <div
              aria-hidden
              className={`mb-2 h-1 w-10 rounded-full sm:invisible${stacked ? " invisible" : ""}`}
              style={{ background: "var(--line-strong)" }}
            />
            <span className="t-label">{label}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="t-interactive inline-flex h-10 w-10 items-center justify-center rounded-field"
            style={{ color: "var(--text-3)" }}
          >
            <Icon name="x" size={16} strokeWidth={2.2} />
          </button>
        </div>
        <div
          className="overflow-y-auto px-5 pt-2"
          style={{
            paddingBottom: footer
              ? "16px"
              : "calc(env(safe-area-inset-bottom, 0px) + 24px)",
          }}
        >
          {children}
        </div>
        {footer && (
          <div
            className="px-5 pt-3"
            style={{
              borderTop: "1px solid var(--line)",
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
            }}
          >
            {footer}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

export default function ExerciseDetailSheet({
  exercise,
  onClose,
  action,
  zIndex = 50,
}: {
  exercise: Exercise;
  onClose: () => void;
  /** Optionaler Aktions-Knopf unten (z. B. „Übung hinzufügen" im Picker) */
  action?: { label: string; icon: IconName; onClick: () => void };
  /** Über anderen Sheets (Picker ist z-50 → dort 60 übergeben) */
  zIndex?: number;
}) {
  // Technik-Popup (Ebene über dem Übungs-Detail)
  const [technique, setTechnique] = useState<Technique | null>(null);

  return (
    <>
      <SheetShell
        label="Übungs-Detail"
        ariaLabel={`Details zu ${exercise.name}`}
        zIndex={zIndex}
        stacked={technique !== null}
        stackTitle={exercise.name}
        onClose={onClose}
        footer={
          action ? (
            <button
              type="button"
              onClick={action.onClick}
              className="t-interactive inline-flex min-h-hit w-full items-center justify-center gap-2 rounded-field px-5"
              style={{
                ...BTN_FONT,
                background: "var(--accent)",
                color: "var(--on-accent)",
                boxShadow: "var(--accent-glow)",
              }}
            >
              <Icon name={action.icon} size={13} strokeWidth={2.4} />
              {action.label}
            </button>
          ) : undefined
        }
      >
        <h2
          style={{
            font: "var(--type-h2)",
            letterSpacing: "var(--ls-display)",
            textTransform: "uppercase",
          }}
        >
          {exercise.name}
        </h2>
        <p className="mt-1" style={{ ...META_FONT, color: "var(--text-3)" }}>
          {exercise.defaultRounds}× {exercise.durationSeconds}s
          {" · "}Pause {exercise.restSeconds}s
          {" · "}Intensität {INTENSITY_LABEL[exercise.intensity]}
        </p>

        {exercise.notes && (
          <p
            className="mt-3"
            style={{ font: "var(--type-body)", color: "var(--text-2)" }}
          >
            {exercise.notes}
          </p>
        )}

        {(exercise.cues?.length ?? 0) > 0 && (
          <div className="mt-5 flex flex-col gap-2">
            <span className="t-label">Darauf achten</span>
            <ul className="flex flex-col gap-1.5">
              {exercise.cues!.map((cue) => (
                <li
                  key={cue}
                  className="flex items-start gap-2"
                  style={{ font: "var(--type-body)", color: "var(--text-2)" }}
                >
                  <span
                    className="mt-[3px] shrink-0"
                    style={{ color: "var(--accent-text)" }}
                  >
                    <Icon name="check" size={14} strokeWidth={2.6} />
                  </span>
                  {cue}
                </li>
              ))}
            </ul>
          </div>
        )}

        {exercise.focus.length > 0 && (
          <div className="mt-5 flex flex-col gap-2">
            <span className="t-label">Fokus</span>
            <div className="flex flex-wrap gap-1.5">
              {exercise.focus.map((f) => (
                <span
                  key={f}
                  className="rounded-badge px-2 py-1"
                  style={{
                    ...META_FONT,
                    background: "var(--surface-raised)",
                    border: "1px solid var(--line)",
                    color: "var(--text-2)",
                  }}
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-1">
          <span className="t-label">Equipment</span>
          <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
            {exercise.equipment.length > 0
              ? exercise.equipment
                  .map((id) => EQUIPMENT[id]?.label)
                  .filter(Boolean)
                  .join(" · ")
              : EQUIPMENT.bodyweight.label}
          </p>
        </div>

        {(exercise.techniqueIds?.length ?? 0) > 0 && (
          <div className="mt-5 flex flex-col gap-2">
            <span className="t-label">Techniken dazu</span>
            <div className="flex flex-col gap-2">
              {exercise
                .techniqueIds!.map((id) => getTechniqueById(id))
                .filter((t): t is Technique => Boolean(t))
                .map((t) => (
                  // Popup statt Seitenwechsel — Session/Editor bleiben stehen
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTechnique(t)}
                    className="t-interactive flex min-h-hit items-center justify-between gap-3 rounded-field px-3 text-left"
                    style={{
                      background: "var(--surface-raised)",
                      border: "1px solid var(--line)",
                      color: "var(--text-body)",
                    }}
                  >
                    <span
                      className="min-w-0 flex-1 truncate"
                      style={{ font: "var(--type-body-strong)" }}
                    >
                      {t.name}
                    </span>
                    <span style={{ ...META_FONT, color: "var(--text-3)" }}>
                      Ansehen
                    </span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </SheetShell>

      {/* ── Technik-Popup — nur die Technik, kein Seitenwechsel ─────────── */}
      {technique && (
        <SheetShell
          label="Technik"
          ariaLabel={`Technik ${technique.name}`}
          zIndex={zIndex + 10}
          onClose={() => setTechnique(null)}
        >
          <h2
            style={{
              font: "var(--type-h2)",
              letterSpacing: "var(--ls-display)",
              textTransform: "uppercase",
            }}
          >
            {technique.name}
          </h2>
          <p className="mt-1" style={{ ...META_FONT, color: "var(--text-3)" }}>
            {DIFFICULTY_LABEL[technique.difficulty]}
            {" · "}
            {CATEGORY_LABEL[technique.category]}
          </p>

          {technique.description && (
            <p
              className="mt-3"
              style={{ font: "var(--type-body)", color: "var(--text-2)" }}
            >
              {technique.description}
            </p>
          )}

          {technique.steps.length > 0 && (
            <div className="mt-5 flex flex-col gap-2">
              <span className="t-label">Schritt für Schritt</span>
              <ol className="flex flex-col gap-1.5">
                {technique.steps.map((step, i) => (
                  <li
                    key={step}
                    className="flex items-start gap-2.5"
                    style={{ font: "var(--type-body)", color: "var(--text-2)" }}
                  >
                    <span
                      className="shrink-0 tabular-nums"
                      style={{
                        ...META_FONT,
                        color: "var(--accent-text)",
                        marginTop: "4px",
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {technique.commonMistakes.length > 0 && (
            <div className="mt-5 flex flex-col gap-2">
              <span className="t-label">Häufige Fehler</span>
              <ul className="flex flex-col gap-1.5">
                {technique.commonMistakes.map((m) => (
                  <li
                    key={m}
                    className="flex items-start gap-2"
                    style={{ font: "var(--type-body)", color: "var(--text-2)" }}
                  >
                    <span
                      className="mt-[3px] shrink-0"
                      style={{ color: "var(--negative)" }}
                    >
                      <Icon name="x" size={14} strokeWidth={2.4} />
                    </span>
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {technique.usage && (
            <div className="mt-5 flex flex-col gap-1">
              <span className="t-label">Einsatz</span>
              <p style={{ font: "var(--type-body)", color: "var(--text-2)" }}>
                {technique.usage}
              </p>
            </div>
          )}
        </SheetShell>
      )}
    </>
  );
}
