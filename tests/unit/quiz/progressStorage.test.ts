// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  loadProgress,
  progressStorageKey,
  saveProgress,
} from "../../../src/quiz/progressStorage";

describe("progressStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps Type mode progress as the legacy string array", () => {
    const progressKey = progressStorageKey("country:MEX", "type");
    const guessed = new Set(["MEX-2727"]);

    saveProgress({
      findStats: { hints: 0, reveals: 0, skips: 0, wrong: 0 },
      guessed,
      progressKey,
      quizMode: "type",
      revealedIds: new Set(),
    });

    expect(window.localStorage.getItem(progressKey)).toBe(
      JSON.stringify(["MEX-2727"]),
    );
    const loaded = loadProgress(progressKey, "type");
    expect(loaded.hasStarted).toBe(true);
    expect([...loaded.guessed]).toEqual(["MEX-2727"]);
    expect([...loaded.revealedIds]).toEqual([]);
  });

  it("keeps Find mode progress in the correct/revealed/stats object shape", () => {
    const progressKey = progressStorageKey("country:JPN", "find");

    saveProgress({
      findStats: { hints: 2, reveals: 1, skips: 3, wrong: 4 },
      guessed: new Set(["JPN-1845"]),
      progressKey,
      quizMode: "find",
      revealedIds: new Set(["JPN-1846"]),
    });

    expect(JSON.parse(window.localStorage.getItem(progressKey) || "{}")).toEqual({
      correct: ["JPN-1845"],
      revealed: ["JPN-1846"],
      stats: { hints: 2, reveals: 1, skips: 3, wrong: 4 },
    });
    const loaded = loadProgress(progressKey, "find");
    expect(loaded.hasStarted).toBe(true);
    expect([...loaded.guessed]).toEqual(["JPN-1845"]);
    expect([...loaded.revealedIds]).toEqual(["JPN-1846"]);
    expect(loaded.findStats).toEqual({ hints: 2, reveals: 1, skips: 3, wrong: 4 });
  });
});
