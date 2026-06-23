import { Keyboard, MousePointer2 } from "lucide-react";
import type { QuizMode } from "../quiz/quizTypes";

export function QuizModeSwitch({
  quizMode,
  setQuizMode,
}: {
  quizMode: QuizMode;
  setQuizMode: (mode: QuizMode) => void;
}) {
  return (
    <div className="quiz-mode-switch" role="group" aria-label="Quiz mode">
      <span className="control-group-label">Mode</span>
      <button
        type="button"
        className={quizMode === "type" ? "is-active" : ""}
        onClick={() => setQuizMode("type")}
      >
        <Keyboard size={17} aria-hidden="true" />
        Type
      </button>
      <button
        type="button"
        className={quizMode === "find" ? "is-active" : ""}
        onClick={() => setQuizMode("find")}
      >
        <MousePointer2 size={17} aria-hidden="true" />
        Click
      </button>
    </div>
  );
}
