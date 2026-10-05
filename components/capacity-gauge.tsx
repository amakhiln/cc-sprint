const SIZE = 132;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Radial companion to the Capacity Ledger's linear bar, reserved for the
// hero (team-wide) instance -- the per-member "small" ledger keeps the
// pill bar, which reads better at 96px wide. Pure CSS reveal via
// @starting-style (see .capacity-gauge-fill in globals.css) -- no client
// JS, so the arc is correct even before hydration.
export function CapacityGauge({ percent }: { percent: number }) {
  const offset = CIRCUMFERENCE * (1 - percent / 100);

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90" aria-hidden="true">
      <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--surface-glass)" strokeWidth={STROKE} />
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke="var(--accent-peach)"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        className="capacity-gauge-fill"
      />
    </svg>
  );
}
