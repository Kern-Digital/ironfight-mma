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
 *
 * Bewegung (Motion-System, 2026-09-04): Hülle ist `SheetShell` aus
 * components/motion — damit hat auch das SCHLIESSEN eine Bewegung. Der
 * Aufrufer rendert das Sheet deshalb immer und meldet „zu" über
 * `exercise={null}`, statt es mit `{x && …}` aus dem Baum zu nehmen.
 */

import Icon, { type IconName } from "@/components/ui/Icon";
import RestWheel, { formatRest } from "@/components/RestWheel";
import { SheetShell, useLetzterWert } from "@/components/motion";
import { EQUIPMENT } from "@/lib/equipment";
import { CATEGORY_LABEL, getTechniqueById } from "@/lib/techniques";
import { DIFFICULTY_LABEL, type Exercise, type Technique } from "@/lib/types";
import { useEffect, useState } from "react";

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
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
 * Den Versatz selbst federt `SheetShell` (`stacked`, Werte STACK_LIFT /
 * STACK_SHRINK in lib/motion.ts); hier bleibt, was CSS besser kann: Die
 * Flächen-Tönung und die min-height. WICHTIG: Das hintere Sheet zieht
 * sich per min-height auf die volle Sheet-Höhe auf — sonst verschwindet
 * ein kurzes Sheet komplett hinter einem längeren (Leons Fund am Handy:
 * „ich sehe nichts").
 */
const STACK_STYLE_TRANSITION =
  "min-height .35s cubic-bezier(.22,.8,.3,1), background .35s ease, border-color .35s ease, box-shadow .35s ease";
/** Vorderes Fenster wirft Schatten NACH OBEN auf die Karte dahinter —
    erst dadurch liest sich der Stapel als „Karte schiebt sich unter" */
const FRONT_SHADOW = "0 -16px 36px rgba(0, 0, 0, 0.45), var(--glass-shadow)";

/**
 * Gemeinsamer Rahmen beider Ebenen: Kopfzeile mit Grabber und x, scrollender
 * Inhalt, optionale Fußzeile — alles INNERHALB der SheetShell-Hülle (mobil
 * Bottom-Sheet, ab sm zentriertes Fenster mit max-w).
 */
function DetailRahmen({
  open,
  label,
  ariaLabel,
  zIndex,
  stacked = false,
  stackTitle,
  onClose,
  children,
  footer,
}: {
  open: boolean;
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
    <SheetShell
      open={open}
      onClose={onClose}
      label={ariaLabel}
      zIndex={zIndex}
      stacked={stacked}
      panelClassName="pointer-events-auto relative flex w-full max-h-[75vh] flex-col overflow-hidden rounded-t-[var(--r-xl)] sm:max-w-xl sm:rounded-[var(--r-xl)]"
      panelStyle={{
        maxHeight: "75dvh",
        // "0px" statt auto — auto→Länge springt statt zu animieren
        minHeight: stacked ? "75dvh" : "0px",
        transition: STACK_STYLE_TRANSITION,
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
    </SheetShell>
  );
}

type DetailAction = { label: string; icon: IconName; onClick: () => void };
type DetailRest = {
  label: string;
  sub?: string;
  seconds: number;
  onChange: (seconds: number) => void;
};

export default function ExerciseDetailSheet({
  exercise,
  onClose,
  action,
  rest,
  zIndex = 50,
}: {
  /** null heißt geschlossen — der Aufrufer setzt es beim Schließen. */
  exercise: Exercise | null;
  onClose: () => void;
  /** Optionaler Aktions-Knopf unten (z. B. „Übung hinzufügen" im Picker) */
  action?: DetailAction;
  /** Rubrik-Pause im Editor (Leons Vorgabe 2026-08-28: die Pause zwischen
      den Runden ist NUR über die Übungsdetails einstellbar) — Tippen auf
      den Wert öffnet das Pausen-Rad. Fehlt der Prop (Runner/Picker),
      erscheint die Zeile nicht. */
  rest?: DetailRest;
  /** Über anderen Sheets (Picker ist z-50 → dort 60 übergeben) */
  zIndex?: number;
}) {
  const open = exercise !== null;
  // Beim Schließen setzt der Aufrufer `exercise` auf null — und mit ihm
  // meist auch `rest` und `action`, die von derselben Auswahl abhängen.
  // Während der Austritts-Feder soll der Inhalt aber vollständig stehen
  // bleiben, deshalb wird das Trio als EINHEIT festgehalten: Ein altes
  // `rest` darf nie zu einer neuen Übung ohne `rest` durchrutschen.
  const zeigen = useLetzterWert(
    exercise ? { exercise, action, rest } : null,
  );

  // Technik-Popup (Ebene über dem Übungs-Detail)
  const [technique, setTechnique] = useState<Technique | null>(null);
  const technikZeigen = useLetzterWert(technique);
  // Pausen-Rad (Ebene über dem Übungs-Detail)
  const [wheelOpen, setWheelOpen] = useState(false);

  // Das Sheet bleibt jetzt im Baum — die inneren Ebenen müssen deshalb
  // beim Schließen von Hand zufallen, sonst stünde beim nächsten Öffnen
  // noch die alte Technik davor.
  useEffect(() => {
    if (!open) {
      setTechnique(null);
      setWheelOpen(false);
    }
  }, [open]);

  return (
    <>
      <DetailRahmen
        open={open}
        label="Übungs-Detail"
        ariaLabel={zeigen ? `Details zu ${zeigen.exercise.name}` : "Übungs-Detail"}
        zIndex={zIndex}
        stacked={technique !== null}
        stackTitle={zeigen?.exercise.name}
        onClose={onClose}
        footer={
          zeigen?.action ? (
            <button
              type="button"
              onClick={zeigen.action.onClick}
              className="t-interactive inline-flex min-h-hit w-full items-center justify-center gap-2 rounded-field px-5"
              style={{
                ...BTN_FONT,
                background: "var(--accent)",
                color: "var(--on-accent)",
                boxShadow: "var(--accent-glow)",
              }}
            >
              <Icon name={zeigen.action.icon} size={13} strokeWidth={2.4} />
              {zeigen.action.label}
            </button>
          ) : undefined
        }
      >
        {zeigen && (
          <ExerciseInhalt
            exercise={zeigen.exercise}
            rest={zeigen.rest}
            onOpenWheel={() => setWheelOpen(true)}
            onOpenTechnique={setTechnique}
          />
        )}
      </DetailRahmen>

      {/* ── Technik-Popup — nur die Technik, kein Seitenwechsel ─────────── */}
      <DetailRahmen
        open={technique !== null}
        label="Technik"
        ariaLabel={technikZeigen ? `Technik ${technikZeigen.name}` : "Technik"}
        zIndex={zIndex + 10}
        onClose={() => setTechnique(null)}
      >
        {technikZeigen && <TechnikInhalt technique={technikZeigen} />}
      </DetailRahmen>

      {/* ── Pausen-Rad über dem Übungs-Detail ───────────────────────────── */}
      {zeigen?.rest && wheelOpen && (
        <RestWheel
          label={zeigen.rest.label}
          value={zeigen.rest.seconds}
          onChange={zeigen.rest.onChange}
          onClose={() => setWheelOpen(false)}
          zIndex={zIndex + 20}
        />
      )}
    </>
  );
}

function ExerciseInhalt({
  exercise,
  rest,
  onOpenWheel,
  onOpenTechnique,
}: {
  exercise: Exercise;
  rest?: DetailRest;
  onOpenWheel: () => void;
  onOpenTechnique: (t: Technique) => void;
}) {
  return (
    <>
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
        {" · "}Intensität {INTENSITY_LABEL[exercise.intensity]}
      </p>

      {/* Rundenpause dieser Übung — nur im Editor-Kontext; das GANZE Feld
          ist der Button und öffnet das Pausen-Rad (Leon 2026-08-28) */}
      {rest && (
        <button
          type="button"
          onClick={onOpenWheel}
          aria-label={`${rest.label} ändern — aktuell ${formatRest(rest.seconds)} Minuten`}
          className="t-interactive mt-4 flex w-full items-center justify-between gap-3 rounded-field px-3.5 py-2.5 text-left"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--line)",
          }}
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="t-label">{rest.label}</span>
            {rest.sub && (
              <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                {rest.sub}
              </span>
            )}
          </span>
          <span
            className="inline-flex shrink-0 items-baseline gap-1 rounded-field px-3.5 py-2 tabular-nums"
            style={{
              font: "700 18px/1 var(--font-archivo), system-ui, sans-serif",
              background: "var(--accent-subtle)",
              border: "1px solid var(--accent)",
              color: "var(--accent-text)",
            }}
          >
            {formatRest(rest.seconds)}
            <span style={{ ...META_FONT, color: "var(--text-3)" }}>min</span>
          </span>
        </button>
      )}

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
                  onClick={() => onOpenTechnique(t)}
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
    </>
  );
}

function TechnikInhalt({ technique }: { technique: Technique }) {
  return (
    <>
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
    </>
  );
}
