"use client";

import TrainerRoute from "@/components/TrainerRoute";
import TrainerSubnav from "@/components/trainer/TrainerSubnav";
import { useAuth } from "@/lib/auth-context";

/**
 * Layout für den gesamten Trainerbereich: Guard + Bereichs-Navigation an
 * EINER Stelle — die einzelnen Seiten brauchen kein eigenes <TrainerRoute>.
 *
 * Die Bereichs-Navigation zeigt Schüler, DeepFight und Wettkampf — lauter
 * Trainer-Werkzeuge. Eine reine Verwaltung (Verwaltungsrecht ohne
 * Trainer-Häkchen, Checkpoint 2) besucht hier nur ihre eigenen Seiten und
 * bekommt die Leiste deshalb nicht: Sie führte ausschließlich zu Ansichten,
 * die die Firestore-Regeln ihr verwehren.
 */
export default function TrainerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = useAuth();
  const isTrainer = profile?.role === "trainer" || profile?.role === "admin";

  return (
    <TrainerRoute>
      {isTrainer && <TrainerSubnav />}
      {children}
    </TrainerRoute>
  );
}
