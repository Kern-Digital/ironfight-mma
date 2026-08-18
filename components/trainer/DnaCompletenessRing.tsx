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
}: {
  /** Kategorien mit mindestens einer Antwort. */
  covered: number;
  /** Gesamtzahl der Kategorien. */
  total: number;
  size?: number;
  stroke?: number;
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
      aria-label={`Gegner-DNA: ${covered} von ${total} Kategorien gescoutet`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
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
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      <span
        className="font-mono-ta absolute inset-0 flex items-center justify-center font-bold"
        style={{ fontSize: size * 0.24, color: covered === 0 ? "var(--fg-4)" : "var(--fg-1)" }}
      >
        {covered}/{total}
      </span>
    </div>
  );
}
