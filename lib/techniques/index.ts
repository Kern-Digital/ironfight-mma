import type { Category, Difficulty, Technique } from "../types";
import { BOXING_TECHNIQUES } from "./boxing";
import { WRESTLING_TECHNIQUES } from "./wrestling";
import { BJJ_TECHNIQUES } from "./bjj";
import { MUAY_THAI_TECHNIQUES } from "./muay-thai";

/** Aggregierte Technikbibliothek über alle Disziplinen. */
export const ALL_TECHNIQUES: Technique[] = [
  ...BOXING_TECHNIQUES,
  ...WRESTLING_TECHNIQUES,
  ...BJJ_TECHNIQUES,
  ...MUAY_THAI_TECHNIQUES,
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

/**
 * Liefert eine YouTube-Suche für eine Technik.
 * Wird auf der Detail-Seite als „Externes Video suchen"-Button verwendet,
 * solange noch kein lizenz-validiertes Video zugeordnet ist.
 */
export function youtubeSearchUrl(technique: Technique): string {
  const q = encodeURIComponent(`${technique.name} ${technique.category} tutorial`);
  return `https://www.youtube.com/results?search_query=${q}`;
}

export {
  BOXING_TECHNIQUES,
  WRESTLING_TECHNIQUES,
  BJJ_TECHNIQUES,
  MUAY_THAI_TECHNIQUES,
};
