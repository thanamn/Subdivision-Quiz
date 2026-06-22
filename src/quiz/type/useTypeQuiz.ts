import { useCallback, useState } from "react";
import type { Dispatch, FormEvent, RefObject, SetStateAction } from "react";
import { normalizeGuess } from "../../geo/normalization";
import { byCountryThenName } from "../../geo/scope";
import type { MatchMode } from "../quizTypes";
import type { SubdivisionFeature } from "../../domain/types";

export function useTypeQuiz({
  activeNameIndex,
  guessed,
  inputRef,
  matchMode,
  setActiveId,
  setGuessed,
  setNotice,
  setRecent,
  startQuizTimer,
}: {
  activeNameIndex: Map<string, SubdivisionFeature[]>;
  guessed: Set<string>;
  inputRef: RefObject<HTMLInputElement | null>;
  matchMode: MatchMode;
  setActiveId: (id: string | null) => void;
  setGuessed: Dispatch<SetStateAction<Set<string>>>;
  setNotice: (notice: string) => void;
  setRecent: Dispatch<SetStateAction<SubdivisionFeature[]>>;
  startQuizTimer: () => void;
}) {
  const [query, setQuery] = useState("");
  const [ambiguous, setAmbiguous] = useState<SubdivisionFeature[]>([]);

  const addGuesses = useCallback(
    (matches: SubdivisionFeature[], message?: string) => {
      const unseen = matches.filter((feature) => !guessed.has(feature.properties.id));
      if (!unseen.length) {
        setNotice("Already found.");
        return;
      }

      startQuizTimer();

      setGuessed((current) => {
        const next = new Set(current);
        for (const feature of unseen) {
          next.add(feature.properties.id);
        }
        return next;
      });
      setRecent((current) => [...unseen, ...current].slice(0, 12));
      setActiveId(unseen[0].properties.id);
      setAmbiguous([]);
      setQuery("");
      if (window.matchMedia("(min-width: 720px)").matches) {
        window.requestAnimationFrame(() => inputRef.current?.focus());
      }
      setNotice(
        message ||
          (unseen.length === 1
            ? `Added ${unseen[0].properties.name}.`
            : `Added ${unseen.length} matches.`),
      );
    },
    [
      guessed,
      inputRef,
      setActiveId,
      setGuessed,
      setNotice,
      setRecent,
      startQuizTimer,
    ],
  );

  const tryGuess = useCallback(
    (rawGuess: string, silent = false) => {
      const normalized = normalizeGuess(rawGuess);
      if (!normalized) {
        return false;
      }

      const matches = activeNameIndex.get(normalized) || [];
      const unseen = matches.filter((feature) => !guessed.has(feature.properties.id));

      if (!unseen.length) {
        if (!silent) {
          setNotice(matches.length ? "Already found." : "No exact match in this quiz.");
        }
        return false;
      }

      if (unseen.length > 1 && matchMode === "single") {
        setAmbiguous(unseen.sort(byCountryThenName));
        if (!silent) {
          setNotice(`That name appears in ${unseen.length} places.`);
        }
        return true;
      }

      addGuesses(
        unseen,
        unseen.length === 1
          ? `Added ${unseen[0].properties.name}.`
          : `Added ${unseen.length} matching subdivisions.`,
      );
      return true;
    },
    [activeNameIndex, addGuesses, guessed, matchMode, setNotice],
  );

  function handleQueryChange(value: string) {
    setQuery(value);
    setAmbiguous([]);
    if (value.trim().length >= 2) {
      tryGuess(value, true);
    }
  }

  function submitGuess(event: FormEvent) {
    event.preventDefault();
    tryGuess(query);
  }

  const resetTypeQuiz = useCallback(() => {
    setAmbiguous([]);
    setQuery("");
  }, []);

  return {
    addGuesses,
    ambiguous,
    handleQueryChange,
    query,
    resetTypeQuiz,
    setAmbiguous,
    setQuery,
    submitGuess,
    tryGuess,
  };
}
