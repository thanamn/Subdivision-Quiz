import { CheckCircle2, Globe2, MapPinned, MousePointer2, X } from "lucide-react";
import { useEffect, useRef } from "react";

export function TutorialOverlay({
  dismissTutorial,
}: {
  dismissTutorial: () => void;
}) {
  const cardRef = useRef<HTMLElement | null>(null);
  const startButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    startButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        dismissTutorial();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = cardRef.current?.querySelectorAll<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
      );
      const firstFocusable = focusableElements?.[0];
      const lastFocusable = focusableElements?.[focusableElements.length - 1];

      if (!firstFocusable || !lastFocusable) {
        return;
      }

      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dismissTutorial]);

  return (
    <div
      className="tutorial-overlay"
      aria-labelledby="tutorial-title"
      aria-modal="true"
      role="dialog"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          dismissTutorial();
        }
      }}
    >
      <section className="tutorial-card" ref={cardRef}>
        <button
          type="button"
          className="tutorial-close"
          aria-label="Close tutorial"
          title="Close"
          onClick={dismissTutorial}
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div className="tutorial-kicker">
          <Globe2 size={18} aria-hidden="true" />
          <span>How to play!</span>
        </div>

        <h2 id="tutorial-title">
          <span>First-level divisions</span>
          <span>around the world</span>
        </h2>
        <p className="tutorial-lede">
          Test yourself on states, provinces, prefectures, and other first-level
          administrative divisions. Pick a country, region, or the whole world.
        </p>

        <div className="tutorial-steps" aria-label="How the quiz works">
          <div>
            <MapPinned size={20} aria-hidden="true" />
            <strong>Choose your map</strong>
            <span>Pick a country, region, or the world, then choose Type or Click.</span>
          </div>
          <div>
            <CheckCircle2 size={20} aria-hidden="true" />
            <strong>Type answers</strong>
            <span>
              Many names can work for the same place, like Hokkaidō, Hokkaido,
              or 北海道.
            </span>
          </div>
          <div>
            <MousePointer2 size={20} aria-hidden="true" />
            <strong>Click targets</strong>
            <span>Find the prompted division on the map; tiny places can use markers.</span>
          </div>
        </div>

        <button
          type="button"
          className="tutorial-start"
          ref={startButtonRef}
          onClick={dismissTutorial}
        >
          Start playing
        </button>
      </section>
    </div>
  );
}
