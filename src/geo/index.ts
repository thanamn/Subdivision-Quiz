export type { CountryRegionLookup } from "./topologyTypes";
export {
  assignCountryColorIndices,
  countryAdjacencyFromFeatures,
  preferredCountryColorIndex,
} from "./countryColors";
export { normalizeGuess } from "./normalization";
export { buildNameIndex } from "./nameIndex";
export {
  buildCountrySummaries,
  buildRegionSummaries,
  byCountryThenName,
  featureInScope,
  scopeKey,
  scopeLabel,
} from "./scope";
export { loadAdmin1Topology } from "./topology";
