import { AnswerListItems } from "./AnswerListItems";
import type { SubdivisionFeature } from "../domain/types";

export function WrongClickList({
  setActiveId,
  wrongClickFeatures,
}: {
  setActiveId: (id: string | null) => void;
  wrongClickFeatures: SubdivisionFeature[];
}) {
  return (
    <div className="find-tried-list">
      <strong>Tried clicks</strong>
      {wrongClickFeatures.length ? (
        <div className="answer-list compact">
          <AnswerListItems features={wrongClickFeatures} setActiveId={setActiveId} />
        </div>
      ) : (
        <p>No wrong clicks for this target.</p>
      )}
    </div>
  );
}
