import type { FormEvent, RefObject } from "react";
import { Check, Search } from "lucide-react";

export function TypeGuessForm({
  handleQueryChange,
  inputRef,
  query,
  submitGuess,
}: {
  handleQueryChange: (value: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  query: string;
  submitGuess: (event: FormEvent) => void;
}) {
  return (
    <form className="guess-form" onSubmit={submitGuess}>
      <Search size={18} aria-hidden="true" />
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => handleQueryChange(event.target.value)}
        placeholder="Type a subdivision"
        autoComplete="off"
      />
      <button type="submit">
        <Check size={17} aria-hidden="true" />
        Enter
      </button>
    </form>
  );
}
