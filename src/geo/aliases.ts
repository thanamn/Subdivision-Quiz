import { normalizeGuess } from "./normalization";

const ENGLISH_TYPE_WORDS = new Set([
  "administrative",
  "area",
  "autonomous",
  "canton",
  "city",
  "county",
  "department",
  "district",
  "federal",
  "governorate",
  "municipality",
  "of",
  "prefecture",
  "province",
  "region",
  "republic",
  "special",
  "state",
  "territory",
]);

export function splitAliases(value?: string) {
  if (!value) {
    return [];
  }

  return value
    .split(/[|;]/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function compactAliases(values: Array<string | undefined>) {
  const aliases = new Map<string, string>();

  for (const value of values) {
    for (const candidate of splitAliases(value)) {
      const normalized = normalizeGuess(candidate);
      if (normalized && !aliases.has(normalized)) {
        aliases.set(normalized, candidate);
      }
    }
  }

  return [...aliases.values()];
}

export function removeEnglishTypeWords(value: string) {
  return normalizeGuess(value)
    .split(" ")
    .filter((word) => !ENGLISH_TYPE_WORDS.has(word))
    .join(" ");
}
