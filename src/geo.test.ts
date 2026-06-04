import { describe, expect, it } from "vitest";
import countryRegions from "../public/data/country-regions.json";
import topology from "../public/data/admin1.topo.json";
import {
  buildNameIndex,
  byCountryThenName,
  loadAdmin1Topology,
  normalizeGuess,
} from "./geo";
import type { CountryRegionLookup } from "./geo";
import type { SubdivisionFeature } from "./types";

const allFeatures = loadAdmin1Topology(
  topology,
  countryRegions as CountryRegionLookup,
);

function featuresFor(countryCode: string) {
  return allFeatures.filter(
    (feature) => feature.properties.countryCode === countryCode,
  );
}

function namesFor(
  index: Map<string, SubdivisionFeature[]>,
  answer: string,
) {
  return (index.get(normalizeGuess(answer)) || [])
    .map((feature) => feature.properties.name)
    .sort();
}

describe("normalizeGuess", () => {
  it("folds common Latin accents and spelling marks", () => {
    expect(normalizeGuess("Québec")).toBe(normalizeGuess("Quebec"));
    expect(normalizeGuess("Đồng Nai")).toBe(normalizeGuess("Dong Nai"));
    expect(normalizeGuess("Tromsø")).toBe(normalizeGuess("Tromso"));
    expect(normalizeGuess("Sjælland")).toBe(normalizeGuess("Sjaelland"));
  });

  it("normalizes punctuation and spacing for typed answers", () => {
    expect(normalizeGuess("Saint-Pierre")).toBe("saint pierre");
    expect(normalizeGuess("A & B")).toBe("a and b");
    expect(normalizeGuess("Queen's County")).toBe("queens county");
  });

  it("keeps meaningful non-Latin marks strict", () => {
    expect(normalizeGuess("จังหวัดน่าน")).not.toBe(normalizeGuess("จงหวดนาน"));
    expect(normalizeGuess("น่าน")).not.toBe(normalizeGuess("นาน"));
    expect(normalizeGuess("เชียงใหม่")).not.toBe(normalizeGuess("เชยงใหม"));
    expect(normalizeGuess("が")).not.toBe(normalizeGuess("か"));
  });
});

describe("buildNameIndex", () => {
  it("matches the Thai native spelling for Nan but not a mark-stripped typo", () => {
    const thailandIndex = buildNameIndex(featuresFor("THA"));

    expect(namesFor(thailandIndex, "จังหวัดน่าน")).toEqual(["Nan"]);
    expect(namesFor(thailandIndex, "จงหวดนาน")).toEqual([]);
  });

  it("does not accept US state postal abbreviations as answers", () => {
    const usaIndex = buildNameIndex(featuresFor("USA"));

    expect(namesFor(usaIndex, "California")).toEqual(["California"]);
    expect(namesFor(usaIndex, "CA")).toEqual([]);
    expect(namesFor(usaIndex, "N.D.")).toEqual([]);
  });

  it("keeps corrected Denmark names without accepting the country name", () => {
    const denmarkIndex = buildNameIndex(featuresFor("DNK"));

    expect(namesFor(denmarkIndex, "Hovedstaden")).toEqual([
      "Capital Region of Denmark",
    ]);
    expect(namesFor(denmarkIndex, "Region Hovedstaden")).toEqual([
      "Capital Region of Denmark",
    ]);
    expect(namesFor(denmarkIndex, "Denmark")).toEqual([]);
  });

  it("uses corrected names and aliases for Mexico City", () => {
    const mexicoIndex = buildNameIndex(featuresFor("MEX"));

    expect(namesFor(mexicoIndex, "Mexico City")).toEqual(["Mexico City"]);
    expect(namesFor(mexicoIndex, "Distrito Federal")).toEqual(["Mexico City"]);
    expect(namesFor(mexicoIndex, "Ciudad de México")).toEqual(["Mexico City"]);
    expect(namesFor(mexicoIndex, "CDMX")).toEqual(["Mexico City"]);
  });

  it("builds deterministic sorted quiz lists", () => {
    const denmark = featuresFor("DNK").sort(byCountryThenName);

    expect(denmark.map((feature) => feature.properties.name)).toEqual([
      "Capital Region of Denmark",
      "Central Denmark",
      "North Denmark",
      "Southern Denmark",
      "Zealand",
    ]);
  });
});
