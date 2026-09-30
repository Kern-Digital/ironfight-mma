/**
 * Das Kästchen vor jedem Namen: Profilbild, wenn das Konto eins gewählt hat,
 * sonst das Namenskürzel — in DERSELBEN Hülle, damit eine Liste mit beiden
 * Sorten ruhig in einer Flucht steht (Leon 29.09.2026).
 *
 * Die Auswahl selbst lebt auf /profile; die Bilder und IDs in
 * lib/profilbilder.ts. Der Baustein ist Dekoration — der Name steht immer
 * daneben —, deshalb `aria-hidden` und ein leeres `alt`.
 */

import type { CSSProperties } from "react";
import { profilbildSrc, type ProfilbildId } from "@/lib/profilbilder";

type Groesse = "sm" | "md" | "lg";

const RAHMEN: Record<Groesse, { className: string; font: string; border: number }> = {
  sm: { className: "h-8 w-8 rounded-field", font: "var(--type-meta)", border: 40 },
  md: { className: "h-10 w-10 rounded-field", font: "var(--type-body-strong)", border: 35 },
  lg: { className: "h-14 w-14 rounded-card", font: "var(--type-h2)", border: 40 },
};

export default function Profilbild({
  avatar,
  kuerzel,
  groesse = "md",
  className = "",
  style,
}: {
  avatar: ProfilbildId | null | undefined;
  kuerzel: string;
  groesse?: Groesse;
  className?: string;
  /** Überschreibt die Akzent-Hülle (z. B. Rollenfarben in /admin/users). */
  style?: CSSProperties;
}) {
  const r = RAHMEN[groesse];
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center overflow-hidden ${r.className} ${className}`}
      style={{
        font: r.font,
        letterSpacing: "var(--ls-label)",
        background: avatar ? "var(--surface-raised)" : "var(--accent-subtle)",
        border: `1px solid color-mix(in oklab, var(--accent) ${r.border}%, transparent)`,
        color: "var(--accent-text)",
        ...style,
      }}
    >
      {avatar ? (
        // Vorgerechnete 256-px-WebP (~10 KB) — next/image brächte hier nichts.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profilbildSrc(avatar)}
          alt=""
          width={256}
          height={256}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="h-full w-full object-cover"
        />
      ) : (
        kuerzel
      )}
    </span>
  );
}
