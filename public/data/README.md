# Map Data

`admin1.topo.json` is generated from Natural Earth's **Admin 1 - States,
Provinces** 1:10m cultural vector dataset.

The current checked-in file was generated from Natural Earth Admin-1 version
5.1.1, fetched from Natural Earth's CDN on June 3, 2026.

`country-regions.json` is generated from the `world-countries` package and is
used to group countries into region quizzes and identify native-language codes
for Wikidata label lookups.

Native-script subdivision names come from two places. The build script first
pulls matching Natural Earth language columns into compact `native_names`
entries, then strips the bulky source translation columns from the TopoJSON.
It then enriches every subdivision with a Wikidata ID and an applicable country
language using Wikidata labels. Wikidata lookups are cached in
`data/raw/wikidata-native-labels.json` so future rebuilds can resume quickly.
Country and smaller region quizzes may still load Wikidata aliases at runtime
for answer matching, but display names are baked into the generated data.

Natural Earth states that this dataset contains "over 4,500 internal
administrative divisions" and that Natural Earth map data is public domain.
The generated file keeps only the fields used by the quiz and simplifies the
geometry for browser rendering.

Some fast-moving administrative changes are applied at app load time when
Natural Earth has not caught up yet. Vietnam's 2025 reorganization is merged
from the checked-in Natural Earth source geometries into 34 current
provincial-level units in `src/geo.ts`.

See `freshness-audit.md` for other checked countries with known stale or
mixed-level Admin-1 data.

Run this to rebuild it:

```sh
npm run data
```

To rebuild only the Natural Earth data without Wikidata native-label
enrichment, run:

```sh
$env:SKIP_WIKIDATA_NATIVE_NAMES = "1"; npm run data
```

Source:
https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/
