import { cloneFindStats, EMPTY_FIND_STATS } from "./quizTypes";
import type { FindStats, QuizMode } from "./quizTypes";

export function progressStorageKey(key: string, mode: QuizMode) {
  return mode === "type"
    ? `subdivision-quiz:progress:${key}`
    : `subdivision-quiz:find-progress:${key}`;
}

export type LoadedProgress = {
  findStats: FindStats;
  guessed: Set<string>;
  hasStarted: boolean;
  revealedIds: Set<string>;
};

export function loadProgress(progressKey: string, quizMode: QuizMode): LoadedProgress {
  const raw = window.localStorage.getItem(progressKey);
  const saved = raw ? JSON.parse(raw) : quizMode === "type" ? [] : {};

  if (quizMode === "type") {
    const typedProgress = Array.isArray(saved) ? (saved as string[]) : [];
    return {
      findStats: EMPTY_FIND_STATS,
      guessed: new Set(typedProgress),
      hasStarted: typedProgress.length > 0,
      revealedIds: new Set(),
    };
  }

  const findProgress = saved as {
    correct?: string[];
    revealed?: string[];
    stats?: Partial<FindStats>;
  };
  const correct = Array.isArray(findProgress.correct) ? findProgress.correct : [];
  const revealed = Array.isArray(findProgress.revealed) ? findProgress.revealed : [];
  const stats = cloneFindStats(findProgress.stats);

  return {
    findStats: stats,
    guessed: new Set(correct),
    hasStarted: Boolean(
      correct.length ||
        revealed.length ||
        stats.wrong ||
        stats.hints ||
        stats.reveals ||
        stats.skips,
    ),
    revealedIds: new Set(revealed),
  };
}

export function saveProgress({
  findStats,
  guessed,
  progressKey,
  quizMode,
  revealedIds,
}: {
  findStats: FindStats;
  guessed: Set<string>;
  progressKey: string;
  quizMode: QuizMode;
  revealedIds: Set<string>;
}) {
  const payload =
    quizMode === "type"
      ? [...guessed]
      : {
          correct: [...guessed],
          revealed: [...revealedIds],
          stats: findStats,
        };

  window.localStorage.setItem(progressKey, JSON.stringify(payload));
}
