import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";

const DEFAULT_ALPHABET = "abcdefghijklmnopqrstuvwxyz";
const DEFAULT_OUTPUT_DIR = "output/short-latin-match-audit";
const DEFAULT_SCOPES = "all";

function parseArgs(argv) {
  const options = {
    alphabet: DEFAULT_ALPHABET,
    allowLarge: false,
    maxLength: 3,
    outputDir: DEFAULT_OUTPUT_DIR,
    scopes: DEFAULT_SCOPES,
  };

  for (const arg of argv) {
    if (arg === "--allow-large") {
      options.allowLarge = true;
      continue;
    }

    const [name, value] = arg.split("=", 2);
    if (!value) {
      throw new Error(`Expected --name=value option, got ${arg}`);
    }

    if (name === "--alphabet") {
      options.alphabet = value;
    } else if (name === "--max-length") {
      options.maxLength = Number(value);
    } else if (name === "--out") {
      options.outputDir = value;
    } else if (name === "--scopes") {
      options.scopes = value;
    } else {
      throw new Error(`Unknown option: ${name}`);
    }
  }

  if (!Number.isInteger(options.maxLength) || options.maxLength < 1) {
    throw new Error("--max-length must be a positive integer");
  }

  if (!options.alphabet || new Set(options.alphabet).size !== options.alphabet.length) {
    throw new Error("--alphabet must contain unique characters");
  }

  return options;
}

function selectedScopeKinds(value) {
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  const expanded = parts.includes("all")
    ? ["world", "regions", "countries"]
    : parts;
  const allowed = new Set(["world", "regions", "countries"]);

  for (const part of expanded) {
    if (!allowed.has(part)) {
      throw new Error(
        `Unsupported scope '${part}'. Use world, regions, countries, or all.`,
      );
    }
  }

  return new Set(expanded);
}

function countQueries(alphabetLength, maxLength) {
  let total = 0;
  for (let length = 1; length <= maxLength; length += 1) {
    total += alphabetLength ** length;
  }
  return total;
}

function* generateQueries(alphabet, maxLength) {
  function* build(prefix, remaining) {
    if (remaining === 0) {
      yield prefix;
      return;
    }

    for (const char of alphabet) {
      yield* build(`${prefix}${char}`, remaining - 1);
    }
  }

  for (let length = 1; length <= maxLength; length += 1) {
    yield* build("", length);
  }
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows, columns) {
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => csvCell(row[column])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function objectFromSortedMap(map) {
  return Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function matchedAliases(feature, normalizedQuery, normalizeGuess) {
  const aliases = [];
  const seen = new Set();

  for (const alias of feature.properties.aliases) {
    if (normalizeGuess(alias) !== normalizedQuery || seen.has(alias)) {
      continue;
    }

    seen.add(alias);
    aliases.push(alias);
  }

  return aliases;
}

function scopeFeatureList(scope, allFeatures, featureInScope) {
  if (scope.kind === "world") {
    return allFeatures;
  }

  return allFeatures.filter((feature) => featureInScope(feature, scope));
}

function buildScopes(scopeKinds, countries, regions) {
  const scopes = [];

  if (scopeKinds.has("world")) {
    scopes.push({ kind: "world", value: "world" });
  }

  if (scopeKinds.has("regions")) {
    for (const region of regions) {
      scopes.push({ kind: "region", value: region.name });
    }
  }

  if (scopeKinds.has("countries")) {
    for (const country of countries) {
      scopes.push({ kind: "country", value: country.code });
    }
  }

  return scopes;
}

function summarize(records, queries, scopes, options) {
  const byLength = new Map();
  const uniqueByLength = new Map();
  const byScopeKind = new Map();
  const queryGroups = new Map();

  for (const record of records) {
    increment(byLength, String(record.length));
    increment(byScopeKind, record.scopeKind);

    const lengthSet = uniqueByLength.get(String(record.length)) || new Set();
    lengthSet.add(record.query);
    uniqueByLength.set(String(record.length), lengthSet);

    const group = queryGroups.get(record.query) || {
      query: record.query,
      length: record.length,
      scopeRecords: 0,
      featureMatches: 0,
      scopeKinds: new Set(),
      scopes: new Set(),
    };
    group.scopeRecords += 1;
    group.featureMatches += record.matchCount;
    group.scopeKinds.add(record.scopeKind);
    group.scopes.add(record.scopeLabel);
    queryGroups.set(record.query, group);
  }

  const uniqueQueryRows = [...queryGroups.values()]
    .map((group) => ({
      query: group.query,
      length: group.length,
      scopeRecords: group.scopeRecords,
      featureMatches: group.featureMatches,
      scopeKinds: [...group.scopeKinds].sort().join("; "),
      scopes: [...group.scopes].sort().join("; "),
    }))
    .sort(
      (a, b) =>
        a.length - b.length ||
        b.scopeRecords - a.scopeRecords ||
        a.query.localeCompare(b.query),
    );

  const oneOrTwo = records.filter((record) => record.length <= 2);

  return {
    summary: {
      alphabet: options.alphabet,
      generatedAt: new Date().toISOString(),
      maxLength: options.maxLength,
      queryCount: queries.length,
      scopeCount: scopes.length,
      acceptedRecordCount: records.length,
      acceptedUniqueQueryCount: queryGroups.size,
      oneOrTwoCharacterRecordCount: oneOrTwo.length,
      oneOrTwoCharacterUniqueQueryCount: new Set(
        oneOrTwo.map((record) => record.query),
      ).size,
      byLength: objectFromSortedMap(byLength),
      uniqueQueriesByLength: Object.fromEntries(
        [...uniqueByLength.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => [key, value.size]),
      ),
      byScopeKind: objectFromSortedMap(byScopeKind),
      topBroadQueries: uniqueQueryRows.slice(0, 40),
    },
    uniqueQueryRows,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const scopeKinds = selectedScopeKinds(options.scopes);
  const queryCount = countQueries(options.alphabet.length, options.maxLength);

  if (
    options.maxLength > 3 &&
    !options.allowLarge &&
    (scopeKinds.has("countries") || scopeKinds.has("regions"))
  ) {
    throw new Error(
      [
        "Length 4 across region/country scopes is intentionally guarded.",
        `It would scan ${queryCount.toLocaleString()} queries against many scopes.`,
        "Use --scopes=world for a smaller length-4 audit, or pass --allow-large.",
      ].join(" "),
    );
  }

  const server = await createServer({
    appType: "custom",
    logLevel: "error",
    server: { middlewareMode: true },
  });

  try {
    const {
      buildCountrySummaries,
      buildNameIndex,
      buildRegionSummaries,
      featureInScope,
      loadAdmin1Topology,
      normalizeGuess,
      scopeLabel,
    } = await server.ssrLoadModule("/src/geo/index.ts");

    const [topology, countryRegions] = await Promise.all([
      readFile("public/data/admin1.topo.json", "utf8").then(JSON.parse),
      readFile("public/data/country-regions.json", "utf8").then(JSON.parse),
    ]);
    const allFeatures = loadAdmin1Topology(topology, countryRegions);
    const countries = buildCountrySummaries(allFeatures);
    const regions = buildRegionSummaries(countries);
    const scopes = buildScopes(scopeKinds, countries, regions);
    const queries = [...generateQueries(options.alphabet, options.maxLength)];
    const records = [];

    for (const scope of scopes) {
      const features = scopeFeatureList(scope, allFeatures, featureInScope);
      const index = buildNameIndex(features);
      const label = scopeLabel(scope, countries);

      for (const query of queries) {
        const normalized = normalizeGuess(query);
        const matches = index.get(normalized) || [];

        if (!matches.length) {
          continue;
        }

        records.push({
          query,
          length: query.length,
          normalized,
          scopeKind: scope.kind,
          scopeValue: scope.value,
          scopeLabel: label,
          matchCount: matches.length,
          matches: matches.map((feature) => ({
            id: feature.properties.id,
            name: feature.properties.name,
            country: feature.properties.country,
            countryCode: feature.properties.countryCode,
            type: feature.properties.typeEn,
            aliases: matchedAliases(feature, normalized, normalizeGuess),
          })),
        });
      }
    }

    records.sort(
      (a, b) =>
        a.length - b.length ||
        a.query.localeCompare(b.query) ||
        a.scopeKind.localeCompare(b.scopeKind) ||
        a.scopeLabel.localeCompare(b.scopeLabel),
    );

    const { summary, uniqueQueryRows } = summarize(records, queries, scopes, options);
    const outputDir = path.resolve(options.outputDir);
    await mkdir(outputDir, { recursive: true });

    const csvRows = records.map((record) => ({
      query: record.query,
      length: record.length,
      normalized: record.normalized,
      scopeKind: record.scopeKind,
      scopeValue: record.scopeValue,
      scopeLabel: record.scopeLabel,
      matchCount: record.matchCount,
      matches: record.matches
        .map(
          (match) =>
            `${match.countryCode}:${match.name} [${match.id}] via ${match.aliases.join("|")}`,
        )
        .join("; "),
    }));
    const oneOrTwoRows = csvRows.filter((row) => row.length <= 2);

    await Promise.all([
      writeFile(
        path.join(outputDir, "short-latin-matches.json"),
        `${JSON.stringify(records, null, 2)}\n`,
      ),
      writeFile(
        path.join(outputDir, "short-latin-matches.csv"),
        toCsv(csvRows, [
          "query",
          "length",
          "normalized",
          "scopeKind",
          "scopeValue",
          "scopeLabel",
          "matchCount",
          "matches",
        ]),
      ),
      writeFile(
        path.join(outputDir, "short-latin-one-two.csv"),
        toCsv(oneOrTwoRows, [
          "query",
          "length",
          "normalized",
          "scopeKind",
          "scopeValue",
          "scopeLabel",
          "matchCount",
          "matches",
        ]),
      ),
      writeFile(
        path.join(outputDir, "short-latin-unique-queries.csv"),
        toCsv(uniqueQueryRows, [
          "query",
          "length",
          "scopeRecords",
          "featureMatches",
          "scopeKinds",
          "scopes",
        ]),
      ),
      writeFile(
        path.join(outputDir, "summary.json"),
        `${JSON.stringify(summary, null, 2)}\n`,
      ),
    ]);

    console.log(`Scanned ${queries.length.toLocaleString()} queries across ${scopes.length.toLocaleString()} scopes.`);
    console.log(`Accepted records: ${records.length.toLocaleString()}`);
    console.log(`Unique accepted queries: ${summary.acceptedUniqueQueryCount.toLocaleString()}`);
    console.log(`One/two-character accepted records: ${summary.oneOrTwoCharacterRecordCount.toLocaleString()}`);
    console.log(`Wrote audit files to ${outputDir}`);
  } finally {
    await server.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
