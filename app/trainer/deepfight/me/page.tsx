"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Skeleton from "@/components/ui/Skeleton";

/**
 * „Meine Analyse" — Trainer-Selbstanalyse. Stabile Menü-URL, die auf die
 * bestehende Athleten-Analyseseite mit der eigenen uid weiterleitet: ein
 * Trainer analysiert sich selbst exakt wie einen Schüler (mode="athlete",
 * Merge-Ziel users/{uid}.fightProfile).
 */
export default function MyAnalysisPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace(`/trainer/deepfight/athletes/${user.uid}`);
    }
  }, [loading, user, router]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}
