"use client";

/**
 * Kampfprofil — „Wer bin ich als Kämpfer" für ALLE Rollen (Schüler wie
 * Trainer). Gleicher Basis-Aufbau wie Gegner- und Schüler-Profile:
 *   • DeepFight-Profil (users/{uid}.fightProfile): Split, Insights, Stats, DNA
 *   • vom Trainer freigegebene eigene Auswertungen (sharedWithAthlete)
 *   • freigegebene Gegnerprofile (opponents.sharedWith)
 *   • editierbare Athleten-Daten (users/{uid}.athlete)
 *
 * Der Schüler sieht sein volles gemergtes Kampfprofil (bewusste Entscheidung,
 * 2026-08-19) — entwicklungsorientiert formuliert; kuratiert wird es vom
 * Trainer. App-Einstellungen und Account-Daten bleiben unter /profile.
 * Ersetzt die frühere Seite „Mein DeepFight" (/deepfight → Redirect hierher).
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import DeepFightWordmark from "@/components/DeepFightWordmark";
import AthleteProfileForm from "@/components/AthleteProfileForm";
import FightProfileView from "@/components/trainer/FightProfileView";
import VideoAnalysisResult from "@/components/trainer/VideoAnalysisResult";
import Skeleton from "@/components/ui/Skeleton";
import Icon from "@/components/ui/Icon";
import { useAuth, useFighterName } from "@/lib/auth-context";
import {
  getFightProfile,
  isFightProfileEmpty,
  type FightProfile,
} from "@/lib/fight-profile";
import { listOpponentsSharedWith, type Opponent } from "@/lib/opponents";
import { listVideoAnalyses, type VideoAnalysis } from "@/lib/video-analysis";
import { DISCIPLINE_LABEL, WEIGHT_CLASS_LABEL } from "@/lib/types";
import { FIGHT_STYLE_LABEL } from "@/lib/fight-camp";
import { totalAnswered } from "@/lib/gegner-dna";

function formatDate(d: Date): string {
  return d.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: React.ReactNode;
  subtitle: string;
}) {
  return (
    <>
      <h2
        className="font-display-ta flex items-center font-black uppercase"
        style={{ fontSize: "18px", letterSpacing: "0.06em" }}
      >
        {title}
      </h2>
      <p
        className="font-mono-ta mt-1 text-[10px]"
        style={{ letterSpacing: "0.18em", color: "var(--fg-4)" }}
      >
        {subtitle}
      </p>
    </>
  );
}

function KampfprofilContent() {
  const { user, profile } = useAuth();
  const fighterName = useFighterName();
  const isTrainer = profile?.role === "trainer" || profile?.role === "admin";

  const [fightProfile, setFightProfile] = useState<FightProfile | null>(null);
  const [analyses, setAnalyses] = useState<VideoAnalysis[] | null>(null);
  const [opponents, setOpponents] = useState<Opponent[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [fp, a, o] = await Promise.all([
      getFightProfile(user.uid).catch(() => null),
      // Eigene Auswertungen: nur die vom Trainer freigegebenen. sharedOnly
      // ist PFLICHT — die Firestore-Regeln erlauben dem Athleten nur noch
      // Dokumente mit sharedWithAthlete == true (Owner-Query ohne Filter
      // würde abgelehnt); der Client-Filter bleibt als zweite Schicht.
      listVideoAnalyses("athlete", user.uid, { sharedOnly: true })
        .then((list) => list.filter((x) => x.sharedWithAthlete))
        .catch(() => [] as VideoAnalysis[]),
      listOpponentsSharedWith(user.uid).catch(() => [] as Opponent[]),
    ]);
    setFightProfile(fp);
    setAnalyses(a);
    setOpponents(o);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const loading = analyses === null || opponents === null;
  const sharedAnalyses = analyses ?? [];
  const sharedOpponents = opponents ?? [];
  const profileEmpty = isFightProfileEmpty(fightProfile);
  const dnaEntries = fightProfile ? totalAnswered(fightProfile.dna) : 0;
  const athlete = profile?.athlete;

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
          <div
            className="font-mono-ta text-[10px] font-bold uppercase"
            style={{ letterSpacing: "0.25em", color: "#9D7BFA" }}
          >
            Kampfprofil
          </div>
          <h1
            className="font-display-ta mt-1 font-black uppercase leading-none"
            style={{
              fontSize: "clamp(24px, 4vw, 36px)",
              letterSpacing: "0.02em",
              color: "#fff",
            }}
          >
            {fighterName}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
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
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                {WEIGHT_CLASS_LABEL[athlete.weightClass]}
              </span>
            )}
            {dnaEntries > 0 && (
              <span
                className="font-mono-ta rounded px-1.5 py-0.5 text-[10px] uppercase"
                style={{
                  letterSpacing: "0.12em",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                {dnaEntries} DNA-{dnaEntries === 1 ? "Eintrag" : "Einträge"}
              </span>
            )}
          </div>
          {isTrainer && user && (
            <Link
              href="/trainer/deepfight/me"
              className="font-mono-ta mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[10px] font-bold uppercase"
              style={{
                letterSpacing: "0.12em",
                background: "var(--ta-violet)",
                color: "#fff",
                textDecoration: "none",
              }}
            >
              <Icon name="video" size={14} /> Meine Analyse starten
            </Link>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-10">
          {/* DeepFight-Profil */}
          <section>
            <SectionHeader
              title={<DeepFightWordmark />}
              subtitle="Dein Kampf-Stil aus KI-Video-Analysen und Trainer-Beobachtungen"
            />
            <div className="mt-4">
              {fightProfile === null && loading ? (
                <Skeleton className="h-40 w-full rounded-2xl" />
              ) : profileEmpty ? (
                <div
                  className="rounded-2xl p-8 text-center"
                  style={{
                    background: "var(--ink-2)",
                    border: "1px dashed var(--ink-5)",
                  }}
                >
                  <p className="text-sm font-bold" style={{ color: "var(--fg-3)" }}>
                    Dein Kampfprofil ist noch leer.
                  </p>
                  <p
                    className="mx-auto mt-1 max-w-md text-xs"
                    style={{ color: "var(--fg-4)" }}
                  >
                    {isTrainer
                      ? "Starte eine Video-Analyse zu dir selbst und übernimm die Befunde — dein Profil wächst mit jedem Video."
                      : "Dein Trainer baut dein Kampfprofil Schritt für Schritt aus Video-Analysen und eigenen Beobachtungen auf — sobald erste Befunde übernommen sind, erscheinen sie hier."}
                  </p>
                </div>
              ) : fightProfile ? (
                <FightProfileView
                  dna={fightProfile.dna}
                  dnaSplit={fightProfile.dnaSplit}
                  actionStats={fightProfile.actionStats}
                />
              ) : null}
            </div>
          </section>

          {/* Freigegebene eigene Auswertungen */}
          {sharedAnalyses.length > 0 && (
            <section>
              <SectionHeader
                title="Deine Auswertungen"
                subtitle="Vom Trainer freigegebene Analysen deiner Kampf-Videos"
              />
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
                            style={{ color: "var(--ta-violet)", flexShrink: 0 }}
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
                              {formatDate(a.createdAt)} · Auswertung deines Kampfs
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
              <SectionHeader
                title="Gegnerprofile"
                subtitle="Vom Trainer für deine Vorbereitung freigegeben"
              />
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
                        style={{ letterSpacing: "0.14em", color: "#9D7BFA" }}
                      >
                        {FIGHT_STYLE_LABEL[o.style]}
                      </div>
                      <div
                        className="font-mono-ta mt-2 flex items-center gap-1.5 text-[10px]"
                        style={{ letterSpacing: "0.12em", color: "var(--fg-4)" }}
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

          {/* Athleten-Daten (editierbar) */}
          <section>
            <SectionHeader
              title="Athleten-Daten"
              subtitle="Basics, Körperdaten, Gym & Coach, nächster Wettkampf"
            />
            <div className="mt-4 max-w-2xl">
              <AthleteProfileForm />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default function KampfprofilPage() {
  return (
    <ProtectedRoute>
      <KampfprofilContent />
    </ProtectedRoute>
  );
}
