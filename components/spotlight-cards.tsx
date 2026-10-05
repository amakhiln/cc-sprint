"use client";

import { useEffect } from "react";

// Living Glass -- document-level pointer delegation (not per-card listeners)
// so this scales to any number of .glass-row cards for free. Updates the
// hovered card's --spot-x/--spot-y (consumed by .glass-row's background
// gradient in globals.css), rAF-throttled so a fast mouse doesn't queue
// redundant layout reads. Renders nothing; mount once near the app root.
export function SpotlightCards() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let current: HTMLElement | null = null;

    function reset(card: HTMLElement) {
      card.style.removeProperty("--spot-x");
      card.style.removeProperty("--spot-y");
    }

    function handleMove(event: PointerEvent) {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const card = (event.target as HTMLElement | null)?.closest<HTMLElement>(".glass-row") ?? null;
        if (card !== current && current) reset(current);
        current = card;
        if (!card) return;

        const rect = card.getBoundingClientRect();
        card.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
        card.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
      });
    }

    function handleLeaveWindow() {
      if (current) reset(current);
      current = null;
    }

    document.addEventListener("pointermove", handleMove, { passive: true });
    document.addEventListener("pointerleave", handleLeaveWindow);
    return () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerleave", handleLeaveWindow);
      if (raf) cancelAnimationFrame(raf);
      if (current) reset(current);
    };
  }, []);

  return null;
}
