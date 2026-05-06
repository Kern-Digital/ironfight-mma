"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Skeleton from "@/components/ui/Skeleton";

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  // Verhindert Endlos-Skeleton bei langsamer Verbindung (typisch auf Mobile)
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setTimedOut(true), 12000);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  // Timeout: Auth-State hat nach 12 Sek. nicht geantwortet
  if (loading && timedOut) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-32 sm:px-6">
        <div className="mx-auto max-w-md text-center">
          <div className="mb-4 text-4xl">⚠️</div>
          <h2 className="heading-display text-xl font-black">Verbindungsproblem</h2>
          <p className="mt-3 text-sm text-foreground/70">
            Die Verbindung zum Server dauert ungewöhnlich lange.
            Bitte prüfe deine Internetverbindung.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 btn-primary"
          >
            Seite neu laden
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-12 w-72 mb-8" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="mt-10 space-y-3">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-32 sm:px-6">
        <div className="mx-auto max-w-md text-center">
          <div className="mb-4 text-4xl">🔒</div>
          <h2 className="heading-display text-2xl font-black">Login erforderlich</h2>
          <p className="mt-3 text-sm text-foreground/70">
            Dieser Bereich ist nur für eingeloggte Nutzer zugänglich.
            Bitte melde dich an, um fortzufahren.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/login" className="btn-primary">
              Zum Login
            </Link>
            <Link href="/register" className="btn-secondary">
              Kostenlos registrieren
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
