"use client";

/**
 * Meine Bibliothek — persönlich gespeicherte Techniken
 * (Redesign-Etappe 5, Rollout im Muster der Referenzseiten):
 *  - Kopf mit Ambient, „← Techniken"-Rücksprung, Athleten-Shell (Tab-Bar,
 *    Training aktiv); Trainer behalten die Navbar
 *  - Liste als EINE Karte mit Haarlinien-Trennern (Token-Regel), Zeilen
 *    verlinken auf die Technik-Seite; Links-Wisch = entfernen mit
 *    Raus-Animation (SwipeAction, Muster „Meine Workouts"), Desktop-x ab sm
 *  - „Techniken durchsuchen" als Popup-Sheet (Muster Übungs-Picker):
 *    ui/Select-Filter, Rechts-Wisch oder +-Knopf = speichern mit
 *    Grün-Feedback (+1)
 *  - Rubrik-Farbe nur aus lib/discipline-colors.ts (Farbpunkt), Level
 *    NIE farbcodiert — nur Text (Regel Rubrik-Farben/Slot-System)
 */

import GooeySearch from "@/components/ui/GooeySearch";
import AthleteTabBar from "@/components/AthleteTabBar";
import ProtectedRoute from "@/components/ProtectedRoute";
import SwipeAction from "@/components/SwipeAction";
import { SheetShell } from "@/components/motion";
import Icon from "@/components/ui/Icon";
import Select from "@/components/ui/Select";
import { useAuth, useHasStaffShell } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import {
  addTechniqueToLibrary,
  getLibrary,
  removeFromLibrary,
} from "@/lib/training-sessions";
import { ALL_TECHNIQUES, getTechniqueById } from "@/lib/techniques";
import { CATEGORY_COLOR } from "@/lib/discipline-colors";
import {
  TECHNIQUE_LEVEL_LABEL,
  type Category,
  type LibraryEntry,
  type Technique,
} from "@/lib/types";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Hilfskonstanten ──────────────────────────────────────────────────────────

// Kurze Rubrik-Labels für Meta-Zeilen und Filter (CATEGORY_LABEL wäre mit
// „Brazilian Jiu-Jitsu" zu lang); Farben zentral aus lib/discipline-colors.ts.
const CATEGORY_STYLE: Record<string, { label: string; color: string }> = {
  boxing: { label: "Boxing", color: CATEGORY_COLOR.boxing },
  wrestling: { label: "Ringen", color: CATEGORY_COLOR.wrestling },
  bjj: { label: "BJJ", color: CATEGORY_COLOR.bjj },
  "muay-thai": { label: "Muay Thai", color: CATEGORY_COLOR["muay-thai"] },
};

const ALL_FILTER_CATS: Array<Category | "all"> = [
  "all",
  "boxing",
  "wrestling",
  "bjj",
  "muay-thai",
];

const FILTER_LABEL: Record<string, string> = {
  all: "Alle",
  boxing: "Boxing",
  wrestling: "Ringen",
  bjj: "BJJ",
  "muay-thai": "Muay Thai",
};

const BROWSE_DISCIPLINES = [
  { value: "all", label: "Alle Disziplinen" },
  { value: "boxing", label: "Boxing" },
  { value: "kickboxen", label: "Kickboxen" },
  { value: "muay-thai", label: "Muay Thai" },
  { value: "wrestling", label: "Wrestling" },
  { value: "bjj", label: "BJJ" },
  { value: "mma", label: "MMA" },
];

// ─── Typo-Konstanten (Muster der Referenzseiten) ──────────────────────────────

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

// ─── Typen ────────────────────────────────────────────────────────────────────

interface EnrichedEntry extends LibraryEntry {
  technique: Technique | undefined;
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export default function LibraryPage() {
  return (
    <ProtectedRoute>
      <LibraryContent />
    </ProtectedRoute>
  );
}

function LibraryContent() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  // Wer eines der drei Häkchen trägt, steht in der Stab-Hülle: Die bringt
  // Menü und Bottom-Bar selbst mit, der Hell/Dunkel-Umschalter sitzt in ihrer
  // Fußgruppe. Diese Seite lässt ihre eigenen Entsprechungen dann weg.
  const hasStaffShell = useHasStaffShell();

  const [entries, setEntries] = useState<EnrichedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<Category | "all">("all");
  const [showBrowse, setShowBrowse] = useState(false);
  const [browseSearch, setBrowseSearch] = useState("");
  const [browseDiscipline, setBrowseDiscipline] = useState<string>("all");
  const [addingId, setAddingId] = useState<string | null>(null);
  // Links-Wisch: Zeile fliegt mit Raus-Animation, dann wird sie entfernt
  // (Muster handleRemovePlan im Hub)
  const [removingId, setRemovingId] = useState<string | null>(null);
  const removeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Grün-Feedback beim Speichern (Muster Übungs-Picker): Rahmen leuchtet,
  // „+1" steigt auf; tick remountet die Animation bei schnellen Folgen.
  const [flash, setFlash] = useState<{ id: string; tick: number } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (removeTimer.current) clearTimeout(removeTimer.current);
    },
    [],
  );

  const loadLibrary = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const raw = await getLibrary(user.uid);
      setEntries(
        raw.map((e) => ({
          ...e,
          technique: getTechniqueById(e.exerciseId),
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  async function handleManualAdd(techniqueId: string) {
    if (!user || addingId) return;
    setAddingId(techniqueId);
    setFlash((f) => ({ id: techniqueId, tick: (f?.tick ?? 0) + 1 }));
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 800);
    try {
      await addTechniqueToLibrary(user.uid, techniqueId, "manual");
      await loadLibrary();
    } finally {
      setAddingId(null);
    }
  }

  function handleRemove(exerciseId: string) {
    if (!user || removingId) return;
    setRemovingId(exerciseId);
    removeTimer.current = setTimeout(() => {
      setRemovingId(null);
      setEntries((prev) => prev.filter((e) => e.exerciseId !== exerciseId));
      removeFromLibrary(user.uid, exerciseId).catch(() => {
        // Fehlgeschlagen — Liste neu laden, damit der Eintrag wieder auftaucht
        void loadLibrary();
      });
    }, 220);
  }

  const savedIds = new Set(entries.map((e) => e.exerciseId));

  const filtered = entries.filter((e) => {
    if (filterCat === "all") return true;
    const cat = e.technique?.category;
    if (!cat) return false;
    return cat === filterCat;
  });

  const recent = entries.slice(0, 3);

  // Browse-Liste: alle Techniken gefiltert nach Disziplin + Suche
  const browseList = ALL_TECHNIQUES.filter((t) => {
    if (
      browseSearch &&
      !t.name.toLowerCase().includes(browseSearch.toLowerCase())
    )
      return false;
    if (browseDiscipline !== "all") {
      const matchesDiscipline =
        t.disciplines?.includes(browseDiscipline as never) ??
        t.category === browseDiscipline;
      if (!matchesDiscipline) return false;
    }
    return true;
  });

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <main
      className={hasStaffShell ? "min-h-screen pb-12" : "min-h-screen pb-32"}
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      {/* ── Kopf — Muster der Referenzseiten ── */}
      <section className="relative">
        <div
          className="absolute inset-0 overflow-hidden"
          aria-hidden
          style={{
            maskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
          }}
        >
          <div data-ambient style={{ background: "var(--ambient)" }} />
        </div>
        <div className="relative mx-auto flex w-full max-w-2xl items-start gap-3 px-4 pb-5 pt-4 lg:px-6 lg:pb-7 lg:pt-6">
          <div className="flex flex-1 flex-col gap-1">
            <Link
              href="/techniques"
              className="t-interactive -ml-2 mb-1 inline-flex min-h-hit items-center gap-1.5 self-start rounded-field px-2"
              style={{ ...BTN_FONT, color: "var(--text-3)", textDecoration: "none" }}
            >
              <Icon name="arrow-left" size={14} strokeWidth={2.2} />
              Techniken
            </Link>
            <h1
              style={{
                font: "var(--type-display)",
                letterSpacing: "var(--ls-display)",
                textTransform: "uppercase",
              }}
            >
              Meine Bibliothek
            </h1>
            <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              {loading
                ? "Lade…"
                : entries.length === 0
                  ? "Noch keine Techniken gespeichert"
                  : `${entries.length} Technik${entries.length !== 1 ? "en" : ""} gespeichert`}
            </p>
          </div>
          {!hasStaffShell && (
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? "Helles Design aktivieren"
                  : "Dunkles Design aktivieren"
              }
              className="t-glass t-interactive inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-field lg:hidden"
              style={{ color: "var(--text-2)" }}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} size={20} />
            </button>
          )}
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-4 lg:px-6 lg:pt-5">
        {/* ── Techniken durchsuchen — gerahmtes Feld öffnet das Sheet
            (Muster „Meine Workouts"-Feld im Hub) ── */}
        <button
          type="button"
          onClick={() => {
            setShowBrowse(true);
            setBrowseSearch("");
            setBrowseDiscipline("all");
          }}
          className="t-card t-interactive flex w-full items-center gap-4 p-4 text-left sm:p-5"
          style={{
            border: "1px solid color-mix(in oklab, var(--accent) 60%, transparent)",
          }}
        >
          <span
            aria-hidden
            className="shrink-0"
            style={{ color: "var(--accent-text)", lineHeight: 0 }}
          >
            <Icon name="plus" size={22} strokeWidth={2.2} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <h2
              style={{
                font: "var(--type-h2)",
                letterSpacing: "var(--ls-display)",
                textTransform: "uppercase",
              }}
            >
              Techniken durchsuchen
            </h2>
            <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              Aus der gesamten Technik-Datenbank speichern
            </p>
          </div>
          <span
            aria-hidden
            className="shrink-0"
            style={{ color: "var(--accent-text)", lineHeight: 0 }}
          >
            <Icon name="arrow-right" size={18} strokeWidth={2} />
          </span>
        </button>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-16 animate-pulse rounded-card"
                style={{ background: "var(--surface-raised)" }}
              />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* ── Zuletzt hinzugefügt ── */}
            {recent.length > 0 && (
              <section className="flex flex-col gap-2">
                <span className="t-label">Zuletzt hinzugefügt</span>
                <EntryList
                  entries={recent}
                  removingId={removingId}
                  onRemove={handleRemove}
                />
              </section>
            )}

            {/* ── Alle Techniken mit Rubrik-Filter ── */}
            <section className="flex flex-col gap-2">
              <span className="t-label">Alle Techniken</span>
              <div className="flex flex-wrap gap-2">
                {ALL_FILTER_CATS.map((cat) => {
                  const active = filterCat === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFilterCat(cat)}
                      aria-pressed={active}
                      className="t-interactive min-h-hit whitespace-nowrap rounded-field px-4"
                      style={{
                        ...BTN_FONT,
                        background: active
                          ? "var(--accent-subtle)"
                          : "var(--surface-raised)",
                        border: "1px solid",
                        borderColor: active ? "var(--accent)" : "var(--line)",
                        color: active ? "var(--accent-text)" : "var(--text-2)",
                      }}
                    >
                      {FILTER_LABEL[cat]}
                    </button>
                  );
                })}
              </div>

              {filtered.length === 0 ? (
                <p
                  className="py-4"
                  style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                >
                  Keine Techniken in dieser Rubrik.
                </p>
              ) : (
                <EntryList
                  entries={filtered}
                  removingId={removingId}
                  onRemove={handleRemove}
                />
              )}
            </section>

            {/* ── Tipp ── */}
            <div className="flex flex-col gap-1">
              <span className="t-label">Tipp</span>
              <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                Klicke im{" "}
                <Link
                  href="/schedule"
                  style={{ color: "var(--accent-text)", fontWeight: 600 }}
                >
                  Kursplan
                </Link>{" "}
                auf einen Kurs und tipp auf „Ich nehme teil“ — die Techniken
                der Einheit landen dann automatisch hier.
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Sheet „Techniken durchsuchen" (Muster Übungs-Picker) ── */}
      <SheetShell
        open={showBrowse}
        onClose={() => setShowBrowse(false)}
        label="Techniken durchsuchen"
        panelClassName="pointer-events-auto relative flex w-full max-h-[80vh] flex-col overflow-hidden rounded-t-[var(--r-xl)] sm:max-w-xl sm:rounded-[var(--r-xl)]"
        panelStyle={{
          maxHeight: "80dvh",
          background: "var(--surface-card)",
          boxShadow: "var(--glass-shadow)",
        }}
      >
              <div className="flex items-center justify-between gap-3 px-5 pt-3">
                <div className="flex min-w-0 flex-col items-start">
                  <div
                    aria-hidden
                    className="mb-2 h-1 w-10 rounded-full sm:invisible"
                    style={{ background: "var(--line-strong)" }}
                  />
                  <span className="t-label">Techniken durchsuchen</span>
                  <span style={{ ...META_FONT, color: "var(--text-3)" }}>
                    {savedIds.size}{" "}
                    {savedIds.size === 1 ? "Technik" : "Techniken"} gespeichert
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBrowse(false)}
                  aria-label="Fertig"
                  className="t-interactive inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-field"
                  style={{ color: "var(--text-3)" }}
                >
                  <Icon name="x" size={16} strokeWidth={2.2} />
                </button>
              </div>

              {/* Filter + Suche */}
              <div className="flex flex-col gap-2 px-4 pt-3">
                <Select
                  value={browseDiscipline}
                  onChange={(v) => setBrowseDiscipline(v)}
                  options={BROWSE_DISCIPLINES}
                />
                <GooeySearch
                  value={browseSearch}
                  onChange={setBrowseSearch}
                  placeholder="Technik suchen…"
                />
              </div>

              <div
                className="overflow-y-auto px-3 pt-2"
                style={{
                  paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
                }}
              >
                {browseList.slice(0, 80).map((t) => {
                  const alreadySaved = savedIds.has(t.id);
                  const catStyle = CATEGORY_STYLE[t.category] ?? null;
                  const flashTick =
                    flash && flash.id === t.id ? flash.tick : null;
                  return (
                    // Rechts wischen = speichern (grüner Balken mit +);
                    // gezielter Desktop-/Fallback-Weg ist der +-Knopf rechts
                    <SwipeAction
                      key={t.id}
                      right={
                        alreadySaved
                          ? undefined
                          : {
                              color: "var(--gesture-add)",
                              icon: "plus",
                              onTrigger: () => void handleManualAdd(t.id),
                            }
                      }
                    >
                      <div
                        key={flashTick ?? undefined}
                        className={`relative flex min-h-hit w-full items-center gap-3 rounded-field px-2.5 py-2${flashTick !== null ? " animate-add-glow" : ""}`}
                        style={{ color: "var(--text-body)" }}
                      >
                        <div
                          aria-hidden
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: catStyle?.color ?? "var(--text-3)" }}
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span
                            className="truncate"
                            style={{ font: "var(--type-body-strong)" }}
                          >
                            {t.name}
                          </span>
                          <span style={{ ...META_FONT, color: "var(--text-3)" }}>
                            {catStyle && (
                              <span style={{ color: catStyle.color }}>
                                {catStyle.label}
                              </span>
                            )}
                            {t.level &&
                              ` · ${TECHNIQUE_LEVEL_LABEL[t.level] ?? t.level}`}
                          </span>
                        </div>
                        {alreadySaved ? (
                          <span
                            className="inline-flex shrink-0 items-center gap-1.5 pr-2"
                            style={{ ...META_FONT, color: "var(--accent-text)" }}
                          >
                            <Icon name="check" size={13} strokeWidth={2.6} />
                            Gespeichert
                          </span>
                        ) : (
                          <button
                            type="button"
                            aria-label={`${t.name} speichern`}
                            onClick={() => void handleManualAdd(t.id)}
                            disabled={addingId === t.id}
                            className="t-interactive flex h-10 w-10 shrink-0 items-center justify-center rounded-field disabled:opacity-40"
                            style={{ color: "var(--accent-text)" }}
                          >
                            <Icon name="plus" size={16} strokeWidth={2.2} />
                          </button>
                        )}
                        {/* „+1" poppt groß auf und zieht nach oben weg */}
                        {flashTick !== null && (
                          <span
                            aria-hidden
                            className="animate-plus-one pointer-events-none absolute right-12 top-0 z-10"
                            style={{
                              font: "800 28px/1 var(--font-archivo), system-ui, sans-serif",
                              color: "var(--gesture-add)",
                            }}
                          >
                            +1
                          </span>
                        )}
                      </div>
                    </SwipeAction>
                  );
                })}
                {browseList.length === 0 && (
                  <p
                    className="px-2.5 py-8 text-center"
                    style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                  >
                    Keine Technik passt zu diesen Filtern.
                  </p>
                )}
                {browseList.length > 80 && (
                  <p
                    className="pt-2 text-center"
                    style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                  >
                    + {browseList.length - 80} weitere — Suche verfeinern
                  </p>
                )}
              </div>
      </SheetShell>

      {!hasStaffShell && <AthleteTabBar />}
    </main>
  );
}

// ─── Eintragsliste — EINE Karte mit Haarlinien-Trennern ──────────────────────

function EntryList({
  entries,
  removingId,
  onRemove,
}: {
  entries: EnrichedEntry[];
  removingId: string | null;
  onRemove: (exerciseId: string) => void;
}) {
  return (
    <div className="t-card px-2 py-0.5">
      {entries.map((entry, i) => (
        <div key={entry.exerciseId}>
          {/* Trennlinie als eigenes Element — border-top auf der gerundeten
              Zeile würde die Linienenden mitrunden */}
          {i > 0 && (
            <div aria-hidden style={{ height: "1px", background: "var(--line)" }} />
          )}
          <LibraryRow
            entry={entry}
            removing={removingId === entry.exerciseId}
            onRemove={() => onRemove(entry.exerciseId)}
          />
        </div>
      ))}
    </div>
  );
}

function LibraryRow({
  entry,
  removing,
  onRemove,
}: {
  entry: EnrichedEntry;
  removing: boolean;
  onRemove: () => void;
}) {
  const t = entry.technique;
  const catStyle = t ? CATEGORY_STYLE[t.category] ?? null : null;
  const dateStr = entry.addedAt.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
  });

  const inner = (
    <>
      <div
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: catStyle?.color ?? "var(--text-3)" }}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate" style={{ font: "var(--type-body-strong)" }}>
          {t?.name ?? entry.exerciseId}
        </span>
        <span
          className="truncate"
          style={{ ...META_FONT, color: "var(--text-3)" }}
        >
          {catStyle && (
            <span style={{ color: catStyle.color }}>{catStyle.label}</span>
          )}
          {t?.level && ` · ${TECHNIQUE_LEVEL_LABEL[t.level] ?? t.level}`}
          {" · "}
          {entry.source === "training"
            ? `Training: ${entry.contextLabel ?? "Kurs"}`
            : "Manuell gemerkt"}
          {" · "}
          {dateStr}
        </span>
      </div>
      <button
        type="button"
        aria-label={`„${t?.name ?? entry.exerciseId}" entfernen`}
        onClick={(e) => {
          // nicht zusätzlich zur Technik-Seite navigieren
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }}
        className="t-interactive hidden h-9 w-9 shrink-0 items-center justify-center rounded-field sm:flex"
        style={{ color: "var(--gesture-delete)" }}
      >
        <Icon name="x" size={15} strokeWidth={2.2} />
      </button>
      {t && (
        <span
          aria-hidden
          className="shrink-0"
          style={{ color: "var(--text-3)", lineHeight: 0 }}
        >
          <Icon name="arrow-right" size={16} strokeWidth={2} />
        </span>
      )}
    </>
  );

  const rowClass = `t-interactive flex min-h-hit w-full items-center gap-3 rounded-badge px-1.5 py-2${
    removing ? " animate-remove-row" : ""
  }`;

  return (
    // Links wischen = entfernen (Lösch-Optik, Muster „Meine Workouts")
    <SwipeAction
      left={{
        color: "var(--gesture-delete)",
        icon: "x",
        onTrigger: onRemove,
      }}
      disabled={removing}
    >
      {t ? (
        <Link
          href={`/techniques/${t.id}`}
          className={rowClass}
          style={{ color: "var(--text-body)", textDecoration: "none" }}
        >
          {inner}
        </Link>
      ) : (
        <div className={rowClass} style={{ color: "var(--text-body)" }}>
          {inner}
        </div>
      )}
    </SwipeAction>
  );
}

// ─── Leerzustand ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-card"
        style={{ background: "var(--accent-subtle)", color: "var(--accent-text)" }}
      >
        <Icon name="book" size={30} />
      </div>
      <div className="flex flex-col gap-1">
        <h2
          style={{
            font: "var(--type-h2)",
            letterSpacing: "var(--ls-display)",
            textTransform: "uppercase",
          }}
        >
          Bibliothek leer
        </h2>
        <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
          Geh zu einem Kurs im Kursplan oder speichere Techniken über
          „Techniken durchsuchen“.
        </p>
      </div>
      <Link
        href="/schedule"
        className="t-interactive inline-flex min-h-hit items-center justify-center gap-2 rounded-field px-5"
        style={{
          ...BTN_FONT,
          background: "var(--accent)",
          color: "var(--on-accent)",
          boxShadow: "var(--accent-glow)",
          textDecoration: "none",
        }}
      >
        Zum Kursplan
      </Link>
    </div>
  );
}
