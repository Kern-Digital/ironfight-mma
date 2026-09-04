"use client";

/**
 * Trainer-Übersicht — das Bereichs-Dashboard hinter dem klickbaren
 * Gruppentitel „Trainer" der Sidebar (Leons Vorgaben 01.09.2026 abends,
 * zweite Runde spät abends).
 *
 * AUFBAU (Leons Ansagen der zweiten Runde):
 * • Tagesabhängige Begrüßung mit Vornamen statt „ÜBERSICHT"; daneben die
 *   Glaskarte „Nächster Wettkampf" (bleibt, nur rundere Ecken).
 * • Kennzahlen als BENTO — verschieden große Kacheln statt drei gleicher
 *   Kästen (Leons Vorlage): links eine große INVERTIERTE Karte (Schüler),
 *   rechts Wachstum mit Balken-Sparkline, darunter zwei kleine Kacheln.
 * • Ein DeepFight-Hero, der das KI-Thema trägt („Wow + direkt loslegen",
 *   Leons Antwort auf die Rückfrage): Wordmark, Verlauf, Glow, zwei Wege
 *   direkt hinein. Die Listen „Nächste Wettkämpfe" und „Zuletzt im
 *   DeepFight" sind dafür raus.
 * • Zwei animierte Diagramme aus `lib/gym-stats.ts` — EINE Firestore-
 *   Abfrage, der Rest entsteht im Speicher.
 *
 * BESCHRIFTUNG IST HIER SICHERHEITSRELEVANT FÜR DIE AUSSAGE: participations
 * entstehen durch Tippen auf „Teilnehmen" im Kursplan — Selbstauskunft,
 * keine kontrollierte Anwesenheit. Im UI heißen sie IMMER „Rückmeldungen".
 * Eine Kachel „Anwesenheit" wäre eine Aussage über Knopfdrücke, nach der
 * Kurse beurteilt würden (lib/gym-stats.ts, Kopfkommentar).
 */

import DeepFightWordmark from "@/components/DeepFightWordmark";
import CourseLoadChart from "@/components/trainer/CourseLoadChart";
import WeeklyFeedbackChart from "@/components/trainer/WeeklyFeedbackChart";
import Icon from "@/components/ui/Icon";
import Skeleton from "@/components/ui/Skeleton";
import { isStaffEntry, listAllMembers, type StudentEntry } from "@/lib/admin";
import { werTeiltMitMir } from "@/lib/profile-sharing";
import { useAuth } from "@/lib/auth-context";
import {
  fightCampProgress,
  listAllFightCamps,
  type FightCamp,
} from "@/lib/fight-camp";
import { greetingFor } from "@/lib/greeting";
import { belongsToGym, resolveGymId } from "@/lib/gym";
import {
  courseLoad,
  getParticipationsSince,
  memberGrowth,
  weeklyCourse,
  weeklyCoverage,
  type ParticipationPoint,
} from "@/lib/gym-stats";
import { listOpponentsForGym, type Opponent } from "@/lib/opponents";
import { getWeekIdentifier } from "@/lib/schedule";
import { getSessionCountForWeek } from "@/lib/training-sessions";
import { competitionGroup } from "@/components/trainer/CompetitionCard";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

/** Zeitraum der Diagramme: die letzten zwölf Wochen inklusive der laufenden. */
const WEEKS = 12;

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

// Größe responsiv über Klassen (Leon 30.08.: am Desktop war 10px zu klein) —
// deshalb kein font-Shorthand, sondern Einzelwerte + META_SIZE.
const META_BASE: React.CSSProperties = {
  fontFamily: "var(--font-archivo), system-ui, sans-serif",
  fontWeight: 600,
  lineHeight: 1.3,
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};
const META_SIZE = "text-[10px] sm:text-[13px]";

function memberLabel(entry: StudentEntry | undefined): string {
  if (!entry) return "Athlet";
  return entry.displayName ?? entry.authProviderName ?? entry.email ?? "Athlet";
}

// ─── Bausteine ───────────────────────────────────────────────────────────────

/** Kennzahl-Kachel des Bento: Zahl groß, Label darüber, Einordnung darunter.
    Ohne `href` ist sie reine Anzeige — nicht jede Zahl braucht ein Ziel. */
function StatTile({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: string | number | null;
  sub: string;
  href?: string;
}) {
  const inner = (
    <>
      <span
        className={META_SIZE}
        style={{ ...META_BASE, color: "var(--text-label)" }}
      >
        {label}
      </span>
      {value === null ? (
        <Skeleton className="h-8 w-12" />
      ) : (
        <span style={{ font: "var(--type-num-xl)" }}>{value}</span>
      )}
      <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
        {sub}
      </span>
    </>
  );
  const style: React.CSSProperties = {
    borderRadius: "var(--r-xl)",
    textDecoration: "none",
    color: "inherit",
  };
  return href ? (
    <Link data-press="surface"
      href={href}
      className="t-card t-interactive flex flex-col gap-1 p-4"
      style={style}
    >
      {inner}
    </Link>
  ) : (
    <div className="t-card flex flex-col gap-1 p-4" style={style}>
      {inner}
    </div>
  );
}

/** Kopfzeile einer Sektion: Label links, optionaler Weg nach rechts. */
function SectionHead({
  label,
  moreHref,
  moreLabel,
}: {
  label: string;
  moreHref?: string;
  moreLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="t-label">{label}</span>
      {moreHref && (
        <Link data-press
          href={moreHref}
          className="t-interactive -mr-2 inline-flex min-h-hit items-center gap-1.5 rounded-field px-2"
          style={{
            ...BTN_FONT,
            color: "var(--text-3)",
            textDecoration: "none",
          }}
        >
          {moreLabel}
          <Icon name="arrow-right" size={14} strokeWidth={2.2} />
        </Link>
      )}
    </div>
  );
}

/**
 * Balken-Sparkline der Wachstums-Kachel (Leons Bento-Vorlage): ein Balken je
 * Monat, Höhe folgt den Beitritten. Kein eigenes Diagramm mit Achsen — die
 * Kachel trägt die Zahl, die Balken tragen nur die Form des Verlaufs.
 */
function GrowthSparkline({ values }: { values: number[] }) {
  const reduced = useReducedMotion();
  const max = Math.max(...values, 1);
  return (
    <div aria-hidden className="flex h-12 items-end gap-[3px]">
      {values.map((v, i) => {
        const h = 4 + (v / max) * 42;
        return (
          <motion.span
            key={i}
            className="w-1.5 rounded-full"
            style={{ background: "var(--accent)", opacity: v === 0 ? 0.3 : 1 }}
            initial={reduced ? false : { height: 4 }}
            animate={{ height: h }}
            transition={{
              duration: 0.5,
              delay: i * 0.05,
              ease: [0.2, 0.8, 0.2, 1],
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Seite ───────────────────────────────────────────────────────────────────

export default function TrainerDashboardPage() {
  const { user, profile } = useAuth();
  const gymId = resolveGymId(profile);
  const eigeneUid = user?.uid ?? "";

  const [camps, setCamps] = useState<FightCamp[] | null>(null);
  const [opponents, setOpponents] = useState<Opponent[] | null>(null);
  // Alle Mitglieder (inkl. Trainer) — Trainer können selbst Wettkämpfe haben,
  // daher müssen ihre Namen auflösbar sein. Die Schüler-Zahl zählt separat.
  const [members, setMembers] = useState<StudentEntry[] | null>(null);
  const [participations, setParticipations] = useState<
    ParticipationPoint[] | null
  >(null);
  const [sessionCount, setSessionCount] = useState<number | null>(null);
  // Getrennt vom allgemeinen Fehler: Schlagen NUR die Kennzahlen fehl
  // (z. B. ein noch bauender Index), sollen die Diagramme das sagen, statt
  // stumm eine Null-Kurve zu zeigen — eine falsche Null wäre eine Aussage.
  const [statsFailed, setStatsFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setCamps(null);
    setOpponents(null);
    setMembers(null);
    setParticipations(null);
    setSessionCount(null);
    setStatsFailed(false);

    // Stichtag: Montag der ältesten der zwölf Wochen — dieselbe
    // Montags-Rechnung wie in weeklyCourse, sonst fehlte der linken Woche
    // ihr Anfang.
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(
      since.getDate() - ((since.getDay() + 6) % 7) - (WEEKS - 1) * 7,
    );

    try {
      // Die Camps hängen an der Mitgliederliste: Sie trägt die Freigaben, und
      // ohne sie wüsste die Abfrage nicht, welche Kollegen-Camps sie einzeln
      // holen darf (lib/fight-camp.ts, listAllFightCamps). Alles Übrige läuft
      // unverändert nebenher.
      const memberP = listAllMembers(gymId).catch(() => [] as StudentEntry[]);
      const campP = memberP.then((liste) =>
        listAllFightCamps(gymId, {
          eigeneUid,
          freigegebeneUids: werTeiltMitMir(liste, "wettkampf", eigeneUid),
        }).catch(() => [] as FightCamp[]),
      );
      const [allCamps, gymOpponents, memberList, parts, sessions] =
        await Promise.all([
          campP,
          listOpponentsForGym(gymId).catch(() => [] as Opponent[]),
          memberP,
          getParticipationsSince(gymId, since).catch(() => null),
          getSessionCountForWeek(getWeekIdentifier()).catch(() => null),
        ]);
      setCamps(allCamps.filter((c) => belongsToGym(c.gymId, gymId)));
      setOpponents(gymOpponents);
      setMembers(memberList);
      setParticipations(parts ?? []);
      setStatsFailed(parts === null);
      setSessionCount(sessions ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setCamps([]);
      setOpponents([]);
      setMembers([]);
      setParticipations([]);
      setSessionCount(0);
    }
  }, [gymId, eigeneUid]);

  useEffect(() => {
    load();
  }, [load]);

  const memberMap = useMemo(
    () => new Map((members ?? []).map((s) => [s.uid, s])),
    [members],
  );
  const studentCount = useMemo(
    () => (members ?? []).filter((s) => !isStaffEntry(s)).length,
    [members],
  );

  const upcoming = useMemo(
    () =>
      (camps ?? [])
        .filter((c) => competitionGroup(c) === "upcoming")
        .sort(
          (a, b) => a.competitionDate.getTime() - b.competitionDate.getTime(),
        ),
    [camps],
  );

  const weekPoints = useMemo(
    () =>
      participations === null
        ? null
        : weeklyCourse(participations, WEEKS, new Date()),
    [participations],
  );
  const courses = useMemo(
    () => (participations === null ? null : courseLoad(participations)),
    [participations],
  );
  const coverage = sessionCount === null ? null : weeklyCoverage(sessionCount);

  // Wachstum: Beitritte je Monat aus der ohnehin geladenen Mitgliederliste
  // (memberGrowth rechnet bewusst auf der Liste statt selbst abzufragen).
  // Ohne Vergleichsbasis (alle kamen im Zeitraum) wäre ein Prozentwert
  // Unsinn — dann steht die absolute Zahl da.
  const growthInfo = useMemo(() => {
    if (members === null) return null;
    const monthsList = memberGrowth(members, 12, new Date());
    const joined = monthsList.reduce((s, m) => s + m.joined, 0);
    const totalNow = monthsList[monthsList.length - 1]?.total ?? 0;
    const base = totalNow - joined;
    return {
      headline: base > 0 ? `+${Math.round((joined / base) * 100)} %` : `+${joined}`,
      joined,
      bars: monthsList.map((m) => m.joined),
    };
  }, [members]);

  const loading = camps === null || opponents === null || members === null;
  const nextCamp = upcoming[0] ?? null;
  const nextInfo = nextCamp ? fightCampProgress(nextCamp) : null;
  const nextPct = nextInfo ? Math.round(nextInfo.ratio * 100) : 0;
  const opponentCount = opponents?.length ?? 0;

  // Die Begrüßung (Leon 01.09.: tagesabhängig, mit Vornamen). Direkt im
  // Render gerechnet wie im Athleten-Dashboard — die Seite rendert erst nach
  // dem Auth-Laden im Browser, es gibt keinen Server-Stand zum Abweichen.
  const firstName = profile?.displayName?.trim().split(/\s+/)[0] || "Coach";
  const greeting = greetingFor(firstName);

  return (
    <main
      className="min-h-screen pb-12"
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      {/* Kopfbereich mit Ambient-Schicht (Muster der Verwaltungs-Seiten).
          Der Clip-Container umschließt NUR die Ambient-Ebene — läge er auf der
          Sektion, schnitte er den weichen Schatten der Glas-Karte ab. */}
      <section className="relative">
        <div
          className="absolute inset-0 overflow-hidden"
          aria-hidden
          style={{
            maskImage:
              "linear-gradient(to bottom, black 55%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black 55%, transparent 100%)",
          }}
        >
          <div data-ambient style={{ background: "var(--ambient)" }} />
        </div>

        <div className="relative mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-5 pt-5 lg:max-w-5xl lg:flex-row lg:items-start lg:justify-between lg:gap-8 lg:px-6 lg:pb-7 lg:pt-7">
          <div className="flex min-w-0 flex-col gap-1 lg:flex-1">
            <h1
              style={{
                font: "var(--type-display)",
                letterSpacing: "var(--ls-display)",
                textTransform: "uppercase",
              }}
            >
              {greeting}
            </h1>
            <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              Dein Gym auf einen Blick: die Rückmeldungen aus dem Kursplan,
              die Auslastung deiner Kurse und der direkte Weg ins DeepFight.
            </p>
          </div>

          {/* Die eine Zahl, die beim Öffnen zählt — Leons Wunsch: die Karte
              bleibt, nur die Ecken werden runder (--r-xl statt des
              t-glass-Standards). */}
          <div className="lg:w-[380px] lg:shrink-0">
            {camps === null ? (
              <div
                className="t-glass p-4"
                style={{ borderRadius: "var(--r-xl)" }}
              >
                <Skeleton className="h-24 w-full" />
              </div>
            ) : nextCamp && nextInfo ? (
              <Link data-press="surface"
                href={`/trainer/competitions/${nextCamp.studentUid}/${nextCamp.id}`}
                className="t-glass t-interactive flex flex-col gap-2.5 p-4"
                style={{
                  borderRadius: "var(--r-xl)",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <span className="t-label">Nächster Wettkampf</span>
                <div className="flex items-baseline gap-2">
                  <span
                    style={{
                      font: "var(--type-num-xl)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {nextInfo.daysRemaining}
                  </span>
                  <span
                    style={{ font: "var(--type-h3)", color: "var(--text-2)" }}
                  >
                    {nextInfo.daysRemaining === 1 ? "Tag" : "Tage"} bis zum
                    Kampf
                  </span>
                </div>
                <span
                  className="truncate"
                  style={{ font: "var(--type-body-strong)" }}
                >
                  {memberLabel(memberMap.get(nextCamp.studentUid))}
                </span>
                <span
                  className="truncate"
                  style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                >
                  {nextCamp.competitionName} · gegen {nextCamp.opponent.name}
                </span>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="t-label">Camp-Fortschritt</span>
                    <span
                      style={{
                        font: "var(--type-num)",
                        fontVariantNumeric: "tabular-nums",
                        color: "var(--text-2)",
                      }}
                    >
                      {nextPct} %
                    </span>
                  </div>
                  <div className="t-progress">
                    <span style={{ width: `${nextPct}%` }} />
                  </div>
                </div>
              </Link>
            ) : (
              <div
                className="t-glass flex flex-col gap-2 p-4"
                style={{ borderRadius: "var(--r-xl)" }}
              >
                <span className="t-label">Nächster Wettkampf</span>
                <span style={{ font: "var(--type-body-strong)" }}>
                  Gerade steht keiner an
                </span>
                <span
                  style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                >
                  Sobald du einen Wettkampf anlegst, steht hier der
                  Countdown — mit Athlet, Gegner und dem Stand der
                  Camp-Vorbereitung.
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-1 lg:grid lg:max-w-5xl lg:grid-cols-2 lg:items-start lg:gap-6 lg:px-6">
        {error && (
          <div
            className="flex flex-col items-start gap-3 rounded-card p-4 lg:col-span-2"
            style={{
              background: "var(--surface-card)",
              border: "1px solid var(--negative)",
            }}
          >
            <span style={{ font: "var(--type-body-strong)" }}>
              Die Daten konnten nicht geladen werden
            </span>
            <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              {error}
            </span>
            <button
              type="button"
              onClick={load}
              className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-4"
              style={{
                ...BTN_FONT,
                background: "var(--surface-raised)",
                border: "1px solid var(--line)",
                color: "var(--text-body)",
              }}
            >
              <Icon name="refresh" size={14} strokeWidth={2.2} />
              Erneut versuchen
            </button>
          </div>
        )}

        {/* ─── Kennzahlen-Bento (Leons Vorlage: verschieden große Kacheln) ──
            Links die eine große Karte in der GYM-AKZENTFARBE — die „laute"
            Fläche des Systems, dasselbe Vokabular wie die Primär-Knöpfe
            (--accent + --on-accent + --accent-glow). Ein Zwischenstand hatte
            hier die Flächen-Tokens invertiert (fast weiße Karte) — Leons
            Einwand 02.09.: die Farbe passte nicht zur App. */}
        <div className="grid gap-3 lg:col-span-2 lg:grid-cols-2">
          <Link data-press="surface"
            href="/trainer/athleten"
            className="t-interactive relative flex flex-col justify-between gap-6 overflow-hidden p-5 lg:row-span-2 lg:p-6"
            style={{
              borderRadius: "var(--r-xl)",
              background: "var(--accent)",
              color: "var(--on-accent)",
              boxShadow: "var(--accent-glow)",
              textDecoration: "none",
            }}
          >
            {/* Feine Schraffur wie in der Vorlage: Haarlinien der eigenen
                Textfarbe, nach rechts unten auslaufend maskiert. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "repeating-linear-gradient(135deg, color-mix(in oklab, var(--on-accent) 20%, transparent) 0px, color-mix(in oklab, var(--on-accent) 20%, transparent) 1px, transparent 1px, transparent 10px)",
                maskImage:
                  "linear-gradient(135deg, black, transparent 60%)",
                WebkitMaskImage:
                  "linear-gradient(135deg, black, transparent 60%)",
              }}
            />
            <span
              className="relative self-start rounded-full px-3 py-1.5"
              style={{
                ...META_BASE,
                fontSize: "11px",
                background:
                  "color-mix(in oklab, var(--on-accent) 14%, transparent)",
                color: "color-mix(in oklab, var(--on-accent) 85%, var(--accent))",
              }}
            >
              Athleten
            </span>
            <span className="relative flex flex-col gap-3">
              {loading ? (
                <Skeleton className="h-16 w-24" />
              ) : (
                <span
                  style={{
                    font: "800 clamp(48px, 9vw, 64px)/1 var(--font-archivo), system-ui, sans-serif",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {studentCount}
                </span>
              )}
              <span
                style={{
                  font: "var(--type-sub)",
                  color: "color-mix(in oklab, var(--on-accent) 85%, var(--accent))",
                }}
              >
                So viele Athleten trainieren gerade in deinem Gym — Trainer
                und Verwaltung nicht mitgezählt.
              </span>
            </span>
          </Link>

          {/* Wachstum mit Balken-Sparkline (Vorlage: „GROWTH +240%") */}
          <div
            className="t-card flex flex-col gap-3 p-4 lg:p-5"
            style={{ borderRadius: "var(--r-xl)" }}
          >
            <span
              className={META_SIZE}
              style={{ ...META_BASE, color: "var(--text-label)" }}
            >
              Wachstum
            </span>
            <div className="flex items-end justify-between gap-4">
              {growthInfo === null ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <span style={{ font: "var(--type-num-xl)", fontSize: "34px" }}>
                  {growthInfo.headline}
                </span>
              )}
              {growthInfo !== null && (
                <GrowthSparkline values={growthInfo.bars} />
              )}
            </div>
            <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              {growthInfo === null
                ? ""
                : `${growthInfo.joined} neue Mitglieder in den letzten zwölf Monaten.`}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatTile
              label="Kurs-Pflege"
              value={
                coverage ? `${coverage.withContent}/${coverage.total}` : null
              }
              sub="diese Woche mit Inhalten"
              href="/schedule"
            />
            <StatTile
              label="Rückmeldungen"
              value={
                participations === null
                  ? null
                  : statsFailed
                    ? "–"
                    : participations.length
              }
              sub="in den letzten zwölf Wochen"
            />
          </div>
        </div>

        {/* ─── DeepFight-Hero („Wow + direkt loslegen", Leons Antwort) ──────
            Ersetzt die Listen „Nächste Wettkämpfe" und „Zuletzt im
            DeepFight". Verlauf und Violett sind hier erlaubt: --grad-fight
            ist AUSSCHLIESSLICH DeepFight (Token-Kommentar in globals.css),
            und die Glow-Formen sind die Karten-Variante der
            Ambient-Mechanik — sie überleben deshalb auch die
            staff-content-Regel der Hülle. */}
        <section className="lg:col-span-2">
          <div
            className="t-card-fight relative overflow-hidden p-5 lg:p-7"
            style={{ borderRadius: "var(--r-xl)" }}
          >
            <div data-ambient aria-hidden>
              <span
                data-glow
                style={{
                  left: "-8%",
                  top: "-45%",
                  width: "42%",
                  height: "130%",
                  background:
                    "oklch(0.62 var(--accent-c) var(--accent-h) / 0.4)",
                }}
              />
              <span
                data-glow
                style={{
                  right: "-10%",
                  bottom: "-55%",
                  width: "48%",
                  height: "140%",
                  background:
                    "oklch(0.55 calc(var(--accent2-c)*0.9) var(--accent2-h) / 0.45)",
                }}
              />
            </div>
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
              <div className="flex min-w-0 flex-col gap-2.5">
                <span className="t-label">KI-Video-Analyse</span>
                <span
                  style={{
                    font: "800 clamp(26px, 5vw, 34px)/1.1 var(--font-archivo), system-ui, sans-serif",
                  }}
                >
                  <DeepFightWordmark />
                </span>
                <p
                  className="max-w-xl"
                  style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
                >
                  Lade ein Kampfvideo hoch — die KI zerlegt Gegner wie Athleten
                  in DNA-Split, Stärken und Lücken. Du prüfst die Befunde und
                  übernimmst nur, was stimmt.
                </p>
                <span
                  className={META_SIZE}
                  style={{ ...META_BASE, color: "var(--text-3)" }}
                >
                  {loading
                    ? ""
                    : opponentCount === 0
                      ? "Noch kein Gegnerprofil in eurer Bibliothek"
                      : `${opponentCount} ${opponentCount === 1 ? "Gegnerprofil" : "Gegnerprofile"} in eurer Bibliothek`}
                </span>
              </div>
              <div className="flex flex-col gap-2.5 sm:flex-row lg:shrink-0 lg:flex-col xl:flex-row">
                <Link data-press
                  href="/trainer/opponents?new=1"
                  className="t-interactive inline-flex min-h-hit items-center justify-center gap-2 rounded-field px-6"
                  style={{
                    ...BTN_FONT,
                    background: "var(--grad-fight)",
                    color: "var(--on-accent)",
                    boxShadow:
                      "0 0 28px -6px color-mix(in oklab, var(--accent-2) 55%, transparent)",
                    textDecoration: "none",
                  }}
                >
                  Gegner scouten
                </Link>
                <Link data-press
                  href="/trainer/deepfight/athletes"
                  className="t-interactive inline-flex min-h-hit items-center justify-center gap-2 rounded-field px-6"
                  style={{
                    ...BTN_FONT,
                    background: "var(--surface-raised)",
                    border: "1px solid var(--line)",
                    color: "var(--text-body)",
                    textDecoration: "none",
                  }}
                >
                  Athleten analysieren
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Diagramm 1: Wochenverlauf der Rückmeldungen */}
        <section className="flex flex-col gap-2">
          <SectionHead label="Rückmeldungen pro Woche" />
          <div className="t-card flex flex-col gap-3 p-4">
            {weekPoints === null ? (
              <Skeleton className="h-44 w-full" />
            ) : statsFailed ? (
              <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                Die Rückmeldungen konnten gerade nicht geladen werden —
                versuch es gleich noch einmal.
              </p>
            ) : (
              <WeeklyFeedbackChart points={weekPoints} />
            )}
            <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              Jede Rückmeldung ist ein Tipp auf „Teilnehmen“ im Kursplan —
              eine Selbstauskunft deiner Mitglieder, keine
              Anwesenheitskontrolle. Der letzte Punkt ist die laufende Woche
              und wächst noch bis Sonntag.
            </p>
          </div>
        </section>

        {/* Diagramm 2: Auslastung je Kurs */}
        <section className="flex flex-col gap-2">
          <SectionHead label="Auslastung je Kurs" />
          <div className="t-card flex flex-col gap-3 p-4">
            {courses === null ? (
              <div className="flex flex-col gap-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : statsFailed ? (
              <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                Die Rückmeldungen konnten gerade nicht geladen werden —
                versuch es gleich noch einmal.
              </p>
            ) : (
              <>
                <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                  Rückmeldungen je Kurs in den letzten zwölf Wochen.
                </p>
                <CourseLoadChart courses={courses} />
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
