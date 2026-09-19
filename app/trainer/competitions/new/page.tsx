"use client";

/**
 * NEUER WETTKAMPF — das Banner IST das Formular (Leon 12.09.2026).
 *
 * Vorher standen hier drei Schritte untereinander: eine lange Athletenliste,
 * darunter eine lange Gegnerliste, ganz unten die Eckdaten. Man scrollte an
 * zwei Listen vorbei, um einen Namen einzutippen, und sah bis zuletzt nicht,
 * wen man da eigentlich gegeneinander stellt.
 *
 * Jetzt: Oben die Eckdaten — Name und Datum, die zwei Dinge, die nur hier
 * entstehen. Darunter das VS-Banner der Wettkampfseite, und zwar als AUSWAHL
 * (components/trainer/VersusBanner.tsx, `modus="auswahl"`): Eine silberne
 * Platte heißt „fehlt noch", eine türkise „steht fest". Wer auf eine Platte
 * tippt, bekommt die Auswahl als Popup; ein Tipp auf einen Namen setzt ihn
 * in die Platte und schließt das Popup wieder. Damit steht der Kampf die
 * ganze Zeit vor einem, statt erst nach dem Speichern zu erscheinen — und
 * die zwei Listen kosten keine Seitenlänge mehr, sondern eine Berührung.
 *
 * Einen neuen Gegner legt man im Gegner-Popup an: das Regenbogen-Plus der
 * Wettkampfseite (`df-start df-plus`), unter dem Zeiger wächst „Neuer
 * Gegner" heraus. Der Editor tritt an die Stelle der Liste (MorphSwap), das
 * gespeicherte Profil ist sofort gewählt.
 *
 * KEIN INTRO: Das Match-Intro samt Ton gehört zum ÖFFNEN eines Wettkampfs.
 * Hier steht noch gar keiner — es gäbe nichts anzukündigen, und bei jeder
 * Korrektur liefe es erneut.
 *
 * KAMPFART IST PFLICHT (Leon 17.09.2026: „wenn ich einen Wettkampf anlege,
 * muss ich auch sagen, was für eine Disziplin gekämpft wird"). Sie bestimmt
 * die Techniken des Plans, das Profil auf der Wettkampfseite und den
 * Gameplan. Vorbelegt, sobald der gewählte Athlet genau EINE Kampfart im
 * Profil hat — eine Wahl von Hand bleibt stehen. Nach dem Anlegen stößt die
 * Seite den Gameplan an (die Route antwortet sofort).
 *
 * DIE FLÄCHE FOLGT DER KAMPFART (Leon 17.09.2026: „vorbelegt nach dem, was
 * bei der Wettkampferstellung eingetragen worden ist"): MMA → Käfig, Boxen
 * und Kickboxen → Ring, Ringen und Sambo → Matte. Eine Wahl von Hand gilt,
 * bis die Kampfart wechselt — dann belegt die neue Kampfart wieder vor. BJJ
 * hat keine Zonen und kein Feld.
 */

import GooeySearch from "@/components/ui/GooeySearch";
import Select from "@/components/ui/Select";
import MultiFilter from "@/components/ui/MultiFilter";
import PageHead from "@/components/shell/PageHead";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import DeepFightWordmark from "@/components/DeepFightWordmark";
import OpponentEditor, {
  type OpponentEditorValue,
} from "@/components/trainer/OpponentEditor";
import VersusBanner, { type VersusSeite } from "@/components/trainer/VersusBanner";
import { MorphSwap, SheetShell, StaggerFlow, FlowItem } from "@/components/motion";
import { useAuth } from "@/lib/auth-context";
import { resolveGymId } from "@/lib/gym";
import {
  getStudentEntry,
  isGhostAccount,
  isStaffEntry,
  listAllMembers,
  type StudentEntry,
} from "@/lib/admin";
import { darfSehen } from "@/lib/profile-sharing";
import {
  filterOptions,
  loadCourseMemberships,
  matchesCourseFilter,
  type CourseMemberships,
} from "@/lib/student-courses";
import { hasAnyRight } from "@/lib/roles";
import {
  createOpponent,
  getOpponent,
  listOpponentsForGym,
  opponentToSnapshot,
  searchOpponents,
  type Opponent,
} from "@/lib/opponents";
import { createFightCamp } from "@/lib/fight-camp";
import { generateFightCamp } from "@/lib/fight-camp-generator";
import { analyzeTrainingHistory } from "@/lib/fight-camp-analysis";
import { getRecentWorkouts } from "@/lib/workouts";
import { getAllProgress } from "@/lib/extensions/technique-progress";
import { FIGHT_STYLE_LABEL } from "@/lib/fight-camp";
import { getFightProfile } from "@/lib/fight-profile";
import { starteGameplan } from "@/lib/gameplan";
import { SPORT_KURZ, SPORT_LABEL, SPORT_ORDER, isSport, type Sport } from "@/lib/video-analysis";
import {
  FLAECHE_LABEL,
  FLAECHE_ORT,
  STANDARD_FLAECHE,
  flaecheWaehlbar,
  isFlaeche,
  type Flaeche,
} from "@/lib/kampfart-steckbrief";
import { dnaCompleteness } from "@/lib/gegner-dna";
import { ATHLETE_LEVEL_LABEL, type TechniqueProgress } from "@/lib/types";

function studentLabel(s: StudentEntry): string {
  return s.displayName ?? s.authProviderName ?? s.email ?? s.uid;
}

/**
 * Zweite Zeile der Athleten-Karte: bei Trainern/Admins zuerst die Rolle
 * (sonst wäre nicht erkennbar, dass hier ein Coach als Athlet antritt),
 * danach — wenn gepflegt — das Athleten-Level.
 */
function athleteSubLabel(s: StudentEntry): string | null {
  const level = s.athlete?.level ? ATHLETE_LEVEL_LABEL[s.athlete.level] : null;
  if (!isStaffEntry(s)) return level;
  const role = s.rights.admin ? "Admin" : "Trainer";
  return level ? `${role} · ${level}` : role;
}

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};
const BTN_FONT: React.CSSProperties = {
  font: "600 13px/1 var(--font-archivo), system-ui, sans-serif",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};
const fieldStyle: React.CSSProperties = {
  background: "var(--surface-raised)",
  border: "1px solid var(--line)",
  color: "var(--text-body)",
  font: "var(--type-body)",
  outline: "none",
};
/** Beide Popups tragen dasselbe Maß — sie sind dieselbe Geste. */
const SHEET_PANEL =
  "pointer-events-auto relative flex w-full max-h-[85vh] flex-col overflow-hidden rounded-t-[var(--r-xl)] sm:max-w-xl sm:rounded-[var(--r-xl)] lg:max-w-3xl";
/**
 * Das Athleten-Popup hat zusätzlich eine MINDESTHÖHE (Leons Befund
 * 12.09.2026: „wenn die Auswahlliste größer ist als die angezeigte Anzahl
 * der Namen, schneidet es unten ab").
 *
 * Die Kategorielisten klappen als absolut gesetztes Panel unter ihrem Feld
 * auf — bis zu 340 px. Das Popup war bis dahin so hoch wie sein Inhalt, und
 * sein Rahmen schneidet ab (`overflow-hidden` trägt die runden Ecken). Nach
 * einem Filter mit acht Treffern blieben vom Popup keine 400 px übrig, und
 * die Liste lief unten aus dem Bild.
 *
 * Die Mindesthöhe löst NOCH ETWAS: Vorher wuchs und schrumpfte das ganze
 * Popup bei jedem Tastendruck in der Suche, weil weniger Namen weniger Höhe
 * heißen — es steht mittig, also wanderte alles mit. Jetzt steht es still,
 * und nur die Liste darin wird kürzer.
 *
 * `80dvh` im `min()` und nicht `560px` allein: Auf einem flachen Fenster
 * schlägt eine Mindesthöhe sonst die Höchsthöhe (CSS gibt `min-height` den
 * Vorrang), und das Popup stünde höher als das Fenster.
 */
const SHEET_PANEL_ATHLET = `${SHEET_PANEL} min-h-[min(80dvh,560px)]`;
const SHEET_STYLE: React.CSSProperties = {
  maxHeight: "85dvh",
  background: "var(--surface-card)",
  boxShadow: "var(--glass-shadow)",
};

/** Nummer + Titel eines Schritts. Die Ziffer trägt den Gym-Akzent — vorher
    war sie das alte Pink, das es im neuen System nicht mehr gibt. */
function StepHeader({ n, title }: { n: number; title: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-badge"
        style={{
          font: "var(--type-body-strong)",
          background: "var(--accent-subtle)",
          border: "1px solid color-mix(in oklab, var(--accent) 35%, transparent)",
          color: "var(--accent-text)",
        }}
      >
        {n}
      </span>
      <h2
        style={{
          font: "var(--type-h3)",
          letterSpacing: "var(--ls-display)",
          textTransform: "uppercase",
        }}
      >
        {title}
      </h2>
    </div>
  );
}

function AthleteCard({
  entry,
  active,
  onSelect,
}: {
  entry: StudentEntry;
  active: boolean;
  onSelect: () => void;
}) {
  const sub = athleteSubLabel(entry);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      data-press="surface"
      className="t-interactive flex min-h-hit w-full items-center gap-2.5 rounded-field px-3 py-2.5 text-left"
      style={{
        background: active ? "var(--accent-subtle)" : "var(--surface-raised)",
        border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
      }}
    >
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-badge"
        style={{
          font: "var(--type-meta)",
          letterSpacing: "var(--ls-label)",
          background: active ? "var(--accent)" : "var(--surface-card)",
          color: active ? "var(--on-accent)" : "var(--text-3)",
        }}
      >
        {studentLabel(entry).slice(0, 2).toUpperCase()}
      </span>
      <span className="min-w-0">
        <span
          className="block truncate"
          style={{
            font: "var(--type-body-strong)",
            color: active ? "var(--accent-text)" : "var(--text-body)",
          }}
        >
          {studentLabel(entry)}
        </span>
        {sub && (
          <span
            className="block truncate"
            style={{ ...META_FONT, color: "var(--text-3)" }}
          >
            {sub}
          </span>
        )}
      </span>
    </button>
  );
}

function AthleteGroup({
  title,
  accent,
  entries,
  selectedUid,
  onSelect,
}: {
  title: string;
  accent: string;
  entries: StudentEntry[];
  selectedUid: string | null;
  onSelect: (uid: string) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <div>
      <p className="t-label mb-2" style={{ color: accent }}>
        {title}
      </p>
      {/* Die Suche filtert live — bleibende Namen rutschen an ihren neuen
          Platz, statt zu springen. Schlüssel ist die uid, nie der Index
          (MOTION-BRIEF §3.7). */}
      <StaggerFlow className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {entries.map((e, i) => (
          <FlowItem key={e.uid} index={i}>
            <AthleteCard
              entry={e}
              active={e.uid === selectedUid}
              onSelect={() => onSelect(e.uid)}
            />
          </FlowItem>
        ))}
      </StaggerFlow>
    </div>
  );
}

function NewCompetitionContent() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const gymId = resolveGymId(profile);

  const [members, setMembers] = useState<StudentEntry[] | null>(null);
  const [opponents, setOpponents] = useState<Opponent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [studentUid, setStudentUid] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  // Kurs-Abos je Athlet — die Quelle der drei Kategorien. Sie kosten EINE
  // Abfrage pro Person (lib/student-courses.ts), deshalb werden sie erst
  // geladen, wenn die Auswahl zum ersten Mal aufgeht, und im Hintergrund:
  // Die Liste steht sofort, die Kategorien treten dazu, sobald sie da sind.
  const [memberships, setMemberships] = useState<CourseMemberships | null>(null);
  const [kurse, setKurse] = useState<string[]>([]);
  const [disziplinen, setDisziplinen] = useState<string[]>([]);
  const [gruppen, setGruppen] = useState<string[]>([]);
  // Welches Kategoriefeld offen ist — nur die Seite weiß das, ein Feld sieht
  // seine Geschwister nicht. Die übrigen machen sich derweil schmal.
  const [offenerFilter, setOffenerFilter] = useState<string | null>(null);

  const [oppMode, setOppMode] = useState<"existing" | "new">("existing");
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null);
  const [oppSearch, setOppSearch] = useState("");
  const [creatingOpp, setCreatingOpp] = useState(false);

  /** Welche Platte gerade ihre Auswahl offen hat — null heißt: keine. */
  const [wahl, setWahl] = useState<VersusSeite | null>(null);
  // Die zwei Platten, damit der Fokus nach dem Schließen dorthin zurückgeht.
  const platten = useRef<Partial<Record<VersusSeite, HTMLButtonElement | null>>>({});

  const [name, setName] = useState("");
  const defaultDate = useMemo(
    () =>
      new Date(Date.now() + 84 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    [],
  );
  const [date, setDate] = useState(defaultDate);
  const [sport, setSport] = useState<Sport | null>(null);
  // Eine Wahl von Hand überschreibt die Vorbelegung aus dem Profil nie.
  const [sportVonHand, setSportVonHand] = useState(false);
  // Die Fläche von Hand — gilt nur für die Kampfart, zu der sie gewählt wurde.
  const [flaecheVonHand, setFlaecheVonHand] = useState<{ sport: Sport; flaeche: Flaeche } | null>(null);
  const flaecheZeigen = flaecheWaehlbar(sport);
  const flaeche: Flaeche | null = !sport
    ? null
    : flaecheVonHand?.sport === sport
      ? flaecheVonHand.flaeche
      : STANDARD_FLAECHE[sport];

  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [memberList, opponentList] = await Promise.all([
        listAllMembers(gymId).catch(() => [] as StudentEntry[]),
        listOpponentsForGym(gymId).catch(() => [] as Opponent[]),
      ]);
      setMembers(memberList);
      setOpponents(opponentList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setMembers([]);
      setOpponents([]);
    }
  }, [gymId]);

  useEffect(() => {
    load();
  }, [load]);

  // Vom Gegnerprofil gekommen? Dann führt der Weg zurück dorthin (PageHead).
  const vomGegner = searchParams.get("opponent");

  // Vorauswahl aus Query-Parametern (?student= / ?opponent=)
  useEffect(() => {
    const s = searchParams.get("student");
    if (s) setStudentUid(s);
    const o = searchParams.get("opponent");
    if (o) {
      setSelectedOpponentId(o);
      setOppMode("existing");
    }
  }, [searchParams]);

  /**
   * Auswahl schließen — und den Fokus auf die Platte zurückgeben, von der
   * sie ausging. Als `useCallback`, weil der Escape-Haken davon abhängt.
   */
  const schliessen = useCallback(() => {
    setWahl((offen) => {
      if (offen) platten.current[offen]?.focus();
      return null;
    });
  }, []);

  useEffect(() => {
    if (!wahl) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Escape raeumt IMMER nur die oberste Schicht ab (dieselbe Regel wie
      // ueber der Athletenliste): Steht ein Kategoriefeld oder die Suchpille
      // offen, gehoert der Tastendruck denen — das Popup bleibt.
      if (
        document.querySelector(".mf-panel") !== null ||
        document.querySelector(".goo-wrap[data-open]") !== null
      ) {
        return;
      }
      schliessen();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wahl, schliessen]);

  /** Eine Platte öffnet ihre Auswahl — immer mit leerem Suchfeld. */
  function oeffnen(seite: VersusSeite) {
    if (seite === "athlet") setStudentSearch("");
    else {
      setOppSearch("");
      setOppMode("existing");
    }
    setWahl(seite);
  }

  // Die Kategorien kosten eine Abfrage je Athlet. Sie fallen erst an, wenn
  // jemand die Auswahl wirklich öffnet — und genau EINMAL je Seitenbesuch.
  useEffect(() => {
    if (wahl !== "athlet" || memberships || !members?.length) return;
    let lebt = true;
    loadCourseMemberships(members.map((m) => m.uid))
      .then((m) => lebt && setMemberships(m))
      .catch(() => {});
    return () => {
      lebt = false;
    };
  }, [wahl, memberships, members]);

  const kategorien = useMemo(
    () => (memberships ? filterOptions(memberships) : null),
    [memberships],
  );
  /**
   * Ein Kategoriefeld erscheint NUR, wenn es mindestens zwei Werte kennt
   * (Regel in lib/student-courses.ts) — ein reines Karate-Gym bekommt kein
   * Disziplin-Feld, weil es dort nichts trennt.
   */
  const zeigeKategorien =
    kategorien !== null &&
    (kategorien.courses.length > 0 ||
      kategorien.disciplines.length > 0 ||
      kategorien.groups.length > 0);

  const filteredMembers = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    const list = members ?? [];
    return list.filter((s) => {
      if (
        q &&
        !studentLabel(s).toLowerCase().includes(q) &&
        !(s.email ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
      // INNERHALB einer Kategorie gilt ODER, ZWISCHEN ihnen UND — die
      // Verknüpfung steckt in `matchesCourseFilter`, nicht hier.
      if (!memberships) return true;
      return matchesCourseFilter(s.uid, memberships, {
        courses: kurse,
        disciplines: disziplinen,
        groups: gruppen,
      });
    });
  }, [members, studentSearch, memberships, kurse, disziplinen, gruppen]);

  // Trainer sind ebenfalls Athleten — sie stehen nur in eigenen Gruppen, damit
  // niemand sie versehentlich statt eines Schülers erwischt.
  const selfEntry = useMemo(
    () => filteredMembers.find((s) => s.uid === user?.uid) ?? null,
    [filteredMembers, user?.uid],
  );
  /**
   * Kollegen, denen man einen Wettkampf anlegen darf.
   *
   * NUR MIT IHRER FREIGABE (Bereich „wettkampf", Schritt 2b): Ein Camp für
   * einen Kollegen ohne Freigabe scheitert beim Speichern an den Regeln —
   * die Auswahl darf ihn deshalb gar nicht erst anbieten. Ein Name, den man
   * anklicken kann und der dann eine Fehlermeldung bringt, ist schlechter
   * als kein Name.
   *
   * OHNE PLATTFORM-ADMINS: Ghost-Konten gehören keinem Gym-Team an
   * (Begründung an `isGhostAccount` in lib/admin.ts).
   */
  const staffEntries = useMemo(
    () =>
      filteredMembers
        .filter(
          (s) =>
            s.uid !== user?.uid &&
            isStaffEntry(s) &&
            !isGhostAccount(s) &&
            darfSehen(s.profileShares, "wettkampf", user?.uid ?? "", gymId),
        )
        .sort((a, b) => studentLabel(a).localeCompare(studentLabel(b), "de")),
    [filteredMembers, user?.uid, gymId],
  );
  const studentEntries = useMemo(
    () => filteredMembers.filter((s) => s.uid !== user?.uid && !isStaffEntry(s)),
    [filteredMembers, user?.uid],
  );

  const filteredOpponents = useMemo(
    () => searchOpponents(opponents ?? [], oppSearch),
    [opponents, oppSearch],
  );

  const selectedStudent = members?.find((s) => s.uid === studentUid) ?? null;
  const selectedOpponent =
    opponents?.find((o) => o.id === selectedOpponentId) ?? null;

  // Vorbelegung: Hat der gewählte Athlet genau EINE Kampfart im Profil, ist sie
  // gesetzt. Ohne DeepFight-Freigabe bleibt das Feld leer (kein Fehler).
  useEffect(() => {
    if (!studentUid || sportVonHand) return;
    let lebt = true;
    getFightProfile(studentUid)
      .then((p) => {
        const arten = p.evidence?.kampfarten ?? [];
        if (lebt && arten.length === 1) setSport(arten[0]);
      })
      .catch(() => {});
    return () => {
      lebt = false;
    };
  }, [studentUid, sportVonHand]);

  const canSubmit =
    !!studentUid && !!selectedOpponentId && !!name.trim() && !!date && !!sport;

  function waehleAthlet(uid: string) {
    setStudentUid(uid);
    schliessen();
  }

  function waehleGegner(id: string) {
    setSelectedOpponentId(id);
    schliessen();
  }

  // Neue Gegner-DNA im Popup anlegen → wird ausgewählt und steht in der Platte
  async function handleCreateOpponent(value: OpponentEditorValue) {
    if (!user) return;
    setCreatingOpp(true);
    setError(null);
    try {
      const created = await createOpponent({
        gymId,
        createdBy: user.uid,
        createdByName:
          profile?.displayName ?? profile?.authProviderName ?? profile?.email ?? null,
        ...value,
      });
      setOpponents((prev) => [created, ...(prev ?? [])]);
      setSelectedOpponentId(created.id);
      setOppMode("existing");
      if (!name.trim()) setName(`Wettkampf vs ${created.name}`);
      schliessen();
    } catch (err) {
      setError(err instanceof Error ? err.message : "DeepFight-Profil konnte nicht angelegt werden");
    } finally {
      setCreatingOpp(false);
    }
  }

  async function handleCreateCompetition() {
    if (!user || !studentUid || !selectedOpponentId) return;
    setSubmitting(true);
    setError(null);
    try {
      // 1) Snapshot der Gegner-DNA holen (eingefroren für diesen Wettkampf)
      const opponent =
        selectedOpponent ?? (await getOpponent(selectedOpponentId));
      if (!opponent) throw new Error("Ausgewähltes DeepFight-Profil nicht gefunden");
      const snapshot = opponentToSnapshot(opponent);

      // 2) Trainingsanalyse des Schülers (für den 4-Phasen-Plan)
      const [workouts, progress] = await Promise.all([
        getRecentWorkouts(studentUid, 500).catch(() => []),
        getAllProgress(studentUid).catch(() => [] as TechniqueProgress[]),
      ]);
      const analysis = analyzeTrainingHistory(workouts, progress);

      // 3) Camp generieren + gym/opponent-Verweise ergänzen
      const base = generateFightCamp({
        studentUid,
        createdBy: user.uid,
        competitionDate: new Date(date),
        competitionName: name.trim(),
        // Das Level kommt aus dem EINZELN geladenen Profil — Listen tragen
        // es nicht mehr (lib/admin.ts, StudentEntry.athlete). Ein Read.
        athleteLevel:
          (await getStudentEntry(studentUid).catch(() => null))?.athlete
            ?.level ?? null,
        analysis,
        opponent: snapshot,
        sport,
      });
      const created = await createFightCamp({
        ...base,
        // Gespeichert wird, was der Trainer sah — auch die Vorbelegung.
        flaeche: flaecheZeigen ? flaeche : null,
        gymId,
        opponentId: opponent.id,
        // Dieselbe Bedingung wie `istStabKonto()` in den Firestore-Regeln:
        // trainer ODER verwaltung ODER admin. Nicht `isStaffEntry` — das
        // prüft nur das Trainer-Häkchen und ließe eine reine Verwaltung als
        // Athletin durchgehen (lib/fight-camp.ts, Kopfkommentar).
        ownerIsStaff: hasAnyRight(
          members?.find((m) => m.uid === studentUid)?.rights ?? {
            trainer: false,
            verwaltung: false,
            admin: false,
          },
        ),
      });

      // Gameplan anstoßen — die Route antwortet sofort, Claude schreibt im
      // Hintergrund, die Wettkampfseite zeigt den Fortschritt.
      void starteGameplan(studentUid, created.id).catch(() => {});
      router.push(`/trainer/competitions/${studentUid}/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wettkampf konnte nicht erstellt werden");
      setSubmitting(false);
    }
  }

  return (
    <main
      className="min-h-screen"
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      {/* Wer vom Gegnerprofil kommt (`?opponent=`), geht dorthin zurück —
          im Kopf der Hülle als „← Gegnerprofil" (Leon 18.09.2026: „ein Button
          mit Gegnerprofil, der mich einfach wieder zurück zu dem Profil
          bringt"). Sonst zurück in den Wettkampfbereich. */}
      <PageHead
        lane="standard"
        back={
          vomGegner
            ? { href: `/trainer/deepfight/gegner/${vomGegner}`, label: "Gegnerprofil" }
            : { href: "/trainer/competitions", label: "Wettkampfbereich" }
        }
        title="Neuer Wettkampf"
      />

      {/* Breiter als das alte `max-w-3xl`, aber kein Vollbild: am Monitor
          stehen zwei bis drei Athleten nebeneinander, auf dem Laptop bleibt
          das Formular eine lesbare Spalte (gleiche Staffelung wie in der
          Athletenliste). */}
      <div className="mx-auto max-w-2xl px-4 py-7 sm:px-6 lg:max-w-5xl">
        {error && (
          <div className="mb-5">
            <ErrorState title="Fehler" message={error} onRetry={load} />
          </div>
        )}

        {members === null || opponents === null ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-24 w-full rounded-card" />
            <Skeleton className="h-56 w-full rounded-card" />
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {/* Schritt 1: die Eckdaten — das Einzige, was nur hier entsteht */}
            <section>
              <StepHeader n={1} title="Wettkampf" />
              <div
                className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${flaecheZeigen ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
              >
                <label className="flex flex-col gap-1.5">
                  <span className="t-label">Wettkampf-Name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="z.B. Fight Night München"
                    className="min-h-hit rounded-field px-3"
                    style={fieldStyle}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="t-label">Kampfdatum</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="min-h-hit rounded-field px-3"
                    style={fieldStyle}
                  />
                </label>
                <div className="flex flex-col gap-1.5" data-feld="kampfart">
                  <span className="t-label">Kampfart</span>
                  <Select
                    value={sport ?? ""}
                    onChange={(v) => {
                      setSport(isSport(v) ? v : null);
                      setSportVonHand(true);
                    }}
                    placeholder="Kampfart wählen"
                    options={SPORT_ORDER.map((s) => ({ value: s, label: SPORT_LABEL[s] }))}
                  />
                </div>
                {flaecheZeigen && sport && (
                  <div className="flex flex-col gap-1.5" data-feld="flaeche">
                    <span className="t-label">Fläche</span>
                    <Select
                      value={flaeche ?? ""}
                      onChange={(v) => {
                        if (isFlaeche(v)) setFlaecheVonHand({ sport, flaeche: v });
                      }}
                      options={(["kaefig", "ring", "matte"] as const).map((f) => ({
                        value: f,
                        label: FLAECHE_LABEL[f],
                      }))}
                    />
                  </div>
                )}
              </div>
              {/* Der Hilfstext folgt der Wahl (Gedächtnis „hilfstexte-erklaerend"). */}
              <p className="mt-2" style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                {sport
                  ? `Der Plan nimmt nur Techniken aus ${SPORT_LABEL[sport]}. Der Gameplan liest dazu das ${SPORT_KURZ[sport]}-Profil deines Athleten und das Profil des Gegners${flaecheZeigen && flaeche ? ` und plant den Kampf ${FLAECHE_ORT[flaeche]}` : ""}.`
                  : "Die Kampfart bestimmt, welche Techniken im Plan stehen und welches Profil der Gameplan liest."}
              </p>
            </section>

            {/* Schritt 2: das Duell. Silber heißt „fehlt noch", Türkis
                „steht fest" — dieselbe Regel wie auf der Wettkampfseite,
                nur dass sie hier an der Wahl hängt und nicht am Lesen. */}
            <section>
              <StepHeader n={2} title="Das Duell" />
              <VersusBanner
                modus="auswahl"
                intro={false}
                introKey="neuer-wettkampf"
                athletName={
                  selectedStudent ? studentLabel(selectedStudent) : "Athlet wählen"
                }
                athletRolle={
                  selectedStudent?.uid === user?.uid ? "Ich selbst" : "Unser Athlet"
                }
                gegnerName={selectedOpponent?.name ?? "Gegner wählen"}
                aktiv={[
                  ...(selectedStudent ? (["athlet"] as const) : []),
                  ...(selectedOpponent ? (["gegner"] as const) : []),
                ]}
                onChange={oeffnen}
                /* Immer nur die NÄCHSTE offene Platte pingt — erst der
                   Athlet, nach seiner Wahl der Gegner, dann Ruhe. */
                pulsiert={
                  !selectedStudent ? "athlet" : !selectedOpponent ? "gegner" : null
                }
                plattenRef={(seite, el) => {
                  platten.current[seite] = el;
                }}
              />
            </section>

            {/* Erstellen. Nicht mehr klebend, ohne Zusammenfassung und ohne
                Hinweistexte (Leon 12.09.): Beides stand für die zwei langen
                Listen, durch die man vorher scrollte — was fehlt, sagt jetzt
                das Banner darüber selbst, mit dem Wort auf der leeren Platte
                und dem Ping daran. */}
            <div className="t-glass p-4">
              <button
                type="button"
                onClick={handleCreateCompetition}
                disabled={!canSubmit || submitting}
                className="t-interactive min-h-hit w-full rounded-field px-5 disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  ...BTN_FONT,
                  background: "var(--accent)",
                  color: "var(--on-accent)",
                  boxShadow: "var(--accent-glow)",
                }}
              >
                {submitting ? "Erstelle Wettkampf + Plan…" : "Wettkampf erstellen"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Die Auswahl hinter der linken Platte ─────────────────────── */}
      <SheetShell
        open={wahl === "athlet"}
        onClose={schliessen}
        label="Athlet wählen"
        panelClassName={SHEET_PANEL_ATHLET}
        panelStyle={SHEET_STYLE}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-5">
          {/* Die Bedienelemente stehen in einer EIGENEN Zeile, rechtsbündig,
              und NICHT neben dem Text: Suchpille und Plus wachsen beide unter
              Zeiger bzw. Fokus. Neben dem Text hätte dieses Wachsen die
              Beschreibung umbrechen lassen — das Panel wird höher, steht aber
              mittig, also wandert alles nach oben, der Zeiger verliert den
              Knopf, der schrumpft wieder, und das Spiel beginnt von vorn
              (gemessen 12.09.: Playwright fand den Knopf 30 s lang „not
              stable"). Rechtsbündig wächst die Beschriftung in freien Platz,
              und nichts anderes bewegt sich. */}
          <div className="shrink-0 px-1 pb-3">
            <h2 className="t-sheet-title">Athlet wählen</h2>
            <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
              Ein Tipp auf den Namen — dann steht er im Banner.
            </p>
            {/* Kategorien aus den KURSEN, nicht aus dem Profil: Die
                Profilfelder sind bei 2 von 32 Athleten gepflegt, die
                Kurs-Abos bei 32 von 32 (gemessen 03.09., Begründung im Kopf
                von lib/student-courses.ts). Dieselben drei Felder wie über
                der Athletenliste — wer dort filtert, filtert hier gleich.
                Sie treten erst auf, wenn die Abos da sind; die Namen stehen
                vorher schon. */}
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2.5">
              {zeigeKategorien && kategorien!.courses.length > 0 && (
                <MultiFilter
                  label="Alle Kurse"
                  kurzname="Kurs"
                  options={kategorien!.courses}
                  value={kurse}
                  onChange={setKurse}
                  gedraengt={offenerFilter !== null && offenerFilter !== "kurse"}
                  onOpenChange={(o) =>
                    setOffenerFilter((v) => (o ? "kurse" : v === "kurse" ? null : v))
                  }
                />
              )}
              {zeigeKategorien && kategorien!.disciplines.length > 0 && (
                <MultiFilter
                  label="Alle Disziplinen"
                  kurzname="Disziplin"
                  options={kategorien!.disciplines}
                  value={disziplinen}
                  onChange={setDisziplinen}
                  gedraengt={offenerFilter !== null && offenerFilter !== "disziplin"}
                  onOpenChange={(o) =>
                    setOffenerFilter((v) =>
                      o ? "disziplin" : v === "disziplin" ? null : v,
                    )
                  }
                />
              )}
              {zeigeKategorien && kategorien!.groups.length > 0 && (
                <MultiFilter
                  label="Alle Gruppen"
                  kurzname="Gruppe"
                  options={kategorien!.groups}
                  value={gruppen}
                  onChange={setGruppen}
                  gedraengt={offenerFilter !== null && offenerFilter !== "gruppe"}
                  onOpenChange={(o) =>
                    setOffenerFilter((v) => (o ? "gruppe" : v === "gruppe" ? null : v))
                  }
                />
              )}
              <GooeySearch
                value={studentSearch}
                onChange={setStudentSearch}
                placeholder="Athlet suchen…"
              />
            </div>
          </div>
          {filteredMembers.length === 0 ? (
            <p className="px-1" style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              {kurse.length || disziplinen.length || gruppen.length
                ? "Kein Athlet in dieser Auswahl. Nimm eine Kategorie zurück oder such nach einem Namen."
                : "Kein Athlet zu diesem Suchbegriff. Such nach einem anderen Namen oder leer die Suche."}
            </p>
          ) : (
            // `overflow-x-hidden`, weil `overflow-y-auto` die X-Achse laut CSS
            // still auf `auto` hebt: die Karten wachsen beim Hover um 0,8 %
            // (data-press="surface"), und schon das reichte für eine
            // waagerechte Scroll-Leiste. `px-1` gibt dem Wachsen den Platz,
            // den das Abschneiden ihm sonst nimmt.
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden px-1 pb-1">
              <AthleteGroup
                title="Ich selbst"
                accent="var(--accent)"
                entries={selfEntry ? [selfEntry] : []}
                selectedUid={studentUid}
                onSelect={waehleAthlet}
              />
              {/* Kein eigenes Violett mehr: Das gehoert app-weit DeepFight
                  (dieselbe Entscheidung wie bei „Archiviert" in der
                  Uebersicht). Die Gruppen trennt ihre Ueberschrift, nicht
                  eine dritte Farbe. */}
              <AthleteGroup
                title="Trainer & Coaches"
                accent="var(--text-2)"
                entries={staffEntries}
                selectedUid={studentUid}
                onSelect={waehleAthlet}
              />
              <AthleteGroup
                title="Athlet"
                accent="var(--text-3)"
                entries={studentEntries}
                selectedUid={studentUid}
                onSelect={waehleAthlet}
              />
            </div>
          )}
        </div>
      </SheetShell>

      {/* ─── Die Auswahl hinter der rechten Platte ────────────────────── */}
      <SheetShell
        open={wahl === "gegner"}
        onClose={schliessen}
        label="Gegner wählen"
        panelClassName={SHEET_PANEL}
        panelStyle={SHEET_STYLE}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-5">
          {/* Eigene Zeile wie im Athleten-Popup — Begründung dort. */}
          <div className="shrink-0 px-1 pb-3">
            <h2 className="t-sheet-title">
              {oppMode === "existing" ? "Gegner wählen" : "Neuer Gegner"}
            </h2>
            <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
              {oppMode === "existing" ? (
                <>
                  Jedes <DeepFightWordmark />-Profil deines Gyms. Ein Tipp
                  setzt es in die Platte.
                </>
              ) : (
                <>
                  Dein ganzes Trainerteam arbeitet mit diesem Profil — für
                  diesen Wettkampf steht es sofort bereit.
                </>
              )}
            </p>
            <div className="mt-3 flex items-center justify-end gap-3">
              {oppMode === "existing" && (
                <GooeySearch
                  value={oppSearch}
                  onChange={setOppSearch}
                  placeholder="Gegner suchen…"
                />
              )}
              {/* Erst nur das Plus im Regenbogen, unter dem Zeiger wächst
                  „Neuer Gegner" heraus; offen wird es zum Kreuz. Dieselbe
                  Geste wie auf der Wettkampfseite. */}
              <button
                type="button"
                onClick={() =>
                  setOppMode((m) => (m === "existing" ? "new" : "existing"))
                }
                aria-expanded={oppMode === "new"}
                aria-label={
                  oppMode === "new" ? "Zurück zur Liste" : "Neuer Gegner"
                }
                className="df-start df-plus"
              >
                <span aria-hidden>{oppMode === "new" ? "×" : "+"}</span>
                <span className="df-plus-label" aria-hidden>
                  {oppMode === "new" ? "Zurück" : "Neuer Gegner"}
                </span>
              </button>
            </div>
          </div>

          {/* Der Wechsel zwischen Auswahl und Editor ist ein Formwechsel,
              kein Umschalten (MOTION-BRIEF §1.1). `activeKey` ist der Modus
              — ohne ihn merkt AnimatePresence nichts. */}
          {/* Der Scrollbereich steht ÜBER dem MorphSwap, nicht darunter: Als
              `flex-1` im Panel hätte der Formwechsel seine eigene Höhe
              animiert, während die Flex-Kette sie ihm gleichzeitig vorgibt —
              zwei Rechnungen auf derselben Zahl. So hat der Bereich seine
              feste Höhe, und nur der Inhalt darin wechselt die Form. */}
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1 pb-1">
            <MorphSwap activeKey={oppMode}>
              {oppMode === "existing" ? (
                filteredOpponents.length === 0 ? (
                  <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                    {(opponents?.length ?? 0) === 0
                      ? "Noch kein Gegnerprofil im Gym — leg über das Plus das erste an."
                      : "Kein Gegner zu diesem Suchbegriff."}
                  </p>
                ) : (
                  <StaggerFlow className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {filteredOpponents.map((o, i) => {
                      const active = o.id === selectedOpponentId;
                      return (
                        <FlowItem key={o.id} index={i}>
                          <button
                            type="button"
                            onClick={() => waehleGegner(o.id)}
                            aria-pressed={active}
                            data-press="surface"
                            className="t-interactive min-h-hit w-full rounded-field px-3 py-2.5 text-left"
                            style={{
                              background: active
                                ? "var(--accent-subtle)"
                                : "var(--surface-raised)",
                              border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
                            }}
                          >
                            <span
                              className="block truncate"
                              style={{
                                font: "var(--type-body-strong)",
                                color: active ? "var(--accent-text)" : "var(--text-body)",
                              }}
                            >
                              {o.name}
                            </span>
                            <span
                              className="block truncate"
                              style={{ ...META_FONT, color: "var(--text-3)" }}
                            >
                              {FIGHT_STYLE_LABEL[o.style]} · DNA {dnaCompleteness(o.dna)} %
                            </span>
                          </button>
                        </FlowItem>
                      );
                    })}
                  </StaggerFlow>
                )
              ) : (
                <OpponentEditor
                  busy={creatingOpp}
                  submitLabel="Speichern & in den Kampf setzen"
                  onSubmit={handleCreateOpponent}
                  onCancel={() => setOppMode("existing")}
                />
              )}
            </MorphSwap>
          </div>
        </div>
      </SheetShell>
    </main>
  );
}

export default function NewCompetitionPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:max-w-5xl">
          <Skeleton className="h-16 w-full" />
        </div>
      }
    >
      <NewCompetitionContent />
    </Suspense>
  );
}
