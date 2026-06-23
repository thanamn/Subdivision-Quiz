import type { Geometry, Position } from "geojson";
import type { SubdivisionFeature } from "../domain/types";

export type CountryAdjacency = Map<string, Set<string>>;

export function preferredCountryColorIndex(countryCode: string, paletteSize: number) {
  let hash = 0;
  for (let index = 0; index < countryCode.length; index += 1) {
    hash = (hash * 31 + countryCode.charCodeAt(index)) >>> 0;
  }
  return hash % paletteSize;
}

function addAdjacency(adjacency: CountryAdjacency, first: string, second: string) {
  if (!first || !second || first === second) {
    return;
  }

  const firstNeighbors = adjacency.get(first) || new Set<string>();
  firstNeighbors.add(second);
  adjacency.set(first, firstNeighbors);

  const secondNeighbors = adjacency.get(second) || new Set<string>();
  secondNeighbors.add(first);
  adjacency.set(second, secondNeighbors);
}

function coordinateKey(position: Position) {
  return position
    .slice(0, 2)
    .map((value) => value.toFixed(6))
    .join(",");
}

function visitPositions(geometry: Geometry | null, visit: (position: Position) => void) {
  if (!geometry) {
    return;
  }

  if (geometry.type === "GeometryCollection") {
    for (const child of geometry.geometries) {
      visitPositions(child, visit);
    }
    return;
  }

  function walk(value: Position | unknown[]) {
    if (
      Array.isArray(value) &&
      typeof value[0] === "number" &&
      typeof value[1] === "number"
    ) {
      visit(value as Position);
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item as Position | unknown[]);
      }
    }
  }

  walk(geometry.coordinates as Position | unknown[]);
}

export function countryAdjacencyFromFeatures(features: SubdivisionFeature[]) {
  const countriesByCoordinate = new Map<string, Set<string>>();
  const adjacency: CountryAdjacency = new Map();

  for (const feature of features) {
    const countryCode = feature.properties.countryCode;
    if (!countryCode) {
      continue;
    }

    if (!adjacency.has(countryCode)) {
      adjacency.set(countryCode, new Set());
    }

    visitPositions(feature.geometry, (position) => {
      const key = coordinateKey(position);
      const countries = countriesByCoordinate.get(key) || new Set<string>();
      countries.add(countryCode);
      countriesByCoordinate.set(key, countries);
    });
  }

  for (const countries of countriesByCoordinate.values()) {
    const codes = [...countries].sort();
    for (let first = 0; first < codes.length; first += 1) {
      for (let second = first + 1; second < codes.length; second += 1) {
        addAdjacency(adjacency, codes[first], codes[second]);
      }
    }
  }

  return adjacency;
}

export function assignCountryColorIndices(
  countryCodes: Iterable<string>,
  adjacency: CountryAdjacency,
  paletteSize: number,
) {
  const codes = [...new Set(countryCodes)].filter(Boolean).sort();
  const assigned = new Map<string, number>();
  const preferred = new Map(
    codes.map((code) => [code, preferredCountryColorIndex(code, paletteSize)]),
  );
  const orderedCodes = [...codes].sort(
    (first, second) =>
      (adjacency.get(second)?.size || 0) - (adjacency.get(first)?.size || 0) ||
      (preferred.get(first) || 0) - (preferred.get(second) || 0) ||
      first.localeCompare(second),
  );

  for (const code of orderedCodes) {
    const blocked = new Set(
      [...(adjacency.get(code) || [])]
        .map((neighbor) => assigned.get(neighbor))
        .filter((color): color is number => typeof color === "number"),
    );
    const preferredColor = preferred.get(code) || 0;
    let color = preferredColor;

    if (blocked.has(color)) {
      for (let offset = 1; offset < paletteSize; offset += 1) {
        const candidate = (preferredColor + offset) % paletteSize;
        if (!blocked.has(candidate)) {
          color = candidate;
          break;
        }
      }
    }

    assigned.set(code, color);
  }

  return assigned;
}

export function applyCountryColorIndices(
  features: SubdivisionFeature[],
  paletteSize: number,
) {
  const adjacency = countryAdjacencyFromFeatures(features);
  const colorByCountry = assignCountryColorIndices(
    features.map((feature) => feature.properties.countryCode),
    adjacency,
    paletteSize,
  );

  return features.map((feature) => ({
    ...feature,
    properties: {
      ...feature.properties,
      colorIndex:
        colorByCountry.get(feature.properties.countryCode) ??
        preferredCountryColorIndex(feature.properties.countryCode, paletteSize),
    },
  }));
}
