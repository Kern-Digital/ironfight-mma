"use client";

import Icon, { type IconName } from "@/components/ui/Icon";
import Link from "next/link";

/**
 * Abschnitts-Kopf mit Titelzeile, optionalem Symbol und „Mehr"-Link.
 *
 * `accent` BLEIBT als Prop bestehen, aber der Standard ist jetzt der
 * GYM-AKZENT statt eines festen Cyans (Umbau 13.09.2026). Das Dashboard reicht
 * gar nichts mehr herein; `/admin/users` reicht noch `--ta-amber` durch und
 * wird in Etappe 4 nachgezogen — deshalb ist die Prop nicht entfallen, sondern
 * nur ihr Vorgabewert getauscht. Wer heute nichts übergibt, folgt dem Branding.
 *
 * DIE AUGENBRAUE TRÄGT DEN AKZENT NICHT MEHR. Sie stand in `accent` und war
 * damit die einzige Stelle, an der ein gedämpftes Rubrik-Label farbig war;
 * dafür gibt es `--text-label` (eine eigene Stufe, gemessen gegen `--text-2`).
 * Farbe bleibt dem Symbol und dem Weg nach „mehr" — beides Dinge, die man
 * anfassen kann.
 */
export default function SectionCard({
  title,
  eyebrow,
  icon,
  accent = "var(--accent-text)",
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
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field"
              style={{ color: accent, background: "var(--surface-raised)" }}
            >
              <Icon name={icon} size={18} />
            </span>
          )}
          <div>
            {eyebrow && <div className="t-label">{eyebrow}</div>}
            <h2
              style={{
                font: "var(--type-h3)",
                letterSpacing: "var(--ls-label)",
                textTransform: "uppercase",
                color: "var(--text-1)",
              }}
            >
              {title}
            </h2>
          </div>
        </div>
        {moreHref && (
          <Link
            href={moreHref}
            data-press
            className="inline-flex shrink-0 items-center gap-1 transition-opacity hover:opacity-75"
            style={{
              font: "var(--type-meta)",
              letterSpacing: "var(--ls-label)",
              textTransform: "uppercase",
              color: accent,
              textDecoration: "none",
            }}
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
