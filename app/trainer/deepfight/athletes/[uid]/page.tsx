"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import Icon from "@/components/ui/Icon";
import DeepFightWordmark from "@/components/DeepFightWordmark";
import VideoAnalysisSection from "@/components/trainer/VideoAnalysisSection";
import { getStudentEntry, type StudentEntry } from "@/lib/admin";
import { DISCIPLINE_LABEL, WEIGHT_CLASS_LABEL } from "@/lib/types";

function labelOf(entry: StudentEntry): string {
  return entry.displayName ?? entry.authProviderName ?? entry.email ?? entry.uid;
}

function initialsOf(entry: StudentEntry): string {
  const parts = labelOf(entry).trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/**
 * DeepFight für EINEN eigenen Schüler — die „umgekehrte" DeepFight-Richtung.
 * Bewusst eine eigene Route (statt eines Anker-Blocks auf der Schülerseite):
 * die Analyse ist verlinkbar, aus dem DeepFight-Menü wie aus dem Schülerprofil
 * erreichbar und lädt nicht die komplette Trainings-Historie mit.
 */
function AthleteDeepFightContent({ uid }: { uid: string }) {
  const [entry, setEntry] = useState<StudentEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setEntry(null);
    try {
      const e = await getStudentEntry(uid);
      if (!e) throw new Error("Schüler nicht gefunden");
      setEntry(e);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    }
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <ErrorState
          title="Schüler konnte nicht geladen werden"
          message={error}
          onRetry={load}
        />
      </div>
    );
  }

  const athlete = entry?.athlete;

  return (
    <main className="min-h-screen" style={{ background: "var(--ink-1)" }}>
      {/* Kopf */}
      <div
        className="relative overflow-hidden border-b px-4 py-8 sm:px-6"
        style={{
          borderColor: "rgba(157,123,250,0.25)",
          background:
            "radial-gradient(500px 250px at 100% 50%, rgba(157,123,250,0.12), transparent 60%), linear-gradient(160deg, #0B0716, #080512)",
        }}
      >
        <div className="mx-auto max-w-7xl">
          <Link
            href="/trainer/deepfight/athletes"
            className="font-mono-ta text-[10px] uppercase"
            style={{ letterSpacing: "0.2em", color: "var(--fg-4)" }}
          >
            ← Schüler-Analysen
          </Link>

          {!entry ? (
            <Skeleton className="mt-3 h-14 w-64 rounded-2xl" />
          ) : (
            <div className="mt-3 flex items-start gap-4">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl font-display-ta text-lg font-black"
                style={{
                  background: "rgba(157,123,250,0.1)",
                  border: "1px solid rgba(157,123,250,0.4)",
                  color: "#9D7BFA",
                }}
              >
                {initialsOf(entry)}
              </div>
              <div className="min-w-0 flex-1">
                <h1
                  className="font-display-ta flex items-center font-black uppercase leading-none"
                  style={{
                    fontSize: "clamp(22px, 3.6vw, 32px)",
                    letterSpacing: "0.02em",
                  }}
                >
                  <DeepFightWordmark />
                </h1>
                <p
                  className="mt-2 truncate text-sm font-bold"
                  style={{ color: "var(--fg-2)" }}
                >
                  {labelOf(entry)}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {athlete?.primaryDiscipline && (
                    <span
                      className="font-mono-ta rounded px-1.5 py-0.5 text-[10px] uppercase"
                      style={{
                        letterSpacing: "0.12em",
                        background: "rgba(157,123,250,0.1)",
                        border: "1px solid rgba(157,123,250,0.3)",
                        color: "#9D7BFA",
                      }}
                    >
                      {DISCIPLINE_LABEL[athlete.primaryDiscipline]}
                    </span>
                  )}
                  {athlete?.weightClass && (
                    <span
                      className="font-mono-ta rounded px-1.5 py-0.5 text-[10px] uppercase"
                      style={{
                        letterSpacing: "0.12em",
                        background: "var(--ink-4)",
                        border: "1px solid var(--ink-5)",
                        color: "var(--fg-3)",
                      }}
                    >
                      {WEIGHT_CLASS_LABEL[athlete.weightClass]}
                    </span>
                  )}
                </div>
              </div>
              <Link
                href={`/trainer/students/${uid}`}
                className="btn-secondary hidden shrink-0 px-4 py-2 text-xs sm:inline-flex"
              >
                <Icon name="users" size={14} />
                Schülerprofil
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Link
          href={`/trainer/students/${uid}`}
          className="btn-secondary mb-5 inline-flex px-4 py-2 text-xs sm:hidden"
        >
          <Icon name="users" size={14} />
          Schülerprofil
        </Link>

        {!entry ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        ) : (
          <VideoAnalysisSection
            mode="athlete"
            targetId={uid}
            targetName={labelOf(entry)}
          />
        )}
      </div>
    </main>
  );
}

export default function AthleteDeepFightPage({
  params,
}: {
  params: { uid: string };
}) {
  return <AthleteDeepFightContent uid={params.uid} />;
}
