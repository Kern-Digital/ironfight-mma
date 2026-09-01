"use client";

import VerwaltungRoute from "@/components/VerwaltungRoute";

/**
 * Layout des Verwaltungsbereichs (Multi-Gym Phase 2, Checkpoint 3): der Guard
 * an EINER Stelle — die einzelnen Seiten brauchen kein eigenes
 * `<VerwaltungRoute>`.
 *
 * Bewusst OHNE Bereichs-Navigation. Der Trainerbereich hat eine
 * (`TrainerSubnav`), weil er sieben Werkzeuge trägt; hier sind es drei
 * Seiten, die alle in der Top-Navigation unter „Verwaltung" stehen. Eine
 * zweite Leiste darüber wäre dieselbe Liste zweimal.
 */
export default function VerwaltungLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <VerwaltungRoute>{children}</VerwaltungRoute>;
}
