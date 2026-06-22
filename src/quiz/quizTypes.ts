export type QuizMode = "type" | "find";
export type MatchMode = "single" | "all";

export type FindStats = {
  hints: number;
  reveals: number;
  skips: number;
  wrong: number;
};

export const EMPTY_FIND_STATS: FindStats = {
  hints: 0,
  reveals: 0,
  skips: 0,
  wrong: 0,
};

export const MAX_FIND_HINTS = 3;

export function cloneFindStats(stats?: Partial<FindStats>) {
  return {
    ...EMPTY_FIND_STATS,
    ...stats,
  };
}
