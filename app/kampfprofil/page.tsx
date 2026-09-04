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
 *
 * DeepFight-Kontext: Ambient-Schicht läuft über --ambient-fight, DeepFight-
 * Akzente über --accent-2/--grad-fight (exklusiv diesen Elementen).
 */

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import DeepFightWordmark from "@/components/DeepFightWordmark";
import AthleteProfileForm from "@/components/AthleteProfileForm";
import ProfileShareButton from "@/components/ProfileShareButton";
import AthleteTabBar from "@/components/AthleteTabBar";
import FightDnaHelix from "@/components/deepfight/FightDnaHelix";
import FightProfileView from "@/components/trainer/FightProfileView";
import VideoAnalysisResult from "@/components/trainer/VideoAnalysisResult";
import Skeleton from "@/components/ui/Skeleton";
import Icon from "@/components/ui/Icon";
import {
  useAuth,
  useFighterName,
  useHasStaffShell,
  useRights,
} from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import {
  getFightProfile,
  isFightProfileEmpty,
  type FightProfile,
} from "@/lib/fight-profile";
import { listOpponentsSharedWith, type Opponent } from "@/lib/opponents";
import { listVideoAnalyses, type VideoAnalysis } from "@/lib/video-analysis";
import { DISCIPLINE_LABEL, WEIGHT_CLASS_LABEL } from "@/lib/types";
import { FIGHT_STYLE_LABEL } from "@/lib/fight-camp";
import { dnaCompleteness, totalAnswered } from "@/lib/gegner-dna";

function formatDate(d: Date): string {
  return d.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Versalien-Button-Typo (Muster der Referenzseite)
const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

function SectionHeader({
  title,
  subtitle,
  brandCase,
}: {
  title: React.ReactNode;
  subtitle: string;
  /** true = keine Versalien (DeepFight-Wordmark bleibt unangetastet) */
  brandCase?: boolean;
}) {
  return (
    // Kein Gap Titel↔Untertitel (Leon 2026-08-27) — Durchschuss reicht.
    <div className="flex flex-col">
      <h2
        style={{
          font: "var(--type-h2)",
          letterSpacing: brandCase ? undefined : "var(--ls-display)",
          textTransform: brandCase ? undefined : "uppercase",
        }}
      >
        {title}
      </h2>
      <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>{subtitle}</p>
    </div>
  );
}

/** Kleine Info-Chips im Seitenkopf (nicht interaktiv). tone="fight" =
 * KI-Hervorhebung mit laufendem Regenbogen-Rand (.t-ai-badge). */
function HeaderChip({
  tone,
  children,
}: {
  tone: "accent" | "fight" | "neutral";
  children: React.ReactNode;
}) {
  const style: React.CSSProperties = {
    font: "var(--type-label)",
    letterSpacing: "var(--ls-label)",
    textTransform: "uppercase",
  };
  let aiClass = "";
  if (tone === "accent") {
    style.background = "var(--accent-subtle)";
    style.color = "var(--accent-text)";
  } else if (tone === "fight") {
    aiClass = " t-ai-badge";
    style.color = "var(--ai-text)";
  } else {
    style.background = "var(--surface-raised)";
    style.border = "1px solid var(--line)";
    style.color = "var(--text-2)";
  }
  return (
    <span className={`rounded-badge px-2 py-1${aiClass}`} style={style}>
      {children}
    </span>
  );
}

function KampfprofilContent() {
  const { user, profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const fighterName = useFighterName();
  // ZWEI VERSCHIEDENE FRAGEN, die bis zum 01.09.2026 zufällig dieselbe
  // Antwort hatten: „darf diese Person eine eigene Video-Analyse starten"
  // (Trainer-Werkzeug, /trainer/deepfight/me) und „steht um diese Seite die
  // Stab-Hülle" (dann kommen Menü, Bottom-Bar und Hell/Dunkel von dort).
  // Für eine reine Verwaltung fallen sie auseinander.
  const isTrainer = useRights().trainer;
  const hasStaffShell = useHasStaffShell();

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
  const dnaPct = fightProfile ? dnaCompleteness(fightProfile.dna) : 0;
  const athlete = profile?.athlete;

  return (
    <main
      className={hasStaffShell ? "min-h-screen pb-12" : "min-h-screen pb-32"}
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      {/* Kopfbereich mit Ambient-Schicht — DeepFight-Kontext, daher
          --ambient-fight. Der Clip-Container umschließt NUR die Ambient-Ebene,
          nie die ganze Sektion (Muster der Referenzseite). */}
      <section className="relative">
        <div className="absolute inset-0 overflow-hidden" aria-hidden>
          <div data-ambient style={{ background: "var(--ambient-fight)" }} />
        </div>
        <div className="relative mx-auto flex w-full max-w-2xl items-start gap-3 px-4 pb-5 pt-6 lg:max-w-5xl lg:px-6 lg:pb-7 lg:pt-8">
          <div className="flex flex-1 flex-col gap-1">
            <span className="t-label">Kampfprofil</span>
            <h1
              style={{
                font: "var(--type-display)",
                letterSpacing: "var(--ls-display)",
                textTransform: "uppercase",
              }}
            >
              {fighterName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {athlete?.primaryDiscipline && (
                <HeaderChip tone="accent">
                  {DISCIPLINE_LABEL[athlete.primaryDiscipline]}
                </HeaderChip>
              )}
              {athlete?.weightClass && (
                <HeaderChip tone="neutral">
                  {WEIGHT_CLASS_LABEL[athlete.weightClass]}
                </HeaderChip>
              )}
              {dnaEntries > 0 && (
                <HeaderChip tone="fight">DNA {dnaPct} %</HeaderChip>
              )}
            </div>
            {/* Sichtbarkeit — wer aus dem Team mich sehen darf. Sitzt seit
                dem 04.09.2026 hier ÜBER „Meine Analyse starten" statt als
                eigene Karte weiter unten (Leons Festlegung): beides sind
                Handlungen am eigenen Profil und gehören zusammen. Der Knopf
                blendet sich bei Athleten aus (Begründung in der Komponente),
                deshalb steht er AUSSERHALB der isTrainer-Bedingung — eine
                reine Verwaltung ist ebenfalls ein Stab-Konto und damit
                privat, startet aber keine Analyse. */}
            <div className="mt-4 flex flex-col items-start gap-2">
              <ProfileShareButton />
              {isTrainer && user && (
                <Link
                  href="/trainer/deepfight/me"
                  className="t-interactive inline-flex min-h-hit items-center justify-center gap-2 rounded-field px-5"
                  style={{
                    ...BTN_FONT,
                    background: "var(--grad-fight)",
                    color: "var(--on-accent)",
                    textDecoration: "none",
                  }}
                >
                  <Icon name="video" size={14} strokeWidth={2.4} />
                  Meine Analyse starten
                </Link>
              )}
            </div>
          </div>
          {/* Mobil: Theme-Umschalter im Seitenkopf (Desktop: in der Tab-Bar) */}
          {!hasStaffShell && (
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                theme === "dark" ? "Helles Design aktivieren" : "Dunkles Design aktivieren"
              }
              className="t-glass t-interactive inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-field lg:hidden"
              style={{ color: "var(--text-2)" }}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} size={20} />
            </button>
          )}
        </div>
      </section>

      <div className="mx-auto w-full max-w-2xl px-4 pt-1 lg:max-w-5xl lg:px-6">
        <div className="flex flex-col gap-8">
          {/* DeepFight-Profil */}
          <section className="flex flex-col gap-3">
            <SectionHeader
              title={<DeepFightWordmark />}
              subtitle="Dein Kampf-Stil aus KI-Video-Analysen und Trainer-Beobachtungen"
              brandCase
            />
            {/* Zweispaltigkeit gilt NUR für diese Sektion: Helix links, Karte
                rechts; mobil untereinander (Helix oben). items-start, weil die
                Karte ein Akkordeon mit wechselnder Höhe ist — die Helix darf
                nicht mitgestreckt werden. Die Helix lebt AUSSERHALB des
                profileEmpty-Ternärs: ein leeres Profil zeigt dank der
                Bauplan-Sprossen trotzdem etwas. */}
            <div className={fightProfile ? "grid gap-3 lg:grid-cols-2 lg:items-start lg:gap-6" : undefined}>
              {fightProfile && (
                <FightDnaHelix
                  profile={fightProfile}
                  variant="athlete"
                  size="lg"
                />
              )}
              {fightProfile === null && loading ? (
                <Skeleton className="h-40 w-full rounded-card" />
              ) : profileEmpty ? (
                <div
                  className="rounded-card p-6 text-center sm:p-8"
                  style={{
                    background: "var(--surface-card)",
                    border: "1px dashed var(--line-strong)",
                  }}
                >
                  <p style={{ font: "var(--type-body-strong)" }}>
                    Dein Kampfprofil ist noch leer.
                  </p>
                  <p
                    className="mx-auto mt-1 max-w-md"
                    style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
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
            <section className="flex flex-col gap-3">
              <SectionHeader
                title="Deine Auswertungen"
                subtitle="Vom Trainer freigegebene Analysen deiner Kampf-Videos"
              />
              {/* Liste = EINE Karte mit Haarlinien-Trennern (eigene 1px-Elemente) */}
              <div className="t-card px-3.5 py-0.5">
                {sharedAnalyses.map((a, i) => {
                  const open = expandedId === a.id;
                  return (
                    <Fragment key={a.id}>
                      {i > 0 && (
                        <div
                          aria-hidden
                          style={{ height: "1px", background: "var(--line)" }}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setExpandedId(open ? null : a.id)}
                        className="t-interactive flex min-h-hit w-full items-center gap-3 rounded-badge py-3 text-left"
                      >
                        <span style={{ color: "var(--accent-2)", flexShrink: 0 }}>
                          <Icon name="video" size={18} />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span
                            className="truncate"
                            style={{ font: "var(--type-body-strong)" }}
                          >
                            {a.sourceLabel}
                          </span>
                          <span style={{ ...META_FONT, color: "var(--text-3)" }}>
                            {formatDate(a.createdAt)} · Auswertung deines Kampfs
                          </span>
                        </span>
                        <span
                          className="shrink-0"
                          style={{
                            color: "var(--text-3)",
                            transform: open ? "rotate(180deg)" : "none",
                            transition: "transform var(--dur-fast) var(--ease-out)",
                            lineHeight: 0,
                          }}
                        >
                          <Icon name="chevron-down" size={16} strokeWidth={2.4} />
                        </span>
                      </button>
                      {open && (
                        <div className="pb-3">
                          <VideoAnalysisResult
                            analysis={a}
                            mode="athlete"
                            existingDna={null}
                          />
                        </div>
                      )}
                    </Fragment>
                  );
                })}
              </div>
            </section>
          )}

          {/* Freigegebene Gegnerprofile */}
          {sharedOpponents.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionHeader
                title="Gegnerprofile"
                subtitle="Vom Trainer für deine Vorbereitung freigegeben"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {sharedOpponents.map((o) => {
                  const pct = dnaCompleteness(o.dna);
                  return (
                    <Link
                      key={o.id}
                      href={`/deepfight/opponents/${o.id}`}
                      className="t-card t-interactive flex flex-col gap-1.5 p-4"
                      style={{ textDecoration: "none" }}
                    >
                      <span
                        className="truncate"
                        style={{
                          font: "var(--type-h3)",
                          letterSpacing: "var(--ls-display)",
                          textTransform: "uppercase",
                        }}
                      >
                        {o.name}
                      </span>
                      <span style={{ ...META_FONT, color: "var(--accent-2)" }}>
                        {FIGHT_STYLE_LABEL[o.style]}
                      </span>
                      <span
                        className="inline-flex items-center gap-1.5"
                        style={{ ...META_FONT, color: "var(--text-3)" }}
                      >
                        <Icon name="shield" size={12} />
                        DNA {pct} %
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Athleten-Daten (editierbar) */}
          <section className="flex flex-col gap-3">
            <SectionHeader
              title="Athleten-Daten"
              subtitle="Basics, Körperdaten, Gym & Coach"
            />
            <div className="t-card p-4 sm:p-6">
              <AthleteProfileForm />
            </div>
          </section>
        </div>
      </div>

      {!hasStaffShell && <AthleteTabBar />}
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
