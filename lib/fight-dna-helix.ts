import {
  DNA_CATEGORIES,
  dnaCompleteness,
  isAnswered,
  type GegnerDnaAnswers,
} from "@/lib/gegner-dna";
import {
  DNA_SPLIT_KEYS,
  DNA_SPLIT_META,
  type DnaSplit,
  type DnaSplitKey,
} from "@/lib/fight-stats";

export interface HelixRung {
  questionId: string;
  categoryId: string;
  index: number;
  answered: boolean;
}

export interface HelixSegment {
  categoryId: string;
  label: string;
  hint: string;
  colorToken: string;
  start: number;
  end: number;
  answered: number;
  total: number;
}

const SEGMENT_COLOR_TOKENS = [
  "--cat-1",
  "--cat-2",
  "--cat-3",
  "--cat-4",
  "--cat-5",
  "--cat-mixed",
  "--cat-3",
  "--cat-2",
  "--cat-neutral",
] as const;

export interface HelixBand {
  key: DnaSplitKey;
  label: string;
  colorToken: string;
  share: number;
}

export interface HelixModel {
  rungs: HelixRung[];
  segments: HelixSegment[];
  bands: HelixBand[] | null;
  completeness: number;
  depth: number;
}

function tokenName(value: string): string {
  const match = value.match(/^var\((--[^)]+)\)$/);
  return match?.[1] ?? value;
}

export function buildHelixModel(input: {
  dna: GegnerDnaAnswers;
  dnaSplit: DnaSplit | null;
  dnaSplitWeight?: number;
}): HelixModel {
  const rungs: HelixRung[] = [];
  const segments: HelixSegment[] = [];
  let cursor = 0;

  DNA_CATEGORIES.forEach((category, categoryIndex) => {
    const start = cursor;
    let answered = 0;

    for (const question of category.questions) {
      const complete = isAnswered(input.dna[question.id]);
      if (complete) answered += 1;
      rungs.push({
        questionId: question.id,
        categoryId: category.id,
        index: cursor,
        answered: complete,
      });
      cursor += 1;
    }

    segments.push({
      categoryId: category.id,
      label: category.label,
      hint: category.hint,
      colorToken: SEGMENT_COLOR_TOKENS[categoryIndex] ?? "--cat-neutral",
      start,
      end: cursor,
      answered,
      total: category.questions.length,
    });
  });

  const splitTotal = input.dnaSplit
    ? DNA_SPLIT_KEYS.reduce((sum, key) => sum + Math.max(0, input.dnaSplit?.[key] ?? 0), 0)
    : 0;
  const bands = input.dnaSplit && splitTotal > 0
    ? DNA_SPLIT_KEYS.map((key) => ({
        key,
        label: DNA_SPLIT_META[key].label,
        colorToken: tokenName(DNA_SPLIT_META[key].color),
        share: Math.max(0, input.dnaSplit?.[key] ?? 0) / splitTotal,
      }))
    : null;
  const weight = Number.isFinite(input.dnaSplitWeight) ? Math.max(0, input.dnaSplitWeight ?? 0) : 0;

  return {
    rungs,
    segments,
    bands,
    completeness: dnaCompleteness(input.dna),
    depth: weight / (weight + 4),
  };
}

export function diffHelixModels(
  prev: HelixModel,
  next: HelixModel,
): { grown: string[] } {
  const previous = new Map(prev.rungs.map((rung) => [rung.questionId, rung.answered]));
  return {
    grown: next.rungs
      .filter((rung) => rung.answered && previous.get(rung.questionId) === false)
      .map((rung) => rung.questionId),
  };
}
