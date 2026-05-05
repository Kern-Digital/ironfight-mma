"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth, useFighterName } from "@/lib/auth-context";

const links = [
  { href: "/", label: "Home" },
  { href: "/training", label: "Training" },
  { href: "/techniques", label: "Techniken" },
  { href: "/workout/generator", label: "Generator" },
  { href: "/timer", label: "Timer" },
  { href: "/dashboard", label: "Dashboard" },
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

  return (
    <header className="sticky top-0 z-50 border-b border-carbon-500/60 bg-carbon-900/80 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-2xl font-black uppercase tracking-tight"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-blood text-sm font-black text-white">
            MMA
          </span>
          <span>
            Iron<span className="text-blood">Fight</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors lg:text-sm lg:px-4 ${
                  active ? "text-blood" : "text-foreground/70 hover:text-foreground"
                }`}
              >
                {link.label}
                {active && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 bg-blood" />
                )}
              </Link>
            );
          })}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {loading ? (
            <div className="h-8 w-24 animate-pulse rounded-sm bg-carbon-600" />
          ) : user ? (
            <>
              <Link
                href="/profile"
                className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground/80 hover:text-blood"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-sm border border-blood bg-blood/15 text-xs font-black text-blood">
                  {initialsOf(fighterName)}
                </span>
                <span className="hidden lg:inline">{fighterName}</span>
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm font-bold uppercase tracking-wider text-foreground/60 hover:text-blood"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-bold uppercase tracking-wider text-foreground/80 hover:text-blood"
              >
                Login
              </Link>
              <Link href="/register" className="btn-primary px-4 py-2 text-xs">
                Join Now
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-sm border border-carbon-400 p-2 md:hidden"
          aria-label="Toggle menu"
        >
          <span className="block h-0.5 w-5 bg-foreground" />
          <span className="mt-1 block h-0.5 w-5 bg-foreground" />
          <span className="mt-1 block h-0.5 w-5 bg-foreground" />
        </button>
      </nav>

      {open && (
        <div className="border-t border-carbon-500/60 bg-carbon-800 md:hidden">
          <div className="flex flex-col p-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="px-2 py-3 text-sm font-bold uppercase tracking-wider text-foreground/80 hover:text-blood"
              >
                {link.label}
              </Link>
            ))}
            {user && (
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="px-2 py-3 text-sm font-bold uppercase tracking-wider text-foreground/80 hover:text-blood"
              >
                Profil ({fighterName})
              </Link>
            )}
            <div className="mt-2 flex gap-2 border-t border-carbon-500 pt-3">
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
                    Join Now
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
