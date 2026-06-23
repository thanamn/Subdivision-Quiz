import { compactSecondaryName } from "../domain/featureNames";
import type { SubdivisionFeature } from "../domain/types";

export function AnswerListItems({
  features,
  setActiveId,
}: {
  features: SubdivisionFeature[];
  setActiveId: (id: string | null) => void;
}) {
  return (
    <>
      {features.map((feature) => {
        const secondaryName = compactSecondaryName(feature);

        return (
          <button
            key={feature.properties.id}
            type="button"
            onMouseEnter={() => setActiveId(feature.properties.id)}
            onFocus={() => setActiveId(feature.properties.id)}
          >
            <strong>{feature.properties.name}</strong>
            {secondaryName ? (
              <span className="secondary-name">{secondaryName}</span>
            ) : null}
            <span className="country-name">{feature.properties.country}</span>
          </button>
        );
      })}
    </>
  );
}
