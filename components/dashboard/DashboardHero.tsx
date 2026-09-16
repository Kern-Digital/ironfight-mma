"use client";

import Icon, { type IconName } from "@/components/ui/Icon";

/**
 * Rollen-Hero der Dashboards: Foto der Halle, darüber ein Schleier, darauf
 * Rollen-Plakette, Begrüßung und eine hereinwachsende Akzentlinie.
 *
 * ─── WAS AM 13.09.2026 UMGEBAUT WURDE ──────────────────────────────────────
 *
 * (1) `HeroAccent` ist ERSATZLOS WEG. Der Hero kannte drei Farben — „cyan",
 *     „pink", „amber" — als je drei feste rgba-Werte, und die Seite reichte
 *     sie je ROLLE herein: Trainer rosa, Admin bernstein. Das ist Farbe als
 *     alleiniges Signal, und genau die wurde für die Bereichsfarben schon
 *     einmal abgelehnt. Es steht ohnehin in Worten da („Trainer", „Admin"),
 *     mit eigenem Symbol daneben. Jetzt tragen alle Plaketten den Gym-Akzent,
 *     und ein Branding färbt sie mit.
 *
 * (2) DER HERO IST JETZT IN BEIDEN THEMES ZU HAUSE. Vorher war er hart dunkel:
 *     `rgba(3,4,6,.96)` als Schleier, `text-white` als Überschrift. Im hellen
 *     Theme saß dadurch ein schwarzer Balken über einer hellen Seite — ein
 *     Zustand, den DESIGN-BRIEF §1.3 ausschließt („Light ist gleichwertig").
 *     Der Schleier mischt jetzt aus `--surface-page`, die Schrift steht auf
 *     `--text-1`. Die Deckkraft-Staffelung bleibt, wie sie war: DORT, WO TEXT
 *     STEHT, ist der Schleier fast undurchsichtig (96 %) — der Kontrast der
 *     Überschrift ist deshalb praktisch der von Text auf `--surface-page` und
 *     hängt nicht am Foto. Erst nach rechts, wo nichts steht, wird er offener.
 *
 * (3) Die `.retro-scanlines` sind geblieben. Sie sind ein Weiß-Raster mit
 *     2,5 % Deckkraft auf einem Foto — kein Farbwert der Oberfläche, und im
 *     hellen Theme praktisch unsichtbar. Ein eigener Token dafür wäre Aufwand
 *     ohne Wirkung.
 */
export default function DashboardHero({
  badges,
  title,
  subtitle,
  children,
}: {
  badges: { label: string; icon?: IconName }[];
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="relative overflow-hidden border-b"
      style={{ borderColor: "var(--line)" }}
    >
      {/* Foto der Halle, stark zurückgenommen */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url(/images/hero-gym.png)",
          backgroundSize: "cover",
          backgroundPosition: "center 35%",
          opacity: 0.35,
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(105deg," +
            " color-mix(in oklab, var(--surface-page) 96%, transparent) 30%," +
            " color-mix(in oklab, var(--surface-page) 78%, transparent) 60%," +
            " color-mix(in oklab, var(--surface-page) 55%, transparent))," +
            " radial-gradient(420px 260px at 95% 10%," +
            " color-mix(in oklab, var(--accent) 14%, transparent), transparent 65%)",
        }}
        aria-hidden="true"
      />
      <div className="retro-scanlines absolute inset-0" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="rise flex items-center gap-2">
          {badges.map((b) => (
            <span
              key={b.label}
              className="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1"
              style={{
                font: "var(--type-meta)",
                letterSpacing: "var(--ls-label)",
                textTransform: "uppercase",
                background: "var(--accent-subtle)",
                border:
                  "1px solid color-mix(in oklab, var(--accent) 35%, transparent)",
                color: "var(--accent-text)",
              }}
            >
              {b.icon && <Icon name={b.icon} size={12} strokeWidth={2.2} />}
              {b.label}
            </span>
          ))}
        </div>

        <h1
          className="rise-1 mt-3 uppercase leading-none"
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 800,
            fontSize: "clamp(30px, 5vw, 50px)",
            letterSpacing: "var(--ls-display)",
            color: "var(--text-1)",
          }}
        >
          {title}
        </h1>

        {/* Akzentlinie */}
        <div
          className="animate-grow-x mt-3 h-[3px] w-24 rounded-pill"
          style={{ background: "linear-gradient(90deg, var(--accent), transparent)" }}
        />

        {subtitle && (
          <p
            className="rise-2 mt-3"
            style={{
              font: "var(--type-meta)",
              letterSpacing: "var(--ls-label)",
              textTransform: "uppercase",
              color: "var(--text-2)",
            }}
          >
            {subtitle}
          </p>
        )}

        {children && <div className="rise-3 mt-5">{children}</div>}
      </div>
    </div>
  );
}
