import { feature as topojsonFeature } from "topojson-client";
import type { FeatureCollection } from "geojson";
import type {
  CountrySummary,
  NativeName,
  RawAdmin1Properties,
  RegionSummary,
  Scope,
  SubdivisionFeature,
  SubdivisionProperties,
} from "./types";

export type CountryRegionLookup = Record<
  string,
  {
    languageCodes?: string[];
    name: string;
    region: string;
    subregion: string;
  }
>;

const COLOR_PALETTE_SIZE = 11;
const LANGUAGE_FIELD_BY_CODE: Partial<Record<string, keyof RawAdmin1Properties>> = {
  ar: "name_ar",
  bn: "name_bn",
  de: "name_de",
  el: "name_el",
  es: "name_es",
  fa: "name_fa",
  fr: "name_fr",
  he: "name_he",
  hi: "name_hi",
  hu: "name_hu",
  id: "name_id",
  it: "name_it",
  ja: "name_ja",
  ko: "name_ko",
  nl: "name_nl",
  pl: "name_pl",
  pt: "name_pt",
  ru: "name_ru",
  sv: "name_sv",
  tr: "name_tr",
  uk: "name_uk",
  ur: "name_ur",
  vi: "name_vi",
  zh: "name_zh",
  "zh-hant": "name_zht",
};
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

export function normalizeGuess(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['\u2019]/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}

function splitAliases(value?: string) {
  if (!value) {
    return [];
  }

  return value
    .split(/[|;]/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function compactAliases(values: Array<string | undefined>) {
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

function removeEnglishTypeWords(value: string) {
  return normalizeGuess(value)
    .split(" ")
    .filter((word) => !ENGLISH_TYPE_WORDS.has(word))
    .join(" ");
}

function splitAliasCandidates(value?: string) {
  if (!value) {
    return [];
  }

  return splitAliases(value);
}

function bestEnglishName(raw: RawAdmin1Properties) {
  const name = raw.name_en || raw.name || raw.gn_name || "";
  const normalized = normalizeGuess(name);
  const expandedAlias = splitAliasCandidates(raw.name_alt).find((alias) => {
    const aliasNormalized = normalizeGuess(alias);
    return (
      normalized &&
      aliasNormalized.startsWith(normalized) &&
      removeEnglishTypeWords(alias) === normalized
    );
  });

  return expandedAlias || name;
}

function compactLocalNames(
  values: Array<string | undefined>,
  primaryName: string,
) {
  const names = new Map<string, string>();
  const primaryNormalized = normalizeGuess(primaryName);
  const primaryWithoutTypes = removeEnglishTypeWords(primaryName);

  for (const value of values) {
    for (const candidate of splitAliasCandidates(value)) {
      const normalized = normalizeGuess(candidate);
      if (!normalized || normalized === primaryNormalized || names.has(normalized)) {
        continue;
      }

      if (/\bgeneral\b/i.test(candidate)) {
        continue;
      }

      if (
        primaryWithoutTypes &&
        removeEnglishTypeWords(candidate) === primaryWithoutTypes
      ) {
        continue;
      }

      names.set(normalized, candidate);
    }
  }

  return [...names.values()].slice(0, 2);
}

function compactNativeNames(
  values: Array<{ lang: string; name: string } | undefined>,
  primaryName: string,
) {
  const names = new Map<string, { lang: string; name: string }>();
  const primaryNormalized = normalizeGuess(primaryName);

  for (const value of values) {
    if (!value?.name) {
      continue;
    }

    for (const name of splitAliasCandidates(value.name)) {
      const normalized = normalizeGuess(name);
      if (!normalized || normalized === primaryNormalized || names.has(normalized)) {
        continue;
      }

      names.set(normalized, { ...value, name });
    }
  }

  return [...names.values()].slice(0, 3);
}

function naturalEarthNativeNames(
  raw: RawAdmin1Properties,
  languageCodes: string[] = [],
): NativeName[] {
  const names: NativeName[] = [];

  for (const lang of languageCodes) {
    const field = LANGUAGE_FIELD_BY_CODE[lang];
    const name = field ? raw[field] : undefined;

    if (typeof name === "string" && name.trim()) {
      names.push({ lang, name });
    }
  }

  return names;
}

function colorIndexFor(code: string) {
  let hash = 0;
  for (let index = 0; index < code.length; index += 1) {
    hash = (hash * 31 + code.charCodeAt(index)) >>> 0;
  }
  return hash % COLOR_PALETTE_SIZE;
}

function toSubdivisionFeature(
  feature: SubdivisionFeature,
  index: number,
  countryRegions: CountryRegionLookup,
): SubdivisionFeature | null {
  const raw = feature.properties as unknown as RawAdmin1Properties;
  const countryCode = raw.adm0_a3 || "UNK";
  const countryInfo = countryRegions[countryCode];
  const country = countryInfo?.name || raw.admin || raw.geonunit || countryCode;
  const name = bestEnglishName(raw);

  if (!name || !countryCode || countryCode === "-99") {
    return null;
  }

  const localNames = compactLocalNames([raw.gn_name, raw.name], name);
  const sourceNativeNames = naturalEarthNativeNames(raw, countryInfo?.languageCodes);
  const fallbackLocalNativeName =
    raw.native_names?.length || sourceNativeNames.length
      ? undefined
      : raw.name_local
        ? { lang: "local", name: raw.name_local }
        : undefined;
  const nativeNames = compactNativeNames(
    [
      ...(raw.native_names || []),
      ...sourceNativeNames,
      fallbackLocalNativeName,
    ],
    name,
  );
  const aliases = compactAliases([
    raw.name,
    raw.name_en,
    raw.name_alt,
    fallbackLocalNativeName?.name,
    raw.gn_name,
    ...nativeNames.map((nativeName) => nativeName.name),
  ]);

  const properties: SubdivisionProperties = {
    id: raw.adm1_code || `${countryCode}-${index}`,
    adm1Code: raw.adm1_code || `${countryCode}-${index}`,
    countryCode,
    countryIso2: raw.iso_a2,
    country,
    region: countryInfo?.region || "Other",
    subregion: countryInfo?.subregion || "Other",
    name,
    localNames,
    nativeNames,
    type: raw.type || raw.type_en || "Subdivision",
    typeEn: raw.type_en || raw.type || "Subdivision",
    code: raw.iso_3166_2,
    wikidataId: raw.wikidataid,
    postal: raw.postal,
    longitude: raw.longitude,
    latitude: raw.latitude,
    aliases,
    colorIndex: colorIndexFor(countryCode),
  };

  return {
    ...feature,
    id: properties.id,
    properties,
  };
}

export function loadAdmin1Topology(
  topology: unknown,
  countryRegions: CountryRegionLookup,
) {
  const typedTopology = topology as {
    objects: Record<string, unknown>;
  };
  const objectName = Object.keys(typedTopology.objects)[0];
  const collection = topojsonFeature(
    typedTopology as never,
    typedTopology.objects[objectName] as never,
  ) as unknown as FeatureCollection;

  return collection.features
    .map((item, index) =>
      toSubdivisionFeature(item as SubdivisionFeature, index, countryRegions),
    )
    .filter((item): item is SubdivisionFeature => Boolean(item));
}

export function buildCountrySummaries(features: SubdivisionFeature[]) {
  const countries = new Map<string, CountrySummary>();

  for (const feature of features) {
    const { countryCode, country, region, subregion } = feature.properties;
    const current = countries.get(countryCode);
    if (current) {
      current.count += 1;
    } else {
      countries.set(countryCode, {
        code: countryCode,
        name: country,
        region,
        subregion,
        count: 1,
      });
    }
  }

  return [...countries.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function buildRegionSummaries(countries: CountrySummary[]) {
  const regions = new Map<string, RegionSummary>();

  for (const country of countries) {
    const current = regions.get(country.region);
    if (current) {
      current.count += country.count;
      current.countries += 1;
    } else {
      regions.set(country.region, {
        name: country.region,
        count: country.count,
        countries: 1,
      });
    }
  }

  return [...regions.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function featureInScope(feature: SubdivisionFeature, scope: Scope) {
  if (scope.kind === "world") {
    return true;
  }

  if (scope.kind === "country") {
    return feature.properties.countryCode === scope.value;
  }

  return feature.properties.region === scope.value;
}

export function scopeKey(scope: Scope) {
  return `${scope.kind}:${scope.value}`;
}

export function scopeLabel(scope: Scope, countries: CountrySummary[]) {
  if (scope.kind === "world") {
    return "World";
  }

  if (scope.kind === "region") {
    return scope.value;
  }

  return countries.find((country) => country.code === scope.value)?.name || scope.value;
}

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

export function byCountryThenName(a: SubdivisionFeature, b: SubdivisionFeature) {
  return (
    a.properties.country.localeCompare(b.properties.country) ||
    a.properties.name.localeCompare(b.properties.name)
  );
}
