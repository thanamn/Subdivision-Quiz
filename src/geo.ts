import { feature as topojsonFeature, merge as topojsonMerge } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
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

type RawSubdivisionFeature = Feature<Geometry, RawAdmin1Properties>;
type RawTopoGeometry = {
  properties?: RawAdmin1Properties;
};
type Vietnam2025Unit = {
  adm1Code: string;
  aliases?: string[];
  kind: "city" | "province";
  memberCodes: string[];
  name: string;
};

const COLOR_PALETTE_SIZE = 11;
const VIETNAM_2025_UNITS: Vietnam2025Unit[] = [
  {
    adm1Code: "VNM-2025-TUYEN-QUANG",
    kind: "province",
    memberCodes: ["VNM-512", "VNM-457"],
    name: "Tuyên Quang",
  },
  {
    adm1Code: "VNM-2025-LAO-CAI",
    kind: "province",
    memberCodes: ["VNM-5483", "VNM-458"],
    name: "Lào Cai",
  },
  {
    adm1Code: "VNM-2025-THAI-NGUYEN",
    aliases: ["Bắc Kạn", "Bac Kan"],
    kind: "province",
    memberCodes: ["VNM-451", "VNM-452"],
    name: "Thái Nguyên",
  },
  {
    adm1Code: "VNM-2025-PHU-THO",
    kind: "province",
    memberCodes: ["VNM-464", "VNM-459", "VNM-469"],
    name: "Phú Thọ",
  },
  {
    adm1Code: "VNM-2025-BAC-NINH",
    kind: "province",
    memberCodes: ["VNM-470", "VNM-463"],
    name: "Bắc Ninh",
  },
  {
    adm1Code: "VNM-2025-HUNG-YEN",
    aliases: ["Hưng Yên", "Hung Yen"],
    kind: "province",
    memberCodes: ["VNM-461", "VNM-471"],
    name: "Hưng Yên",
  },
  {
    adm1Code: "VNM-2025-HAI-PHONG",
    kind: "city",
    memberCodes: ["VNM-4600", "VNM-460"],
    name: "Hải Phòng",
  },
  {
    adm1Code: "VNM-2025-NINH-BINH",
    kind: "province",
    memberCodes: ["VNM-467", "VNM-468", "VNM-466"],
    name: "Ninh Bình",
  },
  {
    adm1Code: "VNM-2025-QUANG-TRI",
    kind: "province",
    memberCodes: ["VNM-476", "VNM-489"],
    name: "Quảng Trị",
  },
  {
    adm1Code: "VNM-2025-DA-NANG",
    kind: "city",
    memberCodes: ["VNM-491", "VNM-487"],
    name: "Đà Nẵng",
  },
  {
    adm1Code: "VNM-2025-QUANG-NGAI",
    kind: "province",
    memberCodes: ["VNM-486", "VNM-488"],
    name: "Quảng Ngãi",
  },
  {
    adm1Code: "VNM-2025-GIA-LAI",
    kind: "province",
    memberCodes: ["VNM-478", "VNM-485"],
    name: "Gia Lai",
  },
  {
    adm1Code: "VNM-2025-KHANH-HOA",
    kind: "province",
    memberCodes: ["VNM-481", "VNM-479"],
    name: "Khánh Hòa",
  },
  {
    adm1Code: "VNM-2025-LAM-DONG",
    kind: "province",
    memberCodes: ["VNM-4835", "VNM-496", "VNM-480"],
    name: "Lâm Đồng",
  },
  {
    adm1Code: "VNM-2025-DAK-LAK",
    kind: "province",
    memberCodes: ["VNM-482", "VNM-477"],
    name: "Đắk Lắk",
  },
  {
    adm1Code: "VNM-2025-HO-CHI-MINH-CITY",
    aliases: ["Hồ Chí Minh City", "Thành phố Hồ Chí Minh"],
    kind: "city",
    memberCodes: ["VNM-501", "VNM-483", "VNM-495"],
    name: "Hồ Chí Minh",
  },
  {
    adm1Code: "VNM-2025-DONG-NAI",
    aliases: ["Đồng Nai", "Dong Nai"],
    kind: "province",
    memberCodes: ["VNM-484", "VNM-497"],
    name: "Đồng Nai",
  },
  {
    adm1Code: "VNM-2025-TAY-NINH",
    kind: "province",
    memberCodes: ["VNM-503", "VNM-444"],
    name: "Tây Ninh",
  },
  {
    adm1Code: "VNM-2025-CAN-THO",
    kind: "city",
    memberCodes: ["VNM-499", "VNM-508", "VNM-505"],
    name: "Cần Thơ",
  },
  {
    adm1Code: "VNM-2025-VINH-LONG",
    kind: "province",
    memberCodes: ["VNM-504", "VNM-509", "VNM-510"],
    name: "Vĩnh Long",
  },
  {
    adm1Code: "VNM-2025-DONG-THAP",
    kind: "province",
    memberCodes: ["VNM-4834", "VNM-500"],
    name: "Đồng Tháp",
  },
  {
    adm1Code: "VNM-2025-CA-MAU",
    kind: "province",
    memberCodes: ["VNM-506", "VNM-507"],
    name: "Cà Mau",
  },
  {
    adm1Code: "VNM-2025-AN-GIANG",
    kind: "province",
    memberCodes: ["VNM-502", "VNM-498"],
    name: "An Giang",
  },
  {
    adm1Code: "VNM-2025-CAO-BANG",
    kind: "province",
    memberCodes: ["VNM-511"],
    name: "Cao Bằng",
  },
  {
    adm1Code: "VNM-2025-DIEN-BIEN",
    kind: "province",
    memberCodes: ["VNM-450"],
    name: "Điện Biên",
  },
  {
    adm1Code: "VNM-2025-HA-TINH",
    kind: "province",
    memberCodes: ["VNM-474"],
    name: "Hà Tĩnh",
  },
  {
    adm1Code: "VNM-2025-LAI-CHAU",
    kind: "province",
    memberCodes: ["VNM-453"],
    name: "Lai Châu",
  },
  {
    adm1Code: "VNM-2025-LANG-SON",
    kind: "province",
    memberCodes: ["VNM-454"],
    name: "Lạng Sơn",
  },
  {
    adm1Code: "VNM-2025-NGHE-AN",
    kind: "province",
    memberCodes: ["VNM-475"],
    name: "Nghệ An",
  },
  {
    adm1Code: "VNM-2025-QUANG-NINH",
    kind: "province",
    memberCodes: ["VNM-429"],
    name: "Quảng Ninh",
  },
  {
    adm1Code: "VNM-2025-THANH-HOA",
    kind: "province",
    memberCodes: ["VNM-456"],
    name: "Thanh Hóa",
  },
  {
    adm1Code: "VNM-2025-SON-LA",
    kind: "province",
    memberCodes: ["VNM-455"],
    name: "Sơn La",
  },
  {
    adm1Code: "VNM-2025-HA-NOI",
    kind: "city",
    memberCodes: ["VNM-462"],
    name: "Hà Nội",
  },
  {
    adm1Code: "VNM-2025-HUE",
    aliases: ["Thừa Thiên Huế", "Thua Thien Hue"],
    kind: "city",
    memberCodes: ["VNM-490"],
    name: "Huế",
  },
];
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
const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  "DNK-3419": "Capital Region of Denmark",
  "MEX-2727": "Mexico City",
  "MNP-4940": "Northern Islands",
  "SPM-4866": "Saint-Pierre",
  "SYC-5197": "Outer Islands",
  "SYC-5210": "Grand'Anse Mahé",
  "SYC-5212": "La Digue and Inner Islands",
  "SYC-5213": "English River",
};
const EXTRA_ALIAS_OVERRIDES: Record<string, string[]> = {
  "DNK-3419": ["Capital Region", "Hovedstaden", "Region Hovedstaden"],
  "MEX-2727": ["Distrito Federal", "Ciudad de México", "CDMX", "Mexico D.F."],
  "MNP-4940": ["Northern Islands Municipality"],
  "SYC-5212": ["La Digue"],
  "SYC-5213": ["La Rivière Anglaise"],
};
const MARK_CHAR = /\p{Mark}/u;
const LETTER_CHAR = /\p{Letter}/u;
const LATIN_CHAR = /\p{Script=Latin}/u;
const LATIN_SPECIAL_FOLDS: Record<string, string> = {
  æ: "ae",
  đ: "d",
  ð: "d",
  ħ: "h",
  ı: "i",
  ł: "l",
  ŋ: "n",
  œ: "oe",
  ø: "o",
  ß: "ss",
  þ: "th",
};
const LATIN_SPECIAL_FOLD_PATTERN = /[æđðħıłŋœøßþ]/gu;

function foldSearchText(value: string) {
  const decomposed = value.normalize("NFKD");
  let folded = "";
  let markBase: "latin" | "other" | null = null;

  for (const char of decomposed) {
    if (MARK_CHAR.test(char)) {
      if (markBase === "other") {
        folded += char;
      }
      continue;
    }

    folded += char;
    markBase = LETTER_CHAR.test(char)
      ? LATIN_CHAR.test(char)
        ? "latin"
        : "other"
      : null;
  }

  return folded.normalize("NFC");
}

export function normalizeGuess(value: string) {
  return foldSearchText(value)
    .toLowerCase()
    .replace(
      LATIN_SPECIAL_FOLD_PATTERN,
      (char) => LATIN_SPECIAL_FOLDS[char] || char,
    )
    .replace(/&/g, " and ")
    .replace(/['\u2019]/g, "")
    .replace(/[^\p{Letter}\p{Number}\p{Mark}]+/gu, " ")
    .trim()
    .normalize("NFC");
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

function averageNumber(values: Array<number | undefined>) {
  const numbers = values.filter((value): value is number => Number.isFinite(value));
  if (!numbers.length) {
    return undefined;
  }

  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function vietnam2025NameAlt(unit: Vietnam2025Unit, memberProps: RawAdmin1Properties[]) {
  const staleRegionAliases = new Set([
    "dong bac",
    "dong bang song hong",
    "dong nam bo",
    "north east",
    "northeast vietnam",
    "red river delta",
    "south east",
  ]);
  const typedVietnameseName =
    unit.kind === "city" ? `Thành phố ${unit.name}` : `Tỉnh ${unit.name}`;

  return compactAliases([
    typedVietnameseName,
    ...(unit.aliases || []),
    ...memberProps.flatMap((props) => [
      props.name,
      props.name_en,
      props.name_alt,
      props.gn_name,
    ]),
  ])
    .filter((alias) => normalizeGuess(alias) !== normalizeGuess(unit.name))
    .filter((alias) => !staleRegionAliases.has(normalizeGuess(alias)))
    .join("|");
}

function vietnam2025Features(
  topology: unknown,
  rawGeometries: RawTopoGeometry[],
): RawSubdivisionFeature[] | null {
  const vietnamGeometries = new Map(
    rawGeometries
      .filter((geometry) => geometry.properties?.adm0_a3 === "VNM")
      .map((geometry) => [geometry.properties?.adm1_code, geometry]),
  );

  if (!vietnamGeometries.size) {
    return null;
  }

  const missingCodes = VIETNAM_2025_UNITS.flatMap((unit) =>
    unit.memberCodes.filter((code) => !vietnamGeometries.has(code)),
  );
  if (missingCodes.length) {
    return null;
  }

  return VIETNAM_2025_UNITS.map((unit) => {
    const memberGeometries = unit.memberCodes.map(
      (code) => vietnamGeometries.get(code) as RawTopoGeometry,
    );
    const memberProps = memberGeometries.map(
      (geometry) => geometry.properties || {},
    );
    const representative =
      memberProps.find(
        (props) =>
          normalizeGuess(props.name_en || props.name || "") ===
          normalizeGuess(unit.name),
      ) ||
      memberProps.find((props) => props.wikidataid) ||
      memberProps[0] ||
      {};
    const isMerged = memberProps.length > 1;
    const type = unit.kind === "city" ? "Thành phố trực thuộc trung ương" : "Tỉnh";
    const typeEn = unit.kind === "city" ? "Municipality" : "Province";

    return {
      geometry: topojsonMerge(topology as never, memberGeometries as never),
      properties: {
        ...representative,
        adm1_code: unit.adm1Code,
        adm0_a3: "VNM",
        iso_a2: "VN",
        admin: "Vietnam",
        geonunit: "Vietnam",
        name: unit.name,
        name_en: unit.name,
        name_alt: vietnam2025NameAlt(unit, memberProps),
        name_local: "",
        gn_name: unit.name,
        type,
        type_en: typeEn,
        region: "",
        longitude: averageNumber(memberProps.map((props) => props.longitude)),
        latitude: averageNumber(memberProps.map((props) => props.latitude)),
        postal: "",
        wikidataid: isMerged ? undefined : representative.wikidataid,
      },
      type: "Feature",
    };
  });
}

function applyTopologyFeatureOverrides(
  topology: unknown,
  rawGeometries: RawTopoGeometry[],
  features: RawSubdivisionFeature[],
) {
  const mergedVietnamFeatures = vietnam2025Features(topology, rawGeometries);
  if (!mergedVietnamFeatures) {
    return features;
  }

  return [
    ...features.filter((feature) => feature.properties?.adm0_a3 !== "VNM"),
    ...mergedVietnamFeatures,
  ];
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
  const override = raw.adm1_code ? DISPLAY_NAME_OVERRIDES[raw.adm1_code] : undefined;
  if (override) {
    return override;
  }

  if (raw.adm1_code?.startsWith("VNM-2025-")) {
    return raw.name_en || raw.name || raw.gn_name || "";
  }

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
  values: Array<NativeName | undefined>,
  primaryName: string,
) {
  const names = new Map<string, NativeName>();
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
