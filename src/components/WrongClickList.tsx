import { AnswerListItems } from "./AnswerListItems";
import type { SubdivisionFeature } from "../domain/types";

export function WrongClickList({
  setActiveId,
  wrongClickFeatures,
}: {
  setActiveId: (id: string | null) => void;
  wrongClickFeatures: SubdivisionFeature[];
}) {
  if (!wrongClickFeatures.length) {
    return null;
  }

  return (
    <div className="find-tried-list">
      <strong>Wrong clicks</strong>
      <div className="answer-list compact">
        <AnswerListItems features={wrongClickFeatures} setActiveId={setActiveId} />
      </div>
    </div>
  );
}
