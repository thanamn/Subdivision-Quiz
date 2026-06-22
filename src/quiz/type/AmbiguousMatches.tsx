import { LocalNameLine, NativeNameLine } from "../../components/FeatureNameLines";
import type { SubdivisionFeature } from "../../domain/types";

export function AmbiguousMatches({
  addGuesses,
  ambiguous,
  setActiveId,
}: {
  addGuesses: (matches: SubdivisionFeature[], message?: string) => void;
  ambiguous: SubdivisionFeature[];
  setActiveId: (id: string | null) => void;
}) {
  if (!ambiguous.length) {
    return null;
  }

  return (
    <div className="resolver map-resolver">
      <div className="resolver-heading">
        <strong>{ambiguous[0].properties.name}</strong>
        <button type="button" onClick={() => addGuesses(ambiguous)}>
          Add all
        </button>
      </div>
      <div className="resolver-list">
        {ambiguous.slice(0, 18).map((feature) => (
          <button
            key={feature.properties.id}
            type="button"
            onClick={() => addGuesses([feature], `Added ${feature.properties.name}.`)}
            onMouseEnter={() => setActiveId(feature.properties.id)}
          >
            <span>{feature.properties.country}</span>
            <LocalNameLine feature={feature} />
            <NativeNameLine feature={feature} />
            <small>{feature.properties.typeEn}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
