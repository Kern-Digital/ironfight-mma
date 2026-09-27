"use client";

/**
 * useKursplan() — die Kurse des EIGENEN Gyms, live (seit 26.09.2026).
 *
 * EIN Abo für die ganze App: Kopfbalken, Kursplan, Dashboard, Filter und
 * Plan-Freigaben lesen alle dieselbe Woche. Hinge jede Seite selbst am
 * Dokument, zahlte ein Seitenwechsel denselben Plan ein zweites Mal.
 *
 * LIVE (onSnapshot), weil die Verwaltung den Plan ändert, während Trainer und
 * Athleten ihn offen haben: Ein verschobener Kurs soll im Kopfbalken stehen,
 * ohne dass jemand neu lädt.
 *
 * `geladen` trennt „noch nicht da" von „dieses Gym hat keinen Kurs". Ein
 * frisch angemeldetes Gym hat wirklich keinen — die Seiten zeigen dann ihren
 * Leerzustand statt eines Ladebalkens, der nie endet.
 */

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth-context";
import { KEIN_GYM, resolveGymId } from "./gym";
import { kurseLesen, raeumeLesen, type Raum } from "./kursplan";
import type { TrainingBlock } from "./types";

export interface KursplanStand {
  /** Die Kurse des aktiven Plans, nach Tag und Beginn sortiert. */
  kurse: TrainingBlock[];
  /** false, solange das erste Lesen läuft. */
  geladen: boolean;
  /** ID des aktiven Plans — null, solange das Gym noch keinen hat. */
  planId: string | null;
  /** Die Räume des Gyms (Leon 27.09.) — leer, wenn es keine pflegt. */
  raeume: Raum[];
}

const LEER: KursplanStand = { kurse: [], geladen: false, planId: null, raeume: [] };

const KursplanContext = createContext<KursplanStand>(LEER);

export function KursplanProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, profileLoading } = useAuth();
  const gymId = resolveGymId(profile);
  const [stand, setStand] = useState<KursplanStand>(LEER);

  useEffect(() => {
    if (profileLoading) return;
    // Ohne Konto und ohne Gym (Plattform-Admin) gibt es keinen Plan zu lesen.
    if (!user || gymId === KEIN_GYM) {
      setStand({ kurse: [], geladen: true, planId: null, raeume: [] });
      return;
    }
    setStand(LEER);

    let lebt = true;
    let abbestellen: (() => void) | null = null;
    (async () => {
      const { collection, limit, onSnapshot, query, where } = await import("firebase/firestore");
      const { getFirestoreDb } = await import("./firebase");
      if (!lebt) return;
      const q = query(
        collection(getFirestoreDb(), "gyms", gymId, "schedulePlans"),
        where("aktiv", "==", true),
        limit(1),
      );
      abbestellen = onSnapshot(
        q,
        (snap) => {
          const plan = snap.docs[0];
          setStand({
            kurse: plan ? kurseLesen(plan.get("kurse")) : [],
            geladen: true,
            planId: plan?.id ?? null,
            raeume: plan ? raeumeLesen(plan.get("raeume")) : [],
          });
        },
        (err) => {
          // Lesefehler: leere Woche statt ewigem Laden. Die Seiten zeigen dann
          // ihren Leerzustand — falsch, aber nicht kaputt; die Konsole sagt,
          // warum.
          console.error("[kursplan]", err);
          setStand({ kurse: [], geladen: true, planId: null, raeume: [] });
        },
      );
    })().catch((err) => {
      console.error("[kursplan]", err);
      if (lebt) setStand({ kurse: [], geladen: true, planId: null, raeume: [] });
    });

    return () => {
      lebt = false;
      abbestellen?.();
    };
  }, [user, gymId, profileLoading]);

  const wert = useMemo(() => stand, [stand]);
  return <KursplanContext.Provider value={wert}>{children}</KursplanContext.Provider>;
}

export function useKursplan(): KursplanStand {
  return useContext(KursplanContext);
}
