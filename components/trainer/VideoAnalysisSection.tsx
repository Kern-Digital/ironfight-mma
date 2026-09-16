"use client";

/**
 * KI-Video-Analyse — die gespeicherten Auswertungen EINES Ziels (Konzept §6).
 *
 * WEN sie zeigt, entscheidet sie nicht selbst: `mode` und `targetId` kommen
 * von außen (Analyse-Seite mit `?modus=&ziel=`). Sie listet die Analysen,
 * klappt den Bericht auf, setzt die Marke „falscher Kämpfer" und die
 * Freigabe für den Athleten.
 *
 * ─── SEIT ETAPPE 2 (16.09.2026) OHNE ABLAGE ─────────────────────────────────
 *
 * Der Ablauf ist umgedreht — erst Upload, dann Vorlauf, dann Zuordnung. Ein
 * Video wird also nicht mehr FÜR ein Ziel abgelegt, sondern ohne Ziel, und
 * die Zuordnung entsteht auf den Karten (components/trainer/VideoUploadFlow.tsx,
 * Analyse-Seite ohne `?ziel=`). Aus dieser Datei sind deshalb Ablage,
 * Pipeline, Fortschritt, Formular-Persistenz und Zwischenstand ausgezogen;
 * geblieben ist die Liste mit dem Bericht. Der Weg zum nächsten Video ist ein
 * Link.
 *
 * ─── AUTOMATIK STATT REVIEW — ETAPPE 1 (16.09.2026) ───────────────────────
 *
 * Leon 14.09.: „Analyse fertig = Profil aktualisiert." Der Bericht bekommt
 * darum KEINE Übernehmen-Rückrufe mehr und keine `existingDna`; der Umbau des
 * Berichts auf Kurzinfo + „Details anzeigen" ist Etappe 3.
 *
 * LÖSCHEN GIBT ES NICHT MEHR — außer für den Plattform-Admin. Ein Trainer
 * markiert eine Analyse als „falscher Kämpfer" (`wrongFighter`); sie bleibt
 * gespeichert, zählt nicht mehr, und der Server rechnet neu. Die Zeile sagt
 * „Zählt nicht", wenn eine Analyse aus der Rechnung fällt (Marke ODER
 * Kämpfer-Tor zu).
 *
 * KEINE `.t-card` HIER DRIN: Die Sektion sitzt auf der Analyse-Seite bereits
 * in einer — und im Bereich ist jede `.t-card` Glas.
 */

import { Collapse, FlowItem, StaggerFlow } from "@/components/motion";
import Icon from "@/components/ui/Icon";
import Skeleton from "@/components/ui/Skeleton";
import { useRights } from "@/lib/auth-context";
import {
  FIGHT_RECENCY_LABEL,
  ID_CONFIDENCE_WARN,
  SPORT_KURZ,
  VIDEO_TYPE_LABEL,
  analysisCounts,
  deleteVideoAnalysisAsAdmin,
  flagVideoAnalysis,
  formatEur,
  listVideoAnalyses,
  setAnalysisSharedWithAthlete,
  type AnalysisMode,
  type VideoAnalysis,
} from "@/lib/video-analysis";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import VideoAnalysisResult from "./VideoAnalysisResult";

/** Schnitte, wie sie im ganzen DeepFight-Bereich stehen. */
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

/** Feld- und Zeilenflächen. Im Bereich ist --surface-raised halbdurchsichtig. */
const FLAECHE: React.CSSProperties = {
  background: "var(--surface-raised)",
  border: "1px solid var(--line)",
};

function formatDate(d: Date): string {
  return d.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Sektion ────────────────────────────────────────────────────────────────

export default function VideoAnalysisSection({
  mode,
  targetId,
  targetName,
  onOpponentUpdated,
  onFightProfileUpdated,
  onAnalysesLoaded,
  expandId = null,
}: {
  mode: AnalysisMode;
  /** opponentId bzw. Schüler-uid. */
  targetId: string;
  targetName: string;
  /** Nach einer Marke oder einem Löschen aufrufen (Profil neu laden). */
  onOpponentUpdated?: () => void;
  onFightProfileUpdated?: () => void;
  /**
   * Meldet die Zahl der gespeicherten Analysen — die Analyse-Seite zeigt sie
   * in ihrer Ziel-Zeile („3 Videos"), ohne die Liste ein zweites Mal zu laden.
   */
  onAnalysesLoaded?: (count: number) => void;
  /**
   * Klappt diese Analyse auf, sobald der Wert sich ändert — der Weg aus
   * „Meine Analysen" auf der Landung und aus dem Upload-Fluss direkt zum
   * Ergebnis.
   */
  expandId?: string | null;
}) {
  // Was eine Analyse gekostet hat und wer endgültig löschen darf, ist
  // Betreiber-Sache (Leon 08.09.2026).
  const rights = useRights();

  const [analyses, setAnalyses] = useState<VideoAnalysis[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Der Aufrufer bekommt die Zahl bei JEDER Änderung der Liste — über einen
  // Ref, damit eine neue Callback-Identität pro Render den Effekt nicht
  // dauerfeuern lässt.
  const analysesLoadedRef = useRef(onAnalysesLoaded);
  analysesLoadedRef.current = onAnalysesLoaded;
  useEffect(() => {
    if (analyses) analysesLoadedRef.current?.(analyses.length);
  }, [analyses]);
  useEffect(() => {
    if (expandId) setExpandedId(expandId);
  }, [expandId]);

  const load = useCallback(async () => {
    setError(null);
    try {
      setAnalyses(await listVideoAnalyses(mode, targetId));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Analysen konnten nicht geladen werden",
      );
      setAnalyses([]);
    }
  }, [mode, targetId]);

  useEffect(() => {
    load();
  }, [load]);

  function notifyTargetUpdated() {
    if (mode === "opponent") onOpponentUpdated?.();
    else onFightProfileUpdated?.();
  }

  /**
   * „Falscher Kämpfer": nimmt die Analyse aus der Rechnung (oder wieder
   * hinein). Der Server rechnet das Profil neu und liefert das Dokument
   * zurück; die Liste zeigt danach „Zählt nicht".
   */
  async function toggleWrongFighter(a: VideoAnalysis) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await flagVideoAnalysis(mode, targetId, a.id, !a.wrongFighter);
      setAnalyses((prev) => (prev ?? []).map((x) => (x.id === a.id ? updated : x)));
      notifyTargetUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Markieren fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  // Endgültig löschen darf nur der Plattform-Admin (Demo-Bestand). Die
  // Rueckfrage steht im VideoAnalysisResult, direkt am Knopf.
  async function handleDelete(a: VideoAnalysis) {
    setBusy(true);
    try {
      await deleteVideoAnalysisAsAdmin(mode, targetId, a.id);
      setAnalyses((prev) => (prev ?? []).filter((x) => x.id !== a.id));
      if (expandedId === a.id) setExpandedId(null);
      notifyTargetUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  /** mode=athlete: Auswertung für den Athleten freigeben / Freigabe zurückziehen. */
  async function toggleSharedWithAthlete(a: VideoAnalysis) {
    setBusy(true);
    try {
      const next = !a.sharedWithAthlete;
      await setAnalysisSharedWithAthlete(targetId, a.id, next);
      setAnalyses((prev) =>
        (prev ?? []).map((x) =>
          x.id === a.id ? { ...x, sharedWithAthlete: next } : x,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Freigabe fehlgeschlagen",
      );
    } finally {
      setBusy(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* Kopf */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="t-label">KI-Video-Analyse</div>
          <p
            className="mt-0.5"
            style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
          >
            Jedes ausgewertete Video ist ein eigener Beitrag —{" "}
            {mode === "opponent"
              ? "mit jedem wird der Gegner schärfer."
              : "mit jedem wird das Kampfprofil genauer."}
          </p>
        </div>
        <Link
          href="/trainer/deepfight/analyse"
          data-press
          className="t-interactive inline-flex min-h-hit shrink-0 items-center gap-2 rounded-field px-4"
          style={{
            ...BTN_FONT,
            background: "var(--accent)",
            color: "var(--on-accent)",
            boxShadow: "var(--accent-glow)",
            textDecoration: "none",
          }}
        >
          <Icon name="video" size={13} strokeWidth={2.4} /> Neues Video
        </Link>
      </div>

      {error && (
        <div className="t-danger rounded-field px-3 py-2" style={{ font: "var(--type-sub)" }}>
          {error}
        </div>
      )}

      {/* Analysen-Liste */}
      {analyses === null ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full rounded-field" />
          <Skeleton className="h-16 w-full rounded-field" />
        </div>
      ) : analyses.length === 0 ? (
        <div className="rounded-card p-8 text-center" style={FLAECHE}>
          <p style={{ font: "var(--type-body-strong)" }}>
            Noch kein Video ausgewertet.
          </p>
          <p
            className="mx-auto mt-1 max-w-md"
            style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
          >
            Leg ein Video ab und ordne {targetName} auf der Karte zu — die
            Auswertung landet dann hier.
          </p>
        </div>
      ) : (
        // Die Liste ändert sich unter dem Trainer: Eine neue Analyse legt sich
        // oben drauf, eine gelöschte geht. Beide Bewegungen gehören dazu
        // (MOTION-BRIEF §1.1) — Schlüssel ist die Firestore-ID, nie der Index.
        <StaggerFlow className="flex flex-col gap-2">
          {analyses.map((a, i) => {
            const open = expandedId === a.id;
            const idWarn =
              a.observation.identification.idConfidence < ID_CONFIDENCE_WARN;
            // Zählt diese Analyse im Profil? Nein bei zu enger Kämpfer-
            // Sicherheit (Tor) oder gesetzter Marke „falscher Kämpfer".
            const zaehlt = analysisCounts(a);
            return (
              <FlowItem key={a.id} index={i}>
                <button
                  type="button"
                  onClick={() => setExpandedId(open ? null : a.id)}
                  aria-expanded={open}
                  data-press="quiet"
                  className="t-interactive flex min-h-hit w-full items-center gap-3 rounded-field px-3 py-2.5 text-left"
                  style={{
                    background: open
                      ? "var(--accent-subtle)"
                      : "var(--surface-raised)",
                    border: `1px solid ${open ? "var(--accent)" : "var(--line)"}`,
                  }}
                >
                  <span
                    className="shrink-0"
                    style={{
                      color: open ? "var(--accent-text)" : "var(--text-2)",
                      lineHeight: 0,
                    }}
                  >
                    <Icon name="video" size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate"
                      style={{
                        font: "var(--type-body-strong)",
                        color: open ? "var(--accent-text)" : "var(--text-body)",
                      }}
                    >
                      {a.sourceLabel}
                    </span>
                    <span
                      className="block truncate"
                      style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
                    >
                      {formatDate(a.createdAt)} ·{" "}
                      {VIDEO_TYPE_LABEL[a.videoType]}
                      {a.sport && <> · {SPORT_KURZ[a.sport]}</>}
                      {/* Was eine Analyse gekostet hat, ist Betreiber-Sache
                          (Leon 08.09.2026) — im Gym steht keine Zahl mehr. */}
                      {rights.admin &&
                        (a.usage
                          ? ` · ca. ${formatEur(a.usage.costEur)}`
                          : " · gratis gelaufen")}
                      {mode === "athlete" &&
                        a.sharedWithAthlete &&
                        " · für den Athleten freigegeben"}
                    </span>
                  </span>
                  {/* Der ZUSTAND färbt: drin oder draußen. Text steht
                      daneben — Farbe ist nie das alleinige Signal. */}
                  <span
                    className="hidden shrink-0 rounded-badge px-2 py-0.5 sm:inline"
                    style={{
                      ...META_FONT,
                      color: zaehlt ? "var(--positive)" : "var(--warning)",
                      border: `1px solid color-mix(in oklab, ${zaehlt ? "var(--positive)" : "var(--warning)"} 40%, transparent)`,
                    }}
                  >
                    {zaehlt ? "Im Profil" : "Zählt nicht"}
                  </span>
                  {idWarn && (
                    <span
                      className="shrink-0"
                      style={{ color: "var(--warning)", lineHeight: 0 }}
                      title="Unsichere Identifikation"
                    >
                      <Icon name="warn" size={15} />
                    </span>
                  )}
                  <span
                    aria-hidden
                    className="shrink-0"
                    style={{
                      color: "var(--text-2)",
                      transform: open ? "rotate(180deg)" : "none",
                      transition: "transform var(--dur-fast) var(--ease-out)",
                      lineHeight: 0,
                    }}
                  >
                    <Icon name="chevron-down" size={16} strokeWidth={2.2} />
                  </span>
                </button>

                {/* Das Ergebnis klappt auf und wieder zu, statt zu poppen. */}
                <Collapse open={open}>
                  <div className="mt-2 flex flex-col gap-2">
                    {mode === "athlete" && (
                      <div
                        className="flex flex-wrap items-center justify-between gap-2 rounded-field px-3 py-2.5"
                        style={
                          a.sharedWithAthlete
                            ? {
                                background:
                                  "color-mix(in oklab, var(--positive) 12%, transparent)",
                                border:
                                  "1px solid color-mix(in oklab, var(--positive) 40%, transparent)",
                              }
                            : FLAECHE
                        }
                      >
                        <span
                          style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
                        >
                          {a.sharedWithAthlete
                            ? `${targetName} sieht diese Auswertung im eigenen Kampfprofil.`
                            : "Diese Auswertung sehen bisher nur Trainer. Gib sie frei, und sie steht im Kampfprofil des Athleten."}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleSharedWithAthlete(a)}
                          disabled={busy}
                          className="t-interactive inline-flex min-h-hit items-center rounded-field px-4 disabled:opacity-60"
                          style={
                            a.sharedWithAthlete
                              ? { ...BTN_FONT, color: "var(--text-2)", ...FLAECHE }
                              : {
                                  ...BTN_FONT,
                                  background: "var(--accent)",
                                  color: "var(--on-accent)",
                                }
                          }
                        >
                          {a.sharedWithAthlete
                            ? "Freigabe zurückziehen"
                            : "Für den Athleten freigeben"}
                        </button>
                      </div>
                    )}
                    {/* Falscher Kämpfer: raus aus der Rechnung, umkehrbar. */}
                    <div
                      className="flex flex-wrap items-center justify-between gap-2 rounded-field px-3 py-2.5"
                      style={
                        a.wrongFighter
                          ? {
                              background:
                                "color-mix(in oklab, var(--warning) 12%, transparent)",
                              border:
                                "1px solid color-mix(in oklab, var(--warning) 40%, transparent)",
                            }
                          : FLAECHE
                      }
                    >
                      <span
                        style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
                      >
                        {a.wrongFighter
                          ? "Du hast diese Analyse als falschen Kämpfer markiert — sie zählt nicht im Profil."
                          : !a.weight.identified
                            ? "Die KI war sich beim Kämpfer nicht sicher genug — diese Analyse zählt nicht im Profil."
                            : `Diese Analyse zählt im Profil zu ${Math.round(a.weight.value * 100)} Prozent: ${VIDEO_TYPE_LABEL[a.videoType]}, ${FIGHT_RECENCY_LABEL[a.recency]}.`}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleWrongFighter(a)}
                        disabled={busy}
                        className="t-interactive inline-flex min-h-hit items-center rounded-field px-4 disabled:opacity-60"
                        style={{ ...BTN_FONT, color: "var(--text-2)", ...FLAECHE }}
                      >
                        {a.wrongFighter ? "Zählt doch" : "Falscher Kämpfer"}
                      </button>
                    </div>
                    {/* Keine Übernehmen-Rückrufe, keine existingDna mehr:
                        Das Profil ist schon gerechnet (Etappe 1). Löschen
                        bleibt Betreiber-Sache. */}
                    <VideoAnalysisResult
                      analysis={a}
                      mode={mode}
                      existingDna={null}
                      busy={busy}
                      onDelete={rights.admin ? () => handleDelete(a) : undefined}
                    />
                  </div>
                </Collapse>
              </FlowItem>
            );
          })}
        </StaggerFlow>
      )}
    </div>
  );
}
