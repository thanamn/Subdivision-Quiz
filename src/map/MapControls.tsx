import { MapPin, Maximize2, Minus, Plus } from "lucide-react";

export function MapControls({
  effectiveTinyMarkersVisible,
  forceTinyMarkers,
  hasOptionalTinyMarkers,
  resetZoom,
  setTinyMarkersVisible,
  tinyMarkerToggleLabel,
  zoomBy,
}: {
  effectiveTinyMarkersVisible: boolean;
  forceTinyMarkers: boolean;
  hasOptionalTinyMarkers: boolean;
  resetZoom: () => void;
  setTinyMarkersVisible: (updater: (current: boolean) => boolean) => void;
  tinyMarkerToggleLabel: string;
  zoomBy: (factor: number) => void;
}) {
  return (
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
  );
}
