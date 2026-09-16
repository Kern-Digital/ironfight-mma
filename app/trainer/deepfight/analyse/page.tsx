"use client";

/**
 * DeepFight → Neue Analyse: die Konfigurationsseite, das Ende des Flusses.
 *
 * ─── WARUM SIE EINE EIGENE SEITE IST (Leons Neugestaltung 08.09.2026) ───────
 *
 * Bis hierher stand alles auf EINER Seite: Modus, Zielauswahl und Ablage
 * untereinander in der Werkbank. Das war Teilschritt 2 und ausdrücklich
 * gewollt — „wen du analysierst, ist ein Parameter, kein Ort". Mit der Ablage
 * darunter wurde die Seite zu voll; Leon hat die Richtung umgekehrt: **Die
 * Landung wird ruhig, der Weg wird ein Fluss über drei Seiten.**
 *
 *   /trainer/deepfight              die Landung — was gibt es, was lief zuletzt
 *   /trainer/deepfight/athleten     wen? (zugleich die Bibliothek)
 *   /trainer/deepfight/gegner       wen? (zugleich die Bibliothek)
 *   /trainer/deepfight/analyse      womit? ← diese Seite
 *
 * Der Parameter-Gedanke stirbt dabei nicht, er wird zur ADRESSE:
 * `?modus=leute&ziel=<uid>` bzw. `?modus=gegner&ziel=<id>` — dieselben zwei
 * Werte wie vorher, nur verlinkbar. Genau deshalb funktionieren die sechs
 * bestehenden Einstiege weiter (beide Bibliotheken, beide Detailseiten,
 * `/trainer/deepfight/me`, `/kampfprofil`); sie zeigen jetzt hierher statt auf
 * die Landung.
 *
 * ─── DIE RECHTE SIND MITGEWANDERT ───────────────────────────────────────────
 *
 * Die Zielauswahl war die EINE Stelle für die Rechte (Kollegen nur mit
 * Freigabe im Bereich `deepfight`, Ghost-Konten raus). Sie steht jetzt auf den
 * Auswahlseiten — aber diese Seite ist über die Adresse direkt erreichbar, und
 * eine Adresse fragt niemanden um Erlaubnis. Deshalb steht die Prüfung HIER
 * ein zweites Mal: Läuft der Zugriff in `permission-denied`, erscheint der
 * Hinweis „noch nicht freigegeben" statt einer roten Fehlerbox. Das ist kein
 * Fehler, das ist die Entscheidung des Kollegen (firestore.rules,
 * `canAccessMemberData`). Die harte Grenze zieht ohnehin Firestore — hier geht
 * es darum, dass die Sackgasse einen Satz bekommt.
 *
 * ─── AN DER PIPELINE HAT SICH NICHTS GEÄNDERT ───────────────────────────────
 *
 * `VideoAnalysisSection` wird unverändert eingebettet, mit denselben Props wie
 * in der Werkbank und mit `key` je Ziel — der Zwischenstand liegt ohnehin im
 * localStorage der Sektion (`ta-video-analysis-form:{modus}:{zielId}`), das
 * Neumounten kann ihn nicht verschlucken. Zwei-Phasen-Betrieb, `readTarget`
 * frisch aus Firestore, `isConflict`, die Schätzer, der Direkt-Upload: keine
 * Zeile.
 *
 * `?analyse=<id>` klappt eine gespeicherte Auswertung sofort auf — der Weg aus
 * der Suche und aus „Meine Analysen" auf der Landung direkt ins Ergebnis
 * (`expandId`).
 */

import {
  useDeepFightModus,
  type DeepFightModus,
} from "@/components/deepfight/deepfight-modus";
import DnaCompletenessRing from "@/components/trainer/DnaCompletenessRing";
import VideoAnalysisSection from "@/components/trainer/VideoAnalysisSection";
import ErrorState from "@/components/ui/ErrorState";
import Icon from "@/components/ui/Icon";
import Skeleton from "@/components/ui/Skeleton";
import {
  getMemberEntry,
  isPermissionDenied,
  isStaffEntry,
  type StudentEntry,
} from "@/lib/admin";
import { useAuth } from "@/lib/auth-context";
import { nameVon } from "@/lib/deepfight-analysen";
import { FIGHT_STYLE_LABEL } from "@/lib/fight-camp";
import { getFightProfile, type FightProfile } from "@/lib/fight-profile";
import { answeredCount, DNA_CATEGORIES, dnaCompleteness } from "@/lib/gegner-dna";
import { getOpponent, type Opponent } from "@/lib/opponents";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

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

/** Wie viele der neun Kategorien mindestens eine Antwort tragen. */
function abgedeckt(dna: Record<string, string>): number {
  return DNA_CATEGORIES.filter((c) => answeredCount(c, dna) > 0).length;
}

function AnalyseSeiteInhalt() {
  const { user } = useAuth();
  const eigeneUid = user?.uid ?? "";
  const searchParams = useSearchParams();
  const { setModus: setBereichsModus } = useDeepFightModus();

  const roherModus = searchParams.get("modus");
  const modus: DeepFightModus = roherModus === "gegner" ? "gegner" : "leute";
  const zielId = searchParams.get("ziel");
  const expandId = searchParams.get("analyse");

  const [zielLeute, setZielLeute] = useState<{
    entry: StudentEntry;
    profil: FightProfile;
  } | null>(null);
  const [zielGegner, setZielGegner] = useState<Opponent | null>(null);
  const [gesperrt, setGesperrt] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [videoCount, setVideoCount] = useState<number | null>(null);

  // Der Modus färbt den ganzen Bereich — das Layout hört über den Context.
  useEffect(() => setBereichsModus(modus), [modus, setBereichsModus]);

  useEffect(() => {
    let alive = true;
    setZielLeute(null);
    setZielGegner(null);
    setGesperrt(null);
    setFehler(null);
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
          const wer = await getMemberEntry(zielId).catch(() => null);
          setGesperrt(wer ? nameVon(wer) : "Dieser Trainer");
          return;
        }
        setFehler(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    })();
    return () => {
      alive = false;
    };
  }, [modus, zielId]);

  const ladeProfil = useCallback(async (uid: string) => {
    const profil = await getFightProfile(uid);
    setZielLeute((prev) =>
      prev && prev.entry.uid === uid ? { ...prev, profil } : prev,
    );
  }, []);

  const ladeGegner = useCallback(async (id: string) => {
    const o = await getOpponent(id);
    if (o) setZielGegner(o);
  }, []);

  const zielName =
    modus === "leute"
      ? zielLeute
        ? nameVon(zielLeute.entry)
        : null
      : zielGegner?.name ?? null;
  const zielDna =
    modus === "leute" ? zielLeute?.profil.dna ?? null : zielGegner?.dna ?? null;
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
  const auswahlHref =
    modus === "leute"
      ? "/trainer/deepfight/athleten?fuer=analyse"
      : "/trainer/deepfight/gegner?fuer=analyse";

  return (
    <main className="min-h-screen pb-12" style={{ color: "var(--text-body)" }}>
      {/* Sichtbar sagt die Glas-Leiste des Layouts, wo man steht — die
          Überschrift steht hier für Screenreader. */}
      <h1 className="sr-only">DeepFight — Neue Analyse</h1>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 pt-4 sm:px-6">
        {/* ── Kein Ziel in der Adresse ─────────────────────────────────────
            Passiert, wer die Seite ohne Parameter aufruft. Statt einer leeren
            Seite der Weg zurück in die Auswahl. */}
        {!zielId ? (
          <section className="t-card flex flex-col items-start gap-3 p-6 sm:p-8">
            <div className="t-label">Wen analysierst du?</div>
            <p style={{ font: "var(--type-body)", color: "var(--text-2)" }}>
              Wähl zuerst ein Ziel — einen eigenen Athleten oder einen Gegner.
              Danach lädst du hier dein Video ab.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/trainer/deepfight/athleten?fuer=analyse"
                data-press
                className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-5"
                style={{
                  ...BTN_FONT,
                  background: "var(--accent)",
                  color: "var(--on-accent)",
                  boxShadow: "var(--accent-glow)",
                  textDecoration: "none",
                }}
              >
                <Icon name="user" size={13} strokeWidth={2.4} />
                Eigene Athleten
              </Link>
              <Link
                href="/trainer/deepfight/gegner?fuer=analyse"
                data-press
                className="t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-5"
                style={{
                  ...BTN_FONT,
                  border: "1px solid var(--line-strong)",
                  color: "var(--text-body)",
                  textDecoration: "none",
                }}
              >
                <Icon name="target" size={13} strokeWidth={2.4} />
                Gegner
              </Link>
            </div>
          </section>
        ) : gesperrt ? (
          <section className="t-card flex flex-col items-start gap-1.5 p-6 sm:p-8">
            <span className="t-label">Noch nicht freigegeben</span>
            <p style={{ font: "var(--type-body-strong)" }}>
              {gesperrt} entscheidet selbst, wer die eigenen DeepFight-Analysen
              sieht.
            </p>
            <p style={{ font: "var(--type-sub)", color: "var(--text-2)" }}>
              Sobald du freigeschaltet bist, analysierst du hier wie bei jedem
              Athleten.
            </p>
            <Link
              href={auswahlHref}
              data-press
              className="t-interactive mt-2 inline-flex min-h-hit items-center gap-2 rounded-field px-4"
              style={{
                ...BTN_FONT,
                border: "1px solid var(--line-strong)",
                color: "var(--text-body)",
                textDecoration: "none",
              }}
            >
              <Icon name="arrow-left" size={13} strokeWidth={2.4} />
              Anderes Ziel wählen
            </Link>
          </section>
        ) : fehler ? (
          <ErrorState title="Ziel konnte nicht geladen werden" message={fehler} />
        ) : (
          <>
            {/* ── Der Kopf: auf wen läuft das hier ──────────────────────────
                Dieselbe Zeile wie in der alten Werkbank nach der Auswahl —
                Ring, Name, DNA-Stand, Videozahl. Sie muss stehen: Was du hier
                übernimmst, landet in einem GEMEINSAMEN Profil, und das darf
                niemand aus Versehen treffen. */}
            <section
              className="t-card flex min-h-hit flex-wrap items-center gap-3 p-3 sm:p-4"
              style={{ border: "1px solid var(--accent)" }}
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
                    style={{
                      font: "var(--type-body-strong)",
                      color: "var(--accent-text)",
                    }}
                  >
                    {zielName}
                  </span>
                ) : (
                  <Skeleton className="h-5 w-40 rounded-badge" />
                )}
                <span
                  className="block truncate"
                  style={{ ...META_FONT, color: "var(--text-2)" }}
                >
                  {zielSub && <>{zielSub} · </>}
                  DNA {zielDna ? dnaCompleteness(zielDna) : 0} %
                  {videoCount !== null && (
                    <>
                      {" "}
                      · {videoCount} {videoCount === 1 ? "Video" : "Videos"}
                    </>
                  )}
                </span>
              </span>
              <Link
                href={auswahlHref}
                data-press
                className="t-interactive shrink-0 rounded-field px-3 py-2"
                style={{
                  ...META_FONT,
                  color: "var(--accent-text)",
                  textDecoration: "none",
                }}
              >
                Ändern
              </Link>
            </section>

            {/* ── Die Ablage ───────────────────────────────────────────────
                Pro Ziel neu gemountet — der Zwischenstand liegt im
                localStorage der Sektion, nicht im React-Zustand. */}
            <section className="t-card p-4 sm:p-5">
              {modus === "leute" && zielLeute ? (
                <VideoAnalysisSection
                  key={`leute:${zielLeute.entry.uid}`}
                  mode="athlete"
                  targetId={zielLeute.entry.uid}
                  targetName={nameVon(zielLeute.entry)}
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
              ) : (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-6 w-48 rounded-badge" />
                  <Skeleton className="h-32 w-full rounded-field" />
                </div>
              )}
            </section>

            {/* Der Weg zum vollen Profil — wer mehr will als die Ablage. */}
            {(zielLeute || zielGegner) && (
              <div className="flex flex-wrap gap-2">
                <Link
                  href={
                    modus === "leute"
                      ? `/trainer/deepfight/athleten/${zielId}`
                      : `/trainer/deepfight/gegner/${zielId}`
                  }
                  data-press
                  className="t-card t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-4"
                  style={{
                    ...BTN_FONT,
                    color: "var(--text-body)",
                    textDecoration: "none",
                  }}
                >
                  <Icon name="arrow-right" size={13} strokeWidth={2.4} />
                  {modus === "leute" ? "Kampfprofil ansehen" : "DeepFight-Profil ansehen"}
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function DeepFightAnalysePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
          <Skeleton className="h-40 w-full rounded-card" />
        </div>
      }
    >
      <AnalyseSeiteInhalt />
    </Suspense>
  );
}
