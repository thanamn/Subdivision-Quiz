import { Timer } from "lucide-react";
import type { QuizMode } from "../quiz/quizTypes";
import type { SubdivisionFeature, SubdivisionMediaLookup } from "../domain/types";
import { CompletedList } from "./CompletedList";
import { RecentList } from "./RecentList";
import { WrongClickList } from "./WrongClickList";

export function SidePanel({
  complete,
  completedReviewCount,
  completedReviewPreviewFeatures,
  gaveUp,
  mediaLookup,
  missingCount,
  missingPreviewFeatures,
  quizMode,
  recent,
  setActiveId,
  wrongClickFeatures,
}: {
  complete: boolean;
  completedReviewCount: number;
  completedReviewPreviewFeatures: SubdivisionFeature[];
  gaveUp: boolean;
  mediaLookup: SubdivisionMediaLookup;
  missingCount: number;
  missingPreviewFeatures: SubdivisionFeature[];
  quizMode: QuizMode;
  recent: SubdivisionFeature[];
  setActiveId: (id: string | null) => void;
  wrongClickFeatures: SubdivisionFeature[];
}) {
  return (
    <aside className="side-panel">
      {quizMode === "find" && wrongClickFeatures.length ? (
        <section className="answer-section">
          <WrongClickList
            setActiveId={setActiveId}
            wrongClickFeatures={wrongClickFeatures}
          />
        </section>
      ) : null}

      <RecentList
        mediaLookup={mediaLookup}
        recent={recent}
        setActiveId={setActiveId}
      />

      <CompletedList
        complete={complete}
        completedReviewCount={completedReviewCount}
        completedReviewPreviewFeatures={completedReviewPreviewFeatures}
        gaveUp={gaveUp}
        mediaLookup={mediaLookup}
        missingCount={missingCount}
        missingPreviewFeatures={missingPreviewFeatures}
        quizMode={quizMode}
        setActiveId={setActiveId}
      />

      <div className="data-credit">
        <Timer size={15} aria-hidden="true" />
        <span>
          Map data:{" "}
          <a
            href="https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/"
            target="_blank"
            rel="noreferrer"
          >
            Natural Earth ADM1
          </a>
        </span>
      </div>
    </aside>
  );
}
