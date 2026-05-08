"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { greetingFor } from "@/lib/greeting";

// ─── Icons ────────────────────────────────────────────────────────────────────

function IcoTimer() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}
function IcoWorkout() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  );
}
function IcoBook() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  );
}
function IcoQuiz() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
    </svg>
  );
}
function IcoDash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const disciplines = [
  {
    slug: "boxing",
    name: "Boxing",
    tag: "Stand-Up",
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

interface QuickAction {
  icon: React.ReactNode;
  title: string;
  sub: string;
  href: string;
  pink: boolean;
}

const guestQuickActions: QuickAction[] = [
  { icon: <IcoTimer />, title: "Timer", sub: "Runde starten", href: "/timer", pink: false },
  { icon: <IcoWorkout />, title: "Workout", sub: "Generator", href: "/workout/generator", pink: false },
  { icon: <IcoBook />, title: "Techniken", sub: "Bibliothek", href: "/techniques", pink: true },
  { icon: <IcoQuiz />, title: "Regeln", sub: "Quiz & Wissen", href: "/regeln", pink: true },
];

const userQuickActions: QuickAction[] = [
  { icon: <IcoTimer />, title: "Timer", sub: "Runde starten", href: "/timer", pink: false },
  { icon: <IcoWorkout />, title: "Workout", sub: "Generator", href: "/workout/generator", pink: false },
  { icon: <IcoBook />, title: "Techniken", sub: "Bibliothek", href: "/techniques", pink: true },
  { icon: <IcoDash />, title: "Verlauf", sub: "Statistiken", href: "/dashboard", pink: true },
];

const features = [
  {
    icon: <IcoTimer />,
    title: "Smarter Timer",
    desc: "Professioneller Interval-Timer mit Runden, Pausen und Audio-Cues — für jeden Kampfsport konfigurierbar.",
    cyan: true,
  },
  {
    icon: <IcoBook />,
    title: "Technik-Bibliothek",
    desc: "Hunderte Techniken aus Boxing, BJJ, Wrestling und Muay Thai — mit Erklärungen, Variationen und Kurszuordnung.",
    cyan: false,
  },
  {
    icon: <IcoWorkout />,
    title: "Workout-Generator",
    desc: "Strukturierte Workouts nach Disziplin und Ausrüstung — automatisch generiert, sofort startbereit.",
    cyan: true,
  },
];

// ─── Shared Components ────────────────────────────────────────────────────────

function DisciplineGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {disciplines.map((d) => (
        <Link
          key={d.slug}
          href={`/workout/plans/${d.slug}`}
          className="group relative overflow-hidden rounded-2xl transition-all duration-200"
          style={{
            height: "160px",
            border: "1px solid var(--ink-5)",
            background: d.cyanAccent
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
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)",
              backgroundSize: "18px 18px",
              WebkitMaskImage: "linear-gradient(135deg, #000, transparent)",
              maskImage: "linear-gradient(135deg, #000, transparent)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "linear-gradient(180deg, transparent 30%, rgba(0,0,0,.4))" }}
          />
          <div
            className="absolute right-[-10px] top-[-10px] h-28 w-28 opacity-30"
            style={{ color: d.cyanAccent ? "var(--ta-cyan)" : "var(--ta-pink)" }}
          >
            {d.glyph}
          </div>
          <div className="absolute right-2.5 top-2.5 z-10">
            <span className={d.cyanAccent ? "badge-cyan" : "badge-pink"}>{d.tag}</span>
          </div>
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
  );
}

function QuickActionCards({ actions }: { actions: QuickAction[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {actions.map((qa) => (
        <Link
          key={qa.href}
          href={qa.href}
          className="flex items-center gap-3 rounded-2xl p-4 transition-all duration-200"
          style={{
            border: "1px solid var(--ink-4)",
            background: "linear-gradient(180deg, var(--ink-3), var(--ink-2))",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,212,230,.5)";
            (e.currentTarget as HTMLElement).style.boxShadow = "0 0 24px rgba(0,212,230,.12)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--ink-4)";
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
  );
}

// ─── Guest Landing Page ────────────────────────────────────────────────────────

function GuestHome() {
  return (
    <>
      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <Image
          src="/background_pictures/Gemini_Generated_Image_oxsx04oxsx04oxsx.png"
          alt=""
          fill
          className="pointer-events-none object-cover object-center"
          style={{ opacity: 0.8 }}
          priority
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(420px 260px at 90% -10%, rgba(0,212,230,.12), transparent 60%), radial-gradient(420px 260px at 0% 110%, rgba(255,45,120,.1), transparent 60%), linear-gradient(160deg, rgba(10,18,24,.50), rgba(5,7,9,.60) 70%)",
          }}
        />
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
          <div
            className="font-mono-ta mb-4 text-[10px] uppercase"
            style={{ letterSpacing: "0.3em", color: "var(--ta-cyan)" }}
          >
            Tidal Athletics — MMA Training App
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
            Die Trainings-App für Kampfsportler. Strukturierte Pläne, smarter Timer,
            Technik-Bibliothek und Fortschritts-Tracking.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="btn-primary">
              Kostenlos starten
            </Link>
            <Link href="/login" className="btn-secondary">
              Einloggen
            </Link>
          </div>

          {/* Stat strip */}
          <div
            className="mt-12 grid max-w-sm grid-cols-3 overflow-hidden rounded-xl"
            style={{ background: "var(--ink-4)", border: "1px solid var(--ink-4)", gap: "1px" }}
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
                  style={{ color: "var(--ta-cyan)", textShadow: "0 0 12px rgba(0,212,230,.45)" }}
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

      {/* ── FEATURES ── */}
      <section className="py-14 sm:py-20" style={{ borderTop: "1px solid var(--ink-4)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-10 text-center sm:text-left">
            <div
              className="font-mono-ta text-[10px] uppercase"
              style={{ letterSpacing: "0.25em", color: "var(--ta-pink)" }}
            >
              Was dich erwartet
            </div>
            <h2
              className="font-display-ta mt-2 font-black uppercase text-3xl sm:text-4xl"
              style={{ letterSpacing: "0.06em" }}
            >
              Alles für dein Training.
              <span style={{ color: "var(--ta-cyan)" }}> An einem Ort.</span>
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl p-6"
                style={{
                  background: f.cyan
                    ? "radial-gradient(200px 150px at 90% 0%, rgba(0,212,230,.08), transparent 60%), linear-gradient(180deg, var(--ink-3), var(--ink-2))"
                    : "radial-gradient(200px 150px at 90% 0%, rgba(255,45,120,.07), transparent 60%), linear-gradient(180deg, var(--ink-3), var(--ink-2))",
                  border: "1px solid var(--ink-4)",
                }}
              >
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{
                    background: f.cyan ? "rgba(0,212,230,.1)" : "rgba(255,45,120,.1)",
                    border: `1px solid ${f.cyan ? "rgba(0,212,230,.2)" : "rgba(255,45,120,.2)"}`,
                    color: f.cyan ? "var(--ta-cyan)" : "var(--ta-pink)",
                  }}
                >
                  {f.icon}
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
            ))}
          </div>
        </div>
      </section>

      {/* ── DISZIPLINEN ── */}
      <section className="py-14 sm:py-20" style={{ borderTop: "1px solid var(--ink-4)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-6 flex items-end justify-between">
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
              href="/workout/generator"
              className="hidden font-mono-ta text-[10px] uppercase transition-colors md:block"
              style={{ letterSpacing: "0.2em", color: "var(--ta-cyan)" }}
            >
              Alle Workouts →
            </Link>
          </div>
          <DisciplineGrid />
        </div>
      </section>

      {/* ── QUICK ACCESS ── */}
      <section className="py-10 sm:py-16" style={{ borderTop: "1px solid var(--ink-4)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div
            className="font-mono-ta mb-6 text-[10px] uppercase"
            style={{ letterSpacing: "0.25em", color: "var(--fg-3)" }}
          >
            Schnellzugriff
          </div>
          <QuickActionCards actions={guestQuickActions} />
        </div>
      </section>

      {/* ── CTA ── */}
      <section
        className="relative overflow-hidden py-16 sm:py-24"
        style={{ borderTop: "1px solid var(--ink-4)" }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(600px 300px at 50% 50%, rgba(0,212,230,.05), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-2xl px-4 text-center sm:px-6">
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
            <span style={{ color: "var(--ta-cyan)" }}>erste Runde?</span>
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
        </div>
      </section>
    </>
  );
}

// ─── Personalized Home (eingeloggt) ───────────────────────────────────────────

function UserHome() {
  const { profile, profileLoading } = useAuth();
  const greeting = greetingFor(profile?.displayName);

  return (
    <>
      {/* ── GREETING HERO ── */}
      <section className="relative overflow-hidden">
        <Image
          src="/background_pictures/Gemini_Generated_Image_oxsx04oxsx04oxsx.png"
          alt=""
          fill
          className="pointer-events-none object-cover object-center"
          style={{ opacity: 0.75 }}
          priority
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(420px 260px at 90% -10%, rgba(0,212,230,.1), transparent 60%), linear-gradient(160deg, rgba(10,18,24,.55), rgba(5,7,9,.65) 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,212,230,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,230,.04) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            WebkitMaskImage:
              "radial-gradient(ellipse 70% 50% at 20% 50%, #000, transparent 80%)",
            maskImage:
              "radial-gradient(ellipse 70% 50% at 20% 50%, #000, transparent 80%)",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          {profileLoading ? (
            <div>
              <div className="h-3 w-32 animate-pulse rounded" style={{ background: "var(--ink-4)" }} />
              <div className="mt-3 h-12 w-72 animate-pulse rounded" style={{ background: "var(--ink-4)" }} />
              <div className="mt-3 h-3 w-48 animate-pulse rounded" style={{ background: "var(--ink-4)" }} />
            </div>
          ) : (
            <>
              <div
                className="font-mono-ta text-[10px] uppercase"
                style={{ letterSpacing: "0.25em", color: "var(--ta-cyan)" }}
              >
                Willkommen zurück
              </div>
              <h1
                className="font-display-ta mt-2 font-black uppercase leading-none"
                style={{
                  fontSize: "clamp(36px, 7vw, 72px)",
                  letterSpacing: "0.02em",
                  lineHeight: 0.88,
                }}
              >
                {greeting}
              </h1>
              <p className="mt-4 text-sm" style={{ color: "var(--fg-3)" }}>
                Was trainierst du heute?
              </p>
            </>
          )}
        </div>
      </section>

      {/* ── QUICK ACTIONS ── */}
      <section className="py-10 sm:py-14" style={{ borderTop: "1px solid var(--ink-4)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div
            className="font-mono-ta mb-6 text-[10px] uppercase"
            style={{ letterSpacing: "0.25em", color: "var(--fg-3)" }}
          >
            Schnellzugriff
          </div>
          <QuickActionCards actions={userQuickActions} />
        </div>
      </section>

      {/* ── TRAININGSPLÄNE ── */}
      <section className="py-14 sm:py-20" style={{ borderTop: "1px solid var(--ink-4)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <div
                className="font-mono-ta text-[10px] uppercase"
                style={{ letterSpacing: "0.25em", color: "var(--ta-cyan)" }}
              >
                Trainingspläne
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
              href="/workout/generator"
              className="hidden font-mono-ta text-[10px] uppercase transition-colors md:block"
              style={{ letterSpacing: "0.2em", color: "var(--ta-cyan)" }}
            >
              Alle Workouts →
            </Link>
          </div>
          <DisciplineGrid />
        </div>
      </section>

      {/* ── DASHBOARD TEASER ── */}
      <section className="py-8 sm:py-12" style={{ borderTop: "1px solid var(--ink-4)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div
            className="flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between"
            style={{
              background:
                "radial-gradient(300px 200px at 90% -20%, rgba(0,212,230,.1), transparent 60%), linear-gradient(180deg, var(--ink-3), var(--ink-2))",
              border: "1px solid var(--ink-4)",
            }}
          >
            <div>
              <div
                className="font-mono-ta text-[9px] uppercase"
                style={{ letterSpacing: "0.2em", color: "var(--fg-3)" }}
              >
                Mein Training
              </div>
              <div
                className="font-display-ta mt-1 font-black uppercase"
                style={{ fontSize: "20px", letterSpacing: "0.04em" }}
              >
                Statistiken & Verlauf
              </div>
              <p className="mt-1 text-xs" style={{ color: "var(--fg-4)" }}>
                Streak, Workouts, Lieblings-Disziplin und alle Sessions auf einen Blick.
              </p>
            </div>
            <Link href="/dashboard" className="btn-secondary whitespace-nowrap text-sm">
              Zum Dashboard →
            </Link>
          </div>
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
