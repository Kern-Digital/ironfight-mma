"use client";

import Icon, { type IconName } from "@/components/ui/Icon";

/** Leerer Zustand mit Symbol statt Emoji — für Listen ohne Daten. */
export default function EmptyState({
  icon = "spark",
  title,
  hint,
  children,
}: {
  icon?: IconName;
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-card p-8 text-center"
      style={{ border: "1px dashed var(--line)", background: "var(--surface-card)" }}
    >
      <div
        className="animate-float mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-field"
        style={{ background: "var(--surface-raised)", color: "var(--accent-text)" }}
      >
        <Icon name={icon} size={24} />
      </div>
      {/* „Noch nichts da" ist eine Aussage, kein Kleingedrucktes — deshalb
          --text-2 (lesbarer Fließtext) und nicht --text-3. Der Hinweis
          darunter sagt, was man tun kann, und darf leiser sein. */}
      <p style={{ font: "var(--type-body-strong)", color: "var(--text-2)" }}>{title}</p>
      {hint && (
        <p className="mt-1" style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
          {hint}
        </p>
      )}
      {children && <div className="mt-4 flex justify-center gap-2">{children}</div>}
    </div>
  );
}
