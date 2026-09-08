"use client";

/**
 * DeepFight → Gegner: die Bibliothek des Gyms.
 *
 * TEILSCHRITT 3 DES NEUAUFBAUS (07.09.2026) — die Seite zieht unter die
 * Segmente und bekommt die Form der Werkbank: Leiste (aus dem Layout) →
 * Werkzeugzeile auf Glas → Rost aus Glaskarten. Der Token-Look kam schon mit
 * Rollout-Etappe 3a (04.09.), geändert haben sich drei Dinge:
 *
 * 1. **DER SEITENKOPF IST WEG** (Leons Entscheidung 07.09.). Die Glas-Leiste
 *    des Bereichs sagt bereits „GEGNER"; das `<h1>` darunter wiederholte das
 *    Wort 36 px hoch, und der Beschreibungssatz sagte zum dritten Mal, was
 *    der TrainerHint zwei Zeilen tiefer ausführt. Dazu der eigentliche
 *    Verstoß: Titel und Satz saßen DIREKT auf der bewegten Schicht — im
 *    Bereich sitzt Text immer auf einer Karte. Die Überschrift bleibt für
 *    Screenreader als `sr-only` stehen, damit die Seite ihre Gliederung
 *    behält.
 * 2. **Die Aktionsleiste ist eine Glas-Pille** statt zweier freistehender
 *    Knöpfe — damit steht das erste sichtbare Element der Seite auf Glas.
 * 3. **Jede Karte hat jetzt ZWEI Wege**: die Karte selbst führt aufs Profil,
 *    der Knopf rechts führt in die Werkbank
 *    (`/trainer/deepfight?modus=gegner&ziel=<id>`). Vorher war das Scouten
 *    eines bekannten Gegners ein Umweg über die Detailseite und ihren
 *    Videos-Tab.
 *
 * Zwei Knöpfe in EINER Karte, ohne verschachteltes HTML: Das Klickziel liegt
 * als unsichtbares Geschwister über der Karte (`.t-row-card`/`.t-row-target`
 * in globals.css, Muster aus /verwaltung/einladungen), der Werkbank-Knopf
 * steht darüber und behält seine eigenen Zeiger-Ereignisse.
 *
 * Der Editor liegt in einer eigenen Glas-Karte: `OpponentEditor` ist ein
 * blankes `<form>` ohne Fläche (der Aufrufer platziert es, siehe Etappe 3a) —
 * ohne Karte ständen seine Felder auf der Schicht. Die Datei selbst gehört zu
 * Etappe 3b und bleibt hier unangetastet.
 */

import { Collapse, FlowItem, StaggerFlow } from "@/components/motion";
import TrainerHint from "@/components/TrainerHint";
import DnaCompletenessRing from "@/components/trainer/DnaCompletenessRing";
import OpponentEditor, {
  type OpponentEditorValue,
} from "@/components/trainer/OpponentEditor";
import ErrorState from "@/components/ui/ErrorState";
import GooeySearch from "@/components/ui/GooeySearch";
import Icon from "@/components/ui/Icon";
import Skeleton from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/auth-context";
import { FIGHT_STYLE_LABEL } from "@/lib/fight-camp";
import { answeredCount, DNA_CATEGORIES } from "@/lib/gegner-dna";
import { resolveGymId } from "@/lib/gym";
import {
  createOpponent,
  listOpponentsForGym,
  searchOpponents,
  type Opponent,
} from "@/lib/opponents";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

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

function formatDate(d: Date): string {
  return d.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Bibliothekskarte ────────────────────────────────────────────────────────

function OpponentCard({ opponent }: { opponent: Opponent }) {
  const covered = DNA_CATEGORIES.filter(
    (c) => answeredCount(c, opponent.dna) > 0,
  ).length;

  return (
    <div className="t-card t-row-card relative flex h-full flex-col gap-2.5 p-4">
      {/* Klickziel über der GANZEN Karte — der Alltagsweg führt aufs Profil. */}
      <Link
        href={`/trainer/deepfight/gegner/${opponent.id}`}
        className="t-row-target absolute inset-0 rounded-[var(--r-lg)]"
        aria-label={`DeepFight-Profil von ${opponent.name} öffnen`}
      />

      <div className="pointer-events-none relative flex items-start gap-3">
        <DnaCompletenessRing
          covered={covered}
          total={DNA_CATEGORIES.length}
          size={40}
          stroke={3.5}
        />
        <div className="min-w-0 flex-1">
          {/* KEINE VERSALIEN: Ein Gegnername ist Inhalt, keine Überschrift —
              dieselbe Lehre wie auf der Wettkampfkarte, wo „Night of
              Champions" in Versalien abbrach. */}
          <div className="truncate" style={{ font: "var(--type-h3)" }}>
            {opponent.name}
          </div>
          <div
            className="mt-1 truncate"
            style={{ ...META_FONT, color: "var(--text-3)" }}
          >
            {FIGHT_STYLE_LABEL[opponent.style]} ·{" "}
            {formatDate(opponent.updatedAt)}
          </div>
        </div>
      </div>

      {(opponent.strengths.length > 0 || opponent.weaknesses.length > 0) && (
        <div
          className="pointer-events-none relative flex flex-col gap-0.5"
          style={{ font: "var(--type-sub)" }}
        >
          {/* Semantik statt Marken-Akzenten — dieselbe Zuordnung wie im
              Camp-Plan und im Gegnerbericht: + Stärke, − Schwäche. */}
          {opponent.strengths.length > 0 && (
            <div className="truncate">
              <span style={{ color: "var(--positive)" }}>+ </span>
              <span style={{ color: "var(--text-2)" }}>
                {opponent.strengths.join(", ")}
              </span>
            </div>
          )}
          {opponent.weaknesses.length > 0 && (
            <div className="truncate">
              <span style={{ color: "var(--negative)" }}>− </span>
              <span style={{ color: "var(--text-2)" }}>
                {opponent.weaknesses.join(", ")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Der zweite Weg: direkt an die Werkbank, mit diesem Gegner als Ziel.
          `mt-auto` hält ihn am Fuß, damit er in jeder Karte des Rosters auf
          derselben Höhe steht — auch wenn eine Karte keine Stärken trägt. */}
      <div className="relative mt-auto flex justify-end pt-0.5">
        <Link
          href={`/trainer/deepfight?modus=gegner&ziel=${opponent.id}`}
          data-press
          className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-3"
          style={{
            ...META_FONT,
            color: "var(--accent-text)",
            border: "1px solid color-mix(in oklab, var(--accent) 40%, transparent)",
            textDecoration: "none",
          }}
          aria-label={`${opponent.name} analysieren`}
        >
          <Icon name="spark" size={13} strokeWidth={2.4} />
          Analysieren
        </Link>
      </div>
    </div>
  );
}

// ─── Seite ───────────────────────────────────────────────────────────────────

function OpponentsLibraryContent() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const gymId = resolveGymId(profile);

  const [opponents, setOpponents] = useState<Opponent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Deep-Link "?new=1" (z. B. vom Dashboard) öffnet den Editor direkt.
  const [showNewOpponent, setShowNewOpponent] = useState(
    searchParams.get("new") === "1",
  );
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setOpponents(null);
    try {
      setOpponents(await listOpponentsForGym(gymId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setOpponents([]);
    }
  }, [gymId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () => searchOpponents(opponents ?? [], search),
    [opponents, search],
  );

  async function handleCreateOpponent(value: OpponentEditorValue) {
    if (!user) return;
    setCreating(true);
    try {
      const created = await createOpponent({
        gymId,
        createdBy: user.uid,
        createdByName:
          profile?.displayName ??
          profile?.authProviderName ??
          profile?.email ??
          null,
        ...value,
      });
      router.push(`/trainer/deepfight/gegner/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anlegen fehlgeschlagen");
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen pb-12" style={{ color: "var(--text-body)" }}>
      {/* Sichtbar sagt die Glas-Leiste des Layouts, wo man steht — die
          Überschrift steht hier für Screenreader und Suchmaschinen. */}
      <h1 className="sr-only">DeepFight — Gegner</h1>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 pt-4 sm:px-6">
        <TrainerHint id="opponents-library" title="DeepFight-Bibliothek">
          Jedes Profil ist die lebende Analyse eines Gegners: Muster, Waffen,
          Schwächen, Gameplan. Alle Trainer deines Gyms arbeiten an denselben
          Profilen. Der Ring zeigt, wie viele der {DNA_CATEGORIES.length}{" "}
          Kategorien schon gescoutet sind. Wettkämpfe frieren beim Anlegen den
          damaligen Stand ein.
        </TrainerHint>

        {error && (
          <ErrorState
            title="Daten konnten nicht geladen werden"
            message={error}
            onRetry={load}
          />
        )}

        {/* Werkzeugzeile — Knopf, Suche und Zähler in EINER Glas-Pille. Sie
            ersetzt den alten Seitenkopf als erstes Element der Seite.

            DER RADIUS WECHSELT MIT DER BREITE: Auf 390 px passen Knopf und
            Suchpille nicht nebeneinander, die Zeile bricht um — und eine
            zweizeilige Pille ist keine Pille mehr, sondern ein Stadion mit
            Inhalt darin. Ab sm steht alles in einer Reihe und die Pillenform
            nimmt die Form der Segment-Leiste darüber auf. */}
        <div className="t-card flex flex-wrap items-center gap-2.5 rounded-card px-3 py-2 sm:rounded-pill sm:px-4">
          <button
            type="button"
            onClick={() => setShowNewOpponent((v) => !v)}
            aria-expanded={showNewOpponent}
            className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-5"
            style={{
              ...BTN_FONT,
              background: "var(--accent)",
              color: "var(--on-accent)",
              boxShadow: "var(--accent-glow)",
            }}
          >
            <Icon
              name={showNewOpponent ? "x" : "plus"}
              size={13}
              strokeWidth={2.4}
            />
            {showNewOpponent ? "Schließen" : "Neues DeepFight-Profil"}
          </button>
          <GooeySearch
            value={search}
            onChange={setSearch}
            label="Suchen"
            placeholder="Gegner suchen…"
          />
          {opponents !== null && opponents.length > 0 && (
            <span
              className="ml-auto hidden pr-1 sm:inline"
              style={{ ...META_FONT, color: "var(--text-3)" }}
            >
              {filtered.length}{" "}
              {filtered.length === 1 ? "Profil" : "Profile"}
            </span>
          )}
        </div>

        {/* Inline-Editor: neue Gegner-DNA. Das Formular selbst bringt keine
            Fläche mit — hier bekommt es seine Glas-Karte. */}
        <Collapse open={showNewOpponent}>
          <div className="t-card p-4 sm:p-5">
            <h2
              className="mb-4"
              style={{
                font: "var(--type-h2)",
                letterSpacing: "var(--ls-display)",
                textTransform: "uppercase",
              }}
            >
              Neues DeepFight-Profil
            </h2>
            <OpponentEditor
              busy={creating}
              submitLabel="DeepFight-Profil anlegen"
              onSubmit={handleCreateOpponent}
              onCancel={() => setShowNewOpponent(false)}
            />
          </div>
        </Collapse>

        {/* Bibliothek */}
        {opponents === null ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-36 w-full rounded-card" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="t-card p-10 text-center">
            <p style={{ font: "var(--type-body-strong)" }}>
              {search
                ? "Kein DeepFight-Profil gefunden."
                : "Noch kein DeepFight-Profil angelegt."}
            </p>
            <p
              className="mt-1"
              style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
            >
              {search
                ? "Such nach einem anderen Namen oder leer die Suche."
                : "Leg ein erstes Gegnerprofil an — dein ganzes Trainerteam arbeitet damit."}
            </p>
          </div>
        ) : (
          // Die Bibliothek filtert live nach Suchbegriff — die Karten sollen
          // dabei zu ihrer neuen Rasterposition rutschen statt zu springen.
          // Schlüssel ist die Firestore-ID, nie der Index (MOTION-BRIEF §3.7).
          <StaggerFlow className="grid items-stretch gap-3 pb-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((o, i) => (
              <FlowItem key={o.id} index={i} className="h-full">
                <OpponentCard opponent={o} />
              </FlowItem>
            ))}
          </StaggerFlow>
        )}
      </div>
    </main>
  );
}

export default function OpponentsLibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
          <Skeleton className="h-16 w-full rounded-pill" />
        </div>
      }
    >
      <OpponentsLibraryContent />
    </Suspense>
  );
}
