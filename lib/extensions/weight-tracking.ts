/**
 * Gewicht-Tracking (Stub) — Vorbereitung für eine spätere Cut-/Bulk-Funktion.
 */

import type { WeightEntry } from "../types";

export interface WeightInput {
  weightKg: number;
  notes?: string;
  date?: Date;
}

export function createWeightEntry(input: WeightInput): WeightEntry {
  return {
    id: `w-${Date.now()}`,
    date: input.date ?? new Date(),
    weightKg: input.weightKg,
    notes: input.notes,
  };
}
