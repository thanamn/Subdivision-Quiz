import type { SubdivisionFeature } from "../domain/types";
import { normalizeGuess } from "./normalization";

export function buildNameIndex(features: SubdivisionFeature[]) {
  const index = new Map<string, SubdivisionFeature[]>();

  for (const feature of features) {
    for (const alias of feature.properties.aliases) {
      if (isPostalOrCodeAlias(feature, alias)) {
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

function compactNormalizedCode(value?: string) {
  return normalizeGuess(value || "").replace(/\s+/g, "");
}

function codeTail(value?: string) {
  const parts = value?.split("-");
  return parts && parts.length > 1 ? parts[parts.length - 1] : undefined;
}

function isPostalOrCodeAlias(feature: SubdivisionFeature, alias: string) {
  const compact = compactNormalizedCode(alias);
  const primary = compactNormalizedCode(feature.properties.name);

  if (!compact || compact === primary) {
    return false;
  }

  const codeAliases = [
    feature.properties.postal,
    feature.properties.code,
    codeTail(feature.properties.code),
    feature.properties.countryCode,
    feature.properties.countryIso2,
  ]
    .map(compactNormalizedCode)
    .filter(Boolean);

  if (codeAliases.includes(compact)) {
    return true;
  }

  return isUsStateAbbreviationAlias(feature, alias);
}

function isUsStateAbbreviationAlias(feature: SubdivisionFeature, alias: string) {
  if (feature.properties.countryCode !== "USA") {
    return false;
  }

  const trimmed = alias.trim();
  const compact = compactNormalizedCode(trimmed);
  const postal = compactNormalizedCode(feature.properties.postal);
  const primary = compactNormalizedCode(feature.properties.name);

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
