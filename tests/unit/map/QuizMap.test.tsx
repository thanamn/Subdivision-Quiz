// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import QuizMap from "../../../src/map/QuizMap";
import { MAP_MAX_ZOOM } from "../../../src/map/mapConstants";
import type { Scope, SubdivisionFeature } from "../../../src/domain/types";

const countryScope: Scope = { kind: "country", value: "TST" };

function makeFeature(
  id: string,
  name: string,
  geometry: SubdivisionFeature["geometry"],
  colorIndex = 0,
): SubdivisionFeature {
  return {
    type: "Feature",
    id,
    geometry,
    properties: {
      adm1Code: id,
      aliases: [name],
      colorIndex,
      country: "Testland",
      countryCode: "TST",
      id,
      localNames: [`${name} local`],
      name,
      nativeNames: [{ lang: "ts", name: `${name} native` }],
      region: "Test Region",
      subregion: "Test Subregion",
      type: "Province",
      typeEn: "Province",
    },
  };
}

function square(
  left: number,
  bottom: number,
  size = 1,
): SubdivisionFeature["geometry"] {
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

const alpha = makeFeature("alpha", "Alpha", square(0, 0), 0);
const beta = makeFeature("beta", "Beta", square(2, 0), 1);
const gamma = makeFeature("gamma", "Gamma", square(4, 0), 2);
const delta = makeFeature("delta", "Delta", square(6, 0), 3);
const collapsedTiny = makeFeature(
  "tiny",
  "Tiny",
  { type: "Point", coordinates: [8, 0.5] },
  4,
);
const optionalTiny = makeFeature(
  "optional-tiny",
  "Optional Tiny",
  {
    type: "Polygon",
    coordinates: [
      [
        [10, 0],
        [10, 0.01],
        [10.01, 0.01],
        [10.01, 0],
        [10, 0],
      ],
    ],
  },
  5,
);

function renderMap(
  props: Partial<ComponentProps<typeof QuizMap>> = {},
) {
  const onHover = props.onHover || vi.fn();

  return render(
    <QuizMap
      activeId={null}
      features={[alpha, beta, gamma, delta]}
      guessed={new Set()}
      revealed={false}
      scope={countryScope}
      onHover={onHover}
      {...props}
    />,
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("QuizMap", () => {
  it("renders SVG map paths and applies visible state classes", () => {
    renderMap({
      activeId: "beta",
      guessed: new Set(["alpha"]),
      revealedIds: new Set(["gamma"]),
      wrongIds: new Set(["beta"]),
    });

    expect(
      screen.getByRole("img", { name: "Interactive subdivision quiz map" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("map-region-alpha")).toHaveClass(
      "subdivision",
      "is-found",
    );
    expect(screen.getByTestId("map-region-beta")).toHaveClass(
      "is-wrong",
      "is-active",
    );
    expect(screen.getByTestId("map-region-gamma")).toHaveClass("is-missed");
    expect(screen.getByTestId("map-region-delta")).toHaveClass("is-pending");
  });

  it("renders required and forced tiny markers", () => {
    const { rerender } = renderMap({
      features: [alpha, collapsedTiny, optionalTiny],
      forceTinyMarkers: false,
    });

    expect(screen.getByTestId("tiny-marker-tiny")).toBeInTheDocument();
    expect(screen.queryByTestId("tiny-marker-optional-tiny")).not.toBeInTheDocument();

    rerender(
      <QuizMap
        activeId={null}
        features={[alpha, collapsedTiny, optionalTiny]}
        forceTinyMarkers
        guessed={new Set()}
        revealed={false}
        scope={countryScope}
        onHover={vi.fn()}
      />,
    );

    expect(screen.getByTestId("tiny-marker-tiny")).toBeInTheDocument();
    expect(screen.getByTestId("tiny-marker-optional-tiny")).toBeInTheDocument();
  });

  it("draws country outlines only for the full reveal state", () => {
    const { unmount } = renderMap({
      revealedIds: new Set(["alpha"]),
    });

    expect(screen.queryByTestId("country-outline-line")).not.toBeInTheDocument();

    unmount();

    renderMap({
      revealed: true,
    });

    expect(screen.getByTestId("country-outline-halo")).toBeInTheDocument();
    expect(screen.getByTestId("country-outline-line")).toBeInTheDocument();
  });

  it("draws a transient country-completion glow when requested", () => {
    renderMap({
      completedCountryGlowCodes: ["TST"],
      completedCountryGlowRun: 1,
    });

    expect(screen.getByTestId("country-completion-glow-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("country-completion-glow-TST")).toBeInTheDocument();
  });

  it("skips the expensive country outline in world reveal state", () => {
    renderMap({
      revealed: true,
      scope: { kind: "world", value: "world" },
    });

    expect(screen.queryByTestId("country-outline-line")).not.toBeInTheDocument();
  });

  it("keeps helper dots above the country outline", () => {
    renderMap({
      features: [alpha, collapsedTiny],
      forceTinyMarkers: true,
      revealed: true,
    });

    const outline = screen.getByTestId("country-outline-line");
    const marker = screen.getByTestId("tiny-marker-tiny");

    expect(
      outline.compareDocumentPosition(marker) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("makes tiny markers clickable when the map is clickable", () => {
    const onFeatureClick = vi.fn();
    renderMap({
      clickable: true,
      features: [alpha, collapsedTiny],
      forceTinyMarkers: true,
      onFeatureClick,
    });

    fireEvent.click(screen.getByTestId("tiny-marker-tiny"));

    expect(onFeatureClick).toHaveBeenCalledWith(collapsedTiny);
  });

  it("does not reveal pending tooltips, but shows known region details", () => {
    const { rerender } = renderMap({ features: [alpha] });
    const region = screen.getByTestId("map-region-alpha");

    fireEvent.mouseMove(region, { clientX: 20, clientY: 30 });
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();

    rerender(
      <QuizMap
        activeId={null}
        features={[alpha]}
        guessed={new Set(["alpha"])}
        revealed={false}
        scope={countryScope}
        onHover={vi.fn()}
      />,
    );

    fireEvent.mouseMove(screen.getByTestId("map-region-alpha"), {
      clientX: 20,
      clientY: 30,
    });

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Alpha local")).toBeInTheDocument();
    expect(screen.getByText("Alpha native")).toBeInTheDocument();
    expect(screen.getByText("Province in Testland")).toBeInTheDocument();
  });

  it("renders hint boxes for the current target and exposes zoom controls", () => {
    renderMap({
      currentTargetId: "alpha",
      hintLevel: 1,
    });

    expect(screen.getByTestId("map-hint-box")).toBeInTheDocument();
    expect(() => fireEvent.click(screen.getByRole("button", { name: "Zoom in" }))).not.toThrow();
    expect(() => fireEvent.click(screen.getByRole("button", { name: "Zoom out" }))).not.toThrow();
    expect(() => fireEvent.click(screen.getByRole("button", { name: "Reset map" }))).not.toThrow();
  });

  it("keeps wheel gestures from scrolling the page at zoom limits", () => {
    renderMap();

    const map = screen.getByRole("img", {
      name: "Interactive subdivision quiz map",
    });
    const wheelEvent = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: -120,
    });

    expect(map.dispatchEvent(wheelEvent)).toBe(false);
    expect(wheelEvent.defaultPrevented).toBe(true);
  });

  it("allows deeper manual zoom levels", () => {
    expect(MAP_MAX_ZOOM).toBeGreaterThan(500);
  });
});
