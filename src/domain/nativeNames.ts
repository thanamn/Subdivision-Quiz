import { normalizeGuess } from "../geo/normalization";
import type { CountryRegionLookup } from "../geo/topologyTypes";
import type { NativeName, SubdivisionFeature } from "./types";

const WIKIDATA_ENDPOINT = "https://www.wikidata.org/w/api.php";
const WIKIDATA_BATCH_SIZE = 35;
const NATIVE_NAME_CANDIDATE_LIMIT = 8;

export const NATIVE_LABEL_FEATURE_LIMIT = 650;

export function mergeNativeNames(
  feature: SubdivisionFeature,
  nativeNames: NativeName[],
): SubdivisionFeature {
  if (!nativeNames.length) {
    return feature;
  }

  const displayNativeNames = nativeNames.filter((nativeName) => nativeName.display !== false);
  const sourceLocalAliases = new Set(
    feature.properties.nativeNames.map((nativeName) => normalizeGuess(nativeName.name)),
  );
  const aliases = displayNativeNames.length
    ? feature.properties.aliases.filter(
        (alias) => !sourceLocalAliases.has(normalizeGuess(alias)),
      )
    : [...feature.properties.aliases];
  const seenAliases = new Set(aliases.map(normalizeGuess));
  const currentNativeNames = new Map<string, NativeName>();

  if (!displayNativeNames.length) {
    for (const nativeName of feature.properties.nativeNames) {
      const normalized = normalizeGuess(nativeName.name);
      if (normalized) {
        currentNativeNames.set(normalized, nativeName);
      }
    }
  }

  for (const nativeName of nativeNames) {
    const normalized = normalizeGuess(nativeName.name);
    if (!normalized) {
      continue;
    }

    if (!seenAliases.has(normalized)) {
      aliases.push(nativeName.name);
      seenAliases.add(normalized);
    }

    if (nativeName.display !== false && normalized !== normalizeGuess(feature.properties.name)) {
      currentNativeNames.set(normalized, nativeName);
    }
  }

  return {
    ...feature,
    properties: {
      ...feature.properties,
      aliases,
      nativeNames: [...currentNativeNames.values()].slice(0, 3),
    },
  };
}

export async function fetchNativeNamesForFeatures(
  features: SubdivisionFeature[],
  countryRegions: CountryRegionLookup,
) {
  const groups = new Map<string, { languages: string[]; qids: string[] }>();
  const qidToFeature = new Map<string, SubdivisionFeature>();

  for (const feature of features) {
    const qid = feature.properties.wikidataId;
    const languages = countryRegions[feature.properties.countryCode]?.languageCodes || [];

    if (!qid || !languages.length || feature.properties.nativeNames.length) {
      continue;
    }

    qidToFeature.set(qid, feature);
    const key = languages.join("|");
    const group = groups.get(key) || { languages, qids: [] };
    group.qids.push(qid);
    groups.set(key, group);
  }

  const labels: Record<string, NativeName[]> = {};

  for (const group of groups.values()) {
    const qids = [...new Set(group.qids)];
    for (let start = 0; start < qids.length; start += WIKIDATA_BATCH_SIZE) {
      const chunk = qids.slice(start, start + WIKIDATA_BATCH_SIZE);
      const params = new URLSearchParams({
        action: "wbgetentities",
        format: "json",
        origin: "*",
        ids: chunk.join("|"),
        languages: group.languages.join("|"),
        props: "labels|aliases",
      });
      const response = await fetch(`${WIKIDATA_ENDPOINT}?${params}`);

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const payload = await response.json();
      for (const [qid, entity] of Object.entries(payload.entities || {})) {
        const feature = qidToFeature.get(qid);
        const primaryName = feature?.properties.name || "";
        const seen = new Set<string>();
        const wikidataEntity = entity as {
          aliases?: Record<string, Array<{ value: string }>>;
          labels?: Record<string, { value: string }>;
        };
        const nativeNames = [
          ...group.languages
            .map((lang) => {
              const name = wikidataEntity.labels?.[lang]?.value;
              return name ? { lang, name } : null;
            })
            .filter((name): name is NativeName => Boolean(name)),
          ...group.languages.flatMap((lang) =>
            (wikidataEntity.aliases?.[lang] || []).map((alias) => ({
              display: false,
              lang,
              name: alias.value,
            })),
          ),
        ]
          .filter((name): name is NativeName => Boolean(name))
          .filter((nativeName) => {
            const normalized = normalizeGuess(nativeName.name);
            if (!normalized || normalized === normalizeGuess(primaryName) || seen.has(normalized)) {
              return false;
            }
            seen.add(normalized);
            return true;
          });

        if (nativeNames.length) {
          labels[qid] = nativeNames.slice(0, NATIVE_NAME_CANDIDATE_LIMIT);
        }
      }
    }
  }

  return labels;
}
