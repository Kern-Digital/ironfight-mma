"use client";

/**
 * Vollständigkeits-Ring der Gegner-DNA: zeigt, wie viele der 9 DNA-Kategorien
 * bereits mindestens einen Eintrag haben. Der Trainer sieht auf einen Blick,
 * wie belastbar das Scouting ist — nicht wie „gut" der Gegner ist.
 *
 * ─── EINE FARBE STATT ZWEI (Rollout-Etappe 3a, 04.09.2026) ─────────────────
 *
 * Der Ring wechselte bei zwei Dritteln von einem Violett auf Cyan. Das war
 * eine zweite Aussage über dieselbe Zahl: Wie weit das Scouting ist, zeigt die
 * Bogenlänge schon vollständig und stufenlos — der Farbwechsel legte darüber
 * eine Schwelle, die es fachlich nicht gibt (bei 5 von 9 ist nichts anders als
 * bei 6 von 9). Dazu war das Violett DeepFights Brand-Farbe an einer Stelle,
 * die nichts über DeepFight aussagt.
 *
 * Jetzt: leer = neutral, alles andere = Gym-Akzent, und die Länge trägt die
 * Auskunft. Damit folgt der Ring auch dem Branding-Kit (DESIGN-BRIEF §1.1).
 */
export default function DnaCompletenessRing({
  covered,
  total,
  size = 56,
  stroke = 5,
  label,
}: {
  /** Kategorien mit mindestens einer Antwort. */
  covered: number;
  /** Gesamtzahl der Kategorien. */
  total: number;
  size?: number;
  stroke?: number;
  /** Optionale Beschriftung unter der Zahl (z. B. „Score"). */
  label?: string;
}) {
  const ratio = total > 0 ? Math.min(1, covered / total) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = covered === 0 ? "var(--text-3)" : "var(--accent)";

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`DeepFight: ${covered} von ${total} Kategorien gescoutet`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ overflow: "visible" }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          style={{ fill: "none", stroke: "var(--surface-raised)" }}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            fill: "none",
            stroke: color,
            transition: "stroke-dashoffset 0.4s ease",
            filter:
              covered > 0
                ? "drop-shadow(0 0 6px color-mix(in oklab, var(--accent) 55%, transparent))"
                : undefined,
          }}
        />
      </svg>
      <span
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ gap: size * 0.02 }}
      >
        {/* Die Schriftgröße hängt am `size`-Prop (der Ring steht mit 40 px in
            der Bibliothek und mit 56+ px im Profilkopf) — dafür gibt es keine
            feste Stufe der Skala. Schnitt und Laufweite kommen trotzdem aus
            den Tokens. */}
        <span
          style={{
            fontFamily: "var(--font-mono), ui-monospace, monospace",
            fontWeight: 700,
            fontSize: size * (label ? 0.22 : 0.24),
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
            color: covered === 0 ? "var(--text-3)" : "var(--text-1)",
          }}
        >
          {covered}/{total}
        </span>
        {label && (
          <span
            style={{
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              fontWeight: 600,
              fontSize: Math.max(8, size * 0.1),
              lineHeight: 1,
              letterSpacing: "var(--ls-label)",
              textTransform: "uppercase",
              color: "var(--text-3)",
            }}
          >
            {label}
          </span>
        )}
      </span>
    </div>
  );
}
