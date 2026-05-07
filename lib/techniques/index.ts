import type { Category, Difficulty, Discipline, Technique } from "../types";
import { BOXING_TECHNIQUES } from "./boxing";
import { WRESTLING_TECHNIQUES } from "./wrestling";
import { BJJ_TECHNIQUES } from "./bjj";
import { MUAY_THAI_TECHNIQUES } from "./muay-thai";
import { KICKBOXEN_TECHNIQUES } from "./kickboxen";
import { MMA_BASIC_TECHNIQUES } from "./mma-basics";

/** Aggregierte Technikbibliothek über alle Disziplinen. */
export const ALL_TECHNIQUES: Technique[] = [
  ...BOXING_TECHNIQUES,
  ...WRESTLING_TECHNIQUES,
  ...BJJ_TECHNIQUES,
  ...MUAY_THAI_TECHNIQUES,
  ...KICKBOXEN_TECHNIQUES,
  ...MMA_BASIC_TECHNIQUES,
];

const BY_ID = new Map<string, Technique>(
  ALL_TECHNIQUES.map((t) => [t.id, t]),
);

const BY_SLUG = new Map<string, Technique>(
  ALL_TECHNIQUES.map((t) => [`${t.category}/${t.slug}`, t]),
);

export function getTechniqueById(id: string): Technique | undefined {
  return BY_ID.get(id);
}

export function getTechniqueBySlug(
  category: Category,
  slug: string,
): Technique | undefined {
  return BY_SLUG.get(`${category}/${slug}`);
}

export function getTechniquesByCategory(cat: Category): Technique[] {
  return ALL_TECHNIQUES.filter((t) => t.category === cat);
}

export function getTechniquesByDifficulty(d: Difficulty): Technique[] {
  return ALL_TECHNIQUES.filter((t) => t.difficulty === d);
}

export function searchTechniques(q: string): Technique[] {
  if (!q.trim()) return ALL_TECHNIQUES;
  const needle = q.toLowerCase();
  return ALL_TECHNIQUES.filter(
    (t) =>
      t.name.toLowerCase().includes(needle) ||
      t.description.toLowerCase().includes(needle) ||
      t.usage.toLowerCase().includes(needle),
  );
}

export const CATEGORY_LABEL: Record<Category, string> = {
  boxing: "Boxing",
  wrestling: "Wrestling",
  bjj: "Brazilian Jiu-Jitsu",
  "muay-thai": "Muay Thai",
};

export const CATEGORY_TAG: Record<Category, string> = {
  boxing: "Stand-Up",
  wrestling: "Grappling",
  bjj: "Ground",
  "muay-thai": "Stand-Up",
};

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  boxing: "Boxing",
  kickboxen: "Kickboxen",
  "muay-thai": "Muay Thai",
  mma: "MMA",
  wrestling: "Wrestling / Ringen",
  bjj: "BJJ / Grappling",
  karate: "Karate",
  "wing-tsung": "Wing Tsung",
  "self-defense": "Self-Defense",
  "fitness-kickboxen": "Fitness-Kickboxen",
};

/**
 * Liefert eine YouTube-Suche für eine Technik.
 * Verwendet `technique.videoSearchQuery` wenn vorhanden, sonst Fallback auf
 * Name + Kategorie. Wird auf der Detail-Seite als „Externes Video suchen"-Button
 * verwendet, solange noch kein lizenz-validiertes Video zugeordnet ist.
 */
export function youtubeSearchUrl(technique: Technique): string {
  const raw = technique.videoSearchQuery ?? `${technique.name} ${technique.category} tutorial`;
  const q = encodeURIComponent(raw);
  return `https://www.youtube.com/results?search_query=${q}`;
}

export {
  BOXING_TECHNIQUES,
  WRESTLING_TECHNIQUES,
  BJJ_TECHNIQUES,
  MUAY_THAI_TECHNIQUES,
  KICKBOXEN_TECHNIQUES,
  MMA_BASIC_TECHNIQUES,
};
