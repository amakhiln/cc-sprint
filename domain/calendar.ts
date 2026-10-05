// Framework-free business logic. Zero imports from @prisma/client, next, or
// infrastructure/ — see AD-1 in the Architecture Spine.
//
// The one place range-overlap logic lives -- Story 2.5's Capacity
// computation extends this file rather than reimplementing overlap logic
// elsewhere (epic-2 architecture note).

export function rangesOverlap(
  a: { startDate: Date; endDate: Date },
  b: { startDate: Date; endDate: Date },
): boolean {
  // Inclusive on both ends -- a range touching at a single shared day still
  // counts as overlapping.
  return a.startDate <= b.endDate && a.endDate >= b.startDate;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Mon-Fri, UTC day-of-week -- dates are stored as UTC midnight throughout
// this app (day-granularity, no time-of-day), so UTC is the one correct
// frame here regardless of the server/viewer's local timezone.
export function isWorkingDay(date: Date): boolean {
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
}

export function countWorkingDays(range: { startDate: Date; endDate: Date }): number {
  let count = 0;
  for (let ms = range.startDate.getTime(); ms <= range.endDate.getTime(); ms += MS_PER_DAY) {
    if (isWorkingDay(new Date(ms))) count++;
  }
  return count;
}

// Story 2.5's Capacity computation -- distinct working days lost to
// Leave/Holiday within a Sprint. Clips each entry to its overlap with the
// Sprint, expands to individual UTC calendar days, keeps only working days,
// and dedupes via a Set keyed by day-index so a Leave range that includes a
// Holiday date only counts that day once.
export function getDistinctWorkingDaysLost(
  entries: { startDate: Date; endDate: Date }[],
  sprint: { startDate: Date; endDate: Date },
): number {
  const lostDayIndices = new Set<number>();
  for (const entry of entries) {
    if (!rangesOverlap(entry, sprint)) continue;
    const clippedStart = entry.startDate > sprint.startDate ? entry.startDate : sprint.startDate;
    const clippedEnd = entry.endDate < sprint.endDate ? entry.endDate : sprint.endDate;
    for (let ms = clippedStart.getTime(); ms <= clippedEnd.getTime(); ms += MS_PER_DAY) {
      if (isWorkingDay(new Date(ms))) {
        lostDayIndices.add(Math.floor(ms / MS_PER_DAY));
      }
    }
  }
  return lostDayIndices.size;
}

export type SprintScopedEntry = { key: string; label: string; startDate: Date; endDate: Date };

// Story 2.4's "Leave & Holidays" panel composition -- filter to entries that
// overlap the active Sprint, sorted by startDate. Lives here (not inline in
// the component) so it's testable the same way rangesOverlap is.
export function scopeEntriesToSprint(
  entries: SprintScopedEntry[],
  sprint: { startDate: Date; endDate: Date } | null,
): SprintScopedEntry[] {
  if (!sprint) return [];
  return entries
    .filter((entry) => rangesOverlap(entry, sprint))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}
