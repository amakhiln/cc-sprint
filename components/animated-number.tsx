"use client";

import { useEffect, useState } from "react";

// Counts up from 0 to `value` on mount (ease-out-cubic); reduced-motion
// gets a ~1ms duration, an effectively instant snap without a second code
// path. Server-rendered markup always starts at 0, so there's no hydration
// mismatch -- the two paths differ only in how fast they reach the value.
export function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 1 : 700;
    const start = performance.now();
    let raf = 0;

    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      setDisplay(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <>
      {display.toFixed(1)}
      {suffix}
    </>
  );
}
