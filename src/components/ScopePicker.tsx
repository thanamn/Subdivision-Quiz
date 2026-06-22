import type { KeyboardEvent } from "react";
import { Globe2 } from "lucide-react";
import type { CountrySummary, RegionSummary, Scope } from "../domain/types";
import type { QuizMode } from "../quiz/quizTypes";
import { CountrySearch } from "./CountrySearch";
import { QuizModeSwitch } from "./QuizModeSwitch";

export function ScopePicker({
  countryHighlightIndex,
  countrySearch,
  countrySearchOpen,
  filteredCountries,
  handleCountrySearchKeyDown,
  quizMode,
  regions,
  scope,
  selectedCountry,
  selectCountry,
  setCountryHighlightIndex,
  setCountrySearch,
  setCountrySearchOpen,
  setQuizMode,
  setScope,
}: {
  countryHighlightIndex: number;
  countrySearch: string;
  countrySearchOpen: boolean;
  filteredCountries: CountrySummary[];
  handleCountrySearchKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  quizMode: QuizMode;
  regions: RegionSummary[];
  scope: Scope;
  selectedCountry?: CountrySummary;
  selectCountry: (country: { code: string; name: string }) => void;
  setCountryHighlightIndex: (index: number | ((current: number) => number)) => void;
  setCountrySearch: (value: string) => void;
  setCountrySearchOpen: (value: boolean) => void;
  setQuizMode: (mode: QuizMode) => void;
  setScope: (scope: Scope) => void;
}) {
  return (
    <div className="scope-strip header-scope-strip">
      <button
        type="button"
        className={scope.kind === "world" ? "scope-button is-active" : "scope-button"}
        onClick={() => setScope({ kind: "world", value: "world" })}
      >
        <Globe2 size={17} aria-hidden="true" />
        World
      </button>

      <label className="select-control">
        <span>Region</span>
        <select
          value={scope.kind === "region" ? scope.value : ""}
          onChange={(event) => {
            if (event.target.value) {
              setScope({ kind: "region", value: event.target.value });
            }
          }}
        >
          <option value="">Choose region</option>
          {regions.map((region) => (
            <option key={region.name} value={region.name}>
              {region.name} ({region.count})
            </option>
          ))}
        </select>
      </label>

      <CountrySearch
        countryHighlightIndex={countryHighlightIndex}
        countrySearch={countrySearch}
        countrySearchOpen={countrySearchOpen}
        filteredCountries={filteredCountries}
        handleCountrySearchKeyDown={handleCountrySearchKeyDown}
        scope={scope}
        selectedCountry={selectedCountry}
        selectCountry={selectCountry}
        setCountryHighlightIndex={setCountryHighlightIndex}
        setCountrySearch={setCountrySearch}
        setCountrySearchOpen={setCountrySearchOpen}
      />

      <QuizModeSwitch quizMode={quizMode} setQuizMode={setQuizMode} />
    </div>
  );
}
