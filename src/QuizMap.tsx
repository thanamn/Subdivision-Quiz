import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { geoArea, geoEqualEarth, geoMercator, geoPath } from "d3-geo";
import { select } from "d3-selection";
import "d3-transition";
import { zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import { MapPin, Maximize2, Minus, Plus } from "lucide-react";
import type { FeatureCollection } from "geojson";
import type { Scope, SubdivisionFeature } from "./types";

const WIDTH = 1000;
const HEIGHT = 620;
const MAP_MAX_ZOOM = 500;
const FOCUS_MAX_ZOOM = 180;
const FOCUS_MIN_ZOOM = 1.15;
const FOCUS_TINY_MIN_ZOOM = 28;
const FOCUS_PADDING_X = 140;
const FOCUS_PADDING_Y = 110;
const TINY_MARKERS_KEY = "subdivision-quiz:tiny-markers";
const TINY_GEOGRAPHIC_AREA = 0.0000015;
const TINY_PROJECTED_MAX_SIDE = 24;
const TINY_PROJECTED_MAX_AREA = 130;
const TINY_PROJECTED_MIN_SIDE = 5;
const TINY_MARKER_MAX_SCREEN_RADIUS = 8;
const TINY_MARKER_MIN_SCREEN_RADIUS = 4;
const COLLAPSED_GEOGRAPHIC_AREA = 0.0000000001;
const TINY_ZOOM_MAX_SIDE_FLOOR = 12;
const TINY_ZOOM_MAX_AREA_FLOOR = 64;
const TINY_ZOOM_MIN_SIDE_FLOOR = 3;
const TINY_ZOOM_SIDE_DECAY = 1.8;
const TINY_ZOOM_AREA_DECAY = 2.4;
const TINY_ZOOM_MIN_SIDE_DECAY = 1.6;
const MAP_COLORS = [
  "#0f8b8d",
  "#e05d41",
  "#6c9a3f",
  "#7a5c99",
  "#c48a1b",
  "#2670a8",
  "#bd4b73",
  "#4f8f62",
  "#d46f2c",
  "#4d6f88",
  "#8f6b2d",
];

type TooltipState = {
  x: number;
  y: number;
  title: string;
  local?: string;
  native?: string;
  meta: string;
};

type QuizMapProps = {
  clickable?: boolean;
  currentTargetId?: string | null;
  focusFeatureId?: string | null;
  focusRequestNonce?: number;
  forceTinyMarkers?: boolean;
  features: SubdivisionFeature[];
  guessed: Set<string>;
  hintLevel?: number;
  revealed: boolean;
  revealedIds?: Set<string>;
  wrongFlashId?: string | null;
  wrongIds?: Set<string>;
  activeId: string | null;
  scope: Scope;
  onFeatureClick?: (feature: SubdivisionFeature) => void;
  onHover: (id: string | null) => void;
};

type PathDatum = {
  bounds: [[number, number], [number, number]];
  id: string;
  feature: SubdivisionFeature;
  d: string;
  tinyMarker: TinyMarkerDatum | null;
  style: CSSProperties;
};

type TinyMarkerDatum = {
  alwaysVisible: boolean;
  height: number;
  width: number;
  x: number;
  y: number;
};

type TinyMarkerVisibilityItem = {
  tinyMarker: { alwaysVisible: boolean } | null;
};

type HintBox = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type MapShapesProps = {
  activeId: string | null;
  clickable: boolean;
  guessed: Set<string>;
  pathData: PathDatum[];
  revealed: boolean;
  revealedIds: Set<string>;
  wrongIds: Set<string>;
  onClick?: (
    event: MouseEvent<SVGPathElement | SVGCircleElement>,
    feature: SubdivisionFeature,
  ) => void;
  onEnter: (feature: SubdivisionFeature) => void;
  onLeave: () => void;
  onMove: (
    event: MouseEvent<SVGPathElement | SVGCircleElement>,
    feature: SubdivisionFeature,
  ) => void;
};

type TinyMarkersProps = {
  activeId: string | null;
  clickable: boolean;
  guessed: Set<string>;
  markerData: PathDatum[];
  revealed: boolean;
  revealedIds: Set<string>;
  wrongIds: Set<string>;
  zoomScale: number;
  onClick?: (
    event: MouseEvent<SVGPathElement | SVGCircleElement>,
    feature: SubdivisionFeature,
  ) => void;
  onEnter: (feature: SubdivisionFeature) => void;
  onLeave: () => void;
  onMove: (
    event: MouseEvent<SVGPathElement | SVGCircleElement>,
    feature: SubdivisionFeature,
  ) => void;
};

type WrongFlashOverlayProps = {
  item: PathDatum | null;
  zoomScale: number;
};

function featureCollection(features: SubdivisionFeature[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features,
  };
}

function nativeNameText(feature: SubdivisionFeature) {
  return feature.properties.nativeNames
    .filter((nativeName) => nativeName.display !== false)
    .map((nativeName) => nativeName.name)
    .join(" / ");
}

function initialTinyMarkersVisible() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(TINY_MARKERS_KEY) === "1";
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

function tinyScreenSize(
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

function tinyMarkerRadius(
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

function tinyMarkerOpacity(
  size: { height: number; width: number },
  zoomScale: number,
) {
  const maxSide = Math.max(size.width * zoomScale, size.height * zoomScale);
  return maxSide < TINY_PROJECTED_MIN_SIDE ? 0.95 : 0.85;
}

function tinyMarkerForFeature(
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

function hintBoxForFeature(
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

function focusTransformForItem(item: PathDatum) {
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

const MapShapes = memo(function MapShapes({
  activeId,
  clickable,
  guessed,
  pathData,
  revealed,
  revealedIds,
  wrongIds,
  onClick,
  onEnter,
  onLeave,
  onMove,
}: MapShapesProps) {
  return (
    <>
      {pathData.map((item) => {
        const isFound = guessed.has(item.id);
        const isWrong = wrongIds.has(item.id);
        const isRevealed = revealedIds.has(item.id);
        const isActive = activeId === item.id;
        const className = [
          "subdivision",
          clickable ? "is-clickable" : "",
          isFound
            ? "is-found"
            : isWrong
              ? "is-wrong"
              : revealed || isRevealed
                ? "is-missed"
                : "is-pending",
          isActive ? "is-active" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <path
            key={item.id}
            className={className}
            d={item.d}
            style={item.style}
            onMouseEnter={() => onEnter(item.feature)}
            onMouseMove={(event) => onMove(event, item.feature)}
            onMouseLeave={onLeave}
            onClick={(event) => onClick?.(event, item.feature)}
          />
        );
      })}
    </>
  );
});

const TinyMarkers = memo(function TinyMarkers({
  activeId,
  clickable,
  guessed,
  markerData,
  revealed,
  revealedIds,
  wrongIds,
  zoomScale,
  onClick,
  onEnter,
  onLeave,
  onMove,
}: TinyMarkersProps) {
  return (
    <>
      {markerData.map((item) => {
        if (!item.tinyMarker) {
          return null;
        }

        if (
          !item.tinyMarker.alwaysVisible &&
          !tinyScreenSize(item.tinyMarker, zoomScale)
        ) {
          return null;
        }

        const radius = tinyMarkerRadius(item.tinyMarker, zoomScale);
        const markerOpacity = tinyMarkerOpacity(item.tinyMarker, zoomScale);
        const isFound = guessed.has(item.id);
        const isWrong = wrongIds.has(item.id);
        const isRevealed = revealedIds.has(item.id);
        const isActive = activeId === item.id;
        const className = [
          "tiny-marker",
          clickable ? "is-clickable" : "",
          isFound
            ? "is-found"
            : isWrong
              ? "is-wrong"
              : revealed || isRevealed
                ? "is-missed"
                : "is-pending",
          isActive ? "is-active" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <circle
            key={item.id}
            className={className}
            cx={item.tinyMarker.x}
            cy={item.tinyMarker.y}
            r={radius}
            style={
              {
                ...item.style,
                "--marker-opacity": markerOpacity,
              } as CSSProperties
            }
            onMouseEnter={() => onEnter(item.feature)}
            onMouseMove={(event) => onMove(event, item.feature)}
            onMouseLeave={onLeave}
            onClick={(event) => onClick?.(event, item.feature)}
          />
        );
      })}
    </>
  );
});

const WrongFlashOverlay = memo(function WrongFlashOverlay({
  item,
  zoomScale,
}: WrongFlashOverlayProps) {
  if (!item) {
    return null;
  }

  const radius = item.tinyMarker
    ? Math.max(tinyMarkerRadius(item.tinyMarker, zoomScale), 4 / zoomScale)
    : null;

  return (
    <g className="wrong-flash-overlay" pointerEvents="none">
      <path className="wrong-flash-shape" d={item.d} />
      {item.tinyMarker && radius ? (
        <circle
          className="wrong-flash-marker"
          cx={item.tinyMarker.x}
          cy={item.tinyMarker.y}
          r={radius}
        />
      ) : null}
    </g>
  );
});

function QuizMap({
  clickable = false,
  currentTargetId = null,
  focusFeatureId = null,
  focusRequestNonce = 0,
  features,
  forceTinyMarkers = false,
  guessed,
  hintLevel = 0,
  revealed,
  revealedIds = new Set<string>(),
  wrongFlashId = null,
  wrongIds = new Set<string>(),
  activeId,
  scope,
  onFeatureClick,
  onHover,
}: QuizMapProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const mapGroupRef = useRef<SVGGElement | null>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const zoomScaleRef = useRef(1);
  const zoomFrameRef = useRef<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [tinyMarkersVisible, setTinyMarkersVisible] = useState(
    initialTinyMarkersVisible,
  );

  const path = useMemo(() => {
    const projection =
      scope.kind === "world" ? geoEqualEarth() : geoMercator();

    projection.fitExtent(
      [
        [18, 18],
        [WIDTH - 18, HEIGHT - 18],
      ],
      featureCollection(features),
    );

    return geoPath(projection);
  }, [features, scope.kind]);

  const pathData = useMemo(
    () =>
      features
        .map((feature) => {
          const d = path(feature) || "";
          const bounds = path.bounds(feature);
          return {
            bounds,
            id: feature.properties.id,
            feature,
            d,
            tinyMarker: tinyMarkerForFeature(feature, path, scope),
            style: {
              "--found-fill": MAP_COLORS[feature.properties.colorIndex],
            } as CSSProperties,
          };
        })
        .filter(
          (item) =>
            item.d &&
            item.bounds.flat().every((value) => Number.isFinite(value)),
        ),
    [features, path, scope],
  );
  const tinyMarkerData = useMemo(
    () => pathData.filter((item) => item.tinyMarker),
    [pathData],
  );
  const optionalTinyMarkerData = useMemo(
    () => tinyMarkerData.filter((item) => !item.tinyMarker?.alwaysVisible),
    [tinyMarkerData],
  );
  const requiredTinyMarkerData = useMemo(
    () => tinyMarkerData.filter((item) => item.tinyMarker?.alwaysVisible),
    [tinyMarkerData],
  );
  const hasOptionalTinyMarkers = optionalTinyMarkerData.length > 0;
  const effectiveTinyMarkersVisible = tinyMarkersVisible || forceTinyMarkers;
  const visibleTinyMarkerData = visibleTinyMarkerItems(
    tinyMarkerData,
    effectiveTinyMarkersVisible,
  );
  const tinyMarkerToggleLabel = hasOptionalTinyMarkers
    ? forceTinyMarkers
      ? "Tiny places are clickable in Find mode"
      : tinyMarkersVisible
      ? "Hide tiny places"
      : "Show tiny places"
    : requiredTinyMarkerData.length
      ? "Required tiny-place markers are always shown"
      : "No tiny places in this view";
  const hintBox = useMemo(() => {
    const target = currentTargetId
      ? features.find((feature) => feature.properties.id === currentTargetId)
      : undefined;

    return target ? hintBoxForFeature(target, features, path, hintLevel) : null;
  }, [currentTargetId, features, hintLevel, path]);
  const wrongFlashItem = useMemo(
    () => pathData.find((item) => item.id === wrongFlashId) || null,
    [pathData, wrongFlashId],
  );
  const focusItem = useMemo(
    () => pathData.find((item) => item.id === focusFeatureId) || null,
    [focusFeatureId, pathData],
  );

  const scopeResetKey = `${scope.kind}:${scope.value}:${features.length}`;

  useEffect(() => {
    window.localStorage.setItem(
      TINY_MARKERS_KEY,
      tinyMarkersVisible ? "1" : "0",
    );
  }, [tinyMarkersVisible]);

  useEffect(() => {
    if (!svgRef.current) {
      return undefined;
    }

    const svg = select(svgRef.current);
    const updateZoomScale = (scale: number) => {
      zoomScaleRef.current = scale;
      if (zoomFrameRef.current !== null) {
        return;
      }

      zoomFrameRef.current = window.requestAnimationFrame(() => {
        zoomFrameRef.current = null;
        setZoomScale(zoomScaleRef.current);
      });
    };
    const mapZoom = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, MAP_MAX_ZOOM])
      .translateExtent([
        [-WIDTH, -HEIGHT],
        [WIDTH * 2, HEIGHT * 2],
      ])
      .on("zoom", (event) => {
        mapGroupRef.current?.setAttribute("transform", event.transform.toString());
        updateZoomScale(event.transform.k);
      });

    svg.call(mapZoom).on("dblclick.zoom", null);
    zoomRef.current = mapZoom;

    return () => {
      svg.on(".zoom", null);
      if (zoomFrameRef.current !== null) {
        window.cancelAnimationFrame(zoomFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!svgRef.current || !zoomRef.current) {
      return;
    }

    zoomScaleRef.current = 1;
    setZoomScale(1);
    select(svgRef.current)
      .transition()
      .duration(260)
      .call(zoomRef.current.transform, zoomIdentity);
  }, [scopeResetKey]);

  useEffect(() => {
    if (!focusItem || !focusRequestNonce || !svgRef.current || !zoomRef.current) {
      return;
    }

    select(svgRef.current)
      .transition()
      .duration(520)
      .call(zoomRef.current.transform, focusTransformForItem(focusItem));
  }, [focusItem, focusRequestNonce]);

  function zoomBy(factor: number) {
    if (!svgRef.current || !zoomRef.current) {
      return;
    }
    select(svgRef.current)
      .transition()
      .duration(180)
      .call(zoomRef.current.scaleBy, factor);
  }

  function resetZoom() {
    if (!svgRef.current || !zoomRef.current) {
      return;
    }
    select(svgRef.current)
      .transition()
      .duration(220)
      .call(zoomRef.current.transform, zoomIdentity);
  }

  const showTooltip = useCallback(
    (
      event: MouseEvent<SVGPathElement | SVGCircleElement>,
      feature: SubdivisionFeature,
      forceShow = false,
    ) => {
      const isFound = guessed.has(feature.properties.id);
      const canShowName =
        isFound ||
        revealed ||
        revealedIds.has(feature.properties.id) ||
        wrongIds.has(feature.properties.id);
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      if (!canShowName && !forceShow) {
        setTooltip(null);
        return;
      }

      const title = feature.properties.name;
      const meta = `${feature.properties.typeEn} in ${feature.properties.country}`;

      setTooltip({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        title,
        local: feature.properties.localNames.join(" / "),
        native: nativeNameText(feature),
        meta,
      });
    },
    [guessed, revealed, revealedIds, wrongIds],
  );

  const clickFeature = useCallback(
    (
      event: MouseEvent<SVGPathElement | SVGCircleElement>,
      feature: SubdivisionFeature,
    ) => {
      onFeatureClick?.(feature);
      if (clickable) {
        showTooltip(event, feature, true);
      }
    },
    [clickable, onFeatureClick, showTooltip],
  );

  const enterFeature = useCallback(
    (feature: SubdivisionFeature) => {
      onHover(feature.properties.id);
    },
    [onHover],
  );

  const leaveFeature = useCallback(() => {
    setTooltip(null);
    onHover(null);
  }, [onHover]);

  return (
    <div className="map-shell">
      <svg
        ref={svgRef}
        className="quiz-map"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Interactive subdivision quiz map"
      >
        <rect className="map-water" width={WIDTH} height={HEIGHT} />
        <g ref={mapGroupRef}>
          <MapShapes
            activeId={activeId}
            clickable={clickable}
            guessed={guessed}
            pathData={pathData}
            revealed={revealed}
            revealedIds={revealedIds}
            wrongIds={wrongIds}
            onClick={clickFeature}
            onEnter={enterFeature}
            onLeave={leaveFeature}
            onMove={showTooltip}
          />
          {hintBox ? (
            <rect
              className="hint-box"
              x={hintBox.x}
              y={hintBox.y}
              width={hintBox.width}
              height={hintBox.height}
            />
          ) : null}
          {visibleTinyMarkerData.length ? (
            <TinyMarkers
              activeId={activeId}
              clickable={clickable}
              guessed={guessed}
              markerData={visibleTinyMarkerData}
              revealed={revealed}
              revealedIds={revealedIds}
              wrongIds={wrongIds}
              zoomScale={zoomScale}
              onClick={clickFeature}
              onEnter={enterFeature}
              onLeave={leaveFeature}
              onMove={showTooltip}
            />
          ) : null}
          <WrongFlashOverlay item={wrongFlashItem} zoomScale={zoomScale} />
        </g>
      </svg>

      <div className="zoom-controls" aria-label="Map zoom controls">
        <button
          type="button"
          title="Zoom in"
          aria-label="Zoom in"
          onClick={() => zoomBy(1.65)}
        >
          <Plus size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          title="Zoom out"
          aria-label="Zoom out"
          onClick={() => zoomBy(0.6)}
        >
          <Minus size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          title="Reset map"
          aria-label="Reset map"
          onClick={resetZoom}
        >
          <Maximize2 size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={
            hasOptionalTinyMarkers && effectiveTinyMarkersVisible
              ? "detail-toggle is-active"
              : "detail-toggle"
          }
          title={tinyMarkerToggleLabel}
          aria-label={tinyMarkerToggleLabel}
          aria-pressed={hasOptionalTinyMarkers && effectiveTinyMarkersVisible}
          disabled={!hasOptionalTinyMarkers || forceTinyMarkers}
          onClick={() => setTinyMarkersVisible((current) => !current)}
        >
          <MapPin size={17} aria-hidden="true" />
        </button>
      </div>

      {tooltip ? (
        <div
          key={`${tooltip.title}:${tooltip.meta}`}
          className="map-tooltip"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
          }}
        >
          <strong>{tooltip.title}</strong>
          {tooltip.local ? <span className="tooltip-local">{tooltip.local}</span> : null}
          {tooltip.native ? <span className="tooltip-native">{tooltip.native}</span> : null}
          <span>{tooltip.meta}</span>
        </div>
      ) : null}
    </div>
  );
}

export default memo(QuizMap);
