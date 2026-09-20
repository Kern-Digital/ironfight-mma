"use client";

/**
 * Freigabe-Dialog eines Trainer-Plans (Workout-Pläne AUSBAU Stufe 1) —
 * Sheet in der Picker-Optik (Overlay, slide-up, Grabber, x schließt;
 * Desktop zentriert). Zwei Wege, die sich ADDIEREN (Leon 19.09.: „immer der
 * ganze Kurs"):
 *   • Kurs-Chips (TRAINING_BLOCKS, nach Wochentag gruppiert): Freigabe an
 *     den GANZEN Kurs — jedes Mitglied, auch wer ihn später bucht. Früher
 *     hakte ein Kurs nur einmal seine damaligen Abonnenten an; genau daher
 *     kam „4 Athleten sehen diesen Plan", obwohl 9 im Kurs waren.
 *   • Einzelne Personen mit Suche — ALLE Gym-Mitglieder (Leons Vorgabe
 *     30.08.: auch Trainer wählbar), gruppiert wie in den Kampfkontexten:
 *     „Ich selbst" · „Trainer & Coaches" · „Athleten" (listAllMembers).
 *     Wer über einen gewählten Kurs schon drin ist, trägt den Hinweis
 *     „Sieht ihn über …" — einzeln anhaken bleibt möglich (dann behält er
 *     den Plan auch, wenn er den Kurs abbestellt).
 * Gespeichert werden Kurse und Einzelne getrennt; die Leseliste für die
 * Rules (audienceUids) rechnet lib/workout-plans.ts daraus aus.
 */

import GooeySearch from "@/components/ui/GooeySearch";
import Icon from "@/components/ui/Icon";
import XKnopf from "@/components/ui/XKnopf";
import { SheetShell } from "@/components/motion";
import { isStaffEntry, listAllMembers, type StudentEntry } from "@/lib/admin";
import { useAuth } from "@/lib/auth-context";
import {
  courseTitlesOf,
  TRAINING_BLOCKS,
  WEEKDAY_LABELS,
} from "@/lib/schedule";
import {
  loadCourseMemberships,
  type CourseMemberships,
} from "@/lib/student-courses";
import { courseMemberUids } from "@/lib/workout-plans";
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

/** Fußzeile: was gerade freigegeben würde — ohne Kopfzahl, die ein Kurs
    ohnehin sprengt (Leon 19.09.). */
function fussZeile(kurse: number, einzelne: number): string {
  const teile: string[] = [];
  if (kurse > 0) teile.push(`${kurse} ${kurse === 1 ? "Kurs" : "Kurse"}`);
  if (einzelne > 0) teile.push(`${einzelne} einzeln`);
  return teile.length ? teile.join(" + ") : "Nichts gewählt";
}

function studentLabel(s: StudentEntry): string {
  return s.displayName ?? s.authProviderName ?? s.email ?? "Athlet";
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

/** Inhalt INNERHALB der Huelle: die zusammengeklickte Auswahl (Athleten,
 *  Kurse, Suchbegriff) soll beim Schliessen verschwinden. */
function PlanAudienceInhalt({
  gymId,
  planName,
  initialUids,
  initialCourseIds,
  initialIndividualUids,
  onSave,
  onClose,
}: {
  gymId: string;
  planName: string;
  /** Heutige Leseliste — nur für Altbestand (siehe initialIndividualUids) */
  initialUids: string[];
  initialCourseIds: string[];
  /** null = Altbestand von vor dem 19.09.: Einzelne und Kursmitglieder
      stehen dort gemischt in initialUids und werden hier getrennt */
  initialIndividualUids: string[] | null;
  /** Speichert Kurse und Einzelne (wirft bei Fehler) */
  onSave: (courseIds: string[], individualUids: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [members, setMembers] = useState<StudentEntry[] | null>(null);
  // Kurs-Abos aller Mitglieder — für „Sieht ihn über …" und den Altbestand
  const [memberships, setMemberships] = useState<CourseMemberships | null>(
    null,
  );
  const [loadError, setLoadError] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(initialIndividualUids ?? initialUids),
  );
  const [courses, setCourses] = useState<Set<string>>(
    () => new Set(initialCourseIds),
  );
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAllMembers(gymId)
      .then((list) => {
        if (cancelled) return;
        setMembers(list);
        return loadCourseMemberships(list.map((m) => m.uid)).then((m) => {
          if (!cancelled) setMemberships(m);
        });
      })
      .catch(() => {
        if (!cancelled) {
          setMembers([]);
          setMemberships(new Map());
          setLoadError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [gymId]);

  // Altbestand einmalig trennen: wer heute über einen der gespeicherten
  // Kurse drin ist, ist KEIN Einzelner — sonst behielte er den Plan beim
  // Abbestellen für immer.
  const [altGetrennt, setAltGetrennt] = useState(initialIndividualUids !== null);
  useEffect(() => {
    if (altGetrennt || !memberships) return;
    const viaKurs = new Set(courseMemberUids(initialCourseIds, memberships));
    setChecked(new Set(initialUids.filter((uid) => !viaKurs.has(uid))));
    setAltGetrennt(true);
  }, [altGetrennt, memberships, initialCourseIds, initialUids]);

  /** uid → Kursnamen, über die er den Plan schon sieht (aktuelle Auswahl) */
  const viaKurs = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!memberships) return map;
    const gewaehlt = Array.from(courses);
    memberships.forEach((abos, uid) => {
      const titel = courseTitlesOf(gewaehlt.filter((c) => abos.has(c)));
      if (titel.length) map.set(uid, titel);
    });
    return map;
  }, [memberships, courses]);

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
      { title: "Athleten", entries: rest.filter((s) => !isStaffEntry(s)) },
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

  function toggleCourse(blockId: string) {
    setCourses((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(Array.from(courses), Array.from(checked));
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
    <>
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
          <XKnopf
            onClick={onClose}
            ariaLabel="Schließen"
            wort="Schließen"
            drehung="roll"
            style={{ color: "var(--text-2)" }}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-1">
          {/* ── Kurse — Freigabe an den GANZEN Kurs ── */}
          <SectionTitle title="Kurse" />
          <p
            className="px-2.5 pb-3"
            style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
          >
            Jeder in diesen Kursen sieht den Plan — auch wer den Kurs erst
            später bucht.
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
                      // Ohne Rahmen (Leon 19.09.: „weniger Kästen") — die
                      // Fläche trägt den Zustand
                      return (
                        <button
                          key={block.id}
                          type="button"
                          data-press
                          onClick={() => toggleCourse(block.id)}
                          aria-pressed={active}
                          className="t-interactive whitespace-nowrap rounded-field px-3 py-2"
                          style={{
                            font: "600 12px/1.2 var(--font-archivo), system-ui, sans-serif",
                            background: active
                              ? "var(--accent-subtle)"
                              : "var(--surface-raised)",
                            color: active
                              ? "var(--accent-text)"
                              : "var(--text-2)",
                          }}
                        >
                          {`${block.title} · ${block.startTime}`}
                        </button>
                      );
                    },
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ── Einzelne — zusätzlich zu den Kursen. Gruppen wie in den
              Kampfkontexten; die Suche filtert alle Gruppen. ── */}
          <SectionTitle title="Einzelne Personen" />
          <p
            className="px-2.5"
            style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
          >
            Gib den Plan zusätzlich einzelnen Personen frei — unabhängig von
            ihren Kursen.
          </p>
          <div className="px-2.5 pb-2 pt-3">
            <GooeySearch
              value={search}
              onChange={setSearch}
              placeholder="Person suchen…"
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
                    const ueber = viaKurs.get(s.uid);
                    return (
                      <button
                        key={s.uid}
                        type="button"
                        onClick={() => toggleStudent(s.uid)}
                        aria-pressed={active}
                        data-press="quiet"
                        className="picker-zeile t-interactive flex min-h-hit w-full items-center gap-3 rounded-field px-2.5 py-2 text-left"
                        style={{ color: "var(--text-body)" }}
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span
                            className="truncate"
                            style={{ font: "var(--type-body-strong)" }}
                          >
                            {studentLabel(s)}
                          </span>
                          {ueber ? (
                            <span
                              className="truncate"
                              style={{
                                font: "var(--type-sub)",
                                color: "var(--accent-text)",
                              }}
                            >
                              Sieht ihn über {ueber.join(", ")}
                            </span>
                          ) : (
                            s.email && (
                              <span
                                className="truncate"
                                style={{
                                  font: "var(--type-sub)",
                                  color: "var(--text-3)",
                                }}
                              >
                                {s.email}
                              </span>
                            )
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
              {fussZeile(courseTitlesOf(Array.from(courses)).length, checked.size)}
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
            disabled={saving || members === null || !altGetrennt}
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
    </>
  );
}

export default function PlanAudienceSheet({
  open,
  ...props
}: {
  open: boolean;
  gymId: string;
  planName: string;
  initialUids: string[];
  initialCourseIds: string[];
  initialIndividualUids: string[] | null;
  onSave: (courseIds: string[], individualUids: string[]) => Promise<void>;
  onClose: () => void;
}) {
  return (
    <SheetShell
      open={open}
      onClose={props.onClose}
      label={`Freigabe für „${props.planName}"`}
      panelClassName="pointer-events-auto relative flex w-full max-h-[80vh] flex-col overflow-hidden rounded-t-[var(--r-xl)] sm:max-w-xl lg:max-w-3xl sm:rounded-[var(--r-xl)]"
      panelStyle={{
        maxHeight: "80dvh",
        background: "var(--surface-card)",
        border: "1px solid transparent",
        boxShadow: "var(--glass-shadow)",
      }}
    >
      <PlanAudienceInhalt {...props} />
    </SheetShell>
  );
}
