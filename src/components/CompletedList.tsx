import { Eye } from "lucide-react";
import { AnswerListItems } from "./AnswerListItems";
import type { QuizMode } from "../quiz/quizTypes";
import type { SubdivisionFeature, SubdivisionMediaLookup } from "../domain/types";

export function CompletedList({
  complete,
  completedReviewCount,
  completedReviewPreviewFeatures,
  gaveUp,
  mediaLookup,
  missingCount,
  missingPreviewFeatures,
  quizMode,
  setActiveId,
}: {
  complete: boolean;
  completedReviewCount: number;
  completedReviewPreviewFeatures: SubdivisionFeature[];
  gaveUp: boolean;
  mediaLookup: SubdivisionMediaLookup;
  missingCount: number;
  missingPreviewFeatures: SubdivisionFeature[];
  quizMode: QuizMode;
  setActiveId: (id: string | null) => void;
}) {
  const showingMissing = gaveUp || (quizMode === "type" && complete);
  const features = showingMissing
    ? missingPreviewFeatures
    : completedReviewPreviewFeatures;
  const totalCount = showingMissing ? missingCount : completedReviewCount;
  const emptyCopy =
    quizMode === "find"
      ? "Completed territories appear here."
      : "Found answers appear here.";

  return (
    <section className="answer-section">
      <div className="section-title">
        <Eye size={18} aria-hidden="true" />
        <h3>
          {showingMissing
            ? "Missing"
            : quizMode === "find"
              ? "Completed"
              : "Found"}
        </h3>
      </div>
      <div className="answer-list">
        {features.length ? (
          <AnswerListItems
            features={features}
            mediaLookup={mediaLookup}
            setActiveId={setActiveId}
          />
        ) : (
          <p>{emptyCopy}</p>
        )}
        {totalCount > features.length ? (
          <p className="answer-list-note">
            Showing first {features.length.toLocaleString()} of{" "}
            {totalCount.toLocaleString()}.
          </p>
        ) : null}
        {showingMissing && totalCount > features.length ? (
          <p className="answer-list-note">
            Pick a region or country to review a shorter missing list.
          </p>
        ) : null}
      </div>
    </section>
  );
}
