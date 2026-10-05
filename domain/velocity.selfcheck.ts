// Runnable self-check for the pure velocity domain logic -- no test
// framework installed (see AGENTS.md / project conventions), so this is a
// plain assert-based script. Run with: node domain/velocity.selfcheck.ts
//
// ponytail: no framework, this is the smallest thing that fails when the
// logic breaks. Add real tests if a runner ever gets installed.

import assert from "node:assert/strict";
import { computePlannedVelocityHours, computeVelocityDelta } from "./velocity.ts";
import type { BacklogIssue } from "./backlog-issue.ts";

function makeIssue(overrides: Partial<BacklogIssue>): BacklogIssue {
  return {
    id: "bi-1",
    youtrackIssueId: "P-1",
    sprintId: "s-1",
    title: "issue",
    assigneeId: null,
    estimateHours: 0,
    loggedHours: 0,
    loggedHoursPulledAt: null,
    ...overrides,
  };
}

// ASSIGNED_ONLY -- only assigned issues' hours count; unassigned ones are
// excluded entirely, not just zeroed.
{
  const issues = [
    makeIssue({ id: "bi-1", assigneeId: "tm-ada", estimateHours: 5 }),
    makeIssue({ id: "bi-2", assigneeId: "tm-ada", estimateHours: 3 }),
    makeIssue({ id: "bi-3", assigneeId: "tm-grace", estimateHours: 4 }),
    makeIssue({ id: "bi-4", assigneeId: null, estimateHours: 100 }),
  ];
  assert.equal(computePlannedVelocityHours(issues), 12, "only the three assigned issues (5+3+4) should count");
}

// EMPTY -- no issues at all sums to 0.
{
  assert.equal(computePlannedVelocityHours([]), 0, "an empty list sums to 0");
}

// ALL_UNASSIGNED -- every pulled issue unassigned sums to 0, not the total.
{
  const issues = [
    makeIssue({ id: "bi-1", assigneeId: null, estimateHours: 10 }),
    makeIssue({ id: "bi-2", assigneeId: null, estimateHours: 20 }),
  ];
  assert.equal(computePlannedVelocityHours(issues), 0, "all-unassigned issues should sum to 0, never their raw total");
}

// Story 4.3 -- computeVelocityDelta: positive (over-delivered),
// negative (under-delivered), and exactly zero (matched plan).
{
  assert.equal(computeVelocityDelta(12, 10), 2, "delivering more than planned should be a positive delta");
  assert.equal(computeVelocityDelta(7, 10), -3, "delivering less than planned should be a negative delta");
  assert.equal(computeVelocityDelta(10, 10), 0, "matching the plan exactly should be a zero delta");
  assert.equal(computeVelocityDelta(0, 0), 0, "no planned and no actual hours should be a zero delta, not NaN");
}

console.log("velocity.selfcheck: all assertions passed");
