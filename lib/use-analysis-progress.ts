"use client";

/**
 * Fortschritt 0–100 % für lange Pipelines (Upload, Vorlauf, Beobachtung,
 * Bewertung). Bis Etappe 2 lebte der Haken in `VideoAnalysisSection`; seit
 * der Upload-Fluss eine eigene Komponente ist, wohnt er hier und kennt seine
 * Phasen nicht mehr fest — der Aufrufer gibt Anteil und Zeitkonstante je
 * Phase mit.
 *
 * Zwei Schätzer laufen parallel, angezeigt wird der höhere: das echte Signal
 * (Upload-Bytes, empfangene Zeichen der Bewertung) und ein Zeitschätzer
 * `1 − e^(−t/τ)` als Boden, gedeckelt bei 92 % — nur er überbrückt die
 * Phasen, die kein Signal liefern (Gemini liest minutenlang, bevor etwas
 * zurückkommt). Der Wert FÄLLT NIE (auch nicht beim Auto-Neustart) und wird
 * pro Tick nur zu 25 % nachgezogen.
 */

import { useCallback, useEffect, useRef, useState } from "react";

/** Obergrenze des Zeitschätzers je Phase — der Rest gehört dem echten Signal. */
const TIME_ESTIMATE_CAP = 0.92;

export interface ProgressController<K extends string> {
  /** Angezeigter Wert 0–100, geglättet und monoton steigend. */
  percent: number;
  /** Legt fest, welche Phasen überhaupt laufen (bestimmt die Bänder). */
  begin: (phases: K[]) => void;
  /** Wechselt in eine Phase — startet deren Zeitschätzer neu. */
  enter: (phase: K) => void;
  /** Meldet echten Fortschritt 0–1 innerhalb der aktuellen Phase. */
  report: (fraction: number) => void;
  /** Setzt hart auf 100 % — das Ergebnis liegt vor. */
  complete: () => void;
  reset: () => void;
}

export function useAnalysisProgress<K extends string>(
  running: boolean,
  /** Anteil jeder Phase an der Gesamtanzeige (nach realer Laufzeit gewichtet). */
  share: Record<K, number>,
  /** Zeitkonstante je Phase in Sekunden. */
  tau: Record<K, number>,
): ProgressController<K> {
  const [percent, setPercent] = useState(0);
  const phasesRef = useRef<K[]>([]);
  const phaseRef = useRef<K | null>(null);
  const startedAtRef = useRef(0);
  const realRef = useRef(0); // echtes Signal als Gesamtanteil 0–1
  const shownRef = useRef(0); // zuletzt angezeigter Wert 0–1
  const shareRef = useRef(share);
  shareRef.current = share;
  const tauRef = useRef(tau);
  tauRef.current = tau;

  const band = useCallback((phase: K): [number, number] => {
    const active = phasesRef.current;
    const total = active.reduce((sum, p) => sum + shareRef.current[p], 0);
    if (total <= 0) return [0, 1];
    let start = 0;
    for (const p of active) {
      const span = shareRef.current[p] / total;
      if (p === phase) return [start, start + span];
      start += span;
    }
    return [start, 1];
  }, []);

  const reset = useCallback(() => {
    phasesRef.current = [];
    phaseRef.current = null;
    realRef.current = 0;
    shownRef.current = 0;
    setPercent(0);
  }, []);

  const begin = useCallback((phases: K[]) => {
    phasesRef.current = phases;
  }, []);

  const enter = useCallback(
    (phase: K) => {
      phaseRef.current = phase;
      startedAtRef.current = Date.now();
      const [start] = band(phase);
      realRef.current = Math.max(realRef.current, start);
    },
    [band],
  );

  const report = useCallback(
    (fraction: number) => {
      const phase = phaseRef.current;
      if (!phase) return;
      const [start, end] = band(phase);
      const value = start + (end - start) * Math.max(0, Math.min(1, fraction));
      realRef.current = Math.max(realRef.current, value);
    },
    [band],
  );

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const phase = phaseRef.current;
      let target = realRef.current;
      if (phase) {
        const [start, end] = band(phase);
        const elapsed = (Date.now() - startedAtRef.current) / 1000;
        const estimate =
          (1 - Math.exp(-elapsed / tauRef.current[phase])) * TIME_ESTIMATE_CAP;
        target = Math.max(target, start + (end - start) * estimate);
      }
      // Sanft nachziehen statt springen; nie rückwärts.
      const next = Math.max(
        shownRef.current,
        shownRef.current + (target - shownRef.current) * 0.25,
      );
      if (Math.round(next * 100) !== Math.round(shownRef.current * 100)) {
        setPercent(Math.round(next * 100));
      }
      shownRef.current = next;
    }, 150);
    return () => clearInterval(id);
  }, [running, band]);

  const complete = useCallback(() => {
    phaseRef.current = null;
    realRef.current = 1;
    shownRef.current = 1;
    setPercent(100);
  }, []);

  return { percent, begin, enter, report, complete, reset };
}
