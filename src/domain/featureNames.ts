import { normalizeGuess } from "../geo/normalization";
import type { SubdivisionFeature } from "./types";

export function localNameText(feature: SubdivisionFeature) {
  return feature.properties.localNames.join(" / ");
}

export function nativeNameText(feature: SubdivisionFeature) {
  return feature.properties.nativeNames
    .filter((nativeName) => nativeName.display !== false)
    .map((nativeName) => nativeName.name)
    .join(" / ");
}

function prefersCanonicalPromptName(feature: SubdivisionFeature) {
  return ["CAN", "VNM"].includes(feature.properties.countryCode);
}

export function featureShortName(feature: SubdivisionFeature) {
  return feature.properties.name;
}

export function compactSecondaryName(feature: SubdivisionFeature) {
  const primaryNormalized = normalizeGuess(feature.properties.name);
  const candidates = [
    ...feature.properties.localNames,
    ...feature.properties.nativeNames
      .filter((nativeName) => nativeName.display !== false)
      .map((nativeName) => nativeName.name),
  ];

  return candidates.find(
    (name) => name && normalizeGuess(name) !== primaryNormalized,
  );
}

export function promptNames(feature: SubdivisionFeature | undefined) {
  if (!feature) {
    return {
      primary: "Loading...",
      secondary: "Choose a subdivision on the map.",
    };
  }

  const local = feature.properties.localNames[0];
  const displayNativeNames = feature.properties.nativeNames.filter(
    (nativeName) => nativeName.display !== false,
  );
  const native = displayNativeNames[0]?.name;
  const prefersCanonicalName = prefersCanonicalPromptName(feature);
  const primary = feature.properties.name;
  const secondary = [
    prefersCanonicalName ? local : local || native,
    prefersCanonicalName ? native : native && native !== local ? native : undefined,
    ...feature.properties.localNames.slice(1),
    ...displayNativeNames.slice(1).map((nativeName) => nativeName.name),
  ]
    .filter((name): name is string => Boolean(name))
    .filter((name, index, names) => {
      const normalized = normalizeGuess(name);
      return (
        normalized !== normalizeGuess(primary) &&
        names.findIndex((item) => normalizeGuess(item) === normalized) === index
      );
    })
    .slice(0, 3)
    .join(" / ");

  return {
    primary,
    secondary: secondary || `${feature.properties.typeEn} in ${feature.properties.country}`,
  };
}
