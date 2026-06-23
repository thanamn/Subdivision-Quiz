import { compactSecondaryName } from "../domain/featureNames";
import { mediaForFeature } from "../domain/subdivisionMedia";
import type { SubdivisionFeature, SubdivisionMediaLookup } from "../domain/types";
import { SubdivisionMediaThumbnail } from "./SubdivisionMediaPreview";

export function AnswerListItems({
  features,
  mediaLookup,
  setActiveId,
}: {
  features: SubdivisionFeature[];
  mediaLookup?: SubdivisionMediaLookup;
  setActiveId: (id: string | null) => void;
}) {
  return (
    <>
      {features.map((feature) => {
        const secondaryName = compactSecondaryName(feature);
        const media = mediaLookup
          ? mediaForFeature(feature, mediaLookup)
          : undefined;

        return (
          <button
            key={feature.properties.id}
            type="button"
            className={media ? "has-media" : undefined}
            onMouseEnter={() => setActiveId(feature.properties.id)}
            onFocus={() => setActiveId(feature.properties.id)}
          >
            <SubdivisionMediaThumbnail
              media={media}
              name={feature.properties.name}
            />
            <span className="answer-list-copy">
              <strong>{feature.properties.name}</strong>
              {secondaryName ? (
                <span className="secondary-name">{secondaryName}</span>
              ) : null}
              <span className="country-name">{feature.properties.country}</span>
            </span>
          </button>
        );
      })}
    </>
  );
}
