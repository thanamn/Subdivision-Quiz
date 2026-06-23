import { Flag, RotateCcw } from "lucide-react";
import type { MatchMode } from "../quizTypes";

export function TypeMatchModeSwitch({
  matchMode,
  setMatchMode,
}: {
  matchMode: MatchMode;
  setMatchMode: (matchMode: MatchMode) => void;
}) {
  return (
    <div className="mode-row" role="group" aria-label="Duplicate answer mode">
      <button
        type="button"
        className={matchMode === "single" ? "is-active" : ""}
        onClick={() => setMatchMode("single")}
      >
        One
      </button>
      <button
        type="button"
        className={matchMode === "all" ? "is-active" : ""}
        onClick={() => setMatchMode("all")}
      >
        All matches
      </button>
    </div>
  );
}

export function TypeActions({
  complete,
  gaveUp,
  giveUpQuiz,
  guessedCount,
  restartQuiz,
}: {
  complete: boolean;
  gaveUp: boolean;
  giveUpQuiz: () => void;
  guessedCount: number;
  restartQuiz: () => void;
}) {
  return (
    <div className="panel-actions">
      <button
        type="button"
        className="danger-action"
        onClick={giveUpQuiz}
        disabled={gaveUp || complete}
      >
        <Flag size={17} aria-hidden="true" />
        End quiz
      </button>
      <button
        type="button"
        className="reset-action"
        onClick={restartQuiz}
        disabled={!guessedCount && !gaveUp}
      >
        <RotateCcw size={17} aria-hidden="true" />
        Reset
      </button>
    </div>
  );
}
