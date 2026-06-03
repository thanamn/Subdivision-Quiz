import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Download,
  Eye,
  Flag,
  Globe2,
  Info,
  ListChecks,
  RotateCcw,
  Search,
  Share2,
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
const MODE_KEY = "subdivision-quiz:match-mode";
const HELP_CARD_KEY = "subdivision-quiz:help-dismissed";
const WIKIDATA_ENDPOINT = "https://www.wikidata.org/w/api.php";
const WIKIDATA_BATCH_SIZE = 35;
const NATIVE_NAME_CANDIDATE_LIMIT = 8;
const NATIVE_LABEL_FEATURE_LIMIT = 650;

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

function progressStorageKey(key: string) {
  return `subdivision-quiz:progress:${key}`;
}

function initialHelpCardOpen() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(HELP_CARD_KEY) !== "1";
}

function csvCell(value: string | number | undefined) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadCsv(
  label: string,
  features: SubdivisionFeature[],
  guessed: Set<string>,
) {
  const rows = [
    ["status", "country", "type", "name", "local_names", "native_names", "code"]
      .map(csvCell)
      .join(","),
    ...features.sort(byCountryThenName).map((feature) =>
      [
        guessed.has(feature.properties.id) ? "found" : "missing",
        feature.properties.country,
        feature.properties.typeEn,
        feature.properties.name,
        localNameText(feature),
        nativeNameText(feature),
        feature.properties.code,
      ]
        .map(csvCell)
        .join(","),
    ),
  ];

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-subdivisions.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function localNameText(feature: SubdivisionFeature) {
  return feature.properties.localNames.join(" / ");
}

function nativeNameText(feature: SubdivisionFeature) {
  return feature.properties.nativeNames.map((nativeName) => nativeName.name).join(" / ");
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

export default function App() {
  const inputRef = useRef<HTMLInputElement | null>(null);
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
  const [matchMode, setMatchMode] = useState<"single" | "all">(() => {
    if (typeof window === "undefined") {
      return "single";
    }
    return window.localStorage.getItem(MODE_KEY) === "all" ? "all" : "single";
  });
  const [progressReady, setProgressReady] = useState(false);
  const [progressKey, setProgressKey] = useState<string | null>(null);
  const [showHelpCard, setShowHelpCard] = useState(initialHelpCardOpen);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [loadingError, setLoadingError] = useState<string | null>(null);

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
  const label = scopeLabel(scope, countries);
  const total = activeFeatures.length;
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
        .filter((feature) => !guessed.has(feature.properties.id))
        .sort(byCountryThenName),
    [activeFeatures, guessed],
  );
  const complete = total > 0 && guessed.size >= total;
  const percent = total ? Math.round((guessed.size / total) * 1000) / 10 : 0;
  const elapsed = startedAt ? now - startedAt : 0;
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
    window.localStorage.setItem(MODE_KEY, matchMode);
  }, [matchMode]);

  useEffect(() => {
    if (total) {
      setNotice(
        sourceSupplementalNameCount
          ? `Ready for ${label}.`
          : `Ready for ${label}. No local or native names are available in the source data.`,
      );
    }
  }, [key, label, sourceSupplementalNameCount, total]);

  useEffect(() => {
    if (
      scope.kind === "world" ||
      !scopedFeatures.length ||
      scopedFeatures.length > NATIVE_LABEL_FEATURE_LIMIT ||
      !Object.keys(countryRegionLookup).length
    ) {
      return undefined;
    }

    const needsNativeLabels = scopedFeatures.some((feature) => {
      const qid = feature.properties.wikidataId;
      const languages = countryRegionLookup[feature.properties.countryCode]?.languageCodes || [];
      return Boolean(
        qid &&
          languages.length &&
          !feature.properties.nativeNames.length &&
          !nativeNameLookup[qid],
      );
    });

    if (!needsNativeLabels) {
      return undefined;
    }

    let cancelled = false;
    setNativeNamesLoading(true);

    fetchNativeNamesForFeatures(scopedFeatures, countryRegionLookup)
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
        if (!cancelled) {
          setNativeNamesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [countryRegionLookup, key, label, nativeNameLookup, scope.kind, scopedFeatures]);

  useEffect(() => {
    setProgressReady(false);
    setGaveUp(false);
    setAmbiguous([]);
    setRecent([]);
    setActiveId(null);
    setQuery("");

    try {
      const raw = window.localStorage.getItem(progressStorageKey(key));
      const saved = raw ? (JSON.parse(raw) as string[]) : [];
      setGuessed(new Set(saved));
      setStartedAt(saved.length ? Date.now() : null);
    } catch {
      setGuessed(new Set());
      setStartedAt(null);
    }

    setProgressKey(key);
    setProgressReady(true);
  }, [key]);

  useEffect(() => {
    if (!progressReady || progressKey !== key) {
      return;
    }

    window.localStorage.setItem(
      progressStorageKey(key),
      JSON.stringify([...guessed]),
    );
  }, [guessed, key, progressKey, progressReady]);

  useEffect(() => {
    if (!startedAt || complete) {
      return undefined;
    }

    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt, complete]);

  useEffect(() => {
    if (window.matchMedia("(min-width: 720px)").matches) {
      inputRef.current?.focus();
    }
  }, [key]);

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

  async function shareResult() {
    const text = `I named ${guessed.size.toLocaleString()} of ${total.toLocaleString()} first-level subdivisions in ${label} (${percent}%).`;

    try {
      await navigator.clipboard.writeText(text);
      setNotice("Result copied to clipboard.");
    } catch {
      setNotice(text);
    }
  }

  function restartQuiz() {
    if (guessed.size && !window.confirm(`Restart the ${label} quiz?`)) {
      return;
    }

    window.localStorage.removeItem(progressStorageKey(key));
    setGuessed(new Set());
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
    if (window.matchMedia("(min-width: 720px)").matches) {
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Globe2 size={28} aria-hidden="true" />
          <div>
            <h1>Subdivision Quiz</h1>
            <p>How many first-level subdivisions can you name?</p>
          </div>
        </div>

        <div className="top-actions">
          <button type="button" className="icon-button" title="Copy result" onClick={shareResult}>
            <Share2 size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-button"
            title="Download CSV"
            onClick={() => downloadCsv(label, activeFeatures, guessed)}
          >
            <Download size={18} aria-hidden="true" />
          </button>
          <button type="button" className="icon-button" title="Restart quiz" onClick={restartQuiz}>
            <RotateCcw size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="play-area">
          <div className="scope-strip">
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

            <label className="select-control country-select">
              <span>Country</span>
              <select
                value={scope.kind === "country" ? scope.value : ""}
                onChange={(event) => {
                  if (event.target.value) {
                    setScope({ kind: "country", value: event.target.value });
                  }
                }}
              >
                <option value="">Choose country</option>
                {countries.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name} ({country.count})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {showHelpCard ? (
            <aside className="help-card" aria-label="How to play">
              <Info size={18} aria-hidden="true" />
              <div>
                <strong>How to play</strong>
                <p>
                  Type full subdivision names, including local or native-script names when
                  available. Postal abbreviations like US state codes do not count.
                </p>
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
            <div className="metric-row">
              <div>
                <strong>{guessed.size.toLocaleString()}</strong>
                <span>found</span>
              </div>
              <div>
                <strong>{missingFeatures.length.toLocaleString()}</strong>
                <span>left</span>
              </div>
              <div>
                <strong>{formatDuration(elapsed)}</strong>
                <span>time</span>
              </div>
            </div>
          </div>

          <div className="progress-track" aria-label={`${percent}% complete`}>
            <div style={{ width: `${percent}%` }} />
          </div>

          <div className="quiz-bar">
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

            <div className="notice" aria-live="polite">
              {complete
                ? "Complete. Every visible subdivision is found."
                : nativeNamesLoading
                  ? `${notice} Loading native names...`
                  : notice}
            </div>

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
              <button
                type="button"
                className="download-action"
                onClick={() => downloadCsv(label, activeFeatures, guessed)}
                disabled={!total}
              >
                <Download size={17} aria-hidden="true" />
                CSV
              </button>
            </div>
          </div>

          {ambiguous.length ? (
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
              activeId={activeId}
              scope={scope}
              onHover={setActiveId}
            />
          )}
        </section>

        <aside className="side-panel">
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
              <h3>{gaveUp || complete ? "Missing" : "Found"}</h3>
            </div>
            <div className="answer-list">
              {gaveUp || complete ? (
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
              ) : foundFeatures.length ? (
                foundFeatures.slice(0, 120).map((feature) => (
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
                <p>Found answers appear here.</p>
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
