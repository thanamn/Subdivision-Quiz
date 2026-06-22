import { MousePointer2 } from "lucide-react";
import { SubdivisionMediaPreview } from "./SubdivisionMediaPreview";
import { WrongClickList } from "./WrongClickList";
import type { SubdivisionFeature, SubdivisionMedia } from "../domain/types";

export function CurrentTargetCard({
  currentTargetMedia,
  findPromptDetail,
  findPromptTitle,
  setActiveId,
  wrongClickFeatures,
}: {
  currentTargetMedia: SubdivisionMedia | undefined;
  findPromptDetail: string;
  findPromptTitle: string;
  setActiveId: (id: string | null) => void;
  wrongClickFeatures: SubdivisionFeature[];
}) {
  return (
    <section className="answer-section find-side-card">
      <div className="section-title">
        <MousePointer2 size={18} aria-hidden="true" />
        <h3>Current Target</h3>
      </div>
      <div className="find-target-card">
        <SubdivisionMediaPreview media={currentTargetMedia} size="large" />
        <span className="prompt-label">Find</span>
        <strong>{findPromptTitle}</strong>
        <span>{findPromptDetail}</span>
      </div>
      <WrongClickList
        setActiveId={setActiveId}
        wrongClickFeatures={wrongClickFeatures}
      />
    </section>
  );
}
