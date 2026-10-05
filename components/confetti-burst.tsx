"use client";

import { useMemo } from "react";
import type { CSSProperties } from "react";

const COLORS = ["var(--accent-peach)", "var(--accent-lilac)", "var(--accent-mint)", "var(--accent-gold)"];
const PIECE_COUNT = 18;

// Sprint Close celebration -- a small, hand-rolled burst (no confetti
// library) in the app's own category palette. dx/dy are precomputed in JS
// rather than relying on CSS trig functions, for broader browser support.
// Parent only mounts this when motion is allowed (see close-sprint-dialog).
export function ConfettiBurst() {
  const pieces = useMemo(() => {
    return Array.from({ length: PIECE_COUNT }, (_, index) => {
      const angle = (index / PIECE_COUNT) * Math.PI * 2 + (index % 2 === 0 ? 0.15 : -0.15);
      const distance = 56 + (index % 5) * 14;
      return {
        id: index,
        color: COLORS[index % COLORS.length],
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance,
        delay: (index % 6) * 15,
      };
    });
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="confetti-piece h-2 w-2 rounded-[2px]"
          style={
            {
              background: piece.color,
              animationDelay: `${piece.delay}ms`,
              "--dx": `${piece.dx}px`,
              "--dy": `${piece.dy}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
