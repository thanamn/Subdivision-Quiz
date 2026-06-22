import { memo } from "react";
import type { CSSProperties } from "react";
import {
  tinyMarkerOpacity,
  tinyMarkerRadius,
  tinyScreenSize,
} from "./mapGeometry";
import type {
  MapFeaturePointerHandler,
  PathDatum,
} from "./mapTypes";

type MapShapesProps = {
  activeId: string | null;
  clickable: boolean;
  guessed: Set<string>;
  pathData: PathDatum[];
  revealed: boolean;
  revealedIds: Set<string>;
  wrongIds: Set<string>;
  onClick?: MapFeaturePointerHandler;
  onEnter: (feature: PathDatum["feature"]) => void;
  onLeave: () => void;
  onMove: MapFeaturePointerHandler;
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
  onClick?: MapFeaturePointerHandler;
  onEnter: (feature: PathDatum["feature"]) => void;
  onLeave: () => void;
  onMove: MapFeaturePointerHandler;
};

type WrongFlashOverlayProps = {
  item: PathDatum | null;
  zoomScale: number;
};

export const MapShapes = memo(function MapShapes({
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
            data-testid={`map-region-${item.id}`}
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

export const TinyMarkers = memo(function TinyMarkers({
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
            data-testid={`tiny-marker-${item.id}`}
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

export const WrongFlashOverlay = memo(function WrongFlashOverlay({
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
