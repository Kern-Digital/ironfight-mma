"use client";

/**
 * Athletenliste — der meistgenutzte Weg im Coach-Bereich.
 *
 * ROLLOUT-ETAPPE 1 (03.09.2026): Umzug vom alten Token-System (Ink-,
 * Foreground- und Tidal-Farbskala, Barlow Condensed) auf das neue. Die
 * Bausteine sind dieselben wie auf den vier fertigen Seiten: `t-card`,
 * `t-interactive`, `t-label`, die --type-*-Skala und BTN_FONT/META_BASE.
 *
 * DIE LISTE IST EINE NAMENSLISTE (Leons Vorgabe 03.09.2026). Vorher klappte
 * jede Karte ein Panel mit Fortschritt und Profil auf — dieselben Daten, die
 * die Detailseite größer und vollständiger zeigt. Zwei Wege zu denselben
 * Zahlen, einer davon in einer 351 px schmalen Karte. Jetzt: eine Zeile pro
 * Athlet, ein Klick führt auf `/trainer/athleten/[uid]`, und E-Mail sowie
 * Beitrittsdatum stehen dort im Kopf.
 *
 * DAS SPART AUCH ABFRAGEN: Das Aufklappen las pro geöffneter Karte vier
 * Unter-Sammlungen (`getStudentProgress`). Die Detailseite holt dieselben
 * Daten ohnehin — jetzt eben nur einmal, für den einen Athleten, den man
 * wirklich ansieht.
 *
 * AUSWAHLMODUS (Leons Vorgabe 03.09.2026): Langer Druck auf einen Namen
 * schaltet ihn scharf. Danach wählt ein normaler Klick aus statt zu öffnen —
 * bis das X in der Auswahlleiste kommt oder ein Klick ins Leere. Die Auswahl
 * überlebt Suche und Filter, WEIL sie nur uids hält und nicht die gerade
 * sichtbare Liste: Man kann in einen Kurs filtern, drei Leute wählen, in den
 * nächsten Kurs wechseln und dort weitersammeln.
 *
 * DAS ABDUNKELN MACHT DIE ARBEIT: Eine feste Schicht liegt über allem und
 * hebt genau die Dinge wieder heraus, die im Auswahlmodus zählen —
 * Auswahlleiste, Filterleiste und die Namensfelder. Dieselbe Schicht ist
 * auch das „Leere": Ein Klick darauf beendet den Modus. Ein zweiter
 * Mechanismus dafür wäre eine zweite Stelle zum Vergessen.
 *
 * FILTER ÜBER DIE KURSE, NICHT ÜBER DAS PROFIL: Begründung samt Messung im
 * Kopf von `lib/student-courses.ts`. Kurzfassung: Disziplin und Level am
 * Athleten-Profil sind bei 2 von 32 Athleten gepflegt, Kurs-Abos bei 32 von
 * 32 — und ein Kurs trägt Disziplin und Altersgruppe schon in sich.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHead from "@/components/shell/PageHead";
import TrainerHint from "@/components/TrainerHint";
import GooeySearch from "@/components/ui/GooeySearch";
import Icon from "@/components/ui/Icon";
import MultiFilter from "@/components/ui/MultiFilter";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import { listAllStudents, type StudentEntry } from "@/lib/admin";
import { useAuth } from "@/lib/auth-context";
import { resolveGymId } from "@/lib/gym";
import {
  filterOptions,
  loadCourseMemberships,
  matchesCourseFilter,
  type CourseMemberships,
} from "@/lib/student-courses";
import Link from "next/link";

// ─── Gemeinsame Schnitte (wie auf /trainer, /verwaltung, /admin) ────────────

const META_BASE: React.CSSProperties = {
  fontFamily: "var(--font-archivo), system-ui, sans-serif",
  fontWeight: 600,
  lineHeight: 1.3,
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};

// ─── Helper ────────────────────────────────────────────────────────────────

function initialsOf(entry: StudentEntry): string {
  const name =
    entry.displayName ?? entry.authProviderName ?? entry.email ?? "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function displayLabel(entry: StudentEntry): string {
  return (
    entry.displayName ?? entry.authProviderName ?? entry.email ?? entry.uid
  );
}

// ─── Athleten-Zeile ────────────────────────────────────────────────────────

/** Wie lange „lang" ist. Kürzer fühlt sich nach Versehen an, länger nach Warten. */
const LANGER_DRUCK_MS = 450;
/** Ab so viel Wischweg gilt der Druck als Scrollen, nicht als Auswählen. */
const WISCH_TOLERANZ_PX = 10;

/** Nur Name und Zeichen — alles Weitere steht auf der Detailseite. */
function StudentRow({
  entry,
  auswahlmodus,
  gewaehlt,
  onLangerDruck,
  onUmschalten,
}: {
  entry: StudentEntry;
  auswahlmodus: boolean;
  gewaehlt: boolean;
  onLangerDruck: () => void;
  onUmschalten: () => void;
}) {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  // Merkt sich, dass GERADE ein langer Druck ausgelöst hat — sonst folgte
  // dem Loslassen noch der normale Klick und die Seite wechselte.
  const ausgeloest = useRef(false);

  const abbrechen = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    start.current = null;
  };

  return (
    <Link
      href={`/trainer/athleten/${entry.uid}`}
      data-auswahlmodus={auswahlmodus || undefined}
      data-gewaehlt={gewaehlt || undefined}
      aria-pressed={auswahlmodus ? gewaehlt : undefined}
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY };
        ausgeloest.current = false;
        timer.current = window.setTimeout(() => {
          ausgeloest.current = true;
          onLangerDruck();
        }, LANGER_DRUCK_MS);
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        const weg =
          Math.abs(e.clientX - start.current.x) +
          Math.abs(e.clientY - start.current.y);
        if (weg > WISCH_TOLERANZ_PX) abbrechen();
      }}
      onPointerUp={abbrechen}
      onPointerLeave={abbrechen}
      onPointerCancel={abbrechen}
      onClick={(e) => {
        // Der Klick, der auf einen langen Druck folgt, darf nicht navigieren.
        if (ausgeloest.current) {
          e.preventDefault();
          ausgeloest.current = false;
          return;
        }
        if (auswahlmodus) {
          e.preventDefault();
          onUmschalten();
        }
      }}
      // Auf dem Handy öffnet ein langer Druck sonst das System-Menü.
      onContextMenu={(e) => {
        if (auswahlmodus) e.preventDefault();
      }}
      className="t-card t-interactive student-row flex select-none items-center gap-3 p-3.5"
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-field"
        style={{
          font: "var(--type-body-strong)",
          letterSpacing: "var(--ls-label)",
          background: "var(--accent-subtle)",
          border:
            "1px solid color-mix(in oklab, var(--accent) 35%, transparent)",
          color: "var(--accent-text)",
        }}
      >
        {initialsOf(entry)}
      </span>
      <span
        className="min-w-0 flex-1 truncate"
        style={{ font: "var(--type-body-strong)" }}
      >
        {displayLabel(entry)}
      </span>
    </Link>
  );
}

// ─── Seite ─────────────────────────────────────────────────────────────────

function StudentsContent() {
  const { profile } = useAuth();
  const gymId = resolveGymId(profile);
  const [students, setStudents] = useState<StudentEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Kurs-Abos aller Athleten — die Quelle aller drei Filter. `null` heißt
  // „lädt noch"; die Liste steht in dieser Zeit längst.
  const [memberships, setMemberships] = useState<CourseMemberships | null>(null);
  // Mehrfachauswahl je Liste. Leer heißt „alles" — dieselbe Aussage wie die
  // aktive „Alle"-Zeile im Panel (Begründung in ui/MultiFilter.tsx).
  const [courses, setCourses] = useState<string[]>([]);
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[]>([]);

  // Auswahlmodus. `gewaehlt` hält NUR uids — deshalb überlebt die Auswahl
  // jeden Filter- und Suchwechsel.
  // Welches Filterfeld gerade offen ist. Nur die Seite kann das wissen —
  // ein Feld sieht seine Geschwister nicht. Die übrigen machen sich damit
  // schmal, solange eines aufgeklappt ist (Leon 03.09.2026).
  const [offenerFilter, setOffenerFilter] = useState<string | null>(null);

  const [auswahlmodus, setAuswahlmodus] = useState(false);
  const [gewaehlt, setGewaehlt] = useState<string[]>([]);

  const load = useCallback(async () => {
    setError(null);
    setStudents(null);
    setMemberships(null);
    try {
      const data = await listAllStudents(gymId);
      setStudents(data);

      // BEWUSST OHNE `await`: Die Abos kosten eine Abfrage pro Athlet. Die
      // Liste soll darauf nicht warten — sie ist vollständig, sobald die
      // Namen da sind. Die Filter erscheinen, wenn sie fertig sind.
      loadCourseMemberships(data.map((s) => s.uid))
        .then(setMemberships)
        .catch(() => setMemberships(new Map()));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      setError(msg);
      setStudents([]);
      setMemberships(new Map());
    }
  }, [gymId]);

  useEffect(() => {
    load();
  }, [load]);

  const options = useMemo(
    () => (memberships ? filterOptions(memberships) : null),
    [memberships],
  );

  // Ein Filter, dessen Auswahlliste verschwindet (Gym-Wechsel, Kurs
  // abgeschafft), darf keine Auswahl behalten — sonst filterte er unsichtbar
  // weiter und die Liste bliebe ohne erkennbaren Grund leer.
  useEffect(() => {
    if (!options) return;
    const behalte = (
      gewaehlt: string[],
      erlaubt: { value: string }[],
      setzen: (v: string[]) => void,
    ) => {
      const gefiltert = gewaehlt.filter((v) =>
        erlaubt.some((o) => o.value === v),
      );
      if (gefiltert.length !== gewaehlt.length) setzen(gefiltert);
    };
    behalte(courses, options.courses, setCourses);
    behalte(disciplines, options.disciplines, setDisciplines);
    behalte(groups, options.groups, setGroups);
  }, [options, courses, disciplines, groups]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (students ?? []).filter((s) => {
      const passtSuche =
        !q ||
        (s.displayName ?? "").toLowerCase().includes(q) ||
        (s.authProviderName ?? "").toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q);
      if (!passtSuche) return false;
      if (!memberships) return true;
      return matchesCourseFilter(s.uid, memberships, {
        courses,
        disciplines,
        groups,
      });
    });
  }, [students, search, memberships, courses, disciplines, groups]);

  const filterAktiv =
    courses.length > 0 || disciplines.length > 0 || groups.length > 0;

  /** Namen der Gewählten — aus der VOLLEN Liste, nicht aus der gefilterten. */
  const gewaehlteEintraege = useMemo(
    () =>
      gewaehlt
        .map((uid) => (students ?? []).find((s) => s.uid === uid))
        .filter((e): e is StudentEntry => Boolean(e)),
    [gewaehlt, students],
  );

  const auswahlBeenden = useCallback(() => {
    setAuswahlmodus(false);
    setGewaehlt([]);
  }, []);

  const umschalten = useCallback((uid: string) => {
    setGewaehlt((v) =>
      v.includes(uid) ? v.filter((x) => x !== uid) : [...v, uid],
    );
  }, []);

  /**
   * Escape beendet den Modus — aber NUR, wenn nichts Kleineres offen ist.
   *
   * Gefunden am 03.09.2026 im Test: Escape schloss ein Filter-Panel UND den
   * Auswahlmodus gleichzeitig. Beide Handler hängen am `window`, deshalb hilft
   * hier kein `stopPropagation` — die Zuständigkeit muss über den ZUSTAND
   * geklärt werden. Escape räumt immer nur die oberste Ebene ab: erst das
   * Panel, beim zweiten Druck den Modus.
   */
  useEffect(() => {
    if (!auswahlmodus) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const etwasOffen =
        document.querySelector(".mf-panel") !== null ||
        document.querySelector(".goo-wrap[data-open]") !== null;
      if (etwasOffen) return;
      auswahlBeenden();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [auswahlmodus, auswahlBeenden]);
  const zeigeFilter =
    options !== null &&
    (options.courses.length > 0 ||
      options.disciplines.length > 0 ||
      options.groups.length > 0);

  return (
    <main
      className="min-h-screen pb-12"
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      {/* Das Rubrik-Schild („Trainer") aus dem alten Kopf fällt weg: Die
          Sidebar-Gruppe und der Pfad im Kopf der Hülle sagen längst, wo man
          steht — ein drittes Mal wäre Dekoration. */}
      <PageHead
        lane="wide"
        title="Athleten & Fortschritt"
        description="Alle Athleten deines Gyms. Tipp auf einen Namen — Profil, Fortschritt und Wettkämpfe stehen auf seiner Seite."
      />

      {/* Die Abdunkel-Schicht. Sie ist Anzeige UND Bedienung: Alles, was im
          Auswahlmodus nichts zu tun hat, versinkt darunter — und ein Klick
          darauf ist das „ins Leere klicken", das den Modus beendet. */}
      {auswahlmodus && (
        <div
          className="auswahl-schleier"
          onClick={auswahlBeenden}
          aria-hidden
        />
      )}

      <div
        data-auswahl-aktiv={auswahlmodus || undefined}
        className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 pt-1 sm:px-6"
      >
        <TrainerHint id="students-overview" title="Athletenprofile">
          Filtere nach Kurs, Disziplin oder Altersgruppe — die Auswahl kommt
          aus den Kursen deines Gyms. Ein Klick auf einen Namen öffnet
          Fortschritt, Kampfdaten und Wettkämpfe.
        </TrainerHint>

        {error && (
          <ErrorState
            title="Athleten konnten nicht geladen werden"
            message={error}
            hint="Prüfe die Firestore-Regeln — Trainer brauchen Lesezugriff auf die users-Collection."
            onRetry={load}
          />
        )}

        {/* Auswahlleiste. Sie steht ÜBER der Filterleiste, weil man aus ihr
            heraus weiterfiltert: ein paar Athleten aus Kurs A wählen, auf
            Kurs B umschalten, dort weitersammeln. */}
        {auswahlmodus && (
          <div className="auswahl-leiste">
            <span className="t-label" style={{ color: "var(--accent-text)" }}>
              {gewaehlt.length} {gewaehlt.length === 1 ? "Athlet" : "Athleten"}{" "}
              gewählt
            </span>

            {gewaehlteEintraege.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {gewaehlteEintraege.map((e) => (
                  <button
                    key={e.uid}
                    type="button"
                    onClick={() => umschalten(e.uid)}
                    className="auswahl-chip"
                    aria-label={`${displayLabel(e)} abwählen`}
                  >
                    <span className="truncate">{displayLabel(e)}</span>
                    <Icon name="x" size={12} strokeWidth={2.6} />
                  </button>
                ))}
              </div>
            )}

            {gewaehlt.length === 0 && (
              <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                Tipp die Namen an, die du zusammen bearbeiten willst. Filter
                und Suche kannst du dabei wechseln — die Auswahl bleibt.
              </p>
            )}
          </div>
        )}

        {/* Suche + Filter — EINE Reihe aus Pillen (Leon 03.09.2026).
            Die Gooey-Suche steht vorn und wächst beim Öffnen; die drei
            Auswahlfelder tragen dieselbe Pillen-Fassung, damit die Leiste als
            ein Element liest statt als Feld plus drei Kästen. */}
        <div className="auswahl-vorn auswahl-vorn-filter flex flex-col gap-2.5">
          {/* Die Auswahlfelder sind im Ruhezustand nur so breit wie ihre
              Beschriftung und wachsen beim Öffnen (Leon 03.09.2026) — die
              Breite regelt jedes Feld selbst, siehe ui/MultiFilter.tsx. */}
          <div className="flex flex-wrap items-center gap-2.5">
            <GooeySearch
              value={search}
              onChange={setSearch}
              label="Suchen"
              placeholder="Name oder E-Mail…"
            />

            {/* Jede Auswahlliste erscheint NUR, wenn sie mindestens zwei Werte
                kennt (Regel in lib/student-courses.ts). Ein reines Karate-Gym
                sieht deshalb kein Disziplin-Feld — dort filtert es nichts. */}
            {zeigeFilter && options.courses.length > 0 && (
              <MultiFilter
                label="Alle Kurse"
                kurzname="Kurs"
                options={options.courses}
                value={courses}
                onChange={setCourses}
                gedraengt={offenerFilter !== null && offenerFilter !== "kurse"}
                onOpenChange={(o) =>
                  setOffenerFilter((v) => (o ? "kurse" : v === "kurse" ? null : v))
                }
              />
            )}
            {zeigeFilter && options.disciplines.length > 0 && (
              <MultiFilter
                label="Alle Disziplinen"
                kurzname="Disziplin"
                options={options.disciplines}
                value={disciplines}
                onChange={setDisciplines}
                gedraengt={
                  offenerFilter !== null && offenerFilter !== "disziplinen"
                }
                onOpenChange={(o) =>
                  setOffenerFilter((v) =>
                    o ? "disziplinen" : v === "disziplinen" ? null : v,
                  )
                }
              />
            )}
            {zeigeFilter && options.groups.length > 0 && (
              <MultiFilter
                label="Alle Gruppen"
                kurzname="Gruppe"
                options={options.groups}
                value={groups}
                onChange={setGroups}
                gedraengt={offenerFilter !== null && offenerFilter !== "gruppen"}
                onOpenChange={(o) =>
                  setOffenerFilter((v) =>
                    o ? "gruppen" : v === "gruppen" ? null : v,
                  )
                }
              />
            )}

            {/* Der Abbruch steht auf DERSELBEN Zeile wie die Suche, rechts
                außen (Leon 03.09.2026) — dort, wo man ihn sucht, wenn man
                mit der Auswahl fertig ist, und weit weg von den Namen, die
                man gerade antippt. */}
            {auswahlmodus && (
              <button
                type="button"
                onClick={auswahlBeenden}
                className="auswahl-schliessen ml-auto"
                aria-label="Auswahl beenden"
                title="Auswahl beenden"
              >
                <Icon name="trash" size={18} strokeWidth={2} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {students && (
              <span
                className="text-[11px]"
                style={{ ...META_BASE, color: "var(--text-label)" }}
              >
                {filtered.length}{" "}
                {filtered.length === 1 ? "Athlet" : "Athleten"}
                {filtered.length !== students.length && (
                  <span> von {students.length}</span>
                )}
              </span>
            )}
            {filterAktiv && (
              <button
                type="button"
                onClick={() => {
                  setCourses([]);
                  setDisciplines([]);
                  setGroups([]);
                }}
                className="t-interactive -my-1 inline-flex items-center gap-1.5 rounded-field px-2 py-1 text-[11px]"
                style={{ ...META_BASE, color: "var(--text-3)" }}
              >
                <Icon name="x" size={12} strokeWidth={2.4} />
                Filter zurücksetzen
              </button>
            )}
          </div>
        </div>

        {/* Liste */}
        {students === null && (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-[68px] w-full rounded-card" />
            ))}
          </div>
        )}

        {students !== null && filtered.length === 0 && (
          <div
            className="t-card p-10 text-center"
            style={{ borderStyle: "dashed", borderColor: "var(--line)" }}
          >
            <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              {search || filterAktiv
                ? "Zu dieser Auswahl passt gerade niemand — probier einen anderen Kurs oder Namen."
                : "Sobald die ersten Mitglieder beitreten, stehen sie hier."}
            </p>
          </div>
        )}

        {students !== null && filtered.length > 0 && (
          <div className="auswahl-vorn grid items-start gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((entry) => (
              <StudentRow
                key={entry.uid}
                entry={entry}
                auswahlmodus={auswahlmodus}
                gewaehlt={gewaehlt.includes(entry.uid)}
                onLangerDruck={() => {
                  setAuswahlmodus(true);
                  setGewaehlt((v) =>
                    v.includes(entry.uid) ? v : [...v, entry.uid],
                  );
                }}
                onUmschalten={() => umschalten(entry.uid)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function TrainerStudentsPage() {
  return <StudentsContent />;
}
