"use client";

/**
 * Ergebnis-Ansicht einer KI-Video-Analyse (Konzept §6).
 *
 * Zeigt Identifikation, Bewertung (Claude) und Roh-Beobachtungen (Gemini) und
 * bietet im Gegner-Modus die Übernahme in die Gegner-DNA an:
 *   • einzelne Befunde übernehmen
 *   • „Alle übernehmen" (alle konfliktfreien Befunde + Stats auf einmal)
 *   • Konflikte (bestehende Antwort widerspricht) nur per explizitem Klick
 */

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { DNA_CATEGORIES, DNA_QUESTION_BY_ID } from "@/lib/gegner-dna";
import { actionLabel, CAGE_ZONE_LABEL, successRate } from "@/lib/fight-stats";
import {
  ID_CONFIDENCE_WARN,
  type AnalysisMode,
  type DnaFinding,
  type TopListEntry,
  type VideoAnalysis,
} from "@/lib/video-analysis";

const VIOLET = "var(--ta-violet)";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
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

function SectionCard({
  title,
  accent = VIOLET,
  defaultOpen = false,
  children,
}: {
  title: string;
  accent?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className="rounded-xl"
      style={{ background: "var(--ink-2)", border: "1px solid var(--ink-4)" }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span
          className="font-mono-ta text-[10px] font-bold uppercase"
          style={{ letterSpacing: "0.18em", color: accent }}
        >
          {title}
        </span>
        <span
          style={{
            color: "var(--fg-4)",
            transform: open ? "rotate(90deg)" : "none",
            transition: "transform 0.15s",
            lineHeight: 0,
          }}
        >
          <Icon name="arrow-right" size={13} />
        </span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const good = value >= 0.7;
  const mid = value >= 0.4;
  return (
    <span
      className="font-mono-ta rounded px-1.5 py-0.5 text-[9px] font-bold"
      style={{
        background: good
          ? "rgba(62,224,107,0.12)"
          : mid
            ? "rgba(157,123,250,0.15)"
            : "rgba(255,79,168,0.15)",
        color: good ? "var(--ta-mint)" : mid ? VIOLET : "var(--ta-pink)",
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
      <div
        className="font-mono-ta mb-1.5 text-[9px] font-bold uppercase"
        style={{ letterSpacing: "0.15em", color: "var(--fg-4)" }}
      >
        {title}
      </div>
      <ol className="flex flex-col gap-1.5">
        {entries.map((e, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            <span
              className="font-display-ta font-black"
              style={{ color: VIOLET, minWidth: "14px" }}
            >
              {i + 1}
            </span>
            <span>
              <span className="font-bold" style={{ color: "var(--fg-2)" }}>
                {e.title}
              </span>{" "}
              <span style={{ color: "var(--fg-4)" }}>— {e.reason}</span>{" "}
              <ConfidenceBadge value={e.confidence} />
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
  const { observation: obs, evaluation: ev } = analysis;
  const applied = new Set(analysis.appliedFindingIds);
  const canApply = mode === "opponent" && !!onApplyFindings;

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

  return (
    <div className="flex flex-col gap-3">
      {/* Identifikation */}
      <div
        className="rounded-xl p-3.5"
        style={{
          background: idWarn ? "rgba(255,79,168,0.08)" : "rgba(157,123,250,0.08)",
          border: `1px solid ${idWarn ? "rgba(255,79,168,0.4)" : "rgba(157,123,250,0.35)"}`,
        }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: idWarn ? "var(--ta-pink)" : VIOLET }}>
            <Icon name={idWarn ? "warn" : "check"} size={14} />
          </span>
          <span
            className="font-mono-ta text-[10px] font-bold uppercase"
            style={{
              letterSpacing: "0.15em",
              color: idWarn ? "var(--ta-pink)" : VIOLET,
            }}
          >
            Kämpfer-Identifikation · {pct(obs.identification.idConfidence)}
          </span>
        </div>
        <p className="mt-1.5 text-xs" style={{ color: "var(--fg-2)" }}>
          {obs.identification.description || "Keine Beschreibung."}
        </p>
        {obs.identification.evidence.length > 0 && (
          <p className="font-mono-ta mt-1 text-[10px]" style={{ color: "var(--fg-4)" }}>
            Gesehen bei: {obs.identification.evidence.join(" · ")}
          </p>
        )}
        {idWarn && (
          <p className="mt-1.5 text-[11px] font-bold" style={{ color: "var(--ta-pink)" }}>
            Unsichere Identifikation — Befunde vor der Übernahme prüfen!
          </p>
        )}
      </div>

      {/* Zusammenfassung + Aktionen */}
      <div
        className="rounded-xl p-4"
        style={{
          background:
            "radial-gradient(400px 180px at 100% 0%, rgba(157,123,250,0.12), transparent 60%), var(--ink-2)",
          border: "1px solid rgba(157,123,250,0.3)",
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div
            className="font-mono-ta text-[10px] font-bold uppercase"
            style={{ letterSpacing: "0.18em", color: VIOLET }}
          >
            KI-Einschätzung
          </div>
          <div className="flex flex-wrap gap-2">
            {canApply && (
              <button
                onClick={onApplyAll}
                disabled={busy || openCount === 0}
                className="font-mono-ta rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase"
                style={{
                  letterSpacing: "0.12em",
                  background: openCount > 0 ? VIOLET : "var(--ink-4)",
                  color: openCount > 0 ? "#fff" : "var(--fg-4)",
                  opacity: busy ? 0.6 : 1,
                }}
              >
                Alle übernehmen ({openCount})
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                disabled={busy}
                className="font-mono-ta rounded-lg px-3 py-1.5 text-[10px] uppercase"
                style={{
                  letterSpacing: "0.12em",
                  border: "1px solid var(--ink-5)",
                  color: "var(--fg-4)",
                  background: "transparent",
                }}
              >
                Löschen
              </button>
            )}
          </div>
        </div>
        {conflictCount > 0 && canApply && (
          <p className="mt-1.5 text-[11px]" style={{ color: "var(--ta-pink)" }}>
            {conflictCount} {conflictCount === 1 ? "Konflikt" : "Konflikte"} mit
            bestehenden Antworten — diese werden nur einzeln übernommen.
          </p>
        )}
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--fg-2)" }}>
          {ev.summary}
        </p>
        <div
          className="font-mono-ta mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px]"
          style={{ color: "var(--fg-4)" }}
        >
          {ev.style.primaryStyle && <span>Stil: {ev.style.primaryStyle}</span>}
          {ev.style.approach && <span>Ansatz: {ev.style.approach}</span>}
          {ev.style.baseDiscipline && <span>Basis: {ev.style.baseDiscipline}</span>}
          <span>Video-Gewichtung: {pct(ev.merge.weight)}</span>
        </div>
      </div>

      {/* Scores */}
      {SCORE_LABEL.some(([k]) => ev.scores[k] != null) && (
        <div>
          <div
            className="font-mono-ta mb-2.5 text-[10px] font-bold uppercase"
            style={{ letterSpacing: "0.18em", color: VIOLET }}
          >
            Scores
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SCORE_LABEL.map(([key, label]) => {
              const value = ev.scores[key];
              if (value == null) return null;
              return (
                <div key={key} className="flex items-center gap-2">
                  <span
                    className="font-mono-ta text-[9px] uppercase"
                    style={{
                      letterSpacing: "0.1em",
                      color: "var(--fg-4)",
                      width: "110px",
                      flexShrink: 0,
                    }}
                  >
                    {label}
                  </span>
                  <div
                    className="h-1.5 flex-1 overflow-hidden rounded-full"
                    style={{ background: "var(--ink-4)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(2, Math.min(100, value))}%`,
                        background: `linear-gradient(90deg, ${VIOLET}, var(--ta-pink))`,
                      }}
                    />
                  </div>
                  <span
                    className="font-display-ta text-xs font-black"
                    style={{ color: "var(--fg-2)", width: "26px", textAlign: "right" }}
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
            className="mt-3 flex flex-col gap-1 rounded-lg p-3 text-xs"
            style={{ background: "var(--ink-3)", color: "var(--fg-3)" }}
          >
            {ev.dangerProfile.mostDangerousWhen && (
              <div>
                <b style={{ color: "var(--ta-pink)" }}>Am gefährlichsten:</b>{" "}
                {ev.dangerProfile.mostDangerousWhen}
              </div>
            )}
            {ev.dangerProfile.finishes && (
              <div>
                <b style={{ color: "var(--fg-2)" }}>Finisht mit:</b>{" "}
                {ev.dangerProfile.finishes}
              </div>
            )}
            {ev.dangerProfile.vulnerableWhen && (
              <div>
                <b style={{ color: "var(--ta-mint)" }}>Verwundbar:</b>{" "}
                {ev.dangerProfile.vulnerableWhen}
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* Befunde nach Kategorie */}
      <SectionCard
        title={`Befunde (${ev.findings.length})`}
        defaultOpen
        accent={VIOLET}
      >
        <div className="flex flex-col gap-3">
          {DNA_CATEGORIES.map((cat) => {
            const findings = ev.findings.filter((f) =>
              f.questionId.startsWith(`${cat.id}_`),
            );
            if (findings.length === 0) return null;
            return (
              <div key={cat.id}>
                <div
                  className="font-mono-ta mb-1.5 text-[9px] font-bold uppercase"
                  style={{ letterSpacing: "0.15em", color: cat.accent }}
                >
                  {cat.label}
                </div>
                <div className="flex flex-col gap-1.5">
                  {findings.map((f) => {
                    const question = DNA_QUESTION_BY_ID.get(f.questionId);
                    const done = applied.has(f.questionId);
                    const conflict = isConflict(f);
                    return (
                      <div
                        key={f.questionId}
                        className="rounded-lg p-2.5"
                        style={{
                          background: "var(--ink-3)",
                          border: `1px solid ${
                            conflict
                              ? "rgba(255,79,168,0.45)"
                              : done
                                ? "rgba(62,224,107,0.35)"
                                : "var(--ink-4)"
                          }`,
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div
                              className="text-[10px] font-bold"
                              style={{ color: "var(--fg-4)" }}
                            >
                              {question?.label ?? f.questionId}
                            </div>
                            <p
                              className="mt-0.5 text-xs leading-relaxed"
                              style={{ color: "var(--fg-2)" }}
                            >
                              {f.answer}
                            </p>
                            {conflict && existingDna && (
                              <p
                                className="mt-1 text-[10px]"
                                style={{ color: "var(--ta-pink)" }}
                              >
                                Konflikt — bisher: „{existingDna[f.questionId]}"
                              </p>
                            )}
                            {f.evidence.length > 0 && (
                              <p
                                className="font-mono-ta mt-1 text-[9px]"
                                style={{ color: "var(--fg-5, var(--fg-4))" }}
                              >
                                Beleg: {f.evidence.join(" · ")}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-shrink-0 flex-col items-end gap-1">
                            <ConfidenceBadge value={f.confidence} />
                            {canApply &&
                              (done ? (
                                <span
                                  className="flex items-center gap-1 text-[9px] font-bold"
                                  style={{ color: "var(--ta-mint)" }}
                                >
                                  <Icon name="check" size={11} /> Übernommen
                                </span>
                              ) : (
                                <button
                                  onClick={() => onApplyFindings?.([f.questionId])}
                                  disabled={busy}
                                  className="font-mono-ta rounded px-2 py-1 text-[9px] font-bold uppercase"
                                  style={{
                                    letterSpacing: "0.1em",
                                    background: conflict
                                      ? "var(--ta-pink)"
                                      : "rgba(157,123,250,0.2)",
                                    color: conflict ? "#fff" : VIOLET,
                                    opacity: busy ? 0.6 : 1,
                                  }}
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
            <p className="text-xs" style={{ color: "var(--fg-4)" }}>
              Keine belastbaren Befunde aus diesem Video.
            </p>
          )}
        </div>
      </SectionCard>

      {/* Roh-Beobachtungen (Gemini) */}
      <SectionCard title="Zahlen aus dem Video (Beobachtung)">
        <div className="flex flex-col gap-3 text-xs">
          {/* Meta */}
          <div
            className="font-mono-ta flex flex-wrap gap-x-4 gap-y-1 text-[10px]"
            style={{ color: "var(--fg-4)" }}
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
                  <tr
                    className="font-mono-ta text-[9px] uppercase"
                    style={{ color: "var(--fg-4)", letterSpacing: "0.1em" }}
                  >
                    <th className="pb-1.5 pr-2">Technik</th>
                    <th className="pb-1.5 pr-2">Versuche</th>
                    <th className="pb-1.5 pr-2">Treffer</th>
                    <th className="pb-1.5 pr-2">Quote</th>
                    <th className="pb-1.5 pr-2">Zone</th>
                    <th className="pb-1.5 pr-2">Wirkung</th>
                    <th className="pb-1.5">Timestamps</th>
                  </tr>
                </thead>
                <tbody>
                  {activeActions.map((a, i) => (
                    <tr
                      key={`${a.id}-${i}`}
                      style={{ borderTop: "1px solid var(--ink-4)" }}
                    >
                      <td className="py-1.5 pr-2 font-bold" style={{ color: "var(--fg-2)" }}>
                        {a.id === "other" ? (a.otherLabel ?? "Sonstige") : actionLabel(a.id)}
                        {a.setup && (
                          <span className="font-normal" style={{ color: "var(--fg-4)" }}>
                            {" "}
                            · Setup: {a.setup}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 pr-2">{a.attempted}</td>
                      <td className="py-1.5 pr-2">{a.landed}</td>
                      <td className="py-1.5 pr-2" style={{ color: VIOLET }}>
                        {pct(successRate(a))}
                      </td>
                      <td className="py-1.5 pr-2" style={{ color: "var(--fg-4)" }}>
                        {a.zone ? CAGE_ZONE_LABEL[a.zone] : "—"}
                      </td>
                      <td className="py-1.5 pr-2" style={{ color: "var(--fg-4)" }}>
                        {a.damage != null ? DAMAGE_LABEL[Math.min(3, Math.max(0, Math.round(a.damage)))] : "—"}
                      </td>
                      <td
                        className="font-mono-ta py-1.5 text-[9px]"
                        style={{ color: "var(--fg-4)" }}
                      >
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
              <div
                className="font-mono-ta mb-1 text-[9px] font-bold uppercase"
                style={{ letterSpacing: "0.15em", color: "var(--fg-4)" }}
              >
                Kombinationen
              </div>
              {obs.combos.map((c, i) => (
                <div key={i} className="mb-1" style={{ color: "var(--fg-3)" }}>
                  <b style={{ color: "var(--fg-2)" }}>
                    {c.sequence.map((s) => actionLabel(s)).join(" → ")}
                  </b>{" "}
                  ({c.count}×{c.landedFully > 0 ? `, ${c.landedFully}× voll` : ""})
                  {c.openingAfter && (
                    <span style={{ color: VIOLET }}> — Lücke danach: {c.openingAfter}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Defensive */}
          <div className="flex flex-wrap gap-x-4 gap-y-1" style={{ color: "var(--fg-3)" }}>
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
                <span style={{ color: "var(--ta-pink)" }}>
                  Knockdowns kassiert: {obs.defense.knockdownsReceived}
                </span>
              )}
          </div>
          {obs.defense.rockedMoments.length > 0 && (
            <div style={{ color: "var(--ta-pink)" }}>
              Wackler:{" "}
              {obs.defense.rockedMoments
                .map((r) => `${r.timestamp} (${r.note})`)
                .join(" · ")}
            </div>
          )}

          {/* Runden-Kurve */}
          {obs.rounds.length > 0 && (
            <div>
              <div
                className="font-mono-ta mb-1 text-[9px] font-bold uppercase"
                style={{ letterSpacing: "0.15em", color: "var(--fg-4)" }}
              >
                Runden-Kurve (Cardio)
              </div>
              {obs.rounds.map((r) => (
                <div key={r.round} style={{ color: "var(--fg-3)" }}>
                  <b style={{ color: "var(--fg-2)" }}>R{r.round}:</b>{" "}
                  {r.outputPerMin != null && `${r.outputPerMin} Akt./min`}
                  {r.hitRate != null && ` · ${pct(r.hitRate)} Quote`}
                  {r.strategy && ` · ${r.strategy}`}
                  {r.fatigueSigns && (
                    <span style={{ color: "var(--ta-pink)" }}>
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
              className="font-mono-ta flex flex-wrap gap-x-4 gap-y-1 text-[10px]"
              style={{ color: "var(--fg-4)" }}
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
            <p className="italic" style={{ color: "var(--fg-4)" }}>
              {obs.notes}
            </p>
          )}
        </div>
      </SectionCard>

      {/* Merge-Hinweise */}
      {(ev.merge.confirms.length > 0 || ev.merge.contradicts.length > 0) && (
        <SectionCard title="Abgleich mit bestehender DNA">
          <div className="flex flex-col gap-2 text-xs">
            {ev.merge.confirms.length > 0 && (
              <div style={{ color: "var(--ta-mint)" }}>
                <b>Bestätigt:</b>{" "}
                {ev.merge.confirms
                  .map((id) => DNA_QUESTION_BY_ID.get(id)?.label ?? id)
                  .join(" · ")}
              </div>
            )}
            {ev.merge.contradicts.map((c) => (
              <div key={c.questionId} style={{ color: "var(--fg-3)" }}>
                <b style={{ color: "var(--ta-pink)" }}>Widerspruch</b> —{" "}
                {DNA_QUESTION_BY_ID.get(c.questionId)?.label ?? c.questionId}:
                <br />
                <span style={{ color: "var(--fg-4)" }}>Bisher: „{c.existing}"</span>
                <br />
                <span>Video zeigt: „{c.observed}"</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
