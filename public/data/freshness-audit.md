# Administrative Data Freshness Audit

Checked on June 20, 2026.

This project uses Natural Earth Admin-1 version 5.1.1 as its base source. Some
countries have changed their first-level administrative divisions faster than
Natural Earth has updated them.

## Updated In App

- Vietnam: the 2025 reorganization reduced the country from 63 provincial-level
  units to 34. The app now merges the Natural Earth source geometries into the
  current 28 provinces and 6 centrally governed cities at load time.

## Known Gaps Needing New Boundary Sources

- Indonesia: the checked-in Natural Earth data has 33 provinces, but Indonesia
  now has 38 provinces after the 2022 Papua-region province creations. Updating
  this requires splitting old Papua and West Papua source geometries.
- Kazakhstan: the checked-in data predates the 2022 creation of Abai, Jetisu,
  and Ulytau regions, and also misses current city-level first-order handling
  such as Shymkent. Updating this requires splitting existing regions.
- Nepal: the checked-in data still uses the old zone model. Nepal has used 7
  provinces since the 2015 constitution. Updating this requires a province-level
  boundary source rather than merging the old zone geometries.
- Philippines: the checked-in data mixes provinces with independent cities and
  still has the old Maguindanao province rather than Maguindanao del Norte and
  Maguindanao del Sur. Updating this needs a Philippines-specific boundary
  cleanup.

## Sources Used For Audit

- Vietnam Resolution 202/2025/QH15:
  https://english.luatvietnam.vn/co-cau-to-chuc/resolution-202-2025-qh15-reorganization-of-provincial-level-administrative-divisions-402728-d1.html
- Vietnam Law Magazine summary:
  https://vietnamlawmagazine.vn/vietnam-now-has-34-provincial-level-administrative-units-74434.html
- Indonesia 38 provinces:
  https://en.antaranews.com/news/264759/southwest-papua-officially-becomes-indonesias-38th-province
- Kazakhstan 2022 regions:
  https://qazinform.com/news/strong-regions-strong-country-how-three-new-regions-in-kazakhstan-emerge_a4017987
- Nepal 7 provinces:
  https://en.wikipedia.org/wiki/Provinces_of_Nepal
- Philippines 82 provinces:
  https://psa.gov.ph/statistics/ppa/node/1684062410
