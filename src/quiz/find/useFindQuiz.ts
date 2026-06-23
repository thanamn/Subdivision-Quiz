import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { featureShortName } from "../../domain/featureNames";
import type { SubdivisionFeature } from "../../domain/types";
import {
  EMPTY_FIND_STATS,
  MAX_FIND_HINTS,
  type FindStats,
  type QuizMode,
} from "../quizTypes";
import type { MapFocusRequest } from "./findTypes";

export function useFindQuiz({
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
}: {
  activeFeatures: SubdivisionFeature[];
  complete: boolean;
  completedIds: Set<string>;
  gaveUp: boolean;
  quizMode: QuizMode;
  setActiveId: (id: string | null) => void;
  setGuessed: Dispatch<SetStateAction<Set<string>>>;
  setNotice: (notice: string) => void;
  setRecent: Dispatch<SetStateAction<SubdivisionFeature[]>>;
  setRevealedIds: Dispatch<SetStateAction<Set<string>>>;
  startQuizTimer: () => void;
}) {
  const [findStats, setFindStats] = useState<FindStats>(EMPTY_FIND_STATS);
  const [findTargetId, setFindTargetId] = useState<string | null>(null);
  const [findWrongIds, setFindWrongIds] = useState<string[]>([]);
  const [wrongFlashId, setWrongFlashId] = useState<string | null>(null);
  const [mapFocusRequest, setMapFocusRequest] = useState<MapFocusRequest | null>(null);
  const [findDeferredIds, setFindDeferredIds] = useState<Set<string>>(new Set());
  const [hintLevel, setHintLevel] = useState(0);

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

  const resetFindQuiz = useCallback(() => {
    setFindStats(EMPTY_FIND_STATS);
    setFindTargetId(null);
    setFindWrongIds([]);
    setWrongFlashId(null);
    setMapFocusRequest(null);
    setFindDeferredIds(new Set());
    setHintLevel(0);
  }, []);

  const giveUpFindQuiz = useCallback(() => {
    setFindTargetId(null);
    setFindWrongIds([]);
    setWrongFlashId(null);
    setMapFocusRequest(null);
    setFindDeferredIds(new Set());
    setHintLevel(0);
    setActiveId(null);
    setNotice("Quiz ended. The remaining subdivisions are revealed.");
  }, [setActiveId, setNotice]);

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
    setActiveId,
  ]);

  const completeFindTarget = useCallback(
    (feature: SubdivisionFeature, result: "correct" | "revealed") => {
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
    },
    [
      setActiveId,
      setGuessed,
      setNotice,
      setRecent,
      setRevealedIds,
      startQuizTimer,
    ],
  );

  const handleFeatureClick = useCallback(
    (feature: SubdivisionFeature) => {
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
    },
    [
      complete,
      completeFindTarget,
      completedIds,
      currentTarget,
      gaveUp,
      quizMode,
      setActiveId,
      setNotice,
      startQuizTimer,
    ],
  );

  const requestHint = useCallback(() => {
    if (quizMode !== "find" || !currentTarget || complete || gaveUp) {
      return;
    }

    startQuizTimer();
    if (hintLevel >= MAX_FIND_HINTS) {
      setNotice("The search area is as tight as it gets. Show answer is available.");
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
  }, [complete, currentTarget, gaveUp, hintLevel, quizMode, setNotice, startQuizTimer]);

  const revealFindTarget = useCallback(() => {
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
  }, [complete, completeFindTarget, currentTarget, gaveUp, quizMode]);

  const skipFindTarget = useCallback(() => {
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
    setNotice(`Skipped ${featureShortName(currentTarget)} for now. It can come back later.`);
  }, [
    complete,
    currentTarget,
    gaveUp,
    quizMode,
    setActiveId,
    setNotice,
    startQuizTimer,
  ]);

  return {
    currentTarget,
    findStats,
    findTargetId,
    findWrongIds,
    giveUpFindQuiz,
    handleFeatureClick,
    hintLevel,
    mapFocusRequest,
    requestHint,
    resetFindQuiz,
    revealFindTarget,
    setFindStats,
    setFindTargetId,
    setFindWrongIds,
    setHintLevel,
    setMapFocusRequest,
    skipFindTarget,
    wrongClickFeatures,
    wrongFlashId,
    wrongIdSet,
  };
}
