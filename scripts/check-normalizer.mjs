import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../src/geo.ts", import.meta.url), "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const module = { exports: {} };

vm.runInNewContext(transpiled, {
  exports: module.exports,
  module,
  require,
});

const { buildNameIndex, loadAdmin1Topology, normalizeGuess } = module.exports;

assert.equal(normalizeGuess("Quebec"), normalizeGuess("Québec"));
assert.equal(normalizeGuess("Dong Nai"), normalizeGuess("Đồng Nai"));
assert.equal(normalizeGuess("Tromso"), normalizeGuess("Tromsø"));
assert.equal(normalizeGuess("Saint-Pierre"), "saint pierre");
assert.equal(normalizeGuess("A & B"), "a and b");

assert.notEqual(normalizeGuess("จังหวัดน่าน"), normalizeGuess("จงหวดนาน"));
assert.notEqual(normalizeGuess("น่าน"), normalizeGuess("นาน"));
assert.notEqual(normalizeGuess("เชียงใหม่"), normalizeGuess("เชยงใหม"));
assert.notEqual(normalizeGuess("が"), normalizeGuess("か"));

const [topology, countryRegions] = await Promise.all([
  readFile(new URL("../public/data/admin1.topo.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../public/data/country-regions.json", import.meta.url), "utf8").then(JSON.parse),
]);
const thailandFeatures = loadAdmin1Topology(topology, countryRegions).filter(
  (feature) => feature.properties.countryCode === "THA",
);
const thailandIndex = buildNameIndex(thailandFeatures);

const nanMatches = thailandIndex
  .get(normalizeGuess("จังหวัดน่าน"))
  ?.map((feature) => feature.properties.name)
  .join("|");

assert.equal(nanMatches, "Nan");
assert.equal(thailandIndex.has(normalizeGuess("จงหวดนาน")), false);

console.log("Normalizer checks passed.");
