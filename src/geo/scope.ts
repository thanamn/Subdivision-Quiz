import type {
  CountrySummary,
  RegionSummary,
  Scope,
  SubdivisionFeature,
} from "../domain/types";

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

export function byCountryThenName(a: SubdivisionFeature, b: SubdivisionFeature) {
  return (
    a.properties.country.localeCompare(b.properties.country) ||
    a.properties.name.localeCompare(b.properties.name)
  );
}
