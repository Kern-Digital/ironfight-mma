"use client";

import Icon, { type IconName } from "@/components/ui/Icon";
import Skeleton from "@/components/ui/Skeleton";
import Link from "next/link";

/**
 * KPI-Kachel mit Icon, optionalem Link und sanftem Hover-Lift.
 * value === null zeigt einen Lade-Skeleton.
 */
export default function StatCard({
  label,
  value,
  icon,
  accent = "var(--ta-cyan)",
  href,
  hint,
}: {
  label: string;
  value: string | null;
  icon: IconName;
  accent?: string;
  href?: string;
  hint?: string;
}) {
  const body = (
    <div className="h-full">
      <div className="flex items-start justify-between gap-2">
        <div
          className="font-mono-ta text-[9px] uppercase"
          style={{ letterSpacing: "0.2em", color: "var(--fg-3)" }}
        >
          {label}
        </div>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ color: accent, background: "rgba(255,255,255,.04)" }}
        >
          <Icon name={icon} size={17} />
        </span>
      </div>
      {value === null ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <div
          className="font-display-ta mt-1 font-black leading-none"
          style={{ fontSize: "30px", color: "var(--fg)" }}
        >
          {value}
        </div>
      )}
      {hint && (
        <div
          className="font-mono-ta mt-1.5 text-[9px] uppercase"
          style={{ letterSpacing: "0.12em", color: "var(--fg-4)" }}
        >
          {hint}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none" }} className="block h-full">
        {body}
      </Link>
    );
  }
  return body;
}
