"use client";

import Icon, { type IconName } from "@/components/ui/Icon";
import Link from "next/link";

/**
 * Schnellzugriff-Kachel: Symbol, Titel, Untertitel.
 *
 * ZWEI DINGE SIND BEIM UMBAU AM 13.09.2026 WEGGEFALLEN:
 *
 * (1) `accent?: string`. Die Seite reichte abwechselnd `--ta-pink` und
 *     `--ta-cyan` herein — vier Kacheln, zwei Farben, ohne Unterschied
 *     dahinter. Alle vier führen an einen anderen Ort; die Farbe trennte sie
 *     nicht, sie verwirrte nur. Jetzt trägt das Symbol den Gym-Akzent, und
 *     ein Gym-Branding färbt alle vier gleichzeitig mit.
 *
 * (2) `card-glass card-interactive`. Beide Klassen stehen noch im ALTEN
 *     System: feste rgba-Werte und damit in BEIDEN Themes eine dunkle Karte,
 *     dazu ein eigenes `translateY(-3px)` unter der Maus, das die Grundhaptik
 *     per Spezifität aus dem Feld schlug (MOTION-BRIEF §3.8). Jetzt
 *     `.t-card` + `.t-interactive` + `data-press="surface"`: die Fläche tönt
 *     sich, die Kachel sinkt um 1 % ein und hebt um 0,8 % — die Stärke, die
 *     der Brief für Karten vorsieht.
 */
export default function QuickAction({
  href,
  icon,
  title,
  sub,
}: {
  href: string;
  icon: IconName;
  title: string;
  sub?: string;
}) {
  return (
    <Link
      href={href}
      data-press="surface"
      className="t-card t-interactive group flex items-center gap-3 p-4"
      style={{ textDecoration: "none" }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-field"
        style={{ color: "var(--accent-text)", background: "var(--surface-raised)" }}
      >
        <Icon name={icon} size={20} />
      </span>
      <span className="min-w-0">
        <span
          className="block truncate"
          style={{
            font: "var(--type-label)",
            letterSpacing: "var(--ls-label)",
            textTransform: "uppercase",
            color: "var(--text-1)",
          }}
        >
          {title}
        </span>
        {sub && (
          <span
            className="block truncate"
            style={{
              font: "var(--type-meta)",
              letterSpacing: "var(--ls-label)",
              textTransform: "uppercase",
              color: "var(--text-3)",
            }}
          >
            {sub}
          </span>
        )}
      </span>
      {/* Der Pfeil stand auf `opacity-0` und erschien erst unter der Maus —
          auf Touch also NIE (MOTION-BRIEF §3.3: „Hover verstärkt, Hover trägt
          nie"). Jetzt steht er immer, gedämpft, und rückt unter dem Zeiger
          nach rechts und in den Akzent. */}
      <span
        className="ml-auto shrink-0 transition-all duration-300 group-hover:translate-x-0.5"
        style={{ color: "var(--text-3)" }}
      >
        <Icon name="arrow-right" size={16} strokeWidth={2.2} />
      </span>
    </Link>
  );
}
