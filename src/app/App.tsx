import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { promptNames } from "../domain/featureNames";
import type { MatchMode, QuizMode } from "../quiz/quizTypes";
import { EMPTY_FIND_STATS } from "../quiz/quizTypes";
import {
  HELP_CARD_KEY,
  initialHelpCardOpen,
  initialQuizMode,
  initialScope,
  LAST_SCOPE_KEY,
  MATCH_MODE_KEY,
  QUIZ_MODE_KEY,
  urlForScopeAndMode,
} from "./storage";
import {
  COUNTRY_REGIONS_URL,
  DATA_URL,
  SUBDIVISION_MEDIA_URL,
} from "./dataUrls";
import { loadSubdivisionData } from "../data/loadSubdivisionData";
import { loadSubdivisionMedia } from "../data/loadSubdivisionMedia";
import {
  fetchNativeNamesForFeatures,
  mergeNativeNames,
  NATIVE_LABEL_FEATURE_LIMIT,
} from "../domain/nativeNames";
import { CompletionConfetti } from "../components/CompletionConfetti";
import { HelpCard } from "../components/HelpCard";
import { NoticeBar } from "../components/NoticeBar";
import { ProgressStats } from "../components/ProgressStats";
import { SidePanel } from "../components/SidePanel";
import { TopBar } from "../components/TopBar";
import { FindActions } from "../quiz/find/FindActions";
import { FindPrompt } from "../quiz/find/FindPrompt";
import { useFindQuiz } from "../quiz/find/useFindQuiz";
import { AmbiguousMatches } from "../quiz/type/AmbiguousMatches";
import { TypeActions, TypeMatchModeSwitch } from "../quiz/type/TypeActions";
import { TypeGuessForm } from "../quiz/type/TypeGuessForm";
import { useTypeQuiz } from "../quiz/type/useTypeQuiz";
import { loadProgress, progressStorageKey, saveProgress } from "../quiz/progressStorage";
import { useQuizTimer } from "../quiz/useQuizTimer";
import QuizMap from "../map/QuizMap";
import {
  buildCountrySummaries,
  buildNameIndex,
  buildRegionSummaries,
  byCountryThenName,
  featureInScope,
  normalizeGuess,
  scopeKey,
  scopeLabel,
} from "../geo/index";
import type { CountryRegionLookup } from "../geo/topologyTypes";
import { mediaForFeature } from "../domain/subdivisionMedia";
import type {
  NativeName,
  Scope,
  SubdivisionFeature,
  SubdivisionMediaLookup,
} from "../domain/types";

type CompletionState = {
  progressKey: string | null;
  ready: boolean;
  wasComplete: boolean;
};

const STANDARD_ANSWER_LIST_LIMIT = 120;
const LARGE_SCOPE_ANSWER_LIST_LIMIT = 48;
const LARGE_SCOPE_FEATURE_THRESHOLD = 400;

function sortedFeaturePreview(
  features: SubdivisionFeature[],
  shouldInclude: (feature: SubdivisionFeature) => boolean,
  limit: number,
) {
  if (limit <= 0) {
    return [];
  }

  const preview: SubdivisionFeature[] = [];
  let sorted = false;

  features.forEach((feature) => {
    if (!shouldInclude(feature)) {
      return;
    }

    if (preview.length < limit) {
      preview.push(feature);
      return;
    }

    if (!sorted) {
      preview.sort(byCountryThenName);
      sorted = true;
    }

    const lastFeature = preview[preview.length - 1];
    if (byCountryThenName(feature, lastFeature) >= 0) {
      return;
    }

    const insertAt = preview.findIndex(
      (previewFeature) => byCountryThenName(feature, previewFeature) < 0,
    );
    preview.splice(insertAt === -1 ? preview.length : insertAt, 0, feature);
    preview.pop();
  });

  return sorted ? preview : preview.sort(byCountryThenName);
}

export default function App() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const completionStateRef = useRef<CompletionState>({
    progressKey: null,
    ready: false,
    wasComplete: false,
  });
  const nativeNameAttemptedQidsRef = useRef<Set<string>>(new Set());
  const subdivisionMediaAttemptedRef = useRef(false);

  const [allFeatures, setAllFeatures] = useState<SubdivisionFeature[]>([]);
  const [countryRegionLookup, setCountryRegionLookup] = useState<CountryRegionLookup>({});
  const [subdivisionMediaLookup, setSubdivisionMediaLookup] =
    useState<SubdivisionMediaLookup>({});
  const [nativeNameLookup, setNativeNameLookup] = useState<Record<string, NativeName[]>>({});
  const [nativeNamesLoading, setNativeNamesLoading] = useState(false);
  const [scope, setScope] = useState<Scope>(initialScope);
  const [guessed, setGuessed] = useState<Set<string>>(new Set());
  const [recent, setRecent] = useState<SubdivisionFeature[]>([]);
  const [notice, setNotice] = useState("Loading map data...");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [countrySearchOpen, setCountrySearchOpen] = useState(false);
  const [countryHighlightIndex, setCountryHighlightIndex] = useState(0);
  const [quizMode, setQuizMode] = useState<QuizMode>(initialQuizMode);
  const [matchMode, setMatchMode] = useState<MatchMode>(() => {
    if (typeof window === "undefined") {
      return "single";
    }
    return window.localStorage.getItem(MATCH_MODE_KEY) === "all" ? "all" : "single";
  });
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [progressReady, setProgressReady] = useState(false);
  const [progressKey, setProgressKey] = useState<string | null>(null);
  const [showHelpCard, setShowHelpCard] = useState(initialHelpCardOpen);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [confettiRun, setConfettiRun] = useState(0);
  const shouldLoadSubdivisionMedia =
    quizMode === "find" ||
    guessed.size > 0 ||
    revealedIds.size > 0 ||
    recent.length > 0;

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const { countryRegions, features } = await loadSubdivisionData(
          DATA_URL,
          COUNTRY_REGIONS_URL,
        );
        if (!cancelled) {
          setCountryRegionLookup(countryRegions);
          setAllFeatures(features);
          setNotice(`Loaded ${features.length.toLocaleString()} subdivisions.`);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadingError(error instanceof Error ? error.message : String(error));
          setNotice("The map data could not be loaded.");
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!shouldLoadSubdivisionMedia || subdivisionMediaAttemptedRef.current) {
      return undefined;
    }

    subdivisionMediaAttemptedRef.current = true;
    let cancelled = false;
    let settled = false;

    loadSubdivisionMedia(SUBDIVISION_MEDIA_URL)
      .then((mediaLookup) => {
        if (!cancelled) {
          setSubdivisionMediaLookup(mediaLookup);
        }
      })
      .finally(() => {
        settled = true;
      });

    return () => {
      cancelled = true;
      if (!settled) {
        subdivisionMediaAttemptedRef.current = false;
      }
    };
  }, [shouldLoadSubdivisionMedia]);

  const countries = useMemo(() => buildCountrySummaries(allFeatures), [allFeatures]);
  const regions = useMemo(() => buildRegionSummaries(countries), [countries]);
  const scopedFeatures = useMemo(
    () => allFeatures.filter((feature) => featureInScope(feature, scope)),
    [allFeatures, scope],
  );
  const activeFeatures = useMemo(
    () =>
      scopedFeatures.map((feature) => {
        const qid = feature.properties.wikidataId;
        return qid ? mergeNativeNames(feature, nativeNameLookup[qid] || []) : feature;
      }),
    [nativeNameLookup, scopedFeatures],
  );
  const activeNameIndex = useMemo(() => buildNameIndex(activeFeatures), [activeFeatures]);
  const key = scopeKey(scope);
  const currentProgressKey = progressStorageKey(key, quizMode);
  const label = scopeLabel(scope, countries);
  const selectedCountry = useMemo(
    () =>
      scope.kind === "country"
        ? countries.find((country) => country.code === scope.value)
        : undefined,
    [countries, scope],
  );
  const countrySearchTerm = normalizeGuess(countrySearch);
  const filteredCountries = useMemo(() => {
    const matches = countrySearchTerm
      ? countries.filter((country) => {
          const normalizedName = normalizeGuess(country.name);
          const normalizedCode = normalizeGuess(country.code);
          return (
            normalizedName.includes(countrySearchTerm) ||
            normalizedCode === countrySearchTerm
          );
        })
      : countries;

    return matches;
  }, [countries, countrySearchTerm]);
  const total = activeFeatures.length;
  const completedIds = useMemo(() => {
    if (quizMode === "type") {
      return guessed;
    }

    return new Set([...guessed, ...revealedIds]);
  }, [guessed, quizMode, revealedIds]);
  const missingCount = Math.max(0, total - completedIds.size);
  const answerListLimit =
    total > LARGE_SCOPE_FEATURE_THRESHOLD
      ? LARGE_SCOPE_ANSWER_LIST_LIMIT
      : STANDARD_ANSWER_LIST_LIMIT;
  const missingPreviewFeatures = useMemo(
    () =>
      sortedFeaturePreview(
        activeFeatures,
        (feature) => !completedIds.has(feature.properties.id),
        answerListLimit,
      ),
    [activeFeatures, answerListLimit, completedIds],
  );
  const completedReviewCount = useMemo(
    () =>
      activeFeatures.reduce((count, feature) => {
        const id = feature.properties.id;
        const isCompleted =
          quizMode === "find"
            ? guessed.has(id) || revealedIds.has(id)
            : guessed.has(id);

        return count + (isCompleted ? 1 : 0);
      }, 0),
    [activeFeatures, guessed, quizMode, revealedIds],
  );
  const completedReviewPreviewFeatures = useMemo(
    () =>
      sortedFeaturePreview(
        activeFeatures,
        (feature) => {
          const id = feature.properties.id;
          return quizMode === "find"
            ? guessed.has(id) || revealedIds.has(id)
            : guessed.has(id);
        },
        answerListLimit,
      ),
    [activeFeatures, answerListLimit, guessed, quizMode, revealedIds],
  );
  const complete = total > 0 && completedIds.size >= total;
  const { elapsed, resetQuizTimer, setStartedAt, startQuizTimer } =
    useQuizTimer(complete);
  const typeQuiz = useTypeQuiz({
    activeNameIndex,
    guessed,
    inputRef,
    matchMode,
    setActiveId,
    setGuessed,
    setNotice,
    setRecent,
    startQuizTimer,
  });
  const findQuiz = useFindQuiz({
    activeFeatures,
    complete,
    completedIds,
    gaveUp,
    quizMode,
    setActiveId,
    setGuessed,
    setNotice,
    setRecent,
    setRevealedIds,
    startQuizTimer,
  });
  const prompt = promptNames(findQuiz.currentTarget);
  const currentTargetMedia = mediaForFeature(findQuiz.currentTarget, subdivisionMediaLookup);
  const findPromptTitle = gaveUp ? "Quiz ended" : complete ? "Complete" : prompt.primary;
  const findPromptDetail = gaveUp
    ? "The remaining subdivisions are revealed on the map and in Missing."
    : complete
      ? "Every subdivision in this quiz is completed."
      : prompt.secondary;
  const percent = total ? Math.round((completedIds.size / total) * 1000) / 10 : 0;
  const visibleNotice = complete
    ? "Complete. Every visible subdivision is completed."
    : nativeNamesLoading
      ? `Loading native names for ${label}...`
      : notice;
  const sourceSupplementalNameCount = useMemo(
    () =>
      scopedFeatures.filter(
        (feature) =>
          feature.properties.localNames.length || feature.properties.nativeNames.length,
      ).length,
    [scopedFeatures],
  );

  useEffect(() => {
    window.localStorage.setItem(LAST_SCOPE_KEY, JSON.stringify(scope));
  }, [scope]);

  useEffect(() => {
    const nextUrl = urlForScopeAndMode(scope, quizMode);
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [quizMode, scope]);

  useEffect(() => {
    window.localStorage.setItem(QUIZ_MODE_KEY, quizMode);
  }, [quizMode]);

  useEffect(() => {
    window.localStorage.setItem(MATCH_MODE_KEY, matchMode);
  }, [matchMode]);

  useEffect(() => {
    setCountryHighlightIndex(0);
  }, [countrySearchTerm]);

  useEffect(() => {
    if (total) {
      setNotice(
        sourceSupplementalNameCount
          ? quizMode === "find"
            ? `Click mode ready for ${label}.`
            : `Ready for ${label}.`
          : `Ready for ${label}. No local or native names are available in the source data.`,
      );
    }
  }, [key, label, quizMode, sourceSupplementalNameCount, total]);

  useEffect(() => {
    if (
      scope.kind === "world" ||
      !scopedFeatures.length ||
      scopedFeatures.length > NATIVE_LABEL_FEATURE_LIMIT ||
      !Object.keys(countryRegionLookup).length
    ) {
      return undefined;
    }

    const featuresNeedingNativeLabels = scopedFeatures.filter((feature) => {
      const qid = feature.properties.wikidataId;
      const languages = countryRegionLookup[feature.properties.countryCode]?.languageCodes || [];
      return Boolean(
        qid &&
          languages.length &&
          !feature.properties.nativeNames.length &&
          !nativeNameLookup[qid] &&
          !nativeNameAttemptedQidsRef.current.has(qid),
      );
    });

    if (!featuresNeedingNativeLabels.length) {
      return undefined;
    }

    let cancelled = false;
    let settled = false;
    const requestedQids = featuresNeedingNativeLabels
      .map((feature) => feature.properties.wikidataId)
      .filter((qid): qid is string => Boolean(qid));
    for (const qid of requestedQids) {
      nativeNameAttemptedQidsRef.current.add(qid);
    }
    setNativeNamesLoading(true);

    fetchNativeNamesForFeatures(featuresNeedingNativeLabels, countryRegionLookup)
      .then((labels) => {
        if (cancelled) {
          return;
        }

        const count = Object.keys(labels).length;
        if (count) {
          setNativeNameLookup((current) => ({
            ...current,
            ...labels,
          }));
          setNotice(`Ready for ${label}; loaded ${count} native names.`);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNotice(`Ready for ${label}. Native names could not be loaded.`);
        }
      })
      .finally(() => {
        settled = true;
        if (!cancelled) {
          setNativeNamesLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (!settled) {
        for (const qid of requestedQids) {
          nativeNameAttemptedQidsRef.current.delete(qid);
        }
      }
    };
  }, [countryRegionLookup, key, label, nativeNameLookup, scope.kind, scopedFeatures]);

  useEffect(() => {
    setProgressReady(false);
    setGaveUp(false);
    typeQuiz.resetTypeQuiz();
    setRecent([]);
    setActiveId(null);
    setRevealedIds(new Set());
    findQuiz.resetFindQuiz();

    try {
      const loaded = loadProgress(currentProgressKey, quizMode);
      setGuessed(loaded.guessed);
      setRevealedIds(loaded.revealedIds);
      findQuiz.setFindStats(loaded.findStats);
      setStartedAt(loaded.hasStarted ? Date.now() : null);
    } catch {
      setGuessed(new Set());
      setRevealedIds(new Set());
      findQuiz.setFindStats(EMPTY_FIND_STATS);
      setStartedAt(null);
    }

    setProgressKey(currentProgressKey);
    setProgressReady(true);
  }, [currentProgressKey, findQuiz.resetFindQuiz, findQuiz.setFindStats, quizMode, setStartedAt, typeQuiz.resetTypeQuiz]);

  useEffect(() => {
    if (!progressReady || progressKey !== currentProgressKey) {
      return;
    }

    saveProgress({
      findStats: findQuiz.findStats,
      guessed,
      progressKey: currentProgressKey,
      quizMode,
      revealedIds,
    });
  }, [
    currentProgressKey,
    findQuiz.findStats,
    guessed,
    progressKey,
    progressReady,
    quizMode,
    revealedIds,
  ]);

  useEffect(() => {
    if (!progressReady || progressKey !== currentProgressKey || !total) {
      completionStateRef.current = {
        progressKey: currentProgressKey,
        ready: false,
        wasComplete: complete,
      };
      return;
    }

    const previous = completionStateRef.current;

    if (previous.progressKey !== currentProgressKey || !previous.ready) {
      completionStateRef.current = {
        progressKey: currentProgressKey,
        ready: true,
        wasComplete: complete,
      };
      return;
    }

    if (complete && !previous.wasComplete && !gaveUp) {
      setConfettiRun((current) => current + 1);
    }

    completionStateRef.current = {
      progressKey: currentProgressKey,
      ready: true,
      wasComplete: complete,
    };
  }, [complete, currentProgressKey, gaveUp, progressKey, progressReady, total]);

  useEffect(() => {
    if (quizMode === "type" && window.matchMedia("(min-width: 720px)").matches) {
      inputRef.current?.focus();
    }
  }, [key, quizMode]);

  function giveUpQuiz() {
    setGaveUp(true);
    if (quizMode === "find") {
      findQuiz.giveUpFindQuiz();
      return;
    }

    setNotice("Quiz ended. Missing answers are revealed.");
  }

  async function shareResult() {
    const text =
      quizMode === "find"
        ? `I completed ${completedIds.size.toLocaleString()} of ${total.toLocaleString()} first-level subdivisions in ${label} (${percent}%). Correct clicks: ${guessed.size.toLocaleString()}; revealed: ${revealedIds.size.toLocaleString()}; wrong clicks: ${findQuiz.findStats.wrong.toLocaleString()}; hints: ${findQuiz.findStats.hints.toLocaleString()}.`
        : `I named ${guessed.size.toLocaleString()} of ${total.toLocaleString()} first-level subdivisions in ${label} (${percent}%).`;

    try {
      await navigator.clipboard.writeText(text);
      setNotice("Result copied to clipboard.");
    } catch {
      setNotice(text);
    }
  }

  function restartQuiz() {
    const hasProgress =
      quizMode === "find"
        ? completedIds.size ||
          findQuiz.findStats.wrong ||
          findQuiz.findStats.hints ||
          findQuiz.findStats.reveals ||
          findQuiz.findStats.skips
        : guessed.size;

    if (hasProgress && !window.confirm(`Restart the ${label} quiz?`)) {
      return;
    }

    window.localStorage.removeItem(currentProgressKey);
    setGuessed(new Set());
    setRevealedIds(new Set());
    findQuiz.resetFindQuiz();
    typeQuiz.resetTypeQuiz();
    setRecent([]);
    setGaveUp(false);
    setActiveId(null);
    resetQuizTimer();
    setNotice("Progress reset.");
  }

  function dismissHelpCard() {
    window.localStorage.setItem(HELP_CARD_KEY, "1");
    setShowHelpCard(false);
    if (quizMode === "type" && window.matchMedia("(min-width: 720px)").matches) {
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function selectCountry(country: { code: string; name: string }) {
    setScope({ kind: "country", value: country.code });
    setCountrySearch("");
    setCountrySearchOpen(false);
    setCountryHighlightIndex(0);
  }

  useEffect(() => {
    function targetIsTypingField(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return Boolean(
        target.closest("input, textarea, select, [contenteditable='true']"),
      );
    }

    function handleShortcut(event: globalThis.KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (event.key === "Escape" && countrySearchOpen) {
        event.preventDefault();
        setCountrySearchOpen(false);
        setCountrySearch("");
        return;
      }

      if (quizMode !== "find" || targetIsTypingField(event.target)) {
        return;
      }

      const shortcut = event.key.toLowerCase();
      if (shortcut === "h") {
        event.preventDefault();
        findQuiz.requestHint();
      } else if (shortcut === "s") {
        event.preventDefault();
        findQuiz.skipFindTarget();
      } else if (shortcut === "a") {
        event.preventDefault();
        findQuiz.revealFindTarget();
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [
    countrySearchOpen,
    findQuiz.requestHint,
    findQuiz.revealFindTarget,
    findQuiz.skipFindTarget,
    quizMode,
  ]);

  function handleCountrySearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCountrySearchOpen(true);
      setCountryHighlightIndex((current) =>
        filteredCountries.length ? Math.min(current + 1, filteredCountries.length - 1) : 0,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setCountrySearchOpen(true);
      setCountryHighlightIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      if (filteredCountries.length) {
        event.preventDefault();
        selectCountry(filteredCountries[countryHighlightIndex] || filteredCountries[0]);
      }
      return;
    }

    if (event.key === "Escape") {
      setCountrySearchOpen(false);
      setCountrySearch("");
    }
  }

  return (
    <div className="app">
      <CompletionConfetti run={confettiRun} />

      <TopBar
        countryHighlightIndex={countryHighlightIndex}
        countrySearch={countrySearch}
        countrySearchOpen={countrySearchOpen}
        filteredCountries={filteredCountries}
        handleCountrySearchKeyDown={handleCountrySearchKeyDown}
        quizMode={quizMode}
        regions={regions}
        restartQuiz={restartQuiz}
        scope={scope}
        selectedCountry={selectedCountry}
        selectCountry={selectCountry}
        setCountryHighlightIndex={setCountryHighlightIndex}
        setCountrySearch={setCountrySearch}
        setCountrySearchOpen={setCountrySearchOpen}
        setQuizMode={setQuizMode}
        setScope={setScope}
        shareResult={shareResult}
      />

      <main className="workspace">
        <section className="play-area">
          {showHelpCard ? <HelpCard dismissHelpCard={dismissHelpCard} /> : null}

          <ProgressStats
            completedCount={quizMode === "find" ? completedIds.size : guessed.size}
            countries={countries}
            elapsed={elapsed}
            findStats={findQuiz.findStats}
            label={label}
            missingCount={missingCount}
            percent={percent}
            quizMode={quizMode}
            regions={regions}
            scope={scope}
            total={total}
          />

          <div className={quizMode === "find" ? "quiz-bar is-find-mode" : "quiz-bar"}>
            {quizMode === "type" ? (
              <>
                <TypeGuessForm
                  handleQueryChange={typeQuiz.handleQueryChange}
                  inputRef={inputRef}
                  query={typeQuiz.query}
                  submitGuess={typeQuiz.submitGuess}
                />
                <TypeMatchModeSwitch matchMode={matchMode} setMatchMode={setMatchMode} />
              </>
            ) : (
              <FindPrompt
                currentTargetMedia={currentTargetMedia}
                findPromptDetail={findPromptDetail}
                findPromptTitle={findPromptTitle}
              />
            )}

            <NoticeBar notice={visibleNotice} />

            {quizMode === "type" ? (
              <TypeActions
                complete={complete}
                gaveUp={gaveUp}
                giveUpQuiz={giveUpQuiz}
                guessedCount={guessed.size}
                restartQuiz={restartQuiz}
              />
            ) : (
              <FindActions
                complete={complete}
                completedCount={completedIds.size}
                currentTarget={findQuiz.currentTarget}
                findStats={findQuiz.findStats}
                gaveUp={gaveUp}
                giveUpQuiz={giveUpQuiz}
                hintLevel={findQuiz.hintLevel}
                requestHint={findQuiz.requestHint}
                restartQuiz={restartQuiz}
                revealFindTarget={findQuiz.revealFindTarget}
                skipFindTarget={findQuiz.skipFindTarget}
              />
            )}
          </div>

          {quizMode === "type" ? (
            <AmbiguousMatches
              addGuesses={typeQuiz.addGuesses}
              ambiguous={typeQuiz.ambiguous}
              setActiveId={setActiveId}
            />
          ) : null}

          {loadingError ? (
            <div className="error-panel">
              <strong>Map data failed to load.</strong>
              <span>{loadingError}</span>
            </div>
          ) : (
            <QuizMap
              features={activeFeatures}
              guessed={guessed}
              revealed={gaveUp || complete}
              revealedIds={revealedIds}
              wrongIds={findQuiz.wrongIdSet}
              wrongFlashId={findQuiz.wrongFlashId}
              activeId={activeId}
              scope={scope}
              clickable={quizMode === "find" && !complete && !gaveUp}
              forceTinyMarkers={quizMode === "find"}
              currentTargetId={findQuiz.currentTarget?.properties.id || null}
              focusFeatureId={findQuiz.mapFocusRequest?.id || null}
              focusRequestNonce={findQuiz.mapFocusRequest?.nonce || 0}
              hintLevel={findQuiz.hintLevel}
              onHover={setActiveId}
              onFeatureClick={findQuiz.handleFeatureClick}
            />
          )}
        </section>

        <SidePanel
          complete={complete}
          completedReviewCount={completedReviewCount}
          completedReviewPreviewFeatures={completedReviewPreviewFeatures}
          gaveUp={gaveUp}
          mediaLookup={subdivisionMediaLookup}
          missingCount={missingCount}
          missingPreviewFeatures={missingPreviewFeatures}
          quizMode={quizMode}
          recent={recent}
          setActiveId={setActiveId}
          wrongClickFeatures={findQuiz.wrongClickFeatures}
        />
      </main>
    </div>
  );
}
