"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { useAuth, useFighterName } from "@/lib/auth-context";

// ── Icons ──────────────────────────────────────────────────────
function IconDumbbell() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 4v16M18 4v16M6 8h12M6 16h12M3 4h3M18 4h3M3 20h3M18 20h3" />
    </svg>
  );
}

function IconBook() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function IconTimer() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5" />
      <path d="M9.5 3h5" />
      <path d="M12 3v2" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M6 20v-2a6 6 0 0 1 12 0v2" />
    </svg>
  );
}

function IconChevron({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function IconAdmin() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

// ── Types ──────────────────────────────────────────────────────
interface NavChild {
  href: string;
  label: string;
  activePattern?: RegExp;
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  children?: NavChild[];
}

// ── Nav Config ─────────────────────────────────────────────────
const navGroups: NavGroup[] = [
  {
    id: "training",
    label: "Training",
    icon: <IconDumbbell />,
    children: [
      { href: "/workout/generator", label: "Workouts", activePattern: /^\/workout/ },
      { href: "/schedule", label: "Kursplan" },
    ],
  },
  {
    id: "lernen",
    label: "Lernen",
    icon: <IconBook />,
    children: [
      { href: "/techniques", label: "Techniken" },
      { href: "/regeln", label: "Regeln" },
      { href: "/quiz", label: "Quiz" },
    ],
  },
  {
    id: "timer",
    label: "Timer",
    icon: <IconTimer />,
    href: "/timer",
  },
  {
    id: "profil",
    label: "Profil",
    icon: <IconUser />,
    children: [
      { href: "/library", label: "Sammlung" },
      { href: "/dashboard", label: "Verlauf" },
      { href: "/profile", label: "Account" },
    ],
  },
];

const adminNavGroup: NavGroup = {
  id: "admin",
  label: "Admin",
  icon: <IconAdmin />,
  children: [
    { href: "/admin/users", label: "Nutzer" },
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
  const { user, loading, logOut, profile } = useAuth();
  const fighterName = useFighterName();
  const isAdmin = profile?.role === "admin";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMobileGroups, setOpenMobileGroups] = useState<Set<string>>(new Set());
  const [openDesktopGroup, setOpenDesktopGroup] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setOpenMobileGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const monoStyle = {
    fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
    letterSpacing: "0.12em",
  };

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur"
      style={{
        background: "linear-gradient(180deg, rgba(7,9,12,.95), rgba(3,4,6,.92))",
        borderBottom: "1px solid var(--ink-4)",
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
            className="rounded-xl"
          />
          <div>
            <div
              className="font-display-ta text-lg font-black uppercase leading-none"
              style={{ letterSpacing: "0.12em" }}
            >
              <span style={{ color: "var(--ta-pink)" }}>Tidal</span>
              <span style={{ color: "var(--ta-cyan)" }}>Athletics</span>
            </div>
            <div
              className="font-mono-ta text-[9px] uppercase"
              style={{ letterSpacing: "0.25em", color: "var(--fg-3)", marginTop: "2px" }}
            >
              MMA Training
            </div>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-0.5 md:flex">
          {[...navGroups, ...(isAdmin ? [adminNavGroup] : [])].map((group) => {
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
                    style={{ ...monoStyle, color: active ? "var(--ta-cyan)" : "var(--fg-3)" }}
                  >
                    <span style={{ opacity: 0.75 }}>{group.icon}</span>
                    {group.label}
                    {active && (
                      <span
                        className="absolute inset-x-2 -bottom-px h-0.5 rounded-b"
                        style={{ background: "var(--ta-cyan)", boxShadow: "0 0 8px var(--ta-cyan)" }}
                      />
                    )}
                  </Link>
                ) : (
                  // Dropdown trigger
                  <button
                    className="relative flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase transition-colors lg:px-4 lg:text-sm"
                    style={{ ...monoStyle, color: active || isOpen ? "var(--ta-cyan)" : "var(--fg-3)" }}
                    aria-haspopup="true"
                    aria-expanded={isOpen}
                  >
                    <span style={{ opacity: 0.75 }}>{group.icon}</span>
                    {group.label}
                    <span
                      style={{
                        transition: "transform 0.2s",
                        transform: isOpen ? "rotate(180deg)" : "none",
                        opacity: 0.5,
                      }}
                    >
                      <IconChevron />
                    </span>
                    {active && !isOpen && (
                      <span
                        className="absolute inset-x-2 -bottom-px h-0.5 rounded-b"
                        style={{ background: "var(--ta-cyan)", boxShadow: "0 0 8px var(--ta-cyan)" }}
                      />
                    )}
                  </button>
                )}

                {/* Dropdown Panel */}
                {group.children && isOpen && (
                  <div
                    className="absolute left-0 top-full z-50 mt-1 min-w-[180px] overflow-hidden rounded-xl py-1"
                    style={{
                      background: "rgba(7,9,12,0.98)",
                      border: "1px solid var(--ink-5)",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,212,230,0.06)",
                    }}
                  >
                    {group.children.map((child) => {
                      const childActive = isChildActive(child);
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setOpenDesktopGroup(null)}
                          className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase transition-colors"
                          style={{
                            ...monoStyle,
                            color: childActive ? "var(--ta-cyan)" : "var(--fg-3)",
                            background: childActive ? "rgba(0,212,230,0.07)" : "transparent",
                          }}
                          onMouseEnter={(e) => {
                            if (!childActive)
                              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = childActive
                              ? "rgba(0,212,230,0.07)"
                              : "transparent";
                          }}
                        >
                          {childActive && (
                            <span
                              className="h-3 w-0.5 rounded-full"
                              style={{ background: "var(--ta-cyan)", flexShrink: 0 }}
                            />
                          )}
                          {child.label}
                        </Link>
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
          {loading ? (
            <div
              className="h-8 w-24 animate-pulse rounded-xl"
              style={{ background: "var(--ink-4)" }}
            />
          ) : user ? (
            <>
              <Link
                href="/profile"
                className="flex items-center gap-2 text-sm font-bold uppercase transition-colors"
                style={{
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.1em",
                  color: "var(--fg-2)",
                }}
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black"
                  style={{
                    border: "1px solid rgba(0,212,230,.4)",
                    background: "rgba(0,212,230,.08)",
                    color: "var(--ta-cyan)",
                  }}
                >
                  {initialsOf(fighterName)}
                </span>
                <span className="hidden lg:inline">{fighterName}</span>
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm font-bold uppercase transition-colors"
                style={{
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.1em",
                  color: "var(--fg-4)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ta-pink)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--fg-4)")}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-bold uppercase transition-colors"
                style={{
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.1em",
                  color: "var(--fg-3)",
                }}
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
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-xl p-2 md:hidden"
          style={{
            background: "var(--ink-3)",
            border: "1px solid var(--ink-5)",
            color: "var(--fg-2)",
          }}
          aria-label="Menü öffnen"
        >
          <span className="block h-0.5 w-5" style={{ background: "currentColor" }} />
          <span className="mt-1 block h-0.5 w-5" style={{ background: "currentColor" }} />
          <span className="mt-1 block h-0.5 w-5" style={{ background: "currentColor" }} />
        </button>
      </nav>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div
          className="border-t md:hidden"
          style={{ borderColor: "var(--ink-4)", background: "var(--ink-1)" }}
        >
          <div className="flex flex-col p-4">
            {[...navGroups, ...(isAdmin ? [adminNavGroup] : [])].map((group) => {
              const groupActive = isGroupActive(group);
              const groupMobileOpen = openMobileGroups.has(group.id);

              return (
                <div key={group.id} className="overflow-hidden">
                  {group.href ? (
                    // Direct link (Timer)
                    <Link
                      href={group.href}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2.5 px-2 py-3 text-sm font-bold uppercase transition-colors"
                      style={{ ...monoStyle, color: groupActive ? "var(--ta-cyan)" : "var(--fg-3)" }}
                    >
                      <span style={{ opacity: 0.7 }}>{group.icon}</span>
                      {group.label}
                    </Link>
                  ) : (
                    <>
                      {/* Accordion header */}
                      <button
                        onClick={() => toggleMobileGroup(group.id)}
                        className="flex w-full items-center justify-between px-2 py-3 text-sm font-bold uppercase transition-colors"
                        style={{ ...monoStyle, color: groupActive ? "var(--ta-cyan)" : "var(--fg-3)" }}
                      >
                        <span className="flex items-center gap-2.5">
                          <span style={{ opacity: 0.7 }}>{group.icon}</span>
                          {group.label}
                        </span>
                        <span
                          style={{
                            transition: "transform 0.2s",
                            transform: groupMobileOpen ? "rotate(180deg)" : "none",
                          }}
                        >
                          <IconChevron size={14} />
                        </span>
                      </button>

                      {/* Accordion children */}
                      {groupMobileOpen && (
                        <div
                          className="mb-2 ml-6 flex flex-col border-l"
                          style={{ borderColor: "var(--ink-5)" }}
                        >
                          {group.children?.map((child) => {
                            const childActive = isChildActive(child);
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                onClick={() => setMobileOpen(false)}
                                className="px-4 py-2.5 font-bold uppercase transition-colors"
                                style={{
                                  ...monoStyle,
                                  fontSize: "0.75rem",
                                  color: childActive ? "var(--ta-cyan)" : "var(--fg-4)",
                                }}
                              >
                                {child.label}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {/* Auth section */}
            <div
              className="mt-2 flex gap-2 border-t pt-3"
              style={{ borderColor: "var(--ink-4)" }}
            >
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
      )}
    </header>
  );
}
