"use client";

import Link from "next/link";
import Image from "next/image";
import Icon, { type IconName } from "@/components/ui/Icon";
import Reveal from "@/components/dashboard/Reveal";
import { useAuth } from "@/lib/auth-context";
import { greetingFor } from "@/lib/greeting";
import { useTheme } from "@/lib/theme-context";

// ─── Data ─────────────────────────────────────────────────────────────────────

type Accent = {
  /** Hauptfarbe */
  c: string;
  /** Heller Schein hinter dem Icon */
  glow: string;
  /** Kartenverlauf dunkel */
  bgDark: string;
  /** Kartenverlauf hell */
  bgLight: string;
  border: string;
};

const ACCENTS: Record<string, Accent> = {
  green: {
    c: "#3EE06B",
    glow: "rgba(62,224,107,.30)",
    bgDark: "linear-gradient(150deg, #0A2E16, #0A1410 70%)",
    bgLight: "linear-gradient(150deg, #D9F8E2, #F0FDF4 70%)",
    border: "rgba(62,224,107,.4)",
  },
  cyan: {
    c: "#23C4CE",
    glow: "rgba(35,196,206,.35)",
    bgDark: "linear-gradient(150deg, #06302E, #0A0716 70%)",
    bgLight: "linear-gradient(150deg, #D6F5F9, #F2FBFD 70%)",
    border: "rgba(35,196,206,.35)",
  },
  pink: {
    c: "#FF4FA8",
    glow: "rgba(255,79,168,.32)",
    bgDark: "linear-gradient(150deg, #350A23, #120714 70%)",
    bgLight: "linear-gradient(150deg, #FBDDE9, #FDF1F6 70%)",
    border: "rgba(255,79,168,.35)",
  },
  // Disziplin-Familienfarben (siehe lib/discipline-colors.ts):
  // violet = Kicks-Familie (Muay Thai/Kickboxen), amber = Boden-Familie (BJJ).
  violet: {
    c: "#8A63E8",
    glow: "rgba(138,99,232,.32)",
    bgDark: "linear-gradient(150deg, #251341, #100A1C 70%)",
    bgLight: "linear-gradient(150deg, #E9E2FB, #F6F3FD 70%)",
    border: "rgba(138,99,232,.35)",
  },
  amber: {
    c: "#FFB648",
    glow: "rgba(255,182,72,.3)",
    bgDark: "linear-gradient(150deg, #33200D, #150F08 70%)",
    bgLight: "linear-gradient(150deg, #FBF0D2, #FDF9EE 70%)",
    border: "rgba(255,182,72,.4)",
  },
};

const disciplines: {
  slug: string;
  name: string;
  tag: string;
  desc: string;
  icon: IconName;
  accent: keyof typeof ACCENTS;
}[] = [
  { slug: "boxing", name: "Boxing", tag: "Stand-Up", desc: "Schlagtechnik · Footwork · Kondition", icon: "glove", accent: "cyan" },
  { slug: "wrestling", name: "Wrestling", tag: "Grappling", desc: "Takedowns · Kontrolle · Power", icon: "grapple", accent: "pink" },
  { slug: "bjj", name: "BJJ", tag: "Ground", desc: "Submissions · Guard · Sweeps", icon: "gi", accent: "amber" },
  { slug: "muay-thai", name: "Muay Thai", tag: "Stand-Up", desc: "Kicks · Knie · Clinch", icon: "kick", accent: "violet" },
];

interface QuickActionDef {
  icon: IconName;
  title: string;
  sub: string;
  href: string;
  accent: keyof typeof ACCENTS;
}

const guestQuickActions: QuickActionDef[] = [
  { icon: "timer", title: "Timer", sub: "Runde starten", href: "/timer", accent: "cyan" },
  { icon: "spark", title: "Workout", sub: "Generator", href: "/workout/generator", accent: "pink" },
  { icon: "book", title: "Techniken", sub: "Bibliothek", href: "/techniques", accent: "cyan" },
  { icon: "shield", title: "Regeln", sub: "Quiz & Wissen", href: "/regeln", accent: "pink" },
];

const userQuickActions: QuickActionDef[] = [
  { icon: "timer", title: "Timer", sub: "Runde starten", href: "/timer", accent: "cyan" },
  { icon: "spark", title: "Workout", sub: "Generator", href: "/workout/generator", accent: "pink" },
  { icon: "book", title: "Techniken", sub: "Bibliothek", href: "/techniques", accent: "cyan" },
  { icon: "chart", title: "Verlauf", sub: "Statistiken", href: "/dashboard", accent: "pink" },
];

const features: { icon: IconName; title: string; desc: string; accent: keyof typeof ACCENTS }[] = [
  {
    icon: "timer",
    title: "Smarter Timer",
    desc: "Professioneller Interval-Timer mit Runden, Pausen und Audio-Cues — für jeden Kampfsport konfigurierbar.",
    accent: "cyan",
  },
  {
    icon: "book",
    title: "Technik-Bibliothek",
    desc: "Hunderte Techniken aus Boxing, BJJ, Wrestling und Muay Thai — mit Erklärungen, Variationen und Kurszuordnung.",
    accent: "pink",
  },
  {
    icon: "spark",
    title: "Workout-Generator",
    desc: "Strukturierte Workouts nach Disziplin und Ausrüstung — automatisch generiert, sofort startbereit.",
    accent: "cyan",
  },
];

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  eyebrow,
  eyebrowColor,
  title,
  highlight,
  moreHref,
  moreLabel,
}: {
  eyebrow: string;
  eyebrowColor: string;
  title: string;
  highlight?: string;
  moreHref?: string;
  moreLabel?: string;
}) {
  return (
    <div className="mb-8 flex items-end justify-between">
      <div>
        <div className="flex items-center gap-2.5">
          <span
            className="block h-[2px] w-8 rounded-full"
            style={{ background: eyebrowColor }}
          />
          <span
            className="font-mono-ta text-[10px] uppercase"
            style={{ letterSpacing: "0.25em", color: eyebrowColor }}
          >
            {eyebrow}
          </span>
        </div>
        <h2
          className="font-display-ta mt-2.5 font-black uppercase text-3xl sm:text-4xl"
          style={{ letterSpacing: "0.05em" }}
        >
          {title}
          {highlight && <span style={{ color: "var(--ta-cyan)" }}> {highlight}</span>}
        </h2>
      </div>
      {moreHref && (
        <Link
          href={moreHref}
          className="hidden items-center gap-1.5 font-mono-ta text-[10px] uppercase transition-opacity hover:opacity-70 md:inline-flex"
          style={{ letterSpacing: "0.2em", color: "var(--ta-cyan)", textDecoration: "none" }}
        >
          {moreLabel}
          <Icon name="arrow-right" size={13} strokeWidth={2.2} />
        </Link>
      )}
    </div>
  );
}

// ─── Disziplin-Karten ─────────────────────────────────────────────────────────

function DisciplineGrid() {
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {disciplines.map((d, idx) => {
        const a = ACCENTS[d.accent];
        return (
          <Link
            key={d.slug}
            href={`/workout/plans/${d.slug}`}
            className={`rise-${idx + 1} group relative flex flex-col overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1.5`}
            style={{
              minHeight: "230px",
              border: `1px solid ${isLight ? "rgba(0,0,0,.08)" : "rgba(255,255,255,.07)"}`,
              background: isLight ? a.bgLight : a.bgDark,
              textDecoration: "none",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = a.border;
              (e.currentTarget as HTMLElement).style.boxShadow = `0 16px 40px rgba(0,0,0,.35), 0 0 32px ${a.glow}`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = isLight ? "rgba(0,0,0,.08)" : "rgba(255,255,255,.07)";
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
          >
            {/* Glow hinter dem Icon */}
            <div
              className="pointer-events-none absolute left-1/2 top-[36%] h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background: `radial-gradient(circle, ${a.glow}, transparent 65%)`,
                opacity: 0.65,
              }}
            />
            {/* Riesige Index-Zahl als Hintergrund */}
            <span
              className="font-display-ta pointer-events-none absolute right-2 top-0 select-none font-black leading-none"
              style={{
                fontSize: "110px",
                color: a.c,
                opacity: isLight ? 0.1 : 0.09,
                letterSpacing: "-0.05em",
              }}
            >
              {String(idx + 1).padStart(2, "0")}
            </span>

            {/* Icon — groß, zentriert, hebt sich beim Hover */}
            <div className="relative flex flex-1 items-center justify-center pt-7">
              <span
                className="flex h-20 w-20 items-center justify-center rounded-3xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3"
                style={{
                  color: a.c,
                  background: isLight ? "rgba(255,255,255,.7)" : "rgba(255,255,255,.05)",
                  border: `1px solid ${a.border}`,
                  boxShadow: `0 0 28px ${a.glow}`,
                }}
              >
                <Icon name={d.icon} size={42} strokeWidth={1.5} />
              </span>
            </div>

            {/* Text unten */}
            <div className="relative px-4 pb-4 pt-2">
              <span
                className="font-mono-ta inline-block rounded-full px-2 py-0.5 text-[9px] uppercase"
                style={{
                  letterSpacing: "0.18em",
                  color: a.c,
                  border: `1px solid ${a.border}`,
                  background: isLight ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.25)",
                }}
              >
                {d.tag}
              </span>
              <div className="mt-2 flex items-center justify-between">
                <span
                  className="font-display-ta font-black uppercase text-xl"
                  style={{ letterSpacing: "0.05em", color: "var(--fg)" }}
                >
                  {d.name}
                </span>
                <span
                  className="-translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                  style={{ color: a.c }}
                >
                  <Icon name="arrow-right" size={18} strokeWidth={2.2} />
                </span>
              </div>
              <p
                className="font-mono-ta mt-1 text-[9px] uppercase"
                style={{ letterSpacing: "0.12em", color: "var(--fg-3)" }}
              >
                {d.desc}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ─── Schnellzugriff ───────────────────────────────────────────────────────────

function QuickActionCards({ actions }: { actions: QuickActionDef[] }) {
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {actions.map((qa, idx) => {
        const a = ACCENTS[qa.accent];
        return (
          <Link
            key={qa.href}
            href={qa.href}
            className={`rise-${idx + 1} card-glass card-interactive group relative !p-5`}
            style={{ textDecoration: "none" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = a.border;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "";
            }}
          >
            {/* Akzentlinie oben */}
            <span
              className="absolute left-0 top-0 h-[3px] w-full origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
              style={{ background: `linear-gradient(90deg, ${a.c}, transparent)` }}
            />
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110"
              style={{
                background: isLight ? "rgba(255,255,255,.8)" : "rgba(255,255,255,.05)",
                border: `1px solid ${a.border}`,
                color: a.c,
                boxShadow: `0 0 18px ${a.glow}`,
              }}
            >
              <Icon name={qa.icon} size={22} />
            </div>
            <div className="mt-3">
              <div
                className="font-display-ta flex items-center gap-1.5 font-black uppercase text-sm"
                style={{ letterSpacing: "0.08em" }}
              >
                {qa.title}
                <span
                  className="-translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                  style={{ color: a.c }}
                >
                  <Icon name="arrow-right" size={13} strokeWidth={2.4} />
                </span>
              </div>
              <div
                className="font-mono-ta mt-0.5 text-[9px] uppercase"
                style={{ letterSpacing: "0.15em", color: "var(--fg-3)" }}
              >
                {qa.sub}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ─── Guest Landing Page ────────────────────────────────────────────────────────

function GuestHome() {
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <>
      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <Image
          src={isLight ? "/images/hero-beach.png" : "/images/hero-gym.png"}
          alt=""
          fill
          className="pointer-events-none object-cover object-center"
          style={{ opacity: isLight ? 0.55 : 0.8 }}
          priority
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: isLight
              ? "radial-gradient(420px 260px at 90% -10%, rgba(35,196,206,.07), transparent 60%), radial-gradient(420px 260px at 0% 110%, rgba(255,79,168,.05), transparent 60%), linear-gradient(160deg, rgba(238,242,248,.52), rgba(240,244,248,.48) 70%)"
              : "radial-gradient(420px 260px at 90% -10%, rgba(35,196,206,.12), transparent 60%), radial-gradient(420px 260px at 0% 110%, rgba(255,79,168,.1), transparent 60%), linear-gradient(160deg, rgba(10,18,24,.50), rgba(5,7,9,.60) 70%)",
          }}
        />
        <div className="retro-scanlines pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:py-32">
          <div className="rise flex items-center gap-2.5">
            <span style={{ color: "var(--ta-cyan)" }}>
              <Icon name="wave" size={18} />
            </span>
            <span
              className="font-mono-ta text-[10px] uppercase"
              style={{ letterSpacing: "0.3em", color: "var(--ta-cyan)" }}
            >
              Tidal Athletics — MMA Training App
            </span>
          </div>
          <h1
            className="rise-1 font-display-ta mt-4 font-black uppercase leading-none"
            style={{
              fontSize: "clamp(52px, 10vw, 96px)",
              letterSpacing: "0.01em",
              lineHeight: 0.85,
            }}
          >
            Train
            <br />
            <span style={{ color: "var(--ta-cyan)", textShadow: "0 0 40px rgba(35,196,206,.4)" }}>Hard.</span>
            <br />
            <span
              style={{
                WebkitTextStroke: "2px var(--ta-pink)",
                color: "transparent",
              }}
            >
              Fight Smart.
            </span>
          </h1>
          <p
            className="rise-2 mt-6 max-w-xl text-base leading-relaxed sm:text-lg"
            style={{ color: "var(--fg-2)" }}
          >
            Die Trainings-App für Kampfsportler. Strukturierte Pläne, smarter Timer,
            Technik-Bibliothek und Fortschritts-Tracking.
          </p>
          <div className="rise-3 mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="btn-primary">
              Kostenlos starten
            </Link>
            <Link href="/login" className="btn-secondary">
              Einloggen
            </Link>
          </div>

          {/* Stat strip */}
          <div className="rise-4 mt-12 grid max-w-md grid-cols-3 gap-3">
            {[
              { v: "4", l: "Disziplinen", icon: "target" as IconName },
              { v: "120+", l: "Workouts", icon: "spark" as IconName },
              { v: "24/7", l: "Verfügbar", icon: "timer" as IconName },
            ].map((stat) => (
              <div key={stat.l} className="flex flex-col items-center text-center">
                <span style={{ color: "var(--ta-cyan)", opacity: 0.7 }}>
                  <Icon name={stat.icon} size={16} />
                </span>
                <div
                  className="font-display-ta mt-1.5 font-black text-3xl leading-none"
                  style={{ color: "var(--ta-cyan)", textShadow: "0 0 12px rgba(35,196,206,.45)" }}
                >
                  {stat.v}
                </div>
                <div
                  className="font-mono-ta mt-1.5 text-[9px] uppercase"
                  style={{ letterSpacing: "0.2em", color: "var(--fg-3)" }}
                >
                  {stat.l}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="retro-stripes relative" aria-hidden="true" />
      </section>

      {/* ── FEATURES ── */}
      <section className="py-14 sm:py-20" style={{ borderTop: "1px solid var(--ink-4)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal>
            <SectionHeader
              eyebrow="Features"
              eyebrowColor="var(--ta-pink)"
              title="Dein komplettes Training."
              highlight="In einer App."
            />
          </Reveal>
          <Reveal delay={0.05}>
            <div className="grid gap-4 sm:grid-cols-3">
              {features.map((f, idx) => {
                const a = ACCENTS[f.accent];
                return (
                  <div
                    key={f.title}
                    className={`rise-${idx + 1} group relative overflow-hidden`}
                  >
                    <span
                      className="absolute left-0 top-0 h-[3px] w-full origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100"
                      style={{ background: `linear-gradient(90deg, ${a.c}, transparent)` }}
                    />
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110"
                      style={{
                        background: "rgba(255,255,255,.04)",
                        border: `1px solid ${a.border}`,
                        color: a.c,
                        boxShadow: `0 0 18px ${a.glow}`,
                      }}
                    >
                      <Icon name={f.icon} size={22} />
                    </div>
                    <h3
                      className="font-display-ta mt-4 font-black uppercase"
                      style={{ fontSize: "18px", letterSpacing: "0.06em" }}
                    >
                      {f.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--fg-3)" }}>
                      {f.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── DISZIPLINEN ── */}
      <section className="py-14 sm:py-20" style={{ borderTop: "1px solid var(--ink-4)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal>
            <SectionHeader
              eyebrow="Disziplinen"
              eyebrowColor="var(--ta-cyan)"
              title="Wähle deine"
              highlight="Disziplin."
              moreHref="/workout/generator"
              moreLabel="Alle Workouts"
            />
          </Reveal>
          <Reveal delay={0.05}>
            <DisciplineGrid />
          </Reveal>
        </div>
      </section>

      {/* ── QUICK ACCESS ── */}
      <section className="py-10 sm:py-16" style={{ borderTop: "1px solid var(--ink-4)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal>
            <div className="mb-6 flex items-center gap-2.5">
              <span className="block h-[2px] w-8 rounded-full" style={{ background: "var(--fg-4)" }} />
              <span
                className="font-mono-ta text-[10px] uppercase"
                style={{ letterSpacing: "0.25em", color: "var(--fg-3)" }}
              >
                Schnellzugriff
              </span>
            </div>
            <QuickActionCards actions={guestQuickActions} />
          </Reveal>
        </div>
      </section>

      {/* ── CTA ── */}
      <section
        className="relative overflow-hidden py-16 sm:py-24"
        style={{ borderTop: "1px solid var(--ink-4)" }}
      >
        {/* Hintergrundbild auch im CTA */}
        <Image
          src="/images/hero-gym.png"
          alt=""
          fill
          className="pointer-events-none object-cover object-center"
          style={{ opacity: isLight ? 0.15 : 0.25 }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: isLight
              ? "linear-gradient(180deg, rgba(238,242,248,.92), rgba(238,242,248,.86))"
              : "radial-gradient(700px 360px at 50% 50%, rgba(35,196,206,.08), transparent 70%), linear-gradient(180deg, rgba(3,4,6,.88), rgba(3,4,6,.82))",
          }}
        />
        <div className="retro-scanlines pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-2xl px-4 text-center sm:px-6">
          <Reveal>
            <span
              className="mx-auto mb-5 flex h-14 w-14 animate-float items-center justify-center rounded-2xl"
              style={{
                color: "var(--ta-cyan)",
                background: "rgba(35,196,206,.08)",
                border: "1px solid rgba(35,196,206,.35)",
                boxShadow: "0 0 30px rgba(35,196,206,.25)",
              }}
            >
              <Icon name="wave" size={28} />
            </span>
            <div
              className="font-mono-ta text-[10px] uppercase"
              style={{ letterSpacing: "0.3em", color: "var(--ta-cyan)" }}
            >
              Kostenlos · Kein Abo
            </div>
            <h2
              className="font-display-ta mt-3 font-black uppercase"
              style={{
                fontSize: "clamp(32px, 6vw, 56px)",
                letterSpacing: "0.04em",
                lineHeight: 0.9,
              }}
            >
              Bereit für die
              <br />
              <span style={{ color: "var(--ta-cyan)", textShadow: "0 0 30px rgba(35,196,206,.4)" }}>
                erste Runde?
              </span>
            </h2>
            <p className="mt-5 text-base" style={{ color: "var(--fg-3)" }}>
              Erstelle deinen kostenlosen Account und starte heute mit dem Training.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/register" className="btn-primary">
                Jetzt registrieren
              </Link>
              <Link href="/timer" className="btn-secondary">
                Timer ausprobieren
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

// ─── Personalized Home (eingeloggt) ───────────────────────────────────────────

function UserHome() {
  const { profile, profileLoading } = useAuth();
  const { theme } = useTheme();
  const isLight = theme === "light";
  const greeting = greetingFor(profile?.displayName);

  return (
    <>
      {/* ── GREETING HERO ── */}
      <section className="relative overflow-hidden">
        <Image
          src={isLight ? "/images/hero-beach.png" : "/images/hero-gym.png"}
          alt=""
          fill
          className="pointer-events-none object-cover object-center"
          style={{ opacity: isLight ? 0.5 : 0.75 }}
          priority
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: isLight
              ? "radial-gradient(420px 260px at 90% -10%, rgba(35,196,206,.06), transparent 60%), linear-gradient(160deg, rgba(238,242,248,.50), rgba(240,244,248,.45) 70%)"
              : "radial-gradient(420px 260px at 90% -10%, rgba(35,196,206,.1), transparent 60%), linear-gradient(160deg, rgba(10,18,24,.55), rgba(5,7,9,.65) 70%)",
          }}
        />
        <div className="retro-scanlines pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          {profileLoading ? (
            <div>
              <div className="h-3 w-32 animate-pulse rounded" style={{ background: "var(--ink-4)" }} />
              <div className="mt-3 h-12 w-72 animate-pulse rounded" style={{ background: "var(--ink-4)" }} />
              <div className="mt-3 h-3 w-48 animate-pulse rounded" style={{ background: "var(--ink-4)" }} />
            </div>
          ) : (
            <>
              <div className="rise flex items-center gap-2.5">
                <span style={{ color: "var(--ta-cyan)" }}>
                  <Icon name="wave" size={16} />
                </span>
                <span
                  className="font-mono-ta text-[10px] uppercase"
                  style={{ letterSpacing: "0.25em", color: "var(--ta-cyan)" }}
                >
                  Willkommen zurück
                </span>
              </div>
              <h1
                className="rise-1 font-display-ta mt-2 font-black uppercase leading-none"
                style={{
                  fontSize: "clamp(36px, 7vw, 72px)",
                  letterSpacing: "0.02em",
                  lineHeight: 0.88,
                }}
              >
                {greeting}
              </h1>
              <div
                className="animate-grow-x mt-3 h-[3px] w-24 rounded-full"
                style={{ background: "linear-gradient(90deg, var(--ta-cyan), transparent)" }}
              />
              <p className="rise-2 mt-4 text-sm" style={{ color: "var(--fg-3)" }}>
                Was trainierst du heute?
              </p>
            </>
          )}
        </div>
      </section>

      {/* ── QUICK ACTIONS ── */}
      <section className="py-10 sm:py-14" style={{ borderTop: "1px solid var(--ink-4)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-6 flex items-center gap-2.5">
            <span className="block h-[2px] w-8 rounded-full" style={{ background: "var(--fg-4)" }} />
            <span
              className="font-mono-ta text-[10px] uppercase"
              style={{ letterSpacing: "0.25em", color: "var(--fg-3)" }}
            >
              Schnellzugriff
            </span>
          </div>
          <QuickActionCards actions={userQuickActions} />
        </div>
      </section>

      {/* ── TRAININGSPLÄNE ── */}
      <section className="py-14 sm:py-20" style={{ borderTop: "1px solid var(--ink-4)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal>
            <SectionHeader
              eyebrow="Trainingspläne"
              eyebrowColor="var(--ta-cyan)"
              title="Wähle deine"
              highlight="Disziplin."
              moreHref="/workout/generator"
              moreLabel="Alle Workouts"
            />
          </Reveal>
          <Reveal delay={0.05}>
            <DisciplineGrid />
          </Reveal>
        </div>
      </section>

      {/* ── DASHBOARD TEASER ── */}
      <section className="py-8 pb-14 sm:py-12" style={{ borderTop: "1px solid var(--ink-4)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal>
            <Link
              href="/dashboard"
              className="card-glass card-interactive group relative flex flex-col gap-4 overflow-hidden !p-6 sm:flex-row sm:items-center sm:justify-between"
              style={{ textDecoration: "none" }}
            >
              <div
                className="pointer-events-none absolute right-[-40px] top-[-40px] h-56 w-56 rounded-full"
                style={{ background: "radial-gradient(circle, rgba(35,196,206,.12), transparent 60%)" }}
              />
              <div className="relative flex items-center gap-4">
                <span
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110"
                  style={{
                    color: "var(--ta-cyan)",
                    background: "rgba(35,196,206,.08)",
                    border: "1px solid rgba(35,196,206,.3)",
                    boxShadow: "0 0 20px rgba(35,196,206,.2)",
                  }}
                >
                  <Icon name="chart" size={26} />
                </span>
                <div>
                  <div
                    className="font-mono-ta text-[9px] uppercase"
                    style={{ letterSpacing: "0.2em", color: "var(--fg-3)" }}
                  >
                    Mein Training
                  </div>
                  <div
                    className="font-display-ta mt-1 font-black uppercase"
                    style={{ fontSize: "20px", letterSpacing: "0.04em", color: "var(--fg)" }}
                  >
                    Statistiken & Verlauf
                  </div>
                  <p className="mt-1 text-xs" style={{ color: "var(--fg-4)" }}>
                    Streak, Workouts, Lieblings-Disziplin und alle Sessions auf einen Blick.
                  </p>
                </div>
              </div>
              <span
                className="relative inline-flex shrink-0 items-center gap-2 font-mono-ta text-[11px] uppercase transition-transform duration-300 group-hover:translate-x-1"
                style={{ letterSpacing: "0.2em", color: "var(--ta-cyan)" }}
              >
                Zum Dashboard
                <Icon name="arrow-right" size={16} strokeWidth={2.2} />
              </span>
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function HomeLoading() {
  return (
    <div style={{ minHeight: "70vh" }}>
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="h-3 w-24 animate-pulse rounded" style={{ background: "var(--ink-4)" }} />
        <div className="mt-4 h-16 w-80 animate-pulse rounded" style={{ background: "var(--ink-4)" }} />
        <div className="mt-3 h-5 w-96 animate-pulse rounded" style={{ background: "var(--ink-4)" }} />
        <div className="mt-6 flex gap-3">
          <div className="h-10 w-36 animate-pulse rounded" style={{ background: "var(--ink-4)" }} />
          <div className="h-10 w-28 animate-pulse rounded" style={{ background: "var(--ink-4)" }} />
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) return <HomeLoading />;
  return user ? <UserHome /> : <GuestHome />;
}
