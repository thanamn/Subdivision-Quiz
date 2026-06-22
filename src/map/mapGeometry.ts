import { geoArea, geoPath } from "d3-geo";
import { zoomIdentity } from "d3-zoom";
import type { FeatureCollection } from "geojson";
import type { Scope, SubdivisionFeature } from "../domain/types";
import {
  COLLAPSED_GEOGRAPHIC_AREA,
  FOCUS_MAX_ZOOM,
  FOCUS_MIN_ZOOM,
  FOCUS_PADDING_X,
  FOCUS_PADDING_Y,
  FOCUS_TINY_MIN_ZOOM,
  HEIGHT,
  TINY_GEOGRAPHIC_AREA,
  TINY_MARKER_MAX_SCREEN_RADIUS,
  TINY_MARKER_MIN_SCREEN_RADIUS,
  TINY_PROJECTED_MAX_AREA,
  TINY_PROJECTED_MAX_SIDE,
  TINY_PROJECTED_MIN_SIDE,
  TINY_ZOOM_AREA_DECAY,
  TINY_ZOOM_MAX_AREA_FLOOR,
  TINY_ZOOM_MAX_SIDE_FLOOR,
  TINY_ZOOM_MIN_SIDE_DECAY,
  TINY_ZOOM_MIN_SIDE_FLOOR,
  TINY_ZOOM_SIDE_DECAY,
  WIDTH,
} from "./mapConstants";
import type { HintBox, PathDatum, TinyMarkerVisibilityItem } from "./mapTypes";

export function featureCollection(features: SubdivisionFeature[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features,
  };
}

export function nativeNameText(feature: SubdivisionFeature) {
  return feature.properties.nativeNames
    .filter((nativeName) => nativeName.display !== false)
    .map((nativeName) => nativeName.name)
    .join(" / ");
}

export function visibleTinyMarkerItems<T extends TinyMarkerVisibilityItem>(
  markerData: T[],
  showOptionalTinyMarkers: boolean,
) {
  return showOptionalTinyMarkers
    ? markerData
    : markerData.filter((item) => item.tinyMarker?.alwaysVisible);
}

function isFinitePoint(point: [number, number]) {
  return point.every(Number.isFinite);
}

function tinyProjectedSize(bounds: [[number, number], [number, number]]) {
  const width = bounds[1][0] - bounds[0][0];
  const height = bounds[1][1] - bounds[0][1];
  const area = width * height;
  const maxSide = Math.max(width, height);
  const minSide = Math.min(width, height);

  return (
    maxSide < TINY_PROJECTED_MAX_SIDE ||
    area < TINY_PROJECTED_MAX_AREA ||
    minSide < TINY_PROJECTED_MIN_SIDE
  );
}

export function tinyScreenSize(
  size: { height: number; width: number },
  zoomScale: number,
) {
  const width = size.width * zoomScale;
  const height = size.height * zoomScale;
  const area = width * height;
  const maxSide = Math.max(width, height);
  const minSide = Math.min(width, height);
  const maxSideThreshold = Math.max(
    TINY_ZOOM_MAX_SIDE_FLOOR,
    TINY_PROJECTED_MAX_SIDE / zoomScale ** TINY_ZOOM_SIDE_DECAY,
  );
  const areaThreshold = Math.max(
    TINY_ZOOM_MAX_AREA_FLOOR,
    TINY_PROJECTED_MAX_AREA / zoomScale ** TINY_ZOOM_AREA_DECAY,
  );
  const minSideThreshold = Math.max(
    TINY_ZOOM_MIN_SIDE_FLOOR,
    TINY_PROJECTED_MIN_SIDE / zoomScale ** TINY_ZOOM_MIN_SIDE_DECAY,
  );

  return (
    maxSide < maxSideThreshold ||
    area < areaThreshold ||
    minSide < minSideThreshold
  );
}

export function tinyMarkerRadius(
  size: { height: number; width: number },
  zoomScale: number,
) {
  const screenWidth = size.width * zoomScale;
  const screenHeight = size.height * zoomScale;
  const maxSide = Math.max(screenWidth, screenHeight);
  const screenRadius =
    maxSide < TINY_PROJECTED_MIN_SIDE
      ? TINY_MARKER_MAX_SCREEN_RADIUS
      : Math.max(
          TINY_MARKER_MIN_SCREEN_RADIUS,
          Math.min(TINY_MARKER_MAX_SCREEN_RADIUS, maxSide * 0.42),
        );

  return screenRadius / zoomScale;
}

export function tinyMarkerOpacity(
  size: { height: number; width: number },
  zoomScale: number,
) {
  const maxSide = Math.max(size.width * zoomScale, size.height * zoomScale);
  return maxSide < TINY_PROJECTED_MIN_SIDE ? 0.95 : 0.85;
}

export function tinyMarkerForFeature(
  feature: SubdivisionFeature,
  path: ReturnType<typeof geoPath>,
  scope: Scope,
) {
  const centroid = path.centroid(feature);
  if (!isFinitePoint(centroid)) {
    return null;
  }

  const bounds = path.bounds(feature);
  const width = bounds[1][0] - bounds[0][0];
  const height = bounds[1][1] - bounds[0][1];
  if (![width, height].every(Number.isFinite)) {
    return null;
  }

  const geographicArea = geoArea(feature);
  const collapsedGeometry = geographicArea < COLLAPSED_GEOGRAPHIC_AREA;
  const geographicallyTiny = geographicArea < TINY_GEOGRAPHIC_AREA;
  const projectedTiny =
    scope.kind === "country" && tinyProjectedSize(bounds);

  return projectedTiny || (scope.kind !== "country" && geographicallyTiny)
    ? {
        alwaysVisible: collapsedGeometry,
        height,
        width,
        x: centroid[0],
        y: centroid[1],
      }
    : null;
}

function clamp(value: number, min: number, max: number) {
  if (max < min) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function seededUnit(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}

function hintedRange(min: number, max: number, seed: string) {
  return min + (max - min) * seededUnit(seed);
}

export function hintBoxForFeature(
  feature: SubdivisionFeature,
  features: SubdivisionFeature[],
  path: ReturnType<typeof geoPath>,
  hintLevel: number,
): HintBox | null {
  if (hintLevel <= 0) {
    return null;
  }

  const mapBounds = path.bounds(featureCollection(features));
  const targetBounds = path.bounds(feature);
  const mapWidth = mapBounds[1][0] - mapBounds[0][0];
  const mapHeight = mapBounds[1][1] - mapBounds[0][1];
  const targetWidth = targetBounds[1][0] - targetBounds[0][0];
  const targetHeight = targetBounds[1][1] - targetBounds[0][1];

  if (![mapWidth, mapHeight, targetWidth, targetHeight].every(Number.isFinite)) {
    return null;
  }

  const hintRatios = [0.46, 0.25, 0.13];
  const ratio = hintRatios[Math.min(hintLevel, hintRatios.length) - 1];
  const padding = Math.max(6, Math.max(mapWidth, mapHeight) * 0.012);
  const width = Math.min(
    mapWidth,
    Math.max(mapWidth * ratio, targetWidth + padding * 2),
  );
  const height = Math.min(
    mapHeight,
    Math.max(mapHeight * ratio, targetHeight + padding * 2),
  );

  const minX = targetBounds[1][0] - width;
  const maxX = targetBounds[0][0];
  const minY = targetBounds[1][1] - height;
  const maxY = targetBounds[0][1];
  const rawX = hintedRange(minX, maxX, `${feature.properties.id}:x:${hintLevel}`);
  const rawY = hintedRange(minY, maxY, `${feature.properties.id}:y:${hintLevel}`);
  const x = clamp(rawX, mapBounds[0][0], mapBounds[1][0] - width);
  const y = clamp(rawY, mapBounds[0][1], mapBounds[1][1] - height);

  return {
    height,
    width,
    x,
    y,
  };
}

export function focusTransformForItem(item: PathDatum) {
  const bounds = item.bounds;
  const width = Math.max(bounds[1][0] - bounds[0][0], 1);
  const height = Math.max(bounds[1][1] - bounds[0][1], 1);
  const centerX = item.tinyMarker
    ? item.tinyMarker.x
    : (bounds[0][0] + bounds[1][0]) / 2;
  const centerY = item.tinyMarker
    ? item.tinyMarker.y
    : (bounds[0][1] + bounds[1][1]) / 2;
  const fitScale = Math.min(
    (WIDTH - FOCUS_PADDING_X * 2) / width,
    (HEIGHT - FOCUS_PADDING_Y * 2) / height,
  );
  const scale = clamp(
    item.tinyMarker
      ? Math.max(fitScale, FOCUS_TINY_MIN_ZOOM)
      : fitScale,
    FOCUS_MIN_ZOOM,
    FOCUS_MAX_ZOOM,
  );
  const x = WIDTH / 2 - centerX * scale;
  const y = HEIGHT / 2 - centerY * scale;

  return zoomIdentity.translate(x, y).scale(scale);
}
