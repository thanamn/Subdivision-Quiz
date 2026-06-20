import { describe, expect, it } from "vitest";
import countryRegions from "../public/data/country-regions.json";
import topology from "../public/data/admin1.topo.json";
import {
  buildNameIndex,
  byCountryThenName,
  loadAdmin1Topology,
  normalizeGuess,
} from "./geo";
import { visibleTinyMarkerItems } from "./QuizMap";
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

  it("keeps Canadian French names as aliases without displaying them as primary names", () => {
    const canada = featuresFor("CAN");
    const britishColumbia = canada.find(
      (feature) => feature.properties.name === "British Columbia",
    );
    const northwestTerritories = canada.find(
      (feature) => feature.properties.name === "Northwest Territories",
    );
    const newfoundland = canada.find(
      (feature) => feature.properties.name === "Newfoundland and Labrador",
    );
    const canadaIndex = buildNameIndex(canada);

    expect(britishColumbia?.properties.nativeNames).toContainEqual({
      display: false,
      lang: "fr",
      name: "Colombie-Britannique",
    });
    expect(namesFor(canadaIndex, "Colombie-Britannique")).toEqual([
      "British Columbia",
    ]);
    expect(northwestTerritories?.properties.nativeNames).toContainEqual({
      display: false,
      lang: "fr",
      name: "Territoires du Nord-Ouest",
    });
    expect(newfoundland?.properties.nativeNames).toContainEqual({
      display: false,
      lang: "fr",
      name: "Terre-Neuve-et-Labrador",
    });
    expect(namesFor(canadaIndex, "Territoires du Nord-Ouest")).toEqual([
      "Northwest Territories",
    ]);
    expect(namesFor(canadaIndex, "Terre-Neuve-et-Labrador")).toEqual([
      "Newfoundland and Labrador",
    ]);
  });

  it("uses playable Seychelles district display names and aliases", () => {
    const seychelles = featuresFor("SYC");
    const seychellesIndex = buildNameIndex(seychelles);
    const displayNames = seychelles.map((feature) => feature.properties.name);

    expect(displayNames).toContain("Outer Islands");
    expect(displayNames).toContain("Grand'Anse Mahé");
    expect(displayNames).toContain("La Digue and Inner Islands");
    expect(displayNames).toContain("English River");
    expect(
      displayNames.filter((name) => name === "Grand'Anse Praslin"),
    ).toHaveLength(1);
    expect(namesFor(seychellesIndex, "Takamaka")).toEqual(["Takamaka"]);
    expect(namesFor(seychellesIndex, "La Digue")).toEqual([
      "La Digue and Inner Islands",
    ]);
    expect(namesFor(seychellesIndex, "La Rivière Anglaise")).toEqual([
      "English River",
    ]);
  });

  it("uses Vietnam's 2025 provincial-level reorganization", () => {
    const vietnam = featuresFor("VNM");
    const vietnamIndex = buildNameIndex(vietnam);
    const displayNames = vietnam.map((feature) => feature.properties.name).sort();

    expect(vietnam).toHaveLength(34);
    expect(displayNames).toContain("Huế");
    expect(displayNames).toContain("Hồ Chí Minh");
    expect(displayNames).toContain("Đà Nẵng");
    expect(displayNames).toContain("Đắk Lắk");
    expect(displayNames).toContain("Thái Nguyên");
    expect(displayNames).not.toContain("Da Nang");
    expect(displayNames).not.toContain("Dak Lak");
    expect(displayNames).not.toContain("Ho Chi Minh City");
    expect(displayNames).not.toContain("Bình Dương");
    expect(displayNames).not.toContain("Bà Rịa-Vũng Tàu");
    expect(displayNames).not.toContain("Northeast Vietnam");
    expect(namesFor(vietnamIndex, "Da Nang")).toEqual(["Đà Nẵng"]);
    expect(namesFor(vietnamIndex, "Dak Lak")).toEqual(["Đắk Lắk"]);
    expect(namesFor(vietnamIndex, "Thanh pho Da Nang")).toEqual(["Đà Nẵng"]);
    expect(namesFor(vietnamIndex, "Tinh Dak Lak")).toEqual(["Đắk Lắk"]);
    expect(namesFor(vietnamIndex, "Ho Chi Minh")).toEqual(["Hồ Chí Minh"]);
    expect(namesFor(vietnamIndex, "Ho Chi Minh City")).toEqual(["Hồ Chí Minh"]);
    expect(namesFor(vietnamIndex, "Bình Dương")).toEqual([
      "Hồ Chí Minh",
    ]);
    expect(namesFor(vietnamIndex, "Ba Ria Vung Tau")).toEqual([
      "Hồ Chí Minh",
    ]);
    expect(namesFor(vietnamIndex, "Bắc Kạn")).toEqual(["Thái Nguyên"]);
    expect(namesFor(vietnamIndex, "Thừa Thiên Huế")).toEqual(["Huế"]);
    expect(namesFor(vietnamIndex, "Red River Delta")).toEqual([]);
    expect(namesFor(vietnamIndex, "Northeast Vietnam")).toEqual([]);
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

describe("visibleTinyMarkerItems", () => {
  it("keeps required collapsed-geometry markers visible when optional markers are off", () => {
    const required = { id: "SYC-5220", tinyMarker: { alwaysVisible: true } };
    const optional = { id: "SYC-5203", tinyMarker: { alwaysVisible: false } };

    expect(visibleTinyMarkerItems([required, optional], false)).toEqual([
      required,
    ]);
    expect(visibleTinyMarkerItems([required, optional], true)).toEqual([
      required,
      optional,
    ]);
  });
});
