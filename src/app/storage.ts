import type { Scope } from "../domain/types";
import type { QuizMode } from "../quiz/quizTypes";

export const LAST_SCOPE_KEY = "subdivision-quiz:last-scope";
export const MATCH_MODE_KEY = "subdivision-quiz:match-mode";
export const QUIZ_MODE_KEY = "subdivision-quiz:quiz-mode";
export const HELP_CARD_KEY = "subdivision-quiz:help-dismissed:v3";

export function initialScope(): Scope {
  if (typeof window === "undefined") {
    return { kind: "world", value: "world" };
  }

  const params = new URLSearchParams(window.location.search);
  const country = params.get("country");
  const region = params.get("region");

  if (country) {
    return { kind: "country", value: country.toUpperCase() };
  }

  if (region) {
    return { kind: "region", value: region };
  }

  try {
    const saved = window.localStorage.getItem(LAST_SCOPE_KEY);
    if (saved) {
      return JSON.parse(saved) as Scope;
    }
  } catch {
    return { kind: "world", value: "world" };
  }

  return { kind: "world", value: "world" };
}

export function initialQuizMode(): QuizMode {
  if (typeof window === "undefined") {
    return "type";
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("mode") === "find") {
    return "find";
  }

  return window.localStorage.getItem(QUIZ_MODE_KEY) === "find" ? "find" : "type";
}

export function urlForScopeAndMode(scope: Scope, mode: QuizMode) {
  const params = new URLSearchParams();

  if (scope.kind === "country") {
    params.set("country", scope.value);
  } else if (scope.kind === "region") {
    params.set("region", scope.value);
  }

  params.set("mode", mode);

  return `${window.location.pathname}?${params.toString()}${window.location.hash}`;
}

export function progressStorageKey(key: string, mode: QuizMode) {
  return mode === "type"
    ? `subdivision-quiz:progress:${key}`
    : `subdivision-quiz:find-progress:${key}`;
}

export function initialHelpCardOpen() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(HELP_CARD_KEY) !== "1";
}
