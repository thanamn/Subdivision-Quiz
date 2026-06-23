import { ListChecks } from "lucide-react";
import { AnswerListItems } from "./AnswerListItems";
import type { SubdivisionFeature, SubdivisionMediaLookup } from "../domain/types";

export function RecentList({
  mediaLookup,
  recent,
  setActiveId,
}: {
  mediaLookup: SubdivisionMediaLookup;
  recent: SubdivisionFeature[];
  setActiveId: (id: string | null) => void;
}) {
  return (
    <section className="answer-section">
      <div className="section-title">
        <ListChecks size={18} aria-hidden="true" />
        <h3>Recent</h3>
      </div>
      <div className="answer-list compact">
        {recent.length ? (
          <AnswerListItems
            features={recent}
            mediaLookup={mediaLookup}
            setActiveId={setActiveId}
          />
        ) : (
          <p>No answers yet.</p>
        )}
      </div>
    </section>
  );
}
