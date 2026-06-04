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
const TINY_MARKERS_KEY = "subdivision-quiz:tiny-markers";
const TINY_GEOGRAPHIC_AREA = 0.0000015;
const TINY_PROJECTED_MAX_SIDE = 24;
const TINY_PROJECTED_MAX_AREA = 130;
const TINY_PROJECTED_MIN_SIDE = 5;
const TINY_MARKER_MAX_SCREEN_RADIUS = 8;
const TINY_MARKER_MIN_SCREEN_RADIUS = 4;
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
  features: SubdivisionFeature[];
  guessed: Set<string>;
  revealed: boolean;
  activeId: string | null;
  scope: Scope;
  onHover: (id: string | null) => void;
};

type PathDatum = {
  id: string;
  feature: SubdivisionFeature;
  d: string;
  tinyMarker: TinyMarkerDatum | null;
  style: CSSProperties;
};

type TinyMarkerDatum = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type MapShapesProps = {
  activeId: string | null;
  guessed: Set<string>;
  pathData: PathDatum[];
  revealed: boolean;
  onEnter: (feature: SubdivisionFeature) => void;
  onLeave: () => void;
  onMove: (
    event: MouseEvent<SVGPathElement | SVGCircleElement>,
    feature: SubdivisionFeature,
  ) => void;
};

type TinyMarkersProps = {
  activeId: string | null;
  guessed: Set<string>;
  markerData: PathDatum[];
  revealed: boolean;
  zoomScale: number;
  onEnter: (feature: SubdivisionFeature) => void;
  onLeave: () => void;
  onMove: (
    event: MouseEvent<SVGPathElement | SVGCircleElement>,
    feature: SubdivisionFeature,
  ) => void;
};

function featureCollection(features: SubdivisionFeature[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features,
  };
}

function initialTinyMarkersVisible() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(TINY_MARKERS_KEY) === "1";
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

  const geographicallyTiny = geoArea(feature) < TINY_GEOGRAPHIC_AREA;
  const projectedTiny =
    scope.kind === "country" && tinyProjectedSize(bounds);

  return projectedTiny || (scope.kind !== "country" && geographicallyTiny)
    ? {
        height,
        width,
        x: centroid[0],
        y: centroid[1],
      }
    : null;
}

const MapShapes = memo(function MapShapes({
  activeId,
  guessed,
  pathData,
  revealed,
  onEnter,
  onLeave,
  onMove,
}: MapShapesProps) {
  return (
    <>
      {pathData.map((item) => {
        const isFound = guessed.has(item.id);
        const isActive = activeId === item.id;
        const className = [
          "subdivision",
          isFound ? "is-found" : revealed ? "is-missed" : "is-pending",
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
          />
        );
      })}
    </>
  );
});

const TinyMarkers = memo(function TinyMarkers({
  activeId,
  guessed,
  markerData,
  revealed,
  zoomScale,
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

        if (!tinyScreenSize(item.tinyMarker, zoomScale)) {
          return null;
        }

        const radius = tinyMarkerRadius(item.tinyMarker, zoomScale);
        const markerOpacity = tinyMarkerOpacity(item.tinyMarker, zoomScale);
        const isFound = guessed.has(item.id);
        const isActive = activeId === item.id;
        const className = [
          "tiny-marker",
          isFound ? "is-found" : revealed ? "is-missed" : "is-pending",
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
          />
        );
      })}
    </>
  );
});

function QuizMap({
  features,
  guessed,
  revealed,
  activeId,
  scope,
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
        .map((feature) => ({
          id: feature.properties.id,
          feature,
          d: path(feature) || "",
          tinyMarker: tinyMarkerForFeature(feature, path, scope),
          style: {
            "--found-fill": MAP_COLORS[feature.properties.colorIndex],
          } as CSSProperties,
        }))
        .filter((item) => item.d),
    [features, path, scope],
  );
  const tinyMarkerData = useMemo(
    () => pathData.filter((item) => item.tinyMarker),
    [pathData],
  );
  const hasTinyMarkers = tinyMarkerData.length > 0;
  const tinyMarkerToggleLabel = hasTinyMarkers
    ? tinyMarkersVisible
      ? "Hide tiny places"
      : "Show tiny places"
    : "No tiny places in this view";

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
    ) => {
      const isFound = guessed.has(feature.properties.id);
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      if (!isFound && !revealed) {
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
        native: feature.properties.nativeNames.map((nativeName) => nativeName.name).join(" / "),
        meta,
      });
    },
    [guessed, revealed],
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
            guessed={guessed}
            pathData={pathData}
            revealed={revealed}
            onEnter={enterFeature}
            onLeave={leaveFeature}
            onMove={showTooltip}
          />
          {tinyMarkersVisible ? (
            <TinyMarkers
              activeId={activeId}
              guessed={guessed}
              markerData={tinyMarkerData}
              revealed={revealed}
              zoomScale={zoomScale}
              onEnter={enterFeature}
              onLeave={leaveFeature}
              onMove={showTooltip}
            />
          ) : null}
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
            hasTinyMarkers && tinyMarkersVisible
              ? "detail-toggle is-active"
              : "detail-toggle"
          }
          title={tinyMarkerToggleLabel}
          aria-label={tinyMarkerToggleLabel}
          aria-pressed={hasTinyMarkers && tinyMarkersVisible}
          disabled={!hasTinyMarkers}
          onClick={() => setTinyMarkersVisible((current) => !current)}
        >
          <MapPin size={17} aria-hidden="true" />
        </button>
      </div>

      {tooltip ? (
        <div
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
