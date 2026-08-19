"use client";

import Icon, { type IconName } from "@/components/ui/Icon";
import Link from "next/link";

/**
 * Abschnitts-Container mit Titelzeile, optionalem Icon und "Mehr"-Link.
 * Einheitlicher Rahmen für alle Dashboard-Sektionen.
 */
export default function SectionCard({
  title,
  eyebrow,
  icon,
  accent = "var(--ta-cyan)",
  moreHref,
  moreLabel,
  className,
  children,
}: {
  title: string;
  eyebrow?: string;
  icon?: IconName;
  accent?: string;
  moreHref?: string;
  moreLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={className ?? ""}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {icon && (
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ color: accent, background: "rgba(255,255,255,.04)" }}
            >
              <Icon name={icon} size={18} />
            </span>
          )}
          <div>
            {eyebrow && (
              <div
                className="font-mono-ta text-[9px] uppercase"
                style={{ letterSpacing: "0.2em", color: accent }}
              >
                {eyebrow}
              </div>
            )}
            <h2
              className="font-display-ta font-black uppercase"
              style={{ fontSize: "17px", letterSpacing: "0.05em", color: "var(--fg)" }}
            >
              {title}
            </h2>
          </div>
        </div>
        {moreHref && (
          <Link
            href={moreHref}
            className="font-mono-ta inline-flex shrink-0 items-center gap-1 text-[10px] uppercase transition-opacity hover:opacity-75"
            style={{ letterSpacing: "0.15em", color: accent, textDecoration: "none" }}
          >
            {moreLabel ?? "Alle"}
            <Icon name="arrow-right" size={12} strokeWidth={2.2} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
