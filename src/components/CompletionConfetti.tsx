import type { CSSProperties } from "react";

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

export function CompletionConfetti({ run }: { run: number }) {
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
