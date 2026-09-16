"use client";

/**
 * Die Wettkampfseite — Leons Neuaufbau vom 11.09.2026.
 *
 * ─── WAS SICH GEÄNDERT HAT ──────────────────────────────────────────────────
 *
 * Bis hierher zeigte die Seite unter dem Kopf die DeepFight-Wortmarke, den
 * eingefrorenen Gegner-Snapshot in einer Karte und darunter den Plan. Der
 * eigene Athlet kam nur als Name in der Beschreibung vor — dabei bereitet
 * ein Trainer hier ZWEI Leute aufeinander vor.
 *
 *   Kopf      links der Name des Wettkampfs, rechts das Notizfeld
 *             (`CampNotizen`: mehrere Leute, jede Notiz trägt ihren Autor);
 *             darunter der Zustand, der Knopf „Trainingsplan" (ein ANKER,
 *             er springt auf die laufende Phase) und die zwei Nebenwege.
 *   Vs.       zwei große Kacheln, unser Athlet gegen den Gegner. Die
 *             gewählte trägt den Akzent — sie entscheidet, wessen DeepFight
 *             darunter steht. Start ist der Gegner: Das war die bisherige
 *             Ansicht, und wer die Seite öffnet, will meist scouten.
 *   DeepFight RAHMENLOS (Leon: „entferne den Rahmen mit dem anderen
 *             Hintergrund"): oben der Name noch einmal größer, rechts davon
 *             „+ Analyse" und das Funkeln mit der Zahl der Analysen.
 *             „+ Analyse" klappt DIE ABLAGE der Werkbank hier auf — dieselbe
 *             `VideoAnalysisSection` wie auf /trainer/deepfight/analyse, mit
 *             denselben Props und demselben Speicher-Schlüssel. Wer dort
 *             angefangen hat, macht hier weiter. Übernimmt der Trainer
 *             Befunde, lädt die Seite das Profil still nach — beim Gegner
 *             das verknüpfte Profil (der Snapshot bleibt, `resolveCampOpponent`
 *             füllt die Lücken), beim Athleten das Kampfprofil.
 *
 * DAS FUNKELN OHNE SCHRIFTZUG ist eine Ausnahme von DESIGN-BRIEF §1.6 —
 * Leons ausdrückliche Ansage für diese Stelle („das DeepFight-Icon mit der
 * Zahl neben dran"). Die Wortmarke über dem Namen ist dafür weg.
 *
 * DER RUMPF STEHT AUF `standard`: Die Spur `detail` (max-w-4xl) im PageHead
 * war ein Erbstück allein für diese Seite und ist mit dem Umbau gefallen.
 *
 * ─── RECHTE ────────────────────────────────────────────────────────────────
 *
 * Das Camp selbst kommt über den Bereich `wettkampf`. Das Kampfprofil und die
 * Analysen des Athleten liegen unter `deepfight` — bei einem Kollegen kann
 * das eine freigegeben sein und das andere nicht. Läuft das Kampfprofil in
 * `permission-denied`, sagt die Athleten-Seite das in einem Satz statt einer
 * roten Box; die Analysen-Zahl bleibt dann leer.
 */

import PageHead from "@/components/shell/PageHead";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import Skeleton from "@/components/ui/Skeleton";
import ErrorState from "@/components/ui/ErrorState";
import OpponentProfileView from "@/components/trainer/OpponentProfileView";
import FightProfileView from "@/components/trainer/FightProfileView";
import FightCampPlanView, {
  phaseAnchorId,
} from "@/components/trainer/FightCampPlanView";
import VideoAnalysisSection from "@/components/trainer/VideoAnalysisSection";
import CampNotizen from "@/components/trainer/CampNotizen";
import VersusBanner, {
  type VersusSeite,
} from "@/components/trainer/VersusBanner";
import { Collapse, MorphSwap, useMotionCapability } from "@/components/motion";
// GROUP_ACCENT kommt aus der Uebersicht — es gab hier eine zweite Fassung,
// und die beiden liefen auseinander: „Archiviert" war dort neutral und hier
// Brand-Violett. Eine Quelle, ein Aussehen.
import {
  GROUP_ACCENT,
  competitionGroup,
} from "@/components/trainer/CompetitionCard";
import {
  addCampNotiz,
  campOpponentId,
  deleteFightCamp,
  fightCampProgress,
  FIGHT_STYLE_LABEL,
  FIGHTER_STANCE_LABEL,
  getFightCamp,
  removeCampNotiz,
  type CampNotiz,
  type FightCamp,
  type OpponentProfile,
} from "@/lib/fight-camp";
import {
  getOpponent,
  opponentToSnapshot,
  type Opponent,
} from "@/lib/opponents";
import {
  getMemberEntry,
  isPermissionDenied,
  type StudentEntry,
} from "@/lib/admin";
import {
  getFightProfile,
  isFightProfileEmpty,
  type FightProfile,
} from "@/lib/fight-profile";
import { listVideoAnalyses } from "@/lib/video-analysis";
import { dnaCompleteness } from "@/lib/gegner-dna";
import { useAuth } from "@/lib/auth-context";
import { hasAnyRight } from "@/lib/roles";

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

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

/** Die Haupthandlung — voller Gym-Akzent. */
const PRIMARY_BTN: React.CSSProperties = {
  ...BTN_FONT,
  background: "var(--accent)",
  color: "var(--on-accent)",
  boxShadow: "var(--accent-glow)",
  textDecoration: "none",
};

const GROUP_LABEL = {
  upcoming: "Geplant / Aktiv",
  past: "Vergangen",
  archived: "Archiviert",
} as const;

/** Wessen DeepFight unter dem Vs. steht. */
type Seite = VersusSeite;

/** Eine Kennung für eine Notiz — ohne Abfrage, ohne Server. */
function neueId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Seite ───────────────────────────────────────────────────────────────────

function CompetitionDetailContent({
  uid,
  campId,
}: {
  uid: string;
  campId: string;
}) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { reduced } = useMotionCapability();
  const eigeneUid = user?.uid ?? "";

  const [camp, setCamp] = useState<FightCamp | null>(null);
  const [student, setStudent] = useState<StudentEntry | null>(null);
  // Verknüpftes DeepFight-Profil — ergänzt den eingefrorenen Snapshot um
  // Antworten, die erst nach dem Anlegen des Wettkampfs dazugekommen sind.
  const [opponent, setOpponent] = useState<Opponent | null>(null);
  // Kampfprofil unseres Athleten — das Merge-Ziel seiner Analysen.
  const [fightProfile, setFightProfile] = useState<FightProfile | null>(null);
  const [profilGesperrt, setProfilGesperrt] = useState(false);
  // Wie viele Analysen es je Seite gibt — null heißt „nicht lesbar".
  const [anzahl, setAnzahl] = useState<Record<Seite, number | null>>({
    athlet: null,
    gegner: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [seite, setSeite] = useState<Seite>("gegner");
  // Für welche Seite die Ablage offen steht. Ein Seitenwechsel klappt sie
  // zu — sonst stünde unter dem Athleten die Ablage des Gegners.
  const [analyseOffenFuer, setAnalyseOffenFuer] = useState<Seite | null>(null);
  // Die ganze Seite außer dem Banner wartet, bis das Intro in den Ausklang
  // geht (Leon 12.09.: „alles soll erst smooth erscheinen, wenn die
  // Animation anfängt zu enden"). Das Banner meldet den Moment — oder
  // sofort, wenn kein Intro läuft.
  const [seiteSichtbar, setSeiteSichtbar] = useState(false);
  // Unsichtbar statt nicht gerendert: Die Höhe der Seite bleibt gleich, und
  // das Intro bricht bei einem Scroll-Ereignis ab — ein Sprung der
  // Seitenhöhe könnte genau das auslösen. Das Einblenden dauert so lange
  // wie der Ausklang des Intros (rund eine Sekunde).
  const einblenden: React.CSSProperties = {
    visibility: seiteSichtbar ? undefined : "hidden",
    opacity: seiteSichtbar ? 1 : 0,
    transition: "opacity 900ms var(--ease-out)",
  };
  // Rueckfrage vor dem Loeschen — inline statt Browser-Popup, siehe unten.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setCamp(null);
    setOpponent(null);
    setFightProfile(null);
    setProfilGesperrt(false);
    try {
      // getMemberEntry statt getStudentEntry: Die Seite braucht nur den
      // NAMEN, und der steht am users-Dokument. Das Athletenprofil eine Ebene
      // tiefer hängt am Bereich „athlet" — wer seinen Wettkampf freigibt,
      // muss dafür nicht auch sein Profil hergeben, und dann stünde hier
      // sonst „Athlet" statt eines Namens.
      const [c, s] = await Promise.all([
        getFightCamp(uid, campId),
        getMemberEntry(uid).catch(() => null),
      ]);
      if (!c) throw new Error("Wettkampf nicht gefunden");
      setCamp(c);
      setStudent(s);

      const oppId = campOpponentId(c);
      // Alles Weitere parallel und einzeln abgefangen: Was hier scheitert,
      // ist eine fehlende Freigabe oder ein gelöschtes Profil — beides kein
      // Grund, den Wettkampf nicht zu zeigen.
      const [o, fp, nAthlet, nGegner] = await Promise.all([
        oppId ? getOpponent(oppId).catch(() => null) : Promise.resolve(null),
        getFightProfile(uid)
          .then((p) => ({ p, gesperrt: false }))
          .catch((err) => ({ p: null, gesperrt: isPermissionDenied(err) })),
        listVideoAnalyses("athlete", uid)
          .then((l) => l.length)
          .catch(() => null),
        oppId
          ? listVideoAnalyses("opponent", oppId)
              .then((l) => l.length)
              .catch(() => null)
          : Promise.resolve(0),
      ]);
      setOpponent(o);
      setFightProfile(fp.p);
      setProfilGesperrt(fp.gesperrt);
      setAnzahl({ athlet: nAthlet, gegner: nGegner });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    }
  }, [uid, campId]);

  useEffect(() => {
    load();
  }, [load]);

  /** Stilles Nachladen des verknüpften Gegnerprofils — nach einer Übernahme. */
  const reloadOpponent = useCallback(async () => {
    const oppId = camp ? campOpponentId(camp) : null;
    if (!oppId) return;
    try {
      const o = await getOpponent(oppId);
      if (o) setOpponent(o);
    } catch {
      /* Ansicht behält den letzten Stand */
    }
  }, [camp]);

  /** Stilles Nachladen des Kampfprofils — nach einer Übernahme. */
  const reloadFightProfile = useCallback(async () => {
    try {
      setFightProfile(await getFightProfile(uid));
    } catch {
      /* Ansicht behält den letzten Stand */
    }
  }, [uid]);

  /**
   * `ownerIsStaff` bei jedem Speichern mitschreiben (Schritt 2b). Es heilt
   * Camps aus der Zeit vor dem Backfill und zieht nach, falls sich die Rechte
   * des Besitzers geändert haben. Steht der Name (noch) nicht fest, bleibt das
   * Feld weg — dann behält das Dokument seinen bisherigen Wert, und die Regel
   * prüft weiter gegen den.
   */
  function ownerFlag(): { ownerIsStaff?: boolean } {
    return student ? { ownerIsStaff: hasAnyRight(student.rights) } : {};
  }

  async function handleDelete() {
    if (!camp || deleting) return;
    setDeleting(true);
    try {
      await deleteFightCamp(uid, campId);
      router.push("/trainer/competitions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  // ── Notizen ───────────────────────────────────────────────────────────────

  async function handleAddNotiz(text: string) {
    if (!camp || !user) return;
    const notiz: CampNotiz = {
      id: neueId(),
      text,
      authorUid: user.uid,
      authorName:
        profile?.displayName?.trim() ||
        user.displayName?.trim() ||
        user.email ||
        "Trainer",
      createdAt: Date.now(),
    };
    await addCampNotiz(uid, campId, notiz, ownerFlag());
    setCamp((prev) =>
      prev ? { ...prev, notizen: [...prev.notizen, notiz] } : prev,
    );
  }

  async function handleRemoveNotiz(notiz: CampNotiz) {
    if (!camp) return;
    await removeCampNotiz(uid, campId, notiz, ownerFlag());
    setCamp((prev) =>
      prev
        ? { ...prev, notizen: prev.notizen.filter((n) => n.id !== notiz.id) }
        : prev,
    );
  }

  // ── Anker auf die laufende Phase ──────────────────────────────────────────

  function springeZumPlan(
    e: React.MouseEvent<HTMLAnchorElement>,
    ziel: string,
  ) {
    const el = document.getElementById(ziel);
    if (!el) return; // dann macht der Browser den Sprung über den href
    e.preventDefault();
    el.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });
    window.history.replaceState(null, "", `#${ziel}`);
  }

  if (error && !camp) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:max-w-5xl">
        <ErrorState
          title="Wettkampf konnte nicht geladen werden"
          message={error}
          onRetry={load}
        />
      </div>
    );
  }

  if (!camp) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:max-w-5xl">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 w-full rounded-card" />
          <Skeleton className="h-24 w-full rounded-card" />
          <Skeleton className="h-64 w-full rounded-card" />
        </div>
      </div>
    );
  }

  const group = competitionGroup(camp);
  const progress = fightCampProgress(camp);
  const planAnker = progress.currentPhase
    ? phaseAnchorId(progress.currentPhase)
    : "trainingsplan";
  // Angezeigt wird der Snapshot, ergänzt um Antworten, die inzwischen im
  // verknüpften Profil dazugekommen sind. Speichern friert genau diesen Stand ein.
  // DAS LEBENDE PROFIL GEWINNT (Leon 11.09.: bearbeiten heißt immer für
  // alle). Der Snapshot im Camp ist nur noch der Rückfall, wenn das Profil
  // gelöscht oder nicht lesbar ist.
  const effOpponent: OpponentProfile = opponent
    ? opponentToSnapshot(opponent)
    : camp.opponent;
  const oppId = campOpponentId(camp);
  const studentName =
    student?.displayName ??
    student?.authProviderName ??
    student?.email ??
    "Athlet";
  const istSelbst = eigeneUid === uid;

  const gegnerMeta = [
    FIGHT_STYLE_LABEL[effOpponent.style],
    FIGHTER_STANCE_LABEL[effOpponent.stance],
    effOpponent.heightCm ? `${effOpponent.heightCm} cm` : null,
    effOpponent.weightKg ? `${effOpponent.weightKg} kg` : null,
    effOpponent.reachCm ? `Reach ${effOpponent.reachCm} cm` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const athletMeta = profilGesperrt
    ? "Kampfprofil noch nicht freigegeben"
    : fightProfile
      ? `${istSelbst ? "Ich selbst" : "Unser Athlet"} · DNA ${dnaCompleteness(fightProfile.dna)} %`
      : istSelbst
        ? "Ich selbst"
        : "Unser Athlet";

  const gezeigterName = seite === "gegner" ? effOpponent.name : studentName;
  const gezeigteMeta = seite === "gegner" ? gegnerMeta : athletMeta;
  const gezeigteAnzahl = anzahl[seite];
  // Analysieren geht beim Gegner nur mit verknüpftem Profil — der reine
  // Snapshot hat keine Sammlung, in die eine Analyse fallen könnte.
  const kannAnalysieren =
    seite === "athlet" ? !profilGesperrt : Boolean(oppId && opponent);
  const analyseOffen = analyseOffenFuer === seite;

  return (
    <main
      className="min-h-screen"
      style={{ background: "var(--surface-page)", color: "var(--text-body)" }}
    >
      <div aria-hidden={!seiteSichtbar} style={einblenden}>
        <PageHead
          back={{ href: "/trainer/competitions", label: "Wettkampfbereich" }}
          title={camp.competitionName}
          description={
            /* Nur Datum und Countdown, etwas größer (Leon 12.09.): Wer
               kämpft, steht groß im Vs.-Banner direkt darunter — die Zeile
               „Leon · vs Paul" wiederholte es nur. */
            <span style={{ font: "var(--type-h3)", color: "var(--text-2)" }}>
              {formatDate(camp.competitionDate)}
              {progress.daysRemaining > 0 && group === "upcoming" && (
                <> · noch {progress.daysRemaining} Tage</>
              )}
            </span>
          }
          aside={
            /* Am Desktop AUS DEM FLUSS des Kopfes: Läge die Karte im Fluss,
               schöbe sie beim Aufgehen das Banner nach unten. Absolut im
               Kopf verankert, wächst sie nach UNTEN über die Seite hinweg.
               `top-14` statt `top-7` — Leon 12.09.: „etwas tiefer oben
               beginnen lassen"; die Karte steht damit auf Höhe des Titels
               und nicht mehr über ihm. KEIN `bottom` mehr: Die zwei Maße
               stehen in `.camp-notizen` (globals.css), der Fokus schaltet
               zwischen ihnen um. Der Kopf reserviert ihr weiter die 380 px
               Breite; am Handy steht sie im Fluss. */
            <div className="w-full lg:absolute lg:right-6 lg:top-14 lg:z-30 lg:w-[380px]">
              <CampNotizen
                notizen={camp.notizen}
                eigeneUid={eigeneUid}
                onAdd={handleAddNotiz}
                onRemove={handleRemoveNotiz}
              />
            </div>
          }
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className="inline-flex w-fit rounded-badge px-2 py-1"
              style={{
                ...META_FONT,
                background: "var(--surface-raised)",
                border: `1px solid ${GROUP_ACCENT[group]}`,
                color: GROUP_ACCENT[group],
              }}
            >
              {GROUP_LABEL[group]}
            </span>

            {/* Der Anker: springt auf die LAUFENDE Phase des Plans, nicht auf
              seine Überschrift — wer hier klickt, will wissen, was diese
              Woche dran ist. Ohne laufende Phase (Camp vorbei oder noch nicht
              gestartet) landet er auf der Überschrift. */}
            <a
              href={`#${planAnker}`}
              onClick={(e) => springeZumPlan(e, planAnker)}
              data-press
              className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-4"
              style={PRIMARY_BTN}
            >
              <Icon name="chevron-down" size={13} strokeWidth={2.6} />
              Trainingsplan
            </a>
          </div>
        </PageHead>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-7 sm:px-6 lg:max-w-5xl">
        {error && (
          <div className="mb-5">
            <ErrorState title="Fehler" message={error} onRetry={load} />
          </div>
        )}

        {/* ── Vs. ─────────────────────────────────────────────────────────
            Das Banner nach Leons Vorlage. Die gewählte Seite entscheidet,
            wessen DeepFight darunter steht. */}
        <VersusBanner
          athletName={studentName}
          athletRolle={istSelbst ? "Ich selbst" : "Unser Athlet"}
          gegnerName={effOpponent.name}
          aktiv={seite}
          onChange={setSeite}
          introKey={camp.id}
          onIntroAusklang={() => setSeiteSichtbar(true)}
        />

        <div aria-hidden={!seiteSichtbar} style={einblenden}>
          {/* ── DeepFight — rahmenlos ────────────────────────────────────── */}
          <section className="mt-8" aria-live="polite">
            {/* Handy: Name über der Knopfreihe. Nebeneinander blieben dem
              Namen auf 390 px rund 110 px, und „Paul the Fighter" brach zu
              „Figh / ter" (gemessen 11.09.). */}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-x-4">
              <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                {/* Noch einmal größer als in der Kachel: Man soll auf einen
                  Blick sehen, WESSEN Profil hier steht. Keine Versalien —
                  ein Name ist Inhalt. */}
                <h2
                  className="break-words"
                  style={{ font: "var(--type-display)", letterSpacing: "0" }}
                >
                  {gezeigterName}
                </h2>
                {gezeigteMeta && (
                  <p
                    className="mt-1"
                    style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
                  >
                    {gezeigteMeta}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 sm:shrink-0">
                {/* Der Weg zum GETEILTEN Profil — bearbeiten heißt immer für
                  alle (Leon 11.09.).

                  EIN WORT STATT EINES NACKTEN STIFTS (Leon 12.09.: „das
                  Zeichen ist schlecht zu sehen, zu klein, und es gefällt mir
                  nicht"). Der 16-px-Stift in `--text-2` stand ohne Fläche
                  neben einem 48 px hohen Regenbogen-Plus — er war weder zu
                  finden noch zu deuten. Kein anderes Symbol hätte das
                  gelöst: Die Frage war nicht, WELCHES Zeichen, sondern ob
                  ein Zeichen allein hier reicht. Es reicht nicht, denn
                  „bearbeiten" führt hier auf eine ANDERE Seite und ändert
                  das Profil für alle — das ist zu folgenreich für ein
                  Rätsel. Jetzt: eine ruhige Pille in der Sprache der
                  Statuszeile darüber, mit Rahmen, Wort und einem Stift auf
                  18 px. Sie steht links vom Plus und tritt ihm damit nicht
                  in die Farbe. */}
                {seite === "gegner" && oppId && (
                  <Link
                    href={`/trainer/deepfight/gegner/${oppId}`}
                    aria-label="Gegner bearbeiten — im geteilten Profil, für alle"
                    title="Öffnet das geteilte Gegnerprofil; Änderungen gelten für alle"
                    data-press
                    className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-pill px-3.5"
                    style={{
                      ...META_FONT,
                      border: "1px solid var(--line)",
                      color: "var(--text-body)",
                    }}
                  >
                    <Icon name="edit" size={18} strokeWidth={2.2} />
                    Bearbeiten
                  </Link>
                )}
                {/* Erst nur das Plus im Regenbogen, unter dem Zeiger wächst
                  „Analyse" heraus; offen wird es zum Kreuz. */}
                {kannAnalysieren && (
                  <button
                    type="button"
                    onClick={() =>
                      setAnalyseOffenFuer(analyseOffen ? null : seite)
                    }
                    aria-expanded={analyseOffen}
                    aria-label={analyseOffen ? "Analyse schließen" : "Analyse"}
                    className="df-start df-plus"
                  >
                    <span aria-hidden>{analyseOffen ? "×" : "+"}</span>
                    <span className="df-plus-label" aria-hidden>
                      {analyseOffen ? "Schließen" : "Analyse"}
                    </span>
                  </button>
                )}
                {/* Das Funkeln allein, mit der Zahl der Analysen zu diesem
                  Profil — Ausnahme von §1.6, siehe Kopf der Datei. */}
                <span
                  className="inline-flex items-center gap-2"
                  title={
                    gezeigteAnzahl === null
                      ? "Analysen nicht lesbar"
                      : `${gezeigteAnzahl} ${gezeigteAnzahl === 1 ? "Analyse" : "Analysen"} zu diesem Profil — die DNA wächst erst mit der Übernahme`
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/deepfight-icon.png"
                    alt=""
                    aria-hidden="true"
                    className="h-8 w-auto shrink-0"
                  />
                  <span
                    style={{
                      font: "var(--type-num-xl)",
                      fontVariantNumeric: "tabular-nums",
                      color: "var(--text-body)",
                    }}
                  >
                    {gezeigteAnzahl ?? "–"}
                  </span>
                  <span className="sr-only">
                    {gezeigteAnzahl === 1 ? "Analyse" : "Analysen"}
                  </span>
                </span>
              </div>
            </div>

            {/* Die Auswertungen des Ziels, hier aufgeklappt. Pro Ziel neu
              gemountet (key). Seit Etappe 2 (16.09.2026) ohne Ablage — ein
              neues Video läuft über den Upload-Fluss, der Knopf in der
              Sektion führt hin. Sie sitzt in einer Karte, weil sie keine
              eigene mitbringt. */}
            <Collapse open={analyseOffen && kannAnalysieren}>
              <div className="t-card mt-5 p-4 sm:p-5">
                {seite === "athlet" ? (
                  fightProfile ? (
                    <VideoAnalysisSection
                      key={`leute:${uid}`}
                      mode="athlete"
                      targetId={uid}
                      targetName={studentName}
                      onFightProfileUpdated={() => void reloadFightProfile()}
                      onAnalysesLoaded={(n) =>
                        setAnzahl((prev) => ({ ...prev, athlet: n }))
                      }
                    />
                  ) : (
                    <Skeleton className="h-32 w-full rounded-field" />
                  )
                ) : opponent ? (
                  <VideoAnalysisSection
                    key={`gegner:${opponent.id}`}
                    mode="opponent"
                    targetId={opponent.id}
                    targetName={opponent.name}
                    onOpponentUpdated={() => void reloadOpponent()}
                    onAnalysesLoaded={(n) =>
                      setAnzahl((prev) => ({ ...prev, gegner: n }))
                    }
                  />
                ) : (
                  <Skeleton className="h-32 w-full rounded-field" />
                )}
              </div>
            </Collapse>

            {/* Der Inhalt je Seite — dieselbe Stelle, verwandelt sich. */}
            <div className="mt-5">
              <MorphSwap activeKey={seite}>
                {seite === "gegner" ? (
                  <div className="flex flex-col gap-5">
                    {/* Stärken, Schwächen, Waffen und Notiz — rahmenlos.
                        Vorher standen sie in der Grunddaten-Karte, die mit
                        dem Namen im Kopf überflüssig wurde. Dieselben drei
                        Zeichen wie in OpponentProfileView und im Plan:
                        + Stärke, − Schwäche, ★ worauf sich der Athlet
                        vorbereiten muss. */}
                    <GlanceRows opponent={effOpponent} />

                    <OpponentProfileView
                      showBasics={false}
                      opponent={{
                        name: effOpponent.name,
                        style: effOpponent.style,
                        stance: effOpponent.stance,
                        heightCm: effOpponent.heightCm,
                        weightKg: effOpponent.weightKg,
                        reachCm: effOpponent.reachCm,
                        strengths: effOpponent.strengths,
                        weaknesses: effOpponent.weaknesses,
                        favoriteAttacks: effOpponent.favoriteAttacks,
                        notes: effOpponent.notes ?? null,
                        dna: effOpponent.dna ?? {},
                        dnaSplit: effOpponent.dnaSplit,
                        actionStats: effOpponent.actionStats,
                      }}
                    />
                  </div>
                ) : profilGesperrt ? (
                  <div className="flex flex-col gap-1.5">
                    <span className="t-label">Noch nicht freigegeben</span>
                    <p style={{ font: "var(--type-body-strong)" }}>
                      {studentName} entscheidet selbst, wer die eigenen
                      DeepFight-Analysen sieht.
                    </p>
                    <p
                      style={{
                        font: "var(--type-sub)",
                        color: "var(--text-2)",
                      }}
                    >
                      Der Wettkampf ist für dich frei, das Kampfprofil dahinter
                      noch nicht. Sobald du freigeschaltet bist, steht es hier.
                    </p>
                  </div>
                ) : !fightProfile ? (
                  <div className="flex flex-col gap-3">
                    <Skeleton className="h-16 w-full rounded-field" />
                    <Skeleton className="h-40 w-full rounded-field" />
                  </div>
                ) : isFightProfileEmpty(fightProfile) ? (
                  /* DER WIDERSPRUCH, DEN LEON AM 12.09. GEFUNDEN HAT: Neben
                     dem Funkeln stand „2", darunter „DNA 0 %" und „Profil ist
                     noch leer". Beides stimmt — die Zahl zählt die ANALYSEN,
                     die zu diesem Profil liegen, das Profil selbst füllt sich
                     aber erst, wenn ein Trainer die Befunde ÜBERNIMMT
                     (`appliedFindingIds` / `appliedStats`, lib/video-analysis.ts).
                     Zwei Analysen ohne Übernahme sind also kein Fehler,
                     sondern offene Arbeit. Nur gesagt hat es niemand — der
                     Text sagt es jetzt. */
                  <div className="flex flex-col gap-1.5">
                    <p style={{ font: "var(--type-body-strong)" }}>
                      {istSelbst
                        ? "Dein Kampfprofil ist noch leer."
                        : `Das Kampfprofil von ${studentName} ist noch leer.`}
                    </p>
                    <p
                      style={{
                        font: "var(--type-sub)",
                        color: "var(--text-2)",
                      }}
                    >
                      {gezeigteAnzahl && gezeigteAnzahl > 0 ? (
                        <>
                          {gezeigteAnzahl === 1
                            ? "Eine Analyse liegt bereit, aber sie ist noch nicht übernommen."
                            : `${gezeigteAnzahl} Analysen liegen bereit, aber keine davon ist übernommen.`}{" "}
                          Öffne &bdquo;+ Analyse&ldquo;, geh die Auswertung
                          durch und übernimm die Befunde — erst damit wächst
                          die DNA.
                        </>
                      ) : (
                        <>
                          Analysier ein Kampf-Video über &bdquo;+ Analyse&ldquo;
                          und übernimm die Befunde — ab dann wächst das Profil
                          hier mit jedem Video.
                        </>
                      )}
                    </p>
                  </div>
                ) : (
                  <FightProfileView
                    dna={fightProfile.dna}
                    dnaSplit={fightProfile.dnaSplit}
                    actionStats={fightProfile.actionStats}
                  />
                )}
              </MorphSwap>
            </div>
          </section>

          {/* Trainingsplan (4 Phasen) */}
          <div
            className="mt-10"
            id="trainingsplan"
            style={{ scrollMarginTop: "6rem" }}
          >
            <h2
              className="mb-3"
              style={{
                font: "var(--type-h2)",
                letterSpacing: "var(--ls-display)",
                textTransform: "uppercase",
              }}
            >
              Trainingsplan
            </h2>
            <FightCampPlanView camp={camp} showOpponent={false} />
          </div>

          {/* Gefahrenzone */}
          {/* ── Löschen — Inline-Rückfrage statt Browser-Popup ──────────────
            Vorher stand hier `confirm()`. Das Fenster kommt vom BROWSER: Es
            trägt dessen Schrift, dessen Knöpfe und die Zeile „Auf
            localhost:3000 wird Folgendes angezeigt" — mitten in einer App,
            die sonst jede Fläche selbst gestaltet. Es lässt sich weder
            beschriften noch gestalten, und in einer Capacitor-WebView sieht
            es wieder anders aus.
            Der Knopf verwandelt sich stattdessen in die Rückfrage (MorphSwap
            misst die neue Breite und federt dorthin) — dasselbe Muster wie
            beim Trainer-Plan. Rot ist er schon im Ruhezustand: Was endgültig
            löscht, soll man vor dem Klick erkennen, nicht erst danach. */}
          <div
            className="mt-8 border-t pt-4"
            style={{ borderColor: "var(--line)" }}
          >
            <MorphSwap
              activeKey={confirmDelete ? "confirm" : "idle"}
              innerClassName="flex flex-wrap items-center gap-3"
            >
              {confirmDelete ? (
                <>
                  <span
                    style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
                  >
                    Wettkampf wirklich löschen? Das Camp samt Plan, Notizen und
                    Gegner-Snapshot ist danach weg.
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={deleting}
                    className="t-danger-strong t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-4 disabled:opacity-50"
                    style={BTN_FONT}
                  >
                    <Icon name="trash" size={13} strokeWidth={2.2} />
                    {deleting ? "Lösche…" : "Endgültig löschen"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                    className="t-interactive inline-flex min-h-hit items-center rounded-field px-4 disabled:opacity-50"
                    style={{ ...BTN_FONT, color: "var(--text-3)" }}
                  >
                    Abbrechen
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="t-danger t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-4"
                  style={BTN_FONT}
                >
                  <Icon name="trash" size={13} strokeWidth={2.2} />
                  Wettkampf löschen
                </button>
              )}
            </MorphSwap>
          </div>
        </div>
      </div>
    </main>
  );
}

/** Stärken / Schwächen / Waffen / Notiz des Gegners, ohne Karte drumherum. */
function GlanceRows({ opponent }: { opponent: OpponentProfile }) {
  const zeilen: {
    icon: "plus" | "minus" | "star";
    color: string;
    text: string;
  }[] = [];
  if (opponent.strengths.length > 0)
    zeilen.push({
      icon: "plus",
      color: "var(--positive)",
      text: opponent.strengths.join(", "),
    });
  if (opponent.weaknesses.length > 0)
    zeilen.push({
      icon: "minus",
      color: "var(--negative)",
      text: opponent.weaknesses.join(", "),
    });
  if (opponent.favoriteAttacks.length > 0)
    zeilen.push({
      icon: "star",
      color: "var(--warning)",
      text: opponent.favoriteAttacks.join(", "),
    });
  if (zeilen.length === 0 && !opponent.notes) return null;

  return (
    <div className="flex flex-col gap-1.5" style={{ font: "var(--type-sub)" }}>
      {zeilen.map((z) => (
        <div key={z.icon} className="flex items-start gap-1.5">
          <span
            aria-hidden
            style={{
              color: z.color,
              flexShrink: 0,
              marginTop: "2px",
              lineHeight: 0,
            }}
          >
            <Icon name={z.icon} size={13} strokeWidth={2.8} />
          </span>
          <span style={{ color: "var(--text-2)" }}>{z.text}</span>
        </div>
      ))}
      {opponent.notes && (
        <p className="italic" style={{ color: "var(--text-3)" }}>
          &bdquo;{opponent.notes}&ldquo;
        </p>
      )}
    </div>
  );
}

export default function CompetitionDetailPage({
  params,
}: {
  params: { uid: string; campId: string };
}) {
  return <CompetitionDetailContent uid={params.uid} campId={params.campId} />;
}
