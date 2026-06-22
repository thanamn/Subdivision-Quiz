import { loadAdmin1Topology } from "../geo/topology";
import type { CountryRegionLookup } from "../geo/topologyTypes";
import type { SubdivisionFeature } from "../domain/types";

export type LoadedSubdivisionData = {
  countryRegions: CountryRegionLookup;
  features: SubdivisionFeature[];
};

export async function loadSubdivisionData(
  dataUrl: string,
  countryRegionsUrl: string,
): Promise<LoadedSubdivisionData> {
  const [topologyResponse, countryRegionsResponse] = await Promise.all([
    fetch(dataUrl),
    fetch(countryRegionsUrl),
  ]);
  if (!topologyResponse.ok) {
    throw new Error(`${topologyResponse.status} ${topologyResponse.statusText}`);
  }
  if (!countryRegionsResponse.ok) {
    throw new Error(
      `${countryRegionsResponse.status} ${countryRegionsResponse.statusText}`,
    );
  }

  const [topology, countryRegions] = await Promise.all([
    topologyResponse.json(),
    countryRegionsResponse.json(),
  ]);

  return {
    countryRegions,
    features: loadAdmin1Topology(topology, countryRegions),
  };
}
