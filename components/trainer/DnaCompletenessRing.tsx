"use client";

/**
 * Vollständigkeits-Ring der Gegner-DNA: zeigt, wie viele der 9 DNA-Kategorien
 * bereits mindestens einen Eintrag haben. Der Trainer sieht auf einen Blick,
 * wie belastbar das Scouting ist — nicht wie "gut" der Gegner ist.
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
  const color =
    covered === 0 ? "var(--fg-4)" : ratio >= 0.667 ? "var(--ta-cyan)" : "#9D7BFA";

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`DeepFight: ${covered} von ${total} Kategorien gescoutet`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: "visible" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--ink-4)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            transition: "stroke-dashoffset 0.4s ease",
            filter:
              covered > 0
                ? `drop-shadow(0 0 6px ${
                    ratio >= 0.667 ? "rgba(35,196,206,0.55)" : "rgba(157,123,250,0.5)"
                  })`
                : undefined,
          }}
        />
      </svg>
      <span
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ gap: size * 0.02 }}
      >
        <span
          className="font-mono-ta font-bold leading-none"
          style={{
            fontSize: size * (label ? 0.22 : 0.24),
            color: covered === 0 ? "var(--fg-4)" : "var(--fg-1)",
          }}
        >
          {covered}/{total}
        </span>
        {label && (
          <span
            className="font-mono-ta uppercase leading-none"
            style={{
              fontSize: Math.max(8, size * 0.1),
              letterSpacing: "0.18em",
              color: "var(--fg-3)",
            }}
          >
            {label}
          </span>
        )}
      </span>
    </div>
  );
}
