import type { CountrySummary, RegionSummary, Scope } from "../domain/types";
import type { FindStats, QuizMode } from "../quiz/quizTypes";
import { formatDuration } from "../quiz/useQuizTimer";

export function ProgressStats({
  completedCount,
  countries,
  elapsed,
  findStats,
  label,
  missingCount,
  percent,
  quizMode,
  regions,
  scope,
  total,
}: {
  completedCount: number;
  countries: CountrySummary[];
  elapsed: number;
  findStats: FindStats;
  label: string;
  missingCount: number;
  percent: number;
  quizMode: QuizMode;
  regions: RegionSummary[];
  scope: Scope;
  total: number;
}) {
  return (
    <>
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
            <strong>{completedCount.toLocaleString()}</strong>
            <span>{quizMode === "find" ? "done" : "found"}</span>
          </div>
          <div>
            <strong>{missingCount.toLocaleString()}</strong>
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
    </>
  );
}
