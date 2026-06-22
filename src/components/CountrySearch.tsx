import type { KeyboardEvent } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { CountrySummary, Scope } from "../domain/types";

export function CountrySearch({
  countryHighlightIndex,
  countrySearch,
  countrySearchOpen,
  filteredCountries,
  handleCountrySearchKeyDown,
  scope,
  selectedCountry,
  selectCountry,
  setCountryHighlightIndex,
  setCountrySearch,
  setCountrySearchOpen,
}: {
  countryHighlightIndex: number;
  countrySearch: string;
  countrySearchOpen: boolean;
  filteredCountries: CountrySummary[];
  handleCountrySearchKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  scope: Scope;
  selectedCountry?: CountrySummary;
  selectCountry: (country: { code: string; name: string }) => void;
  setCountryHighlightIndex: (index: number) => void;
  setCountrySearch: (value: string) => void;
  setCountrySearchOpen: (value: boolean) => void;
}) {
  return (
    <div
      className="select-control country-select country-combobox"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setCountrySearchOpen(false);
          setCountrySearch("");
        }
      }}
    >
      <label htmlFor="country-search">Country</label>
      <div className="country-search-box">
        <Search className="country-search-icon" size={16} aria-hidden="true" />
        <input
          id="country-search"
          className="country-search-input"
          value={countrySearch}
          placeholder={
            countrySearchOpen
              ? "Type to narrow countries"
              : selectedCountry?.name || "Choose country"
          }
          role="combobox"
          aria-autocomplete="list"
          aria-controls="country-search-results"
          aria-expanded={countrySearchOpen}
          aria-activedescendant={
            countrySearchOpen && filteredCountries[countryHighlightIndex]
              ? `country-option-${filteredCountries[countryHighlightIndex].code}`
              : undefined
          }
          autoComplete="off"
          onChange={(event) => {
            setCountrySearch(event.target.value);
            setCountrySearchOpen(true);
          }}
          onFocus={(event) => {
            event.currentTarget.select();
            setCountrySearch("");
            setCountrySearchOpen(true);
          }}
          onClick={() => {
            setCountrySearch("");
            setCountrySearchOpen(true);
          }}
          onKeyDown={handleCountrySearchKeyDown}
        />
        <ChevronDown className="country-search-chevron" size={16} aria-hidden="true" />
        {countrySearchOpen ? (
          <div
            id="country-search-results"
            className="country-search-results"
            role="listbox"
            aria-label="Country results"
          >
            {filteredCountries.length ? (
              filteredCountries.map((country, index) => (
                <button
                  id={`country-option-${country.code}`}
                  key={country.code}
                  type="button"
                  className={
                    index === countryHighlightIndex
                      ? "country-search-result is-active"
                      : "country-search-result"
                  }
                  role="option"
                  aria-selected={scope.kind === "country" && scope.value === country.code}
                  aria-label={`${country.name}, ${country.count.toLocaleString()} subdivisions`}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setCountryHighlightIndex(index)}
                  onClick={() => selectCountry(country)}
                >
                  <span>{country.name}</span>
                  <small>{country.count.toLocaleString()}</small>
                </button>
              ))
            ) : (
              <div className="country-search-empty">No countries found.</div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
