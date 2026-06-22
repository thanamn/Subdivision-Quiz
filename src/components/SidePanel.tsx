import { Timer } from "lucide-react";
import type { QuizMode } from "../quiz/quizTypes";
import type { SubdivisionFeature, SubdivisionMedia } from "../domain/types";
import { CompletedList } from "./CompletedList";
import { CurrentTargetCard } from "./CurrentTargetCard";
import { RecentList } from "./RecentList";

export function SidePanel({
  complete,
  completedReviewFeatures,
  currentTargetMedia,
  findPromptDetail,
  findPromptTitle,
  gaveUp,
  missingFeatures,
  quizMode,
  recent,
  setActiveId,
  wrongClickFeatures,
}: {
  complete: boolean;
  completedReviewFeatures: SubdivisionFeature[];
  currentTargetMedia: SubdivisionMedia | undefined;
  findPromptDetail: string;
  findPromptTitle: string;
  gaveUp: boolean;
  missingFeatures: SubdivisionFeature[];
  quizMode: QuizMode;
  recent: SubdivisionFeature[];
  setActiveId: (id: string | null) => void;
  wrongClickFeatures: SubdivisionFeature[];
}) {
  return (
    <aside className="side-panel">
      {quizMode === "find" ? (
        <CurrentTargetCard
          currentTargetMedia={currentTargetMedia}
          findPromptDetail={findPromptDetail}
          findPromptTitle={findPromptTitle}
          setActiveId={setActiveId}
          wrongClickFeatures={wrongClickFeatures}
        />
      ) : null}

      <RecentList recent={recent} setActiveId={setActiveId} />

      <CompletedList
        complete={complete}
        completedReviewFeatures={completedReviewFeatures}
        gaveUp={gaveUp}
        missingFeatures={missingFeatures}
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
