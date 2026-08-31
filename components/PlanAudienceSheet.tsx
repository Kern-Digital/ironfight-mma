"use client";

/**
 * Freigabe-Dialog eines Trainer-Plans (Workout-Pläne AUSBAU Stufe 1) —
 * Sheet in der Picker-Optik (Overlay, slide-up, Grabber, x schließt;
 * Desktop zentriert). Zwei Wege, EIN Ergebnis:
 *   • Kurs-Chips (TRAINING_BLOCKS, nach Wochentag gruppiert): ein gewählter
 *     Kurs markiert seine Abonnenten in der Checkliste vor
 *     (users/{uid}/subscriptions — Doc-ID ist die Kurs-ID). Abwählen nimmt
 *     nur den Kurs raus, die Personen bleiben einzeln anpassbar.
 *   • Personen-Checkliste mit Suche — ALLE Gym-Mitglieder (Leons Vorgabe
 *     30.08.: auch Trainer wählbar), gruppiert wie in den Kampfkontexten:
 *     „Ich selbst" · „Trainer & Coaches" · „Schüler" (listAllMembers).
 * Gespeichert wird IMMER die explizite Personen-Auswahl — sie wird als
 * audienceUids am Plan materialisiert (serverseitige Sichtbarkeit, Rules).
 * Die Kurs-Auswahl ist ein Snapshot: spätere Abonnenten kommen nicht
 * automatisch dazu (echte Kurs-Mitgliedschaft erst Multi-Gym Phase 2).
 */

import Icon from "@/components/ui/Icon";
import { isStaffEntry, listAllMembers, type StudentEntry } from "@/lib/admin";
import { useAuth } from "@/lib/auth-context";
import { TRAINING_BLOCKS, WEEKDAY_LABELS } from "@/lib/schedule";
import { filterSubscribedUids } from "@/lib/training-sessions";
import { useEffect, useMemo, useState } from "react";

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

// Rubrik-Überschriften — gleiche Sprache wie die Picker-Gruppen
const GROUP_FONT: React.CSSProperties = {
  font: "700 16px/1.2 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

function studentLabel(s: StudentEntry): string {
  return s.displayName ?? s.authProviderName ?? s.email ?? "Schüler";
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div
      className="flex items-center gap-3 px-2.5 pb-2 pt-5"
      style={{ ...GROUP_FONT, color: "var(--accent-text)" }}
    >
      {title}
      <span
        aria-hidden
        className="h-px flex-1"
        style={{
          background: "color-mix(in oklab, var(--accent) 35%, transparent)",
        }}
      />
    </div>
  );
}

export default function PlanAudienceSheet({
  gymId,
  planName,
  initialUids,
  initialCourseIds,
  onSave,
  onClose,
}: {
  gymId: string;
  planName: string;
  initialUids: string[];
  initialCourseIds: string[];
  /** Speichert die materialisierte Auswahl (wirft bei Fehler) */
  onSave: (uids: string[], courseIds: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [members, setMembers] = useState<StudentEntry[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(initialUids),
  );
  const [courses, setCourses] = useState<Set<string>>(
    () => new Set(initialCourseIds),
  );
  const [search, setSearch] = useState("");
  // Kurs, dessen Abonnenten gerade aufgelöst werden (Chip zeigt Busy)
  const [resolvingCourse, setResolvingCourse] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAllMembers(gymId)
      .then((list) => {
        if (!cancelled) setMembers(list);
      })
      .catch(() => {
        if (!cancelled) {
          setMembers([]);
          setLoadError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [gymId]);

  // Body-Scroll-Lock (Muster der App-Sheets)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Gruppierung wie in den Kampfkontexten (CLAUDE.md): „Ich selbst" ·
  // „Trainer & Coaches" · „Schüler" — die Suche filtert alle Gruppen.
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (s: StudentEntry) =>
      !q ||
      studentLabel(s).toLowerCase().includes(q) ||
      (s.email ?? "").toLowerCase().includes(q);
    const list = (members ?? []).filter(matches);
    const me = list.filter((s) => s.uid === user?.uid);
    const rest = list.filter((s) => s.uid !== user?.uid);
    return [
      { title: "Ich selbst", entries: me },
      { title: "Trainer & Coaches", entries: rest.filter(isStaffEntry) },
      { title: "Schüler", entries: rest.filter((s) => !isStaffEntry(s)) },
    ].filter((g) => g.entries.length > 0);
  }, [members, search, user?.uid]);

  function toggleStudent(uid: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  async function toggleCourse(blockId: string) {
    if (resolvingCourse) return;
    if (courses.has(blockId)) {
      // Nur der Kurs geht raus — die vorbelegten Schüler bleiben bewusst
      // angehakt (einzeln anpassbar; wer über mehrere Kurse drin ist,
      // fiele sonst fälschlich raus)
      setCourses((prev) => {
        const next = new Set(prev);
        next.delete(blockId);
        return next;
      });
      return;
    }
    setResolvingCourse(blockId);
    setError(null);
    try {
      const uids = await filterSubscribedUids(
        blockId,
        (members ?? []).map((s) => s.uid),
      );
      setCourses((prev) => new Set(prev).add(blockId));
      setChecked((prev) => {
        const next = new Set(prev);
        for (const uid of uids) next.add(uid);
        return next;
      });
    } catch {
      setError("Kurs-Abos konnten nicht geladen werden.");
    } finally {
      setResolvingCourse(null);
    }
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(Array.from(checked), Array.from(courses));
      onClose();
    } catch (err) {
      setSaving(false);
      setError(
        err instanceof Error ? err.message : "Speichern fehlgeschlagen",
      );
    }
  }

  // Wochentage mit Kursen — Reihenfolge Mo–So
  const weekdays = useMemo(() => {
    const set = new Set(TRAINING_BLOCKS.map((b) => b.weekday));
    return Array.from(set).sort((a, b) => a - b);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Freigabe für „${planName}"`}
    >
      <button
        type="button"
        aria-label="Freigabe schließen"
        className="absolute inset-0"
        style={{
          background: "var(--overlay)",
          animation: "fade-in 0.2s ease-out both",
        }}
        onClick={onClose}
      />
      <div
        className="pointer-events-auto animate-slide-up relative flex w-full max-h-[80vh] flex-col overflow-hidden rounded-t-[var(--r-xl)] sm:max-w-xl sm:rounded-[var(--r-xl)]"
        style={{
          maxHeight: "80dvh",
          background: "var(--surface-card)",
          border: "1px solid transparent",
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
            <span className="t-sheet-title">Freigabe</span>
            <span
              className="max-w-full truncate"
              style={{ ...META_FONT, color: "var(--text-3)" }}
            >
              {planName}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="t-interactive inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-field"
            style={{ color: "var(--text-3)" }}
          >
            <Icon name="x" size={16} strokeWidth={2.2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-1">
          {/* ── Kurse — Vorbelegung der Schüler-Auswahl ── */}
          <SectionTitle title="Kurse" />
          <p
            className="px-2.5 pb-3"
            style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
          >
            Ein Kurs wählt seine Abonnenten unten mit aus — die Auswahl
            bleibt einzeln anpassbar und zählt. Wer den Kurs später
            abonniert, kommt nicht automatisch dazu.
          </p>
          <div className="flex flex-col gap-3 px-2.5 pb-2">
            {weekdays.map((wd) => (
              <div key={wd} className="flex flex-col gap-1.5">
                <span style={{ ...META_FONT, color: "var(--text-3)" }}>
                  {WEEKDAY_LABELS[wd]}
                </span>
                <div className="flex flex-wrap gap-2">
                  {TRAINING_BLOCKS.filter((b) => b.weekday === wd).map(
                    (block) => {
                      const active = courses.has(block.id);
                      const busy = resolvingCourse === block.id;
                      return (
                        <button
                          key={block.id}
                          type="button"
                          onClick={() => void toggleCourse(block.id)}
                          disabled={busy || members === null}
                          aria-pressed={active}
                          className="t-interactive whitespace-nowrap rounded-field px-3 py-2 disabled:opacity-50"
                          style={{
                            font: "600 12px/1.2 var(--font-archivo), system-ui, sans-serif",
                            background: active
                              ? "var(--accent-subtle)"
                              : "var(--surface-raised)",
                            border: "1px solid",
                            borderColor: active
                              ? "var(--accent)"
                              : "var(--line)",
                            color: active
                              ? "var(--accent-text)"
                              : "var(--text-2)",
                          }}
                        >
                          {busy
                            ? "Lade…"
                            : `${block.title} · ${block.startTime}`}
                        </button>
                      );
                    },
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ── Personen — die Auswahl, die zählt. Gruppen wie in den
              Kampfkontexten; die Suche filtert alle Gruppen. ── */}
          <div className="px-2.5 pb-2 pt-4">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Person suchen…"
              aria-label="Person suchen"
              className="t-interactive w-full min-h-hit rounded-field px-3.5"
              style={{
                font: "var(--type-body)",
                background: "var(--surface-raised)",
                border: "1px solid var(--line)",
                color: "var(--text-body)",
                outline: "none",
              }}
            />
          </div>
          {members === null ? null : loadError ? (
            <p
              className="px-2.5 py-6 text-center"
              style={{ font: "var(--type-sub)", color: "var(--negative)" }}
            >
              Mitglieder konnten nicht geladen werden.
            </p>
          ) : groups.length === 0 ? (
            <p
              className="px-2.5 py-6 text-center"
              style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
            >
              {members.length === 0
                ? "Noch keine Mitglieder im Gym."
                : "Niemand passt zur Suche."}
            </p>
          ) : (
            <div className="pb-2">
              {groups.map((group) => (
                <div key={group.title} className="mb-2">
                  <SectionTitle title={group.title} />
                  {group.entries.map((s) => {
                    const active = checked.has(s.uid);
                    return (
                      <button
                        key={s.uid}
                        type="button"
                        onClick={() => toggleStudent(s.uid)}
                        aria-pressed={active}
                        className="t-interactive flex min-h-hit w-full items-center gap-3 rounded-field px-2.5 py-2 text-left"
                        style={{ color: "var(--text-body)" }}
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span
                            className="truncate"
                            style={{ font: "var(--type-body-strong)" }}
                          >
                            {studentLabel(s)}
                          </span>
                          {s.email && (
                            <span
                              className="truncate"
                              style={{
                                font: "var(--type-sub)",
                                color: "var(--text-3)",
                              }}
                            >
                              {s.email}
                            </span>
                          )}
                        </div>
                        <span
                          aria-hidden
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                          style={{
                            background: active
                              ? "var(--accent)"
                              : "transparent",
                            border: active
                              ? "1px solid var(--accent)"
                              : "1px solid var(--line-strong)",
                            color: "var(--on-accent)",
                            boxShadow: active
                              ? "var(--accent-glow)"
                              : undefined,
                          }}
                        >
                          {active && (
                            <Icon name="check" size={13} strokeWidth={2.6} />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Fuß: Zählung + Speichern ── */}
        <div
          className="flex items-center justify-between gap-3 border-t px-5 pt-3"
          style={{
            borderColor: "var(--line)",
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
          }}
        >
          <div className="flex min-w-0 flex-col">
            <span
              className="tabular-nums"
              style={{ ...META_FONT, color: "var(--text-2)" }}
            >
              {checked.size} ausgewählt
            </span>
            {error && (
              <span
                className="truncate"
                style={{ font: "var(--type-sub)", color: "var(--negative)" }}
              >
                {error}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || members === null}
            className="t-interactive inline-flex min-h-hit shrink-0 items-center justify-center gap-2 rounded-field px-5 disabled:opacity-50"
            style={{
              ...BTN_FONT,
              background: "var(--accent)",
              color: "var(--on-accent)",
              boxShadow: "var(--accent-glow)",
            }}
          >
            <Icon name="check" size={13} strokeWidth={2.4} />
            {saving ? "Speichere…" : "Freigabe speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
