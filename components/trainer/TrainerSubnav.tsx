"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import DeepFightWordmark from "@/components/DeepFightWordmark";

interface SubnavItem {
  href: string;
  label: React.ReactNode;
  isActive: (pathname: string) => boolean;
}

const ITEMS: SubnavItem[] = [
  // „Übersicht" statt „Dashboard": deutsche UI-Texte sind Konvention, und der
  // Punkt heißt jetzt genauso wie die Überschrift der Seite (wie bei den
  // Verwaltungs-Seiten, wo Menüpunkt und H1 dasselbe Wort tragen).
  { href: "/trainer", label: "Übersicht", isActive: (p) => p === "/trainer" },
  {
    href: "/trainer/athleten",
    label: "Athleten",
    isActive: (p) => p.startsWith("/trainer/athleten"),
  },
  {
    href: "/trainer/opponents",
    label: <DeepFightWordmark />,
    isActive: (p) =>
      p.startsWith("/trainer/opponents") || p.startsWith("/trainer/deepfight"),
  },
  {
    href: "/trainer/competitions",
    label: "Wettkampf",
    isActive: (p) => p.startsWith("/trainer/competitions"),
  },
  // Stundenplan lebt bewusst unter /schedule (URL-Stabilität) — nur verlinkt.
  { href: "/schedule", label: "Kursplan", isActive: () => false },
];

/**
 * Bereichs-Navigation des Trainerbereichs (unter der Haupt-Navigation).
 *
 * Token-Look (Coach-Redesign): Der aktive Punkt trägt die Gym-Akzentfarbe
 * statt des festen Pinks — damit folgt die Leiste einem Gym-Branding, ohne
 * dass jemand sie anfassen muss (DESIGN-BRIEF §1.1). Höhe ≥ 44 px, weil die
 * Leiste auf dem Handy das meistbenutzte Ziel des Bereichs ist (§1.8).
 */
export default function TrainerSubnav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Trainerbereich"
      style={{
        background: "var(--surface-page)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div className="no-scrollbar mx-auto flex w-full max-w-2xl gap-5 overflow-x-auto px-4 lg:max-w-5xl lg:px-6">
        {ITEMS.map((item) => {
          const active = item.isActive(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="t-interactive flex min-h-hit shrink-0 items-center rounded-none"
              style={{
                font: "var(--type-label)",
                letterSpacing: "var(--ls-label)",
                textTransform: "uppercase",
                color: active ? "var(--accent-text)" : "var(--text-3)",
                // Die Linie liegt innen (box-shadow statt border), damit die
                // Zeilenhöhe zwischen aktivem und ruhendem Punkt gleich bleibt.
                boxShadow: active ? "inset 0 -2px 0 0 var(--accent)" : "none",
                textDecoration: "none",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
