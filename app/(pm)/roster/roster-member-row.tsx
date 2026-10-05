"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { setTeamMemberAllocationsAction } from "@/app/actions/team-member-allocations";
import { updateTeamMemberWorkingHoursAction } from "@/app/actions/team-members";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/status-chip";
import { CATEGORY_PALETTE } from "@/lib/category-palette";
import { initials } from "@/lib/initials";
import { sprintEntryVariant } from "@/lib/sprint-entry-variant";
import { scopeEntriesToSprint } from "@/domain/calendar";
import type { Leave } from "@/domain/leave";
import type { Holiday } from "@/domain/holiday";
import type { Sprint } from "@/domain/sprint";
import { RemoveTeamMemberButton } from "./remove-team-member-button";
import { LeaveEntryForm } from "./leave-entry-form";

type Category = { id: string; name: string };
type Allocation = { categoryId: string; percent: number };

// Leave/Holiday dates are stored as UTC midnight (day-granularity, no
// time-of-day) -- format in UTC so the displayed day never shifts with the
// viewer's local timezone. Mirrors app/(pm)/leave/page.tsx and
// app/(pm)/sprint/page.tsx's identical helper.
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const LEAVE_TYPE_LABEL: Record<Leave["type"], string> = {
  planned: "Planned Leave",
  emergency: "Emergency Leave",
};

// Allocation Console row -- replaces the old card-grid + modal-dialog
// pattern with a dense table row (avatar, capacity figure, a single
// stacked bar encoding the whole category split at a glance) that expands
// inline in place for editing, instead of opening a Dialog. The stacked
// bar reads from the same draft state the edit inputs use, so it previews
// live while expanded and reverts to the last-saved split if you collapse
// without saving.
export function RosterMemberRow({
  id,
  name,
  workingHoursPerDay,
  categories,
  initialAllocations,
  activeSprint,
  holidays,
  leaves,
  index,
  devCategoryExists,
  capacityHours,
  fullHours,
  assignedHours,
  overAllocated,
  categoryColorById,
  enterDelayMs,
}: {
  id: string;
  name: string;
  workingHoursPerDay: number;
  categories: Category[];
  initialAllocations: Allocation[];
  activeSprint: Sprint | null;
  holidays: Holiday[];
  leaves: Leave[];
  index: number;
  devCategoryExists: boolean;
  capacityHours: number;
  fullHours: number;
  // Story 3.5 -- omitted entirely outside a Sprint-with-issues context
  // (matches CapacityLedger's identical props). Folded into the compact
  // capacity figure as a color change + tooltip rather than a new column --
  // this row is already five columns wide.
  assignedHours?: number;
  overAllocated?: boolean;
  categoryColorById: Record<string, string>;
  enterDelayMs?: number;
}) {
  const initialPercentByCategory = useMemo(() => {
    const map = new Map(initialAllocations.map((a) => [a.categoryId, a.percent]));
    return categories.map((category) => ({ category, percent: map.get(category.id) ?? 0 }));
  }, [categories, initialAllocations]);

  const [expanded, setExpanded] = useState(false);
  const [percents, setPercents] = useState<Record<string, number>>(() =>
    Object.fromEntries(initialPercentByCategory.map(({ category, percent }) => [category.id, percent])),
  );
  const [hours, setHours] = useState(workingHoursPerDay);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [leavePopoverOpen, setLeavePopoverOpen] = useState(false);

  const total = useMemo(() => Object.values(percents).reduce((sum, percent) => sum + percent, 0), [percents]);
  const offTarget = total !== 100;

  // "Leave & Holidays" (Story 2.4) -- this member's Leave plus every
  // company Holiday that overlaps the active Sprint.
  const sprintEntries = useMemo(() => {
    const entries = [
      ...leaves.map((leave) => ({
        key: `leave-${leave.id}`,
        label: LEAVE_TYPE_LABEL[leave.type],
        startDate: leave.startDate,
        endDate: leave.endDate,
      })),
      ...holidays.map((holiday) => ({
        key: `holiday-${holiday.id}`,
        label: "Holiday",
        startDate: holiday.startDate,
        endDate: holiday.endDate,
      })),
    ];
    return scopeEntriesToSprint(entries, activeSprint);
  }, [activeSprint, holidays, leaves]);

  // Reads from the live draft (percents), not the saved prop -- the bar
  // previews edits in progress while expanded, matching the % inputs
  // below it exactly.
  const nonZeroAllocations = categories
    .map((category) => ({ category, percent: percents[category.id] ?? 0 }))
    .filter(({ percent }) => percent > 0);

  function resetDraft() {
    setPercents(Object.fromEntries(initialPercentByCategory.map(({ category, percent }) => [category.id, percent])));
    setHours(workingHoursPerDay);
    setError(null);
    setLeavePopoverOpen(false);
  }

  function toggleExpand() {
    if (pending) return;
    // Reset every toggle, not just on open -- collapsing without saving
    // must discard the draft too, or the resting-row bar above would keep
    // showing an unsaved split as if it were committed.
    resetDraft();
    setExpanded((prev) => !prev);
  }

  function handleSave() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const allocations = categories.map((category) => ({
          categoryId: category.id,
          percent: percents[category.id] ?? 0,
        }));
        const [allocationResult, hoursResult] = await Promise.all([
          setTeamMemberAllocationsAction(id, allocations),
          updateTeamMemberWorkingHoursAction(id, hours),
        ]);
        if (allocationResult.ok && hoursResult.ok) {
          setExpanded(false);
        } else {
          const errors = [
            !allocationResult.ok ? allocationResult.error : null,
            !hoursResult.ok ? hoursResult.error : null,
          ].filter((message): message is string => message !== null);
          setError(errors.join("\n"));
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <>
      <li
        className="glass-row motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 flex cursor-pointer flex-wrap items-center gap-4 px-5 py-3 duration-500"
        style={enterDelayMs !== undefined ? { animationDelay: `${enterDelayMs}ms` } : undefined}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={expanded ? `Collapse ${name}` : `Expand ${name}`}
        onClick={toggleExpand}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleExpand();
          }
        }}
      >
        <div className="flex w-52 shrink-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-heading text-sm font-semibold text-white"
            style={{ background: CATEGORY_PALETTE[index % CATEGORY_PALETTE.length] }}
          >
            {initials(name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-heading text-foreground">{name}</span>
            <span className="block text-xs text-muted-foreground">{workingHoursPerDay}h/day</span>
          </span>
        </div>

        <div className="w-20 shrink-0">
          {devCategoryExists ? (
            <>
              <p
                className={`font-heading text-sm font-semibold ${overAllocated ? "text-[color:var(--signal-warning)]" : "text-foreground"}`}
                title={
                  assignedHours !== undefined
                    ? `Assigned: ${assignedHours.toFixed(1)}h${overAllocated ? " (over-allocated)" : ""}`
                    : undefined
                }
              >
                {capacityHours.toFixed(1)}h
              </p>
              <p className="text-xs text-muted-foreground">of {fullHours.toFixed(0)}h</p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">—</p>
          )}
        </div>

        <div className="min-w-[140px] flex-1">
          {nonZeroAllocations.length === 0 ? (
            <p className="text-xs text-muted-foreground">Unallocated</p>
          ) : (
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[color:var(--surface-glass)]">
              {nonZeroAllocations.map(({ category, percent }) => (
                <div
                  key={category.id}
                  title={`${category.name} ${percent}%`}
                  style={{ width: `${percent}%`, background: categoryColorById[category.id] ?? CATEGORY_PALETTE[0] }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="w-36 shrink-0">
          {sprintEntries.length === 0 ? (
            <span className="text-xs text-muted-foreground">Clear this sprint</span>
          ) : (
            <StatusChip variant={sprintEntryVariant(sprintEntries[0].label)}>
              {sprintEntries[0].label}
              {sprintEntries.length > 1 ? ` +${sprintEntries.length - 1}` : ""}
            </StatusChip>
          )}
        </div>

        <div
          className="flex shrink-0 items-center gap-2"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <RemoveTeamMemberButton id={id} name={name} />
        </div>

        <ChevronDown
          aria-hidden="true"
          className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      </li>

      {expanded && (
        <li className="glass-row flex flex-col gap-4 px-5 py-4">
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <label
                htmlFor={`hours-${id}`}
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Working Hours / Day
              </label>
              <input
                id={`hours-${id}`}
                type="number"
                inputMode="numeric"
                min={1}
                max={24}
                value={hours}
                disabled={pending}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setHours(Number.isFinite(value) ? Math.min(24, Math.max(1, Math.trunc(value))) : 1);
                }}
                aria-label="Working hours per day"
                className="w-20 rounded-sm border border-border bg-white/40 px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
            </div>

            <Popover open={leavePopoverOpen} onOpenChange={setLeavePopoverOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline">
                  Log Leave
                </Button>
              </PopoverTrigger>
              <PopoverContent>
                <LeaveEntryForm teamMemberId={id} onSaved={() => setLeavePopoverOpen(false)} />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Allocation</div>
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No allocation categories yet.</p>
            ) : (
              <div className="divide-y divide-[rgba(138,129,119,0.15)]">
                {categories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between gap-4 py-2">
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: categoryColorById[category.id] ?? CATEGORY_PALETTE[0] }}
                      />
                      {category.name}
                    </span>
                    <span className="flex items-center gap-1 text-sm">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={100}
                        value={percents[category.id] ?? 0}
                        disabled={pending}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          setPercents((prev) => ({
                            ...prev,
                            [category.id]: Number.isFinite(value) ? Math.min(100, Math.max(0, Math.trunc(value))) : 0,
                          }));
                        }}
                        aria-label={`${category.name} percent`}
                        className="w-16 rounded-sm border border-border bg-white/40 px-2 py-1 text-right text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
                      />
                      %
                    </span>
                  </div>
                ))}
                <div
                  aria-live="polite"
                  className={`flex items-center justify-between pt-2 text-xs font-semibold ${
                    offTarget ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  <span>{offTarget ? "⚠ Total" : "Total"}</span>
                  <span>{offTarget ? `${total}% (doesn't sum to 100%)` : `${total}%`}</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Leave &amp; Holidays
            </div>
            {!activeSprint ? (
              <p className="text-sm text-muted-foreground">No active Sprint</p>
            ) : sprintEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leave or holidays this sprint.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {sprintEntries.map((entry) => (
                  <li key={entry.key} className="flex items-center justify-between gap-3">
                    <StatusChip variant={sprintEntryVariant(entry.label)}>{entry.label}</StatusChip>
                    <span className="text-sm text-foreground">
                      {formatDate(entry.startDate)} – {formatDate(entry.endDate)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error.split("\n").map((line, lineIndex) => (
                <span key={lineIndex} className="block">
                  {line}
                </span>
              ))}
            </p>
          )}

          <div className="flex justify-end">
            <Button type="button" disabled={pending} onClick={handleSave}>
              {pending ? "Saving…" : offTarget ? "Save anyway" : "Save"}
            </Button>
          </div>
        </li>
      )}
    </>
  );
}
