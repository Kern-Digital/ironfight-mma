"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/ui/Icon";
import { useTheme } from "@/lib/theme-context";

/**
 * Bottom-Tab-Bar für die Schüler-Kernbereiche (DESIGN-BRIEF §1.8:
 * Mobile-First/Native-Ready). Referenz: design-handoff dashboard-mobile.html.
 * Wird im Rollout zur App-Shell der Athleten-Ansicht; bis dahin rendert
 * jede umgebaute Seite sie selbst.
 */

const TABS: { href: string; icon: IconName; label: string; activePrefix?: string }[] = [
  { href: "/dashboard", icon: "dumbbell", label: "Training" },
  { href: "/schedule", icon: "calendar", label: "Kursplan" },
  { href: "/kampfprofil", icon: "trophy", label: "Kampfprofil" },
  { href: "/profile", icon: "user", label: "Profil" },
];

export default function AthleteTabBar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-40 px-3"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
    >
      <div className="t-glass mx-auto flex w-full max-w-2xl">
        {TABS.map((tab) => {
          // „Training" deckt das Dashboard UND alle Workout-Routen ab — so
          // bleibt die Orientierung auch auf Unterseiten (Pläne, Runner).
          const active =
            tab.href === "/dashboard"
              ? pathname === "/dashboard" || pathname.startsWith("/workout")
              : pathname.startsWith(tab.activePrefix ?? tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              // Desktop eine Stufe größer (Leon 2026-08-27: Leiste lesbarer):
              // mehr Höhe, Icon 20→22, Label 9→11px — mobil bleibt abgenommen.
              className="t-interactive flex min-h-[56px] flex-1 flex-col items-center justify-center gap-[3px] rounded-card lg:min-h-[64px] lg:gap-1 lg:[&_svg]:h-[22px] lg:[&_svg]:w-[22px]"
              style={{
                color: active ? "var(--accent-text)" : "var(--text-3)",
                textDecoration: "none",
              }}
            >
              <Icon name={tab.icon} size={20} strokeWidth={2} />
              <span
                className="text-[9px] leading-[1.2] lg:text-[11px]"
                style={{
                  fontFamily: "var(--font-archivo), system-ui, sans-serif",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
        {/* Desktop: Hell/Dunkel-Umschalter am Ende der Leiste (mobil sitzt er
            im Dashboard-Kopf) */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={
            theme === "dark" ? "Helles Design aktivieren" : "Dunkles Design aktivieren"
          }
          className="t-interactive hidden min-h-[56px] w-16 flex-none items-center justify-center rounded-card lg:flex lg:min-h-[64px] lg:[&_svg]:h-[22px] lg:[&_svg]:w-[22px]"
          style={{ color: "var(--text-3)", borderLeft: "1px solid var(--line)" }}
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} size={20} strokeWidth={2} />
        </button>
      </div>
    </nav>
  );
}
