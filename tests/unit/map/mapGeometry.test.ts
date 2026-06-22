import { geoMercator, geoPath } from "d3-geo";
import { describe, expect, it } from "vitest";
import type { Geometry } from "geojson";
import type { Scope, SubdivisionFeature } from "../../../src/domain/types";
import {
  focusTransformForItem,
  tinyMarkerForFeature,
  tinyMarkerOpacity,
  tinyMarkerRadius,
  tinyScreenSize,
  visibleTinyMarkerItems,
} from "../../../src/map/mapGeometry";
import { FOCUS_TINY_MIN_ZOOM, WIDTH, HEIGHT } from "../../../src/map/mapConstants";
import type { PathDatum } from "../../../src/map/mapTypes";

const countryScope: Scope = { kind: "country", value: "TST" };
const worldScope: Scope = { kind: "world", value: "world" };

function makeFeature(id: string, geometry: Geometry): SubdivisionFeature {
  return {
    type: "Feature",
    id,
    geometry,
    properties: {
      adm1Code: id,
      aliases: [id],
      colorIndex: 0,
      country: "Testland",
      countryCode: "TST",
      id,
      localNames: [],
      name: id,
      nativeNames: [],
      region: "Test Region",
      subregion: "Test Subregion",
      type: "Province",
      typeEn: "Province",
    },
  };
}

function square(left: number, bottom: number, size: number): Geometry {
  return {
    type: "Polygon",
    coordinates: [
      [
        [left, bottom],
        [left + size, bottom],
        [left + size, bottom + size],
        [left, bottom + size],
        [left, bottom],
      ],
    ],
  };
}

function mapPath(scale = 100) {
  return geoPath(geoMercator().scale(scale).translate([WIDTH / 2, HEIGHT / 2]));
}

describe("tiny marker geometry", () => {
  it("creates country-scope helper dots for projected-small shapes only", () => {
    const projectedSmall = makeFeature("projected-small", square(-5, -5, 10));
    const path = mapPath(0.1);

    const marker = tinyMarkerForFeature(projectedSmall, path, countryScope);

    expect(marker).toEqual(
      expect.objectContaining({
        alwaysVisible: false,
        height: expect.any(Number),
        width: expect.any(Number),
        x: expect.any(Number),
        y: expect.any(Number),
      }),
    );
    expect(tinyMarkerForFeature(projectedSmall, path, worldScope)).toBeNull();
  });

  it("keeps collapsed geometries as required always-visible helper dots", () => {
    const collapsedPoint = makeFeature("collapsed", {
      type: "Point",
      coordinates: [100, 4],
    });

    const marker = tinyMarkerForFeature(collapsedPoint, mapPath(), worldScope);

    expect(marker).toEqual(
      expect.objectContaining({
        alwaysVisible: true,
        height: 0,
        width: 0,
      }),
    );
  });

  it("does not create helper dots for normal-size country shapes", () => {
    const normal = makeFeature("normal", square(-5, -5, 10));

    expect(tinyMarkerForFeature(normal, mapPath(100), countryScope)).toBeNull();
  });

  it("returns null instead of placing a dot for invalid geometry", () => {
    const empty = makeFeature("empty", {
      type: "GeometryCollection",
      geometries: [],
    });

    expect(tinyMarkerForFeature(empty, mapPath(), countryScope)).toBeNull();
  });

  it("filters optional helper dots unless they are explicitly visible", () => {
    const required = { id: "required", tinyMarker: { alwaysVisible: true } };
    const optional = { id: "optional", tinyMarker: { alwaysVisible: false } };
    const normal = { id: "normal", tinyMarker: null };

    expect(visibleTinyMarkerItems([required, optional, normal], false)).toEqual([
      required,
    ]);
    expect(visibleTinyMarkerItems([required, optional, normal], true)).toEqual([
      required,
      optional,
      normal,
    ]);
  });

  it("hides optional helper dots once zoom makes the feature readable", () => {
    expect(tinyScreenSize({ width: 10, height: 10 }, 1)).toBe(true);
    expect(tinyScreenSize({ width: 10, height: 10 }, 10)).toBe(false);
    expect(tinyScreenSize({ width: 100, height: 0.001 }, 100)).toBe(true);
  });

  it("scales helper-dot radius and opacity by on-screen size", () => {
    expect(tinyMarkerRadius({ width: 1, height: 1 }, 1)).toBe(8);
    expect(tinyMarkerRadius({ width: 1, height: 1 }, 4)).toBe(2);
    expect(tinyMarkerRadius({ width: 10, height: 10 }, 1)).toBeCloseTo(4.2);

    expect(tinyMarkerOpacity({ width: 1, height: 1 }, 1)).toBe(0.95);
    expect(tinyMarkerOpacity({ width: 10, height: 10 }, 1)).toBe(0.85);
  });

  it("focuses tiny features around the helper dot at the minimum tiny zoom", () => {
    const feature = makeFeature("tiny-focus", square(0, 0, 1));
    const item: PathDatum = {
      bounds: [
        [10, 20],
        [11, 21],
      ],
      d: "M0,0",
      feature,
      id: feature.properties.id,
      style: {},
      tinyMarker: {
        alwaysVisible: true,
        height: 1,
        width: 1,
        x: 120,
        y: 80,
      },
    };

    const transform = focusTransformForItem(item);

    expect(transform.k).toBeGreaterThanOrEqual(FOCUS_TINY_MIN_ZOOM);
    expect(transform.x).toBeCloseTo(WIDTH / 2 - item.tinyMarker.x * transform.k);
    expect(transform.y).toBeCloseTo(HEIGHT / 2 - item.tinyMarker.y * transform.k);
  });
});
