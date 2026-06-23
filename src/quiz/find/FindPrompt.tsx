import { MousePointer2 } from "lucide-react";
import { SubdivisionMediaPreview } from "../../components/SubdivisionMediaPreview";
import type { SubdivisionMedia } from "../../domain/types";

export function FindPrompt({
  currentTargetMedia,
  findPromptDetail,
  findPromptTitle,
}: {
  currentTargetMedia: SubdivisionMedia | undefined;
  findPromptDetail: string;
  findPromptTitle: string;
}) {
  return (
    <div className="find-prompt" aria-live="polite">
      {currentTargetMedia ? (
        <SubdivisionMediaPreview media={currentTargetMedia} />
      ) : (
        <MousePointer2 size={20} aria-hidden="true" />
      )}
      <div>
        <span className="prompt-label">Click this subdivision</span>
        <strong>{findPromptTitle}</strong>
        <span>{findPromptDetail}</span>
      </div>
    </div>
  );
}
