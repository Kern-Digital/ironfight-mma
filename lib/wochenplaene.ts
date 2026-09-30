"use client";

/**
 * useWochenplaene() — ALLE Wochenpläne des Gyms, live. Nur für die
 * Verwaltung (Leon 27.09.2026: „nur die anderen in der verwaltung sehen die
 * anderen wochenpläne und können einen anderen aktivieren").
 *
 * Trainer und Athleten lesen weiter nur den aktiven Plan (useKursplan) — die
 * Regel lässt sie an keinen anderen heran. Deshalb ist das hier ein eigener
 * Hook und kein Feld in useKursplan: Er läuft nur auf der Seite, die ihn
 * braucht, und nur mit Verwaltungsrecht.
 */

import { useEffect, useState } from "react";
import { planLesen, plaeneSortieren, type Wochenplan } from "./kursplan";

export interface WochenplaeneStand {
  /** In fester Reihenfolge (nach Anlage) — Aktivieren sortiert nicht um. */
  plaene: Wochenplan[];
  geladen: boolean;
  fehler: boolean;
}

export function useWochenplaene(gymId: string, aktiv: boolean): WochenplaeneStand {
  const [stand, setStand] = useState<WochenplaeneStand>({ plaene: [], geladen: false, fehler: false });

  useEffect(() => {
    if (!aktiv) return;
    let lebt = true;
    let abbestellen: (() => void) | null = null;
    (async () => {
      const { collection, onSnapshot } = await import("firebase/firestore");
      const { getFirestoreDb } = await import("./firebase");
      if (!lebt) return;
      abbestellen = onSnapshot(
        collection(getFirestoreDb(), "gyms", gymId, "schedulePlans"),
        (snap) => {
          setStand({
            plaene: plaeneSortieren(snap.docs.map((d) => planLesen(d.id, d.data()))),
            geladen: true,
            fehler: false,
          });
        },
        (err) => {
          console.error("[wochenplaene]", err);
          setStand({ plaene: [], geladen: true, fehler: true });
        },
      );
    })().catch((err) => {
      console.error("[wochenplaene]", err);
      if (lebt) setStand({ plaene: [], geladen: true, fehler: true });
    });
    return () => {
      lebt = false;
      abbestellen?.();
    };
  }, [gymId, aktiv]);

  return stand;
}
