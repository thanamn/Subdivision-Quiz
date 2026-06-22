import { LocalNameLine, NativeNameLine } from "./FeatureNameLines";
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
      {features.map((feature) => (
        <button
          key={feature.properties.id}
          type="button"
          onMouseEnter={() => setActiveId(feature.properties.id)}
          onFocus={() => setActiveId(feature.properties.id)}
        >
          <strong>{feature.properties.name}</strong>
          <LocalNameLine feature={feature} />
          <NativeNameLine feature={feature} />
          <span>{feature.properties.country}</span>
        </button>
      ))}
    </>
  );
}
