import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import {
  ChevronDown,
  Check,
  Eye,
  Flag,
  Globe2,
  Info,
  Keyboard,
  Lightbulb,
  ListChecks,
  MousePointer2,
  RotateCcw,
  Search,
  Share2,
  SkipForward,
  Timer,
  X,
} from "lucide-react";
import QuizMap from "./QuizMap";
import {
  buildCountrySummaries,
  buildNameIndex,
  buildRegionSummaries,
  byCountryThenName,
  featureInScope,
  loadAdmin1Topology,
  normalizeGuess,
  scopeKey,
  scopeLabel,
} from "./geo";
import type { CountryRegionLookup } from "./geo";
import type { NativeName, Scope, SubdivisionFeature } from "./types";

const DATA_URL = `${import.meta.env.BASE_URL}data/admin1.topo.json`;
const COUNTRY_REGIONS_URL = `${import.meta.env.BASE_URL}data/country-regions.json`;
const LAST_SCOPE_KEY = "subdivision-quiz:last-scope";
const MATCH_MODE_KEY = "subdivision-quiz:match-mode";
const QUIZ_MODE_KEY = "subdivision-quiz:quiz-mode";
const HELP_CARD_KEY = "subdivision-quiz:help-dismissed:v2";
const WIKIDATA_ENDPOINT = "https://www.wikidata.org/w/api.php";
const WIKIDATA_BATCH_SIZE = 35;
const NATIVE_NAME_CANDIDATE_LIMIT = 8;
const NATIVE_LABEL_FEATURE_LIMIT = 650;
const MAX_FIND_HINTS = 3;
const CONFETTI_COLORS = [
  "#0f8b8d",
  "#e05d41",
  "#c48a1b",
  "#2670a8",
  "#bd4b73",
  "#6c9a3f",
  "#7a5c99",
];
const CONFETTI_PIECES = Array.from({ length: 72 }, (_, index) => {
  const size = 6 + (index % 4) * 2;
  const isWide = index % 5 === 0;

  return {
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    delay: (index % 12) * 0.045,
    drift: ((index * 23) % 141) - 70,
    duration: 1.65 + (index % 7) * 0.09,
    id: index,
    isRound: index % 7 === 0,
    left: (index * 37 + 11) % 100,
    rotate: ((index * 47) % 360) - 180,
    height: isWide ? size : size + 5,
    width: isWide ? size + 6 : size,
  };
});

type QuizMode = "type" | "find";

type FindStats = {
  hints: number;
  reveals: number;
  skips: number;
  wrong: number;
};

type CompletionState = {
  progressKey: string | null;
  ready: boolean;
  wasComplete: boolean;
};

const EMPTY_FIND_STATS: FindStats = {
  hints: 0,
  reveals: 0,
  skips: 0,
  wrong: 0,
};

function initialScope(): Scope {
  if (typeof window === "undefined") {
    return { kind: "world", value: "world" };
  }

  const params = new URLSearchParams(window.location.search);
  const country = params.get("country");
  const region = params.get("region");

  if (country) {
    return { kind: "country", value: country.toUpperCase() };
  }

  if (region) {
    return { kind: "region", value: region };
  }

  try {
    const saved = window.localStorage.getItem(LAST_SCOPE_KEY);
    if (saved) {
      return JSON.parse(saved) as Scope;
    }
  } catch {
    return { kind: "world", value: "world" };
  }

  return { kind: "world", value: "world" };
}

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function initialQuizMode(): QuizMode {
  if (typeof window === "undefined") {
    return "type";
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("mode") === "find") {
    return "find";
  }

  return window.localStorage.getItem(QUIZ_MODE_KEY) === "find" ? "find" : "type";
}

function urlForScopeAndMode(scope: Scope, mode: QuizMode) {
  const params = new URLSearchParams();

  if (scope.kind === "country") {
    params.set("country", scope.value);
  } else if (scope.kind === "region") {
    params.set("region", scope.value);
  }

  params.set("mode", mode);

  return `${window.location.pathname}?${params.toString()}${window.location.hash}`;
}

function progressStorageKey(key: string, mode: QuizMode) {
  return mode === "type"
    ? `subdivision-quiz:progress:${key}`
    : `subdivision-quiz:find-progress:${key}`;
}

function initialHelpCardOpen() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(HELP_CARD_KEY) !== "1";
}

function localNameText(feature: SubdivisionFeature) {
  return feature.properties.localNames.join(" / ");
}

function nativeNameText(feature: SubdivisionFeature) {
  return feature.properties.nativeNames
    .filter((nativeName) => nativeName.display !== false)
    .map((nativeName) => nativeName.name)
    .join(" / ");
}

function prefersCanonicalPromptName(feature: SubdivisionFeature) {
  return feature.properties.countryCode === "VNM";
}

function cloneFindStats(stats?: Partial<FindStats>) {
  return {
    ...EMPTY_FIND_STATS,
    ...stats,
  };
}

function featureShortName(feature: SubdivisionFeature) {
  if (prefersCanonicalPromptName(feature)) {
    return feature.properties.name;
  }

  const local = localNameText(feature);
  const native = nativeNameText(feature);
  const secondary = [local, native].find(
    (name) => name && normalizeGuess(name) !== normalizeGuess(feature.properties.name),
  );

  return secondary ? `${secondary} / ${feature.properties.name}` : feature.properties.name;
}

function promptNames(feature: SubdivisionFeature | undefined) {
  if (!feature) {
    return {
      primary: "Loading...",
      secondary: "Choose a subdivision on the map.",
    };
  }

  const local = feature.properties.localNames[0];
  const displayNativeNames = feature.properties.nativeNames.filter(
    (nativeName) => nativeName.display !== false,
  );
  const native = displayNativeNames[0]?.name;
  const prefersCanonicalName = prefersCanonicalPromptName(feature);
  const primary = prefersCanonicalName
    ? feature.properties.name
    : native || local || feature.properties.name;
  const secondary = [
    prefersCanonicalName ? undefined : feature.properties.name,
    local,
    native,
    ...feature.properties.localNames.slice(1),
    ...displayNativeNames.slice(1).map((nativeName) => nativeName.name),
  ]
    .filter((name): name is string => Boolean(name))
    .filter((name, index, names) => {
      const normalized = normalizeGuess(name);
      return (
        normalized !== normalizeGuess(primary) &&
        names.findIndex((item) => normalizeGuess(item) === normalized) === index
      );
    })
    .slice(0, 3)
    .join(" / ");

  return {
    primary,
    secondary: secondary || `${feature.properties.typeEn} in ${feature.properties.country}`,
  };
}

function mergeNativeNames(
  feature: SubdivisionFeature,
  nativeNames: NativeName[],
): SubdivisionFeature {
  if (!nativeNames.length) {
    return feature;
  }

  const displayNativeNames = nativeNames.filter((nativeName) => nativeName.display !== false);
  const sourceLocalAliases = new Set(
    feature.properties.nativeNames.map((nativeName) => normalizeGuess(nativeName.name)),
  );
  const aliases = displayNativeNames.length
    ? feature.properties.aliases.filter(
        (alias) => !sourceLocalAliases.has(normalizeGuess(alias)),
      )
    : [...feature.properties.aliases];
  const seenAliases = new Set(aliases.map(normalizeGuess));
  const currentNativeNames = new Map<string, NativeName>();

  if (!displayNativeNames.length) {
    for (const nativeName of feature.properties.nativeNames) {
      const normalized = normalizeGuess(nativeName.name);
      if (normalized) {
        currentNativeNames.set(normalized, nativeName);
      }
    }
  }

  for (const nativeName of nativeNames) {
    const normalized = normalizeGuess(nativeName.name);
    if (!normalized) {
      continue;
    }

    if (!seenAliases.has(normalized)) {
      aliases.push(nativeName.name);
      seenAliases.add(normalized);
    }

    if (nativeName.display !== false && normalized !== normalizeGuess(feature.properties.name)) {
      currentNativeNames.set(normalized, nativeName);
    }
  }

  return {
    ...feature,
    properties: {
      ...feature.properties,
      aliases,
      nativeNames: [...currentNativeNames.values()].slice(0, 3),
    },
  };
}

async function fetchNativeNamesForFeatures(
  features: SubdivisionFeature[],
  countryRegions: CountryRegionLookup,
) {
  const groups = new Map<string, { languages: string[]; qids: string[] }>();
  const qidToFeature = new Map<string, SubdivisionFeature>();

  for (const feature of features) {
    const qid = feature.properties.wikidataId;
    const languages = countryRegions[feature.properties.countryCode]?.languageCodes || [];

    if (!qid || !languages.length || feature.properties.nativeNames.length) {
      continue;
    }

    qidToFeature.set(qid, feature);
    const key = languages.join("|");
    const group = groups.get(key) || { languages, qids: [] };
    group.qids.push(qid);
    groups.set(key, group);
  }

  const labels: Record<string, NativeName[]> = {};

  for (const group of groups.values()) {
    const qids = [...new Set(group.qids)];
    for (let start = 0; start < qids.length; start += WIKIDATA_BATCH_SIZE) {
      const chunk = qids.slice(start, start + WIKIDATA_BATCH_SIZE);
      const params = new URLSearchParams({
        action: "wbgetentities",
        format: "json",
        origin: "*",
        ids: chunk.join("|"),
        languages: group.languages.join("|"),
        props: "labels|aliases",
      });
      const response = await fetch(`${WIKIDATA_ENDPOINT}?${params}`);

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const payload = await response.json();
      for (const [qid, entity] of Object.entries(payload.entities || {})) {
        const feature = qidToFeature.get(qid);
        const primaryName = feature?.properties.name || "";
        const seen = new Set<string>();
        const wikidataEntity = entity as {
          aliases?: Record<string, Array<{ value: string }>>;
          labels?: Record<string, { value: string }>;
        };
        const nativeNames = [
          ...group.languages
            .map((lang) => {
              const name = wikidataEntity.labels?.[lang]?.value;
              return name ? { lang, name } : null;
            })
            .filter((name): name is NativeName => Boolean(name)),
          ...group.languages.flatMap((lang) =>
            (wikidataEntity.aliases?.[lang] || []).map((alias) => ({
              display: false,
              lang,
              name: alias.value,
            })),
          ),
        ]
          .filter((name): name is NativeName => Boolean(name))
          .filter((nativeName) => {
            const normalized = normalizeGuess(nativeName.name);
            if (!normalized || normalized === normalizeGuess(primaryName) || seen.has(normalized)) {
              return false;
            }
            seen.add(normalized);
            return true;
          });

        if (nativeNames.length) {
          labels[qid] = nativeNames.slice(0, NATIVE_NAME_CANDIDATE_LIMIT);
        }
      }
    }
  }

  return labels;
}

function NativeNameLine({ feature }: { feature: SubdivisionFeature }) {
  const text = nativeNameText(feature);
  return text ? <span className="native-name">{text}</span> : null;
}

function LocalNameLine({ feature }: { feature: SubdivisionFeature }) {
  const text = localNameText(feature);
  return text ? <span className="local-name">{text}</span> : null;
}

function CompletionConfetti({ run }: { run: number }) {
  if (!run) {
    return null;
  }

  return (
    <div key={run} className="completion-confetti" aria-hidden="true">
      {CONFETTI_PIECES.map((piece) => (
        <span
          key={piece.id}
          className={piece.isRound ? "confetti-piece is-round" : "confetti-piece"}
          style={
            {
              "--confetti-color": piece.color,
              "--confetti-delay": `${piece.delay}s`,
              "--confetti-drift": `${piece.drift}px`,
              "--confetti-duration": `${piece.duration}s`,
              "--confetti-height": `${piece.height}px`,
              "--confetti-left": `${piece.left}%`,
              "--confetti-rotate": `${piece.rotate}deg`,
              "--confetti-width": `${piece.width}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export default function App() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const completionStateRef = useRef<CompletionState>({
    progressKey: null,
    ready: false,
    wasComplete: false,
  });
  const nativeNameAttemptedQidsRef = useRef<Set<string>>(new Set());
  const [allFeatures, setAllFeatures] = useState<SubdivisionFeature[]>([]);
  const [countryRegionLookup, setCountryRegionLookup] = useState<CountryRegionLookup>({});
  const [nativeNameLookup, setNativeNameLookup] = useState<Record<string, NativeName[]>>({});
  const [nativeNamesLoading, setNativeNamesLoading] = useState(false);
  const [scope, setScope] = useState<Scope>(initialScope);
  const [query, setQuery] = useState("");
  const [guessed, setGuessed] = useState<Set<string>>(new Set());
  const [recent, setRecent] = useState<SubdivisionFeature[]>([]);
  const [ambiguous, setAmbiguous] = useState<SubdivisionFeature[]>([]);
  const [notice, setNotice] = useState("Loading map data...");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [countrySearchOpen, setCountrySearchOpen] = useState(false);
  const [countryHighlightIndex, setCountryHighlightIndex] = useState(0);
  const [quizMode, setQuizMode] = useState<QuizMode>(initialQuizMode);
  const [matchMode, setMatchMode] = useState<"single" | "all">(() => {
    if (typeof window === "undefined") {
      return "single";
    }
    return window.localStorage.getItem(MATCH_MODE_KEY) === "all" ? "all" : "single";
  });
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [findStats, setFindStats] = useState<FindStats>(EMPTY_FIND_STATS);
  const [findTargetId, setFindTargetId] = useState<string | null>(null);
  const [findWrongIds, setFindWrongIds] = useState<string[]>([]);
  const [wrongFlashId, setWrongFlashId] = useState<string | null>(null);
  const [mapFocusRequest, setMapFocusRequest] = useState<{
    id: string;
    nonce: number;
  } | null>(null);
  const [findDeferredIds, setFindDeferredIds] = useState<Set<string>>(new Set());
  const [hintLevel, setHintLevel] = useState(0);
  const [progressReady, setProgressReady] = useState(false);
  const [progressKey, setProgressKey] = useState<string | null>(null);
  const [showHelpCard, setShowHelpCard] = useState(initialHelpCardOpen);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [confettiRun, setConfettiRun] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const [topologyResponse, countryRegionsResponse] = await Promise.all([
          fetch(DATA_URL),
          fetch(COUNTRY_REGIONS_URL),
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
        const features = loadAdmin1Topology(topology, countryRegions);
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
  const foundFeatures = useMemo(
    () =>
      activeFeatures
        .filter((feature) => guessed.has(feature.properties.id))
        .sort(byCountryThenName),
    [activeFeatures, guessed],
  );
  const missingFeatures = useMemo(
    () =>
      activeFeatures
        .filter((feature) => !completedIds.has(feature.properties.id))
        .sort(byCountryThenName),
    [activeFeatures, completedIds],
  );
  const revealedFeatures = useMemo(
    () =>
      activeFeatures
        .filter((feature) => revealedIds.has(feature.properties.id))
        .sort(byCountryThenName),
    [activeFeatures, revealedIds],
  );
  const completedReviewFeatures = useMemo(
    () =>
      quizMode === "find"
        ? [...foundFeatures, ...revealedFeatures].sort(byCountryThenName)
        : foundFeatures,
    [foundFeatures, quizMode, revealedFeatures],
  );
  const currentTarget = useMemo(
    () =>
      findTargetId
        ? activeFeatures.find((feature) => feature.properties.id === findTargetId)
        : undefined,
    [activeFeatures, findTargetId],
  );
  const wrongClickFeatures = useMemo(
    () =>
      findWrongIds
        .map((id) => activeFeatures.find((feature) => feature.properties.id === id))
        .filter((feature): feature is SubdivisionFeature => Boolean(feature)),
    [activeFeatures, findWrongIds],
  );
  const wrongIdSet = useMemo(() => new Set(findWrongIds), [findWrongIds]);
  const prompt = promptNames(currentTarget);
  const complete = total > 0 && completedIds.size >= total;
  const percent = total ? Math.round((completedIds.size / total) * 1000) / 10 : 0;
  const elapsed = startedAt ? now - startedAt : 0;
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
            ? `Find mode ready for ${label}.`
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
    setAmbiguous([]);
    setRecent([]);
    setActiveId(null);
    setQuery("");
    setRevealedIds(new Set());
    setFindStats(EMPTY_FIND_STATS);
    setFindTargetId(null);
    setFindWrongIds([]);
    setWrongFlashId(null);
    setMapFocusRequest(null);
    setFindDeferredIds(new Set());
    setHintLevel(0);

    try {
      const raw = window.localStorage.getItem(currentProgressKey);
      const saved = raw ? JSON.parse(raw) : quizMode === "type" ? [] : {};

      if (quizMode === "type") {
        const typedProgress = Array.isArray(saved) ? (saved as string[]) : [];
        setGuessed(new Set(typedProgress));
        setStartedAt(typedProgress.length ? Date.now() : null);
      } else {
        const findProgress = saved as {
          correct?: string[];
          revealed?: string[];
          stats?: Partial<FindStats>;
        };
        const correct = Array.isArray(findProgress.correct) ? findProgress.correct : [];
        const revealed = Array.isArray(findProgress.revealed) ? findProgress.revealed : [];
        const stats = cloneFindStats(findProgress.stats);
        setGuessed(new Set(correct));
        setRevealedIds(new Set(revealed));
        setFindStats(stats);
        setStartedAt(
          correct.length ||
            revealed.length ||
            stats.wrong ||
            stats.hints ||
            stats.reveals ||
            stats.skips
            ? Date.now()
            : null,
        );
      }
    } catch {
      setGuessed(new Set());
      setRevealedIds(new Set());
      setFindStats(EMPTY_FIND_STATS);
      setStartedAt(null);
    }

    setProgressKey(currentProgressKey);
    setProgressReady(true);
  }, [currentProgressKey, quizMode]);

  useEffect(() => {
    if (!progressReady || progressKey !== currentProgressKey) {
      return;
    }

    const payload =
      quizMode === "type"
        ? [...guessed]
        : {
            correct: [...guessed],
            revealed: [...revealedIds],
            stats: findStats,
          };

    window.localStorage.setItem(currentProgressKey, JSON.stringify(payload));
  }, [
    currentProgressKey,
    findStats,
    guessed,
    progressKey,
    progressReady,
    quizMode,
    revealedIds,
  ]);

  useEffect(() => {
    if (!startedAt || complete) {
      return undefined;
    }

    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt, complete]);

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

  useEffect(() => {
    if (quizMode !== "find" || !activeFeatures.length || complete || gaveUp) {
      if (quizMode !== "find") {
        setFindTargetId(null);
      }
      return;
    }

    const targetIsValid =
      findTargetId &&
      activeFeatures.some((feature) => feature.properties.id === findTargetId) &&
      !completedIds.has(findTargetId);

    if (targetIsValid) {
      return;
    }

    const remaining = activeFeatures.filter(
      (feature) => !completedIds.has(feature.properties.id),
    );
    if (!remaining.length) {
      setFindTargetId(null);
      return;
    }

    const available = remaining.filter(
      (feature) => !findDeferredIds.has(feature.properties.id),
    );
    const pool = available.length ? available : remaining;
    if (!available.length && findDeferredIds.size) {
      setFindDeferredIds(new Set());
    }

    const next = pool[Math.floor(Math.random() * pool.length)];
    setFindTargetId(next.properties.id);
    setFindWrongIds([]);
    setWrongFlashId(null);
    setHintLevel(0);
    setActiveId(null);
  }, [
    activeFeatures,
    complete,
    completedIds,
    findDeferredIds,
    findTargetId,
    gaveUp,
    quizMode,
  ]);

  function addGuesses(matches: SubdivisionFeature[], message?: string) {
    const unseen = matches.filter((feature) => !guessed.has(feature.properties.id));
    if (!unseen.length) {
      setNotice("Already found.");
      return;
    }

    if (!startedAt) {
      setStartedAt(Date.now());
    }

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
  }

  function tryGuess(rawGuess: string, silent = false) {
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
  }

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

  function startQuizTimer() {
    if (!startedAt) {
      setStartedAt(Date.now());
    }
  }

  function completeFindTarget(feature: SubdivisionFeature, result: "correct" | "revealed") {
    startQuizTimer();
    if (result === "correct") {
      setGuessed((current) => {
        const next = new Set(current);
        next.add(feature.properties.id);
        return next;
      });
    } else {
      setRevealedIds((current) => {
        const next = new Set(current);
        next.add(feature.properties.id);
        return next;
      });
    }

    setFindDeferredIds((current) => {
      const next = new Set(current);
      next.delete(feature.properties.id);
      return next;
    });
    setRecent((current) => [feature, ...current].slice(0, 12));
    setActiveId(feature.properties.id);
    setFindWrongIds([]);
    setHintLevel(0);
    setFindTargetId(null);
    setNotice(
      result === "correct"
        ? `Correct: ${featureShortName(feature)}.`
        : `Revealed: ${featureShortName(feature)}.`,
    );
  }

  function handleFeatureClick(feature: SubdivisionFeature) {
    if (quizMode !== "find" || !currentTarget || complete || gaveUp) {
      return;
    }

    startQuizTimer();

    if (completedIds.has(feature.properties.id)) {
      setActiveId(feature.properties.id);
      setNotice(`Already completed: ${featureShortName(feature)}.`);
      return;
    }

    if (feature.properties.id === currentTarget.properties.id) {
      completeFindTarget(feature, "correct");
      return;
    }

    setFindStats((current) => ({
      ...current,
      wrong: current.wrong + 1,
    }));
    setFindWrongIds((current) =>
      current.includes(feature.properties.id)
        ? current
        : [feature.properties.id, ...current].slice(0, 8),
    );
    setWrongFlashId(null);
    window.setTimeout(() => setWrongFlashId(feature.properties.id), 0);
    setActiveId(feature.properties.id);
    setNotice(`That was ${featureShortName(feature)}. Try again.`);
  }

  function requestHint() {
    if (quizMode !== "find" || !currentTarget || complete || gaveUp) {
      return;
    }

    startQuizTimer();
    if (hintLevel >= MAX_FIND_HINTS) {
      setNotice("The search area is as tight as it gets. Reveal is available.");
      return;
    }

    const nextHintLevel = hintLevel + 1;
    setHintLevel(nextHintLevel);
    setFindStats((current) => ({
      ...current,
      hints: current.hints + 1,
    }));
    setNotice(
      nextHintLevel === MAX_FIND_HINTS
        ? "Final hint: the answer is inside the small outline."
        : "Hint added: the answer is inside the outline.",
    );
  }

  function revealFindTarget() {
    if (quizMode !== "find" || !currentTarget || complete || gaveUp) {
      return;
    }

    setFindStats((current) => ({
      ...current,
      reveals: current.reveals + 1,
    }));
    setMapFocusRequest({
      id: currentTarget.properties.id,
      nonce: Date.now(),
    });
    completeFindTarget(currentTarget, "revealed");
  }

  function skipFindTarget() {
    if (quizMode !== "find" || !currentTarget || complete || gaveUp) {
      return;
    }

    startQuizTimer();
    setFindStats((current) => ({
      ...current,
      skips: current.skips + 1,
    }));
    setFindDeferredIds((current) => {
      const next = new Set(current);
      next.add(currentTarget.properties.id);
      return next;
    });
    setFindWrongIds([]);
    setWrongFlashId(null);
    setHintLevel(0);
    setFindTargetId(null);
    setActiveId(null);
    setNotice("Skipped for now. It can come back later.");
  }

  async function shareResult() {
    const text =
      quizMode === "find"
        ? `I completed ${completedIds.size.toLocaleString()} of ${total.toLocaleString()} first-level subdivisions in ${label} (${percent}%). Correct clicks: ${guessed.size.toLocaleString()}; revealed: ${revealedIds.size.toLocaleString()}; wrong clicks: ${findStats.wrong.toLocaleString()}; hints: ${findStats.hints.toLocaleString()}.`
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
          findStats.wrong ||
          findStats.hints ||
          findStats.reveals ||
          findStats.skips
        : guessed.size;

    if (hasProgress && !window.confirm(`Restart the ${label} quiz?`)) {
      return;
    }

    window.localStorage.removeItem(currentProgressKey);
    setGuessed(new Set());
    setRevealedIds(new Set());
    setFindStats(EMPTY_FIND_STATS);
    setFindTargetId(null);
    setFindWrongIds([]);
    setWrongFlashId(null);
    setMapFocusRequest(null);
    setFindDeferredIds(new Set());
    setHintLevel(0);
    setRecent([]);
    setGaveUp(false);
    setAmbiguous([]);
    setActiveId(null);
    setQuery("");
    setStartedAt(null);
    setNow(Date.now());
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

  function handleCountrySearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
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

      <header className="topbar">
        <div className="brand">
          <Globe2 size={28} aria-hidden="true" />
          <div>
            <h1>Subdivision Quiz</h1>
            <p>Name subdivisions or find them on the map.</p>
          </div>
        </div>

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

          <div className="quiz-mode-switch" role="group" aria-label="Quiz mode">
            <button
              type="button"
              className={quizMode === "type" ? "is-active" : ""}
              onClick={() => setQuizMode("type")}
            >
              <Keyboard size={17} aria-hidden="true" />
              Type
            </button>
            <button
              type="button"
              className={quizMode === "find" ? "is-active" : ""}
              onClick={() => setQuizMode("find")}
            >
              <MousePointer2 size={17} aria-hidden="true" />
              Find
            </button>
          </div>
        </div>

        <div className="top-actions">
          <button type="button" className="icon-button" title="Copy result" onClick={shareResult}>
            <Share2 size={18} aria-hidden="true" />
          </button>
          <button type="button" className="icon-button" title="Restart quiz" onClick={restartQuiz}>
            <RotateCcw size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="play-area">
          {showHelpCard ? (
            <aside className="help-card" aria-label="How to play">
              <Info size={18} aria-hidden="true" />
              <div>
                <strong>How to play</strong>
                <p>
                  Pick a country, region, or the whole world, then choose how you want
                  to play.
                </p>
                <ul>
                  <li>Type mode accepts English, local, romanized, or native-script names.</li>
                  <li>Find mode gives you a name and asks you to click the territory.</li>
                  <li>Wrong clicks reveal what you clicked and count against accuracy.</li>
                  <li>Hints draw a shrinking search area without centering the answer.</li>
                  <li>Your progress saves automatically; Reset starts this quiz over.</li>
                </ul>
              </div>
              <button
                type="button"
                className="help-dismiss"
                title="Dismiss"
                onClick={dismissHelpCard}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </aside>
          ) : null}

          <div className="map-heading">
            <div>
              <h2>{label}</h2>
              <span>
                {total.toLocaleString()} subdivisions
                {scope.kind === "country"
                  ? ""
                  : ` across ${
                      scope.kind === "region"
                        ? regions.find((region) => region.name === scope.value)?.countries || 0
                        : countries.length
                    } countries`}
              </span>
            </div>
            <div className={quizMode === "find" ? "metric-row is-find-mode" : "metric-row"}>
              <div>
                <strong>
                  {(quizMode === "find" ? completedIds.size : guessed.size).toLocaleString()}
                </strong>
                <span>{quizMode === "find" ? "done" : "found"}</span>
              </div>
              <div>
                <strong>{missingFeatures.length.toLocaleString()}</strong>
                <span>left</span>
              </div>
              {quizMode === "find" ? (
                <>
                  <div>
                    <strong>{findStats.wrong.toLocaleString()}</strong>
                    <span>wrong</span>
                  </div>
                  <div>
                    <strong>{findStats.hints.toLocaleString()}</strong>
                    <span>hints</span>
                  </div>
                </>
              ) : null}
              <div>
                <strong>{formatDuration(elapsed)}</strong>
                <span>time</span>
              </div>
            </div>
          </div>

          <div className="progress-track" aria-label={`${percent}% complete`}>
            <div style={{ width: `${percent}%` }} />
          </div>

          <div className={quizMode === "find" ? "quiz-bar is-find-mode" : "quiz-bar"}>
            {quizMode === "type" ? (
              <>
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

                <div className="mode-row" role="group" aria-label="Duplicate answer mode">
                  <button
                    type="button"
                    className={matchMode === "single" ? "is-active" : ""}
                    onClick={() => setMatchMode("single")}
                  >
                    One
                  </button>
                  <button
                    type="button"
                    className={matchMode === "all" ? "is-active" : ""}
                    onClick={() => setMatchMode("all")}
                  >
                    All matches
                  </button>
                </div>
              </>
            ) : (
              <div className="find-prompt" aria-live="polite">
                <MousePointer2 size={20} aria-hidden="true" />
                <div>
                  <span className="prompt-label">Find this subdivision</span>
                  <strong>{complete ? "Complete" : prompt.primary}</strong>
                  <span>{complete ? "Every subdivision in this quiz is completed." : prompt.secondary}</span>
                </div>
              </div>
            )}

            <div className="notice" aria-live="polite">
              {visibleNotice}
            </div>

            {quizMode === "type" ? (
              <div className="panel-actions">
                <button
                  type="button"
                  className="danger-action"
                  onClick={() => setGaveUp(true)}
                  disabled={gaveUp || complete}
                >
                  <Flag size={17} aria-hidden="true" />
                  Give up
                </button>
                <button
                  type="button"
                  className="reset-action"
                  onClick={restartQuiz}
                  disabled={!guessed.size && !gaveUp}
                >
                  <RotateCcw size={17} aria-hidden="true" />
                  Reset
                </button>
              </div>
            ) : (
              <div className="panel-actions find-actions">
                <button
                  type="button"
                  className="hint-action"
                  onClick={requestHint}
                  disabled={!currentTarget || complete || hintLevel >= MAX_FIND_HINTS}
                >
                  <Lightbulb size={17} aria-hidden="true" />
                  Hint
                </button>
                <button
                  type="button"
                  className="reveal-action"
                  onClick={revealFindTarget}
                  disabled={!currentTarget || complete}
                >
                  <Eye size={17} aria-hidden="true" />
                  Reveal
                </button>
                <button
                  type="button"
                  className="skip-action"
                  onClick={skipFindTarget}
                  disabled={!currentTarget || complete}
                >
                  <SkipForward size={17} aria-hidden="true" />
                  Skip
                </button>
                <button
                  type="button"
                  className="reset-action"
                  onClick={restartQuiz}
                  disabled={
                    !completedIds.size &&
                    !findStats.wrong &&
                    !findStats.hints &&
                    !findStats.reveals &&
                    !findStats.skips
                  }
                >
                  <RotateCcw size={17} aria-hidden="true" />
                  Reset
                </button>
              </div>
            )}
          </div>

          {quizMode === "type" && ambiguous.length ? (
            <div className="resolver map-resolver">
              <div className="resolver-heading">
                <strong>{ambiguous[0].properties.name}</strong>
                <button type="button" onClick={() => addGuesses(ambiguous)}>
                  Add all
                </button>
              </div>
              <div className="resolver-list">
                {ambiguous.slice(0, 18).map((feature) => (
                  <button
                    key={feature.properties.id}
                    type="button"
                    onClick={() => addGuesses([feature], `Added ${feature.properties.name}.`)}
                    onMouseEnter={() => setActiveId(feature.properties.id)}
                  >
                    <span>{feature.properties.country}</span>
                    <LocalNameLine feature={feature} />
                    <NativeNameLine feature={feature} />
                    <small>{feature.properties.typeEn}</small>
                  </button>
                ))}
              </div>
            </div>
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
              wrongIds={wrongIdSet}
              wrongFlashId={wrongFlashId}
              activeId={activeId}
              scope={scope}
              clickable={quizMode === "find" && !complete && !gaveUp}
              forceTinyMarkers={quizMode === "find"}
              currentTargetId={currentTarget?.properties.id || null}
              focusFeatureId={mapFocusRequest?.id || null}
              focusRequestNonce={mapFocusRequest?.nonce || 0}
              hintLevel={hintLevel}
              onHover={setActiveId}
              onFeatureClick={handleFeatureClick}
            />
          )}
        </section>

        <aside className="side-panel">
          {quizMode === "find" ? (
            <section className="answer-section find-side-card">
              <div className="section-title">
                <MousePointer2 size={18} aria-hidden="true" />
                <h3>Current Target</h3>
              </div>
              <div className="find-target-card">
                <span className="prompt-label">Find</span>
                <strong>{complete ? "Complete" : prompt.primary}</strong>
                <span>
                  {complete ? "Every subdivision in this quiz is completed." : prompt.secondary}
                </span>
              </div>
              <div className="find-tried-list">
                <strong>Tried clicks</strong>
                {wrongClickFeatures.length ? (
                  <div className="answer-list compact">
                    {wrongClickFeatures.map((feature) => (
                      <button
                        key={feature.properties.id}
                        type="button"
                        onMouseEnter={() => setActiveId(feature.properties.id)}
                        onFocus={() => setActiveId(feature.properties.id)}
                      >
                        <strong>{feature.properties.name}</strong>
                        <LocalNameLine feature={feature} />
                        <NativeNameLine feature={feature} />
                        <span>{feature.properties.country}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p>No wrong clicks for this target.</p>
                )}
              </div>
            </section>
          ) : null}

          <section className="answer-section">
            <div className="section-title">
              <ListChecks size={18} aria-hidden="true" />
              <h3>Recent</h3>
            </div>
            <div className="answer-list compact">
              {recent.length ? (
                recent.map((feature) => (
                  <button
                    key={feature.properties.id}
                    type="button"
                    onMouseEnter={() => setActiveId(feature.properties.id)}
                    onFocus={() => setActiveId(feature.properties.id)}
                  >
                    <strong>{feature.properties.name}</strong>
                    <LocalNameLine feature={feature} />
                    <NativeNameLine feature={feature} />
                    <span>{feature.properties.country}</span>
                  </button>
                ))
              ) : (
                <p>No answers yet.</p>
              )}
            </div>
          </section>

          <section className="answer-section">
            <div className="section-title">
              <Eye size={18} aria-hidden="true" />
              <h3>
                {gaveUp
                  ? "Missing"
                  : quizMode === "find"
                    ? "Completed"
                    : complete
                      ? "Missing"
                      : "Found"}
              </h3>
            </div>
            <div className="answer-list">
              {gaveUp || (quizMode === "type" && complete) ? (
                missingFeatures.slice(0, 120).map((feature) => (
                  <button
                    key={feature.properties.id}
                    type="button"
                    onMouseEnter={() => setActiveId(feature.properties.id)}
                    onFocus={() => setActiveId(feature.properties.id)}
                  >
                    <strong>{feature.properties.name}</strong>
                    <LocalNameLine feature={feature} />
                    <NativeNameLine feature={feature} />
                    <span>{feature.properties.country}</span>
                  </button>
                ))
              ) : completedReviewFeatures.length ? (
                completedReviewFeatures.slice(0, 120).map((feature) => (
                  <button
                    key={feature.properties.id}
                    type="button"
                    onMouseEnter={() => setActiveId(feature.properties.id)}
                    onFocus={() => setActiveId(feature.properties.id)}
                  >
                    <strong>{feature.properties.name}</strong>
                    <LocalNameLine feature={feature} />
                    <NativeNameLine feature={feature} />
                    <span>{feature.properties.country}</span>
                  </button>
                ))
              ) : (
                <p>{quizMode === "find" ? "Completed territories appear here." : "Found answers appear here."}</p>
              )}
            </div>
          </section>

          <div className="data-credit">
            <Timer size={15} aria-hidden="true" />
            <span>
              Map data:{" "}
              <a
                href="https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/"
                target="_blank"
                rel="noreferrer"
              >
                Natural Earth ADM1
              </a>
            </span>
          </div>
        </aside>
      </main>
    </div>
  );
}
