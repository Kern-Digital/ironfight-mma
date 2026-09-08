"use client";

/**
 * DeepFight — die Landung des Bereichs: die WERKBANK.
 *
 * Leons Neuaufbau (05.09.2026): „In der Trainerleiste soll es nur DeepFight
 * geben. Ich gehe auf DeepFight, habe dort direkt mein Upload-Fenster und
 * kann in diesem Fenster auswählen zwischen Schüler, Gegner und mich
 * analysieren. Je nachdem verfärbt sich die ganze Seite." Die drei früheren
 * Menüpunkte waren drei Türen zu EINEM Werkzeug — wen du analysierst, ist ein
 * PARAMETER, kein Ort. Deshalb steht die Ziel-Auswahl HIER, in der Werkbank,
 * und nicht in der Navigation.
 *
 * AUFBAU (Leons Ansage, oben nach unten):
 *   1. „Meine Analysen" als Knopf — Leons Entscheidung 07.09.: eine EIGENE
 *      Liste dessen, was ICH analysiert habe, quer über Gegner und Athleten.
 *      Ein Tipp auf einen Eintrag stellt das Ziel ein und klappt das Ergebnis
 *      auf.
 *   2. Darunter direkt das Analysieren-Feld: „Wen analysierst du?" — Unsere
 *      Leute gegen Gegner (der Modus, er färbt den Bereich), dann die
 *      Ziel-Auswahl. Nach der Wahl klappt sie per MorphSwap zur schmalen
 *      Zeile zusammen, darunter wächst die Ablage (VideoAnalysisSection) auf.
 *
 * DIE ZIEL-AUSWAHL IST DIE EINE STELLE FÜR DIE RECHTE (UX-Punkt 2 des
 * Brainstorms): Kollegen erscheinen nur mit ihrer Freigabe im Bereich
 * `deepfight` (`darfSehen`), Ghost-Konten fehlen (`isGhostAccount`). Damit
 * stirbt die Sackgasse „anklicken → noch nicht freigegeben". Der Maßstab ist
 * die Athleten-Auswahl in /trainer/competitions/new.
 *
 * ZIEL WECHSELN VERSCHLUCKT KEINE ANGEFANGENE ANALYSE: VideoAnalysisSection
 * hält ihren Zwischenstand je Ziel im localStorage
 * (`ta-video-analysis-form:{modus}:{zielId}`, bis 48 h wertvoll). Die Sektion
 * wird pro Ziel neu gemountet (`key`), damit kein Formular-Zustand von einem
 * Ziel ins nächste rutscht — der Zwischenstand liegt ohnehin im Speicher.
 *
 * DAS ZIEL BLEIBT GEMERKT (`ta-deepfight-ziel`) und ist per Adresse
 * verlinkbar (`?modus=leute&ziel=<uid>` bzw. `?modus=gegner&ziel=<id>`) — so
 * kommen „Meine Analyse starten" aus dem Kampfprofil und die Detailseiten
 * hierher.
 *
 * „MEINE ANALYSEN" LIEST HEUTE PER FÄCHER: eine Abfrage je Ziel (Gegner der
 * Bibliothek, dazu jedes sichtbare Mitglied), gefiltert auf `createdBy`.
 * Das sind rund dreißig kleine Abfragen — erst beim Öffnen, nie beim Laden
 * der Seite. Der saubere Weg ist eine collectionGroup-Query auf
 * `videoAnalyses` mit einer Regel, die allein aus dem Dokument beweisbar ist
 * (`createdBy` UND ein `gymId` am Dokument, das es heute nicht gibt — also
 * Backfill, Index, Deploy). Das ist ein eigener Schritt (Backlog, CLAUDE.md);
 * bis dahin trägt der Fächer, und er kostet pro Öffnen so viel wie eine
 * Handvoll Seitenaufrufe.
 *
 * VideoAnalysisSection ist hier nur EINGEBETTET (Teilschritt 2). Der Umbau
 * der Sektion selbst — Ziel von außen, Ziehen-und-Fallenlassen, sichtbarer
 * Zwischenstand — ist Teilschritt 4; nichts an der Pipeline ändert sich.
 */

import { Collapse, FlowItem, MorphSwap, StaggerFlow } from "@/components/motion";
import {
  useDeepFightModus,
  type DeepFightModus,
} from "@/components/deepfight/deepfight-modus";
import DnaCompletenessRing from "@/components/trainer/DnaCompletenessRing";
import VideoAnalysisSection from "@/components/trainer/VideoAnalysisSection";
import ErrorState from "@/components/ui/ErrorState";
import GooeySearch from "@/components/ui/GooeySearch";
import Icon from "@/components/ui/Icon";
import Skeleton from "@/components/ui/Skeleton";
import {
  getMemberEntry,
  isGhostAccount,
  isPermissionDenied,
  isStaffEntry,
  listAllMembers,
  type StudentEntry,
} from "@/lib/admin";
import { useAuth } from "@/lib/auth-context";
import { FIGHT_STYLE_LABEL } from "@/lib/fight-camp";
import { getFightProfile, type FightProfile } from "@/lib/fight-profile";
import { DNA_CATEGORIES, answeredCount, dnaCompleteness } from "@/lib/gegner-dna";
import { resolveGymId } from "@/lib/gym";
import {
  getOpponent,
  listOpponentsForGym,
  searchOpponents,
  type Opponent,
} from "@/lib/opponents";
import { darfSehen } from "@/lib/profile-sharing";
import { listVideoAnalyses, type VideoAnalysis } from "@/lib/video-analysis";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// ─── Schnitte (wie in competitions/new und der Athletenliste) ────────────────

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

/** Wo das zuletzt gewählte Ziel liegt — überlebt Reload und Fensterwechsel. */
const ZIEL_KEY = "ta-deepfight-ziel";

function labelOf(s: StudentEntry): string {
  return s.displayName ?? s.authProviderName ?? s.email ?? s.uid;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Wie viele der neun Kategorien mindestens eine Antwort tragen. */
function abgedeckt(dna: Record<string, string>): number {
  return DNA_CATEGORIES.filter((c) => answeredCount(c, dna) > 0).length;
}

// ─── Modus-Schalter ──────────────────────────────────────────────────────────

const MODI: { key: DeepFightModus; label: string; icon: "user" | "target"; hinweis: string }[] = [
  {
    key: "leute",
    label: "Unsere Leute",
    icon: "user",
    hinweis:
      "Athleten und Trainer deines Gyms, dich selbst eingeschlossen. Was du übernimmst, landet im Kampfprofil der Person.",
  },
  {
    key: "gegner",
    label: "Gegner",
    icon: "target",
    hinweis:
      "Die Gegner-Bibliothek deines Gyms. Was du übernimmst, landet im DeepFight-Profil, mit dem dein ganzes Team arbeitet.",
  },
];

// ─── Eine Zeile der Ziel-Auswahl (Maßstab: AthleteCard in competitions/new) ──

function ZielZeile({
  name,
  sub,
  active,
  onSelect,
}: {
  name: string;
  sub: string | null;
  active: boolean;
  onSelect: () => void;
}) {
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
          ...META_FONT,
          background: active ? "var(--accent)" : "var(--surface-card)",
          color: active ? "var(--on-accent)" : "var(--text-3)",
        }}
      >
        {initialsOf(name)}
      </span>
      <span className="min-w-0">
        <span
          className="block truncate"
          style={{
            font: "var(--type-body-strong)",
            color: active ? "var(--accent-text)" : "var(--text-body)",
          }}
        >
          {name}
        </span>
        {sub && (
          <span className="block truncate" style={{ ...META_FONT, color: "var(--text-3)" }}>
            {sub}
          </span>
        )}
      </span>
    </button>
  );
}

function ZielGruppe({
  title,
  children,
  count,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div>
      <p className="t-label mb-2">{title}</p>
      {/* Die Suche filtert live — bleibende Namen rutschen an ihren neuen
          Platz (MOTION-BRIEF §3.7, Schlüssel ist die ID). */}
      <StaggerFlow className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </StaggerFlow>
    </div>
  );
}

// ─── „Meine Analysen" ────────────────────────────────────────────────────────

interface MeineAnalyse {
  analyse: VideoAnalysis;
  modus: DeepFightModus;
  zielId: string;
  zielName: string;
}

function zustandVon(a: VideoAnalysis): { text: string; ton: "fertig" | "offen" } {
  if (a.appliedStats || a.appliedFindingIds.length > 0) {
    return { text: "Übernommen", ton: "fertig" };
  }
  return { text: "Offen", ton: "offen" };
}

// ─── Seite ───────────────────────────────────────────────────────────────────

function WerkbankContent() {
  const { user, profile } = useAuth();
  const gymId = resolveGymId(profile);
  const eigeneUid = user?.uid ?? "";
  const searchParams = useSearchParams();
  const { setModus: setBereichsModus } = useDeepFightModus();

  const [modus, setModus] = useState<DeepFightModus>("leute");
  const [zielId, setZielId] = useState<string | null>(null);
  const initRef = useRef(false);

  const [members, setMembers] = useState<StudentEntry[] | null>(null);
  const [opponents, setOpponents] = useState<Opponent[] | null>(null);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Das gewählte Ziel samt Merge-Ziel — je Modus eine Form.
  const [zielLeute, setZielLeute] = useState<{ entry: StudentEntry; profil: FightProfile } | null>(null);
  const [zielGegner, setZielGegner] = useState<Opponent | null>(null);
  const [zielGesperrt, setZielGesperrt] = useState<string | null>(null);
  const [zielFehler, setZielFehler] = useState<string | null>(null);
  const [videoCount, setVideoCount] = useState<number | null>(null);
  const [expandId, setExpandId] = useState<string | null>(null);

  const [meineOffen, setMeineOffen] = useState(false);
  const [meine, setMeine] = useState<MeineAnalyse[] | null>(null);
  const [meineFehler, setMeineFehler] = useState<string | null>(null);

  // Der Modus färbt den ganzen Bereich — das Layout hört über den Context.
  useEffect(() => setBereichsModus(modus), [modus, setBereichsModus]);

  // ── Startzustand: Adresse schlägt Speicher ────────────────────────────────
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    const m = searchParams.get("modus");
    const z = searchParams.get("ziel");
    if ((m === "leute" || m === "gegner") && z) {
      setModus(m);
      setZielId(z);
      return;
    }
    try {
      const raw = localStorage.getItem(ZIEL_KEY);
      if (raw) {
        const s = JSON.parse(raw) as { modus?: DeepFightModus; zielId?: string | null };
        if (s.modus === "leute" || s.modus === "gegner") setModus(s.modus);
        if (typeof s.zielId === "string") setZielId(s.zielId);
      }
    } catch {
      /* defekter Eintrag — ignorieren */
    }
  }, [searchParams]);

  useEffect(() => {
    if (!initRef.current) return;
    try {
      localStorage.setItem(ZIEL_KEY, JSON.stringify({ modus, zielId }));
    } catch {
      /* Speicher voll/blockiert — das Merken ist Komfort, kein Muss */
    }
  }, [modus, zielId]);

  // ── Listen für die Auswahl ────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLadeFehler(null);
    try {
      const [m, o] = await Promise.all([
        listAllMembers(gymId),
        listOpponentsForGym(gymId).catch(() => [] as Opponent[]),
      ]);
      setMembers(m);
      setOpponents(o);
    } catch (err) {
      setLadeFehler(err instanceof Error ? err.message : "Unbekannter Fehler");
      setMembers([]);
      setOpponents([]);
    }
  }, [gymId]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Wer in „Unsere Leute" steht: ich selbst, Kollegen NUR mit Freigabe im
   * Bereich `deepfight`, Athleten — und keine Ghost-Konten. Dieselbe Regel
   * wie in „Neuer Wettkampf" (dort für `wettkampf`).
   */
  const leute = useMemo(() => {
    const q = search.trim().toLowerCase();
    const alle = (members ?? []).filter(
      (s) =>
        !q ||
        labelOf(s).toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q),
    );
    const self = alle.find((s) => s.uid === eigeneUid) ?? null;
    const staff = alle
      .filter(
        (s) =>
          s.uid !== eigeneUid &&
          isStaffEntry(s) &&
          !isGhostAccount(s) &&
          darfSehen(s.profileShares, "deepfight", eigeneUid),
      )
      .sort((a, b) => labelOf(a).localeCompare(labelOf(b), "de"));
    const students = alle.filter((s) => s.uid !== eigeneUid && !isStaffEntry(s));
    return { self, staff, students };
  }, [members, search, eigeneUid]);

  const gegnerListe = useMemo(
    () => searchOpponents(opponents ?? [], search),
    [opponents, search],
  );

  // ── Das gewählte Ziel laden ───────────────────────────────────────────────
  const ladeProfil = useCallback(async (uid: string) => {
    const profil = await getFightProfile(uid);
    setZielLeute((prev) => (prev && prev.entry.uid === uid ? { ...prev, profil } : prev));
    return profil;
  }, []);

  const ladeGegner = useCallback(async (id: string) => {
    const o = await getOpponent(id);
    if (o) setZielGegner(o);
  }, []);

  useEffect(() => {
    let alive = true;
    setZielLeute(null);
    setZielGegner(null);
    setZielGesperrt(null);
    setZielFehler(null);
    setVideoCount(null);
    if (!zielId) return;
    (async () => {
      try {
        if (modus === "leute") {
          const entry = await getMemberEntry(zielId);
          if (!entry) throw new Error("Athlet nicht gefunden");
          const profil = await getFightProfile(zielId);
          if (alive) setZielLeute({ entry, profil });
        } else {
          const o = await getOpponent(zielId);
          if (!o) throw new Error("DeepFight-Profil nicht gefunden");
          if (alive) setZielGegner(o);
        }
      } catch (err) {
        if (!alive) return;
        if (isPermissionDenied(err)) {
          // Ein Kollege ohne Freigabe — per Adresse hierher gekommen, die
          // Auswahl hätte ihn gar nicht angeboten.
          const wer = await getMemberEntry(zielId).catch(() => null);
          setZielGesperrt(wer ? labelOf(wer) : "Dieser Trainer");
          return;
        }
        setZielFehler(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    })();
    return () => {
      alive = false;
    };
  }, [modus, zielId]);

  function waehleModus(m: DeepFightModus) {
    if (m === modus) return;
    setModus(m);
    setZielId(null);
    setSearch("");
    setExpandId(null);
  }

  function waehleZiel(id: string) {
    setZielId(id);
    setSearch("");
  }

  // ── „Meine Analysen" per Fächer laden (siehe Kopfkommentar) ──────────────
  const ladeMeine = useCallback(async () => {
    if (!members || !opponents) return;
    setMeineFehler(null);
    try {
      const sichtbar = members.filter(
        (s) =>
          s.uid === eigeneUid ||
          (!isStaffEntry(s) && !isGhostAccount(s)) ||
          (isStaffEntry(s) &&
            !isGhostAccount(s) &&
            darfSehen(s.profileShares, "deepfight", eigeneUid)),
      );
      const abfragen: Promise<MeineAnalyse[]>[] = [
        ...opponents.map((o) =>
          listVideoAnalyses("opponent", o.id)
            .then((liste) =>
              liste.map((analyse) => ({
                analyse,
                modus: "gegner" as const,
                zielId: o.id,
                zielName: o.name,
              })),
            )
            .catch(() => [] as MeineAnalyse[]),
        ),
        ...sichtbar.map((s) =>
          listVideoAnalyses("athlete", s.uid)
            .then((liste) =>
              liste.map((analyse) => ({
                analyse,
                modus: "leute" as const,
                zielId: s.uid,
                zielName: labelOf(s),
              })),
            )
            .catch(() => [] as MeineAnalyse[]),
        ),
      ];
      const alle = (await Promise.all(abfragen)).flat();
      setMeine(
        alle
          .filter((e) => e.analyse.createdBy === eigeneUid)
          .sort((a, b) => b.analyse.createdAt.getTime() - a.analyse.createdAt.getTime()),
      );
    } catch (err) {
      setMeineFehler(err instanceof Error ? err.message : "Unbekannter Fehler");
      setMeine([]);
    }
  }, [members, opponents, eigeneUid]);

  useEffect(() => {
    if (meineOffen && meine === null) ladeMeine();
  }, [meineOffen, meine, ladeMeine]);

  function oeffneAnalyse(e: MeineAnalyse) {
    setModus(e.modus);
    setZielId(e.zielId);
    setExpandId(e.analyse.id);
    setMeineOffen(false);
  }

  // ── Anzeige-Werte des gewählten Ziels ─────────────────────────────────────
  const zielName =
    modus === "leute" ? (zielLeute ? labelOf(zielLeute.entry) : null) : zielGegner?.name ?? null;
  const zielDna =
    modus === "leute" ? zielLeute?.profil.dna ?? null : zielGegner?.dna ?? null;
  const zielGeladen = modus === "leute" ? !!zielLeute : !!zielGegner;
  const zielSub =
    modus === "leute"
      ? zielLeute
        ? zielLeute.entry.uid === eigeneUid
          ? "Ich selbst"
          : isStaffEntry(zielLeute.entry)
            ? "Trainer"
            : "Athlet"
        : null
      : zielGegner
        ? FIGHT_STYLE_LABEL[zielGegner.style]
        : null;

  const listenBereit = members !== null && opponents !== null;

  return (
    <main className="min-h-screen pb-12" style={{ color: "var(--text-body)" }}>
      <h1 className="sr-only">DeepFight</h1>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 pt-4 sm:px-6">
        {ladeFehler && (
          <ErrorState
            title="Daten konnten nicht geladen werden"
            message={ladeFehler}
            onRetry={load}
          />
        )}

        {/* ── 1. Meine Analysen — der Knopf oben ──────────────────────────── */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setMeineOffen((v) => !v)}
            aria-expanded={meineOffen}
            data-press="surface"
            className="t-card t-interactive flex min-h-hit w-full items-center gap-3 px-4 py-2.5 text-left sm:w-fit sm:min-w-[280px]"
          >
            <span className="flex shrink-0 items-center" style={{ color: "var(--accent-text)" }}>
              <Icon name="video" size={18} strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1" style={{ font: "var(--type-body-strong)" }}>
              Meine Analysen
            </span>
            {meine && (
              <span
                className="shrink-0 rounded-badge px-2 py-0.5"
                style={{
                  ...META_FONT,
                  fontVariantNumeric: "tabular-nums",
                  background: "var(--accent-subtle)",
                  color: "var(--accent-text)",
                }}
              >
                {meine.length}
              </span>
            )}
            <span
              aria-hidden
              className="shrink-0"
              style={{
                color: "var(--text-3)",
                transform: meineOffen ? "rotate(180deg)" : "none",
                transition: "transform var(--dur-fast) var(--ease-out)",
                lineHeight: 0,
              }}
            >
              <Icon name="chevron-down" size={16} strokeWidth={2.2} />
            </span>
          </button>

          <Collapse open={meineOffen}>
            <div className="t-card flex flex-col gap-3 p-4 sm:p-5">
              <div>
                <div className="t-label">Meine Analysen</div>
                <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
                  Alles, was du analysiert hast — Gegner wie Athleten. Tipp
                  einen Eintrag an und du landest direkt im Ergebnis.
                </p>
              </div>
              {meineFehler && (
                <ErrorState title="Fehler" message={meineFehler} onRetry={ladeMeine} />
              )}
              {meine === null ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-14 w-full rounded-field" />
                  <Skeleton className="h-14 w-full rounded-field" />
                </div>
              ) : meine.length === 0 ? (
                <p style={{ font: "var(--type-body)", color: "var(--text-2)" }}>
                  Deine erste Analyse startest du direkt darunter.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {meine.map((e) => {
                    const z = zustandVon(e.analyse);
                    return (
                      <button
                        key={`${e.modus}:${e.zielId}:${e.analyse.id}`}
                        type="button"
                        onClick={() => oeffneAnalyse(e)}
                        data-press="quiet"
                        className="t-interactive flex min-h-hit w-full items-center gap-3 rounded-field px-3 py-2 text-left"
                        style={{
                          background: "var(--surface-raised)",
                          border: "1px solid var(--line)",
                        }}
                      >
                        <span
                          className="flex shrink-0 items-center"
                          style={{ color: "var(--accent-text)" }}
                        >
                          <Icon name={e.modus === "gegner" ? "target" : "user"} size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className="block truncate"
                            style={{ font: "var(--type-body-strong)" }}
                          >
                            {e.zielName}
                          </span>
                          <span
                            className="block truncate"
                            style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
                          >
                            {e.analyse.sourceLabel} · {formatDate(e.analyse.createdAt)}
                          </span>
                        </span>
                        <span
                          className="shrink-0 rounded-badge px-2 py-0.5"
                          style={{
                            ...META_FONT,
                            background:
                              z.ton === "fertig" ? "var(--accent-subtle)" : "transparent",
                            border: `1px solid ${z.ton === "fertig" ? "var(--accent)" : "var(--line)"}`,
                            color: z.ton === "fertig" ? "var(--accent-text)" : "var(--text-3)",
                          }}
                        >
                          {z.text}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Collapse>
        </div>

        {/* ── 2. Die Werkbank ────────────────────────────────────────────── */}
        <section className="t-card flex flex-col gap-4 p-4 sm:p-5">
          <div className="t-label">Wen analysierst du?</div>

          {/* Der Modus. Er ist der EINZIGE Farbschalter des Bereichs: Unsere
              Leute = Gym-Akzent auf Tidal-Blau, Gegner = Silber ohne Farbe. */}
          <div className="flex gap-2" role="group" aria-label="Modus">
            {MODI.map((m) => {
              const aktiv = m.key === modus;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => waehleModus(m.key)}
                  aria-pressed={aktiv}
                  className="t-interactive flex min-h-hit flex-1 items-center justify-center gap-2 rounded-field px-3"
                  style={{
                    font: "var(--type-body-strong)",
                    background: aktiv ? "var(--accent)" : "var(--surface-raised)",
                    color: aktiv ? "var(--on-accent)" : "var(--text-2)",
                    boxShadow: aktiv ? "var(--accent-glow)" : "none",
                  }}
                >
                  <Icon name={m.icon} size={16} strokeWidth={2.2} />
                  {m.label}
                </button>
              );
            })}
          </div>
          <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
            {MODI.find((m) => m.key === modus)?.hinweis}
          </p>

          {/* Auswahl ↔ gewählte Zeile: ein Formwechsel, kein Umschalten
              (MOTION-BRIEF §1.1). Der activeKey trägt Modus und Ziel, damit
              auch der Wechsel des Modus als Verwandlung läuft. */}
          <MorphSwap activeKey={zielId ? `ziel:${modus}:${zielId}` : `auswahl:${modus}`}>
            {zielId ? (
              <div className="flex flex-col gap-4">
                {zielGesperrt ? (
                  <div
                    className="flex flex-col gap-1.5 rounded-field px-4 py-3"
                    style={{
                      background: "var(--surface-raised)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <span className="t-label">Noch nicht freigegeben</span>
                    <p style={{ font: "var(--type-body-strong)" }}>
                      {zielGesperrt} entscheidet selbst, wer die eigenen
                      DeepFight-Analysen sieht.
                    </p>
                    <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                      Sobald du freigeschaltet bist, analysierst du hier wie bei
                      jedem Athleten.
                    </p>
                  </div>
                ) : zielFehler ? (
                  <ErrorState title="Ziel konnte nicht geladen werden" message={zielFehler} />
                ) : (
                  <div
                    className="flex min-h-hit items-center gap-3 rounded-field px-3 py-2"
                    style={{
                      background: "var(--accent-subtle)",
                      border: "1px solid var(--accent)",
                    }}
                  >
                    {zielDna ? (
                      <DnaCompletenessRing
                        covered={abgedeckt(zielDna)}
                        total={DNA_CATEGORIES.length}
                        size={40}
                        stroke={3.5}
                      />
                    ) : (
                      <Skeleton className="h-10 w-10 rounded-full" />
                    )}
                    <span className="min-w-0 flex-1">
                      {zielName ? (
                        <span
                          className="block truncate"
                          style={{ font: "var(--type-body-strong)", color: "var(--accent-text)" }}
                        >
                          {zielName}
                        </span>
                      ) : (
                        <Skeleton className="h-5 w-40 rounded-badge" />
                      )}
                      <span
                        className="block truncate"
                        style={{ ...META_FONT, color: "var(--text-3)" }}
                      >
                        {zielSub && <>{zielSub} · </>}
                        DNA {zielDna ? dnaCompleteness(zielDna) : 0} %
                        {videoCount !== null && (
                          <> · {videoCount} {videoCount === 1 ? "Video" : "Videos"}</>
                        )}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setZielId(null);
                        setExpandId(null);
                      }}
                      className="t-interactive shrink-0 rounded-field px-3 py-2"
                      style={{ ...META_FONT, color: "var(--accent-text)" }}
                    >
                      Ändern
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <GooeySearch
                  value={search}
                  onChange={setSearch}
                  label="Suchen"
                  placeholder={modus === "leute" ? "Athlet suchen…" : "Gegner suchen…"}
                />
                {!listenBereit ? (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {[0, 1, 2].map((i) => (
                      <Skeleton key={i} className="h-14 w-full rounded-field" />
                    ))}
                  </div>
                ) : modus === "leute" ? (
                  leute.self === null &&
                  leute.staff.length === 0 &&
                  leute.students.length === 0 ? (
                    <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                      Zu diesem Namen passt gerade niemand. Such nach einem
                      anderen Namen oder leer die Suche.
                    </p>
                  ) : (
                    // Deckel wächst mit dem Bildschirm (MOTION-BRIEF §4):
                    // 50vh statt eines festen px-Deckels.
                    <div className="flex max-h-[50vh] flex-col gap-4 overflow-y-auto">
                      <ZielGruppe title="Ich selbst" count={leute.self ? 1 : 0}>
                        {leute.self && (
                          <FlowItem key={leute.self.uid}>
                            <ZielZeile
                              name={labelOf(leute.self)}
                              sub="Meine Analyse"
                              active={false}
                              onSelect={() => waehleZiel(leute.self!.uid)}
                            />
                          </FlowItem>
                        )}
                      </ZielGruppe>
                      <ZielGruppe title="Trainer & Coaches" count={leute.staff.length}>
                        {leute.staff.map((s, i) => (
                          <FlowItem key={s.uid} index={i}>
                            <ZielZeile
                              name={labelOf(s)}
                              sub="Trainer"
                              active={false}
                              onSelect={() => waehleZiel(s.uid)}
                            />
                          </FlowItem>
                        ))}
                      </ZielGruppe>
                      <ZielGruppe title="Athleten" count={leute.students.length}>
                        {leute.students.map((s, i) => (
                          <FlowItem key={s.uid} index={i}>
                            <ZielZeile
                              name={labelOf(s)}
                              sub={null}
                              active={false}
                              onSelect={() => waehleZiel(s.uid)}
                            />
                          </FlowItem>
                        ))}
                      </ZielGruppe>
                    </div>
                  )
                ) : gegnerListe.length === 0 ? (
                  <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
                    {search ? "Kein Gegnerprofil zu diesem Namen. " : "Noch kein Gegnerprofil im Gym. "}
                    <Link
                      href="/trainer/deepfight/gegner?new=1"
                      style={{ color: "var(--accent-text)", textDecoration: "underline" }}
                    >
                      Leg eins an
                    </Link>
                  </p>
                ) : (
                  <div className="flex max-h-[50vh] flex-col gap-4 overflow-y-auto">
                    <ZielGruppe title="Gegner-Bibliothek" count={gegnerListe.length}>
                      {gegnerListe.map((o, i) => (
                        <FlowItem key={o.id} index={i}>
                          <ZielZeile
                            name={o.name}
                            sub={`${FIGHT_STYLE_LABEL[o.style]} · DNA ${dnaCompleteness(o.dna)} %`}
                            active={false}
                            onSelect={() => waehleZiel(o.id)}
                          />
                        </FlowItem>
                      ))}
                    </ZielGruppe>
                  </div>
                )}
              </div>
            )}
          </MorphSwap>

          {/* Die Ablage wächst auf, sobald das Ziel steht. Pro Ziel neu
              gemountet — der Zwischenstand liegt im localStorage der Sektion. */}
          {zielId && zielGeladen && !zielGesperrt && (
            <>
              <div aria-hidden style={{ height: "1px", background: "var(--line)" }} />
              {modus === "leute" && zielLeute ? (
                <VideoAnalysisSection
                  key={`leute:${zielLeute.entry.uid}`}
                  mode="athlete"
                  targetId={zielLeute.entry.uid}
                  targetName={labelOf(zielLeute.entry)}
                  fightProfile={zielLeute.profil}
                  onFightProfileUpdated={() => void ladeProfil(zielLeute.entry.uid)}
                  onAnalysesLoaded={setVideoCount}
                  expandId={expandId}
                />
              ) : zielGegner ? (
                <VideoAnalysisSection
                  key={`gegner:${zielGegner.id}`}
                  mode="opponent"
                  targetId={zielGegner.id}
                  targetName={zielGegner.name}
                  opponent={zielGegner}
                  onOpponentUpdated={() => void ladeGegner(zielGegner.id)}
                  onAnalysesLoaded={setVideoCount}
                  expandId={expandId}
                />
              ) : null}
            </>
          )}
        </section>

        {/* Der Weg zu den Profilen: Wer mehr als die Ablage sehen will, geht
            in die Bibliothek — die Segmente oben führen dorthin. */}
        {zielId && zielGeladen && !zielGesperrt && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={
                modus === "leute"
                  ? `/trainer/deepfight/athleten/${zielId}`
                  : `/trainer/deepfight/gegner/${zielId}`
              }
              data-press
              className="t-card t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-4"
              style={{ ...BTN_FONT, color: "var(--text-body)", textDecoration: "none" }}
            >
              <Icon name="arrow-right" size={13} strokeWidth={2.4} />
              {modus === "leute" ? "Kampfprofil ansehen" : "DeepFight-Profil ansehen"}
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

export default function DeepFightWerkbankPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <Skeleton className="h-40 w-full rounded-card" />
        </div>
      }
    >
      <WerkbankContent />
    </Suspense>
  );
}
