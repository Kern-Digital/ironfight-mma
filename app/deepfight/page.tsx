"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import DeepFightWordmark from "@/components/DeepFightWordmark";
import Skeleton from "@/components/ui/Skeleton";
import Icon from "@/components/ui/Icon";
import VideoAnalysisResult from "@/components/trainer/VideoAnalysisResult";
import { useAuth } from "@/lib/auth-context";
import { listOpponentsSharedWith, type Opponent } from "@/lib/opponents";
import { listVideoAnalyses, type VideoAnalysis } from "@/lib/video-analysis";
import { FIGHT_STYLE_LABEL } from "@/lib/fight-camp";
import { totalAnswered } from "@/lib/gegner-dna";

function formatDate(d: Date): string {
  return d.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * „Mein DeepFight" — die Schüler-Sicht auf DeepFight (read-only):
 *   • Auswertungen, die der Trainer für diesen Athleten freigegeben hat
 *   • Gegnerprofile, die der Trainer für ihn freigegeben hat
 * Das DeepFight-Werkzeug selbst (Scouting, Analysen starten) bleibt
 * ausschließlich Trainern/Admins vorbehalten.
 */
function MyDeepFightContent() {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<VideoAnalysis[] | null>(null);
  const [opponents, setOpponents] = useState<Opponent[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [a, o] = await Promise.all([
      // Eigene Analysen: nur die vom Trainer freigegebenen anzeigen
      listVideoAnalyses("athlete", user.uid)
        .then((list) => list.filter((x) => x.sharedWithAthlete))
        .catch(() => [] as VideoAnalysis[]),
      listOpponentsSharedWith(user.uid).catch(() => [] as Opponent[]),
    ]);
    setAnalyses(a);
    setOpponents(o);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const loading = analyses === null || opponents === null;
  const sharedAnalyses = analyses ?? [];
  const sharedOpponents = opponents ?? [];
  const empty =
    !loading && sharedAnalyses.length === 0 && sharedOpponents.length === 0;

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
        <div className="mx-auto max-w-5xl">
          <h1
            className="font-display-ta flex items-center font-black uppercase leading-none"
            style={{
              fontSize: "clamp(24px, 4vw, 36px)",
              letterSpacing: "0.02em",
            }}
          >
            <DeepFightWordmark />
          </h1>
          <p
            className="font-mono-ta mt-2 text-[11px] uppercase"
            style={{ letterSpacing: "0.2em", color: "var(--fg-4)" }}
          >
            Deine Auswertungen · Freigegebene Gegnerprofile
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {loading ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        ) : empty ? (
          <div
            className="rounded-2xl p-10 text-center"
            style={{
              background: "var(--ink-2)",
              border: "1px dashed var(--ink-5)",
            }}
          >
            <p className="text-sm font-bold" style={{ color: "var(--fg-3)" }}>
              Hier ist noch nichts freigegeben.
            </p>
            <p
              className="mx-auto mt-1 max-w-md text-xs"
              style={{ color: "var(--fg-4)" }}
            >
              Dein Trainer kann DeepFight-Auswertungen zu dir sowie
              Gegnerprofile für dich freischalten — sie erscheinen dann
              automatisch auf dieser Seite.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {/* Eigene Auswertungen */}
            {sharedAnalyses.length > 0 && (
              <section>
                <h2
                  className="font-display-ta font-black uppercase"
                  style={{ fontSize: "18px", letterSpacing: "0.06em" }}
                >
                  Deine Auswertungen
                </h2>
                <p
                  className="font-mono-ta mt-1 text-[10px]"
                  style={{ letterSpacing: "0.18em", color: "var(--fg-4)" }}
                >
                  Vom Trainer freigegebene Analysen deiner Kampf-Videos
                </p>
                <div className="mt-4 flex flex-col gap-3">
                  {sharedAnalyses.map((a) => {
                    const open = expandedId === a.id;
                    return (
                      <div key={a.id}>
                        <button
                          onClick={() => setExpandedId(open ? null : a.id)}
                          className="flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-left"
                          style={{
                            background: open
                              ? "rgba(157,123,250,0.1)"
                              : "var(--ink-2)",
                            border: `1px solid ${open ? "rgba(157,123,250,0.4)" : "var(--ink-4)"}`,
                          }}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              style={{
                                color: "var(--ta-violet)",
                                flexShrink: 0,
                              }}
                            >
                              <Icon name="video" size={16} />
                            </span>
                            <div className="min-w-0">
                              <div
                                className="truncate text-xs font-bold"
                                style={{ color: "var(--fg-2)" }}
                              >
                                {a.sourceLabel}
                              </div>
                              <div
                                className="font-mono-ta text-[9px] uppercase"
                                style={{
                                  letterSpacing: "0.1em",
                                  color: "var(--fg-4)",
                                }}
                              >
                                {formatDate(a.createdAt)} · Auswertung deines
                                Kampfs
                              </div>
                            </div>
                          </div>
                          <span
                            style={{
                              color: "var(--fg-4)",
                              transform: open ? "rotate(90deg)" : "none",
                              transition: "transform 0.15s",
                              lineHeight: 0,
                            }}
                          >
                            <Icon name="arrow-right" size={13} />
                          </span>
                        </button>
                        {open && (
                          <div className="mt-2">
                            <VideoAnalysisResult
                              analysis={a}
                              mode="athlete"
                              existingDna={null}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Freigegebene Gegnerprofile */}
            {sharedOpponents.length > 0 && (
              <section>
                <h2
                  className="font-display-ta font-black uppercase"
                  style={{ fontSize: "18px", letterSpacing: "0.06em" }}
                >
                  Gegnerprofile
                </h2>
                <p
                  className="font-mono-ta mt-1 text-[10px]"
                  style={{ letterSpacing: "0.18em", color: "var(--fg-4)" }}
                >
                  Vom Trainer für deine Vorbereitung freigegeben
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {sharedOpponents.map((o) => {
                    const entries = totalAnswered(o.dna);
                    return (
                      <Link
                        key={o.id}
                        href={`/deepfight/opponents/${o.id}`}
                        className="rounded-2xl p-4 transition-colors"
                        style={{
                          background: "var(--ink-2)",
                          border: "1px solid var(--ink-4)",
                          textDecoration: "none",
                        }}
                      >
                        <div
                          className="font-display-ta truncate font-black uppercase"
                          style={{
                            fontSize: "16px",
                            letterSpacing: "0.04em",
                            color: "var(--fg)",
                          }}
                        >
                          {o.name}
                        </div>
                        <div
                          className="font-mono-ta mt-1 text-[10px] font-bold uppercase"
                          style={{
                            letterSpacing: "0.14em",
                            color: "#9D7BFA",
                          }}
                        >
                          {FIGHT_STYLE_LABEL[o.style]}
                        </div>
                        <div
                          className="font-mono-ta mt-2 flex items-center gap-1.5 text-[10px]"
                          style={{
                            letterSpacing: "0.12em",
                            color: "var(--fg-4)",
                          }}
                        >
                          <Icon name="shield" size={12} />
                          {entries} {entries === 1 ? "Eintrag" : "Einträge"}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export default function MyDeepFightPage() {
  return (
    <ProtectedRoute>
      <MyDeepFightContent />
    </ProtectedRoute>
  );
}
