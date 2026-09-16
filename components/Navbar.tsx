"use client";

import { Collapse } from "@/components/motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useAuth, useFighterName, useRights } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import DeepFightWordmark from "@/components/DeepFightWordmark";
import Icon from "@/components/ui/Icon";

/* ─── Symbole ────────────────────────────────────────────────────────────────
 * Hier standen zehn von Hand gemalte SVG-Pfade (rund 95 Zeilen). Sie sind
 * gegen `components/ui/Icon.tsx` getauscht — dieselbe 24er-Box, dieselbe
 * Strichführung wie im Rest der App, und ein späterer Satzwechsel ist EINE
 * Datei statt elf (DESIGN-BRIEF §1.4/§5: Symbole nur aus der Registry).
 *
 * EINE Zuordnung ist keine 1:1-Übersetzung: „Hilfe" trug ein Fragezeichen im
 * Kreis, die Registry führt nur `info` (das „i" im Kreis). Statt einen elften
 * Pfad in die Navigation zu malen — genau das, was die Regel verhindern soll —
 * steht dort jetzt das Info-Zeichen. Wer das Fragezeichen zurückwill, ergänzt
 * die REGISTRY; dann bekommen es alle Stellen gleichzeitig.
 */

// ── Types ──────────────────────────────────────────────────────
interface NavChild {
  href: string;
  label: string;
  activePattern?: RegExp;
  /**
   * Zwischenüberschrift ÜBER diesem Eintrag — trennt in der Trainer-Rubrik
   * die Werkzeuge des Trainers von den Verwaltungs-Seiten (Checkpoint 2).
   * Sie folgen einem anderen Recht und sollen nicht in einer Reihe stehen.
   */
  section?: string;
}

interface NavGroup {
  id: string;
  label: React.ReactNode;
  /** Optional — die DeepFight-Wortmarke bringt ihr eigenes Symbol mit. */
  icon?: React.ReactNode;
  href?: string;
  children?: NavChild[];
}

// ── Nav Config ─────────────────────────────────────────────────
const trainingNavGroup: NavGroup = {
  id: "training",
  label: "Training",
  icon: <Icon name="dumbbell" size={14} strokeWidth={2} />,
  children: [
    { href: "/workout/generator", label: "Workouts", activePattern: /^\/workout/ },
    { href: "/schedule", label: "Kursplan" },
    { href: "/timer", label: "Timer" },
  ],
};

const lernenNavGroup: NavGroup = {
  id: "lernen",
  label: "Lernen",
  icon: <Icon name="book" size={14} strokeWidth={2} />,
  children: [
    { href: "/techniques", label: "Techniken" },
    { href: "/regeln", label: "Regeln" },
    { href: "/quiz", label: "Quiz" },
  ],
};

const profilNavGroup: NavGroup = {
  id: "profil",
  label: "Profil",
  icon: <Icon name="user" size={14} strokeWidth={2} />,
  children: [
    // Kampfprofil: DeepFight-Daten, freigegebene Auswertungen & Gegner,
    // Athleten-Daten. /deepfight leitet dorthin um (alte "Mein DeepFight"-Seite).
    {
      href: "/kampfprofil",
      label: "Kampfprofil",
      activePattern: /^\/(kampfprofil|deepfight)/,
    },
    { href: "/library", label: "Sammlung" },
    { href: "/dashboard", label: "Verlauf" },
    { href: "/profile", label: "Account" },
  ],
};

const helpNavGroup: NavGroup = {
  id: "help",
  label: "Hilfe",
  icon: <Icon name="info" size={14} strokeWidth={2} />,
  href: "/help",
};

const trainerNavGroup: NavGroup = {
  id: "trainer",
  label: "Trainer",
  icon: <Icon name="clipboard" size={14} strokeWidth={2} />,
  children: [
    { href: "/trainer", label: "Dashboard", activePattern: /^\/trainer$/ },
    { href: "/trainer/athleten", label: "Athleten", activePattern: /^\/trainer\/students/ },
    { href: "/schedule", label: "Kursplan" },
    {
      href: "/trainer/competitions",
      label: "Wettkampf",
      activePattern: /^\/trainer\/competitions/,
    },
    { href: "/timer", label: "Timer" },
  ],
};

/**
 * Verwaltungs-Seiten (Multi-Gym Phase 2). Sie folgen dem VERWALTUNGSRECHT,
 * nicht dem Trainer-Recht, und liegen seit Checkpoint 3 unter einer eigenen
 * Adresse — durchgesetzt in der Middleware (lib/verwaltung-routes.ts) und in
 * den Firestore-Regeln.
 *
 * WARUM SIE KEINE EIGENE TOP-LEVEL-RUBRIK SIND: Der Balken ist voll. Gemessen
 * mit einem Admin-Konto trägt er ab 1024 px bereits 1305 px Inhalt bei 1232 px
 * Platz — er läuft also schon vor Checkpoint 2 über (eigener Punkt fürs
 * Backlog). Eine achte Rubrik hätte daraus 1478 px gemacht und den Überlauf
 * bis 1600 px ausgeweitet. Deshalb hängen sie am vorhandenen Platz:
 *   • Wer Trainer UND Verwaltung ist, findet sie unter „Trainer", abgesetzt
 *     durch eine Zwischenüberschrift.
 *   • Wer NUR Verwaltung ist (Bürokraft ohne Trainer-Häkchen), bekommt
 *     dieselbe Rubrik unter dem Namen „Verwaltung" — und nichts sonst.
 */
const verwaltungNavChildren: NavChild[] = [
  {
    href: "/verwaltung/mitglieder",
    label: "Mitglieder",
    activePattern: /^\/verwaltung\/mitglieder/,
    section: "Verwaltung",
  },
  {
    href: "/verwaltung/einladungen",
    label: "Einladungen",
    activePattern: /^\/verwaltung\/einladungen/,
  },
  {
    href: "/verwaltung/neuigkeiten",
    label: "Neuigkeiten",
    activePattern: /^\/verwaltung\/neuigkeiten/,
  },
];

// DeepFight als eigener Menüpunkt — nur für Trainer/Admins sichtbar.
// Seit dem Neuaufbau (07.09.2026) EIN Ziel: die Landung /trainer/deepfight
// mit der Werkbank; Gegner und Athleten liegen dort als Segmente.
const deepFightNavGroup: NavGroup = {
  id: "deepfight",
  label: <DeepFightWordmark />,
  children: [
    {
      href: "/trainer/deepfight",
      label: "Analysieren",
      activePattern: /^\/trainer\/deepfight\/?$/,
    },
    {
      href: "/trainer/deepfight/gegner",
      label: "Gegner",
      activePattern: /^\/trainer\/deepfight\/gegner/,
    },
    {
      href: "/trainer/deepfight/athleten",
      label: "Athleten",
      activePattern: /^\/trainer\/deepfight\/athleten/,
    },
  ],
};

const adminNavGroup: NavGroup = {
  id: "admin",
  label: "Admin",
  icon: <Icon name="shield" size={14} strokeWidth={2} />,
  children: [
    { href: "/admin/users", label: "Nutzer" },
    { href: "/admin/seed", label: "Demo-Daten" },
    { href: "/dashboard", label: "Dashboard" },
  ],
};

// ── Helpers ────────────────────────────────────────────────────
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "F") + (parts[1]?.[0] ?? "")).toUpperCase();
}

// ── Component ──────────────────────────────────────────────────
export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logOut } = useAuth();
  const fighterName = useFighterName();
  const { theme, toggleTheme } = useTheme();
  // Ein Rollen-Set statt dreier Einzelvergleiche (Checkpoint 3,
  // lib/roles.ts). Der Plattform-Rang ist eingerechnet: Ein Admin ist hier
  // Trainer UND Verwaltung, ohne dass es an seinem Konto Häkchen bräuchte.
  const { trainer: isTrainer, verwaltung: isVerwaltung, admin: isAdmin } =
    useRights();
  // EIN Platz im Balken für beide Rollen (Begründung bei verwaltungNavChildren):
  // Trainer sehen ihre Werkzeuge, mit Verwaltungsrecht zusätzlich dessen
  // Seiten; eine reine Verwaltung sieht ausschließlich diese.
  const staffNavGroup: NavGroup | null = isTrainer
    ? {
        ...trainerNavGroup,
        children: [
          ...(trainerNavGroup.children ?? []),
          ...(isVerwaltung ? verwaltungNavChildren : []),
        ],
      }
    : isVerwaltung
      ? {
          id: "verwaltung",
          label: "Verwaltung",
          icon: <Icon name="users" size={14} strokeWidth={2} />,
          // Ohne Trainer-Punkte darüber braucht es keine Zwischenüberschrift.
          // `section` wird nur benannt, damit `rest` es NICHT mehr enthält.
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          children: verwaltungNavChildren.map(({ section, ...rest }) => rest),
        }
      : null;
  const visibleGroups: NavGroup[] = [
    trainingNavGroup,
    lernenNavGroup,
    // DeepFight steht als dritter Punkt direkt unter "Lernen".
    ...(isTrainer ? [deepFightNavGroup] : []),
    profilNavGroup,
    ...(staffNavGroup ? [staffNavGroup] : []),
    helpNavGroup,
    ...(isAdmin ? [adminNavGroup] : []),
  ];
  const [mobileOpen, setMobileOpen] = useState(false);
  // Mobile: Akkordeon — es ist immer nur eine Rubrik gleichzeitig aufgeklappt.
  const [openMobileGroup, setOpenMobileGroup] = useState<string | null>(null);
  const [openDesktopGroup, setOpenDesktopGroup] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Vollbild-Menü: Hintergrund darf nicht mitscrollen.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  async function handleLogout() {
    await logOut();
    setMobileOpen(false);
    router.push("/");
  }

  function isChildActive(child: NavChild): boolean {
    if (child.activePattern) return child.activePattern.test(pathname);
    if (child.href === "/") return pathname === "/";
    return pathname.startsWith(child.href);
  }

  function isGroupActive(group: NavGroup): boolean {
    if (group.href) return pathname === group.href;
    return group.children?.some(isChildActive) ?? false;
  }

  function handleGroupEnter(id: string) {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setOpenDesktopGroup(id);
  }

  function handleGroupLeave() {
    closeTimerRef.current = setTimeout(() => setOpenDesktopGroup(null), 150);
  }

  function toggleMobileGroup(id: string) {
    setOpenMobileGroup((prev) => (prev === id ? null : id));
  }

  /* Beschriftungen des Balkens. Die GRÖSSE bleibt bewusst an den
     Tailwind-Klassen (`text-xs lg:text-sm`) und steht nicht im Token-Shorthand:
     Der Balken braucht zwei Stufen, und `font: var(--type-meta)` kann nur eine.
     Alles andere — Familie, Gewicht, Laufweite — kommt aus den Tokens.

     NEBENBEI LÖST DER SCHRIFTWECHSEL EIN GEMESSENES PROBLEM: Der Balken läuft
     ab 1024 px über (1305 px Inhalt bei 1232 px Platz, Backlog-Punkt
     „Navigationsbalken läuft über"). Die alte Beschriftung lief in JetBrains
     MONO mit 0,12em Laufweite — eine dickengleiche Schrift ist die breiteste
     Wahl, die es gibt. Archivo mit 0,08em (`--ls-label`) braucht für dieselben
     Wörter spürbar weniger Platz. Der Überlauf ist damit NICHT behoben (das
     bleibt die Umbruch-Strategie aus dem Backlog), aber er beginnt später. */
  const NAV_FONT: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    letterSpacing: "var(--ls-label)",
    textTransform: "uppercase",
  };
  /* Zwischenüberschrift IM Aufklapper („Verwaltung"). Gleiche Größe wie die
     Einträge, aber gedämpft — sie ist eine Trennung, kein Ziel. */
  const NAV_SECTION: React.CSSProperties = {
    font: "var(--type-meta)",
    letterSpacing: "var(--ls-label)",
    textTransform: "uppercase",
    color: "var(--text-3)",
  };

  return (
    <>
      <header
        className="sticky top-0 z-50 backdrop-blur"
        style={{
          /* `--nav-surface` war ein VERLAUF als Flächenfüllung — das schließt
             DESIGN-BRIEF §3 aus. Jetzt ein Flächenton, halbdeckend, damit der
             Weichzeichner darunter noch etwas zu tun hat. */
          background: "color-mix(in oklab, var(--surface-page) 88%, transparent)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-3" style={{ textDecoration: "none" }}>
            <Image
              src="/icons/icon-192.png"
              alt="Tidal Athletics"
              width={36}
              height={36}
              className="rounded-field"
            />
            <div>
              {/* DIE MARKE FOLGT JETZT DEM GYM-AKZENT. Vorher stand „Tidal" in
                  festem --ta-pink und „Athletics" in festem --ta-cyan — zwei
                  hart gesetzte Markenfarben, und damit genau das, was
                  DESIGN-BRIEF §1.1 verbietet („Abnahme-Test: EINE Variable
                  ändern → die gesamte App folgt"). Ausgerechnet der Schriftzug
                  wäre beim ersten Gym-Branding stehen geblieben.

                  Die Zweifarbigkeit BLEIBT, sie trägt jetzt nur eine andere
                  Aussage: Der erste Teil ist Text, der zweite der Akzent. Ein
                  Gym mit eigener Farbe färbt damit die zweite Hälfte mit. */}
              <div
                className="text-lg uppercase leading-none"
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: 800,
                  letterSpacing: "var(--ls-display)",
                }}
              >
                <span style={{ color: "var(--text-1)" }}>Tidal</span>
                <span style={{ color: "var(--accent-text)" }}>Athletics</span>
              </div>
              <div
                style={{
                  font: "var(--type-meta)",
                  letterSpacing: "var(--ls-label)",
                  textTransform: "uppercase",
                  color: "var(--text-3)",
                  marginTop: "2px",
                }}
              >
                MMA Training
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-0.5 md:flex">
            {visibleGroups.map((group) => {
              const active = isGroupActive(group);
              const isOpen = openDesktopGroup === group.id;

              return (
                <div
                  key={group.id}
                  className="relative"
                  onMouseEnter={() => handleGroupEnter(group.id)}
                  onMouseLeave={handleGroupLeave}
                >
                  {group.href ? (
                    // Direct link (Timer)
                    <Link
                      href={group.href}
                      className="relative flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase transition-colors lg:px-4 lg:text-sm"
                      style={{ ...NAV_FONT, color: active ? "var(--accent-text)" : "var(--text-2)" }}
                    >
                      {group.icon && <span style={{ opacity: 0.75 }}>{group.icon}</span>}
                      {group.label}
                      {active && (
                        <span
                          className="absolute inset-x-2 -bottom-px h-0.5 rounded-b"
                          style={{ background: "var(--accent)", boxShadow: "var(--accent-glow)" }}
                        />
                      )}
                    </Link>
                  ) : (
                    // Dropdown trigger
                    <button
                      className="relative flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase transition-colors lg:px-4 lg:text-sm"
                      style={{ ...NAV_FONT, color: active || isOpen ? "var(--accent-text)" : "var(--text-2)" }}
                      aria-haspopup="true"
                      aria-expanded={isOpen}
                    >
                      {group.icon && <span style={{ opacity: 0.75 }}>{group.icon}</span>}
                      {group.label}
                      <span
                        style={{
                          transition: "transform 0.2s",
                          transform: isOpen ? "rotate(180deg)" : "none",
                          opacity: 0.5,
                        }}
                      >
                        <Icon name="chevron-down" size={12} strokeWidth={2.5} />
                      </span>
                      {active && !isOpen && (
                        <span
                          className="absolute inset-x-2 -bottom-px h-0.5 rounded-b"
                          style={{ background: "var(--accent)", boxShadow: "var(--accent-glow)" }}
                        />
                      )}
                    </button>
                  )}

                  {/* Dropdown Panel */}
                  {group.children && isOpen && (
                    <div
                      className="absolute left-0 top-full z-50 mt-1 min-w-[180px] overflow-hidden rounded-card py-1"
                      style={{
                        background: "var(--surface-card)",
                        border: "1px solid var(--line)",
                        boxShadow: "var(--glass-shadow)",
                      }}
                    >
                      {group.children.map((child) => {
                        const childActive = isChildActive(child);
                        return (
                          <div key={child.href}>
                          {child.section && (
                            <div
                              className="mt-1 border-t px-4 pb-1 pt-2"
                              style={{ ...NAV_SECTION, borderColor: "var(--line)" }}
                            >
                              {child.section}
                            </div>
                          )}
                          {/* HOVER MACHT JETZT CSS. Vorher schrieben zwei
                              JavaScript-Handler `style.background` direkt auf das
                              Element — auf Touch bleibt so eine Tönung nach dem
                              Tipp hängen (MOTION-BRIEF §3.2), und sie umging die
                              `@media (hover: hover)`-Sperre der App. `.t-interactive`
                              tönt die Fläche, `data-press="quiet"` gibt der Zeile die
                              Haptik dichter Listen: sinkt ein, hebt sich NIE.

                              DIE FLÄCHE DARF DESHALB NUR IM AKTIVEN FALL INLINE
                              STEHEN — ein Inline-Stil schlägt jede Klassenregel, und
                              ein `background: "transparent"` an dieser Stelle hätte
                              die Hover-Tönung von `.t-interactive` still ausgehebelt.
                              Deshalb wird der Schlüssel weggelassen statt auf
                              „durchsichtig" gesetzt. */}
                          <Link
                            href={child.href}
                            onClick={() => setOpenDesktopGroup(null)}
                            data-press="quiet"
                            className="t-interactive flex items-center gap-2 px-4 py-2.5 text-xs"
                            style={{
                              ...NAV_FONT,
                              color: childActive ? "var(--accent-text)" : "var(--text-2)",
                              ...(childActive
                                ? { background: "var(--accent-subtle)" }
                                : {}),
                            }}
                          >
                            {childActive && (
                              <span
                                className="h-3 w-0.5 rounded-full"
                                style={{ background: "var(--accent)", flexShrink: 0 }}
                              />
                            )}
                            {child.label}
                          </Link>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Auth Controls — Desktop */}
          <div className="hidden items-center gap-3 md:flex">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="rounded-field p-2 transition-colors"
              style={{
                background: "var(--surface-raised)",
                border: "1px solid var(--line)",
                color: "var(--text-2)",
              }}
              aria-label={theme === "dark" ? "Helles Design aktivieren" : "Dunkles Design aktivieren"}
            >
              {theme === "dark" ? <Icon name="sun" size={15} strokeWidth={2} /> : <Icon name="moon" size={15} strokeWidth={2} />}
            </button>
            {loading ? (
              <div
                className="h-8 w-24 animate-pulse rounded-field"
                style={{ background: "var(--surface-raised)" }}
              />
            ) : user ? (
              <>
                <Link
                  href="/profile"
                  className="flex items-center gap-2 text-sm transition-colors"
                  style={{ ...NAV_FONT, color: "var(--text-2)" }}
                >
                  {/* Die Plakette trug zwei feste rgba-Cyans. Beide leiten sich
                      jetzt aus dem Akzent ab — `color-mix` statt Alpha-Anhang,
                      wie im Token-Kopf vorgeschrieben. */}
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-field"
                    style={{
                      border:
                        "1px solid color-mix(in oklab, var(--accent) 40%, transparent)",
                      background: "var(--accent-subtle)",
                      color: "var(--accent-text)",
                      font: "var(--type-meta)",
                    }}
                  >
                    {initialsOf(fighterName)}
                  </span>
                  <span className="hidden lg:inline">{fighterName}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  /* Der Farbwechsel lief über zwei JS-Handler auf ein festes
                     Rosa. Jetzt eine Tailwind-Sperre, die `hoverOnlyWhenSupported`
                     mitnimmt: Auf Touch gibt es sie gar nicht erst. Und der Griff
                     ist ein AUFHELLEN statt eines Farbwechsels — Abmelden ist
                     nicht zerstörerisch, es braucht keine Warnfarbe. */
                  className="text-sm transition-colors text-[var(--text-3)] hover:text-[var(--text-1)]"
                  style={NAV_FONT}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm transition-colors text-[var(--text-2)] hover:text-[var(--text-1)]"
                  style={NAV_FONT}
                >
                  Login
                </Link>
                <Link href="/register" className="btn-primary px-4 py-2 text-xs">
                  Registrieren
                </Link>
              </>
            )}
          </div>

          {/* Mobile Hamburger */}
          <button
            onClick={() =>
              setMobileOpen((v) => {
                if (v) setOpenMobileGroup(null);
                return !v;
              })
            }
            className="rounded-field p-2 md:hidden"
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--line)",
              color: "var(--text-1)",
            }}
            aria-label={mobileOpen ? "Menü schließen" : "Menü öffnen"}
            aria-expanded={mobileOpen}
          >
            <span
              className="block h-0.5 w-5 origin-center transition-transform"
              style={{
                background: "currentColor",
                transform: mobileOpen ? "translateY(6px) rotate(45deg)" : "none",
              }}
            />
            <span
              className="mt-1 block h-0.5 w-5 transition-opacity"
              style={{ background: "currentColor", opacity: mobileOpen ? 0 : 1 }}
            />
            <span
              className="mt-1 block h-0.5 w-5 origin-center transition-transform"
              style={{
                background: "currentColor",
                transform: mobileOpen ? "translateY(-6px) rotate(-45deg)" : "none",
              }}
            />
          </button>
        </nav>
      </header>

      {/* Mobile Menü — Vollbild unterhalb der Kopfzeile */}
      {mobileOpen && (
        <div
          className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto border-t md:hidden"
          style={{ borderColor: "var(--line)", background: "var(--surface-page)" }}
        >
          <div className="flex min-h-full flex-col p-4">
            {visibleGroups.map((group) => {
              const groupActive = isGroupActive(group);
              const groupMobileOpen = openMobileGroup === group.id;

              return (
                <div key={group.id} className="overflow-hidden">
                  {group.href ? (
                    // Direct link (Timer)
                    <Link
                      href={group.href}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2.5 px-2 py-3 text-sm font-bold uppercase transition-colors"
                      style={{ ...NAV_FONT, color: groupActive ? "var(--accent-text)" : "var(--text-2)" }}
                    >
                      {group.icon && <span style={{ opacity: 0.7 }}>{group.icon}</span>}
                      {group.label}
                    </Link>
                  ) : (
                    <>
                      {/* Accordion header */}
                      <button
                        onClick={() => toggleMobileGroup(group.id)}
                        data-press="quiet"
                        className="flex w-full items-center justify-between px-2 py-3 text-sm transition-colors"
                        style={{ ...NAV_FONT, color: groupActive ? "var(--accent-text)" : "var(--text-2)" }}
                      >
                        <span className="flex items-center gap-2.5">
                          {group.icon && <span style={{ opacity: 0.7 }}>{group.icon}</span>}
                          {group.label}
                        </span>
                        <span
                          style={{
                            transition: "transform 0.2s",
                            transform: groupMobileOpen ? "rotate(180deg)" : "none",
                          }}
                        >
                          <Icon name="chevron-down" size={14} strokeWidth={2.5} />
                        </span>
                      </button>

                      {/* Accordion children — Collapse verwandelt die Höhe,
                          statt die Unterlinks aufpoppen zu lassen */}
                      <Collapse open={groupMobileOpen}>
                        <div
                          className="mb-2 ml-6 flex flex-col border-l"
                          style={{ borderColor: "var(--line)" }}
                        >
                          {group.children?.map((child) => {
                            const childActive = isChildActive(child);
                            return (
                              <div key={child.href}>
                              {child.section && (
                                <div className="px-4 pb-1 pt-3" style={NAV_SECTION}>
                                  {child.section}
                                </div>
                              )}
                              <Link
                                href={child.href}
                                onClick={() => setMobileOpen(false)}
                                data-press="quiet"
                                className="px-4 py-2.5 text-xs transition-colors"
                                style={{
                                  ...NAV_FONT,
                                  color: childActive
                                    ? "var(--accent-text)"
                                    : "var(--text-2)",
                                }}
                              >
                                {child.label}
                              </Link>
                              </div>
                            );
                          })}
                        </div>
                      </Collapse>
                    </>
                  )}
                </div>
              );
            })}

            {/* Auth section */}
            <div
              className="mt-auto flex flex-col gap-2 border-t pt-4"
              style={{ borderColor: "var(--line)" }}
            >
              {/* Theme toggle row */}
              <button
                onClick={toggleTheme}
                data-press="quiet"
                className="flex w-full items-center gap-2.5 px-2 py-2 text-sm transition-colors"
                style={{ ...NAV_FONT, color: "var(--text-2)" }}
              >
                <span style={{ opacity: 0.7 }}>
                  {theme === "dark" ? <Icon name="sun" size={15} strokeWidth={2} /> : <Icon name="moon" size={15} strokeWidth={2} />}
                </span>
                {theme === "dark" ? "Helles Design" : "Dunkles Design"}
              </button>
              <div className="flex gap-2">
                {user ? (
                  <>
                    <Link
                      href="/profile"
                      onClick={() => setMobileOpen(false)}
                      className="btn-secondary flex-1 px-4 py-2 text-xs"
                    >
                      {fighterName}
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="btn-secondary flex-1 px-4 py-2 text-xs"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setMobileOpen(false)}
                      className="btn-secondary flex-1 px-4 py-2 text-xs"
                    >
                      Login
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setMobileOpen(false)}
                      className="btn-primary flex-1 px-4 py-2 text-xs"
                    >
                      Registrieren
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
