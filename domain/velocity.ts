// Framework-free business logic. Zero imports from @prisma/client, next, or
// infrastructure/ -- see AD-1 in the Architecture Spine.

import type { BacklogIssue } from "./backlog-issue.ts";

// Story 4.2 -- Planned Velocity: "hours committed at Sprint start," which
// only ever means issues someone was actually assigned to -- an unassigned
// pulled issue was never committed to anyone, so it doesn't count here.
// Deliberately narrower than Story 3.5/4.1's team-wide over-allocation
// comparison (which counts every pulled issue, assigned or not) -- that's a
// different question ("are we over capacity given everything we've
// pulled"), not this one. Works the same whether the Sprint is active or
// closed -- estimateHours never changes after pull, so no snapshot copy of
// this figure is ever needed.
export function computePlannedVelocityHours(issues: BacklogIssue[]): number {
  return issues
    .filter((issue) => issue.assigneeId !== null)
    .reduce((total, issue) => total + issue.estimateHours, 0);
}

// Story 4.2 -- Actual Velocity: the sum of the PM's confirmed (possibly
// edited) logged hours across every assigned issue reviewed in the Close
// Sprint flow. Keyed by issue id, not member -- Velocity History (4.3) only
// ever needs one total per closed Sprint.
export function computeActualVelocityHours(confirmedHoursByIssueId: Map<string, number>): number {
  return Array.from(confirmedHoursByIssueId.values()).reduce((total, hours) => total + hours, 0);
}

// Story 4.3 -- Velocity History's delta column: positive means the team
// delivered more than planned, negative means less. One shared
// implementation per AD-1, not reimplemented at the call site.
export function computeVelocityDelta(actualVelocityHours: number, plannedVelocityHours: number): number {
  return actualVelocityHours - plannedVelocityHours;
}
