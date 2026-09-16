"use client";

/**
 * DeepFight — die Landung. Ruhig, und der Anfang eines Flusses.
 *
 * ─── DIE UMKEHR (Leons Neugestaltung 08.09.2026) ────────────────────────────
 *
 * Hier stand bis dahin die WERKBANK: Modus, Zielauswahl und Ablage auf EINER
 * Seite. Das war Teilschritt 2 und ausdrücklich so gewollt — „wen du
 * analysierst, ist ein Parameter, kein Ort". Mit der Ablage darunter
 * (Teilschritt 4) wurde die Seite zu voll, und Leon hat die Richtung
 * umgekehrt: **Die Landung wird ruhig, der Weg wird ein Fluss über drei
 * Seiten.**
 *
 *   diese Seite                     was gibt es, was lief zuletzt
 *   /trainer/deepfight/athleten     wen? (zugleich die Bibliothek)
 *   /trainer/deepfight/gegner       wen? (zugleich die Bibliothek)
 *   /trainer/deepfight/analyse      womit?
 *
 * Der Parameter-Gedanke stirbt dabei nicht, er wird zur ADRESSE
 * (`?modus=&ziel=` an der Konfigurationsseite). Und weil diese Seite bis heute
 * genau diese Parameter entgegennahm, **schickt sie sie weiter** statt sie
 * fallen zu lassen: Lesezeichen, der gemerkte Stand aus `ta-deepfight-ziel`
 * und jeder alte Link landen dort, wo sie hinwollten.
 *
 * ─── DER AUFBAU, SEIT LEONS METALL-ENTWURF VOM 12.09.2026 ───────────────────
 *
 *   Kopfzeile   links die Wortmarke groß und OHNE Rahmen, ganz rechts auf
 *               derselben Höhe die Suche — zugeklappt nur die Lupe.
 *   darunter    „Entschlüssle die Fight-DNA" in SILBER (Barlow Condensed
 *               kursiv, Lichtlauf beim Laden), auf dem Schreibtisch
 *               EINZEILIG — `FightDnaHeading`.
 *   links       der große DNA-Strang, dessen Grund ausläuft. Er IST der
 *               Knopf (`FightDnaEntry`): Unter dem Zeiger erscheint in seiner
 *               Mitte „Start" in Silber mit zwei türkisen Pfeilen (auf Touch
 *               immer), ein Tipp verwandelt es am selben Ort in zwei Platten
 *               „Athleten" (Silber) und „Gegner" (Türkis); Escape oder ein
 *               Klick daneben nimmt sie zurück.
 *   rechts      ZWEI FELDER auf Glas (`AnalysenFelder`): „Analysen in
 *               Arbeit" — die Zwischenstände, ein Tipp macht weiter — und
 *               darunter das „Analyse-Archiv": die letzten sieben, als achte
 *               Zeile immer „Alle anzeigen". Ein Tipp auf eine Zeile öffnet
 *               das Sheet mit ALLEN Analysen, diese vorgewählt; die Filter
 *               Alle / Athleten / Gegner sitzen im Sheet (Leon, zweite
 *               Runde 12.09.: keine Pfeile, keine Zähler, kein „Bereit fürs
 *               Profil", Symbol immer die Person — Athleten in Gym-Farbe,
 *               Gegner grau).
 *
 * Der Entwurf kam als eigenständige Vorschau (D:\Tidal-Athletics\GPT\deepfight-entry).
 * Überschrift, DNA-Feld und „Start" sind daraus
 * UNVERÄNDERT übernommen; die zwei Felder rechts wurden an die App angepasst
 * (Glas-Karten mit `--r-lg`, Zeilen `--r-md`, Farben aus den Tokens, Symbole
 * aus der Registry) und an die echten Daten gehängt. Damit sind „Bereit fürs
 * Profil", die Kartei „Meine Analysen" und das Feld „Mach weiter, wo du
 * aufgehört hast" in den zwei Feldern aufgegangen.
 *
 * Auf dem Handy fällt alles in EINE Spalte, in der Reihenfolge des DOM:
 * Kopfzeile → Überschrift → Strang → In Arbeit → Archiv.
 *
 * ─── DER STRANG ZEIGT ECHTE DATEN, ABER KEINEN ECHTEN MENSCHEN ──────────────
 *
 * `DEMO_FIGHT_PROFILE` ist eine Konstante im Code (lib/demo-fight-profile.ts),
 * kein Firestore-Konto. Ein Konto hätte aus jeder Liste gefiltert werden
 * müssen — die ganze Ghost-Konten-Arbeit, die noch offen ist —, und ein
 * vergessener Filter wäre ein Phantom-Athlet in der Mitgliederliste.
 *
 * OHNE WEBGL STEHT ER TROTZDEM DA: `FightDnaHelix` hat einen SVG-Rückfall
 * (`HelixGlyph`) und behandelt Kontextverlust selbst. Wer das nachmisst, zählt
 * NICHT Canvas — er zählt, was gemalt WIRD (Falle 51).
 *
 * ─── WAS DIE SEITE LÄDT, UND WAS SIE DAS KOSTET ─────────────────────────────
 *
 * Beim Mounten: die Mitglieder- und die Gegnerliste (zwei Abfragen, für Suche
 * und Namensauflösung ohnehin nötig). Danach stößt sie den Analysen-Fächer an
 * — **einmal je Sitzung**, siehe lib/deepfight-analysen.ts. „Meine Analysen"
 * und die Suche teilen sich diesen einen Lauf.
 *
 * Der Zwischenstand kommt aus dem `localStorage`, gelesen OHNE
 * `VideoAnalysisSection` zu mounten (lib/deepfight-zwischenstand.ts) — die
 * Sektion zu mounten hieße, ihre Abfragen zu starten.
 */

import { SheetShell, useLetzterWert } from "@/components/motion";
import DeepFightSuche from "@/components/deepfight/DeepFightSuche";
import { useDeepFightModus } from "@/components/deepfight/deepfight-modus";
import FightDnaEntry, { FightDnaHeading } from "@/components/deepfight/FightDnaEntry";
import FightDnaHelix from "@/components/deepfight/FightDnaHelix";
import DeepFightWordmark from "@/components/DeepFightWordmark";
import ErrorState from "@/components/ui/ErrorState";
import Icon from "@/components/ui/Icon";
import AnalysenFelder, {
  type ArbeitEintrag,
  type FeldEintrag,
} from "@/components/deepfight/AnalysenFelder";
import Skeleton from "@/components/ui/Skeleton";
import { listAllMembers, type StudentEntry } from "@/lib/admin";
import { useAuth } from "@/lib/auth-context";
import {
  ladeAlleAnalysen,
  nameVon,
  nurMeine,
  sichtbareMitglieder,
  type AnalyseEintrag,
} from "@/lib/deepfight-analysen";
import { DEMO_FIGHT_PROFILE } from "@/lib/demo-fight-profile";
import {
  leseZwischenstaende,
  restzeitText,
  type Zwischenstand,
} from "@/lib/deepfight-zwischenstand";
import { resolveGymId } from "@/lib/gym";
import { listOpponentsForGym, type Opponent } from "@/lib/opponents";
import { analysisCounts } from "@/lib/video-analysis";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const META_FONT: React.CSSProperties = {
  font: "var(--type-meta)",
  letterSpacing: "var(--ls-label)",
  textTransform: "uppercase",
};
/**
 * DER GEMERKTE ZIEL-SCHLÜSSEL IST WEG. Die alte Werkbank legte das zuletzt
 * gewählte Ziel unter `ta-deepfight-ziel` ab und stellte es beim nächsten
 * Besuch wieder her. Das passte zu einer Seite, die MIT einem Ziel anfing —
 * die neue Landung fängt ohne an, und ein Sprung in eine Konfiguration, die
 * niemand angefordert hat, wäre das Gegenteil von „ruhig".
 *
 * Bestehende Einträge im Browser stören nicht: Sie liest niemand mehr. Der
 * Zwischenstand einer angefangenen Analyse hängt an einem ANDEREN Schlüssel
 * (`ta-video-analysis-form:…`) und lebt unverändert weiter.
 */

function formatDate(d: Date): string {
  return d.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function schluesselVon(e: AnalyseEintrag): string {
  return `${e.modus}:${e.zielId}:${e.analyse.id}`;
}

function analyseHref(e: AnalyseEintrag): string {
  return `/trainer/deepfight/analyse?modus=${e.modus}&ziel=${e.zielId}&analyse=${e.analyse.id}`;
}

// ─── Seite ───────────────────────────────────────────────────────────────────

function LandungInhalt() {
  const { user, profile } = useAuth();
  const gymId = resolveGymId(profile);
  const eigeneUid = user?.uid ?? "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setModus } = useDeepFightModus();

  const [members, setMembers] = useState<StudentEntry[] | null>(null);
  const [opponents, setOpponents] = useState<Opponent[] | null>(null);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [analysen, setAnalysen] = useState<AnalyseEintrag[] | null>(null);
  const [suche, setSuche] = useState("");
  const [alleOffen, setAlleOffen] = useState(false);
  const [vorwahl, setVorwahl] = useState<string | null>(null);
  const [sheetFilter, setSheetFilter] = useState<"alle" | "leute" | "gegner">("alle");
  const [staende, setStaende] = useState<Zwischenstand[]>([]);

  // ── Alte Adressen weiterreichen ───────────────────────────────────────────
  const alterModus = searchParams.get("modus");
  const altesZiel = searchParams.get("ziel");
  useEffect(() => {
    if (altesZiel && (alterModus === "leute" || alterModus === "gegner")) {
      router.replace(
        `/trainer/deepfight/analyse?modus=${alterModus}&ziel=${altesZiel}`,
      );
    }
  }, [alterModus, altesZiel, router]);

  // ── Zwischenstände (nur lesen) ────────────────────────────────────────────
  useEffect(() => setStaende(leseZwischenstaende()), []);

  // ── Die zwei Listen ───────────────────────────────────────────────────────
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

  /** Wer überhaupt sichtbar ist — Freigabe im Bereich `deepfight`, kein Ghost. */
  const sichtbar = useMemo(
    () => (members ? sichtbareMitglieder(members, eigeneUid) : null),
    [members, eigeneUid],
  );

  // ── Der Fächer: einmal je Sitzung, geteilt mit der Suche ──────────────────
  useEffect(() => {
    if (!members || !opponents || !eigeneUid) return;
    let alive = true;
    ladeAlleAnalysen(gymId, eigeneUid, members, opponents)
      .then((liste) => {
        if (alive) setAnalysen(liste);
      })
      .catch(() => {
        if (alive) setAnalysen([]);
      });
    return () => {
      alive = false;
    };
  }, [gymId, eigeneUid, members, opponents]);

  const meine = useMemo(
    () => (analysen ? nurMeine(analysen, eigeneUid) : null),
    [analysen, eigeneUid],
  );

  /** Der Name zum wartenden Zwischenstand — aus den ohnehin geladenen Listen. */
  const standName = useCallback(
    (stand: Zwischenstand): string | null => {
      if (stand.modus === "gegner") {
        return opponents?.find((o) => o.id === stand.zielId)?.name ?? null;
      }
      const m = members?.find((s) => s.uid === stand.zielId);
      return m ? nameVon(m) : null;
    },
    [members, opponents],
  );

  // ── Die zwei Felder rechts ────────────────────────────────────────────────
  /**
   * „In Arbeit" = die Zwischenstände (ein abgebrochener Lauf verfällt nach
   * 48 Stunden). Sie bieten nur EINEN Weg (weitermachen); Verwerfen bleibt in
   * `VideoAnalysisSection`, wo der Stand zu Hause ist. „Bereit fürs Profil"
   * gibt es seit Leons zweiter Runde (12.09.) nicht mehr — was übernommen ist
   * und was nicht, sagt das Abzeichen im Sheet.
   */
  const arbeit = useMemo<ArbeitEintrag[]>(
    () =>
      staende.map((stand) => ({
        key: `stand:${stand.modus}:${stand.zielId}`,
        href: `/trainer/deepfight/analyse?modus=${stand.modus}&ziel=${stand.zielId}`,
        name: standName(stand) ?? stand.dateiname ?? "Ein Zwischenstand",
        meta: [
          stand.ausgewertet
            ? "Video ist ausgewertet"
            : stand.videoLiegt
              ? "Video liegt bei Google"
              : null,
          restzeitText(stand.gespeichertAm),
        ]
          .filter((t): t is string => !!t)
          .join(" · "),
        modus: stand.modus,
      })),
    [staende, standName],
  );

  /** Das Archiv = alle eigenen Analysen, neueste zuerst (der Fächer sortiert). */
  const archiv = useMemo<FeldEintrag[] | null>(
    () =>
      meine
        ? meine.map((e) => ({
            key: schluesselVon(e),
            name: e.zielName,
            meta: `${e.analyse.sourceLabel} · ${formatDate(e.analyse.createdAt)}`,
            modus: e.modus,
          }))
        : null,
    [meine],
  );

  /** Ein Tipp auf eine Archiv-Zeile: das Sheet mit ALLEM, diese vorgewählt. */
  function oeffneSheet(key: string | null) {
    setVorwahl(key);
    setSheetFilter("alle");
    setAlleOffen(true);
  }

  /** Der Tipp auf eine Platte FÄRBT, bevor er navigiert: `data-modus` sofort, der Seitenwechsel folgt. */
  function los(modus: "leute" | "gegner") {
    setModus(modus);
    router.push(
      modus === "gegner"
        ? "/trainer/deepfight/gegner?fuer=analyse"
        : "/trainer/deepfight/athleten?fuer=analyse",
    );
  }

  const listeFuerSheet = useLetzterWert(alleOffen ? meine : null) ?? [];
  // Die Vorwahl kommt DIREKT aus dem Zustand, nicht über `useLetzterWert`:
  // Der hielte beim Öffnen über „Alle anzeigen" (Vorwahl null) die
  // vorherige Markierung fest (gemessen 12.09.). Beim Schließen bleibt sie
  // stehen, bis der nächste Tipp sie neu setzt — die Austritts-Feder
  // verliert also nichts.
  const vorwahlImSheet = vorwahl;
  const sichtbarImSheet = listeFuerSheet.filter(
    (e) => sheetFilter === "alle" || e.modus === sheetFilter,
  );

  return (
    <main className="pb-12" style={{ color: "var(--text-body)" }}>
      <h1 className="sr-only">DeepFight</h1>

      <div className="df-kopfspalte mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6">
        {ladeFehler && (
          <div className="mb-4">
            <ErrorState
              title="Daten konnten nicht geladen werden"
              message={ladeFehler}
              onRetry={load}
            />
          </div>
        )}

        {/* ── Kopfzeile: Wortmarke links, Suche ganz rechts ───────────────────
            Sie steht in der SEITE und nicht mehr in der Glas-Leiste des
            Layouts (Leon 10.09.): Nur so können Marke und Suche auf einer
            Höhe sitzen — die Leiste liegt über dem <main> und hätte nie
            einen Nachbarn aus der Seite. */}
        <div className="flex items-center justify-between gap-4">
          <span style={{ font: "var(--type-marke)", color: "var(--text-1)" }}>
            <DeepFightWordmark />
          </span>
          <DeepFightSuche
            wert={suche}
            onWert={setSuche}
            members={sichtbar}
            opponents={opponents}
            analysen={analysen}
            analysenLaufen={analysen === null}
            eigeneUid={eigeneUid}
          />
        </div>

        {/* ── Die Überschrift, über die ganze Breite ─────────────────────────
            Sie MUSS hier stehen und nicht in der linken Spalte: In einer
            halben Spalte bräche „ENTSCHLÜSSLE DIE FIGHT-DNA" auf jedem
            Schirm um. Silber, kursiv, Lichtlauf — Leons Entwurf 12.09. */}
        <FightDnaHeading />

        <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start lg:gap-8">
          {/* ── Links: der Strang und der Einstieg ──────────────────────
              Der Strang steht OHNE Karte, sein Grund läuft nach außen aus
              (Regel `.df-entry__dna section` in globals.css). Die Helix
              bleibt `inert` und `aria-hidden`: Beispieldaten, vorgelesen
              wären es Zahlen über einen Menschen, den es nicht gibt. Der
              Knopf darüber trägt die Beschriftung „Analyse starten".
              `size="lg"` immer — die Höhe je Fensterbreite regelt das CSS
              (Leons Maße aus der Vorschau). */}
          <section aria-label="Neue Analyse" className="min-w-0">
            <FightDnaEntry onSelect={los}>
              <FightDnaHelix
                profile={DEMO_FIGHT_PROFILE}
                variant="athlete"
                size="lg"
                kennzahlZeigen={false}
              />
            </FightDnaEntry>
          </section>

          {/* ── Rechts: In Arbeit und Archiv ─────────────────────────────── */}
          <div className="min-w-0 lg:pt-3">
            <AnalysenFelder
              arbeit={arbeit}
              archiv={archiv}
              onWaehlen={oeffneSheet}
              onAlle={() => oeffneSheet(null)}
            />
          </div>
        </div>
      </div>

      {/* Alle eigenen Analysen — ZENTRIERT (Leon 10.09.2026: „wenn ich auf
          eins klicke, soll das Popup zentriert sein"). Das ist die
          Standardlage der Hülle (`adaptive`): auf dem Handy unten, ab `sm`
          mittig. Der Aufrufer rendert das Sheet IMMER und meldet „zu" über
          `open`, damit das Schließen eine Bewegung hat; `useLetzterWert`
          hält Inhalt UND Vorwahl währenddessen fest — sonst verlöre die
          hervorgehobene Zeile ihre Markierung mitten in der Austritts-Feder.
          DIE FILTER Alle / Athleten / Gegner SITZEN HIER, nicht auf der
          Seite (Leon 12.09.: „das soll erst kommen, wenn man auf einen
          klickt und das Popup erscheint").
          DER RADIUS STEHT IN KLASSEN UND NICHT IM INLINE-STIL: unten
          angedockt nur die oberen Ecken, mittig alle vier. */}
      <SheetShell
        open={alleOffen}
        onClose={() => setAlleOffen(false)}
        label="Alle Analysen"
        panelClassName="pointer-events-auto relative flex w-full max-h-[80vh] flex-col overflow-hidden rounded-t-[var(--r-xl)] sm:max-w-xl sm:rounded-[var(--r-xl)] lg:max-w-3xl"
        panelStyle={{
          maxHeight: "80dvh",
          background: "var(--surface-card)",
          boxShadow: "var(--glass-shadow)",
        }}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-5">
          <div className="shrink-0 px-1 pb-3">
            <h2 className="t-sheet-title">Alle Analysen</h2>
            <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
              {vorwahlImSheet
                ? "Deine Auswahl steht markiert — tipp sie noch einmal an, und du landest im Ergebnis."
                : "Alles, was du analysiert hast — Gegner wie Athleten. Tipp einen Eintrag an und du landest direkt im Ergebnis."}
            </p>
            <div className="df-filter mt-3" role="group" aria-label="Analysen filtern">
              {(
                [
                  ["alle", "Alle"],
                  ["leute", "Athleten"],
                  ["gegner", "Gegner"],
                ] as const
              ).map(([wert, label]) => (
                <button
                  key={wert}
                  type="button"
                  aria-pressed={sheetFilter === wert}
                  onClick={() => setSheetFilter(wert)}
                >
                  {label}
                </button>
              ))}
              <span className="df-filter__summe" aria-live="polite">
                {sichtbarImSheet.length}{" "}
                {sichtbarImSheet.length === 1 ? "Analyse" : "Analysen"}
              </span>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1 pb-1">
            {sichtbarImSheet.map((e) => {
              const k = schluesselVon(e);
              const gewaehlt = k === vorwahlImSheet;
              // Seit der Automatik zählt jede Analyse von selbst — außer das
              // Kämpfer-Tor ist zu oder sie ist als falsch markiert.
              const uebernommen = analysisCounts(e.analyse);
              return (
                <Link
                  key={k}
                  href={analyseHref(e)}
                  data-press="quiet"
                  onClick={() => setAlleOffen(false)}
                  aria-current={gewaehlt ? "true" : undefined}
                  className="t-interactive flex min-h-hit w-full items-center gap-3 rounded-field px-3 py-2"
                  style={{
                    background: gewaehlt
                      ? "var(--accent-subtle)"
                      : "var(--surface-raised)",
                    border: `1px solid ${gewaehlt ? "var(--accent)" : "var(--line)"}`,
                    textDecoration: "none",
                    color: "var(--text-body)",
                  }}
                >
                  <span
                    className="flex shrink-0 items-center"
                    style={{ color: e.modus === "gegner" ? "var(--text-2)" : "var(--accent-text)" }}
                  >
                    <Icon name="user" size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate"
                      style={{
                        font: "var(--type-body-strong)",
                        color: gewaehlt ? "var(--accent-text)" : "var(--text-body)",
                      }}
                    >
                      {e.zielName}
                    </span>
                    <span
                      className="block truncate"
                      style={{ ...META_FONT, color: "var(--text-2)" }}
                    >
                      {e.analyse.sourceLabel} · {formatDate(e.analyse.createdAt)}
                    </span>
                  </span>
                  <span
                    className="shrink-0 rounded-badge px-2 py-0.5"
                    style={{
                      ...META_FONT,
                      background: uebernommen ? "var(--accent-subtle)" : "transparent",
                      border: `1px solid ${uebernommen ? "var(--accent)" : "var(--line)"}`,
                      color: uebernommen ? "var(--accent-text)" : "var(--text-2)",
                    }}
                  >
                    {uebernommen ? "Übernommen" : "Offen"}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </SheetShell>
    </main>
  );
}

export default function DeepFightLandungPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
          <Skeleton className="h-40 w-full rounded-card" />
        </div>
      }
    >
      <LandungInhalt />
    </Suspense>
  );
}
