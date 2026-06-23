// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { StrictMode } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import topology from "../../public/data/admin1.topo.json";
import countryRegions from "../../public/data/country-regions.json";
import subdivisionMedia from "../../public/data/subdivision-media.json";
import App from "../../src/app/App";
import { loadAdmin1Topology } from "../../src/geo/topology";
import type { CountryRegionLookup } from "../../src/geo/topologyTypes";
import type {
  SubdivisionFeature,
  SubdivisionMediaData,
  SubdivisionMediaLookup,
} from "../../src/domain/types";

type MockQuizMapProps = {
  activeId: string | null;
  clickable?: boolean;
  currentTargetId?: string | null;
  features: SubdivisionFeature[];
  guessed: Set<string>;
  hintLevel?: number;
  onFeatureClick?: (feature: SubdivisionFeature) => void;
  revealed?: boolean;
  revealedIds?: Set<string>;
  wrongIds?: Set<string>;
};

vi.mock("../../src/map/QuizMap", () => ({
  default: function MockQuizMap({
    activeId,
    clickable = false,
    currentTargetId = null,
    features,
    guessed,
    hintLevel = 0,
    onFeatureClick,
    revealed = false,
    revealedIds = new Set<string>(),
    wrongIds = new Set<string>(),
  }: MockQuizMapProps) {
    const renderButtons = clickable || features.length <= 200;

    return (
      <div
        data-testid="quiz-map"
        data-active-id={activeId || ""}
        data-current-target-id={currentTargetId || ""}
        data-feature-count={features.length}
        data-hint-level={hintLevel}
      >
        {renderButtons
          ? features.map((feature) => {
              const id = feature.properties.id;
              const className = [
                guessed.has(id) ? "is-found" : "",
                wrongIds.has(id) ? "is-wrong" : "",
                revealed || revealedIds.has(id) ? "is-revealed" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button
                  key={id}
                  type="button"
                  className={className}
                  data-testid={`mock-map-feature-${id}`}
                  onClick={() => onFeatureClick?.(feature)}
                >
                  {feature.properties.name}
                </button>
              );
            })
          : null}
      </div>
    );
  },
}));

const allFeatures = loadAdmin1Topology(
  topology,
  countryRegions as CountryRegionLookup,
);
const mediaLookup = (subdivisionMedia as SubdivisionMediaData).media || {};

const QUIZ_MODE_KEY = "subdivision-quiz:quiz-mode";
const HELP_CARD_KEY = "subdivision-quiz:help-dismissed:v3";

function featuresFor(countryCode: string) {
  return allFeatures.filter(
    (feature) => feature.properties.countryCode === countryCode,
  );
}

function responseFor(data: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => structuredClone(data),
  } as Response;
}

function installFetchMock(lookup: SubdivisionMediaLookup = mediaLookup) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("admin1.topo.json")) {
      return responseFor(topology);
    }

    if (url.includes("country-regions.json")) {
      return responseFor(countryRegions);
    }

    if (url.includes("subdivision-media.json")) {
      return responseFor({ media: lookup });
    }

    if (url.startsWith("https://www.wikidata.org/")) {
      return responseFor({ entities: {} });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function deferredResponse(data: unknown) {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((innerResolve) => {
    resolve = innerResolve;
  });

  return {
    promise,
    resolve: () => resolve(responseFor(data)),
  };
}

function metricValue(label: string) {
  const metric = [...document.querySelectorAll(".metric-row > div")].find(
    (element) => within(element as HTMLElement).queryByText(label),
  ) as HTMLElement | undefined;

  if (!metric) {
    throw new Error(`Metric not found: ${label}`);
  }

  return metric.querySelector("strong")?.textContent || "";
}

async function waitForFeatureCount(count?: number) {
  await waitFor(() => {
    const value = Number(screen.getByTestId("quiz-map").dataset.featureCount);
    if (typeof count === "number") {
      expect(value).toBe(count);
    } else {
      expect(value).toBeGreaterThan(0);
    }
  });
}

async function renderLoaded(path = "/") {
  window.history.pushState(null, "", path);
  render(<App />);
  await waitForFeatureCount();
}

function mockRandomForFeature(countryCode: string, featureName: string) {
  const features = featuresFor(countryCode);
  const index = features.findIndex(
    (feature) => feature.properties.name === featureName,
  );

  expect(index).toBeGreaterThanOrEqual(0);
  vi.spyOn(Math, "random").mockReturnValue((index + 0.01) / features.length);
  return features[index];
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.pushState(null, "", "/");
  installFetchMock();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("App loading and shell", () => {
  it("shows the loading notice, then renders loaded data", async () => {
    const topologyDeferred = deferredResponse(topology);
    const countryRegionsDeferred = deferredResponse(countryRegions);
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("admin1.topo.json")) {
        return topologyDeferred.promise;
      }
      if (url.includes("country-regions.json")) {
        return countryRegionsDeferred.promise;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(screen.getByText("Loading map data...")).toBeInTheDocument();

    topologyDeferred.resolve();
    countryRegionsDeferred.resolve();

    await waitForFeatureCount(allFeatures.length);
    expect(await screen.findByText("Ready for World.")).toBeInTheDocument();
  });

  it("renders the top bar controls and defaults to Type mode", async () => {
    await renderLoaded("/");

    expect(
      screen.getByRole("heading", { level: 1, name: "Subdivision Quiz" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /World/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Region")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Country" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Quiz mode" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Type" })).toHaveClass("is-active");
    expect(screen.getByPlaceholderText("Type a subdivision")).toBeInTheDocument();
    expect(window.localStorage.getItem(QUIZ_MODE_KEY)).toBe("type");
  });

  it("respects URL and localStorage quiz mode preferences", async () => {
    window.localStorage.setItem(QUIZ_MODE_KEY, "find");
    await renderLoaded("/?country=jpn");

    await screen.findByRole("heading", { level: 2, name: "Japan" });
    expect(screen.getByRole("button", { name: "Click" })).toHaveClass("is-active");
    expect(window.location.search).toBe("?country=JPN&mode=find");
  });

  it("switches quiz modes and persists the current mode", async () => {
    const user = userEvent.setup();
    await renderLoaded("/?country=JPN&mode=type");

    await user.click(screen.getByRole("button", { name: "Click" }));

    expect(screen.getByRole("button", { name: "Click" })).toHaveClass("is-active");
    expect(screen.getByText("Click this subdivision")).toBeInTheDocument();
    expect(window.localStorage.getItem(QUIZ_MODE_KEY)).toBe("find");
    expect(window.location.search).toBe("?country=JPN&mode=find");

    await user.click(screen.getByRole("button", { name: "Type" }));

    expect(screen.getByRole("button", { name: "Type" })).toHaveClass("is-active");
    expect(window.localStorage.getItem(QUIZ_MODE_KEY)).toBe("type");
    expect(window.location.search).toBe("?country=JPN&mode=type");
  });

  it("opens, filters, and keyboard-selects the country search", async () => {
    const user = userEvent.setup();
    await renderLoaded("/");

    const countryInput = screen.getByRole("combobox", { name: "Country" });
    await user.click(countryInput);
    await user.type(countryInput, "jap");

    const listbox = screen.getByRole("listbox", { name: "Country results" });
    expect(
      within(listbox).getByRole("option", {
        name: "Japan, 47 subdivisions",
      }),
    ).toBeInTheDocument();

    await user.keyboard("{ArrowDown}{Enter}");

    await screen.findByRole("heading", { level: 2, name: "Japan" });
    expect(window.location.search).toBe("?country=JPN&mode=type");
    expect(window.localStorage.getItem("subdivision-quiz:last-scope")).toBe(
      JSON.stringify({ kind: "country", value: "JPN" }),
    );
  });

  it("shows mode-specific metric labels and values", async () => {
    const user = userEvent.setup();
    await renderLoaded("/?country=MEX&mode=type");

    await screen.findByRole("heading", { level: 2, name: "Mexico" });
    expect(metricValue("found")).toBe("0");
    expect(metricValue("left")).toBe(String(featuresFor("MEX").length));
    expect(metricValue("time")).toBe("0:00");
    expect(document.querySelector(".metric-row")).not.toHaveTextContent("wrong");

    await user.click(screen.getByRole("button", { name: "Click" }));

    expect(metricValue("done")).toBe("0");
    expect(metricValue("left")).toBe(String(featuresFor("MEX").length));
    expect(metricValue("wrong")).toBe("0");
    expect(metricValue("hints")).toBe("0");
    expect(metricValue("time")).toBe("0:00");
  });

  it("shows and dismisses the help card using the current localStorage key", async () => {
    const user = userEvent.setup();
    await renderLoaded("/");

    expect(screen.getByLabelText("How to play")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Small subdivisions may appear as clickable dots when they are hard to select at the current zoom.",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByTitle("Dismiss"));

    expect(screen.queryByLabelText("How to play")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(HELP_CARD_KEY)).toBe("1");

    cleanup();
    await renderLoaded("/");

    expect(screen.queryByLabelText("How to play")).not.toBeInTheDocument();
  });
});

describe("App Type mode", () => {
  it("accepts valid aliases, updates progress, and saves the active scope", async () => {
    const user = userEvent.setup();
    await renderLoaded("/?country=MEX&mode=type");

    await user.type(screen.getByPlaceholderText("Type a subdivision"), "CDMX");

    await screen.findByText("Added Mexico City.");
    expect(metricValue("found")).toBe("1");
    expect(metricValue("left")).toBe(String(featuresFor("MEX").length - 1));
    expect(window.localStorage.getItem("subdivision-quiz:progress:country:MEX")).toBe(
      JSON.stringify(["MEX-2727"]),
    );
  });

  it("rejects invalid guesses with the current notice", async () => {
    const user = userEvent.setup();
    await renderLoaded("/?country=MEX&mode=type");

    await user.type(screen.getByPlaceholderText("Type a subdivision"), "Atlantis");
    await user.click(screen.getByRole("button", { name: "Enter" }));

    expect(screen.getByText("No exact match in this quiz.")).toBeInTheDocument();
    expect(metricValue("found")).toBe("0");
  });

  it("surfaces ambiguous world guesses without choosing one automatically", async () => {
    const user = userEvent.setup();
    await renderLoaded("/?mode=type");

    await user.type(screen.getByPlaceholderText("Type a subdivision"), "La Paz");
    await user.click(screen.getByRole("button", { name: "Enter" }));

    expect(screen.getByText("That name appears in 3 places.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add all" })).toBeInTheDocument();
    expect(document.querySelectorAll(".resolver-list button")).toHaveLength(3);
    expect(screen.getByText("Bolivia")).toBeInTheDocument();
    expect(screen.getByText("El Salvador")).toBeInTheDocument();
    expect(screen.getByText("Honduras")).toBeInTheDocument();
    expect(metricValue("found")).toBe("0");
  });

  it("reset clears only the active progress key according to current behavior", async () => {
    const user = userEvent.setup();
    const otherKey = "subdivision-quiz:progress:world:world";
    const activeKey = "subdivision-quiz:progress:country:MEX";
    window.localStorage.setItem(otherKey, JSON.stringify(["keep-me"]));
    await renderLoaded("/?country=MEX&mode=type");

    await user.type(screen.getByPlaceholderText("Type a subdivision"), "CDMX");
    await screen.findByText("Added Mexico City.");
    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(window.confirm).toHaveBeenCalledWith("Restart the Mexico quiz?");
    await waitFor(() => expect(window.localStorage.getItem(activeKey)).toBe("[]"));
    expect(window.localStorage.getItem(otherKey)).toBe(JSON.stringify(["keep-me"]));
    expect(screen.getByText("Progress reset.")).toBeInTheDocument();
  });
});

describe("App Find mode", () => {
  it("loads current-target media under React StrictMode in dev", async () => {
    mockRandomForFeature("JPN", "Hokkaidō");
    window.history.pushState(null, "", "/?country=JPN&mode=find");

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    await waitForFeatureCount(47);
    expect(
      (await screen.findAllByAltText("Flag for current subdivision")).length,
    ).toBeGreaterThan(0);
  });

  it("chooses a deterministic current target and shows media when available", async () => {
    const hokkaido = mockRandomForFeature("JPN", "Hokkaidō");

    await renderLoaded("/?country=JPN&mode=find");

    await screen.findByText("Click this subdivision");
    expect(screen.getByTestId("quiz-map")).toHaveAttribute(
      "data-current-target-id",
      hokkaido.properties.id,
    );
    expect(screen.getAllByText("北海道").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hokkaidō").length).toBeGreaterThan(0);
    expect(
      (await screen.findAllByAltText("Flag for current subdivision")).length,
    ).toBeGreaterThan(0);
  });

  it("clicking the correct map region marks the target completed", async () => {
    const target = mockRandomForFeature("JPN", "Hokkaidō");
    const user = userEvent.setup();
    await renderLoaded("/?country=JPN&mode=find");

    await user.click(screen.getByTestId(`mock-map-feature-${target.properties.id}`));

    expect(screen.getByText(/^Correct:/)).toBeInTheDocument();
    expect(metricValue("done")).toBe("1");
    expect(metricValue("left")).toBe("46");
    expect(screen.getByText("Recent")).toBeInTheDocument();
    expect(screen.getAllByText("Hokkaidō").length).toBeGreaterThan(0);
  });

  it("wrong clicks increment wrong count, show the notice, and keep tried regions identifiable", async () => {
    const target = mockRandomForFeature("JPN", "Hokkaidō");
    const wrong = featuresFor("JPN").find(
      (feature) => feature.properties.id !== target.properties.id,
    );
    expect(wrong).toBeTruthy();
    const user = userEvent.setup();
    await renderLoaded("/?country=JPN&mode=find");

    await user.click(screen.getByTestId(`mock-map-feature-${wrong!.properties.id}`));

    expect(metricValue("wrong")).toBe("1");
    expect(screen.getByText(/Try again\./)).toBeInTheDocument();
    expect(screen.getByTestId(`mock-map-feature-${wrong!.properties.id}`)).toHaveClass(
      "is-wrong",
    );
    expect(screen.getByText("Wrong clicks")).toBeInTheDocument();
    expect(screen.getAllByText(wrong!.properties.name).length).toBeGreaterThan(0);
  });

  it("increments hints up to the current maximum", async () => {
    mockRandomForFeature("JPN", "Hokkaidō");
    const user = userEvent.setup();
    await renderLoaded("/?country=JPN&mode=find");

    const hintButton = screen.getByRole("button", { name: "Hint" });
    await user.click(hintButton);
    await user.click(hintButton);
    await user.click(hintButton);

    expect(metricValue("hints")).toBe("3");
    expect(screen.getByTestId("quiz-map")).toHaveAttribute("data-hint-level", "3");
    expect(screen.getByText("Final hint: the answer is inside the small outline.")).toBeInTheDocument();
    expect(hintButton).toBeDisabled();
  });

  it("reveal completes the current target as revealed and saves find progress", async () => {
    const target = mockRandomForFeature("JPN", "Hokkaidō");
    const user = userEvent.setup();
    await renderLoaded("/?country=JPN&mode=find");

    await user.click(screen.getByRole("button", { name: "Show answer" }));

    expect(screen.getByText(/^Revealed:/)).toBeInTheDocument();
    expect(metricValue("done")).toBe("1");
    await waitFor(() => {
      expect(
        JSON.parse(
          window.localStorage.getItem("subdivision-quiz:find-progress:country:JPN") ||
            "{}",
        ),
      ).toMatchObject({
        correct: [],
        revealed: [target.properties.id],
        stats: { hints: 0, reveals: 1, skips: 0, wrong: 0 },
      });
    });
  });

  it("skip defers the current target and persists skip stats", async () => {
    const target = mockRandomForFeature("JPN", "Hokkaidō");
    const user = userEvent.setup();
    await renderLoaded("/?country=JPN&mode=find");

    await user.click(screen.getByRole("button", { name: "Skip" }));

    expect(screen.getByText("Skipped Hokkaidō for now. It can come back later.")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("quiz-map")).not.toHaveAttribute(
        "data-current-target-id",
        target.properties.id,
      ),
    );
    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem("subdivision-quiz:find-progress:country:JPN") ||
          "{}",
      );
      expect(saved.stats.skips).toBe(1);
    });
  });

  it("preserves give-up and reset confirmation behavior", async () => {
    mockRandomForFeature("JPN", "Hokkaidō");
    const user = userEvent.setup();
    await renderLoaded("/?country=JPN&mode=find");

    await user.click(screen.getByRole("button", { name: "Hint" }));
    await user.click(screen.getByRole("button", { name: "Reset" }));

    expect(window.confirm).toHaveBeenCalledWith("Restart the Japan quiz?");
    expect(screen.getByText("Progress reset.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "End quiz" }));

    expect(screen.getByText("Quiz ended. The remaining subdivisions are revealed.")).toBeInTheDocument();
    expect(screen.getAllByText("Quiz ended").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Missing" })).toBeInTheDocument();
  });
});
