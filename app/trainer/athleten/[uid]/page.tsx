"use client";

import { Collapse } from "@/components/motion";
import PageHead from "@/components/shell/PageHead";
import TrainerHint from "@/components/TrainerHint";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import AreaCoverageChart from "@/components/trainer/AreaCoverageChart";
import CompetitionCard, {
  competitionGroup,
} from "@/components/trainer/CompetitionCard";
import MatchupBlock from "@/components/trainer/MatchupBlock";
import DeepFightWordmark from "@/components/DeepFightWordmark";
import Icon from "@/components/ui/Icon";
import {
  getMemberEntry,
  getStudentEntry,
  isPermissionDenied,
  type StudentEntry,
} from "@/lib/admin";
import { getRecentWorkouts, type WorkoutSession } from "@/lib/workouts";
import { listVideoAnalyses, type VideoAnalysis } from "@/lib/video-analysis";
import { getAllProgress } from "@/lib/extensions/technique-progress";
import {
  getStudentProgress,
  type StudentProgress,
} from "@/lib/student-progress";
import {
  analyzeTrainingHistory,
  type TrainingHistoryAnalysis,
} from "@/lib/fight-camp-analysis";
import {
  ATHLETE_LEVEL_LABEL,
  BJJ_BELT_LABEL,
  DISCIPLINE_LABEL,
  TRAINING_AREA_LABEL,
  WEIGHT_CLASS_LABEL,
  type TechniqueProgress,
} from "@/lib/types";
import {
  campOpponentId,
  listFightCamps,
  type FightCamp,
} from "@/lib/fight-camp";
import { loadOpponentsByIds, type Opponent } from "@/lib/opponents";
import { CATEGORY_COLOR, DISCIPLINE_COLOR } from "@/lib/discipline-colors";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const CATEGORY_LABEL: Record<string, string> = {
  boxing: "Boxing",
  wrestling: "Wrestling",
  bjj: "BJJ",
  "muay-thai": "Muay Thai",
};

// ─── Gemeinsame Schnitte (wie auf /trainer, /verwaltung, /admin) ────────────

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const META_BASE: React.CSSProperties = {
  fontFamily: "var(--font-archivo), system-ui, sans-serif",
  fontWeight: 600,
  lineHeight: 1.3,
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function initialsOf(entry: StudentEntry): string {
  const name =
    entry.displayName ?? entry.authProviderName ?? entry.email ?? "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** „Heute aktiv", „Vor 3 Wochen aktiv" — der Blick auf die letzte Regung. */
function dateAgo(d: Date | null): string {
  if (!d) return "Bisher keine Regung in der App";
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Heute aktiv";
  if (days === 1) return "Gestern aktiv";
  if (days < 7) return `Vor ${days} Tagen aktiv`;
  if (days < 30)
    return `Vor ${Math.floor(days / 7)} Woche${Math.floor(days / 7) === 1 ? "" : "n"} aktiv`;
  return `Vor ${Math.floor(days / 30)} Monat${Math.floor(days / 30) === 1 ? "" : "en"} aktiv`;
}

function displayLabel(entry: StudentEntry): string {
  return (
    entry.displayName ?? entry.authProviderName ?? entry.email ?? entry.uid
  );
}

/**
 * Kennzahl-Kachel.
 *
 * DER `accent`-PROP IST WEG (Rollout 03.09.2026): Die vier Kacheln trugen
 * vier verschiedene Farben — Cyan, Pink, ein hartkodiertes Violett —, ohne
 * dass die Farbe etwas BEDEUTETE. „∅ pro Woche" war nicht pinker als
 * „Workouts". Vier gleichrangige Zahlen bekommen einen Ton; wo eine Farbe
 * etwas aussagt (Disziplin-Verteilung, Stärken/Schwächen), steht sie weiter,
 * dann aber aus der Registry oder aus den Semantik-Tokens.
 */
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5 text-center">
      <span
        style={{
          font: "var(--type-num-xl)",
          fontSize: "22px",
          fontVariantNumeric: "tabular-nums",
          color: "var(--accent-text)",
        }}
      >
        {value}
      </span>
      <span
        className="text-[10px] sm:text-[11px]"
        style={{ ...META_BASE, color: "var(--text-label)" }}
      >
        {label}
      </span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <dt
        className="text-[11px]"
        style={{ ...META_BASE, color: "var(--text-label)" }}
      >
        {label}
      </dt>
      <dd
        className="truncate text-right"
        style={{ font: "var(--type-body-strong)", fontSize: "13px" }}
      >
        {value}
      </dd>
    </div>
  );
}

/** Zwischenüberschrift innerhalb einer Spalte. */
function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        font: "var(--type-h2)",
        letterSpacing: "var(--ls-display)",
        textTransform: "uppercase",
      }}
    >
      {children}
    </h2>
  );
}

function StudentDetailContent({ uid }: { uid: string }) {
  const [entry, setEntry] = useState<StudentEntry | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutSession[] | null>(null);
  const [progress, setProgress] = useState<TechniqueProgress[] | null>(null);
  const [camps, setCamps] = useState<FightCamp[] | null>(null);
  // Verknüpfte DeepFight-Profile der Wettkämpfe — zeigt den aktuellen
  // Scouting-Stand statt nur den eingefrorenen Snapshot.
  const [opponents, setOpponents] = useState<Map<string, Opponent>>(new Map());
  const [analyses, setAnalyses] = useState<VideoAnalysis[] | null>(null);
  // App-Nutzung (Bibliothek, Kurs-Abos, Rückmeldungen, letzte Aktivität).
  // Diese vier Zahlen standen bis zum 03.09.2026 im Aufklapp-Panel der
  // Athletenliste. Mit der Umstellung auf eine reine Namensliste (Leons
  // Vorgabe) hätten sie ersatzlos gefehlt — sie kommen aus einer anderen
  // Quelle als die Trainings-Analyse darüber und stehen nirgends sonst.
  const [usage, setUsage] = useState<StudentProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Der Kollege hat sein Persönliches nicht für uns freigegeben — kein
  // Fehler, eine Entscheidung (Leon 03.09.2026: Trainer sind standardmäßig
  // privat). Name kommt trotzdem an: das users-Dokument bleibt lesbar.
  const [gesperrtFuer, setGesperrtFuer] = useState<string | null>(null);
  // Kampfbereiche sind standardmäßig zugeklappt — der Kopf der Seite bleibt
  // dadurch überschaubar, die Details holt man sich bei Bedarf.
  const [areasOpen, setAreasOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setEntry(null);
    setWorkouts(null);
    setProgress(null);
    setCamps(null);
    setAnalyses(null);
    setUsage(null);
    setGesperrtFuer(null);
    setOpponents(new Map());
    try {
      // Das users-Dokument zuerst und allein: Es ist immer lesbar und liefert
      // den Namen — den brauchen wir auch dann, wenn alles Weitere gesperrt
      // ist. Der Profil-Read in getStudentEntry ist der erste, an dem das
      // Gate greifen kann.
      let e: StudentEntry | null;
      try {
        e = await getStudentEntry(uid);
      } catch (err) {
        if (!isPermissionDenied(err)) throw err;
        // Profil gesperrt → Name aus der Identität holen und aufhören.
        const nurName = await getMemberEntry(uid).catch(() => null);
        setGesperrtFuer(nurName ? displayLabel(nurName) : "Dieser Trainer");
        return;
      }
      if (!e) throw new Error("Athlet nicht gefunden");
      const [w, p, c, a] = await Promise.all([
        getRecentWorkouts(uid, 500),
        getAllProgress(uid).catch(() => [] as TechniqueProgress[]),
        listFightCamps(uid).catch(() => [] as FightCamp[]),
        listVideoAnalyses("athlete", uid).catch(() => [] as VideoAnalysis[]),
      ]);
      setEntry(e);
      setWorkouts(w);
      setProgress(p);
      setCamps(c);
      setAnalyses(a);
      setOpponents(await loadOpponentsByIds(c.map(campOpponentId)));

      // Nachgelagert und ohne `await` im kritischen Pfad: Vier Zählabfragen
      // auf Unter-Sammlungen. Der Kopf der Seite soll darauf nicht warten.
      getStudentProgress(uid)
        .then(setUsage)
        .catch(() => setUsage(null));
    } catch (err) {
      if (isPermissionDenied(err)) {
        setGesperrtFuer("Dieser Trainer");
        return;
      }
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    }
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  // Alt-Links mit #deepfight scrollen weiterhin zur DeepFight-Verlinkung,
  // sobald die Seite fertig geladen ist.
  useEffect(() => {
    if (!entry) return;
    if (window.location.hash === "#deepfight") {
      document
        .getElementById("deepfight")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [entry]);

  const analysis = useMemo<TrainingHistoryAnalysis | null>(() => {
    if (workouts === null || progress === null) return null;
    return analyzeTrainingHistory(workouts, progress);
  }, [workouts, progress]);

  // Nächster anstehender Wettkampf — Basis für den Matchup-Block.
  const nextCamp = useMemo(() => {
    const upcoming = (camps ?? []).filter(
      (c) => competitionGroup(c) === "upcoming",
    );
    upcoming.sort(
      (a, b) => a.competitionDate.getTime() - b.competitionDate.getTime(),
    );
    return upcoming[0] ?? null;
  }, [camps]);

  if (gesperrtFuer) {
    return (
      <main
        className="min-h-screen pb-12"
        style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
      >
        <PageHead
          lane="wide"
          back={{ href: "/trainer/athleten", label: "Athletenliste" }}
          title={gesperrtFuer}
          description="Ein Trainer entscheidet selbst, wer sein Athletenprofil sieht."
        />
        <div className="mx-auto w-full max-w-7xl px-4 pt-1 sm:px-6">
          <div className="t-card flex flex-col gap-2 p-6">
            <span className="t-label">Noch nicht freigegeben</span>
            <p style={{ font: "var(--type-body-strong)" }}>
              {gesperrtFuer} hat das eigene Athletenprofil noch nicht für dich
              freigegeben.
            </p>
            <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              Sobald du freigeschaltet bist, öffnet sich diese Seite wie jede
              andere — mit Profil, Fortschritt und Wettkämpfen.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (error && !entry) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <ErrorState
          title="Athlet konnte nicht geladen werden"
          message={error}
          onRetry={load}
        />
      </div>
    );
  }

  if (!entry || !analysis) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-32 w-full rounded-card" />
          <Skeleton className="h-64 w-full rounded-card" />
          <Skeleton className="h-96 w-full rounded-card" />
        </div>
      </div>
    );
  }

  const athlete = entry.athlete;
  const competitionPersona =
    athlete?.nextCompetitionDate &&
    athlete.nextCompetitionDate.getTime() > Date.now();

  // Hat dieser Athlet überhaupt ein gepflegtes Profil? Ohne diese Prüfung
  // rendert die <dl> schlicht NICHTS und die linke Spalte bleibt als Loch
  // neben der Trainings-Analyse stehen (im Bild aufgefallen, 03.09.2026).
  const hasProfile = Boolean(
    athlete &&
      (athlete.primaryDiscipline ||
        athlete.level ||
        athlete.bjjBelt ||
        athlete.weightClass ||
        athlete.weightKg != null ||
        athlete.heightCm != null ||
        athlete.gymName ||
        athlete.trainerName ||
        athlete.trainingStartDate ||
        athlete.nextCompetitionDate),
  );

  // „LEVEL · DISZIPLIN · GEWICHTSKLASSE" — die Teile, die gepflegt sind.
  const athleteMeta = [
    athlete?.level ? ATHLETE_LEVEL_LABEL[athlete.level] : null,
    athlete?.primaryDiscipline
      ? DISCIPLINE_LABEL[athlete.primaryDiscipline]
      : null,
    athlete?.weightClass ? WEIGHT_CLASS_LABEL[athlete.weightClass] : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  return (
    <main
      className="min-h-screen pb-12"
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      <PageHead
        lane="wide"
        back={{ href: "/trainer/athleten", label: "Athletenliste" }}
        initials={initialsOf(entry)}
        title={displayLabel(entry)}
        description={`${entry.email ?? "—"} · Seit ${formatDate(entry.createdAt)}`}
      >
        {/* `items-start` ist Pflicht: In einer Flex-SPALTE dehnt sich ein
            Kind sonst auf die volle Breite — der DeepFight-Einstieg lief
            dadurch als Balken über den ganzen Kopf. */}
        <div className="flex flex-col items-start gap-2">
          {/* DeepFight-Einstieg für diesen Athleten — die Analyse selbst lebt
              unter /trainer/deepfight/athletes/[uid]. Violett ist hier
              richtig und bleibt: --accent-2 ist die BRAND-Konstante von
              DeepFight und folgt bewusst KEINEM Gym-Akzent (Token-Kommentar
              in globals.css). Vorher stand dasselbe Violett dreimal als
              hartkodierter Hex-Wert in dieser Zeile. */}
          <Link data-press
            id="deepfight"
            href={`/trainer/deepfight/athletes/${uid}`}
            className="t-interactive inline-flex scroll-mt-24 items-center gap-2 rounded-field px-3 py-2"
            style={{
              background: "var(--accent-2-subtle)",
              border:
                "1px solid color-mix(in oklab, var(--accent-2) 45%, transparent)",
              textDecoration: "none",
            }}
          >
            <span style={{ color: "var(--accent-2)", lineHeight: 0 }}>
              <Icon name="video" size={14} strokeWidth={2.2} />
            </span>
            <span style={{ font: "var(--type-body-strong)", fontSize: "14px" }}>
              <DeepFightWordmark />
            </span>
            <span
              className="text-[11px]"
              style={{ ...META_BASE, color: "var(--text-3)" }}
            >
              {analyses === null
                ? "Öffnen"
                : analyses.length === 0
                  ? "Analyse starten"
                  : `${analyses.length} ${analyses.length === 1 ? "Auswertung" : "Auswertungen"} · ${analyses.filter((a) => a.sharedWithAthlete).length} frei`}
            </span>
            <span style={{ color: "var(--accent-2)", lineHeight: 0 }}>
              <Icon name="arrow-right" size={13} strokeWidth={2.2} />
            </span>
          </Link>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {/* „LEVEL · DISZIPLIN · GEWICHTSKLASSE" als EINE Textzeile mit
                Disziplin-Punkt — dasselbe Muster wie die Athletenliste und
                die Kurszeile im Kursplan. Vorher waren es drei Badges, davon
                eines in Cyan (dem Gym-Akzent, der über eine Disziplin nichts
                aussagt) und eines für das Level, das laut Festlegung NIE
                farbcodiert wird. */}
            {athleteMeta && (
              <span
                className="flex items-center gap-1.5 text-[12px]"
                style={{ ...META_BASE, color: "var(--text-3)" }}
              >
                {athlete?.primaryDiscipline && (
                  <span
                    aria-hidden
                    className="h-[5px] w-[5px] shrink-0 rounded-full"
                    style={{
                      background: DISCIPLINE_COLOR[athlete.primaryDiscipline],
                    }}
                  />
                )}
                {athleteMeta}
              </span>
            )}
            {/* „Wettkampf geplant" BLEIBT ein Badge: Das ist ein Zustand, der
                gerade gilt, keine Rubrik — und es ist die einzige Angabe hier,
                die zum Handeln auffordert. */}
            {competitionPersona && (
              <span
                className="rounded-badge px-2 py-1 text-[11px]"
                style={{
                  ...META_BASE,
                  background: "var(--accent-subtle)",
                  border:
                    "1px solid color-mix(in oklab, var(--accent) 45%, transparent)",
                  color: "var(--accent-text)",
                }}
              >
                Wettkampf geplant
              </span>
            )}
          </div>
        </div>
      </PageHead>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <TrainerHint id="student-detail" title="Athleten-Detail">
          Hier siehst du das volle Athleten-Profil und die Trainings-Analyse aus
          der App-Historie. Wettkämpfe inkl. DeepFight-Profil werden zentral im
          Wettkampfbereich verwaltet — unten kannst du direkt einen neuen
          Wettkampf für diesen Athleten anlegen.
        </TrainerHint>

        {/* KPI-Kacheln */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Workouts" value={analysis.totalWorkouts} />
          <Stat
            label="Trainingszeit"
            value={`${analysis.totalTrainingHours}h`}
          />
          <Stat label="∅ pro Woche" value={analysis.workoutsPerWeek} />
          <Stat label="Wochen aktiv" value={analysis.weeksTracked} />
        </div>

        {/* Layout: Profil + Analyse nebeneinander */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Profil */}
          <div>
            <SectionHead>Athleten-Profil</SectionHead>
            {hasProfile ? (
              <dl className="mt-3 flex flex-col gap-1.5">
                {athlete?.primaryDiscipline && (
                  <Row
                    label="Disziplin"
                    value={DISCIPLINE_LABEL[athlete.primaryDiscipline]}
                  />
                )}
                {athlete?.level && (
                  <Row
                    label="Level"
                    value={ATHLETE_LEVEL_LABEL[athlete.level]}
                  />
                )}
                {athlete?.bjjBelt && (
                  <Row
                    label="BJJ-Gurt"
                    value={BJJ_BELT_LABEL[athlete.bjjBelt]}
                  />
                )}
                {athlete?.weightClass && (
                  <Row
                    label="Gewichtsklasse"
                    value={WEIGHT_CLASS_LABEL[athlete.weightClass]}
                  />
                )}
                {athlete?.weightKg != null && (
                  <Row label="Gewicht" value={`${athlete.weightKg} kg`} />
                )}
                {athlete?.heightCm != null && (
                  <Row label="Größe" value={`${athlete.heightCm} cm`} />
                )}
                {athlete?.gymName && <Row label="Gym" value={athlete.gymName} />}
                {athlete?.trainerName && (
                  <Row label="Coach" value={athlete.trainerName} />
                )}
                {athlete?.trainingStartDate && (
                  <Row
                    label="Trainiert seit"
                    value={formatDate(athlete.trainingStartDate)}
                  />
                )}
                {athlete?.nextCompetitionDate && (
                  <Row
                    label="Nächster Wettkampf"
                    value={`${formatDate(athlete.nextCompetitionDate)}${athlete.nextCompetitionName ? ` — ${athlete.nextCompetitionName}` : ""}`}
                  />
                )}
              </dl>
            ) : (
              <p
                className="mt-3"
                style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
              >
                Sobald dieser Athlet sein Profil ausfüllt, stehen hier
                Disziplin, Level, Gewichtsklasse und der nächste Wettkampf.
              </p>
            )}

            {/* Technique progress aggregate */}
            <div className="mt-4">
              <div className="t-label mb-2">Technik-Fortschritt</div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Gemeistert" value={analysis.technique.mastered} />
                <Stat label="Geübt" value={analysis.technique.practiced} />
                <Stat label="Gelernt" value={analysis.technique.learned} />
                <Stat label="Gesamt" value={analysis.technique.total} />
              </div>
            </div>

            <div className="mt-4">
              <div className="t-label mb-2">App-Nutzung</div>
              {usage === null ? (
                <Skeleton className="h-16 w-full rounded-card" />
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <Stat label="Bibliothek" value={usage.libraryCount ?? "—"} />
                    <Stat
                      label="Kurs-Abos"
                      value={usage.subscriptionCount ?? "—"}
                    />
                    {/* „Rückmeldungen", nicht „Teilnahmen": participations
                        entstehen durch einen Tipp auf „Teilnehmen" im
                        Kursplan — Selbstauskunft, keine Anwesenheitskontrolle
                        (lib/gym-stats.ts, Kopfkommentar). */}
                    <Stat
                      label="Rückmeldungen"
                      value={usage.participationCount ?? "—"}
                    />
                  </div>
                  <p
                    className="mt-2"
                    style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                  >
                    {dateAgo(
                      usage.lastWorkoutAt ?? usage.lastParticipationAt ?? null,
                    )}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Category-Verteilung + Stärken/Schwächen */}
          <div className="lg:col-span-2">
            <SectionHead>Trainings-Analyse</SectionHead>

            {/* Category Distribution */}
            <div className="mt-3">
              <div className="t-label mb-2">Verteilung nach Disziplin</div>
              <div className="flex flex-col gap-1">
                {analysis.categoryDistribution.map((c) => (
                  <div key={c.category} className="flex items-center gap-2">
                    <div
                      className="w-24 text-[11px]"
                      style={{ ...META_BASE, color: "var(--text-2)" }}
                    >
                      {CATEGORY_LABEL[c.category]}
                    </div>
                    <div
                      className="flex-1 overflow-hidden rounded-pill"
                      style={{
                        height: "8px",
                        background: "var(--surface-raised)",
                        border: "1px solid var(--line)",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.round(c.shareOfTotal * 100)}%`,
                          // Disziplin-Farbe wie überall in der App (zentrale
                          // Registry). Der Rückfall ist ein NEUTRAL, kein
                          // Akzent: Eine unbekannte Disziplin darf nicht wie
                          // die Gym-Farbe aussehen.
                          background:
                            (CATEGORY_COLOR as Record<string, string>)[
                              c.category
                            ] ?? "var(--text-3)",
                        }}
                      />
                    </div>
                    <div
                      className="w-16 text-right"
                      style={{
                        font: "var(--type-num)",
                        fontVariantNumeric: "tabular-nums",
                        color: "var(--text-3)",
                      }}
                    >
                      {c.workoutCount} · {Math.round(c.shareOfTotal * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Area coverage — zugeklappt, bis der Trainer sie aufruft */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setAreasOpen((o) => !o)}
                aria-expanded={areasOpen}
                data-press="quiet"
                className="t-interactive flex min-h-hit w-full items-center gap-2 rounded-field px-2 text-left"
              >
                <span className="t-label">Kampfbereiche · Abdeckung</span>
                <span
                  className="text-[11px]"
                  style={{ ...META_BASE, color: "var(--text-3)" }}
                >
                  {analysis.areaScores.length} Bereiche
                </span>
                <span
                  aria-hidden
                  className="ml-auto"
                  style={{
                    color: "var(--text-3)",
                    transform: areasOpen ? "rotate(90deg)" : "none",
                    transition: "transform var(--dur-fast) var(--ease-out)",
                    lineHeight: 0,
                  }}
                >
                  <Icon name="arrow-right" size={14} strokeWidth={2.2} />
                </span>
              </button>
              <Collapse open={areasOpen}>
                <div className="mt-2">
                  <AreaCoverageChart scores={analysis.areaScores} highlightWeak />
                </div>
              </Collapse>
            </div>

            {/* Strong / Weak summary */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {/* Die beiden Kästen tragen jetzt die SEMANTIK-Tokens
                  (--positive / --warning) statt Cyan und Pink. Das ist der
                  Unterschied zwischen Dekoration und Aussage: Cyan war der
                  Gym-Akzent — bei einem Gym mit grüner Marke hätten Stärken
                  und Schwächen dieselbe Farbe getragen. Grün und Bernstein
                  sind feste Hues und meinen etwas.
                  KEIN Alarm-Rot für die zweite Karte: Lücken im Training
                  sind ein Hinweis, kein Fehler. */}
              <div
                className="rounded-card p-3"
                style={{
                  background:
                    "color-mix(in oklab, var(--positive) 10%, transparent)",
                  border:
                    "1px solid color-mix(in oklab, var(--positive) 40%, transparent)",
                }}
              >
                <div
                  className="t-label"
                  style={{ color: "var(--positive)" }}
                >
                  Stärken
                </div>
                <ul className="mt-2 flex flex-col gap-1">
                  {analysis.strongAreas.length === 0 && (
                    <li
                      style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                    >
                      Trainiere ein paar Einheiten mehr, dann zeigen sich hier
                      die Schwerpunkte.
                    </li>
                  )}
                  {analysis.strongAreas.map((s) => (
                    <li
                      key={s.area}
                      style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
                    >
                      • {TRAINING_AREA_LABEL[s.area]}{" "}
                      <span style={{ color: "var(--text-3)" }}>
                        ({s.workoutCount} Workouts)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div
                className="rounded-card p-3"
                style={{
                  background:
                    "color-mix(in oklab, var(--warning) 10%, transparent)",
                  border:
                    "1px solid color-mix(in oklab, var(--warning) 40%, transparent)",
                }}
              >
                <div className="t-label" style={{ color: "var(--warning)" }}>
                  Vernachlässigte Bereiche
                </div>
                <ul className="mt-2 flex flex-col gap-1">
                  {analysis.weakAreas.map((s) => (
                    <li
                      key={s.area}
                      style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
                    >
                      • {TRAINING_AREA_LABEL[s.area]}{" "}
                      <span style={{ color: "var(--text-3)" }}>
                        ({s.workoutCount} Workouts)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Wettkämpfe — zentral im Wettkampfbereich verwaltet */}
        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <SectionHead>Wettkämpfe</SectionHead>
              <p
                className="mt-1"
                style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
              >
                Du verwaltest sie zentral im Wettkampfbereich — DeepFight
                inklusive.
              </p>
            </div>
            <Link data-press
              href={`/trainer/competitions/new?student=${uid}`}
              className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-5"
              style={{
                ...BTN_FONT,
                background: "var(--accent)",
                color: "var(--on-accent)",
                boxShadow: "var(--accent-glow)",
                textDecoration: "none",
              }}
            >
              <Icon name="plus" size={14} strokeWidth={2.4} />
              Neuer Wettkampf
            </Link>
          </div>

          {/* Matchup: Athlet vs. Gegner-DNA des nächsten Wettkampfs */}
          {nextCamp && (
            <div className="mt-4">
              <MatchupBlock
                athleteName={displayLabel(entry)}
                athlete={athlete}
                camp={nextCamp}
                opponent={opponents.get(campOpponentId(nextCamp) ?? "")}
              />
            </div>
          )}

          <div className="mt-4">
            {camps === null ? (
              <Skeleton className="h-24 w-full rounded-card" />
            ) : camps.length === 0 ? (
              <div
                className="t-card p-10 text-center"
                style={{ borderStyle: "dashed", borderColor: "var(--line)" }}
              >
                <p style={{ font: "var(--type-body-strong)" }}>
                  Hier steht der erste Wettkampf dieses Athleten.
                </p>
                <p
                  className="mt-1"
                  style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                >
                  Leg einen an und wähl den Gegner aus der
                  DeepFight-Bibliothek — oder scoute ein neues Gegnerprofil.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {camps.map((c) => (
                  <CompetitionCard
                    key={c.id}
                    camp={c}
                    studentLabel={displayLabel(entry)}
                    href={`/trainer/competitions/${uid}/${c.id}`}
                    opponent={opponents.get(campOpponentId(c) ?? "")}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function StudentDetailPage({
  params,
}: {
  params: { uid: string };
}) {
  return <StudentDetailContent uid={params.uid} />;
}
