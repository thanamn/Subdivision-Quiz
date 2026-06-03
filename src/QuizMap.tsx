import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { geoEqualEarth, geoMercator, geoPath } from "d3-geo";
import { select } from "d3-selection";
import "d3-transition";
import { zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import { Maximize2, Minus, Plus } from "lucide-react";
import type { FeatureCollection } from "geojson";
import type { Scope, SubdivisionFeature } from "./types";

const WIDTH = 1000;
const HEIGHT = 620;
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
  style: CSSProperties;
};

type MapShapesProps = {
  activeId: string | null;
  guessed: Set<string>;
  pathData: PathDatum[];
  revealed: boolean;
  onEnter: (feature: SubdivisionFeature) => void;
  onLeave: () => void;
  onMove: (event: MouseEvent<SVGPathElement>, feature: SubdivisionFeature) => void;
};

function featureCollection(features: SubdivisionFeature[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features,
  };
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
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

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
          style: {
            "--found-fill": MAP_COLORS[feature.properties.colorIndex],
          } as CSSProperties,
        }))
        .filter((item) => item.d),
    [features, path],
  );

  const scopeResetKey = `${scope.kind}:${scope.value}:${features.length}`;

  useEffect(() => {
    if (!svgRef.current) {
      return undefined;
    }

    const svg = select(svgRef.current);
    const mapZoom = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 18])
      .translateExtent([
        [-WIDTH, -HEIGHT],
        [WIDTH * 2, HEIGHT * 2],
      ])
      .on("zoom", (event) => {
        mapGroupRef.current?.setAttribute("transform", event.transform.toString());
      });

    svg.call(mapZoom).on("dblclick.zoom", null);
    zoomRef.current = mapZoom;

    return () => {
      svg.on(".zoom", null);
    };
  }, []);

  useEffect(() => {
    if (!svgRef.current || !zoomRef.current) {
      return;
    }

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
    (event: MouseEvent<SVGPathElement>, feature: SubdivisionFeature) => {
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
        </g>
      </svg>

      <div className="zoom-controls" aria-label="Map zoom controls">
        <button type="button" title="Zoom in" onClick={() => zoomBy(1.35)}>
          <Plus size={17} aria-hidden="true" />
        </button>
        <button type="button" title="Zoom out" onClick={() => zoomBy(0.75)}>
          <Minus size={17} aria-hidden="true" />
        </button>
        <button type="button" title="Reset map" onClick={resetZoom}>
          <Maximize2 size={17} aria-hidden="true" />
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
