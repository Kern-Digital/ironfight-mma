"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth, useFighterName } from "@/lib/auth-context";

interface NavLink {
  href: string;
  label: string;
  activePattern?: RegExp;
}

const links: NavLink[] = [
  { href: "/", label: "Home" },
  {
    href: "/workout/generator",
    label: "Workout",
    activePattern: /^\/(workout|training)/,
  },
  { href: "/techniques", label: "Techniken" },
  { href: "/regeln", label: "Regeln" },
  { href: "/timer", label: "Timer" },
  { href: "/dashboard", label: "Mein Training" },
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "F") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logOut } = useAuth();
  const fighterName = useFighterName();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await logOut();
    setOpen(false);
    router.push("/");
  }

  function isActive(link: NavLink): boolean {
    if (link.activePattern) return link.activePattern.test(pathname);
    if (link.href === "/") return pathname === "/";
    return pathname.startsWith(link.href);
  }

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
        <Link
          href="/"
          className="flex items-center gap-3"
          style={{ textDecoration: "none" }}
        >
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

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const active = isActive(link);
            return (
              <Link
                key={link.href}
                href={link.href}
                className="relative px-3 py-2 text-xs font-bold uppercase transition-colors lg:px-4 lg:text-sm"
                style={{
                  fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
                  letterSpacing: "0.12em",
                  color: active ? "var(--ta-cyan)" : "var(--fg-3)",
                }}
              >
                {link.label}
                {active && (
                  <span
                    className="absolute inset-x-2 -bottom-px h-0.5 rounded-b"
                    style={{
                      background: "var(--ta-cyan)",
                      boxShadow: "0 0 8px var(--ta-cyan)",
                    }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* Auth controls */}
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
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--ta-pink)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--fg-4)")
                }
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

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-xl p-2 md:hidden"
          style={{
            background: "var(--ink-3)",
            border: "1px solid var(--ink-5)",
            color: "var(--fg-2)",
          }}
          aria-label="Toggle menu"
        >
          <span className="block h-0.5 w-5" style={{ background: "currentColor" }} />
          <span className="mt-1 block h-0.5 w-5" style={{ background: "currentColor" }} />
          <span className="mt-1 block h-0.5 w-5" style={{ background: "currentColor" }} />
        </button>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div
          className="border-t md:hidden"
          style={{
            borderColor: "var(--ink-4)",
            background: "var(--ink-1)",
          }}
        >
          <div className="flex flex-col p-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="px-2 py-3 text-sm font-bold uppercase transition-colors"
                style={{
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.12em",
                  color: isActive(link) ? "var(--ta-cyan)" : "var(--fg-3)",
                }}
              >
                {link.label}
              </Link>
            ))}
            {user && (
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="px-2 py-3 text-sm font-bold uppercase transition-colors"
                style={{
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.12em",
                  color: "var(--fg-3)",
                }}
              >
                Profil ({fighterName})
              </Link>
            )}
            <div
              className="mt-2 flex gap-2 border-t pt-3"
              style={{ borderColor: "var(--ink-4)" }}
            >
              {user ? (
                <button
                  onClick={handleLogout}
                  className="btn-secondary flex-1 px-4 py-2 text-xs"
                >
                  Logout
                </button>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="btn-secondary flex-1 px-4 py-2 text-xs"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setOpen(false)}
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
