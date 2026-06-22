import type { Feature, Geometry } from "geojson";
import type { RawAdmin1Properties } from "../domain/types";

export type CountryRegionLookup = Record<
  string,
  {
    languageCodes?: string[];
    name: string;
    region: string;
    subregion: string;
  }
>;

export type RawSubdivisionFeature = Feature<Geometry, RawAdmin1Properties>;

export type RawTopoGeometry = {
  properties?: RawAdmin1Properties;
};
