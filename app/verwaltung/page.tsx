"use client";

/**
 * Verwaltungs-Übersicht — das Bereichs-Dashboard hinter dem klickbaren
 * Gruppentitel „Verwaltung" der Sidebar (Leons Vorgabe 02.09.2026: „Klick auf
 * den Gruppentitel führt auf ein eigenes Dashboard — egal welche weiteren
 * Rechte jemand hat").
 *
 * WER HIER ANKOMMT, IST DIE REINE VERWALTUNG. Sie hat keinen Trainerbereich,
 * keine Schülerliste, keine Wettkämpfe. Ihre Fragen sind andere als die des
 * Trainers: Wie viele Menschen sind wir, wächst das, wer hat welche Rechte,
 * was ist zuletzt passiert, was steht offen. Der AUFBAU folgt trotzdem der
 * Trainer-Übersicht (Begrüßung + eine Karte rechts, Bento, Diagramme) —
 * ein Cheftrainer trägt beide Häkchen und wechselt zwischen den zwei
 * Dashboards; zwei verschiedene Anordnungen wären zwei Gewohnheiten.
 *
 * SIE BLEIBT IM GYM-AKZENT (Leons Entscheidung, Memory „bereichsfarben"):
 * Bernstein ist die Marke der Verwaltungs-Rubrik in der SIDEBAR, nicht die
 * Farbe des Arbeitsbereichs. Ganzflächig eingefärbt wird ausschließlich
 * `/admin` — dort hat keine Gym-Marke etwas verloren, weil es gym-übergreifend
 * ist. Deshalb steht hier KEIN `data-area`-Wrapper.
 *
 * BESCHRIFTUNG: `participations` entstehen durch Tippen auf „Teilnehmen" im
 * Kursplan — Selbstauskunft, keine kontrollierte Anwesenheit
 * (lib/gym-stats.ts). Sie heißen hier wie überall „Rückmeldungen".
 *
 * RECHTE: Der Guard sitzt im Layout (`VerwaltungRoute`), die Middleware gated
 * die Route, die Firestore-Regeln entscheiden. Die Abfragen hier laufen
 * trotzdem erst los, wenn das Recht feststeht — ein Athlet, der die Adresse
 * kennt, soll keine vier Abfragen auslösen, die ohnehin abgewiesen werden.
 */

import CourseLoadChart from "@/components/trainer/CourseLoadChart";
import MemberGrowthChart from "@/components/verwaltung/MemberGrowthChart";
import Icon from "@/components/ui/Icon";
import Skeleton from "@/components/ui/Skeleton";
import { listAllMembers, type StudentEntry } from "@/lib/admin";
import {
  auditHeadline,
  auditIcon,
  dayLabel,
  isNewsEntry,
  listGymAuditLog,
  timeLabel,
  type AuditEntry,
} from "@/lib/audit";
import { useAuth, useRights } from "@/lib/auth-context";
import { greetingFor } from "@/lib/greeting";
import { resolveGymId } from "@/lib/gym";
import {
  courseLoad,
  getParticipationsSince,
  memberGrowth,
  type ParticipationPoint,
} from "@/lib/gym-stats";
import { inviteStatus, listGymInvites, type GymInvite } from "@/lib/invites";
import { memberGroupOf } from "@/lib/members";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

/** Zeitraum der Kurs-Auslastung: dieselben zwölf Wochen wie beim Trainer. */
const WEEKS = 12;
/** Zeitraum der Wachstumskurve. */
const MONTHS = 12;
/**
 * So viele Neuigkeiten stehen in der Vorschau — der Rest im eigenen Bereich.
 *
 * VIER UND NICHT FÜNF, weil diese Karte die Höhe der großen Akzentkarte
 * daneben bestimmt (`row-span-2`): Mit fünf Zeilen wurde die Karte 470 px
 * hoch und die Mitgliederzahl schwamm in knapp 300 px Leere (nachgemessen
 * 02.09.). Die fünfte Zeile ist billiger zu verlieren als die Ruhe im Bento.
 */
const NEWS_PREVIEW = 4;
/** „Läuft bald ab" heißt: innerhalb dieser Frist. */
const EXPIRY_SOON_DAYS = 7;

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

// Größe responsiv über Klassen (Muster der Trainer-Übersicht) — deshalb kein
// font-Shorthand, sondern Einzelwerte + META_SIZE.
const META_BASE: React.CSSProperties = {
  fontFamily: "var(--font-archivo), system-ui, sans-serif",
  fontWeight: 600,
  lineHeight: 1.3,
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};
const META_SIZE = "text-[10px] sm:text-[13px]";

// ─── Bausteine ───────────────────────────────────────────────────────────────

/** Kennzahl-Kachel: Label oben, Zahl groß, Einordnung darunter. */
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
 * Eine Zeile der Rechte-Verteilung: Gruppe, Balken, Zahl.
 *
 * BEWUSST BALKEN UND KEIN TORTENDIAGRAMM: Die Verteilung ist fast immer
 * dieselbe — sehr viele Athleten, wenige Trainer, ein bis zwei Verwaltungen.
 * Ein Kreis mit zwei Splittern von zwei Grad wäre nicht lesbar, und die
 * Balkenliste spricht dieselbe Sprache wie `CourseLoadChart` weiter unten.
 * Die Länge misst am GRÖSSTEN Anteil, nicht an der Gesamtzahl: Sonst wären
 * die beiden kleinen Balken unsichtbare Striche.
 */
function RightsRow({
  label,
  count,
  max,
  hint,
}: {
  label: string;
  count: number;
  max: number;
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="grid items-center gap-3"
        style={{ gridTemplateColumns: "minmax(0, 34%) 1fr auto" }}
      >
        <span
          className="truncate"
          style={{ font: "var(--type-body-strong)", color: "var(--text-body)" }}
        >
          {label}
        </span>
        <div className="t-progress">
          <span style={{ width: `${max > 0 ? (count / max) * 100 : 0}%` }} />
        </div>
        <span
          className="w-8 text-right"
          style={{
            font: "var(--type-num)",
            fontVariantNumeric: "tabular-nums",
            color: "var(--text-2)",
          }}
        >
          {count}
        </span>
      </div>
      <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
        {hint}
      </span>
    </div>
  );
}

// ─── Seite ───────────────────────────────────────────────────────────────────

export default function VerwaltungDashboardPage() {
  const { user, profile, profileLoading } = useAuth();
  const isVerwaltung = useRights().verwaltung;
  const gymId = resolveGymId(profile);

  const [members, setMembers] = useState<StudentEntry[] | null>(null);
  const [invites, setInvites] = useState<GymInvite[] | null>(null);
  const [news, setNews] = useState<AuditEntry[] | null>(null);
  const [participations, setParticipations] = useState<
    ParticipationPoint[] | null
  >(null);
  // Getrennt vom allgemeinen Fehler: Schlagen NUR die Rückmeldungen fehl
  // (z. B. ein noch bauender Index), soll das Diagramm das sagen, statt
  // stumm eine Null-Auslastung zu zeigen — eine falsche Null wäre eine
  // Aussage über Kurse, nach der jemand entscheidet.
  const [statsFailed, setStatsFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || profileLoading || !isVerwaltung) return;
    setError(null);
    setMembers(null);
    setInvites(null);
    setNews(null);
    setParticipations(null);
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
      const [memberList, inviteList, auditList, parts] = await Promise.all([
        listAllMembers(gymId),
        listGymInvites(gymId).catch(() => [] as GymInvite[]),
        listGymAuditLog(gymId).catch(() => [] as AuditEntry[]),
        getParticipationsSince(gymId, since).catch(() => null),
      ]);
      setMembers(memberList);
      setInvites(inviteList);
      setNews(auditList);
      setParticipations(parts ?? []);
      setStatsFailed(parts === null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setMembers([]);
      setInvites([]);
      setNews([]);
      setParticipations([]);
    }
  }, [user, profileLoading, isVerwaltung, gymId]);

  useEffect(() => {
    load();
  }, [load]);

  // ─── Ableitungen ───────────────────────────────────────────────────────────

  const monthsList = useMemo(
    () => (members === null ? null : memberGrowth(members, MONTHS, new Date())),
    [members],
  );

  /** Beitritte in diesem Monat und im ganzen Zeitraum. */
  const growth = useMemo(() => {
    if (monthsList === null) return null;
    return {
      thisMonth: monthsList[monthsList.length - 1]?.joined ?? 0,
      total: monthsList.reduce((sum, m) => sum + m.joined, 0),
    };
  }, [monthsList]);

  /**
   * Die Rechte-Verteilung. `memberGroupOf` ordnet jede Person GENAU EINER
   * Gruppe zu (Verwaltung schlägt Trainer) — die Summe der drei Zahlen ist
   * deshalb die Mitgliederzahl und nicht mehr. Ein Cheftrainer erscheint als
   * Verwaltung; das ist dieselbe Sortierung wie in der Mitgliederliste, und
   * zwei verschiedene Zählweisen für dieselben Menschen wären zwei
   * Wahrheiten.
   */
  const distribution = useMemo(() => {
    if (members === null) return null;
    const counts = { verwaltung: 0, trainer: 0, athlet: 0 };
    for (const m of members) counts[memberGroupOf(m)] += 1;
    return counts;
  }, [members]);

  /** Offene Einladungen — und wie viele davon bald ablaufen. */
  const openInvites = useMemo(() => {
    if (invites === null) return null;
    const now = new Date();
    const open = invites.filter((i) => inviteStatus(i, now) === "open");
    const soonLimit = now.getTime() + EXPIRY_SOON_DAYS * 86_400_000;
    return {
      count: open.length,
      expiringSoon: open.filter(
        (i) => i.expiresAt && i.expiresAt.getTime() <= soonLimit,
      ).length,
      // Wie viele Plätze insgesamt noch offenstehen — eine Einladung kann
      // mehrfach einlösbar sein, „3 Einladungen" heißt also nicht „3 Leute".
      seats: open.reduce((sum, i) => sum + (i.maxUses - i.usedCount), 0),
    };
  }, [invites]);

  const newsPreview = useMemo(
    () => (news === null ? null : news.filter(isNewsEntry).slice(0, NEWS_PREVIEW)),
    [news],
  );

  const courses = useMemo(
    () => (participations === null ? null : courseLoad(participations)),
    [participations],
  );

  const memberCount = members?.length ?? null;
  const maxGroup = distribution
    ? Math.max(distribution.verwaltung, distribution.trainer, distribution.athlet)
    : 0;

  // Die Begrüßung (Muster der Trainer-Übersicht): tagesabhängig, mit dem
  // ersten Wort des Anzeigenamens. Direkt im Render gerechnet — die Seite
  // rendert erst nach dem Auth-Laden im Browser, es gibt keinen Server-Stand,
  // von dem sie abweichen könnte.
  const firstName = profile?.displayName?.trim().split(/\s+/)[0] || "Team";
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
              Dein Gym auf einen Blick: wie viele Menschen dabei sind, wie es
              wächst, wer welche Rechte hat und was zuletzt passiert ist.
            </p>
          </div>

          {/* Die eine Zahl, die beim Öffnen zählt — an der Stelle, an der die
              Trainer-Übersicht den nächsten Wettkampf zeigt. */}
          <div className="lg:w-[380px] lg:shrink-0">
            {openInvites === null ? (
              <div
                className="t-glass p-4"
                style={{ borderRadius: "var(--r-xl)" }}
              >
                <Skeleton className="h-24 w-full" />
              </div>
            ) : openInvites.count > 0 ? (
              <Link data-press="surface"
                href="/verwaltung/einladungen"
                className="t-glass t-interactive flex flex-col gap-2.5 p-4"
                style={{
                  borderRadius: "var(--r-xl)",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <span className="t-label">Offene Einladungen</span>
                <div className="flex items-baseline gap-2">
                  <span
                    style={{
                      font: "var(--type-num-xl)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {openInvites.count}
                  </span>
                  <span
                    style={{ font: "var(--type-h3)", color: "var(--text-2)" }}
                  >
                    {openInvites.count === 1
                      ? "Einladung ist unterwegs"
                      : "Einladungen sind unterwegs"}
                  </span>
                </div>
                <span
                  style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                >
                  {openInvites.seats !== openInvites.count
                    ? `Zusammen ${openInvites.seats} freie Plätze — manche Einladungen lassen mehrere Personen herein.`
                    : openInvites.count === 1
                      ? "Sie lässt genau eine Person herein."
                      : "Jede davon lässt genau eine Person herein."}
                </span>
                {openInvites.expiringSoon > 0 && (
                  <span
                    className="flex items-center gap-1.5"
                    style={{
                      font: "var(--type-sub)",
                      color: "var(--accent-text)",
                    }}
                  >
                    <Icon name="timer" size={14} strokeWidth={2} />
                    {openInvites.expiringSoon === 1
                      ? "Eine läuft in den nächsten sieben Tagen ab."
                      : `${openInvites.expiringSoon} laufen in den nächsten sieben Tagen ab.`}
                  </span>
                )}
              </Link>
            ) : (
              <div
                className="t-glass flex flex-col items-start gap-2.5 p-4"
                style={{ borderRadius: "var(--r-xl)" }}
              >
                <span className="t-label">Offene Einladungen</span>
                <span style={{ font: "var(--type-body-strong)" }}>
                  Gerade ist keine unterwegs
                </span>
                <span
                  style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                >
                  Neue Athleten und Trainer kommen über einen Einladungslink
                  in dein Gym — die Rolle legst du dabei schon fest.
                </span>
                <Link data-press
                  href="/verwaltung/einladungen"
                  className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-4"
                  style={{
                    ...BTN_FONT,
                    background: "var(--accent)",
                    color: "var(--on-accent)",
                    textDecoration: "none",
                  }}
                >
                  <Icon name="plus" size={14} strokeWidth={2.4} />
                  Einladen
                </Link>
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

        {/* ─── Kennzahlen-Bento ─────────────────────────────────────────────
            Links die große Karte in der GYM-AKZENTFARBE — dasselbe Vokabular
            wie die Primär-Knöpfe (--accent + --on-accent + --accent-glow) und
            wie die Athleten-Karte der Trainer-Übersicht.

            SIE ZÄHLT ALLE MITGLIEDER, auch Trainer und Verwaltung. Der
            Trainer sieht auf seiner Übersicht bewusst nur die Athleten — das
            ist die Zahl, die er unterrichtet. Die Verwaltung führt dagegen das
            GYM, und zu dem gehören alle. Deshalb stehen auf den beiden
            Dashboards verschiedene Zahlen, und deshalb sagt der Satz unter der
            Zahl ausdrücklich, wer mitgezählt ist. */}
        <div className="grid gap-3 lg:col-span-2 lg:grid-cols-2">
          <Link data-press="surface"
            href="/verwaltung/mitglieder"
            className="t-interactive relative flex flex-col justify-between gap-6 overflow-hidden p-5 lg:row-span-2 lg:p-6"
            style={{
              borderRadius: "var(--r-xl)",
              background: "var(--accent)",
              color: "var(--on-accent)",
              boxShadow: "var(--accent-glow)",
              textDecoration: "none",
            }}
          >
            {/* Feine Schraffur: Haarlinien der eigenen Textfarbe, nach rechts
                unten auslaufend maskiert. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "repeating-linear-gradient(135deg, color-mix(in oklab, var(--on-accent) 20%, transparent) 0px, color-mix(in oklab, var(--on-accent) 20%, transparent) 1px, transparent 1px, transparent 10px)",
                maskImage: "linear-gradient(135deg, black, transparent 60%)",
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
              Mitglieder
            </span>
            <span className="relative flex flex-col gap-3">
              {memberCount === null ? (
                <Skeleton className="h-16 w-24" />
              ) : (
                <span
                  style={{
                    font: "800 clamp(48px, 9vw, 64px)/1 var(--font-archivo), system-ui, sans-serif",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {memberCount}
                </span>
              )}
              <span
                style={{
                  font: "var(--type-sub)",
                  color: "color-mix(in oklab, var(--on-accent) 85%, var(--accent))",
                }}
              >
                So viele Menschen gehören gerade zu deinem Gym — Athleten,
                Trainer und Verwaltung zusammen.
              </span>
            </span>
          </Link>

          <div className="grid grid-cols-2 gap-3">
            <StatTile
              label="Neu diesen Monat"
              value={growth === null ? null : growth.thisMonth}
              sub="Beitritte seit dem Ersten"
              href="/verwaltung/mitglieder"
            />
            <StatTile
              label="Freie Plätze"
              value={openInvites === null ? null : openInvites.seats}
              sub="über offene Einladungen"
              href="/verwaltung/einladungen"
            />
          </div>

          {/* DIE NEUIGKEITEN STEHEN IM BENTO — nicht, weil sie dorthin
              gehörten, sondern weil ihre Höhe feststeht: fünf Zeilen, immer.
              Die große Akzentkarte daneben ist `row-span-2` und wird damit
              so hoch wie diese Spalte. Hier stand zuerst die
              Rechte-Verteilung mit ihren drei Erklärsätzen — die Karte war
              dadurch 519 px hoch und die Zahl schwamm in 330 px Leere
              (nachgemessen 02.09.). Was neben eine `row-span-2`-Karte
              kommt, muss vorhersehbar hoch sein. */}
          <div
            className="t-card flex flex-col gap-3 p-4 lg:p-5"
            style={{ borderRadius: "var(--r-xl)" }}
          >
            <div className="flex items-center justify-between gap-3">
              <span
                className={META_SIZE}
                style={{ ...META_BASE, color: "var(--text-label)" }}
              >
                Zuletzt passiert
              </span>
              <Link data-press
                href="/verwaltung/neuigkeiten"
                className="t-interactive -mr-2 inline-flex min-h-hit items-center gap-1.5 rounded-field px-2"
                style={{
                  ...BTN_FONT,
                  color: "var(--text-3)",
                  textDecoration: "none",
                }}
              >
                Alle
                <Icon name="arrow-right" size={14} strokeWidth={2.2} />
              </Link>
            </div>
            {newsPreview === null ? (
              <div className="flex flex-col gap-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : newsPreview.length === 0 ? (
              <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                Noch ist niemand neu dazugekommen. Sobald jemand deine
                Einladung einlöst oder du Rechte änderst, steht es hier.
              </p>
            ) : (
              newsPreview.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: "var(--accent-subtle)",
                      color: "var(--accent-text)",
                    }}
                  >
                    <Icon name={auditIcon(entry)} size={16} strokeWidth={2} />
                  </span>
                  <span
                    className="min-w-0 flex-1"
                    style={{
                      font: "var(--type-sub)",
                      color: "var(--text-body)",
                    }}
                  >
                    {auditHeadline(entry)}
                  </span>
                  {/* NUR HEUTIGE EINTRÄGE ZEIGEN DIE UHRZEIT. Die
                      Neuigkeiten-Seite bündelt nach Tagen und hat die
                      Tages-Überschrift darüber; diese Vorschau hat sie nicht
                      — eine nackte „20:17" ließe einen Eintrag von letzter
                      Woche wie den von heute Abend aussehen. */}
                  <span
                    className="shrink-0"
                    style={{
                      ...META_BASE,
                      fontSize: "10px",
                      color: "var(--text-3)",
                    }}
                  >
                    {dayLabel(entry.at) === "Heute"
                      ? timeLabel(entry.at)
                      : dayLabel(entry.at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ─── Wachstum: das große Diagramm der Verwaltung ──────────────────
            (Leons Wahl 02.09. gegen die kleine Sparkline.) */}
        <section className="flex flex-col gap-2">
          <SectionHead label="Mitglieder über die Zeit" />
          <div className="t-card flex flex-col gap-3 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span style={{ font: "var(--type-body-strong)" }}>
                {growth === null
                  ? ""
                  : growth.total === 0
                    ? "Zwölf Monate"
                    : `+${growth.total} in zwölf Monaten`}
              </span>
            </div>
            {monthsList === null ? (
              <Skeleton className="h-44 w-full" />
            ) : (
              <MemberGrowthChart months={monthsList} />
            )}
            <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              Der Mitgliederstand am Ende jedes Monats.{" "}
              {growth && growth.thisMonth > 0
                ? growth.thisMonth === 1
                  ? "Diesen Monat ist eine Person dazugekommen."
                  : `Diesen Monat sind ${growth.thisMonth} Menschen dazugekommen.`
                : "Diesen Monat ist noch niemand dazugekommen."}{" "}
              Wer schon vor dem Einladungssystem dabei war, hat kein
              Beitrittsdatum und taucht deshalb erst im letzten Monat auf —
              der linke Teil der Kurve ist eher zu niedrig als zu hoch.
            </p>
          </div>
        </section>

        {/* ─── Rechte-Verteilung ───────────────────────────────────────────
            Sie steht NEBEN dem Wachstums-Diagramm, weil beide etwa gleich
            hoch sind — im Bento oben hätte sie die Akzentkarte gestreckt
            (siehe dort). */}
        <section className="flex flex-col gap-2">
          <SectionHead
            label="Wer welche Rechte hat"
            moreHref="/verwaltung/mitglieder"
            moreLabel="Rechte vergeben"
          />
          <div className="t-card flex flex-col gap-4 p-4">
            {distribution === null ? (
              <div className="flex flex-col gap-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <>
                <RightsRow
                  label="Verwaltung"
                  count={distribution.verwaltung}
                  max={maxGroup}
                  hint="Führt das Gym: lädt ein, vergibt Rechte und liest das Protokoll."
                />
                <RightsRow
                  label="Trainer"
                  count={distribution.trainer}
                  max={maxGroup}
                  hint="Dein Team — es bekommt zusätzlich DeepFight, Wettkämpfe und die Athletenliste."
                />
                <RightsRow
                  label="Athleten"
                  count={distribution.athlet}
                  max={maxGroup}
                  hint="Trainieren einfach mit: Kurse, Workout-Pläne und das eigene Kampfprofil."
                />
                <p
                  style={{
                    font: "var(--type-sub)",
                    color: "var(--text-3)",
                    borderTop: "1px solid var(--line)",
                    paddingTop: "var(--sp-3)",
                  }}
                >
                  Jede Person steht in genau einer Zeile: Wer beides hat,
                  zählt als Verwaltung.
                </p>
              </>
            )}
          </div>
        </section>

        {/* ─── Auslastung je Kurs (Leons Wahl 02.09.) ───────────────────────
            Sie steht hier, weil eine reine Verwaltung KEINEN Trainerbereich
            hat und sonst nirgends sähe, welche Kurse laufen — für sie ist das
            die betriebliche Frage. Ein Cheftrainer sieht dasselbe Diagramm auf
            beiden Dashboards; das ist gewollt, es sind zwei Blickwinkel auf
            dieselbe Sache.

            Die Komponente liegt weiterhin unter `components/trainer/` — sie
            dorthin zu verschieben hieße, die Trainer-Übersicht anzufassen;
            das gehört in den Rollout, nicht hierher. */}
        <section className="flex flex-col gap-2 lg:col-span-2">
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
                  Rückmeldungen je Kurs in den letzten zwölf Wochen. Jede
                  Rückmeldung ist ein Tipp auf „Teilnehmen“ im Kursplan — eine
                  Selbstauskunft eurer Mitglieder, keine
                  Anwesenheitskontrolle.
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
