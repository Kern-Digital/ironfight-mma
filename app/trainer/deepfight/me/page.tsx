"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Skeleton from "@/components/ui/Skeleton";

/**
 * „Meine Analyse" — stabile Adresse aus dem Kampfprofil („Meine Analyse
 * starten"). Seit dem Neuaufbau (07.09.2026) führt sie auf die Landung des
 * Bereichs mit der eigenen uid als vorgewähltem Ziel: Ein Trainer
 * analysiert sich exakt wie einen Athleten, in derselben Werkbank.
 *
 * Bleibt eine Client-Weiterleitung, weil next.config.mjs die uid nicht
 * kennt — und sie läuft im Bereichs-Layout, also schon auf der Schicht.
 */
export default function MyAnalysisPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace(`/trainer/deepfight/analyse?modus=leute&ziel=${user.uid}`);
    }
  }, [loading, user, router]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Skeleton className="h-40 w-full rounded-card" />
    </div>
  );
}
