import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rawDir = path.join(root, "data", "raw");
const outDir = path.join(root, "public", "data");
const topologyPath = path.join(outDir, "admin1.topo.json");
const outputPath = path.join(outDir, "subdivision-media.json");
const cachePath = path.join(rawDir, "wikidata-subdivision-media.json");

const WIKIDATA_QUERY_ENDPOINT = "https://query.wikidata.org/sparql";
const COMMONS_API_ENDPOINT = "https://commons.wikimedia.org/w/api.php";
const WIKIDATA_BATCH_SIZE = 35;
const COMMONS_BATCH_SIZE = 50;
const REQUEST_DELAY_MS = 100;
const REQUEST_TIMEOUT_MS = 20000;
const THUMBNAIL_WIDTH = 180;
const CACHE_VERSION = 2;

const PLACEHOLDER_FILE_PATTERN =
  /\b(no flag|noflag|placeholder|missing flag|unknown flag|generic flag)\b/i;

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function chunks(values, size) {
  const groups = [];
  for (let start = 0; start < values.length; start += size) {
    groups.push(values.slice(start, start + size));
  }
  return groups;
}

function cleanText(value) {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function shortenText(value, maxLength = 240) {
  const text = cleanText(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function normalizeFileTitle(value) {
  if (!value) {
    return undefined;
  }

  let title = String(value).trim();
  const filePathMarker = "/Special:FilePath/";
  const filePathIndex = title.indexOf(filePathMarker);
  if (filePathIndex >= 0) {
    title = title.slice(filePathIndex + filePathMarker.length);
  }

  try {
    title = decodeURIComponent(title);
  } catch {
    title = title.replace(/%20/g, " ");
  }

  title = title.replace(/^File:/i, "").replace(/_/g, " ").trim();
  if (!title || PLACEHOLDER_FILE_PATTERN.test(title) || !/\.[a-z0-9]{2,5}$/i.test(title)) {
    return undefined;
  }

  return title;
}

function encodedFileTitle(file) {
  return encodeURIComponent(file);
}

function defaultCommonsMetadata(file) {
  return {
    commonsUrl: `https://commons.wikimedia.org/wiki/File:${encodedFileTitle(file)}`,
    file,
    imageUrl: `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodedFileTitle(
      file,
    )}?width=${THUMBNAIL_WIDTH}`,
  };
}

function qidsFromTopology(topology) {
  const objectName = Object.keys(topology.objects || {})[0];
  const geometries = topology.objects?.[objectName]?.geometries || [];
  return unique(
    geometries
      .map((geometry) => geometry.properties?.wikidataid)
      .filter((qid) => /^Q\d+$/.test(qid)),
  );
}

async function fetchWithRetry(url, options, label, attempt = 1) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        "user-agent": "SubdivisionQuiz/0.1 local media builder",
        ...(options?.headers || {}),
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (attempt <= 5) {
      const delay = 1000 * attempt * attempt;
      console.warn(
        `${label} request failed (${error.name || "error"}); retrying in ${Math.round(
          delay / 1000,
        )}s...`,
      );
      await sleep(delay);
      return fetchWithRetry(url, options, label, attempt + 1);
    }
    throw error;
  }

  if ((response.status === 429 || response.status >= 500) && attempt <= 5) {
    const retryAfter = Number(response.headers.get("retry-after"));
    const delay = Number.isFinite(retryAfter)
      ? retryAfter * 1000
      : 1000 * attempt * attempt;
    console.warn(`${label} retry ${attempt}; waiting ${Math.round(delay / 1000)}s...`);
    await sleep(delay);
    return fetchWithRetry(url, options, label, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(`${label} failed: ${response.status} ${response.statusText}`);
  }

  return response;
}

async function fetchWikidataClaims(qids) {
  const values = qids.map((qid) => `wd:${qid}`).join(" ");
  const query = `
SELECT ?item ?flag ?fallbackFlag ?emblem ?fallbackEmblem WHERE {
  VALUES ?item { ${values} }
  OPTIONAL { ?item wdt:P41 ?flag. }
  OPTIONAL { ?item wdt:P94 ?emblem. }
  OPTIONAL {
    ?item p:P41 ?flagStatement.
    ?flagStatement ps:P41 ?deprecatedFlag;
      wikibase:rank wikibase:DeprecatedRank;
      pq:P518 ?flagAppliesTo.
    ?flagAppliesTo wdt:P41 ?fallbackFlag.
    FILTER(?fallbackFlag = ?deprecatedFlag)
  }
  OPTIONAL {
    ?item p:P94 ?emblemStatement.
    ?emblemStatement ps:P94 ?deprecatedEmblem;
      wikibase:rank wikibase:DeprecatedRank;
      pq:P518 ?emblemAppliesTo.
    ?emblemAppliesTo wdt:P94 ?fallbackEmblem.
    FILTER(?fallbackEmblem = ?deprecatedEmblem)
  }
}`;
  const params = new URLSearchParams({
    format: "json",
    query,
  });
  const response = await fetchWithRetry(
    `${WIKIDATA_QUERY_ENDPOINT}?${params}`,
    {},
    "Wikidata media",
  );
  const payload = await response.json();
  const claims = Object.fromEntries(qids.map((qid) => [qid, {}]));

  for (const binding of payload.results?.bindings || []) {
    const qid = binding.item?.value?.split("/").pop();
    if (!qid) {
      continue;
    }

    const flag = normalizeFileTitle(binding.flag?.value || binding.fallbackFlag?.value);
    const emblem = normalizeFileTitle(
      binding.emblem?.value || binding.fallbackEmblem?.value,
    );
    claims[qid] = {
      ...(claims[qid] || {}),
      ...(flag && !claims[qid]?.flag ? { flag } : {}),
      ...(emblem && !claims[qid]?.emblem ? { emblem } : {}),
    };
  }

  return claims;
}

async function fetchCommonsMetadata(files) {
  const titles = files.map((file) => `File:${file}`).join("|");
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: String(THUMBNAIL_WIDTH),
    titles,
  });
  const response = await fetchWithRetry(
    `${COMMONS_API_ENDPOINT}?${params}`,
    {},
    "Commons metadata",
  );
  const payload = await response.json();
  const metadata = {};

  for (const page of Object.values(payload.query?.pages || {})) {
    const file = normalizeFileTitle(page.title);
    const imageInfo = page.imageinfo?.[0];
    if (!file || !imageInfo) {
      continue;
    }

    const ext = imageInfo.extmetadata || {};
    metadata[file] = {
      attributionRequired: ext.AttributionRequired?.value === "true",
      artist: shortenText(ext.Artist?.value),
      commonsUrl: imageInfo.descriptionurl || defaultCommonsMetadata(file).commonsUrl,
      credit: shortenText(ext.Credit?.value),
      file,
      fullImageUrl: imageInfo.url,
      imageUrl: imageInfo.thumburl || defaultCommonsMetadata(file).imageUrl,
      licenseShortName: cleanText(ext.LicenseShortName?.value),
      licenseUrl: ext.LicenseUrl?.value,
    };
  }

  return metadata;
}

function selectMedia(claim) {
  if (claim?.flag) {
    return { file: claim.flag, kind: "flag" };
  }

  if (claim?.emblem) {
    return { file: claim.emblem, kind: "emblem" };
  }

  return undefined;
}

async function main() {
  await mkdir(rawDir, { recursive: true });
  await mkdir(outDir, { recursive: true });

  const topology = JSON.parse(await readFile(topologyPath, "utf8"));
  const qids = qidsFromTopology(topology);
  const cache = await readJsonFile(cachePath, { claims: {}, files: {} });
  if (cache.version !== CACHE_VERSION) {
    cache.claims = {};
    cache.version = CACHE_VERSION;
  }
  cache.version = CACHE_VERSION;
  cache.claims ||= {};
  cache.files ||= {};

  const uncachedQids = qids.filter((qid) => !(qid in cache.claims));
  console.log(
    `Building subdivision media for ${qids.length.toLocaleString()} Wikidata-backed subdivisions...`,
  );

  for (const group of chunks(uncachedQids, WIKIDATA_BATCH_SIZE)) {
    Object.assign(cache.claims, await fetchWikidataClaims(group));
    await writeFile(cachePath, JSON.stringify(cache));
    await sleep(REQUEST_DELAY_MS);
  }

  const selectedByQid = Object.fromEntries(
    qids
      .map((qid) => [qid, selectMedia(cache.claims[qid])])
      .filter((entry) => entry[1]),
  );
  const mediaFiles = unique(Object.values(selectedByQid).map((media) => media.file));
  const uncachedFiles = mediaFiles.filter((file) => !cache.files[file]);

  for (const group of chunks(uncachedFiles, COMMONS_BATCH_SIZE)) {
    Object.assign(cache.files, await fetchCommonsMetadata(group));
    for (const file of group) {
      cache.files[file] ||= defaultCommonsMetadata(file);
    }
    await writeFile(cachePath, JSON.stringify(cache));
    await sleep(REQUEST_DELAY_MS);
  }

  const media = Object.fromEntries(
    Object.entries(selectedByQid)
      .map(([qid, selected]) => {
        const commons = cache.files[selected.file] || defaultCommonsMetadata(selected.file);
        const attributionRequired = commons.attributionRequired === true;
        return [
          qid,
          {
            ...(attributionRequired ? { attributionRequired } : {}),
            ...(attributionRequired && commons.artist ? { artist: commons.artist } : {}),
            commonsUrl: commons.commonsUrl,
            ...(attributionRequired && commons.credit ? { credit: commons.credit } : {}),
            file: selected.file,
            imageUrl: commons.imageUrl,
            kind: selected.kind,
            ...(commons.licenseShortName
              ? { licenseShortName: commons.licenseShortName }
              : {}),
            ...(commons.licenseUrl ? { licenseUrl: commons.licenseUrl } : {}),
          },
        ];
      })
      .sort(([left], [right]) => left.localeCompare(right)),
  );

  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        media,
        sources: {
          commons: "https://commons.wikimedia.org/",
          wikidata: "https://www.wikidata.org/wiki/Property:P41",
        },
      },
      null,
      2,
    )}\n`,
  );

  console.log(
    `Wrote ${path.relative(root, outputPath)} with ${Object.keys(media).length.toLocaleString()} media entries`,
  );
  console.log(`Cached ${mediaFiles.length.toLocaleString()} Commons media files`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
