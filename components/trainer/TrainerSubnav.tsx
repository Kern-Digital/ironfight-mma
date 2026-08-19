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
  { href: "/trainer", label: "Dashboard", isActive: (p) => p === "/trainer" },
  {
    href: "/trainer/students",
    label: "Schüler",
    isActive: (p) => p.startsWith("/trainer/students"),
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
  { href: "/schedule", label: "Stundenplan", isActive: () => false },
];

/** Schlanke Bereichs-Navigation für den Trainerbereich (unter der Haupt-Navbar). */
export default function TrainerSubnav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Trainerbereich"
      className="border-b"
      style={{ background: "var(--ink-2)", borderColor: "var(--ink-4)" }}
    >
      <div className="mx-auto flex max-w-7xl gap-5 overflow-x-auto px-4 sm:px-6">
        {ITEMS.map((item) => {
          const active = item.isActive(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="font-mono-ta shrink-0 py-2.5 text-[10px] font-bold uppercase transition-colors"
              style={{
                letterSpacing: "0.18em",
                color: active ? "var(--ta-pink)" : "var(--fg-4)",
                borderBottom: active
                  ? "2px solid var(--ta-pink)"
                  : "2px solid transparent",
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
