import type { Feature, Geometry } from "geojson";

export type RawAdmin1Properties = {
  adm1_code?: string;
  adm0_a3?: string;
  iso_a2?: string;
  admin?: string;
  geonunit?: string;
  name?: string;
  name_en?: string;
  name_alt?: string;
  name_local?: string;
  name_ar?: string;
  name_bn?: string;
  name_de?: string;
  name_el?: string;
  name_es?: string;
  name_fa?: string;
  name_fr?: string;
  name_he?: string;
  name_hi?: string;
  name_hu?: string;
  name_id?: string;
  name_it?: string;
  name_ja?: string;
  name_ko?: string;
  name_nl?: string;
  name_pl?: string;
  name_pt?: string;
  name_ru?: string;
  name_sv?: string;
  name_tr?: string;
  name_uk?: string;
  name_ur?: string;
  name_vi?: string;
  name_zh?: string;
  name_zht?: string;
  native_names?: Array<{
    lang: string;
    name: string;
  }>;
  gn_name?: string;
  type?: string;
  type_en?: string;
  region?: string;
  longitude?: number;
  latitude?: number;
  postal?: string;
  iso_3166_2?: string;
  wikidataid?: string;
};

export type NativeName = {
  display?: boolean;
  lang: string;
  name: string;
};

export type SubdivisionProperties = {
  id: string;
  adm1Code: string;
  countryCode: string;
  countryIso2?: string;
  country: string;
  region: string;
  subregion: string;
  name: string;
  localNames: string[];
  nativeNames: NativeName[];
  type: string;
  typeEn: string;
  code?: string;
  wikidataId?: string;
  postal?: string;
  longitude?: number;
  latitude?: number;
  aliases: string[];
  colorIndex: number;
};

export type SubdivisionFeature = Feature<Geometry, SubdivisionProperties>;

export type Scope =
  | { kind: "world"; value: "world" }
  | { kind: "region"; value: string }
  | { kind: "country"; value: string };

export type CountrySummary = {
  code: string;
  name: string;
  region: string;
  subregion: string;
  count: number;
};

export type RegionSummary = {
  name: string;
  count: number;
  countries: number;
};
