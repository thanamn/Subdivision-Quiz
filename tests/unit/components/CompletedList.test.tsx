// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CompletedList } from "../../../src/components/CompletedList";
import type { SubdivisionFeature } from "../../../src/domain/types";

function makeFeature(id: string, name: string): SubdivisionFeature {
  return {
    type: "Feature",
    id,
    geometry: {
      type: "Point",
      coordinates: [0, 0],
    },
    properties: {
      adm1Code: id,
      aliases: [name],
      colorIndex: 0,
      country: "Testland",
      countryCode: "TST",
      id,
      localNames: [],
      name,
      nativeNames: [],
      region: "Test Region",
      subregion: "Test Subregion",
      type: "Province",
      typeEn: "Province",
    },
  };
}

describe("CompletedList", () => {
  it("renders bounded missing previews with the full missing count", () => {
    render(
      <CompletedList
        complete={false}
        completedReviewCount={0}
        completedReviewPreviewFeatures={[]}
        gaveUp
        mediaLookup={{}}
        missingCount={4560}
        missingPreviewFeatures={[makeFeature("alpha", "Alpha")]}
        quizMode="find"
        setActiveId={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Missing" })).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Showing first 1 of 4,560.")).toBeInTheDocument();
    expect(
      screen.getByText("Pick a region or country to review a shorter missing list."),
    ).toBeInTheDocument();
  });
});
