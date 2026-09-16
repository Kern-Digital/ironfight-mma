"use client";

/**
 * Knopf mit laufendem Regenbogen-Rand und farbigem Schein darunter (Vorlage:
 * Magic UI „Rainbow Button", Leon 16.09.2026 für „Analysieren").
 *
 * Angepasst an die App: Default-Export, kein `cn`/shadcn, das Theme kommt
 * über `data-theme` statt über `dark:`. Geometrie und Lauf-Animation stehen
 * als Tailwind-Klassen hier, Farben und die drei Stufen (ruhig · Zeiger ·
 * Klick) in globals.css unter „DER REGENBOGEN-KNOPF".
 *
 * Der Klick-Ring ist ein GESCHWISTER hinter dem Knopf, nicht ein Kind: In
 * einem Stapelkontext malt ein Kind mit negativem z-index ÜBER der Fläche
 * seines Elternteils. Die Hülle ist `isolate`, damit der Ring nicht hinter
 * fremde Flächen der Seite rutscht.
 */

import { useState } from "react";

type RainbowButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export default function RainbowButton({ children, className = "", onClick, ...props }: RainbowButtonProps) {
  const [burst, setBurst] = useState(0);

  return (
    <span className="relative isolate inline-flex rounded-xl">
      {burst > 0 && <span key={burst} aria-hidden className="rainbow-btn__burst" />}
      <button
        type="button"
        data-motion
        {...props}
        onClick={(e) => {
          setBurst((n) => n + 1);
          onClick?.(e);
        }}
        className={[
          "rainbow-btn group relative inline-flex h-11 animate-rainbow cursor-pointer items-center justify-center rounded-xl border-0 bg-[length:200%] px-8 py-2 font-medium",
          "[background-clip:padding-box,border-box,border-box] [background-origin:border-box] [border:calc(0.08*1rem)_solid_transparent]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:pointer-events-none disabled:opacity-50",
          "before:absolute before:bottom-[-20%] before:left-1/2 before:z-0 before:h-1/5 before:w-3/5 before:-translate-x-1/2 before:animate-rainbow before:bg-[length:200%] before:[filter:blur(calc(0.8*1rem))]",
          className,
        ].join(" ")}
      >
        <span className="relative z-[1] inline-flex items-center gap-3">{children}</span>
      </button>
    </span>
  );
}
