import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { RegionSummary, Scope } from "../domain/types";
import { normalizeGuess } from "../geo";

export function RegionSearch({
  regions,
  scope,
  setScope,
}: {
  regions: RegionSummary[];
  scope: Scope;
  setScope: (scope: Scope) => void;
}) {
  const [regionSearch, setRegionSearch] = useState("");
  const [regionSearchOpen, setRegionSearchOpen] = useState(false);
  const [regionHighlightIndex, setRegionHighlightIndex] = useState(0);
  const selectedRegion =
    scope.kind === "region"
      ? regions.find((region) => region.name === scope.value)
      : undefined;
  const regionSearchTerm = normalizeGuess(regionSearch);
  const filteredRegions = useMemo(
    () =>
      regionSearchTerm
        ? regions.filter((region) =>
            normalizeGuess(region.name).includes(regionSearchTerm),
          )
        : regions,
    [regionSearchTerm, regions],
  );

  useEffect(() => {
    setRegionHighlightIndex((current) =>
      filteredRegions.length ? Math.min(current, filteredRegions.length - 1) : 0,
    );
  }, [filteredRegions]);

  function openRegionSearch() {
    const selectedIndex = selectedRegion
      ? regions.findIndex((region) => region.name === selectedRegion.name)
      : -1;
    setRegionSearch("");
    setRegionHighlightIndex(Math.max(selectedIndex, 0));
    setRegionSearchOpen(true);
  }

  function selectRegion(region: RegionSummary) {
    setScope({ kind: "region", value: region.name });
    setRegionSearch("");
    setRegionSearchOpen(false);
    setRegionHighlightIndex(0);
  }

  function handleRegionSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setRegionSearchOpen(true);
      setRegionHighlightIndex((current) =>
        filteredRegions.length ? Math.min(current + 1, filteredRegions.length - 1) : 0,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setRegionSearchOpen(true);
      setRegionHighlightIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      if (filteredRegions.length) {
        event.preventDefault();
        selectRegion(filteredRegions[regionHighlightIndex] || filteredRegions[0]);
      }
      return;
    }

    if (event.key === "Escape") {
      setRegionSearchOpen(false);
      setRegionSearch("");
    }
  }

  return (
    <div
      className="select-control region-select scope-combobox"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setRegionSearchOpen(false);
          setRegionSearch("");
        }
      }}
    >
      <label htmlFor="region-search">Region</label>
      <div className="scope-search-box">
        <Search className="scope-search-icon" size={16} aria-hidden="true" />
        <input
          id="region-search"
          className="scope-search-input"
          value={regionSearch}
          placeholder={
            regionSearchOpen
              ? "Type to narrow regions"
              : selectedRegion?.name || "Choose region"
          }
          role="combobox"
          aria-autocomplete="list"
          aria-controls="region-search-results"
          aria-expanded={regionSearchOpen}
          aria-activedescendant={
            regionSearchOpen && filteredRegions[regionHighlightIndex]
              ? `region-option-${regionHighlightIndex}`
              : undefined
          }
          autoComplete="off"
          onChange={(event) => {
            setRegionSearch(event.target.value);
            setRegionHighlightIndex(0);
            setRegionSearchOpen(true);
          }}
          onFocus={(event) => {
            event.currentTarget.select();
            openRegionSearch();
          }}
          onClick={openRegionSearch}
          onKeyDown={handleRegionSearchKeyDown}
        />
        <ChevronDown className="scope-search-chevron" size={16} aria-hidden="true" />
        {regionSearchOpen ? (
          <div
            id="region-search-results"
            className="scope-search-results"
            role="listbox"
            aria-label="Region results"
          >
            {filteredRegions.length ? (
              filteredRegions.map((region, index) => (
                <button
                  id={`region-option-${index}`}
                  key={region.name}
                  type="button"
                  className={
                    index === regionHighlightIndex
                      ? "scope-search-result is-active"
                      : "scope-search-result"
                  }
                  role="option"
                  aria-selected={scope.kind === "region" && scope.value === region.name}
                  aria-label={`${region.name}, ${region.count.toLocaleString()} subdivisions, ${region.countries.toLocaleString()} countries`}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setRegionHighlightIndex(index)}
                  onClick={() => selectRegion(region)}
                >
                  <span>{region.name}</span>
                  <small>
                    {region.count.toLocaleString()} subdivisions |{" "}
                    {region.countries.toLocaleString()} countries
                  </small>
                </button>
              ))
            ) : (
              <div className="scope-search-empty">No regions found.</div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
