import { useEffect, useState } from "react";

export function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function useQuizTimer(complete: boolean) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!startedAt || complete) {
      return undefined;
    }

    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt, complete]);

  function startQuizTimer() {
    if (!startedAt) {
      setStartedAt(Date.now());
    }
  }

  function resetQuizTimer() {
    setStartedAt(null);
    setNow(Date.now());
  }

  return {
    elapsed: startedAt ? now - startedAt : 0,
    now,
    resetQuizTimer,
    setNow,
    setStartedAt,
    startedAt,
    startQuizTimer,
  };
}
