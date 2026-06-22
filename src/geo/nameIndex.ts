import type { SubdivisionFeature } from "../domain/types";
import { normalizeGuess } from "./normalization";

export function buildNameIndex(features: SubdivisionFeature[]) {
  const index = new Map<string, SubdivisionFeature[]>();

  for (const feature of features) {
    for (const alias of feature.properties.aliases) {
      if (isUsStateAbbreviationAlias(feature, alias)) {
        continue;
      }

      const normalized = normalizeGuess(alias);
      if (!normalized) {
        continue;
      }

      const matches = index.get(normalized) || [];
      matches.push(feature);
      index.set(normalized, matches);
    }
  }

  return index;
}

function isUsStateAbbreviationAlias(feature: SubdivisionFeature, alias: string) {
  if (feature.properties.countryCode !== "USA") {
    return false;
  }

  const trimmed = alias.trim();
  const normalized = normalizeGuess(trimmed);
  const compact = normalized.replace(/\s+/g, "");
  const postal = normalizeGuess(feature.properties.postal || "").replace(/\s+/g, "");
  const primary = normalizeGuess(feature.properties.name).replace(/\s+/g, "");

  if (!compact || compact === primary) {
    return false;
  }

  if (postal && compact === postal) {
    return true;
  }

  if (/^[A-Z]{2}$/.test(trimmed)) {
    return true;
  }

  return (
    trimmed.split(/\s+/).length === 1 &&
    trimmed.endsWith(".") &&
    compact.length < primary.length
  );
}
