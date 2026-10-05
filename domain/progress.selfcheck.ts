// Runnable self-check for the pure Sprint progress logic -- no test framework
// installed (see AGENTS.md / project conventions), so this is a plain
// assert-based script. Run with: node domain/progress.selfcheck.ts
//
// ponytail: no framework, this is the smallest thing that fails when the
// logic breaks. Add real tests if a runner ever gets installed.

import assert from "node:assert/strict";
import { computeIssueProgress, sumLoggedInSprint, sumProgress, computeBurndown } from "./progress.ts";

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

// Mon 2026-09-28 .. Sun 2026-10-04: 5 working days, then a weekend.
const sprint = { startDate: day("2026-09-28"), endDate: day("2026-10-04") };

// ISSUE_PROGRESS -- remaining clamps at 0, the excess becomes overrun.
assert.deepEqual(computeIssueProgress(8, 3), { estimateHours: 8, loggedHours: 3, remainingHours: 5, overrunHours: 0 });
assert.deepEqual(computeIssueProgress(4, 6), { estimateHours: 4, loggedHours: 6, remainingHours: 0, overrunHours: 2 });

// SPRINT_WINDOW -- work dated before the Sprint (or after it) doesn't count.
const logs = [
  { youtrackIssueId: "A", date: day("2026-09-20"), hours: 10 },
  { youtrackIssueId: "A", date: day("2026-09-28"), hours: 2 },
  { youtrackIssueId: "A", date: day("2026-09-29"), hours: 1 },
  { youtrackIssueId: "B", date: day("2026-09-29"), hours: 6 },
  { youtrackIssueId: "B", date: day("2026-10-05"), hours: 9 },
];
assert.deepEqual(
  Object.fromEntries(sumLoggedInSprint(logs, sprint)),
  { A: 3, B: 6 },
  "only work dated within the Sprint's start..end should be summed",
);

// TOTALS -- overrun issues counted, remaining never offset by another's overrun.
assert.deepEqual(sumProgress([computeIssueProgress(8, 3), computeIssueProgress(4, 6)]), {
  estimateHours: 12,
  loggedHours: 9,
  remainingHours: 5,
  overrunHours: 2,
  issueCount: 2,
  overrunIssueCount: 1,
});

// BURNDOWN -- start point + one point per calendar day; ideal flat over the
// weekend; actual null after today; B's 2h overrun doesn't reduce A's remaining.
const points = computeBurndown({
  sprint,
  issues: [
    { youtrackIssueId: "A", estimateHours: 6 },
    { youtrackIssueId: "B", estimateHours: 4 },
  ],
  logs,
  today: new Date("2026-09-30T15:30:00Z"),
});
assert.equal(points.length, 8, "start + 7 calendar days");
assert.deepEqual(
  points.map((point) => point.idealHours),
  [10, 8, 6, 4, 2, 0, 0, 0],
  "ideal steps down 10/5 per working day, flat Sat/Sun",
);
assert.deepEqual(
  points.map((point) => point.remainingHours),
  // start 10; Mon A-2 -> 8; Tue A-1, B-6 (clamped at 4) -> 3+0; Wed (today) same; rest future
  [10, 8, 3, 3, null, null, null, null],
  "actual remaining clamps each issue at 0 and stops at today",
);

console.log("progress.selfcheck: all assertions passed");
