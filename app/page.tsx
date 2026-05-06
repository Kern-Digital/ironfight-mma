"use client";

import Link from "next/link";
import Image from "next/image";

const disciplines = [
  {
    slug: "boxing",
    name: "Boxing",
    tag: "Stand-Up",
    accent: "striking",
    glyph: (
      <svg viewBox="0 0 80 80" fill="none" className="h-full w-full">
        <path d="M20 55 C20 40 30 30 50 28 L60 26 L60 38 L52 40 L60 54 L40 60 Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" fill="none" opacity=".7"/>
        <circle cx="58" cy="26" r="8" stroke="currentColor" strokeWidth="2" fill="none" opacity=".5"/>
      </svg>
    ),
    cyanAccent: true,
  },
  {
    slug: "wrestling",
    name: "Wrestling",
    tag: "Grappling",
    accent: "grappling",
    glyph: (
      <svg viewBox="0 0 80 80" fill="none" className="h-full w-full">
        <path d="M20 20 Q40 10 60 30 Q70 50 50 60 Q30 70 20 50 Z" stroke="currentColor" strokeWidth="2.5" fill="none" opacity=".6"/>
        <path d="M35 25 L45 35 M45 25 L35 35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".5"/>
      </svg>
    ),
    cyanAccent: false,
  },
  {
    slug: "bjj",
    name: "BJJ",
    tag: "Ground",
    accent: "bjj",
    glyph: (
      <svg viewBox="0 0 80 80" fill="none" className="h-full w-full">
        <circle cx="40" cy="40" r="22" stroke="currentColor" strokeWidth="2.5" fill="none" opacity=".5"/>
        <path d="M28 28 L52 52 M52 28 L28 52" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".5"/>
        <circle cx="40" cy="40" r="8" stroke="currentColor" strokeWidth="2" fill="none" opacity=".6"/>
      </svg>
    ),
    cyanAccent: false,
  },
  {
    slug: "muay-thai",
    name: "Muay Thai",
    tag: "Stand-Up",
    accent: "muaythai",
    glyph: (
      <svg viewBox="0 0 80 80" fill="none" className="h-full w-full">
        <path d="M40 15 L40 55 M20 35 L60 35" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity=".6"/>
        <path d="M25 20 L40 35 L55 20" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" opacity=".5"/>
        <path d="M25 50 L40 35 L55 50" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" opacity=".5"/>
      </svg>
    ),
    cyanAccent: true,
  },
];

const quickActions = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    title: "Timer",
    sub: "Runde starten",
    href: "/timer",
    pink: false,
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
    title: "Workout",
    sub: "Generator",
    href: "/workout/generator",
    pink: false,
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    ),
    title: "Techniken",
    sub: "Bibliothek",
    href: "/techniques",
    pink: true,
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
      </svg>
    ),
    title: "Regeln",
    sub: "Quiz & Wissen",
    href: "/regeln",
    pink: true,
  },
];

export default function Home() {
  return (
    <>
      {/* ── HERO ── */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            "radial-gradient(420px 260px at 90% -10%, rgba(0,212,230,.18), transparent 60%), radial-gradient(420px 260px at 0% 110%, rgba(255,45,120,.14), transparent 60%), linear-gradient(160deg, #0A1218, #050709 70%)",
        }}
      >
        {/* Background photo */}
        <Image
          src="/background_pictures/Gemini_Generated_Image_oxsx04oxsx04oxsx.png"
          alt=""
          fill
          className="pointer-events-none object-cover object-center"
          style={{ opacity: 0.12, mixBlendMode: "luminosity" }}
          priority
        />
        {/* Dark scrim over photo */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(160deg, rgba(10,18,24,.85) 0%, rgba(5,7,9,.92) 100%)",
          }}
        />
        {/* Grid overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,212,230,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,230,.06) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 60% at 30% 30%, #000, transparent 80%)",
            maskImage:
              "radial-gradient(ellipse 80% 60% at 30% 30%, #000, transparent 80%)",
          }}
        />

        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:py-32">
          {/* Logo + Eye */}
          <div className="mb-6 flex items-center gap-4">
            <Image
              src="/icons/icon-192.png"
              alt="Tidal Athletics"
              width={56}
              height={56}
              className="rounded-2xl"
              style={{
                boxShadow: "0 0 28px rgba(0,212,230,.35), 0 0 60px rgba(255,45,120,.12)",
              }}
              priority
            />
            <div>
              <div
                className="font-display-ta font-black uppercase leading-none"
                style={{ fontSize: "20px", letterSpacing: "0.1em" }}
              >
                <span style={{ color: "var(--ta-pink)" }}>Tidal</span>
                <span style={{ color: "var(--ta-cyan)" }}>Athletics</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="h-1.5 w-1.5 animate-dot-pulse rounded-full"
                  style={{ background: "var(--ta-cyan)", boxShadow: "0 0 8px var(--ta-cyan)" }}
                />
                <span
                  className="font-mono-ta text-[9px] uppercase"
                  style={{ letterSpacing: "0.25em", color: "var(--ta-cyan)" }}
                >
                  MMA Training
                </span>
              </div>
            </div>
          </div>

          <h1
            className="font-display-ta font-black uppercase leading-none"
            style={{
              fontSize: "clamp(52px, 10vw, 96px)",
              letterSpacing: "0.01em",
              lineHeight: 0.85,
            }}
          >
            Train
            <br />
            <span style={{ color: "var(--ta-cyan)" }}>Hard.</span>
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
            className="mt-6 max-w-xl text-base leading-relaxed sm:text-lg"
            style={{ color: "var(--fg-2)" }}
          >
            Deine MMA Trainings-App — strukturierte Pläne, smarter Timer,
            Technik-Bibliothek und Fortschritts-Tracking.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/timer" className="btn-primary">
              ⏱ Timer starten
            </Link>
            <Link href="/register" className="btn-secondary">
              Kostenlos registrieren
            </Link>
          </div>

          {/* Stat strip */}
          <div
            className="mt-12 grid max-w-sm grid-cols-3 overflow-hidden rounded-xl"
            style={{
              background: "var(--ink-4)",
              border: "1px solid var(--ink-4)",
              gap: "1px",
            }}
          >
            {[
              { v: "4", l: "Disziplinen" },
              { v: "120+", l: "Workouts" },
              { v: "24/7", l: "Verfügbar" },
            ].map((stat) => (
              <div
                key={stat.l}
                className="flex flex-col items-center py-4 text-center"
                style={{ background: "var(--ink-2)" }}
              >
                <div
                  className="font-display-ta font-black text-3xl leading-none"
                  style={{
                    color: "var(--ta-cyan)",
                    textShadow: "0 0 12px rgba(0,212,230,.45)",
                  }}
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
      </section>

      {/* ── DISZIPLINEN ── */}
      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div
            className="mb-6 flex items-end justify-between"
            style={{ padding: "0 0 10px" }}
          >
            <div>
              <div
                className="font-mono-ta text-[10px] uppercase"
                style={{ letterSpacing: "0.25em", color: "var(--ta-cyan)" }}
              >
                Disziplinen
              </div>
              <h2
                className="font-display-ta mt-2 font-black uppercase text-3xl sm:text-4xl"
                style={{ letterSpacing: "0.06em" }}
              >
                Jede Distanz.
                <span style={{ color: "var(--ta-cyan)" }}> Jede Position.</span>
              </h2>
            </div>
            <Link
              href="/training"
              className="hidden font-mono-ta text-[10px] uppercase transition-colors md:block"
              style={{
                letterSpacing: "0.2em",
                color: "var(--ta-cyan)",
              }}
            >
              Alle Pläne →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {disciplines.map((d) => (
              <Link
                key={d.slug}
                href={`/training/${d.slug}`}
                className="group relative overflow-hidden rounded-2xl transition-all duration-200"
                style={{
                  height: "160px",
                  border: "1px solid var(--ink-5)",
                  background:
                    d.cyanAccent
                      ? "radial-gradient(160px 120px at 80% 10%, rgba(0,212,230,.3), transparent 60%), linear-gradient(160deg, #0E1A22, #06090C)"
                      : "radial-gradient(160px 120px at 80% 10%, rgba(255,45,120,.25), transparent 60%), linear-gradient(160deg, #1A0E16, #08050A)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,212,230,.6)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 0 28px rgba(0,212,230,.2)";
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--ink-5)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  (e.currentTarget as HTMLElement).style.transform = "none";
                }}
              >
                {/* Grid bg */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)",
                    backgroundSize: "18px 18px",
                    WebkitMaskImage: "linear-gradient(135deg, #000, transparent)",
                    maskImage: "linear-gradient(135deg, #000, transparent)",
                  }}
                />
                {/* Gradient overlay bottom */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: "linear-gradient(180deg, transparent 30%, rgba(0,0,0,.4))",
                  }}
                />
                {/* Glyph */}
                <div
                  className="absolute right-[-10px] top-[-10px] h-28 w-28 opacity-30"
                  style={{
                    color: d.cyanAccent ? "var(--ta-cyan)" : "var(--ta-pink)",
                  }}
                >
                  {d.glyph}
                </div>
                {/* Badge */}
                <div className="absolute right-2.5 top-2.5 z-10">
                  <span className={d.cyanAccent ? "badge-cyan" : "badge-pink"}>
                    {d.tag}
                  </span>
                </div>
                {/* Label */}
                <div className="absolute bottom-3 left-3.5 z-10">
                  <div
                    className="font-mono-ta text-[9px] uppercase opacity-80"
                    style={{ letterSpacing: "0.2em", color: "var(--fg-2)" }}
                  >
                    {d.tag}
                  </div>
                  <div
                    className="font-display-ta mt-0.5 font-black uppercase text-lg"
                    style={{ letterSpacing: "0.06em" }}
                  >
                    {d.name}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── QUICK ACTIONS ── */}
      <section
        className="py-10 sm:py-16"
        style={{ borderTop: "1px solid var(--ink-4)" }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div
            className="font-mono-ta mb-6 text-[10px] uppercase"
            style={{ letterSpacing: "0.25em", color: "var(--fg-3)" }}
          >
            Schnellzugriff
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {quickActions.map((qa) => (
              <Link
                key={qa.href}
                href={qa.href}
                className="flex items-center gap-3 rounded-2xl p-4 transition-all duration-200"
                style={{
                  border: "1px solid var(--ink-4)",
                  background:
                    "linear-gradient(180deg, var(--ink-3), var(--ink-2))",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "rgba(0,212,230,.5)";
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 0 24px rgba(0,212,230,.12)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "var(--ink-4)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: "var(--ink-1)",
                    border: "1px solid var(--ink-5)",
                    color: qa.pink ? "var(--ta-pink)" : "var(--ta-cyan)",
                  }}
                >
                  {qa.icon}
                </div>
                <div>
                  <div
                    className="font-display-ta font-black uppercase text-sm"
                    style={{ letterSpacing: "0.08em" }}
                  >
                    {qa.title}
                  </div>
                  <div
                    className="font-mono-ta mt-0.5 text-[9px] uppercase"
                    style={{ letterSpacing: "0.15em", color: "var(--fg-3)" }}
                  >
                    {qa.sub}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABSCHLUSS-CTA ── */}
      <section
        className="py-16 sm:py-24 text-center"
        style={{ borderTop: "1px solid var(--ink-4)" }}
      >
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <h2
            className="font-display-ta font-black uppercase text-3xl sm:text-5xl"
            style={{ letterSpacing: "0.02em", lineHeight: 0.9 }}
          >
            Bereit für die{" "}
            <span style={{ color: "var(--ta-cyan)" }}>erste Runde?</span>
          </h2>
          <p
            className="mx-auto mt-5 max-w-lg text-sm leading-relaxed"
            style={{ color: "var(--fg-3)" }}
          >
            Erstelle deinen kostenlosen Account und starte sofort mit deinem
            Training.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/register" className="btn-primary">
              Account erstellen
            </Link>
            <Link href="/timer" className="btn-secondary">
              Timer testen
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
