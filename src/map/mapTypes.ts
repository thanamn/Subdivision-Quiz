import type { CSSProperties, MouseEvent } from "react";
import type { Scope, SubdivisionFeature } from "../domain/types";

export type TooltipState = {
  x: number;
  y: number;
  title: string;
  local?: string;
  native?: string;
  meta: string;
};

export type QuizMapProps = {
  clickable?: boolean;
  completedCountryGlowCodes?: string[];
  completedCountryGlowRun?: number;
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

export type PathDatum = {
  bounds: [[number, number], [number, number]];
  id: string;
  feature: SubdivisionFeature;
  d: string;
  tinyMarker: TinyMarkerDatum | null;
  style: CSSProperties;
};

export type TinyMarkerDatum = {
  alwaysVisible: boolean;
  height: number;
  width: number;
  x: number;
  y: number;
};

export type TinyMarkerVisibilityItem = {
  tinyMarker: { alwaysVisible: boolean } | null;
};

export type HintBox = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type MapFeaturePointerHandler = (
  event: MouseEvent<SVGPathElement | SVGCircleElement>,
  feature: SubdivisionFeature,
) => void;
