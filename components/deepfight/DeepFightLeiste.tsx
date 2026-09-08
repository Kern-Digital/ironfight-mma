"use client";

/**
 * Die Glas-Leiste des DeepFight-Bereichs: Wortmarke links, daneben die drei
 * Segmente Analysieren · Gegner · Athleten.
 *
 * SIE ERSETZT DIE DREI MENÜPUNKTE (Leons Neuaufbau 05.09.2026): In der
 * Sidebar steht nur noch „DeepFight"; wohin es im Bereich geht, wählt man
 * HIER, im Inhalt. Die Segmente sind Adressen, keine Tabs — jede ist
 * verlinkbar, der Browser-Zurück-Knopf funktioniert.
 *
 * SIE STEHT AUF GLAS, NICHT AUF DEM HINTERGRUND: Die Regel des Bereichs
 * (globals.css, „Der DeepFight-Bereich") verlangt, dass Text immer auf einer
 * Karte sitzt — die bewegte Schicht dahinter hat keine Farbe, gegen die sich
 * ein Kontrast messen ließe. Deshalb `.t-card`, das im Bereich zu Glas wird.
 *
 * Die Wortmarke ist hier kein <h1>: Die Bibliotheken bringen ihren Seitenkopf
 * mit, und zwei Hauptüberschriften auf einer Seite ordnen nichts.
 */

import DeepFightWordmark from "@/components/DeepFightWordmark";
import Link from "next/link";
import { usePathname } from "next/navigation";

const SEGMENTE: { href: string; label: string; aktiv: (p: string) => boolean }[] = [
  {
    href: "/trainer/deepfight",
    label: "Analysieren",
    aktiv: (p) => p === "/trainer/deepfight",
  },
  {
    href: "/trainer/deepfight/gegner",
    label: "Gegner",
    aktiv: (p) => p.startsWith("/trainer/deepfight/gegner"),
  },
  {
    href: "/trainer/deepfight/athleten",
    label: "Athleten",
    aktiv: (p) => p.startsWith("/trainer/deepfight/athleten"),
  },
];

const SEGMENT_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

export default function DeepFightLeiste() {
  const pathname = usePathname();
  return (
    <div className="t-card flex flex-wrap items-center gap-x-4 gap-y-2 rounded-pill px-3 py-1.5 sm:px-4">
      <span
        className="flex min-h-hit items-center"
        style={{ font: "var(--type-h3)", color: "var(--text-1)" }}
      >
        <DeepFightWordmark />
      </span>
      <nav
        aria-label="DeepFight-Bereich"
        className="flex flex-wrap items-center gap-1.5 sm:ml-auto"
      >
        {SEGMENTE.map((s) => {
          const aktiv = s.aktiv(pathname);
          return (
            <Link
              key={s.href}
              href={s.href}
              data-press
              aria-current={aktiv ? "page" : undefined}
              className="t-interactive inline-flex min-h-hit items-center rounded-pill px-3.5"
              style={{
                ...SEGMENT_FONT,
                background: aktiv ? "var(--accent-subtle)" : "transparent",
                border: `1px solid ${aktiv ? "var(--accent)" : "transparent"}`,
                color: aktiv ? "var(--accent-text)" : "var(--text-2)",
                textDecoration: "none",
              }}
            >
              {s.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
