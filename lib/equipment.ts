import type { Category, EquipmentDef, EquipmentId } from "./types";

export const EQUIPMENT: Record<EquipmentId, EquipmentDef> = {
  bodyweight: {
    id: "bodyweight",
    label: "Keine Geräte",
    icon: "🤸",
    description: "Bodyweight only — alles ohne Equipment möglich.",
    defaultFor: ["boxing", "wrestling", "bjj", "muay-thai"],
  },
  "jump-rope": {
    id: "jump-rope",
    label: "Springseil",
    icon: "🪢",
    description: "Klassisches Aufwärm- und Konditions-Tool.",
    defaultFor: ["boxing", "muay-thai"],
  },
  "kettlebell-10": {
    id: "kettlebell-10",
    label: "Kettlebell ~10 kg",
    icon: "🏋️",
    description: "Leichte Kettlebell für Swings, Goblet-Squats, Cleans.",
    defaultFor: ["boxing", "wrestling", "muay-thai"],
  },
  "kettlebell-20": {
    id: "kettlebell-20",
    label: "Kettlebell ~20 kg",
    icon: "🏋️",
    description: "Schwere Kettlebell für Power-Übungen.",
    defaultFor: ["wrestling", "muay-thai"],
  },
  dumbbell: {
    id: "dumbbell",
    label: "Kurzhantel",
    icon: "💪",
    description: "Kurzhanteln für Punches, Schulterarbeit, Kraft.",
    defaultFor: ["boxing", "muay-thai"],
  },
  "medicine-ball-7": {
    id: "medicine-ball-7",
    label: "Medizinball ~7 kg",
    icon: "⚽",
    description: "Slams, Throws, Core-Power.",
    defaultFor: ["wrestling", "boxing"],
  },
  "heavy-bag": {
    id: "heavy-bag",
    label: "Boxsack",
    icon: "🥊",
    description: "Schwerer Sandsack für Schläge, Kicks und Combos.",
    defaultFor: ["boxing", "muay-thai"],
  },
  pads: {
    id: "pads",
    label: "Pratzen",
    icon: "🧤",
    description: "Pratzen für Pad-Work mit Partner.",
    defaultFor: ["boxing", "muay-thai"],
  },
  mat: {
    id: "mat",
    label: "Trainingsmatte",
    icon: "🟦",
    description: "Matte für Bodenarbeit, BJJ, Wrestling.",
    defaultFor: ["bjj", "wrestling"],
  },
  "resistance-band": {
    id: "resistance-band",
    label: "Widerstandsband",
    icon: "🪢",
    description: "Bands für Mobility, Aktivierung und Drills.",
    defaultFor: ["wrestling", "bjj", "muay-thai"],
  },
  dummy: {
    id: "dummy",
    label: "Grappling-Dummy",
    icon: "🧍",
    description: "Dummy für solo BJJ-/Wrestling-Drills.",
    defaultFor: ["bjj", "wrestling"],
  },
};

export const ALL_EQUIPMENT = Object.values(EQUIPMENT);

export function getEquipment(id: EquipmentId): EquipmentDef {
  return EQUIPMENT[id];
}

/** Liefert die für eine Kategorie typischen Equipment-IDs zur Vorauswahl. */
export function defaultEquipmentForCategory(cat: Category): EquipmentId[] {
  return ALL_EQUIPMENT.filter((e) => e.defaultFor.includes(cat)).map(
    (e) => e.id,
  );
}
