import { Eye, Flag, Lightbulb, RotateCcw, SkipForward } from "lucide-react";
import { MAX_FIND_HINTS, type FindStats } from "../quizTypes";
import type { SubdivisionFeature } from "../../domain/types";

export function FindActions({
  complete,
  completedCount,
  currentTarget,
  findStats,
  gaveUp,
  giveUpQuiz,
  hintLevel,
  requestHint,
  restartQuiz,
  revealFindTarget,
  skipFindTarget,
}: {
  complete: boolean;
  completedCount: number;
  currentTarget: SubdivisionFeature | undefined;
  findStats: FindStats;
  gaveUp: boolean;
  giveUpQuiz: () => void;
  hintLevel: number;
  requestHint: () => void;
  restartQuiz: () => void;
  revealFindTarget: () => void;
  skipFindTarget: () => void;
}) {
  return (
    <div className="panel-actions find-actions">
      <div className="quiz-action-group">
        <button
          type="button"
          className="hint-action"
          onClick={requestHint}
          disabled={!currentTarget || gaveUp || complete || hintLevel >= MAX_FIND_HINTS}
        >
          <Lightbulb size={17} aria-hidden="true" />
          Hint
        </button>
        <button
          type="button"
          className="skip-action"
          onClick={skipFindTarget}
          disabled={!currentTarget || gaveUp || complete}
        >
          <SkipForward size={17} aria-hidden="true" />
          Skip
        </button>
        <button
          type="button"
          className="reveal-action"
          onClick={revealFindTarget}
          disabled={!currentTarget || gaveUp || complete}
        >
          <Eye size={17} aria-hidden="true" />
          Show answer
        </button>
      </div>
      <div className="session-action-group">
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
          disabled={
            !gaveUp &&
            !completedCount &&
            !findStats.wrong &&
            !findStats.hints &&
            !findStats.reveals &&
            !findStats.skips
          }
        >
          <RotateCcw size={17} aria-hidden="true" />
          Reset
        </button>
      </div>
    </div>
  );
}
