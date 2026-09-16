"use client";

/**
 * Ergebnis-Ansicht einer KI-Video-Analyse (Konzept §6).
 *
 * Zeigt Identifikation, Bewertung (Claude) und Roh-Beobachtungen (Gemini) und
 * bietet im Gegner-Modus die Übernahme in die Gegner-DNA an:
 *   • einzelne Befunde übernehmen
 *   • „Alle übernehmen" (alle konfliktfreien Befunde + Stats auf einmal)
 *   • Konflikte (bestehende Antwort widerspricht) nur per explizitem Klick
 *
 * ─── WAS TEILSCHRITT 5 GEÄNDERT HAT (14.09.2026) ──────────────────────────
 * (zugleich Redesign-Etappe 3c — einmal bauen, zwei Haken)
 *
 * AN DER MERGE-LOGIK NICHTS. `mergeDnaSplit`, `cleanActionStats`,
 * `computeVideoWeight`, `isConflict` gegen den frisch gelesenen Stand und
 * `markAnalysisApplied` liegen im Aufrufer (VideoAnalysisSection) bzw. in
 * lib/fight-stats.ts und stehen Zeile für Zeile wie vorher. Diese Datei
 * zeigt an und ruft zurück — sie rechnet nichts.
 *
 * 1. TOKEN-LOOK STATT VIOLETT/INK. `--ta-violet`, `--ink-2…4`, `--fg-2…5`,
 *    `--ta-pink`, `--ta-mint`, `font-mono-ta`/`font-display-ta` und zwölf
 *    rohe `rgba()` sind raus. Die Abbildung ist keine Erfindung — sie steht
 *    seit Teilschritt 4 im Nachbarn `VideoAnalysisSection` und seit Etappe 3b
 *    in `OpponentEditor`/`GegnerDnaAccordion`.
 *
 *    KEINE `.t-card` HIER DRIN, aus demselben Grund wie dort: Der Bericht
 *    sitzt in der Werkbank-Karte, und im Bereich ist jede `.t-card` Glas.
 *    Eine Karte hier wäre Glas auf Glas. Die eigenen Flächen laufen über
 *    `--surface-raised` + `--line` (im Bereich halbdurchsichtig).
 *
 *    `--fg-4` wird `--text-3` und nicht `--text-2`: Im Bereich fällt die
 *    dritte Stufe ohnehin auf die zweite (Bereichsregel in globals.css), auf
 *    `/kampfprofil` steht der Bericht dagegen auf einer DECKENDEN Karte, und
 *    dort ist die dritte Stufe genau das, was sie sein soll. Ein fest
 *    eingetragenes `--text-2` hätte die Abstufung dort eingeebnet.
 *
 * 2. DIE KATEGORIE TRÄGT KEINE FARBE MEHR. `cat.accent` ist weg, wie schon in
 *    `DnaCategoryGrid` (3a) und `GegnerDnaAccordion` (3b): vier Farben, die
 *    sich über neun Kategorien im Kreis wiederholten, behaupteten eine
 *    Ordnung, die es nicht gibt. Der ZUSTAND färbt — offen, übernommen,
 *    im Konflikt.
 *
 * 3. DER KONFLIKT IST KEIN FEHLER, SONDERN EINE ENTSCHEIDUNG. `--ta-pink`
 *    stand für dreierlei: unsichere Identifikation, Wackler/Knockdowns UND
 *    den Konflikt. Es fällt deshalb NICHT pauschal auf `--negative` — das
 *    hätte eine Entscheidung wie einen Fehler aussehen lassen. Alle drei
 *    laufen auf `--warning` (so hält es die Sektion nebenan schon für
 *    `idWarn`), und der Konflikt bekommt statt der bisherigen Miniaturzeile
 *    einen beschrifteten Vergleich: „Bisher im Profil" gegen „Dieses Video
 *    zeigt". Die Fläche trägt den Ton, der TEXT bleibt `--text-body`
 *    (Falle 33), und ein `warn`-Symbol steht daneben — Farbe ist nie das
 *    alleinige Signal.
 *
 *    Was die Anzeige NICHT kann und auch nicht behauptet: sagen, aus welchem
 *    (wie gewichteten) Video die bisherige Antwort stammt. Die Herkunft der
 *    DNA-Antworten wird nicht gespeichert (Backlog-Punkt in CLAUDE.md).
 *    Deshalb heißt es „Bisher im Profil" und nicht „aus Video X".
 *
 *    Unverändert bleibt die Regel selbst: Konflikte werden nie still
 *    überschrieben, nur einzeln per „Ersetzen".
 *
 * 4. DER WEG HAT EIN SICHTBARES ENDE (UX-Punkt 6: „Das Ende ist die
 *    Übernahme, nicht das Ergebnis"). Bisher passierte nach „Alle übernehmen"
 *    nichts Sichtbares außer, dass Knöpfe verschwanden — der Bericht hörte
 *    einfach auf. Jetzt steht am FUSS ein Block mit drei Gesichtern:
 *      • fertig            → was jetzt im Profil steht und ein Weg dorthin
 *      • nur noch Konflikte → was schon drin ist, was noch drankommt
 *      • sonst              → nichts; der Knopf oben trägt den Zustand
 *    Adresse und Name kommen aus `analysis.targetId`/`targetName`, ein neues
 *    Prop braucht es dafür nicht. Der Block hängt an `canApply` und erscheint
 *    auf `/kampfprofil` deshalb gar nicht: Der Athlet übernimmt nichts, und
 *    für `/trainer/…` hätte er ohnehin keinen Zugriff.
 */

import { useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { Collapse, MorphSwap } from "@/components/motion";
import { DNA_CATEGORIES, DNA_QUESTION_BY_ID } from "@/lib/gegner-dna";
import { actionLabel, CAGE_ZONE_LABEL, successRate } from "@/lib/fight-stats";
import {
  FIGHT_RECENCY_LABEL,
  ID_CONFIDENCE_WARN,
  VIDEO_TYPE_LABEL,
  computeVideoWeight,
  type AnalysisMode,
  type DnaFinding,
  type TopListEntry,
  type VideoAnalysis,
} from "@/lib/video-analysis";

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
/** Kopfzeile der Technik-Tabelle — siehe Kommentar an der Tabelle. */
const TH_STYLE: React.CSSProperties = {
  ...META_FONT,
  color: "var(--text-3)",
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** Getönte Fläche + Kante aus EINEM Token — das Muster der ganzen App. */
function tonFlaeche(token: string, fuellung = 12, kante = 40): React.CSSProperties {
  return {
    background: `color-mix(in oklab, var(${token}) ${fuellung}%, transparent)`,
    border: `1px solid color-mix(in oklab, var(${token}) ${kante}%, transparent)`,
  };
}

const SCORE_LABEL: [keyof VideoAnalysis["evaluation"]["scores"], string][] = [
  ["aggression", "Aggressivität"],
  ["cageControl", "Cage-Control"],
  ["cardio", "Cardio"],
  ["damage", "Schlagwirkung"],
  ["durability", "Nehmerfähigkeit"],
  ["fightIq", "Fight IQ"],
  ["predictability", "Vorhersehbarkeit"],
];

const DAMAGE_LABEL = ["wirkungslos", "spürbar", "deutlich", "Wackler/KD"];

// ─── Kleine Bausteine ───────────────────────────────────────────────────────

/**
 * Aufklappbarer Abschnitt. Kopf wie im GegnerDnaAccordion: `data-press="quiet"`
 * (eine Zeile in einer Liste hebt sich nicht, MOTION-BRIEF §3) und ein
 * drehendes Chevron. Der Inhalt läuft über `Collapse` statt `{open && …}` —
 * so hat auch das Zuklappen eine Bewegung.
 */
function SectionCard({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-card" style={FLAECHE}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-press="quiet"
        className="t-interactive flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="t-label">{title}</span>
        <span
          className="shrink-0"
          style={{
            color: "var(--text-3)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform var(--dur-fast) var(--ease-out)",
            lineHeight: 0,
          }}
          aria-hidden
        >
          <Icon name="chevron-down" size={16} strokeWidth={2.2} />
        </span>
      </button>
      <Collapse open={open}>
        <div
          className="border-t px-4 pb-4 pt-3.5"
          style={{ borderColor: "var(--line)" }}
        >
          {children}
        </div>
      </Collapse>
    </div>
  );
}

/**
 * Konfidenz eines Befunds. Die Farbe sagt, wie sehr man sich darauf verlassen
 * kann: sicher (`--positive`), mittel (neutral im Akzent), dünn (`--warning`
 * — Vorsicht, kein Fehler).
 */
function ConfidenceBadge({ value }: { value: number }) {
  const good = value >= 0.7;
  const mid = value >= 0.4;
  const ton = good ? "--positive" : mid ? "--accent" : "--warning";
  return (
    <span
      className="rounded-badge px-1.5 py-0.5"
      style={{
        ...META_FONT,
        fontVariantNumeric: "tabular-nums",
        ...tonFlaeche(ton, 12, 40),
        color: good
          ? "var(--positive)"
          : mid
            ? "var(--accent-text)"
            : "var(--warning)",
      }}
      title="Konfidenz dieses Befunds"
    >
      {pct(value)}
    </span>
  );
}

function TopList({ title, entries }: { title: string; entries: TopListEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div>
      <div className="t-label mb-2">{title}</div>
      <ol className="flex flex-col gap-2">
        {entries.map((e, i) => (
          <li key={i} className="flex items-start gap-2">
            <span
              style={{
                font: "var(--type-body-strong)",
                color: "var(--accent-text)",
                fontVariantNumeric: "tabular-nums",
                minWidth: "16px",
              }}
            >
              {i + 1}
            </span>
            <span style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              <span style={{ color: "var(--text-body)", fontWeight: 600 }}>
                {e.title}
              </span>{" "}
              — {e.reason} <ConfidenceBadge value={e.confidence} />
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ─── Haupt-Komponente ───────────────────────────────────────────────────────

export default function VideoAnalysisResult({
  analysis,
  mode,
  existingDna,
  busy = false,
  onApplyFindings,
  onApplyAll,
  onDelete,
}: {
  analysis: VideoAnalysis;
  mode: AnalysisMode;
  /** Aktuelle DNA-Antworten des Gegners — für Konflikt-Erkennung. */
  existingDna: Record<string, string> | null;
  busy?: boolean;
  onApplyFindings?: (ids: string[]) => void;
  /** Alle konfliktfreien Befunde + Stats auf einmal übernehmen. */
  onApplyAll?: () => void;
  onDelete?: () => void;
}) {
  // Rueckfrage vor dem Loeschen — inline statt Browser-Popup (Leon
  // 04.09.2026). Sie sitzt HIER und nicht im Aufrufer, weil hier der Knopf
  // steht: Die Frage gehoert neben die Handlung, nicht in eine andere Datei.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { observation: obs, evaluation: ev } = analysis;
  const weight = computeVideoWeight(analysis);
  // Seit Etappe 1 der Automatik (16.09.2026) gibt es keine Übernahme-Marken
  // mehr: Das Profil rechnet der Server aus allen Analysen. Die Aufrufer
  // reichen deshalb weder `existingDna` noch Übernehmen-Rückrufe — Knöpfe,
  // Konflikt-Vergleich und Fuß bleiben aus (`canApply` false). Der Umbau
  // dieses Berichts auf Kurzinfo + „Details anzeigen" ist Etappe 3.
  const applied = new Set<string>();
  const appliedFindingIds: string[] = [];
  const appliedStats = false;
  // Übernahme gibt es in beiden Modi (Gegner-DNA bzw. Kampfprofil) — die
  // read-only Schüler-Sicht übergibt schlicht keine onApply-Callbacks.
  const canApply = !!onApplyFindings;

  const isConflict = (f: DnaFinding): boolean => {
    if (!existingDna) return false;
    const existing = existingDna[f.questionId]?.trim();
    return !!existing && existing !== f.answer.trim() && !applied.has(f.questionId);
  };
  const conflictCount = ev.findings.filter(isConflict).length;
  const openCount = ev.findings.filter(
    (f) => !applied.has(f.questionId) && !isConflict(f),
  ).length;

  const idWarn = obs.identification.idConfidence < ID_CONFIDENCE_WARN;
  const activeActions = obs.actions.filter((a) => a.attempted > 0 || a.landed > 0);

  // ── Das Ende des Wegs ─────────────────────────────────────────────────────
  // Drei Zustände, EINE Stelle: Was ist schon im Profil, was ist noch offen?
  const uebernommeneBefunde = appliedFindingIds.length;
  const etwasImProfil = uebernommeneBefunde > 0 || appliedStats;
  const fertig = etwasImProfil && openCount === 0 && conflictCount === 0;
  const nurNochKonflikte = etwasImProfil && openCount === 0 && conflictCount > 0;
  const zielName = analysis.targetName || "diesem Profil";
  const zielOrt = mode === "opponent" ? "DeepFight-Profil" : "Kampfprofil";
  const zielWeg =
    mode === "opponent"
      ? `/trainer/deepfight/gegner/${analysis.targetId}`
      : `/trainer/deepfight/athleten/${analysis.targetId}`;
  /** „7 Befunde stehen" / „1 Befund steht" / nur die Zahlen. */
  const befundSatz =
    uebernommeneBefunde > 0
      ? `${uebernommeneBefunde} ${uebernommeneBefunde === 1 ? "Befund steht" : "Befunde stehen"} jetzt im ${zielOrt} von ${zielName}${
          appliedStats
            ? ", dazu Fight-DNA-Split und Technik-Statistik."
            : "."
        }`
      : `Fight-DNA-Split und Technik-Statistik stehen jetzt im ${zielOrt} von ${zielName}.`;

  return (
    <div className="flex flex-col gap-3">
      {/* Identifikation */}
      <div
        className="rounded-card p-3.5"
        style={idWarn ? tonFlaeche("--warning") : tonFlaeche("--accent", 10, 35)}
      >
        <div className="flex items-center gap-2">
          <span
            style={{
              color: idWarn ? "var(--warning)" : "var(--accent-text)",
              lineHeight: 0,
            }}
            aria-hidden
          >
            <Icon name={idWarn ? "warn" : "check"} size={15} strokeWidth={2.2} />
          </span>
          <span
            style={{
              ...META_FONT,
              color: idWarn ? "var(--warning)" : "var(--accent-text)",
            }}
          >
            Kämpfer-Identifikation · {pct(obs.identification.idConfidence)}
          </span>
        </div>
        <p
          className="mt-1.5"
          style={{ font: "var(--type-sub)", color: "var(--text-body)" }}
        >
          {obs.identification.description || "Keine Beschreibung."}
        </p>
        {obs.identification.evidence.length > 0 && (
          <p
            className="mt-1"
            style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
          >
            Gesehen bei: {obs.identification.evidence.join(" · ")}
          </p>
        )}
        {idWarn && (
          <p
            className="mt-1.5"
            style={{ font: "var(--type-body-strong)", color: "var(--warning)" }}
          >
            Unsichere Identifikation — prüf die Befunde, bevor du sie übernimmst.
          </p>
        )}
      </div>

      {/* Zusammenfassung + Aktionen */}
      <div className="rounded-card p-4" style={FLAECHE}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="t-label">KI-Einschätzung</div>
          <div className="flex flex-wrap gap-2">
            {canApply && (
              <button
                type="button"
                onClick={onApplyAll}
                disabled={busy || openCount === 0}
                data-press
                className="t-interactive inline-flex min-h-hit items-center rounded-field px-4 disabled:cursor-not-allowed disabled:opacity-50"
                style={
                  openCount > 0
                    ? {
                        ...BTN_FONT,
                        background: "var(--accent)",
                        color: "var(--on-accent)",
                        boxShadow: "var(--accent-glow)",
                      }
                    : { ...BTN_FONT, color: "var(--text-2)", ...FLAECHE }
                }
              >
                Alle übernehmen ({openCount})
              </button>
            )}
            {onDelete && (
              <MorphSwap
                activeKey={confirmDelete ? "confirm" : "idle"}
                innerClassName="flex flex-wrap items-center gap-2"
              >
                {confirmDelete ? (
                  <>
                    <span
                      style={{ font: "var(--type-sub)", color: "var(--text-2)" }}
                    >
                      Analyse wirklich löschen? Übernommene Befunde bleiben im
                      Profil.
                    </span>
                    <button
                      type="button"
                      onClick={onDelete}
                      disabled={busy}
                      data-press
                      className="t-danger-strong t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-4 disabled:opacity-50"
                      style={BTN_FONT}
                    >
                      <Icon name="trash" size={13} strokeWidth={2.2} />
                      Endgültig löschen
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={busy}
                      data-press
                      className="t-interactive inline-flex min-h-hit items-center rounded-field px-3 disabled:opacity-50"
                      style={{ ...BTN_FONT, color: "var(--text-2)" }}
                    >
                      Abbrechen
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    disabled={busy}
                    data-press
                    className="t-danger t-interactive inline-flex min-h-hit items-center gap-2 rounded-field px-4 disabled:opacity-50"
                    style={BTN_FONT}
                  >
                    <Icon name="trash" size={13} strokeWidth={2.2} />
                    Löschen
                  </button>
                )}
              </MorphSwap>
            )}
          </div>
        </div>
        {conflictCount > 0 && canApply && (
          <p
            className="mt-2 flex items-center gap-1.5"
            style={{ font: "var(--type-sub)", color: "var(--warning)" }}
          >
            <span style={{ lineHeight: 0 }} aria-hidden>
              <Icon name="warn" size={14} strokeWidth={2.2} />
            </span>
            {conflictCount} {conflictCount === 1 ? "Befund" : "Befunde"}{" "}
            {conflictCount === 1 ? "widerspricht" : "widersprechen"} dem, was
            schon im Profil steht — die entscheidest du einzeln.
          </p>
        )}
        <p
          className="mt-2"
          style={{ font: "var(--type-body)", color: "var(--text-body)" }}
        >
          {ev.summary}
        </p>
        <div
          className="mt-2 flex flex-wrap gap-x-4 gap-y-1"
          style={{ font: "var(--type-sub)", color: "var(--text-3)" }}
        >
          {ev.style.primaryStyle && <span>Stil: {ev.style.primaryStyle}</span>}
          {ev.style.approach && <span>Ansatz: {ev.style.approach}</span>}
          {ev.style.baseDiscipline && <span>Basis: {ev.style.baseDiscipline}</span>}
        </div>
        {/* Gewichtung nachvollziehbar aufgeschlüsselt — berechnet aus dem, was
            wir wirklich wissen, nicht aus der Alters-/Niveau-Schätzung. */}
        <div
          className="mt-2.5 rounded-field px-3 py-2"
          style={{ ...FLAECHE, font: "var(--type-sub)", color: "var(--text-3)" }}
        >
          <span style={{ ...META_FONT, color: "var(--accent-text)" }}>
            Video-Gewichtung {pct(weight.value)}
          </span>
          <span className="ml-2">
            {FIGHT_RECENCY_LABEL[analysis.recency ?? "unknown"]} (
            {weight.recency.toFixed(2).replace(".", ",")}) ×{" "}
            {VIDEO_TYPE_LABEL[analysis.videoType]} (
            {weight.type.toFixed(2).replace(".", ",")}) · Kämpfer-Sicherheit{" "}
            {pct(weight.identification)}
            {weight.identified ? "" : " — zählt nicht"}
          </span>
        </div>
      </div>

      {/* Scores */}
      {SCORE_LABEL.some(([k]) => ev.scores[k] != null) && (
        <div>
          <div className="t-label mb-2.5">Scores</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SCORE_LABEL.map(([key, label]) => {
              const value = ev.scores[key];
              if (value == null) return null;
              return (
                <div key={key} className="flex items-center gap-2">
                  <span
                    style={{
                      ...META_FONT,
                      color: "var(--text-3)",
                      width: "112px",
                      flexShrink: 0,
                    }}
                  >
                    {label}
                  </span>
                  <div className="t-progress flex-1">
                    <span
                      style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
                    />
                  </div>
                  <span
                    style={{
                      font: "var(--type-num)",
                      color: "var(--text-body)",
                      fontVariantNumeric: "tabular-nums",
                      width: "28px",
                      textAlign: "right",
                    }}
                  >
                    {Math.round(value)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top-Listen + Gefahrenprofil */}
      <SectionCard title="Top-Listen & Gefahrenprofil" defaultOpen>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TopList title="Top-Waffen" entries={ev.topWeapons} />
          <TopList title="Top-Muster" entries={ev.topPatterns} />
          <TopList title="Top-Schwächen" entries={ev.topWeaknesses} />
          <TopList title="Gefährliche Situationen" entries={ev.topDangers} />
        </div>
        {(ev.dangerProfile.mostDangerousWhen ||
          ev.dangerProfile.finishes ||
          ev.dangerProfile.vulnerableWhen) && (
          <div
            className="mt-3 flex flex-col gap-1.5 rounded-field p-3"
            style={{ ...FLAECHE, font: "var(--type-sub)", color: "var(--text-body)" }}
          >
            {ev.dangerProfile.mostDangerousWhen && (
              <div>
                <b style={{ color: "var(--warning)" }}>Am gefährlichsten:</b>{" "}
                {ev.dangerProfile.mostDangerousWhen}
              </div>
            )}
            {ev.dangerProfile.finishes && (
              <div>
                <b style={{ color: "var(--text-1)" }}>Finisht mit:</b>{" "}
                {ev.dangerProfile.finishes}
              </div>
            )}
            {ev.dangerProfile.vulnerableWhen && (
              <div>
                <b style={{ color: "var(--positive)" }}>Verwundbar:</b>{" "}
                {ev.dangerProfile.vulnerableWhen}
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* Befunde nach Kategorie */}
      <SectionCard title={`Befunde (${ev.findings.length})`} defaultOpen>
        <div className="flex flex-col gap-3.5">
          {DNA_CATEGORIES.map((cat) => {
            const findings = ev.findings.filter((f) =>
              f.questionId.startsWith(`${cat.id}_`),
            );
            if (findings.length === 0) return null;
            return (
              <div key={cat.id}>
                {/* Kein `cat.accent` mehr: Die Kategorie ist eine Überschrift,
                    keine Farbe (siehe Kopf dieser Datei). */}
                <div className="t-label mb-2">{cat.label}</div>
                <div className="flex flex-col gap-2">
                  {findings.map((f) => {
                    const question = DNA_QUESTION_BY_ID.get(f.questionId);
                    const done = applied.has(f.questionId);
                    const conflict = isConflict(f);
                    return (
                      <div
                        key={f.questionId}
                        className="rounded-field p-3"
                        style={
                          conflict
                            ? tonFlaeche("--warning", 10, 45)
                            : done
                              ? tonFlaeche("--positive", 10, 35)
                              : FLAECHE
                        }
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="min-w-0">
                            <div
                              style={{ ...META_FONT, color: "var(--text-3)" }}
                            >
                              {question?.label ?? f.questionId}
                            </div>
                            <p
                              className="mt-1"
                              style={{
                                font: "var(--type-sub)",
                                color: "var(--text-body)",
                              }}
                            >
                              {f.answer}
                            </p>
                            {/* DER KONFLIKT ALS VERGLEICH, nicht als Randnotiz.
                                Woher die bisherige Antwort stammt, weiß niemand
                                — die Herkunft wird nicht gespeichert (Backlog).
                                Deshalb „Bisher im Profil", ohne Quelle. */}
                            {conflict && existingDna && (
                              <div
                                className="mt-2 rounded-badge px-2.5 py-2"
                                style={tonFlaeche("--warning", 14, 40)}
                              >
                                <div
                                  className="flex items-center gap-1.5"
                                  style={{
                                    ...META_FONT,
                                    color: "var(--warning)",
                                  }}
                                >
                                  <span style={{ lineHeight: 0 }} aria-hidden>
                                    <Icon
                                      name="warn"
                                      size={13}
                                      strokeWidth={2.2}
                                    />
                                  </span>
                                  Bisher im Profil
                                </div>
                                <p
                                  className="mt-1"
                                  style={{
                                    font: "var(--type-sub)",
                                    color: "var(--text-body)",
                                  }}
                                >
                                  {existingDna[f.questionId]}
                                </p>
                                <p
                                  className="mt-1.5"
                                  style={{
                                    font: "var(--type-sub)",
                                    color: "var(--text-2)",
                                  }}
                                >
                                  &bdquo;Ersetzen&ldquo; schreibt den Befund von
                                  oben darüber. Ohne Klick bleibt der alte
                                  Stand.
                                </p>
                              </div>
                            )}
                            {f.evidence.length > 0 && (
                              <p
                                className="mt-1.5"
                                style={{
                                  font: "var(--type-sub)",
                                  color: "var(--text-3)",
                                }}
                              >
                                Beleg: {f.evidence.join(" · ")}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                            <ConfidenceBadge value={f.confidence} />
                            {canApply &&
                              (done ? (
                                <span
                                  className="flex items-center gap-1"
                                  style={{
                                    ...META_FONT,
                                    color: "var(--positive)",
                                  }}
                                >
                                  <span style={{ lineHeight: 0 }} aria-hidden>
                                    <Icon
                                      name="check"
                                      size={13}
                                      strokeWidth={2.4}
                                    />
                                  </span>
                                  Übernommen
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onApplyFindings?.([f.questionId])}
                                  disabled={busy}
                                  data-press
                                  className="t-interactive inline-flex min-h-hit items-center rounded-field px-3 disabled:opacity-50"
                                  style={
                                    conflict
                                      ? {
                                          ...BTN_FONT,
                                          color: "var(--warning)",
                                          ...tonFlaeche("--warning", 18, 55),
                                        }
                                      : {
                                          ...BTN_FONT,
                                          color: "var(--accent-text)",
                                          ...tonFlaeche("--accent", 16, 45),
                                        }
                                  }
                                >
                                  {conflict ? "Ersetzen" : "Übernehmen"}
                                </button>
                              ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {ev.findings.length === 0 && (
            <p style={{ font: "var(--type-sub)", color: "var(--text-3)" }}>
              Aus diesem Video kommen keine belastbaren Befunde.
            </p>
          )}
        </div>
      </SectionCard>

      {/* Roh-Beobachtungen (Gemini) */}
      <SectionCard title="Zahlen aus dem Video (Beobachtung)">
        <div
          className="flex flex-col gap-3"
          style={{ font: "var(--type-sub)", color: "var(--text-body)" }}
        >
          {/* Meta */}
          <div
            className="flex flex-wrap gap-x-4 gap-y-1"
            style={{ color: "var(--text-3)" }}
          >
            {obs.meta.ruleset && <span>Regelwerk: {obs.meta.ruleset}</span>}
            {obs.meta.rounds != null && <span>Runden: {obs.meta.rounds}</span>}
            {obs.meta.result && <span>Ausgang: {obs.meta.result}</span>}
            {obs.meta.opponentLevel && (
              <span>Gegner-Niveau: {obs.meta.opponentLevel}</span>
            )}
            {obs.meta.coverage && <span>Abdeckung: {obs.meta.coverage}</span>}
            {obs.meta.videoQuality && <span>Qualität: {obs.meta.videoQuality}</span>}
          </div>

          {/* Technik-Zähler */}
          {activeActions.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left" style={{ minWidth: "460px" }}>
                <thead>
                  {/* Der Schnitt steht an jedem `th`, nicht am `tr`: Die
                      UA-Regel `th { font-weight: bold }` schlägt einen
                      geerbten Wert, und die Kopfzeile liefe fetter als jedes
                      andere Label im Bericht. */}
                  <tr>
                    <th className="pb-2 pr-2" style={TH_STYLE}>Technik</th>
                    <th className="pb-2 pr-2" style={TH_STYLE}>Versuche</th>
                    <th className="pb-2 pr-2" style={TH_STYLE}>Treffer</th>
                    <th className="pb-2 pr-2" style={TH_STYLE}>Quote</th>
                    <th className="pb-2 pr-2" style={TH_STYLE}>Zone</th>
                    <th className="pb-2 pr-2" style={TH_STYLE}>Wirkung</th>
                    <th className="pb-2" style={TH_STYLE}>Timestamps</th>
                  </tr>
                </thead>
                <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
                  {activeActions.map((a, i) => (
                    <tr
                      key={`${a.id}-${i}`}
                      style={{ borderTop: "1px solid var(--line)" }}
                    >
                      <td
                        className="py-2 pr-2"
                        style={{ color: "var(--text-body)", fontWeight: 600 }}
                      >
                        {a.id === "other" ? (a.otherLabel ?? "Sonstige") : actionLabel(a.id)}
                        {a.setup && (
                          <span
                            style={{ color: "var(--text-3)", fontWeight: 400 }}
                          >
                            {" "}
                            · Setup: {a.setup}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-2">{a.attempted}</td>
                      <td className="py-2 pr-2">{a.landed}</td>
                      <td className="py-2 pr-2" style={{ color: "var(--accent-text)" }}>
                        {pct(successRate(a))}
                      </td>
                      <td className="py-2 pr-2" style={{ color: "var(--text-3)" }}>
                        {a.zone ? CAGE_ZONE_LABEL[a.zone] : "—"}
                      </td>
                      <td className="py-2 pr-2" style={{ color: "var(--text-3)" }}>
                        {a.damage != null ? DAMAGE_LABEL[Math.min(3, Math.max(0, Math.round(a.damage)))] : "—"}
                      </td>
                      <td className="py-2" style={{ color: "var(--text-3)" }}>
                        {a.timestamps.slice(0, 4).join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Kombos */}
          {obs.combos.length > 0 && (
            <div>
              <div className="t-label mb-1.5">Kombinationen</div>
              {obs.combos.map((c, i) => (
                <div key={i} className="mb-1" style={{ color: "var(--text-body)" }}>
                  <b>{c.sequence.map((s) => actionLabel(s)).join(" → ")}</b>{" "}
                  ({c.count}×{c.landedFully > 0 ? `, ${c.landedFully}× voll` : ""})
                  {c.openingAfter && (
                    <span style={{ color: "var(--accent-text)" }}>
                      {" "}
                      — Lücke danach: {c.openingAfter}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Defensive */}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {obs.defense.takedownsAgainst != null && (
              <span>
                TD-Defense: {obs.defense.takedownsDefended ?? 0}/
                {obs.defense.takedownsAgainst} abgewehrt
              </span>
            )}
            {obs.defense.hitLocations && (
              <span>
                Kassiert: Kopf {obs.defense.hitLocations.head} · Körper{" "}
                {obs.defense.hitLocations.body} · Beine {obs.defense.hitLocations.legs}
              </span>
            )}
            {obs.defense.knockdownsReceived != null &&
              obs.defense.knockdownsReceived > 0 && (
                <span style={{ color: "var(--warning)" }}>
                  Knockdowns kassiert: {obs.defense.knockdownsReceived}
                </span>
              )}
          </div>
          {obs.defense.rockedMoments.length > 0 && (
            <div style={{ color: "var(--warning)" }}>
              Wackler:{" "}
              {obs.defense.rockedMoments
                .map((r) => `${r.timestamp} (${r.note})`)
                .join(" · ")}
            </div>
          )}

          {/* Runden-Kurve */}
          {obs.rounds.length > 0 && (
            <div>
              <div className="t-label mb-1.5">Runden-Kurve (Cardio)</div>
              {obs.rounds.map((r) => (
                <div key={r.round} style={{ color: "var(--text-body)" }}>
                  <b>R{r.round}:</b>{" "}
                  {r.outputPerMin != null && `${r.outputPerMin} Akt./min`}
                  {r.hitRate != null && ` · ${pct(r.hitRate)} Quote`}
                  {r.strategy && ` · ${r.strategy}`}
                  {r.fatigueSigns && (
                    <span style={{ color: "var(--warning)" }}>
                      {" "}
                      · Ermüdung: {r.fatigueSigns}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Bewegung + Kontrollzeiten */}
          {(obs.movement || obs.controlTime) && (
            <div
              className="flex flex-wrap gap-x-4 gap-y-1"
              style={{ color: "var(--text-3)" }}
            >
              {obs.movement?.stance && <span>Stance: {obs.movement.stance}</span>}
              {obs.movement?.forwardPct != null && (
                <span>Vorwärtsdruck: {obs.movement.forwardPct}%</span>
              )}
              {obs.movement?.centerControlPct != null && (
                <span>Center-Kontrolle: {obs.movement.centerControlPct}%</span>
              )}
              {obs.controlTime?.clinchSeconds != null && (
                <span>Clinch: {obs.controlTime.clinchSeconds}s</span>
              )}
              {obs.controlTime?.topSeconds != null && (
                <span>Top: {obs.controlTime.topSeconds}s</span>
              )}
              {obs.controlTime?.bottomSeconds != null && (
                <span>Bottom: {obs.controlTime.bottomSeconds}s</span>
              )}
              {obs.controlTime?.cagePressureSeconds != null && (
                <span>Drückt an Cage: {obs.controlTime.cagePressureSeconds}s</span>
              )}
            </div>
          )}

          {obs.notes && (
            <p className="italic" style={{ color: "var(--text-3)" }}>
              {obs.notes}
            </p>
          )}
        </div>
      </SectionCard>

      {/* Merge-Hinweise */}
      {(ev.merge.confirms.length > 0 || ev.merge.contradicts.length > 0) && (
        <SectionCard
          title={
            mode === "opponent"
              ? "Abgleich mit bestehendem DeepFight-Profil"
              : "Abgleich mit bestehendem Kampfprofil"
          }
        >
          <div
            className="flex flex-col gap-2.5"
            style={{ font: "var(--type-sub)", color: "var(--text-body)" }}
          >
            {ev.merge.confirms.length > 0 && (
              <div>
                <b style={{ color: "var(--positive)" }}>Bestätigt:</b>{" "}
                {ev.merge.confirms
                  .map((c) => DNA_QUESTION_BY_ID.get(c.questionId)?.label ?? c.questionId)
                  .join(" · ")}
              </div>
            )}
            {ev.merge.contradicts.map((c) => (
              <div key={c.questionId}>
                <b style={{ color: "var(--warning)" }}>Widerspruch</b> —{" "}
                {DNA_QUESTION_BY_ID.get(c.questionId)?.label ?? c.questionId}:
                <br />
                <span style={{ color: "var(--text-3)" }}>
                  Bisher: &bdquo;{c.existing}&ldquo;
                </span>
                <br />
                <span>Video zeigt: &bdquo;{c.observed}&ldquo;</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── DAS ENDE DES WEGS ──────────────────────────────────────────────
          „Das Ende ist die Übernahme, nicht das Ergebnis." Bis hierher stand
          nach dem letzten Klick nur, dass Knöpfe fehlten. Jetzt steht hier,
          WAS im Profil gelandet ist und WO man es sieht. Drei Gesichter über
          EINEN MorphSwap, damit der Wechsel eine Bewegung hat und nicht
          umspringt (MOTION-BRIEF §1). */}
      {canApply && (
        <MorphSwap
          activeKey={fertig ? "fertig" : nurNochKonflikte ? "konflikte" : "offen"}
        >
          {fertig ? (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-card p-4"
              style={tonFlaeche("--positive", 12, 40)}
            >
              <div className="min-w-0">
                <div
                  className="flex items-center gap-1.5"
                  style={{ ...META_FONT, color: "var(--positive)" }}
                >
                  <span style={{ lineHeight: 0 }} aria-hidden>
                    <Icon name="check" size={14} strokeWidth={2.4} />
                  </span>
                  Übernahme durch
                </div>
                <p
                  className="mt-1"
                  style={{ font: "var(--type-body)", color: "var(--text-body)" }}
                >
                  {befundSatz}
                </p>
              </div>
              <Link
                href={zielWeg}
                data-press
                className="t-interactive inline-flex min-h-hit shrink-0 items-center gap-2 rounded-field px-4"
                style={{
                  ...BTN_FONT,
                  color: "var(--text-body)",
                  textDecoration: "none",
                  ...FLAECHE,
                }}
              >
                Profil ansehen
                <span style={{ lineHeight: 0 }} aria-hidden>
                  <Icon name="arrow-right" size={14} strokeWidth={2.2} />
                </span>
              </Link>
            </div>
          ) : nurNochKonflikte ? (
            <div
              className="rounded-card p-4"
              style={tonFlaeche("--warning", 12, 40)}
            >
              <div
                className="flex items-center gap-1.5"
                style={{ ...META_FONT, color: "var(--warning)" }}
              >
                <span style={{ lineHeight: 0 }} aria-hidden>
                  <Icon name="warn" size={14} strokeWidth={2.2} />
                </span>
                Noch {conflictCount}{" "}
                {conflictCount === 1 ? "Entscheidung" : "Entscheidungen"}
              </div>
              <p
                className="mt-1"
                style={{ font: "var(--type-body)", color: "var(--text-body)" }}
              >
                {befundSatz} Der Rest widerspricht dem bisherigen Stand — geh die{" "}
                {conflictCount === 1 ? "Stelle" : "Stellen"} oben durch und
                entscheide je Frage, was gilt.
              </p>
            </div>
          ) : (
            <div />
          )}
        </MorphSwap>
      )}
    </div>
  );
}
