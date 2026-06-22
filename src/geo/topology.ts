import { feature as topojsonFeature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type {
  NativeName,
  RawAdmin1Properties,
  SubdivisionFeature,
  SubdivisionProperties,
} from "../domain/types";
import { compactAliases, removeEnglishTypeWords, splitAliases } from "./aliases";
import { normalizeGuess } from "./normalization";
import {
  DISPLAY_NAME_OVERRIDES,
  EXTRA_ALIAS_OVERRIDES,
} from "./overrides/displayNames";
import { applyTopologyFeatureOverrides } from "./overrides/vietnam2025";
import type {
  CountryRegionLookup,
  RawSubdivisionFeature,
  RawTopoGeometry,
} from "./topologyTypes";

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

function bestEnglishName(raw: RawAdmin1Properties) {
  const override = raw.adm1_code ? DISPLAY_NAME_OVERRIDES[raw.adm1_code] : undefined;
  if (override) {
    return override;
  }

  if (raw.adm1_code?.startsWith("VNM-2025-")) {
    return raw.name_en || raw.name || raw.gn_name || "";
  }

  const name = raw.name_en || raw.name || raw.gn_name || "";
  const normalized = normalizeGuess(name);
  const expandedAlias = splitAliases(raw.name_alt).find((alias) => {
    const aliasNormalized = normalizeGuess(alias);
    return (
      normalized &&
      aliasNormalized.startsWith(normalized) &&
      removeEnglishTypeWords(alias) === normalized
    );
  });

  return expandedAlias || name;
}

function validNameEnAlias(raw: RawAdmin1Properties, displayName: string) {
  if (!raw.name_en) {
    return undefined;
  }

  const overriddenName = raw.adm1_code ? DISPLAY_NAME_OVERRIDES[raw.adm1_code] : undefined;
  if (
    overriddenName &&
    normalizeGuess(raw.name_en) !== normalizeGuess(displayName)
  ) {
    return undefined;
  }

  return raw.name_en;
}

function compactLocalNames(
  values: Array<string | undefined>,
  primaryName: string,
) {
  const names = new Map<string, string>();
  const primaryNormalized = normalizeGuess(primaryName);
  const primaryWithoutTypes = removeEnglishTypeWords(primaryName);

  for (const value of values) {
    for (const candidate of splitAliases(value)) {
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
  values: Array<NativeName | undefined>,
  primaryName: string,
) {
  const names = new Map<string, NativeName>();
  const primaryNormalized = normalizeGuess(primaryName);

  for (const value of values) {
    if (!value?.name) {
      continue;
    }

    for (const name of splitAliases(value.name)) {
      const normalized = normalizeGuess(name);
      if (!normalized || normalized === primaryNormalized || names.has(normalized)) {
        continue;
      }

      names.set(normalized, { ...value, name });
    }
  }

  return [...names.values()].slice(0, 3);
}

function markNonPrimaryNativeNames(raw: RawAdmin1Properties, nativeNames: NativeName[]) {
  if (raw.adm0_a3 !== "CAN") {
    return nativeNames;
  }

  // Keep Canadian French translations guessable without promoting them to prompt labels.
  return nativeNames.map((nativeName) =>
    nativeName.lang === "fr"
      ? {
          ...nativeName,
          display: false,
        }
      : nativeName,
  );
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
  feature: RawSubdivisionFeature,
  index: number,
  countryRegions: CountryRegionLookup,
): SubdivisionFeature | null {
  const raw = feature.properties;
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
  const nativeNames = markNonPrimaryNativeNames(
    raw,
    compactNativeNames(
      [
        ...(raw.native_names || []),
        ...sourceNativeNames,
        fallbackLocalNativeName,
      ],
      name,
    ),
  );
  const aliases = compactAliases([
    name,
    raw.name,
    validNameEnAlias(raw, name),
    raw.name_alt,
    fallbackLocalNativeName?.name,
    raw.gn_name,
    ...(raw.adm1_code ? EXTRA_ALIAS_OVERRIDES[raw.adm1_code] || [] : []),
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
    objects: Record<string, { geometries?: RawTopoGeometry[] } | unknown>;
  };
  const objectName = Object.keys(typedTopology.objects)[0];
  const topologyObject = typedTopology.objects[objectName];
  const rawGeometries =
    topologyObject &&
    typeof topologyObject === "object" &&
    "geometries" in topologyObject &&
    Array.isArray(topologyObject.geometries)
      ? topologyObject.geometries
      : [];
  const collection = topojsonFeature(
    typedTopology as never,
    topologyObject as never,
  ) as unknown as FeatureCollection<Geometry, RawAdmin1Properties>;
  const features = applyTopologyFeatureOverrides(
    topology,
    rawGeometries,
    collection.features as RawSubdivisionFeature[],
  );

  return features
    .map((item, index) =>
      toSubdivisionFeature(item, index, countryRegions),
    )
    .filter((item): item is SubdivisionFeature => Boolean(item));
}
