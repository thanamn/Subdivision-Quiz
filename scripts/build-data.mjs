import extract from "extract-zip";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import worldCountries from "world-countries";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rawDir = path.join(root, "data", "raw");
const outDir = path.join(root, "public", "data");
const zipPath = path.join(rawDir, "ne_10m_admin_1_states_provinces.zip");
const extractDir = path.join(rawDir, "ne_admin1");
const shapePath = path.join(extractDir, "ne_10m_admin_1_states_provinces.shp");
const outputPath = path.join(outDir, "admin1.topo.json");
const countryRegionsPath = path.join(outDir, "country-regions.json");
const wikidataCachePath = path.join(rawDir, "wikidata-native-labels.json");
const sourceUrl =
  "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_1_states_provinces.zip";

const multilingualNameFields = [
  "name_ar",
  "name_bn",
  "name_de",
  "name_el",
  "name_es",
  "name_fa",
  "name_fr",
  "name_he",
  "name_hi",
  "name_hu",
  "name_id",
  "name_it",
  "name_ja",
  "name_ko",
  "name_nl",
  "name_pl",
  "name_pt",
  "name_ru",
  "name_sv",
  "name_tr",
  "name_uk",
  "name_ur",
  "name_vi",
  "name_zh",
  "name_zht",
];
const languageFieldByCode = {
  ar: "name_ar",
  bn: "name_bn",
  de: "name_de",
  el: "name_el",
  es: "name_es",
  fa: "name_fa",
  fr: "name_fr",
  he: "name_he",
  hi: "name_hi",
  hu: "name_hu",
  id: "name_id",
  it: "name_it",
  ja: "name_ja",
  ko: "name_ko",
  nl: "name_nl",
  pl: "name_pl",
  pt: "name_pt",
  ru: "name_ru",
  sv: "name_sv",
  tr: "name_tr",
  uk: "name_uk",
  ur: "name_ur",
  vi: "name_vi",
  zh: "name_zh",
  "zh-hant": "name_zht",
};

const fields = [
  "adm1_code",
  "adm0_a3",
  "iso_a2",
  "admin",
  "geonunit",
  "name",
  "name_en",
  "name_alt",
  "name_local",
  "gn_name",
  "type",
  "type_en",
  "region",
  "longitude",
  "latitude",
  "postal",
  "iso_3166_2",
  "wikidataid",
  ...multilingualNameFields,
].join(",");

const ISO3_TO_WIKIDATA_LANG = {
  afr: "af",
  amh: "am",
  ara: "ar",
  aym: "ay",
  aze: "az",
  bar: "bar",
  bel: "be",
  ben: "bn",
  ber: "zgh",
  bis: "bi",
  bos: "bs",
  bul: "bg",
  cat: "ca",
  ces: "cs",
  cha: "ch",
  ckb: "ckb",
  cnr: ["sr-ec", "sr-el"],
  dan: "da",
  deu: "de",
  div: "dv",
  dzo: "dz",
  ell: "el",
  eng: "en",
  est: "et",
  fas: "fa",
  fao: "fo",
  fij: "fj",
  fil: "tl",
  fin: "fi",
  fra: "fr",
  gle: "ga",
  glv: "gv",
  grn: "gn",
  gsw: "gsw",
  guj: "gu",
  hat: "ht",
  hau: "ha",
  heb: "he",
  her: "hz",
  hin: "hi",
  hmo: "ho",
  hrv: "hr",
  hun: "hu",
  hye: "hy",
  ind: "id",
  isl: "is",
  ita: "it",
  jam: "jam",
  jpn: "ja",
  kal: "kl",
  kan: "kn",
  kat: "ka",
  kaz: "kk",
  khm: "km",
  kin: "rw",
  kir: "ky",
  kon: "kg",
  kor: "ko",
  lao: "lo",
  lat: "la",
  lav: "lv",
  lin: "ln",
  lit: "lt",
  ltz: "lb",
  lub: "lu",
  mah: "mh",
  mal: "ml",
  mar: "mr",
  mkd: "mk",
  mlg: "mg",
  mlt: "mt",
  mon: "mn",
  mri: "mi",
  msa: "ms",
  mya: "my",
  nau: "na",
  nde: "nr",
  nep: "ne",
  nld: "nl",
  nno: "nn",
  nob: "nb",
  nor: "no",
  nya: "ny",
  pap: "pap",
  pau: "pau",
  pol: "pl",
  por: "pt",
  prs: "prs",
  pus: "ps",
  que: "qu",
  rar: "rar",
  ron: "ro",
  roh: "rm",
  run: "rn",
  rus: "ru",
  sag: "sg",
  sin: "si",
  slk: "sk",
  slv: "sl",
  smo: "sm",
  sna: "sn",
  som: "so",
  sot: "st",
  spa: "es",
  sqi: "sq",
  srp: "sr",
  ssw: "ss",
  swa: "sw",
  swe: "sv",
  tam: "ta",
  tel: "te",
  tet: "tet",
  tgk: "tg",
  tgl: "tl",
  tha: "th",
  tir: "ti",
  ton: "to",
  tsn: "tn",
  tso: "ts",
  tuk: "tk",
  tur: "tr",
  tvl: "tvl",
  ukr: "uk",
  urd: "ur",
  uzb: "uz",
  ven: "ve",
  vie: "vi",
  xho: "xh",
  zdj: "zdj",
  zho: "zh",
  zul: "zu",
};

const WIKIDATA_QUERY_ENDPOINT = "https://query.wikidata.org/sparql";
const WIKIDATA_BATCH_SIZE = 35;
const WIKIDATA_REQUEST_DELAY_MS = 75;
const WIKIDATA_REQUEST_TIMEOUT_MS = 20000;
const shouldEnrichWikidataNativeNames =
  process.env.SKIP_WIKIDATA_NATIVE_NAMES !== "1";
const COUNTRY_PREFERRED_LANGUAGE_CODES = {
  HKG: ["zh-hant", "zh", "en"],
  MAC: ["zh-hant", "zh", "pt"],
  TWN: ["zh-hant", "zh"],
};
const COUNTRY_REGION_OVERRIDES = {
  ALD: {
    languageCodes: ["sv"],
    name: "Aland",
    region: "Europe",
    subregion: "Northern Europe",
  },
  ATC: {
    languageCodes: ["en"],
    name: "Ashmore and Cartier Islands",
    region: "Oceania",
    subregion: "Australia and New Zealand",
  },
  ATA: {
    languageCodes: [],
    name: "Antarctica",
    region: "Antarctic",
    subregion: "Other",
  },
  CLP: {
    languageCodes: ["fr"],
    name: "Clipperton Island",
    region: "Americas",
    subregion: "Central America",
  },
  CSI: {
    languageCodes: ["en"],
    name: "Coral Sea Islands",
    region: "Oceania",
    subregion: "Australia and New Zealand",
  },
  CYN: {
    languageCodes: ["tr", "el"],
    name: "Northern Cyprus",
    region: "Asia",
    subregion: "Western Asia",
  },
  ESB: {
    languageCodes: ["en", "el"],
    name: "Dhekelia Sovereign Base Area",
    region: "Asia",
    subregion: "Western Asia",
  },
  IOA: {
    languageCodes: ["en"],
    name: "Indian Ocean Territories",
    region: "Asia",
    subregion: "South-Eastern Asia",
  },
  KAB: {
    languageCodes: ["kk", "ru"],
    name: "Baikonur",
    region: "Asia",
    subregion: "Central Asia",
  },
  KAS: {
    languageCodes: ["hi", "ur"],
    name: "Siachen Glacier",
    region: "Asia",
    subregion: "Southern Asia",
  },
  KOS: {
    languageCodes: ["sq", "sr"],
    name: "Kosovo",
    region: "Europe",
    subregion: "Southeast Europe",
  },
  PGA: {
    languageCodes: ["zh", "vi", "tl"],
    name: "Spratly Islands",
    region: "Asia",
    subregion: "South-Eastern Asia",
  },
  PSX: {
    languageCodes: ["ar", "he"],
    name: "Palestine",
    region: "Asia",
    subregion: "Western Asia",
  },
  SAH: {
    languageCodes: ["ar", "zgh", "es"],
    name: "Western Sahara",
    region: "Africa",
    subregion: "Northern Africa",
  },
  SDS: {
    languageCodes: ["en"],
    name: "South Sudan",
    region: "Africa",
    subregion: "Middle Africa",
  },
  SOL: {
    languageCodes: ["so", "ar"],
    name: "Somaliland",
    region: "Africa",
    subregion: "Eastern Africa",
  },
  USG: {
    languageCodes: ["en", "es"],
    name: "Guantanamo Bay Naval Base",
    region: "Americas",
    subregion: "Caribbean",
  },
  WSB: {
    languageCodes: ["en", "el"],
    name: "Akrotiri Sovereign Base Area",
    region: "Asia",
    subregion: "Western Asia",
  },
};

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['\u2019]/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}

function languageCodesFor(country) {
  return unique([
    ...(COUNTRY_PREFERRED_LANGUAGE_CODES[country.cca3] || []),
    ...Object.keys(country.languages || {})
    .flatMap((language) => ISO3_TO_WIKIDATA_LANG[language] || [])
    .filter(Boolean),
  ]);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function cacheKeyFor(qid, lang) {
  return `${qid}|${lang}`;
}

async function fetchWikidataBatch(qids, languages, attempt = 1) {
  const values = qids.map((qid) => `wd:${qid}`).join(" ");
  const languageFilter = languages.map((lang) => `"${lang}"`).join(", ");
  const query = `
    SELECT ?item ?label WHERE {
      VALUES ?item { ${values} }
      ?item rdfs:label ?label .
      FILTER(LANG(?label) IN (${languageFilter}))
    }
  `;
  const url = `${WIKIDATA_QUERY_ENDPOINT}?${new URLSearchParams({
    format: "json",
    query,
  })}`;

  let response;
  try {
    response = await fetch(url, {
      headers: {
        accept: "application/sparql-results+json",
        "user-agent": "SubdivisionQuiz/0.1 local data builder",
      },
      signal: AbortSignal.timeout(WIKIDATA_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (attempt <= 5) {
      const delay = 1000 * attempt * attempt;
      console.warn(
        `Wikidata request failed (${error.name || "error"}); retrying in ${Math.round(
          delay / 1000,
        )}s...`,
      );
      await sleep(delay);
      return fetchWikidataBatch(qids, languages, attempt + 1);
    }

    throw error;
  }

  if ((response.status === 429 || response.status >= 500) && attempt <= 5) {
    const retryAfter = Number(response.headers.get("retry-after"));
    const delay = Number.isFinite(retryAfter)
      ? retryAfter * 1000
      : 1000 * attempt * attempt;
    console.warn(`Wikidata retry ${attempt}; waiting ${Math.round(delay / 1000)}s...`);
    await sleep(delay);
    return fetchWikidataBatch(qids, languages, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Wikidata labels: ${response.status} ${response.statusText}`,
    );
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(`Wikidata API error: ${payload.error.code} ${payload.error.info}`);
  }

  const entities = {};
  for (const binding of payload.results?.bindings || []) {
    const qid = binding.item?.value?.split("/").pop();
    const lang = binding.label?.["xml:lang"];
    const value = binding.label?.value;

    if (!qid || !lang || !value) {
      continue;
    }

    entities[qid] ||= { labels: {} };
    entities[qid].labels[lang] = { value };
  }

  return { entities };
}

function addWikidataName(labels, qid, lang, value) {
  if (!value) {
    return;
  }

  labels[qid] ||= {};
  labels[qid][lang] ||= [];

  if (!labels[qid][lang].includes(value)) {
    labels[qid][lang].push(value);
  }
}

async function fetchWikidataLabels(labelGroups) {
  const labels = {};
  const cache = await readJsonFile(wikidataCachePath, { labels: {} });
  const requestCount = labelGroups.reduce(
    (count, group) => count + Math.ceil(group.qids.length / WIKIDATA_BATCH_SIZE),
    0,
  );
  const qidCount = unique(labelGroups.flatMap((group) => group.qids)).length;

  if (!qidCount || !requestCount) {
    return labels;
  }

  console.log(
    `Fetching Wikidata labels for ${qidCount} subdivisions in ${requestCount} smaller batches...`,
  );

  let cacheUpdates = 0;

  for (const group of labelGroups) {
    const languages = unique(group.languages);
    if (!languages.length) {
      continue;
    }

    for (let start = 0; start < group.qids.length; start += WIKIDATA_BATCH_SIZE) {
      const chunk = group.qids.slice(start, start + WIKIDATA_BATCH_SIZE);
      const uncachedQids = chunk.filter((qid) =>
        languages.some((lang) => !Array.isArray(cache.labels[cacheKeyFor(qid, lang)])),
      );

      for (const qid of chunk) {
        for (const lang of languages) {
          for (const cachedName of cache.labels[cacheKeyFor(qid, lang)] || []) {
            addWikidataName(labels, qid, lang, cachedName);
          }
        }
      }

      if (!uncachedQids.length) {
        continue;
      }

      let payload;
      try {
        payload = await fetchWikidataBatch(uncachedQids, languages);
      } catch (error) {
        console.warn(
          `Skipping Wikidata batch after retries: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        continue;
      }

      for (const qid of uncachedQids) {
        for (const lang of languages) {
          cache.labels[cacheKeyFor(qid, lang)] = [];
        }
      }

      for (const [qid, entity] of Object.entries(payload.entities || {})) {
        for (const [lang, label] of Object.entries(entity.labels || {})) {
          addWikidataName(labels, qid, lang, label.value);
          cache.labels[cacheKeyFor(qid, lang)] = [label.value];
          cacheUpdates += 1;
        }
      }

      await writeFile(wikidataCachePath, JSON.stringify(cache));
      await sleep(WIKIDATA_REQUEST_DELAY_MS);
    }
  }

  console.log(`Cached ${cacheUpdates} Wikidata native label lookups`);
  return labels;
}

function buildWikidataLabelGroups(geometries, countryRegions) {
  const groups = new Map();

  for (const geometry of geometries) {
    const props = geometry.properties || {};
    const qid = props.wikidataid;
    const languages = countryRegions[props.adm0_a3]?.languageCodes || [];

    if (!/^Q\d+$/.test(qid) || !languages.length) {
      continue;
    }

    const key = languages.join("|");
    const group = groups.get(key) || {
      languages,
      qids: [],
    };
    group.qids.push(qid);
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => ({
    ...group,
    qids: unique(group.qids),
  }));
}

function addNativeName(names, seen, primaryNormalized, lang, name) {
  const normalized = normalizeName(name);

  if (!name || !normalized || normalized === primaryNormalized || seen.has(normalized)) {
    return;
  }

  seen.add(normalized);
  names.push({ lang, name });
}

function enrichTopologyWithNaturalEarthNativeNames(topology, countryRegions) {
  const objectName = Object.keys(topology.objects)[0];
  const geometries = topology.objects[objectName].geometries || [];
  let nativeNameCount = 0;

  for (const geometry of geometries) {
    const props = geometry.properties || {};
    const languageCodes = countryRegions[props.adm0_a3]?.languageCodes || [];
    const primaryNormalized = normalizeName(props.name_en || props.name || props.gn_name);
    const localNames = [];
    const seen = new Set();

    for (const nativeName of props.native_names || []) {
      addNativeName(localNames, seen, primaryNormalized, nativeName.lang, nativeName.name);
    }

    for (const lang of languageCodes) {
      const field = languageFieldByCode[lang];
      addNativeName(localNames, seen, primaryNormalized, lang, props[field]);
    }

    if (localNames.length) {
      props.native_names = localNames.slice(0, 3);
      nativeNameCount += 1;
    } else {
      delete props.native_names;
    }

    for (const field of multilingualNameFields) {
      delete props[field];
    }

    geometry.properties = props;
  }

  return nativeNameCount;
}

function enrichTopologyWithNativeNames(topology, countryRegions, wikidataLabels) {
  const objectName = Object.keys(topology.objects)[0];
  const geometries = topology.objects[objectName].geometries || [];
  let nativeNameCount = 0;

  for (const geometry of geometries) {
    const props = geometry.properties || {};
    const languageCodes = countryRegions[props.adm0_a3]?.languageCodes || [];
    const qidLabels = wikidataLabels[props.wikidataid] || {};
    const primaryNormalized = normalizeName(props.name_en || props.name || props.gn_name);
    const localNames = [];
    const seen = new Set();

    for (const lang of languageCodes) {
      const candidates = qidLabels[lang] || [];

      for (const label of candidates) {
        addNativeName(localNames, seen, primaryNormalized, lang, label);
      }
    }

    if (localNames.length) {
      props.native_names = localNames.slice(0, 3);
      geometry.properties = props;
      nativeNameCount += 1;
    }
  }

  return nativeNameCount;
}

async function download(url, destination) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const body = Buffer.from(await response.arrayBuffer());
  await writeFile(destination, body);
}

function mapshaperBin() {
  return path.join(root, "node_modules", "mapshaper", "bin", "mapshaper");
}

async function main() {
  await mkdir(rawDir, { recursive: true });
  await mkdir(outDir, { recursive: true });
  await rm(extractDir, { recursive: true, force: true });
  await mkdir(extractDir, { recursive: true });

  console.log("Downloading Natural Earth ADM1 data...");
  await download(sourceUrl, zipPath);

  console.log("Extracting shapefile...");
  await extract(zipPath, { dir: extractDir });

  console.log("Converting to simplified TopoJSON...");
  const { stderr } = await execFileAsync(process.execPath, [
    mapshaperBin(),
    shapePath,
    "-filter-fields",
    fields,
    "-simplify",
    "4%",
    "keep-shapes",
    "-clean",
    "-o",
    "format=topojson",
    outputPath,
  ]);

  if (stderr.trim()) {
    console.warn(stderr.trim());
  }

  const countryRegions = Object.fromEntries(
    [
      ...worldCountries.map((country) => [
      country.cca3,
      {
        languageCodes: languageCodesFor(country),
        name: country.name?.common || country.cca3,
        region: country.region || "Other",
        subregion: country.subregion || "Other",
      },
      ]),
      ...Object.entries(COUNTRY_REGION_OVERRIDES),
    ],
  );
  const topology = JSON.parse(await readFile(outputPath, "utf8"));
  const objectName = Object.keys(topology.objects)[0];
  const geometries = topology.objects[objectName].geometries || [];
  const naturalEarthNativeNameCount = enrichTopologyWithNaturalEarthNativeNames(
    topology,
    countryRegions,
  );
  let nativeNameCount = 0;
  if (shouldEnrichWikidataNativeNames) {
    const wikidataLabels = await fetchWikidataLabels(
      buildWikidataLabelGroups(geometries, countryRegions),
    );
    nativeNameCount = enrichTopologyWithNativeNames(
      topology,
      countryRegions,
      wikidataLabels,
    );
  }

  await writeFile(outputPath, JSON.stringify(topology));
  await writeFile(countryRegionsPath, JSON.stringify(countryRegions, null, 2));

  console.log(`Wrote ${path.relative(root, outputPath)}`);
  console.log(`Wrote ${path.relative(root, countryRegionsPath)}`);
  console.log(
    `Added Natural Earth local names to ${naturalEarthNativeNameCount} subdivisions`,
  );
  if (shouldEnrichWikidataNativeNames) {
    console.log(`Added native-script names to ${nativeNameCount} subdivisions`);
  } else {
    console.log("Skipped Wikidata native-name enrichment.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
