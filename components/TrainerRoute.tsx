"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth, useRights } from "@/lib/auth-context";
import Skeleton from "@/components/ui/Skeleton";

/**
 * Schützt den Trainerbereich — nur wer die Trainer-Werkzeuge hat, darf
 * passieren (der Plattform-Rang ist in `useRights()` eingerechnet).
 * Nicht-eingeloggte → /login, alle anderen → /dashboard.
 *
 * SEIT CHECKPOINT 3 OHNE AUSNAHME. Vorher lagen die drei Verwaltungs-Seiten
 * unter `/trainer` und brauchten hier einen Sonderfall: Eine reine Verwaltung
 * ohne Trainer-Häkchen kam durch die Middleware und flog eine Zehntelsekunde
 * später von diesem Guard auf /dashboard. Der Umzug nach `/verwaltung` (mit
 * eigenem `VerwaltungRoute`) hat den Sonderfall überflüssig gemacht — das ist
 * die bessere Lösung als eine geteilte Pfadliste, die drei Türsteher kennen
 * müssen.
 *
 * Hinweis Datenschutz: Dieser Guard ist eine UI-Schicht. Verlasse dich
 * NICHT allein darauf, sondern setze auch passende Firestore-Regeln,
 * damit Trainer Lese-Zugriff auf die `users`-Collection (und ggf.
 * Sub-Collections) haben.
 */
export default function TrainerRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profileLoading } = useAuth();
  const rights = useRights();
  const router = useRouter();

  const isReady = !loading && !profileLoading;
  const allowed = rights.trainer;

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
