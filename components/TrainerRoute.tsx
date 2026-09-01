"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { isVerwaltungPath } from "@/lib/verwaltung-routes";
import Skeleton from "@/components/ui/Skeleton";

/**
 * Schützt eine Route — nur Trainer und Admins dürfen passieren.
 * Nicht-eingeloggte → /login, normale User → /dashboard.
 *
 * AUSNAHME seit Checkpoint 2: Die Verwaltungs-Seiten unter /trainer
 * (lib/verwaltung-routes.ts) folgen dem VERWALTUNGSRECHT, nicht dem
 * Trainer-Recht. Eine reine Verwaltung ohne Trainer-Häkchen hat role="user"
 * und wäre hier sonst auf /dashboard gelandet — obwohl Middleware und
 * Firestore-Regeln sie durchlassen.
 *
 * Hinweis Datenschutz: Dieser Guard ist eine UI-Schicht. Verlasse dich
 * NICHT allein darauf, sondern setze auch passende Firestore-Regeln,
 * damit Trainer per Rolle Lese-Zugriff auf die `users`-Collection
 * (und ggf. Sub-Collections) haben.
 */
export default function TrainerRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, profileLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isReady = !loading && !profileLoading;
  const isTrainer = profile?.role === "trainer" || profile?.role === "admin";
  const isVerwaltung = profile?.verwaltung === true;
  // Verwaltungs-Seiten: Verwaltungsrecht genügt (und ein Trainer OHNE dieses
  // Recht kommt dort umgekehrt nicht durch — er sieht sonst nur Fehler).
  const allowed = isVerwaltungPath(pathname)
    ? isVerwaltung || profile?.role === "admin"
    : isTrainer;

  useEffect(() => {
    if (!isReady) return;
    if (!user) { router.replace("/login"); return; }
    if (!allowed) { router.replace("/dashboard"); }
  }, [isReady, user, allowed, router]);

  if (!isReady) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="space-y-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      </div>
    );
  }

  if (!user || !allowed) return null;

  return <>{children}</>;
}
