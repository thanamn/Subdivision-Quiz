import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { geoEqualEarth, geoMercator, geoPath } from "d3-geo";
import { select } from "d3-selection";
import "d3-transition";
import { zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import type { SubdivisionFeature } from "../domain/types";
import { MapControls } from "./MapControls";
import { MapShapes, TinyMarkers, WrongFlashOverlay } from "./MapShapes";
import { MapTooltip } from "./MapTooltip";
import {
  HEIGHT,
  MAP_COLORS,
  MAP_MAX_ZOOM,
  TINY_MARKERS_KEY,
  WIDTH,
} from "./mapConstants";
import {
  countryOutlinePathForFeatures,
  featureCollection,
  focusTransformForItem,
  hintBoxForFeature,
  nativeNameText,
  tinyMarkerForFeature,
  visibleTinyMarkerItems,
} from "./mapGeometry";
import type { PathDatum, QuizMapProps, TooltipState } from "./mapTypes";

export { visibleTinyMarkerItems } from "./mapGeometry";

function initialTinyMarkersVisible() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(TINY_MARKERS_KEY) === "1";
}

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

  const pathData = useMemo<PathDatum[]>(
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
  const isMultiCountryMap = useMemo(
    () => new Set(features.map((feature) => feature.properties.countryCode)).size > 1,
    [features],
  );
  const tinyMarkerToggleLabel = hasOptionalTinyMarkers
    ? forceTinyMarkers
      ? "Small subdivisions use clickable dots in Click mode"
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
  const shouldShowCountryOutline = revealed && scope.kind !== "world";
  const countryOutlinePath = useMemo(
    () =>
      shouldShowCountryOutline
        ? countryOutlinePathForFeatures(features, path)
        : "",
    [features, path, shouldShowCountryOutline],
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
    <div className={isMultiCountryMap ? "map-shell is-multi-country" : "map-shell"}>
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
          {countryOutlinePath ? (
            <g className="country-outline-layer" aria-hidden="true">
              <path
                data-testid="country-outline-halo"
                className="country-outline-halo"
                d={countryOutlinePath}
              />
              <path
                data-testid="country-outline-line"
                className="country-outline-line"
                d={countryOutlinePath}
              />
            </g>
          ) : null}
          {hintBox ? (
            <rect
              data-testid="map-hint-box"
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

      <MapControls
        effectiveTinyMarkersVisible={effectiveTinyMarkersVisible}
        forceTinyMarkers={forceTinyMarkers}
        hasOptionalTinyMarkers={hasOptionalTinyMarkers}
        resetZoom={resetZoom}
        setTinyMarkersVisible={setTinyMarkersVisible}
        tinyMarkerToggleLabel={tinyMarkerToggleLabel}
        zoomBy={zoomBy}
      />

      <MapTooltip tooltip={tooltip} />
    </div>
  );
}

export default memo(QuizMap);
