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
  if (prefersCanonicalPromptName(feature)) {
    return feature.properties.name;
  }

  const local = localNameText(feature);
  const native = nativeNameText(feature);
  const secondary = [local, native].find(
    (name) => name && normalizeGuess(name) !== normalizeGuess(feature.properties.name),
  );

  return secondary ? `${secondary} / ${feature.properties.name}` : feature.properties.name;
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
  const primary = prefersCanonicalName
    ? feature.properties.name
    : native || local || feature.properties.name;
  const secondary = [
    prefersCanonicalName ? undefined : feature.properties.name,
    local,
    native,
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
