import type { KeyboardEvent } from "react";
import { Globe2, RotateCcw, Share2 } from "lucide-react";
import type { CountrySummary, RegionSummary, Scope } from "../domain/types";
import type { QuizMode } from "../quiz/quizTypes";
import { ScopePicker } from "./ScopePicker";

export function TopBar({
  countryHighlightIndex,
  countrySearch,
  countrySearchOpen,
  filteredCountries,
  handleCountrySearchKeyDown,
  quizMode,
  regions,
  restartQuiz,
  scope,
  selectedCountry,
  selectCountry,
  setCountryHighlightIndex,
  setCountrySearch,
  setCountrySearchOpen,
  setQuizMode,
  setScope,
  shareResult,
}: {
  countryHighlightIndex: number;
  countrySearch: string;
  countrySearchOpen: boolean;
  filteredCountries: CountrySummary[];
  handleCountrySearchKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  quizMode: QuizMode;
  regions: RegionSummary[];
  restartQuiz: () => void;
  scope: Scope;
  selectedCountry?: CountrySummary;
  selectCountry: (country: { code: string; name: string }) => void;
  setCountryHighlightIndex: (index: number | ((current: number) => number)) => void;
  setCountrySearch: (value: string) => void;
  setCountrySearchOpen: (value: boolean) => void;
  setQuizMode: (mode: QuizMode) => void;
  setScope: (scope: Scope) => void;
  shareResult: () => void;
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <Globe2 size={28} aria-hidden="true" />
        <div>
          <h1>Subdivision Quiz</h1>
          <p>Name subdivisions or find them on the map.</p>
        </div>
      </div>

      <ScopePicker
        countryHighlightIndex={countryHighlightIndex}
        countrySearch={countrySearch}
        countrySearchOpen={countrySearchOpen}
        filteredCountries={filteredCountries}
        handleCountrySearchKeyDown={handleCountrySearchKeyDown}
        quizMode={quizMode}
        regions={regions}
        scope={scope}
        selectedCountry={selectedCountry}
        selectCountry={selectCountry}
        setCountryHighlightIndex={setCountryHighlightIndex}
        setCountrySearch={setCountrySearch}
        setCountrySearchOpen={setCountrySearchOpen}
        setQuizMode={setQuizMode}
        setScope={setScope}
      />

      <div className="top-actions">
        <button type="button" className="icon-button" title="Copy result" onClick={shareResult}>
          <Share2 size={18} aria-hidden="true" />
        </button>
        <button type="button" className="icon-button" title="Restart quiz" onClick={restartQuiz}>
          <RotateCcw size={18} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
