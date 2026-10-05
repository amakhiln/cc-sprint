// Capacity Ledger (DESIGN.md `components.capacity-ledger` / `data-figure`)
// -- the product's signature element. Story 2.5 only computes and renders
// the single Dev-based headline figure + fill; true per-category segments
// are Story 2.6's job (see spec's Never clause). Follows the same shape as
// components/status-chip.tsx: a small reusable, DESIGN.md-driven
// presentational component.

import { StatusChip } from "./status-chip";
import { CapacityGauge } from "./capacity-gauge";
import { AnimatedNumber } from "./animated-number";
import { CATEGORY_PALETTE } from "@/lib/category-palette";

export function CapacityLedger({
  capacityHours,
  fullHours,
  size = "default",
  breakdown,
  breakdownLabel = "Breakdown",
  assignedHours,
  overAllocated,
}: {
  capacityHours: number;
  fullHours: number;
  size?: "default" | "small";
  breakdown?: { categoryId: string; categoryName: string; hours: number }[];
  // Distinguishes each row's disclosure from the team-wide one and from
  // every other row's -- otherwise N+1 <details> on one page all share the
  // same "Breakdown" accessible name.
  breakdownLabel?: string;
  // Story 3.5 -- omitted entirely outside a Sprint-with-issues context
  // (unchanged rendering for every other caller). overAllocated only
  // matters when assignedHours is also given.
  assignedHours?: number;
  overAllocated?: boolean;
}) {
  // Guard fullHours === 0 -- an empty track, never NaN (e.g. a member with
  // 0% Dev allocation).
  const fillPercent = fullHours === 0 ? 0 : Math.max(0, Math.min(100, (capacityHours / fullHours) * 100));
  // "Hero" (default-size) instances are the two team-wide banners (Sprint
  // Plan Overview, Roster) -- the only callers with room for the radial
  // gauge; the small size's 96px-wide row keeps the linear pill bar.
  const isHero = size === "default";

  const breakdownDisclosure = breakdown && breakdown.length > 0 && (
    <details className="text-sm text-muted-foreground">
      <summary className="cursor-pointer select-none">{breakdownLabel}</summary>
      <ul className="mt-2 flex flex-col gap-1">
        {breakdown.map((category) => (
          <li key={category.categoryId} className="flex min-w-0 items-center justify-between gap-4">
            <span className="truncate">{category.categoryName}</span>
            <span className="shrink-0 font-heading text-foreground text-right">
              {category.hours.toFixed(1)}h
            </span>
          </li>
        ))}
      </ul>
    </details>
  );

  if (isHero) {
    const maxBreakdownHours = breakdown && breakdown.length > 0 ? Math.max(...breakdown.map((c) => c.hours), 1) : 1;

    return (
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="flex items-center gap-6">
          <div
            role="progressbar"
            aria-label="Capacity"
            aria-valuenow={Math.round(fillPercent)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="relative shrink-0"
            style={{ width: 132, height: 132 }}
          >
            <CapacityGauge percent={fillPercent} />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
              <span className="font-heading text-2xl font-semibold text-foreground">
                <AnimatedNumber value={capacityHours} suffix="h" />
              </span>
              <span className="text-xs text-muted-foreground">of {fullHours.toFixed(0)}h</span>
            </div>
          </div>
          {assignedHours !== undefined && (
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline gap-1.5">
                <span className="font-heading text-xl font-semibold text-foreground">
                  <AnimatedNumber value={assignedHours} suffix="h" />
                </span>
                <span className="text-xs text-muted-foreground">Assigned</span>
              </div>
              <div className="h-1.5 w-28 overflow-hidden rounded-full bg-[color:var(--surface-glass)]">
                {capacityHours !== 0 && (
                  <div
                    className="capacity-fill-in h-full rounded-full"
                    style={{
                      width: `${Math.max(0, Math.min(100, (assignedHours / capacityHours) * 100))}%`,
                      background: overAllocated ? "var(--signal-warning)" : "var(--accent-mint)",
                    }}
                  />
                )}
              </div>
              {overAllocated && <StatusChip variant="warning">Over-allocated</StatusChip>}
            </div>
          )}
        </div>

        {breakdown && breakdown.length > 0 && (
          <div className="flex flex-1 flex-col gap-3 lg:border-l lg:border-[color:var(--border-glass)] lg:pl-8">
            <span className="text-xs font-medium text-muted-foreground">{breakdownLabel}</span>
            <div className="flex flex-col gap-2.5">
              {breakdown.map((category, index) => {
                const barPercent = Math.max(0, Math.min(100, (category.hours / maxBreakdownHours) * 100));
                const color = CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];
                return (
                  <div key={category.categoryId} className="flex items-center gap-3">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
                    <span className="w-28 shrink-0 truncate text-sm text-foreground">{category.categoryName}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--surface-glass)]">
                      <div
                        className="capacity-fill-in h-full rounded-full"
                        style={{ width: `${barPercent}%`, background: color }}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right font-heading text-sm font-semibold text-foreground">
                      {category.hours.toFixed(1)}h
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="font-heading text-sm font-semibold text-foreground">{capacityHours.toFixed(1)}h</span>
      <div
        role="progressbar"
        aria-label="Capacity"
        aria-valuenow={Math.round(fillPercent)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--surface-glass)]"
      >
        {fullHours !== 0 && (
          <div
            className="capacity-fill-in h-full rounded-full bg-[color:var(--accent-peach)]"
            style={{ width: `${fillPercent}%` }}
          />
        )}
      </div>
      {assignedHours !== undefined && (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Assigned: {assignedHours.toFixed(1)}h</span>
          {overAllocated && <StatusChip variant="warning">Over-allocated</StatusChip>}
        </div>
      )}
      {breakdownDisclosure}
    </div>
  );
}
