"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import Skeleton from "@/components/ui/Skeleton";
import Icon from "@/components/ui/Icon";
import DeepFightWordmark from "@/components/DeepFightWordmark";
import OpponentProfileView from "@/components/trainer/OpponentProfileView";
import { getOpponent, type Opponent } from "@/lib/opponents";

/**
 * Read-only Gegnerprofil für Schüler — erreichbar nur, wenn der Trainer das
 * Profil für diesen Schüler freigegeben hat (Firestore-Regel: sharedWith).
 * Ohne Freigabe liefert Firestore permission-denied → freundlicher Hinweis.
 */
function SharedOpponentContent({ id }: { id: string }) {
  const [opponent, setOpponent] = useState<Opponent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const o = await getOpponent(id);
      if (!o) throw new Error("not-found");
      setOpponent(o);
    } catch {
      setError(
        "Dieses Gegnerprofil ist nicht (mehr) für dich freigegeben oder existiert nicht.",
      );
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="min-h-screen" style={{ background: "var(--ink-0)" }}>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Link
          href="/deepfight"
          className="inline-flex items-center gap-2"
          style={{ color: "var(--fg-3)", textDecoration: "none" }}
        >
          <Icon name="arrow-left" size={18} />
          <span
            className="font-mono-ta text-[10px] font-bold uppercase"
            style={{ letterSpacing: "0.18em" }}
          >
            <DeepFightWordmark />
          </span>
        </Link>

        <div className="mt-5">
          {error ? (
            <div
              className="rounded-2xl p-10 text-center"
              style={{
                background: "var(--ink-2)",
                border: "1px dashed var(--ink-5)",
              }}
            >
              <p className="text-sm font-bold" style={{ color: "var(--fg-3)" }}>
                {error}
              </p>
              <Link
                href="/deepfight"
                className="btn-secondary mt-4 inline-flex px-4 py-2 text-xs"
              >
                Zurück zu „Mein DeepFight"
              </Link>
            </div>
          ) : opponent === null ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
          ) : (
            <OpponentProfileView
              opponent={{
                name: opponent.name,
                style: opponent.style,
                stance: opponent.stance,
                heightCm: opponent.heightCm,
                weightKg: opponent.weightKg,
                reachCm: opponent.reachCm,
                strengths: opponent.strengths,
                weaknesses: opponent.weaknesses,
                favoriteAttacks: opponent.favoriteAttacks,
                notes: opponent.notes,
                dna: opponent.dna,
                dnaSplit: opponent.dnaSplit,
                actionStats: opponent.actionStats,
              }}
            />
          )}
        </div>
      </div>
    </main>
  );
}

export default function SharedOpponentPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <ProtectedRoute>
      <SharedOpponentContent id={params.id} />
    </ProtectedRoute>
  );
}
