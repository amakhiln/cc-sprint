// Runnable self-check for the pure calendar domain logic -- no test
// framework installed (see AGENTS.md / project conventions), so this is a
// plain assert-based script. Run with: node domain/calendar.selfcheck.ts
//
// ponytail: no framework, this is the smallest thing that fails when the
// logic breaks. Add real tests if a runner ever gets installed.

import assert from "node:assert/strict";
import {
  rangesOverlap,
  scopeEntriesToSprint,
  isWorkingDay,
  countWorkingDays,
  getDistinctWorkingDaysLost,
} from "./calendar.ts";

const sprint = { startDate: new Date("2026-08-18"), endDate: new Date("2026-08-31") };

// CLEARLY_OVERLAPPING: entry range fully inside the Sprint range.
assert.equal(
  rangesOverlap({ startDate: new Date("2026-08-20"), endDate: new Date("2026-08-22") }, sprint),
  true,
  "an entry fully inside the Sprint range should overlap",
);

// BOUNDARY_TOUCH: entry's endDate equals the Sprint's startDate.
assert.equal(
  rangesOverlap({ startDate: new Date("2026-08-10"), endDate: new Date("2026-08-18") }, sprint),
  true,
  "an entry ending exactly on the Sprint's startDate should overlap (inclusive)",
);

// BOUNDARY_TOUCH: entry's startDate equals the Sprint's endDate.
assert.equal(
  rangesOverlap({ startDate: new Date("2026-08-31"), endDate: new Date("2026-09-05") }, sprint),
  true,
  "an entry starting exactly on the Sprint's endDate should overlap (inclusive)",
);

// CLEARLY_NON_OVERLAPPING: entirely before the Sprint range.
assert.equal(
  rangesOverlap({ startDate: new Date("2026-08-01"), endDate: new Date("2026-08-05") }, sprint),
  false,
  "an entry entirely before the Sprint range should not overlap",
);

// CLEARLY_NON_OVERLAPPING: entirely after the Sprint range.
assert.equal(
  rangesOverlap({ startDate: new Date("2026-09-10"), endDate: new Date("2026-09-15") }, sprint),
  false,
  "an entry entirely after the Sprint range should not overlap",
);

// scopeEntriesToSprint -- the panel's exact filter+sort composition.

// null sprint -> empty array, regardless of entries.
assert.deepEqual(
  scopeEntriesToSprint(
    [{ key: "a", label: "Holiday", startDate: new Date("2026-08-20"), endDate: new Date("2026-08-21") }],
    null,
  ),
  [],
  "a null sprint should produce an empty array",
);

// Mix of overlapping/non-overlapping entries, given out of order -- only the
// overlapping ones survive, sorted by startDate ascending.
const mixed = [
  { key: "late-overlap", label: "Holiday", startDate: new Date("2026-08-25"), endDate: new Date("2026-08-26") },
  { key: "before", label: "Leave", startDate: new Date("2026-08-01"), endDate: new Date("2026-08-05") },
  { key: "early-overlap", label: "Leave", startDate: new Date("2026-08-19"), endDate: new Date("2026-08-20") },
  { key: "after", label: "Holiday", startDate: new Date("2026-09-10"), endDate: new Date("2026-09-15") },
];
assert.deepEqual(
  scopeEntriesToSprint(mixed, sprint).map((entry) => entry.key),
  ["early-overlap", "late-overlap"],
  "only overlapping entries should survive, sorted by startDate ascending",
);

// isWorkingDay -- Mon-Fri true, Sat/Sun false, UTC day-of-week.
assert.equal(isWorkingDay(new Date("2026-08-17")), true, "Monday should be a working day"); // Mon
assert.equal(isWorkingDay(new Date("2026-08-21")), true, "Friday should be a working day"); // Fri
assert.equal(isWorkingDay(new Date("2026-08-22")), false, "Saturday should not be a working day"); // Sat
assert.equal(isWorkingDay(new Date("2026-08-23")), false, "Sunday should not be a working day"); // Sun

// countWorkingDays -- a 2-week Sprint (Mon 8/17 - Fri 8/28) has 10 working days.
const twoWeekSprint = { startDate: new Date("2026-08-17"), endDate: new Date("2026-08-28") };
assert.equal(
  countWorkingDays(twoWeekSprint),
  10,
  "a Mon-Fri, Mon-Fri Sprint range should count 10 working days",
);

// WEEKEND_SPAN -- a Leave range spanning a weekend excludes the weekend days
// from the day-count entirely (Fri 8/21 - Mon 8/24 -> only Fri and Mon count).
assert.equal(
  getDistinctWorkingDaysLost(
    [{ startDate: new Date("2026-08-21"), endDate: new Date("2026-08-24") }],
    twoWeekSprint,
  ),
  2,
  "a Leave range spanning a weekend should only count the working days within it",
);

// OVERLAP_DEDUP -- a Leave range (Mon 8/24 - Wed 8/26, 3 working days) that
// includes a Holiday date (Tue 8/25) should count that day once: 3 distinct
// days lost, not 4.
assert.equal(
  getDistinctWorkingDaysLost(
    [
      { startDate: new Date("2026-08-24"), endDate: new Date("2026-08-26") }, // Leave
      { startDate: new Date("2026-08-25"), endDate: new Date("2026-08-25") }, // Holiday, inside the Leave range
    ],
    twoWeekSprint,
  ),
  3,
  "a Holiday date already inside a Leave range should not be double-counted",
);

// Non-overlapping entries are skipped entirely, not clipped to nonsense.
assert.equal(
  getDistinctWorkingDaysLost(
    [{ startDate: new Date("2026-09-10"), endDate: new Date("2026-09-11") }],
    twoWeekSprint,
  ),
  0,
  "an entry entirely outside the Sprint should be skipped",
);

console.log("calendar.selfcheck: all assertions passed");
