import { merge as topojsonMerge } from "topojson-client";
import type { RawAdmin1Properties } from "../../domain/types";
import { compactAliases } from "../aliases";
import { normalizeGuess } from "../normalization";
import type { RawSubdivisionFeature, RawTopoGeometry } from "../topologyTypes";

type Vietnam2025Unit = {
  adm1Code: string;
  aliases?: string[];
  kind: "city" | "province";
  memberCodes: string[];
  name: string;
};

const VIETNAM_2025_UNITS: Vietnam2025Unit[] = [
  {
    adm1Code: "VNM-2025-TUYEN-QUANG",
    kind: "province",
    memberCodes: ["VNM-512", "VNM-457"],
    name: "Tuyên Quang",
  },
  {
    adm1Code: "VNM-2025-LAO-CAI",
    kind: "province",
    memberCodes: ["VNM-5483", "VNM-458"],
    name: "Lào Cai",
  },
  {
    adm1Code: "VNM-2025-THAI-NGUYEN",
    aliases: ["Bắc Kạn", "Bac Kan"],
    kind: "province",
    memberCodes: ["VNM-451", "VNM-452"],
    name: "Thái Nguyên",
  },
  {
    adm1Code: "VNM-2025-PHU-THO",
    kind: "province",
    memberCodes: ["VNM-464", "VNM-459", "VNM-469"],
    name: "Phú Thọ",
  },
  {
    adm1Code: "VNM-2025-BAC-NINH",
    kind: "province",
    memberCodes: ["VNM-470", "VNM-463"],
    name: "Bắc Ninh",
  },
  {
    adm1Code: "VNM-2025-HUNG-YEN",
    aliases: ["Hưng Yên", "Hung Yen"],
    kind: "province",
    memberCodes: ["VNM-461", "VNM-471"],
    name: "Hưng Yên",
  },
  {
    adm1Code: "VNM-2025-HAI-PHONG",
    kind: "city",
    memberCodes: ["VNM-4600", "VNM-460"],
    name: "Hải Phòng",
  },
  {
    adm1Code: "VNM-2025-NINH-BINH",
    kind: "province",
    memberCodes: ["VNM-467", "VNM-468", "VNM-466"],
    name: "Ninh Bình",
  },
  {
    adm1Code: "VNM-2025-QUANG-TRI",
    kind: "province",
    memberCodes: ["VNM-476", "VNM-489"],
    name: "Quảng Trị",
  },
  {
    adm1Code: "VNM-2025-DA-NANG",
    kind: "city",
    memberCodes: ["VNM-491", "VNM-487"],
    name: "Đà Nẵng",
  },
  {
    adm1Code: "VNM-2025-QUANG-NGAI",
    kind: "province",
    memberCodes: ["VNM-486", "VNM-488"],
    name: "Quảng Ngãi",
  },
  {
    adm1Code: "VNM-2025-GIA-LAI",
    kind: "province",
    memberCodes: ["VNM-478", "VNM-485"],
    name: "Gia Lai",
  },
  {
    adm1Code: "VNM-2025-KHANH-HOA",
    kind: "province",
    memberCodes: ["VNM-481", "VNM-479"],
    name: "Khánh Hòa",
  },
  {
    adm1Code: "VNM-2025-LAM-DONG",
    kind: "province",
    memberCodes: ["VNM-4835", "VNM-496", "VNM-480"],
    name: "Lâm Đồng",
  },
  {
    adm1Code: "VNM-2025-DAK-LAK",
    kind: "province",
    memberCodes: ["VNM-482", "VNM-477"],
    name: "Đắk Lắk",
  },
  {
    adm1Code: "VNM-2025-HO-CHI-MINH-CITY",
    aliases: ["Hồ Chí Minh City", "Thành phố Hồ Chí Minh"],
    kind: "city",
    memberCodes: ["VNM-501", "VNM-483", "VNM-495"],
    name: "Hồ Chí Minh",
  },
  {
    adm1Code: "VNM-2025-DONG-NAI",
    aliases: ["Đồng Nai", "Dong Nai"],
    kind: "province",
    memberCodes: ["VNM-484", "VNM-497"],
    name: "Đồng Nai",
  },
  {
    adm1Code: "VNM-2025-TAY-NINH",
    kind: "province",
    memberCodes: ["VNM-503", "VNM-444"],
    name: "Tây Ninh",
  },
  {
    adm1Code: "VNM-2025-CAN-THO",
    kind: "city",
    memberCodes: ["VNM-499", "VNM-508", "VNM-505"],
    name: "Cần Thơ",
  },
  {
    adm1Code: "VNM-2025-VINH-LONG",
    kind: "province",
    memberCodes: ["VNM-504", "VNM-509", "VNM-510"],
    name: "Vĩnh Long",
  },
  {
    adm1Code: "VNM-2025-DONG-THAP",
    kind: "province",
    memberCodes: ["VNM-4834", "VNM-500"],
    name: "Đồng Tháp",
  },
  {
    adm1Code: "VNM-2025-CA-MAU",
    kind: "province",
    memberCodes: ["VNM-506", "VNM-507"],
    name: "Cà Mau",
  },
  {
    adm1Code: "VNM-2025-AN-GIANG",
    kind: "province",
    memberCodes: ["VNM-502", "VNM-498"],
    name: "An Giang",
  },
  {
    adm1Code: "VNM-2025-CAO-BANG",
    kind: "province",
    memberCodes: ["VNM-511"],
    name: "Cao Bằng",
  },
  {
    adm1Code: "VNM-2025-DIEN-BIEN",
    kind: "province",
    memberCodes: ["VNM-450"],
    name: "Điện Biên",
  },
  {
    adm1Code: "VNM-2025-HA-TINH",
    kind: "province",
    memberCodes: ["VNM-474"],
    name: "Hà Tĩnh",
  },
  {
    adm1Code: "VNM-2025-LAI-CHAU",
    kind: "province",
    memberCodes: ["VNM-453"],
    name: "Lai Châu",
  },
  {
    adm1Code: "VNM-2025-LANG-SON",
    kind: "province",
    memberCodes: ["VNM-454"],
    name: "Lạng Sơn",
  },
  {
    adm1Code: "VNM-2025-NGHE-AN",
    kind: "province",
    memberCodes: ["VNM-475"],
    name: "Nghệ An",
  },
  {
    adm1Code: "VNM-2025-QUANG-NINH",
    kind: "province",
    memberCodes: ["VNM-429"],
    name: "Quảng Ninh",
  },
  {
    adm1Code: "VNM-2025-THANH-HOA",
    kind: "province",
    memberCodes: ["VNM-456"],
    name: "Thanh Hóa",
  },
  {
    adm1Code: "VNM-2025-SON-LA",
    kind: "province",
    memberCodes: ["VNM-455"],
    name: "Sơn La",
  },
  {
    adm1Code: "VNM-2025-HA-NOI",
    kind: "city",
    memberCodes: ["VNM-462"],
    name: "Hà Nội",
  },
  {
    adm1Code: "VNM-2025-HUE",
    aliases: ["Thừa Thiên Huế", "Thua Thien Hue"],
    kind: "city",
    memberCodes: ["VNM-490"],
    name: "Huế",
  },
];

function averageNumber(values: Array<number | undefined>) {
  const numbers = values.filter((value): value is number => Number.isFinite(value));
  if (!numbers.length) {
    return undefined;
  }

  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function vietnam2025NameAlt(unit: Vietnam2025Unit, memberProps: RawAdmin1Properties[]) {
  const staleRegionAliases = new Set([
    "dong bac",
    "dong bang song hong",
    "dong nam bo",
    "north east",
    "northeast vietnam",
    "red river delta",
    "south east",
  ]);
  const typedVietnameseName =
    unit.kind === "city" ? `Thành phố ${unit.name}` : `Tỉnh ${unit.name}`;

  return compactAliases([
    typedVietnameseName,
    ...(unit.aliases || []),
    ...memberProps.flatMap((props) => [
      props.name,
      props.name_en,
      props.name_alt,
      props.gn_name,
    ]),
  ])
    .filter((alias) => normalizeGuess(alias) !== normalizeGuess(unit.name))
    .filter((alias) => !staleRegionAliases.has(normalizeGuess(alias)))
    .join("|");
}

function vietnam2025Features(
  topology: unknown,
  rawGeometries: RawTopoGeometry[],
): RawSubdivisionFeature[] | null {
  const vietnamGeometries = new Map(
    rawGeometries
      .filter((geometry) => geometry.properties?.adm0_a3 === "VNM")
      .map((geometry) => [geometry.properties?.adm1_code, geometry]),
  );

  if (!vietnamGeometries.size) {
    return null;
  }

  const missingCodes = VIETNAM_2025_UNITS.flatMap((unit) =>
    unit.memberCodes.filter((code) => !vietnamGeometries.has(code)),
  );
  if (missingCodes.length) {
    return null;
  }

  return VIETNAM_2025_UNITS.map((unit) => {
    const memberGeometries = unit.memberCodes.map(
      (code) => vietnamGeometries.get(code) as RawTopoGeometry,
    );
    const memberProps = memberGeometries.map(
      (geometry) => geometry.properties || {},
    );
    const representative =
      memberProps.find(
        (props) =>
          normalizeGuess(props.name_en || props.name || "") ===
          normalizeGuess(unit.name),
      ) ||
      memberProps.find((props) => props.wikidataid) ||
      memberProps[0] ||
      {};
    const isMerged = memberProps.length > 1;
    const type = unit.kind === "city" ? "Thành phố trực thuộc trung ương" : "Tỉnh";
    const typeEn = unit.kind === "city" ? "Municipality" : "Province";

    return {
      geometry: topojsonMerge(topology as never, memberGeometries as never),
      properties: {
        ...representative,
        adm1_code: unit.adm1Code,
        adm0_a3: "VNM",
        iso_a2: "VN",
        admin: "Vietnam",
        geonunit: "Vietnam",
        name: unit.name,
        name_en: unit.name,
        name_alt: vietnam2025NameAlt(unit, memberProps),
        name_local: "",
        gn_name: unit.name,
        type,
        type_en: typeEn,
        region: "",
        longitude: averageNumber(memberProps.map((props) => props.longitude)),
        latitude: averageNumber(memberProps.map((props) => props.latitude)),
        postal: "",
        wikidataid: isMerged ? undefined : representative.wikidataid,
      },
      type: "Feature",
    };
  });
}

export function applyTopologyFeatureOverrides(
  topology: unknown,
  rawGeometries: RawTopoGeometry[],
  features: RawSubdivisionFeature[],
) {
  const mergedVietnamFeatures = vietnam2025Features(topology, rawGeometries);
  if (!mergedVietnamFeatures) {
    return features;
  }

  return [
    ...features.filter((feature) => feature.properties?.adm0_a3 !== "VNM"),
    ...mergedVietnamFeatures,
  ];
}
