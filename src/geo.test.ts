import { describe, expect, it } from "vitest";
import countryRegions from "../public/data/country-regions.json";
import subdivisionMedia from "../public/data/subdivision-media.json";
import topology from "../public/data/admin1.topo.json";
import {
  buildNameIndex,
  buildCountrySummaries,
  buildRegionSummaries,
  byCountryThenName,
  featureInScope,
  loadAdmin1Topology,
  normalizeGuess,
  scopeKey,
  scopeLabel,
} from "./geo";
import { mediaForFeature, mediaKindLabel } from "./subdivisionMedia";
import { visibleTinyMarkerItems } from "./QuizMap";
import type { CountryRegionLookup } from "./geo";
import type {
  SubdivisionFeature,
  SubdivisionMediaData,
  SubdivisionMediaLookup,
} from "./types";

const allFeatures = loadAdmin1Topology(
  topology,
  countryRegions as CountryRegionLookup,
);
const mediaLookup = (subdivisionMedia as SubdivisionMediaData).media || {};

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

function countryNamesFor(
  index: Map<string, SubdivisionFeature[]>,
  answer: string,
) {
  return (index.get(normalizeGuess(answer)) || [])
    .map((feature) => `${feature.properties.country}: ${feature.properties.name}`)
    .sort();
}

describe("normalizeGuess", () => {
  it("folds common Latin accents and spelling marks", () => {
    expect(normalizeGuess("Québec")).toBe(normalizeGuess("Quebec"));
    expect(normalizeGuess("Đồng Nai")).toBe(normalizeGuess("Dong Nai"));
    expect(normalizeGuess("Tromsø")).toBe(normalizeGuess("Tromso"));
    expect(normalizeGuess("Sjælland")).toBe(normalizeGuess("Sjaelland"));
    expect(normalizeGuess("Łódź")).toBe(normalizeGuess("Lodz"));
    expect(normalizeGuess("Île-de-France")).toBe(normalizeGuess("Ile de France"));
  });

  it("normalizes punctuation and spacing for typed answers", () => {
    expect(normalizeGuess("Saint-Pierre")).toBe("saint pierre");
    expect(normalizeGuess("A & B")).toBe("a and b");
    expect(normalizeGuess("Queen's County")).toBe("queens county");
    expect(normalizeGuess("  North--West / South-East  ")).toBe(
      "north west south east",
    );
    expect(normalizeGuess("Mexico D.F.")).toBe("mexico d f");
  });

  it("keeps meaningful non-Latin marks strict", () => {
    expect(normalizeGuess("จังหวัดน่าน")).not.toBe(normalizeGuess("จงหวดนาน"));
    expect(normalizeGuess("น่าน")).not.toBe(normalizeGuess("นาน"));
    expect(normalizeGuess("เชียงใหม่")).not.toBe(normalizeGuess("เชยงใหม"));
    expect(normalizeGuess("が")).not.toBe(normalizeGuess("か"));
    expect(normalizeGuess("ぱ")).not.toBe(normalizeGuess("は"));
    expect(normalizeGuess("กรุงเทพฯ")).not.toBe(normalizeGuess("กรงเทพฯ"));
  });
});

describe("loadAdmin1Topology", () => {
  it("returns the current playable feature set with stable core invariants", () => {
    const ids = new Set(allFeatures.map((feature) => feature.properties.id));
    const nullGeometryFeatures = allFeatures.filter(
      (feature) => !feature.geometry,
    );

    expect(allFeatures).toHaveLength(4560);
    expect(ids.size).toBe(allFeatures.length);
    expect(
      nullGeometryFeatures.map((feature) => feature.properties.id),
    ).toEqual(["VAT+00?"]);
    expect(
      allFeatures.every((feature) => feature.properties.countryCode !== "-99"),
    ).toBe(true);
    expect(
      allFeatures.every((feature) =>
        feature.properties.aliases.some(
          (alias) =>
            normalizeGuess(alias) === normalizeGuess(feature.properties.name),
        ),
      ),
    ).toBe(true);
    expect(
      allFeatures.every(
        (feature) =>
          feature.properties.colorIndex >= 0 &&
          feature.properties.colorIndex < 11,
      ),
    ).toBe(true);
  });
});

describe("buildNameIndex", () => {
  it("keeps duplicate names ambiguous across countries", () => {
    const worldIndex = buildNameIndex(allFeatures);

    expect(countryNamesFor(worldIndex, "La Paz")).toEqual([
      "Bolivia: La Paz",
      "El Salvador: La Paz",
      "Honduras: La Paz",
    ]);
  });

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
    expect(vietnam.filter((feature) => feature.properties.typeEn === "Province")).toHaveLength(28);
    expect(vietnam.filter((feature) => feature.properties.typeEn === "Municipality")).toHaveLength(6);
    expect(
      vietnam.every((feature) => feature.properties.id.startsWith("VNM-2025-")),
    ).toBe(true);
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
    expect(displayNames).not.toContain("Quảng Nam");
    expect(displayNames).not.toContain("Kon Tum");
    expect(displayNames).not.toContain("Northeast Vietnam");
    expect(namesFor(vietnamIndex, "Da Nang")).toEqual(["Đà Nẵng"]);
    expect(namesFor(vietnamIndex, "Dak Lak")).toEqual(["Đắk Lắk"]);
    expect(namesFor(vietnamIndex, "Đà Nẵng")).toEqual(["Đà Nẵng"]);
    expect(namesFor(vietnamIndex, "Đắk Lắk")).toEqual(["Đắk Lắk"]);
    expect(namesFor(vietnamIndex, "Thanh pho Da Nang")).toEqual(["Đà Nẵng"]);
    expect(namesFor(vietnamIndex, "Tinh Dak Lak")).toEqual(["Đắk Lắk"]);
    expect(namesFor(vietnamIndex, "Tỉnh Đắk Lắk")).toEqual(["Đắk Lắk"]);
    expect(namesFor(vietnamIndex, "Ho Chi Minh")).toEqual(["Hồ Chí Minh"]);
    expect(namesFor(vietnamIndex, "Ho Chi Minh City")).toEqual(["Hồ Chí Minh"]);
    expect(namesFor(vietnamIndex, "Thành phố Hồ Chí Minh")).toEqual(["Hồ Chí Minh"]);
    expect(namesFor(vietnamIndex, "Thanh pho Ho Chi Minh")).toEqual(["Hồ Chí Minh"]);
    expect(namesFor(vietnamIndex, "Bình Dương")).toEqual([
      "Hồ Chí Minh",
    ]);
    expect(namesFor(vietnamIndex, "Ba Ria Vung Tau")).toEqual([
      "Hồ Chí Minh",
    ]);
    expect(namesFor(vietnamIndex, "Quảng Nam")).toEqual(["Đà Nẵng"]);
    expect(namesFor(vietnamIndex, "Kon Tum")).toEqual(["Quảng Ngãi"]);
    expect(namesFor(vietnamIndex, "Bắc Kạn")).toEqual(["Thái Nguyên"]);
    expect(namesFor(vietnamIndex, "Thừa Thiên Huế")).toEqual(["Huế"]);
    expect(namesFor(vietnamIndex, "Red River Delta")).toEqual([]);
    expect(namesFor(vietnamIndex, "Northeast Vietnam")).toEqual([]);
    expect(namesFor(vietnamIndex, "Dong Bac")).toEqual([]);
    expect(namesFor(vietnamIndex, "Dong Nam Bo")).toEqual([]);
    expect(namesFor(vietnamIndex, "South East")).toEqual([]);
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

describe("country, region, and scope helpers", () => {
  it("builds sorted country summaries with transformed subdivision counts", () => {
    const countries = buildCountrySummaries(allFeatures);

    expect(countries[0].name).toBe("Afghanistan");
    expect(countries.find((country) => country.code === "JPN")).toMatchObject({
      count: 47,
      name: "Japan",
      region: "Asia",
      subregion: "Eastern Asia",
    });
    expect(countries.find((country) => country.code === "VNM")?.count).toBe(34);
  });

  it("rolls countries into region summaries", () => {
    const countries = buildCountrySummaries(allFeatures);
    const regions = buildRegionSummaries(countries);
    const asia = regions.find((region) => region.name === "Asia");

    expect(regions.map((region) => region.name)).toEqual([
      "Africa",
      "Americas",
      "Antarctic",
      "Asia",
      "Europe",
      "Oceania",
    ]);
    expect(asia?.countries).toBeGreaterThan(40);
    expect(asia?.count).toBe(
      countries
        .filter((country) => country.region === "Asia")
        .reduce((sum, country) => sum + country.count, 0),
    );
  });

  it("checks feature scope membership and labels", () => {
    const countries = buildCountrySummaries(allFeatures);
    const japan = featuresFor("JPN")[0];

    expect(featureInScope(japan, { kind: "world", value: "world" })).toBe(true);
    expect(featureInScope(japan, { kind: "country", value: "JPN" })).toBe(true);
    expect(featureInScope(japan, { kind: "country", value: "CAN" })).toBe(false);
    expect(featureInScope(japan, { kind: "region", value: "Asia" })).toBe(true);
    expect(featureInScope(japan, { kind: "region", value: "Europe" })).toBe(false);
    expect(scopeKey({ kind: "country", value: "JPN" })).toBe("country:JPN");
    expect(scopeLabel({ kind: "world", value: "world" }, countries)).toBe("World");
    expect(scopeLabel({ kind: "region", value: "Asia" }, countries)).toBe("Asia");
    expect(scopeLabel({ kind: "country", value: "JPN" }, countries)).toBe("Japan");
    expect(scopeLabel({ kind: "country", value: "XXX" }, countries)).toBe("XXX");
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

describe("mediaForFeature", () => {
  it("matches subdivision media by Wikidata ID", () => {
    const california = featuresFor("USA").find(
      (feature) => feature.properties.name === "California",
    );
    expect(california?.properties.wikidataId).toBeTruthy();

    const media = {
      commonsUrl: "https://commons.wikimedia.org/wiki/File:Flag_of_California.svg",
      file: "Flag of California.svg",
      imageUrl:
        "https://commons.wikimedia.org/wiki/Special:Redirect/file/Flag%20of%20California.svg?width=180",
      kind: "flag" as const,
    };
    const lookup: SubdivisionMediaLookup = {
      [california?.properties.wikidataId || ""]: media,
    };

    expect(mediaForFeature(california, lookup)).toEqual(media);
    expect(mediaKindLabel(media)).toBe("Flag");
  });

  it("does not attach old member media to synthetic merged subdivisions", () => {
    const daNang = featuresFor("VNM").find(
      (feature) => feature.properties.name === "Đà Nẵng",
    );
    const lookup: SubdivisionMediaLookup = {
      Q25282: {
        commonsUrl: "https://commons.wikimedia.org/wiki/File:Unused.svg",
        file: "Unused.svg",
        imageUrl: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Unused.svg",
        kind: "emblem",
      },
    };

    expect(daNang?.properties.wikidataId).toBeUndefined();
    expect(mediaForFeature(daNang, lookup)).toBeUndefined();
    expect(mediaKindLabel(lookup.Q25282)).toBe("Emblem");
  });

  it("includes Hokkaido's prefectural flag despite Natural Earth using the island QID", () => {
    const hokkaido = featuresFor("JPN").find(
      (feature) => feature.properties.name === "Hokkaidō",
    );
    const media = mediaForFeature(hokkaido, mediaLookup);

    expect(hokkaido?.properties.wikidataId).toBe("Q35581");
    expect(media?.kind).toBe("flag");
    expect(media?.file).toBe("Flag of Hokkaido Prefecture.svg");
  });
});
