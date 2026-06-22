import { Eye } from "lucide-react";
import { AnswerListItems } from "./AnswerListItems";
import type { QuizMode } from "../quiz/quizTypes";
import type { SubdivisionFeature } from "../domain/types";

export function CompletedList({
  complete,
  completedReviewFeatures,
  gaveUp,
  missingFeatures,
  quizMode,
  setActiveId,
}: {
  complete: boolean;
  completedReviewFeatures: SubdivisionFeature[];
  gaveUp: boolean;
  missingFeatures: SubdivisionFeature[];
  quizMode: QuizMode;
  setActiveId: (id: string | null) => void;
}) {
  return (
    <section className="answer-section">
      <div className="section-title">
        <Eye size={18} aria-hidden="true" />
        <h3>
          {gaveUp
            ? "Missing"
            : quizMode === "find"
              ? "Completed"
              : complete
                ? "Missing"
                : "Found"}
        </h3>
      </div>
      <div className="answer-list">
        {gaveUp || (quizMode === "type" && complete) ? (
          <AnswerListItems
            features={missingFeatures.slice(0, 120)}
            setActiveId={setActiveId}
          />
        ) : completedReviewFeatures.length ? (
          <AnswerListItems
            features={completedReviewFeatures.slice(0, 120)}
            setActiveId={setActiveId}
          />
        ) : (
          <p>{quizMode === "find" ? "Completed territories appear here." : "Found answers appear here."}</p>
        )}
      </div>
    </section>
  );
}
