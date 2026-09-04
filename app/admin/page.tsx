"use client";

/**
 * Plattform-Übersicht — das Bereichs-Dashboard hinter dem klickbaren
 * Gruppentitel „Plattform" der Sidebar (Leons Vorgabe 02.09.2026: die
 * Übersicht soll JETZT stehen, nicht erst mit Phase 3).
 *
 * BIS HEUTE STAND HIER EIN `redirect("/admin/users")`. Er fällt weg — nicht
 * weil er nicht funktionierte, sondern weil es jetzt eine eigene Seite gibt.
 * Das Bereichs-Layout darüber (`app/admin/layout.tsx`) bleibt UNANGETASTET
 * ein SERVER-Baustein: Ein `"use client"` dort würde jedes künftige
 * `redirect()` unter `/admin` wirkungslos machen (CLAUDE.md, „Route-Schutz").
 * Diese Seite ist ein Client-Baustein — das ist zulässig und ändert nichts
 * daran, dass das Layout serverseitig gerendert wird.
 *
 * DIE LEITFRAGE DES INHALTS: Was sieht AUSSCHLIESSLICH der Plattform-Rang?
 * Alles, was über Gym-Grenzen hinweggeht. Eine Zahl, die auch in einer
 * Gym-Oberfläche stehen könnte, gehört nicht hierher — sie stünde dort
 * besser, weil sie dort einen Zusammenhang hat.
 *
 * NACHGEMESSEN STATT ANGENOMMEN (02.09.2026, Firestore-REST mit echtem
 * ID-Token; das Admin-SDK umgeht die Regeln und beweist nichts): Ein
 * Prüfkonto mit ausschließlich `admin: true` darf `LIST gyms/` (200) und
 * `LIST users/` plattformweit (200); dasselbe Konto mit ausschließlich
 * `trainer: true` bekommt auf BEIDES eine 403. Die drei Abfragen dieser
 * Seite hängen also wirklich am Plattform-Rang.
 *
 * KARMIN KOMMT NICHT VON HIER. Die Seite benutzt ausschließlich die
 * `--accent*`-Familie; rot wird sie, weil das Layout `data-area="admin"`
 * setzt und globals.css daraufhin die zwei Eingaben `--accent-h/--accent-c`
 * überschreibt (DESIGN-BRIEF §1.1). Ein Hex oder ein eigener Rotton hier
 * würde genau die Mechanik aushebeln, die den Bereich erkennbar macht.
 * `--negative` bleibt dem Fehlerfall vorbehalten — Admin-Karmin (Hue 10) und
 * Alarm-Rot (Hue 25) sind bewusst unterscheidbar (Begründung in globals.css).
 *
 * FARBE STEHT NIE ALLEIN (Leons Entscheidung gegen eine Sperrzone im
 * Branding-Kit): Ein Gym darf eine rote Akzentfarbe wählen, dann sieht dieser
 * Bereich aus wie der Trainerbereich. Deshalb sagen Überschrift, Schild-Symbol
 * und der einleitende Satz ausdrücklich, wo man ist.
 */

import AdminRoute from "@/components/AdminRoute";
import Icon from "@/components/ui/Icon";
import Skeleton from "@/components/ui/Skeleton";
import { listAllUsers, type AdminUserEntry } from "@/lib/admin";
import { useAuth } from "@/lib/auth-context";
import { greetingFor } from "@/lib/greeting";
import { listGyms, type Gym } from "@/lib/gym";
import {
  getAiUsageSummary,
  type AiUsageSummary,
} from "@/lib/video-analysis";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

/** Ab diesem Restanteil heißt das Guthaben „wird knapp". */
const BUDGET_LOW = 0.15;

const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

// Größe responsiv über Klassen (Muster der beiden anderen Übersichten) —
// deshalb kein font-Shorthand, sondern Einzelwerte + META_SIZE.
const META_BASE: React.CSSProperties = {
  fontFamily: "var(--font-archivo), system-ui, sans-serif",
  fontWeight: 600,
  lineHeight: 1.3,
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};
const META_SIZE = "text-[10px] sm:text-[13px]";

/**
 * Euro-Beträge. BEWUSST NICHT aus `AiBudgetGauge` importiert, obwohl dort
 * dasselbe steht: Die Gauge ist noch im alten Look und wird im Rollout
 * (Schritt 4) neu gebaut. Eine Übersicht, die an einer Komponente hängt, die
 * gerade ersetzt wird, zieht deren Umbau hier herein.
 */
function eur(n: number): string {
  return n.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function dateLabel(d: Date | null | undefined): string {
  if (!d) return "unbekannt";
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

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
 * Eine Zeile der Rechte-Verteilung — dieselbe Balkenliste wie im
 * Verwaltungs-Dashboard, damit dieselbe Frage überall gleich aussieht.
 * Die Länge misst am GRÖSSTEN Anteil, nicht an der Gesamtzahl: Ein
 * Plattform-Rang gegen dreißig Athleten wäre sonst ein unsichtbarer Strich.
 *
 * OHNE DEN ERKLÄRSATZ JE ZEILE, den die Verwaltung hat — hier sind es VIER
 * Gruppen statt drei, und die vierte Erklärung machte die Karte 488 px hoch
 * (nachgemessen 02.09.). Da sie neben der `row-span-2`-Karte steht, wird
 * diese genauso hoch, und die große Zahl schwamm in Leere. Die Erklärungen
 * stehen deshalb gebündelt unter der Liste.
 */
function RightsRow({
  label,
  count,
  max,
}: {
  label: string;
  count: number;
  max: number;
}) {
  return (
    <div
      className="grid items-center gap-3"
      style={{ gridTemplateColumns: "minmax(0, 38%) 1fr auto" }}
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
  );
}

// ─── Seite ───────────────────────────────────────────────────────────────────

function PlattformDashboard() {
  const { user, profile, profileLoading } = useAuth();

  const [users, setUsers] = useState<AdminUserEntry[] | null>(null);
  const [gyms, setGyms] = useState<Gym[] | null>(null);
  const [ai, setAi] = useState<AiUsageSummary | null>(null);
  /**
   * Getrennt vom allgemeinen Fehler: Die KI-Zahlen liegen in einem einzelnen
   * Dokument, das es geben KANN oder auch nicht (vor der ersten Analyse
   * existiert `aiUsage/summary` gar nicht). Ein leeres Guthaben-Feld ist
   * deshalb kein Grund, die ganze Seite als kaputt zu melden.
   */
  const [aiFailed, setAiFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || profileLoading) return;
    setError(null);
    setUsers(null);
    setGyms(null);
    setAi(null);
    setAiFailed(false);
    try {
      const [userList, gymList, usage] = await Promise.all([
        listAllUsers(),
        listGyms(),
        getAiUsageSummary().catch(() => null),
      ]);
      setUsers(userList);
      setGyms(gymList);
      setAi(usage);
      setAiFailed(usage === null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setUsers([]);
      setGyms([]);
      setAi(null);
    }
  }, [user, profileLoading]);

  useEffect(() => {
    load();
  }, [load]);

  // ─── Ableitungen ───────────────────────────────────────────────────────────

  /**
   * Die Rechte-Verteilung ÜBER ALLE GYMS. Jede Person steht in genau einer
   * Zeile, und der Plattform-Rang schlägt alles andere.
   *
   * ER STEHT HIER ZUM ERSTEN UND EINZIGEN MAL. In der Mitgliederliste eines
   * Gyms taucht er ausdrücklich nicht auf (`rightsLabel` in lib/roles.ts lässt
   * ihn weg, die Rollen-API kann ihn nicht ausdrücken) — er ist kein
   * Gym-Recht. Wer wissen will, wie viele Menschen die Plattform verwalten
   * dürfen, kann das nur hier sehen.
   */
  const distribution = useMemo(() => {
    if (users === null) return null;
    const counts = { admin: 0, verwaltung: 0, trainer: 0, athlet: 0 };
    for (const u of users) {
      if (u.rights.admin) counts.admin += 1;
      else if (u.rights.verwaltung) counts.verwaltung += 1;
      else if (u.rights.trainer) counts.trainer += 1;
      else counts.athlet += 1;
    }
    return counts;
  }, [users]);

  /** Konten je Gym — und die, die an keinem hängen. */
  const perGym = useMemo(() => {
    if (users === null) return null;
    const map = new Map<string, number>();
    let orphans = 0;
    for (const u of users) {
      if (!u.gymId) orphans += 1;
      else map.set(u.gymId, (map.get(u.gymId) ?? 0) + 1);
    }
    return { map, orphans };
  }, [users]);

  const demoCount = useMemo(
    () => (users === null ? null : users.filter((u) => u.isDemo).length),
    [users],
  );

  const budget = useMemo(() => {
    if (!ai) return null;
    const remaining = Math.max(0, ai.budgetEur - ai.spentEur);
    const fraction = ai.budgetEur > 0 ? remaining / ai.budgetEur : 0;
    return {
      remaining,
      fraction,
      low: ai.budgetEur > 0 && fraction < BUDGET_LOW,
      perAnalysis: ai.analysisCount > 0 ? ai.spentEur / ai.analysisCount : null,
    };
  }, [ai]);

  const userCount = users?.length ?? null;
  const maxGroup = distribution
    ? Math.max(
        distribution.admin,
        distribution.verwaltung,
        distribution.trainer,
        distribution.athlet,
      )
    : 0;

  // Die Begrüßung wie auf den beiden anderen Übersichten: tagesabhängig, mit
  // dem ersten Wort des Anzeigenamens.
  const firstName = profile?.displayName?.trim().split(/\s+/)[0] || "Admin";
  const greeting = greetingFor(firstName);

  return (
    <main
      className="min-h-screen pb-12"
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      {/* Kopfbereich mit Ambient-Schicht. Der Clip-Container umschließt NUR
          die Ambient-Ebene — läge er auf der Sektion, schnitte er den weichen
          Schatten der Glas-Karte ab. */}
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
            {/* Das Schild ist die zweite, farbunabhängige Kennzeichnung des
                Bereichs — dasselbe Symbol wie am Menüpunkt „Nutzer". */}
            <span
              className={`flex items-center gap-2 ${META_SIZE}`}
              style={{ ...META_BASE, color: "var(--text-label)" }}
            >
              <Icon name="shield" size={15} strokeWidth={2.2} />
              Plattform
            </span>
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
              Diese Seite zählt über alle Gyms hinweg. Was hier steht, sieht
              niemand sonst — in einer Gym-Oberfläche kommen diese Zahlen
              bewusst nicht vor.
            </p>
          </div>

          {/* Die eine Zahl, die beim Öffnen zählt — an derselben Stelle, an
              der die Trainer-Übersicht den nächsten Wettkampf und die
              Verwaltung die offenen Einladungen zeigt. */}
          <div className="lg:w-[380px] lg:shrink-0">
            <div
              className="t-glass flex flex-col gap-2.5 p-4"
              style={{ borderRadius: "var(--r-xl)" }}
            >
              <span className="t-label">KI-Guthaben</span>
              {ai === null ? (
                aiFailed ? (
                  <span
                    style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                  >
                    Der Verbrauch konnte gerade nicht geladen werden — versuch
                    es gleich noch einmal.
                  </span>
                ) : (
                  <Skeleton className="h-20 w-full" />
                )
              ) : (
                <>
                  <div className="flex items-baseline gap-2">
                    <span
                      style={{
                        font: "var(--type-num-xl)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {eur(budget!.remaining)}
                    </span>
                    <span
                      style={{
                        font: "var(--type-h3)",
                        color: "var(--text-2)",
                      }}
                    >
                      übrig
                    </span>
                  </div>
                  <div className="t-progress" aria-hidden>
                    <span style={{ width: `${budget!.fraction * 100}%` }} />
                  </div>
                  <span
                    style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                  >
                    {eur(ai.spentEur)} von {eur(ai.budgetEur)} verbraucht, in{" "}
                    {ai.analysisCount}{" "}
                    {ai.analysisCount === 1 ? "Analyse" : "Analysen"}.
                  </span>
                  {budget!.low && (
                    <span
                      className="flex items-center gap-1.5"
                      style={{
                        font: "var(--type-sub)",
                        color: "var(--warning)",
                      }}
                    >
                      <Icon name="warn" size={14} strokeWidth={2} />
                      Das Guthaben reicht nicht mehr lange — Anthropic-Konto
                      aufladen, sonst laufen Analysen über den Gratis-Fallback.
                    </span>
                  )}
                </>
              )}
            </div>
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
            Links die große Karte in der Bereichsfarbe — dasselbe Vokabular
            wie die Primär-Knöpfe (--accent + --on-accent + --accent-glow) und
            wie die Athleten-Karte des Trainers. Unter `data-area="admin"` ist
            das Karmin, ohne dass diese Datei eine Farbe kennt.

            SIE ZÄHLT KONTEN, NICHT MITGLIEDER. Die Verwaltung zählt „unser
            Gym", der Trainer „meine Athleten" — die Plattform zählt Menschen
            mit einem Konto, unabhängig davon, ob sie gerade zu einem Gym
            gehören. Deshalb sagt der Satz darunter, wie viele davon Demo
            sind: Ohne ihn wäre die größte Zahl der Seite die unehrlichste. */}
        <div className="grid gap-3 lg:col-span-2 lg:grid-cols-2">
          <Link data-press="surface"
            href="/admin/users"
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
                color:
                  "color-mix(in oklab, var(--on-accent) 85%, var(--accent))",
              }}
            >
              Konten plattformweit
            </span>
            <span className="relative flex flex-col gap-3">
              {userCount === null ? (
                <Skeleton className="h-16 w-24" />
              ) : (
                <span
                  style={{
                    font: "800 clamp(48px, 9vw, 64px)/1 var(--font-archivo), system-ui, sans-serif",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {userCount}
                </span>
              )}
              <span
                style={{
                  font: "var(--type-sub)",
                  color:
                    "color-mix(in oklab, var(--on-accent) 85%, var(--accent))",
                }}
              >
                So viele Profile liegen in der Datenbank — über alle Gyms
                hinweg.{" "}
                {demoCount === null
                  ? ""
                  : demoCount === 0
                    ? "Alle davon gehören echten Menschen."
                    : `${demoCount} davon sind Demo-Daten und zählen in jeder Zahl dieser Seite mit.`}
              </span>
            </span>
          </Link>

          <div className="grid grid-cols-2 gap-3">
            <StatTile
              label="Gyms"
              value={gyms === null ? null : gyms.length}
              sub={
                gyms === null
                  ? "einen Moment"
                  : gyms.filter((g) => g.status !== "blocked").length ===
                      gyms.length
                    ? "alle im Betrieb"
                    : `${gyms.filter((g) => g.status === "blocked").length} davon gesperrt`
              }
            />
            {/* KONTEN OHNE GYM — die Kennzahl, die es nur hier geben kann.
                In einer Gym-Oberfläche ist jede Liste nach `gymId` gefiltert;
                wer zu keinem Gym gehört, kommt dort in keiner einzigen Zahl
                vor. Er ist trotzdem da: nach einem Austritt
                (`/api/members/remove` setzt den Claim auf null) oder nach
                einer Registrierung ohne Einladung. */}
            <StatTile
              label="Ohne Gym"
              value={perGym === null ? null : perGym.orphans}
              sub="gehören zu keinem Gym"
              href="/admin/users"
            />
          </div>

          {/* Die Rechte-Verteilung steht im Bento, weil ihre Höhe feststeht:
              vier Zeilen, immer. Die große Karte daneben ist `row-span-2` und
              wird so hoch wie diese Spalte — was neben eine solche Karte
              kommt, muss vorhersehbar hoch sein (im Verwaltungs-Dashboard
              nachgemessen: eine Karte mit schwankender Höhe ließ dort 330 px
              Leere entstehen). */}
          <div
            className="t-card flex flex-col gap-3 p-4 lg:p-5"
            style={{ borderRadius: "var(--r-xl)" }}
          >
            <div className="flex items-center justify-between gap-3">
              <span
                className={META_SIZE}
                style={{ ...META_BASE, color: "var(--text-label)" }}
              >
                Rechte plattformweit
              </span>
              <Link data-press
                href="/admin/users"
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
            {distribution === null ? (
              <div className="flex flex-col gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : (
              <>
                <RightsRow
                  label="Plattform"
                  count={distribution.admin}
                  max={maxGroup}
                />
                <RightsRow
                  label="Verwaltung"
                  count={distribution.verwaltung}
                  max={maxGroup}
                />
                <RightsRow
                  label="Trainer"
                  count={distribution.trainer}
                  max={maxGroup}
                />
                <RightsRow
                  label="Athleten"
                  count={distribution.athlet}
                  max={maxGroup}
                />
                <p
                  style={{
                    font: "var(--type-sub)",
                    color: "var(--text-3)",
                    borderTop: "1px solid var(--line)",
                    paddingTop: "var(--sp-3)",
                  }}
                >
                  Der Plattform-Rang sieht und verwaltet alle Gyms; die
                  Verwaltung führt ihr eigenes, Trainer arbeiten darin,
                  Athleten trainieren mit. Jedes Konto steht in genau einer
                  Zeile — das weiteste Recht zählt.
                </p>
              </>
            )}
          </div>
        </div>

        {/* ─── Die Gyms ─────────────────────────────────────────────────────
            Der eigentliche Gegenstand der Plattform. Heute ist es genau eines
            — die Liste steht trotzdem als Liste da, weil das zweite Gym nichts
            an dieser Seite ändern soll. */}
        <section className="flex flex-col gap-2">
          <SectionHead label="Gyms auf der Plattform" />
          <div className="t-card flex flex-col gap-3 p-4">
            {gyms === null ? (
              <div className="flex flex-col gap-3">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : gyms.length === 0 ? (
              <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                Es ist noch kein Gym angelegt.
              </p>
            ) : (
              gyms.map((gym) => {
                const blocked = gym.status === "blocked";
                const members = perGym?.map.get(gym.id) ?? null;
                return (
                  <div
                    key={gym.id}
                    className="flex items-start justify-between gap-3"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span
                        className="truncate"
                        style={{ font: "var(--type-body-strong)" }}
                      >
                        {gym.name}
                      </span>
                      <span
                        style={{
                          font: "var(--type-sub)",
                          color: "var(--text-3)",
                        }}
                      >
                        {members === null
                          ? ""
                          : members === 1
                            ? "1 Konto"
                            : `${members} Konten`}{" "}
                        · angelegt am {dateLabel(gym.createdAt)}
                      </span>
                    </div>
                    {/* Der Zustand steht als WORT da, nicht nur als Farbe —
                        ein Punkt in Grün oder Rot wäre für die Hälfte der
                        Menschen keine Information. */}
                    <span
                      className="shrink-0 rounded-full px-2.5 py-1"
                      style={{
                        ...META_BASE,
                        fontSize: "10px",
                        background: blocked
                          ? "color-mix(in oklab, var(--negative) 16%, transparent)"
                          : "var(--accent-subtle)",
                        color: blocked ? "var(--negative)" : "var(--accent-text)",
                      }}
                    >
                      {blocked ? "Gesperrt" : "Aktiv"}
                    </span>
                  </div>
                );
              })
            )}
            <p
              style={{
                font: "var(--type-sub)",
                color: "var(--text-3)",
                borderTop: "1px solid var(--line)",
                paddingTop: "var(--sp-3)",
              }}
            >
              Ein Gym anzulegen oder zu sperren gehört zur Admin-Konsole aus
              Phase 3. Bis dahin entsteht ein Gym über das Migrations-Script,
              und der Weg hinein führt ausschließlich über eine Einladung.
            </p>
          </div>
        </section>

        {/* ─── KI-Kosten ────────────────────────────────────────────────────
            Die Zahlen aus `aiUsage/summary` — heute EIN Topf für die ganze
            Plattform. Genau deshalb steht die Karte hier und nicht im
            Verwaltungs-Dashboard: Ein Gym könnte aus ihr nichts über den
            eigenen Verbrauch ablesen. */}
        <section className="flex flex-col gap-2">
          <SectionHead label="KI-Kosten" />
          <div className="t-card flex flex-col gap-3 p-4">
            {ai === null ? (
              aiFailed ? (
                <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                  Der Verbrauch konnte gerade nicht geladen werden — versuch es
                  gleich noch einmal.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {[0, 1].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              )
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span
                      className={META_SIZE}
                      style={{ ...META_BASE, color: "var(--text-label)" }}
                    >
                      Je Analyse
                    </span>
                    <span
                      style={{
                        font: "var(--type-num)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {budget!.perAnalysis === null
                        ? "—"
                        : eur(budget!.perAnalysis)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span
                      className={META_SIZE}
                      style={{ ...META_BASE, color: "var(--text-label)" }}
                    >
                      Analysen
                    </span>
                    <span
                      style={{
                        font: "var(--type-num)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {ai.analysisCount}
                    </span>
                  </div>
                </div>
                <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                  {budget!.perAnalysis === null
                    ? "Sobald die erste Analyse durchgelaufen ist, steht hier, was eine kostet."
                    : `Im Schnitt kostet eine Analyse ${eur(budget!.perAnalysis)} — das ist die Zahl, aus der später das Kontingent je Gym gerechnet wird (Konzept §6: Fixbetrag plus Kontingent plus Nachkauf).`}{" "}
                  Heute teilen sich alle Gyms diesen einen Topf; der eigene
                  Kontingent-Stand je Gym kommt mit Phase 3.
                </p>
                <p
                  style={{
                    font: "var(--type-sub)",
                    color: "var(--text-3)",
                    borderTop: "1px solid var(--line)",
                    paddingTop: "var(--sp-3)",
                  }}
                >
                  Geschätzt, nicht abgerechnet: Anthropic bietet keine
                  Saldo-Abfrage — die Summe entsteht aus den Listenpreisen der
                  verbrauchten Token ({ai.inputTokens.toLocaleString("de-DE")}{" "}
                  hinein, {ai.outputTokens.toLocaleString("de-DE")} hinaus).
                </p>
              </>
            )}
          </div>
        </section>

        {/* ─── Demo-Daten ───────────────────────────────────────────────────
            Steht bewusst UNTEN und über die volle Breite: Es ist keine
            Kennzahl über den Betrieb, sondern die Einordnung aller Kennzahlen
            darüber. Solange dreißig von siebenunddreißig Konten erfunden
            sind, ist jede Zahl dieser Seite eine Probe und keine Aussage. */}
        <section className="flex flex-col gap-2 lg:col-span-2">
          <SectionHead
            label="Demo-Daten"
            moreHref="/admin/seed"
            moreLabel="Demo-Daten"
          />
          <div className="t-card flex flex-col gap-3 p-4">
            {demoCount === null || userCount === null ? (
              <Skeleton className="h-16 w-full" />
            ) : demoCount === 0 ? (
              <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                Gerade liegen keine Demo-Daten in der Datenbank — alle{" "}
                {userCount} Konten gehören echten Menschen.
              </p>
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span
                    style={{
                      font: "var(--type-num-xl)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {demoCount}
                  </span>
                  <span
                    style={{ font: "var(--type-h3)", color: "var(--text-2)" }}
                  >
                    von {userCount} Konten sind erfunden
                  </span>
                </div>
                <div className="t-progress" aria-hidden>
                  <span
                    style={{ width: `${(demoCount / userCount) * 100}%` }}
                  />
                </div>
                <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                  Demo-Mitglieder sind reine Profile ohne Anmeldekonto — sie
                  füllen die Übersichten mit Kurs-Abos und Rückmeldungen,
                  damit sich Aussehen und Rechnung beurteilen lassen. Angelegt
                  und entfernt werden sie mit{" "}
                  <span className="font-mono-ta">
                    scripts/seed-demo-gym.mjs
                  </span>{" "}
                  (der Schalter <span className="font-mono-ta">--clear</span>{" "}
                  räumt alle wieder weg). Auf der Seite „Demo-Daten“ füllst du
                  dagegen ein einzelnes echtes Konto mit Trainingsverlauf.
                </p>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

/**
 * Der Guard liegt an der SEITE, nicht im Layout — das Layout muss ein
 * Server-Baustein bleiben (siehe Kopf dieser Datei und app/admin/layout.tsx).
 * Er ist die dritte Schicht hinter `middleware.ts` (404 für alle ohne
 * Plattform-Rang) und den Firestore-Regeln; gebraucht wird er im
 * Fail-Open-Fall der Middleware, wenn Googles Zertifikate nicht erreichbar
 * sind. Dieselbe Anordnung haben /admin/users und /admin/seed.
 */
export default function AdminPage() {
  return (
    <AdminRoute>
      <PlattformDashboard />
    </AdminRoute>
  );
}
