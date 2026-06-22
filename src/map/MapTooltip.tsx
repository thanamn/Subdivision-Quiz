import type { TooltipState } from "./mapTypes";

export function MapTooltip({ tooltip }: { tooltip: TooltipState | null }) {
  if (!tooltip) {
    return null;
  }

  return (
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
  );
}
