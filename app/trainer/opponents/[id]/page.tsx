"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import OpponentProfileView from "@/components/trainer/OpponentProfileView";
import OpponentEditor, {
  type OpponentEditorValue,
} from "@/components/trainer/OpponentEditor";
import VideoAnalysisSection from "@/components/trainer/VideoAnalysisSection";
import DnaCompletenessRing from "@/components/trainer/DnaCompletenessRing";
import Icon, { type IconName } from "@/components/ui/Icon";
import { useAuth } from "@/lib/auth-context";
import {
  deleteOpponent,
  getOpponent,
  updateOpponent,
  updateOpponentSharing,
  type Opponent,
} from "@/lib/opponents";
import { listAllStudents, type StudentEntry } from "@/lib/admin";
import { DNA_CATEGORIES, answeredCount, totalAnswered } from "@/lib/gegner-dna";
import { FIGHT_STYLE_LABEL } from "@/lib/fight-camp";

type DetailTab = "uebersicht" | "dna" | "stats" | "videos";

const DETAIL_TABS: [DetailTab, string, IconName | null][] = [
  ["uebersicht", "Übersicht", null],
  ["dna", "DeepFight", "shield"],
  ["stats", "Stats", "chart"],
  ["videos", "Videos", "video"],
];

// ─── Auf einen Blick: Stärken / Schwächen / Lieblingsangriffe als Chips ──────

function ChipRow({
  label,
  color,
  items,
}: {
  label: string;
  color: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className="font-mono-ta w-24 shrink-0 text-[10px] font-bold uppercase"
        style={{ letterSpacing: "0.14em", color: "var(--fg-4)" }}
      >
        {label}
      </span>
      {items.map((item) => (
        <span
          key={item}
          className="rounded-lg px-2 py-0.5 text-[11px] font-semibold"
          style={{
            background: "var(--ink-4)",
            border: `1px solid ${color}`,
            color,
          }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function GlanceCard({ opponent }: { opponent: Opponent }) {
  const strengths = opponent.strengths ?? [];
  const weaknesses = opponent.weaknesses ?? [];
  const favorites = opponent.favoriteAttacks ?? [];
  if (
    strengths.length === 0 &&
    weaknesses.length === 0 &&
    favorites.length === 0 &&
    !opponent.notes
  )
    return null;

  return (
    <div>
      <div
        className="font-mono-ta mb-3 text-[10px] font-bold uppercase"
        style={{ letterSpacing: "0.2em", color: "var(--ta-pink)" }}
      >
        Auf einen Blick
      </div>
      <div className="flex flex-col gap-2">
        <ChipRow label="Stärken" color="var(--ta-cyan)" items={strengths} />
        <ChipRow label="Schwächen" color="var(--ta-pink)" items={weaknesses} />
        <ChipRow label="Waffen" color="#9D7BFA" items={favorites} />
      </div>
      {opponent.notes && (
        <p
          className="mt-3 italic"
          style={{ color: "var(--fg-3)", fontSize: "12px" }}
        >
          &bdquo;{opponent.notes}&ldquo;
        </p>
      )}
    </div>
  );
}

// ─── Schüler-Freigabe: Profil read-only für ausgewählte Schüler sichtbar ────

function studentLabel(s: StudentEntry): string {
  return s.displayName ?? s.authProviderName ?? s.email ?? s.uid;
}

function SharePanel({
  opponent,
  onSaved,
  onClose,
}: {
  opponent: Opponent;
  onSaved: () => Promise<void> | void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentEntry[] | null>(null);
  const [draft, setDraft] = useState<Set<string>>(
    () => new Set(opponent.sharedWith),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAllStudents()
      .then(setStudents)
      .catch(() => setError("Schülerliste konnte nicht geladen werden"));
  }, []);

  function toggle(uid: string) {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await updateOpponentSharing(
        opponent.id,
        Array.from(draft),
        user?.uid ?? null,
      );
      await onSaved();
      onClose();
    } catch {
      setError("Freigabe konnte nicht gespeichert werden");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="mb-4 rounded-2xl p-4"
      style={{
        background:
          "radial-gradient(400px 200px at 0% 0%, rgba(35,196,206,0.08), transparent 60%), var(--ink-2)",
        border: "1px solid rgba(35,196,206,0.35)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div
            className="font-mono-ta text-[10px] font-bold uppercase"
            style={{ letterSpacing: "0.2em", color: "var(--ta-cyan)" }}
          >
            Für Schüler freigeben
          </div>
          <p className="mt-1 text-[11px]" style={{ color: "var(--fg-4)" }}>
            Freigegebene Schüler sehen dieses Gegnerprofil read-only in ihrem
            Bereich „Mein DeepFight" — z. B. zur Vorbereitung auf den Kampf.
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Freigabe schließen"
          className="rounded-lg p-1.5"
          style={{ color: "var(--fg-4)" }}
        >
          <Icon name="x" size={14} />
        </button>
      </div>

      {error && (
        <div
          className="mt-3 rounded-lg px-3 py-2 text-xs"
          style={{
            background: "rgba(255,79,168,0.1)",
            border: "1px solid rgba(255,79,168,0.4)",
            color: "var(--ta-pink)",
          }}
        >
          {error}
        </div>
      )}

      {students === null ? (
        <div
          className="mt-3 h-16 animate-pulse rounded-xl"
          style={{ background: "var(--ink-3)" }}
        />
      ) : students.length === 0 ? (
        <p className="mt-3 text-xs" style={{ color: "var(--fg-4)" }}>
          Keine Schüler gefunden.
        </p>
      ) : (
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {students.map((s) => {
            const checked = draft.has(s.uid);
            return (
              <button
                key={s.uid}
                onClick={() => toggle(s.uid)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs"
                style={{
                  background: checked ? "rgba(35,196,206,0.1)" : "var(--ink-3)",
                  border: `1px solid ${checked ? "rgba(35,196,206,0.45)" : "var(--ink-5)"}`,
                  color: checked ? "var(--fg)" : "var(--fg-3)",
                }}
              >
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded"
                  style={{
                    background: checked ? "var(--ta-cyan)" : "transparent",
                    border: checked ? "none" : "1px solid var(--ink-5)",
                    color: "#06121a",
                  }}
                >
                  {checked && <Icon name="check" size={11} />}
                </span>
                <span className="min-w-0 truncate font-semibold">
                  {studentLabel(s)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={save}
          disabled={busy || students === null}
          className="btn-primary px-4 py-2 text-xs"
          style={{ opacity: busy ? 0.6 : 1 }}
        >
          Freigabe speichern
        </button>
        <button onClick={onClose} className="btn-secondary px-4 py-2 text-xs">
          Abbrechen
        </button>
      </div>
    </div>
  );
}

// ─── Seite ───────────────────────────────────────────────────────────────────

function OpponentDetailContent({ id }: { id: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [opponent, setOpponent] = useState<Opponent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<DetailTab>("uebersicht");
  const [sharingOpen, setSharingOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setOpponent(null);
    try {
      const o = await getOpponent(id);
      if (!o) throw new Error("DeepFight-Profil nicht gefunden");
      setOpponent(o);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  /** Stilles Neuladen ohne Skeleton — z. B. nach DNA-Übernahme aus einer Video-Analyse. */
  const reload = useCallback(async () => {
    try {
      const o = await getOpponent(id);
      if (o) setOpponent(o);
    } catch {
      /* Ansicht behält den letzten Stand */
    }
  }, [id]);

  async function handleSave(value: OpponentEditorValue) {
    if (!opponent) return;
    setBusy(true);
    try {
      await updateOpponent(opponent.id, {
        ...value,
        updatedBy: user?.uid ?? null,
      });
      await load();
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!opponent) return;
    if (
      !confirm(
        `DeepFight-Profil „${opponent.name}" wirklich löschen? Bereits angelegte Wettkämpfe behalten ihren gespeicherten Snapshot.`,
      )
    )
      return;
    try {
      await deleteOpponent(opponent.id);
      router.push("/trainer/opponents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    }
  }

  if (error && !opponent) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <ErrorState
          title="Profil konnte nicht geladen werden"
          message={error}
          onRetry={load}
        />
      </div>
    );
  }

  if (!opponent) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const answers = totalAnswered(opponent.dna);
  const coveredCategories = DNA_CATEGORIES.filter(
    (c) => answeredCount(c, opponent.dna) > 0,
  ).length;
  const measures = [
    opponent.heightCm ? `${opponent.heightCm} cm` : null,
    opponent.weightKg ? `${opponent.weightKg} kg` : null,
    opponent.reachCm ? `Reach ${opponent.reachCm} cm` : null,
  ].filter(Boolean);

  return (
    <main className="min-h-screen" style={{ background: "var(--ink-0)" }}>
      {/* Zurück-Zeile (scrollt mit) */}
      <div className="px-4 pt-4 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/trainer/opponents"
            aria-label="Zurück zur DeepFight-Bibliothek"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/5"
            style={{ color: "var(--fg-2)" }}
          >
            <Icon name="arrow-left" size={22} />
          </Link>
        </div>
      </div>

      {/* Sticky Fighter-ID-Card: dockt unter der Haupt-Navbar (h-16) an */}
      <div
        className="sticky top-16 z-30 mt-1 px-4 sm:px-6"
        style={{
          borderBottom: "1px solid var(--ink-3)",
          background: "linear-gradient(180deg, var(--ink-1), var(--ink-0))",
        }}
      >
        <div className="mx-auto max-w-3xl py-4">
          <div className="flex flex-wrap items-center gap-4">
            <DnaCompletenessRing
              covered={coveredCategories}
              total={DNA_CATEGORIES.length}
              size={82}
              stroke={5.5}
              label="Score"
            />
            <div className="min-w-0 flex-1">
              <h1
                className="font-display-ta truncate font-bold uppercase leading-none"
                style={{
                  fontSize: "clamp(26px, 5vw, 38px)",
                  letterSpacing: "0.04em",
                  color: "var(--fg)",
                }}
              >
                {opponent.name}
              </h1>
              <p
                className="mt-2 flex items-center gap-2 truncate"
                style={{ color: "#9D7BFA" }}
              >
                <span
                  className="font-mono-ta text-[11px] font-bold uppercase"
                  style={{ letterSpacing: "0.16em" }}
                >
                  {FIGHT_STYLE_LABEL[opponent.style]}
                </span>
                <span aria-hidden style={{ color: "var(--ink-5)" }}>
                  |
                </span>
                <Icon name="glove" size={15} />
              </p>
              <p
                className="font-mono-ta mt-1.5 flex items-center gap-1.5 truncate text-[11px]"
                style={{ letterSpacing: "0.12em", color: "var(--fg-4)" }}
              >
                <Icon name="calendar" size={13} />
                <span>
                  {answers} {answers === 1 ? "Eintrag" : "Einträge"}
                  {measures.length > 0 && <> · {measures.join(" · ")}</>}
                </span>
              </p>
            </div>
            {!editing && (
              <div className="flex shrink-0 flex-col gap-2">
                <button
                  onClick={() => setEditing(true)}
                  className="btn-primary px-4 py-2.5 text-xs"
                >
                  <Icon name="edit" size={14} />
                  Bearbeiten
                </button>
                <Link
                  href={`/trainer/competitions/new?opponent=${opponent.id}`}
                  className="btn-secondary px-4 py-2.5 text-xs"
                >
                  <Icon name="plus" size={14} />
                  Wettkampf anlegen
                </Link>
                <button
                  onClick={() => setSharingOpen((v) => !v)}
                  className="btn-secondary px-4 py-2.5 text-xs"
                >
                  <Icon name="users" size={14} />
                  Freigabe
                  {opponent.sharedWith.length > 0 && (
                    <span
                      className="font-mono-ta ml-1 rounded px-1.5 text-[10px] font-bold"
                      style={{
                        background: "rgba(35,196,206,0.15)",
                        color: "var(--ta-cyan)",
                      }}
                    >
                      {opponent.sharedWith.length}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Bereichs-Tabs — bleiben beim Scrollen erreichbar */}
          {!editing && (
            <div
              className="mt-4 flex rounded-2xl p-1"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.09)",
              }}
            >
              {DETAIL_TABS.map(([tabId, label, icon], i) => {
                const active = tab === tabId;
                return (
                  <button
                    key={tabId}
                    onClick={() => setTab(tabId)}
                    className="font-mono-ta flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-bold uppercase transition-colors"
                    style={{
                      letterSpacing: "0.14em",
                      color: active ? "var(--ta-pink)" : "var(--fg-3)",
                      borderLeft:
                        i > 0 ? "1px solid rgba(255,255,255,0.08)" : "none",
                      borderRadius: 0,
                    }}
                  >
                    <span className="flex items-center gap-2">
                      {icon && <Icon name={icon} size={15} />}
                      {label}
                    </span>
                    <span
                      aria-hidden
                      className="h-[3px] w-10 rounded-full"
                      style={{
                        background: active ? "var(--ta-pink)" : "transparent",
                        boxShadow: active
                          ? "0 0 10px rgba(255,79,168,0.7)"
                          : "none",
                      }}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {error && (
          <div className="mb-4">
            <ErrorState title="Fehler" message={error} onRetry={load} />
          </div>
        )}

        {sharingOpen && !editing && (
          <SharePanel
            opponent={opponent}
            onSaved={reload}
            onClose={() => setSharingOpen(false)}
          />
        )}

        {editing ? (
          <>
            <OpponentEditor
              initial={{
                name: opponent.name,
                style: opponent.style,
                stance: opponent.stance,
                heightCm: opponent.heightCm,
                weightKg: opponent.weightKg,
                reachCm: opponent.reachCm,
                strengths: opponent.strengths,
                weaknesses: opponent.weaknesses,
                favoriteAttacks: opponent.favoriteAttacks,
                notes: opponent.notes,
                dna: opponent.dna,
                dnaSplit: opponent.dnaSplit,
                actionStats: opponent.actionStats,
              }}
              busy={busy}
              submitLabel="Speichern"
              onSubmit={handleSave}
              onCancel={() => setEditing(false)}
            />
            <div className="mt-6 border-t pt-4" style={{ borderColor: "var(--ink-4)" }}>
              <button
                onClick={handleDelete}
                className="font-mono-ta rounded-lg px-3 py-1.5 text-[10px] uppercase"
                style={{
                  letterSpacing: "0.15em",
                  background: "transparent",
                  border: "1px solid var(--ink-5)",
                  color: "var(--fg-4)",
                }}
              >
                DeepFight-Profil löschen
              </button>
            </div>
          </>
        ) : tab === "videos" ? (
          <VideoAnalysisSection
            mode="opponent"
            targetId={opponent.id}
            targetName={opponent.name}
            opponent={opponent}
            onOpponentUpdated={reload}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {/* Übersicht: Auf-einen-Blick-Chips vor Split + Auto-Insights */}
            {tab === "uebersicht" && <GlanceCard opponent={opponent} />}
            <OpponentProfileView
              section={
                tab === "uebersicht" ? "overview" : tab === "dna" ? "dna" : "stats"
              }
              showBasics={false}
              opponent={{
                name: opponent.name,
                style: opponent.style,
                stance: opponent.stance,
                heightCm: opponent.heightCm,
                weightKg: opponent.weightKg,
                reachCm: opponent.reachCm,
                strengths: opponent.strengths,
                weaknesses: opponent.weaknesses,
                favoriteAttacks: opponent.favoriteAttacks,
                notes: opponent.notes,
                dna: opponent.dna,
                dnaSplit: opponent.dnaSplit,
                actionStats: opponent.actionStats,
              }}
            />
          </div>
        )}
      </div>
    </main>
  );
}

export default function OpponentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <OpponentDetailContent id={params.id} />;
}
