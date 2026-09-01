"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth, useRights } from "@/lib/auth-context";
import Skeleton from "@/components/ui/Skeleton";

/**
 * Schützt den Verwaltungsbereich (`/verwaltung`, Multi-Gym Phase 2) — nur wer
 * das Gym führen darf, kommt hinein. Der Plattform-Rang ist eingerechnet
 * (`useRights()`); ein Trainer OHNE Verwaltungshäkchen ist es nicht, und das
 * ist Leons Entscheidung vom 31.08.2026: „Einladen darf nur die Verwaltung."
 *
 * DER GUARD GILT IN BEIDE RICHTUNGEN. Nach unten ist er die eine Bedingung,
 * die es braucht — anders als `TrainerRoute` fragt er NICHT nach dem
 * Trainer-Häkchen, denn eine reine Bürokraft ohne Kurse ist genau der Fall,
 * für den dieser Bereich existiert. Nach oben weist er den Trainer ohne
 * Verwaltungsrecht ab: Die Firestore-Regeln täten es ohnehin, aber eine leere
 * Seite mit Fehlermeldung ist keine Antwort.
 *
 * Er ist die DRITTE Schicht, nicht die erste. Davor stehen die Middleware
 * (`lib/verwaltung-routes.ts`) und die Firestore-Regeln (`canManageGymId`);
 * durchgesetzt wird die Trennung dort, hier geht es um die Anzeige.
 */
export default function VerwaltungRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, profileLoading } = useAuth();
  const rights = useRights();
  const router = useRouter();

  const isReady = !loading && !profileLoading;
  const allowed = rights.verwaltung;

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!allowed) router.replace("/dashboard");
  }, [isReady, user, allowed, router]);

  if (!isReady) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!user || !allowed) return null;

  return <>{children}</>;
}
