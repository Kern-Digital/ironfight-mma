"use client";

import Icon, { type IconName } from "@/components/ui/Icon";
import Skeleton from "@/components/ui/Skeleton";
import Link from "next/link";

/**
 * KPI-Kachel: Beschriftung, Zahl, Symbol. `value === null` zeigt einen
 * Lade-Platzhalter.
 *
 * DER TON IST EIN ZUSTAND, KEINE FARBWAHL DES AUFRUFERS (Umbau 13.09.2026).
 * Vorher nahm die Kachel `accent?: string` und bekam von der Seite abwechselnd
 * `--ta-pink` und `--ta-cyan` gereicht — vier Kacheln, zwei Farben, im Wechsel,
 * ohne dass ein Unterschied dahinter stand. Farbe behauptete dort eine Ordnung,
 * die es nicht gibt (dieselbe Entscheidung wie bei `category.accent` in
 * `DnaCategoryGrid` und `GegnerDnaAccordion`).
 *
 * Jetzt gibt es genau zwei Töne, und sie beantworten eine Frage:
 *   `accent` — hier steht etwas an (Standard)
 *   `quiet`  — hier steht gerade nichts an („Heute: Frei")
 * Die einzige Stelle, die den Ton vorher WIRKLICH aus einem Zustand ableitete
 * (`todayBlocks.length > 0 ? … : …`), behält damit genau ihre Bedeutung.
 */
export default function StatCard({
  label,
  value,
  icon,
  tone = "accent",
  href,
  hint,
}: {
  label: string;
  value: string | null;
  icon: IconName;
  tone?: "accent" | "quiet";
  href?: string;
  hint?: string;
}) {
  const symbolFarbe = tone === "accent" ? "var(--accent-text)" : "var(--text-3)";
  const body = (
    <div className="h-full">
      <div className="flex items-start justify-between gap-2">
        <div
          style={{
            font: "var(--type-meta)",
            letterSpacing: "var(--ls-label)",
            textTransform: "uppercase",
            color: "var(--text-label)",
          }}
        >
          {label}
        </div>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-badge"
          style={{ color: symbolFarbe, background: "var(--surface-raised)" }}
        >
          <Icon name={icon} size={17} />
        </span>
      </div>
      {value === null ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <div
          className="mt-1"
          style={{
            font: "var(--type-num-xl)",
            fontVariantNumeric: "tabular-nums",
            color: "var(--text-1)",
          }}
        >
          {value}
        </div>
      )}
      {hint && (
        <div
          className="mt-1.5"
          style={{
            font: "var(--type-meta)",
            letterSpacing: "var(--ls-label)",
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        data-press="surface"
        style={{ textDecoration: "none" }}
        className="block h-full"
      >
        {body}
      </Link>
    );
  }
  return body;
}
