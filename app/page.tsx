import Hero3D from "@/components/Hero3D";
import Link from "next/link";

const highlights = [
  {
    icon: "⏱",
    title: "Workout-Timer",
    desc: "Runden, Pausen, Vorbereitung. Starte direkt durch.",
    href: "/timer",
    tag: "Direkt starten",
    border: "border-blood/30 hover:border-blood/70",
    glow: "from-blood/10",
  },
  {
    icon: "💪",
    title: "Training",
    desc: "4 Disziplinen, strukturierte Pläne, Auto-Generator.",
    href: "/workout/generator",
    tag: "Workout",
    border: "border-orange-500/25 hover:border-orange-500/60",
    glow: "from-orange-500/10",
  },
  {
    icon: "🥋",
    title: "Techniken",
    desc: "Boxing, BJJ, Wrestling, Muay Thai — Schritt für Schritt.",
    href: "/techniques",
    tag: "Bibliothek",
    border: "border-blue-500/25 hover:border-blue-500/60",
    glow: "from-blue-500/10",
  },
  {
    icon: "📖",
    title: "Regeln & Quiz",
    desc: "MMA-, BJJ- und Boxing-Regeln. Teste dein Wissen.",
    href: "/regeln",
    tag: "Quiz",
    border: "border-green-500/25 hover:border-green-500/60",
    glow: "from-green-500/10",
  },
  {
    icon: "📊",
    title: "Mein Training",
    desc: "Deine Statistiken, Streaks und Trainings-History.",
    href: "/dashboard",
    tag: "Dashboard",
    border: "border-purple-500/25 hover:border-purple-500/60",
    glow: "from-purple-500/10",
  },
];

export default function Home() {
  return (
    <>
      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-grid-pattern opacity-40"
          style={{ backgroundSize: "50px 50px" }}
        />
        <div className="absolute inset-0 bg-radial-fade" />

        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.2fr_1fr] lg:py-32">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-blood/40 bg-blood/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blood">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blood" />
              Tidal Athletics
            </div>

            <h1 className="heading-display text-5xl font-black leading-none sm:text-6xl lg:text-7xl">
              Train Hard.
              <br />
              <span className="text-blood">Fight Smart.</span>
            </h1>

            <p className="mt-5 max-w-xl text-base text-foreground/70 sm:text-lg">
              Deine MMA Trainings-App — strukturierte Pläne, smarter Timer,
              Technik-Bibliothek und Fortschritts-Tracking.
            </p>

            {/* Timer als primärer CTA */}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/timer"
                className="btn-primary flex items-center gap-2"
              >
                <span>⏱</span> Timer starten
              </Link>
              <Link href="/register" className="btn-secondary">
                Kostenlos registrieren
              </Link>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-4 border-t border-carbon-500/60 pt-6">
              {[
                { v: "4", l: "Disziplinen" },
                { v: "120+", l: "Workouts" },
                { v: "24/7", l: "Verfügbar" },
              ].map((stat) => (
                <div key={stat.l}>
                  <div className="font-display text-2xl font-black text-blood sm:text-3xl">
                    {stat.v}
                  </div>
                  <div className="mt-0.5 text-xs uppercase tracking-widest text-foreground/60">
                    {stat.l}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3D-Cage nur auf Desktop */}
          <div className="relative hidden aspect-square w-full justify-self-end lg:block">
            <Hero3D />
          </div>
        </div>
      </section>

      {/* ── HIGHLIGHTS GRID ── */}
      <section className="border-t border-carbon-500/60">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mb-10">
            <div className="text-xs font-bold uppercase tracking-widest text-blood">
              Alle Funktionen
            </div>
            <h2 className="heading-display mt-2 text-3xl font-black sm:text-4xl">
              Was Tidal Athletics bietet
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {highlights.map((h) => (
              <Link
                key={h.href}
                href={h.href}
                className={`group relative overflow-hidden rounded-xl border bg-carbon-700/40 p-6 transition-all hover:bg-carbon-700/60 ${h.border}`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${h.glow} to-transparent opacity-0 transition-opacity group-hover:opacity-100`}
                />
                <div className="relative">
                  <div className="flex items-start justify-between">
                    <span className="text-3xl leading-none">{h.icon}</span>
                    <span className="rounded-full border border-carbon-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-foreground/50">
                      {h.tag}
                    </span>
                  </div>
                  <h3 className="heading-display mt-4 text-xl font-black">
                    {h.title}
                  </h3>
                  <p className="mt-2 text-sm text-foreground/60">{h.desc}</p>
                  <div className="mt-5 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-foreground/40 transition-colors group-hover:text-blood">
                    Öffnen →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── DISZIPLINEN ── */}
      <section className="border-t border-carbon-500/60 bg-carbon-800/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-blood">
                Disziplinen
              </div>
              <h2 className="heading-display mt-2 text-3xl font-black sm:text-4xl">
                Jede Distanz. Jede Position.
              </h2>
            </div>
            <Link
              href="/training"
              className="hidden text-sm font-bold uppercase tracking-wider text-foreground/70 hover:text-blood md:block"
            >
              Alle Pläne →
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                name: "Boxing",
                tag: "Stand-Up",
                desc: "Footwork, Combinations, Defense.",
                accent: "from-red-700/30",
                href: "/training/boxing",
              },
              {
                name: "Wrestling",
                tag: "Grappling",
                desc: "Takedowns, Sprawls, Kontrolle.",
                accent: "from-orange-700/30",
                href: "/training/wrestling",
              },
              {
                name: "BJJ",
                tag: "Ground",
                desc: "Submissions, Sweeps, Guards.",
                accent: "from-blue-700/30",
                href: "/training/bjj",
              },
              {
                name: "Muay Thai",
                tag: "Stand-Up",
                desc: "Knie, Ellbogen, Clinch.",
                accent: "from-yellow-700/30",
                href: "/training/muay-thai",
              },
            ].map((d) => (
              <Link
                key={d.name}
                href={d.href}
                className="group relative overflow-hidden rounded-xl border border-carbon-500 bg-carbon-700/60 p-5 transition-all hover:border-blood/60"
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${d.accent} to-transparent opacity-0 transition-opacity group-hover:opacity-100`}
                />
                <div className="relative">
                  <div className="text-xs font-bold uppercase tracking-widest text-blood">
                    {d.tag}
                  </div>
                  <h3 className="heading-display mt-2 text-xl font-black">
                    {d.name}
                  </h3>
                  <p className="mt-2 text-xs text-foreground/60">{d.desc}</p>
                  <div className="mt-5 text-xs font-bold uppercase tracking-wider text-foreground/50 group-hover:text-blood">
                    Plan ansehen →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABSCHLUSS-CTA ── */}
      <section className="border-t border-carbon-500/60">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
          <h2 className="heading-display text-3xl font-black sm:text-4xl">
            Bereit für die{" "}
            <span className="text-blood">erste Runde?</span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm text-foreground/70">
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
