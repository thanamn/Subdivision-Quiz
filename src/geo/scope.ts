import type {
  CountrySummary,
  RegionSummary,
  Scope,
  SubdivisionFeature,
} from "../domain/types";

type RegionCountry = {
  code?: string;
  countryCode?: string;
  region: string;
  subregion: string;
};

type RegionDefinition = {
  name: string;
  matches: (country: RegionCountry) => boolean;
};

const ARAB_WORLD_COUNTRY_CODES = new Set([
  "DZA",
  "BHR",
  "COM",
  "DJI",
  "EGY",
  "IRQ",
  "JOR",
  "KWT",
  "LBN",
  "LBY",
  "MRT",
  "MAR",
  "OMN",
  "PSE",
  "QAT",
  "SAU",
  "SOM",
  "SDN",
  "SYR",
  "TUN",
  "ARE",
  "YEM",
]);

const subregion =
  (value: string) =>
  (country: RegionCountry) =>
    country.subregion === value;

const broadRegion =
  (value: string) =>
  (country: RegionCountry) =>
    country.region === value;

const REGION_DEFINITIONS: RegionDefinition[] = [
  { name: "Africa", matches: broadRegion("Africa") },
  { name: "Northern Africa", matches: subregion("Northern Africa") },
  { name: "Western Africa", matches: subregion("Western Africa") },
  { name: "Central Africa", matches: subregion("Middle Africa") },
  { name: "Eastern Africa", matches: subregion("Eastern Africa") },
  { name: "Southern Africa", matches: subregion("Southern Africa") },
  { name: "Americas", matches: broadRegion("Americas") },
  { name: "North America", matches: subregion("North America") },
  { name: "Caribbean", matches: subregion("Caribbean") },
  { name: "Central America", matches: subregion("Central America") },
  { name: "South America", matches: subregion("South America") },
  { name: "Asia", matches: broadRegion("Asia") },
  { name: "East Asia", matches: subregion("Eastern Asia") },
  { name: "Southeast Asia", matches: subregion("South-Eastern Asia") },
  { name: "South Asia", matches: subregion("Southern Asia") },
  { name: "Central Asia", matches: subregion("Central Asia") },
  { name: "Western Asia", matches: subregion("Western Asia") },
  {
    name: "Arab World",
    matches: (country) =>
      ARAB_WORLD_COUNTRY_CODES.has(country.countryCode || country.code || ""),
  },
  { name: "Europe", matches: broadRegion("Europe") },
  { name: "Northern Europe", matches: subregion("Northern Europe") },
  { name: "Western Europe", matches: subregion("Western Europe") },
  { name: "Central Europe", matches: subregion("Central Europe") },
  { name: "Southern Europe", matches: subregion("Southern Europe") },
  { name: "Southeast Europe", matches: subregion("Southeast Europe") },
  { name: "Eastern Europe", matches: subregion("Eastern Europe") },
  { name: "Oceania", matches: broadRegion("Oceania") },
  {
    name: "Australia and New Zealand",
    matches: subregion("Australia and New Zealand"),
  },
  { name: "Melanesia", matches: subregion("Melanesia") },
  { name: "Micronesia", matches: subregion("Micronesia") },
  { name: "Polynesia", matches: subregion("Polynesia") },
  { name: "Antarctic", matches: broadRegion("Antarctic") },
];

function matchesRegion(regionName: string, country: RegionCountry) {
  const definition = REGION_DEFINITIONS.find(
    (region) => region.name === regionName,
  );

  if (definition) {
    return definition.matches(country);
  }

  return country.region === regionName || country.subregion === regionName;
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
  const summaries = REGION_DEFINITIONS.map((region) => {
    const regionCountries = countries.filter(region.matches);
    return {
      name: region.name,
      count: regionCountries.reduce((sum, country) => sum + country.count, 0),
      countries: regionCountries.length,
    };
  });

  return summaries.filter((region) => region.count > 0);
}

export function featureInScope(feature: SubdivisionFeature, scope: Scope) {
  if (scope.kind === "world") {
    return true;
  }

  if (scope.kind === "country") {
    return feature.properties.countryCode === scope.value;
  }

  return matchesRegion(scope.value, feature.properties);
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

export function byCountryThenName(a: SubdivisionFeature, b: SubdivisionFeature) {
  return (
    a.properties.country.localeCompare(b.properties.country) ||
    a.properties.name.localeCompare(b.properties.name)
  );
}
