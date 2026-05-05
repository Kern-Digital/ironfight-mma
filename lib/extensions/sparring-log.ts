/**
 * Sparring-Log (Stub)
 *
 * Architektonische Vorbereitung — User können später Sparring-Sessions
 * separat von Workouts loggen mit Partner, Runden, Notizen, Bewertung.
 */

import type { SparringEntry, Category } from "../types";

export interface SparringInput {
  category: Category;
  rounds: number;
  partner?: string;
  notes?: string;
  rating?: number;
}

export function createSparringEntrySkeleton(input: SparringInput): SparringEntry {
  return {
    id: `spar-${Date.now()}`,
    date: new Date(),
    category: input.category,
    rounds: input.rounds,
    partner: input.partner,
    notes: input.notes,
    rating: input.rating,
  };
}
