// Runnable self-check for the pure capacity domain logic -- no test
// framework installed (see AGENTS.md / project conventions), so this is a
// plain assert-based script. Run with: node domain/capacity.selfcheck.ts
//
// ponytail: no framework, this is the smallest thing that fails when the
// logic breaks. Add real tests if a runner ever gets installed.

import assert from "node:assert/strict";
import {
  computeTeamMemberCapacityHours,
  sumCapacityHours,
  computeCapacityForTeam,
  computeAllocationBreakdown,
  sumAllocationBreakdown,
  compareAssignedToCapacity,
} from "./capacity.ts";

// A 2-week Sprint, Mon 8/17 - Fri 8/28 -- 10 working days.
const sprint = { startDate: new Date("2026-08-17"), endDate: new Date("2026-08-28") };
const workingHoursPerDay = 8;
const devPercent = 60;

// NO_LEAVE_NO_HOLIDAY -- 10 working days x 8h x 60% = 48h, undiminished.
{
  const result = computeTeamMemberCapacityHours({
    workingHoursPerDay,
    devPercent,
    sprint,
    leaves: [],
    holidays: [],
  });
  assert.equal(result.fullDevHours, 48, "NO_LEAVE_NO_HOLIDAY: fullDevHours should be 48");
  assert.equal(result.capacityHours, 48, "NO_LEAVE_NO_HOLIDAY: capacityHours should be 48");
}

// WORKED_EXAMPLE -- 2 Leave days (Wed-Thu) + 1 non-overlapping Holiday day
// (the following Wednesday) = 3 distinct days lost -> 14.4h deducted ->
// capacityHours = 33.6 (the PRD's worked example).
{
  const result = computeTeamMemberCapacityHours({
    workingHoursPerDay,
    devPercent,
    sprint,
    leaves: [{ startDate: new Date("2026-08-19"), endDate: new Date("2026-08-20") }],
    holidays: [{ startDate: new Date("2026-08-26"), endDate: new Date("2026-08-26") }],
  });
  assert.equal(result.fullDevHours, 48, "WORKED_EXAMPLE: fullDevHours should stay 48 (undiminished)");
  assert.equal(result.capacityHours, 33.6, "WORKED_EXAMPLE: capacityHours should be 33.6");
}

// OVERLAP_DEDUP -- a Leave range (Mon-Wed, 3 working days) that includes a
// Holiday date (the Tuesday) should count that day once: 3 distinct days
// lost, not 4 -> same 14.4h deduction as WORKED_EXAMPLE.
{
  const result = computeTeamMemberCapacityHours({
    workingHoursPerDay,
    devPercent,
    sprint,
    leaves: [{ startDate: new Date("2026-08-24"), endDate: new Date("2026-08-26") }],
    holidays: [{ startDate: new Date("2026-08-25"), endDate: new Date("2026-08-25") }],
  });
  assert.equal(result.capacityHours, 33.6, "OVERLAP_DEDUP: the shared day should only be deducted once");
}

// WEEKEND_SPAN -- a Leave range spanning a weekend (Fri-Mon) only loses the
// 2 working days within it, not all 4 calendar days.
{
  const result = computeTeamMemberCapacityHours({
    workingHoursPerDay,
    devPercent,
    sprint,
    leaves: [{ startDate: new Date("2026-08-21"), endDate: new Date("2026-08-24") }],
    holidays: [],
  });
  assert.equal(result.capacityHours, 38.4, "WEEKEND_SPAN: only the 2 working days should be deducted");
}

// 0% Dev allocation -- both figures are 0, no NaN/error (acceptance
// criteria: a member with no Dev-category row still renders cleanly).
{
  const result = computeTeamMemberCapacityHours({
    workingHoursPerDay,
    devPercent: 0,
    sprint,
    leaves: [],
    holidays: [],
  });
  assert.equal(result.fullDevHours, 0, "0% Dev: fullDevHours should be 0");
  assert.equal(result.capacityHours, 0, "0% Dev: capacityHours should be 0");
}

// TEAM_TOTAL -- team-wide Capacity is the sum of every member's individual
// Capacity, distinct members with different figures (not just N=1).
{
  const memberA = computeTeamMemberCapacityHours({
    workingHoursPerDay: 8,
    devPercent: 60,
    sprint,
    leaves: [],
    holidays: [],
  }); // 48h
  const memberB = computeTeamMemberCapacityHours({
    workingHoursPerDay: 6,
    devPercent: 100,
    sprint,
    leaves: [{ startDate: new Date("2026-08-17"), endDate: new Date("2026-08-17") }],
    holidays: [],
  }); // 10 working days x 6h - 1 day x 6h = 54h
  const team = sumCapacityHours([memberA, memberB]);
  assert.equal(team.capacityHours, 102, "TEAM_TOTAL: capacityHours should sum both members (48 + 54)");
  assert.equal(team.fullDevHours, 108, "TEAM_TOTAL: fullDevHours should sum both members (48 + 60)");

  const empty = sumCapacityHours([]);
  assert.deepEqual(empty, { capacityHours: 0, fullDevHours: 0 }, "an empty roster should sum to 0");
}

// ZERO_WORKING_DAYS -- a Sprint range landing entirely on a weekend has 0
// working days: both figures are 0, no NaN/error (the CapacityLedger's
// fullHours===0 guard's real trigger path, not just a synthetic 0% Dev case).
{
  const weekendOnlySprint = { startDate: new Date("2026-08-22"), endDate: new Date("2026-08-23") }; // Sat-Sun
  const result = computeTeamMemberCapacityHours({
    workingHoursPerDay,
    devPercent,
    sprint: weekendOnlySprint,
    leaves: [],
    holidays: [],
  });
  assert.equal(result.fullDevHours, 0, "ZERO_WORKING_DAYS: fullDevHours should be 0");
  assert.equal(result.capacityHours, 0, "ZERO_WORKING_DAYS: capacityHours should be 0");
}

// computeCapacityForTeam -- the Roster page's per-member join: resolves each
// member's devPercent from their allocation rows (not just the formula in
// isolation). Two members: one with a Dev-category row, one without (hits
// the `?? 0` fallback) -- confirms the join is keyed correctly, not just
// coincidentally matching.
{
  const teamMembers = [
    { id: "tm-1", workingHoursPerDay: 8 },
    { id: "tm-2", workingHoursPerDay: 8 },
  ];
  const allocationsByMemberId = new Map([
    ["tm-1", [{ categoryId: "cat-dev", percent: 60 }, { categoryId: "cat-mgmt", percent: 40 }]],
    ["tm-2", [{ categoryId: "cat-mgmt", percent: 100 }]], // no cat-dev row at all
  ]);
  const leavesByMemberId = new Map();

  const result = computeCapacityForTeam({
    teamMembers,
    allocationsByMemberId,
    leavesByMemberId,
    holidays: [],
    devCategoryId: "cat-dev",
    sprint,
  });

  assert.equal(result.get("tm-1")?.capacityHours, 48, "tm-1's 60% Dev row should resolve to 48h");
  assert.equal(
    result.get("tm-2")?.capacityHours,
    0,
    "tm-2 with no Dev-category row should fall back to 0%, not throw or misjoin",
  );
}

// UNIFORM_DEDUCTION -- Dev 60%, Management 30%, DevOps 10%, plus 1 Leave day
// in the 10-working-day Sprint at 8h/day: every category's hours reduce by
// that day's own percent-scaled hours, not just Dev's.
{
  const result = computeAllocationBreakdown({
    workingHoursPerDay: 8,
    categoryIds: ["cat-dev", "cat-mgmt", "cat-devops"],
    allocations: [
      { categoryId: "cat-dev", percent: 60 },
      { categoryId: "cat-mgmt", percent: 30 },
      { categoryId: "cat-devops", percent: 10 },
    ],
    sprint,
    leaves: [{ startDate: new Date("2026-08-19"), endDate: new Date("2026-08-19") }],
    holidays: [],
  });
  assert.deepEqual(
    result,
    [
      { categoryId: "cat-dev", hours: 43.2 }, // 48 - 4.8
      { categoryId: "cat-mgmt", hours: 21.6 }, // 24 - 2.4
      { categoryId: "cat-devops", hours: 7.2 }, // 8 - 0.8
    ],
    "UNIFORM_DEDUCTION: the same day-loss should scale every category's own percent",
  );
}

// NO_ROW_FOR_CATEGORY -- a member with no allocation row for a category
// shows 0 hours, not omitted from the list.
{
  const result = computeAllocationBreakdown({
    workingHoursPerDay: 8,
    categoryIds: ["cat-dev", "cat-mgmt"],
    allocations: [{ categoryId: "cat-dev", percent: 60 }],
    sprint,
    leaves: [],
    holidays: [],
  });
  assert.deepEqual(
    result,
    [
      { categoryId: "cat-dev", hours: 48 },
      { categoryId: "cat-mgmt", hours: 0 },
    ],
    "NO_ROW_FOR_CATEGORY: a missing allocation row should show 0 hours, not be omitted",
  );
}

// TEAM_WIDE_PER_CATEGORY_TOTAL -- two members' breakdowns sum per category,
// with no cross-category mixing.
{
  const memberA = computeAllocationBreakdown({
    workingHoursPerDay: 8,
    categoryIds: ["cat-dev", "cat-mgmt"],
    allocations: [
      { categoryId: "cat-dev", percent: 60 },
      { categoryId: "cat-mgmt", percent: 40 },
    ],
    sprint,
    leaves: [],
    holidays: [],
  }); // dev 48, mgmt 32
  const memberB = computeAllocationBreakdown({
    workingHoursPerDay: 8,
    categoryIds: ["cat-dev", "cat-mgmt"],
    allocations: [{ categoryId: "cat-mgmt", percent: 100 }],
    sprint,
    leaves: [],
    holidays: [],
  }); // dev 0, mgmt 80
  const team = sumAllocationBreakdown([memberA, memberB]);
  assert.deepEqual(
    team,
    [
      { categoryId: "cat-dev", hours: 48 },
      { categoryId: "cat-mgmt", hours: 112 },
    ],
    "TEAM_WIDE_PER_CATEGORY_TOTAL: each category's total should sum only that category across members",
  );

  const empty = sumAllocationBreakdown([]);
  assert.deepEqual(empty, [], "an empty roster should sum to an empty breakdown");
}

// DEV_ROW_MATCHES_HEADLINE -- computeAllocationBreakdown's Dev-category row
// must equal computeTeamMemberCapacityHours's capacityHours for the same
// inputs. Two independent call paths sharing one formula today; this pins
// them together so a future edit to one and not the other is caught here.
{
  const input = {
    workingHoursPerDay: 8,
    devPercent: 60,
    sprint,
    leaves: [{ startDate: new Date("2026-08-19"), endDate: new Date("2026-08-20") }],
    holidays: [],
  };
  const headline = computeTeamMemberCapacityHours(input);
  const breakdown = computeAllocationBreakdown({
    workingHoursPerDay: input.workingHoursPerDay,
    categoryIds: ["cat-dev"],
    allocations: [{ categoryId: "cat-dev", percent: input.devPercent }],
    sprint: input.sprint,
    leaves: input.leaves,
    holidays: input.holidays,
  });
  assert.equal(
    breakdown[0].hours,
    headline.capacityHours,
    "DEV_ROW_MATCHES_HEADLINE: the breakdown's Dev row must equal the headline figure for the same inputs",
  );
}

// computeAllocationBreakdown with a Holiday-only deduction (not just Leave)
// and with a zero-working-day Sprint -- the same day-loss/denominator edge
// cases calendar.selfcheck.ts covers for the single-value formula, exercised
// through the per-category path too.
{
  const holidayOnly = computeAllocationBreakdown({
    workingHoursPerDay: 8,
    categoryIds: ["cat-dev"],
    allocations: [{ categoryId: "cat-dev", percent: 60 }],
    sprint,
    leaves: [],
    holidays: [{ startDate: new Date("2026-08-20"), endDate: new Date("2026-08-20") }],
  });
  assert.equal(holidayOnly[0].hours, 43.2, "Holiday-only deduction should reduce the breakdown row (48 - 4.8)");

  const zeroWorkingDays = computeAllocationBreakdown({
    workingHoursPerDay: 8,
    categoryIds: ["cat-dev", "cat-mgmt"],
    allocations: [{ categoryId: "cat-dev", percent: 60 }],
    sprint: { startDate: new Date("2026-08-22"), endDate: new Date("2026-08-23") }, // Sat-Sun
    leaves: [],
    holidays: [],
  });
  assert.deepEqual(
    zeroWorkingDays,
    [
      { categoryId: "cat-dev", hours: 0 },
      { categoryId: "cat-mgmt", hours: 0 },
    ],
    "a zero-working-day Sprint should yield 0 for every category, not NaN",
  );
}

// Story 3.5 -- compareAssignedToCapacity: over, under, and exactly-at
// Capacity (the boundary case -- equal is NOT over-allocated).
{
  const over = compareAssignedToCapacity(50, 48);
  assert.equal(over.overAllocated, true, "assigned hours exceeding capacity should warn");
  assert.equal(over.assignedHours, 50);
  assert.equal(over.capacityHours, 48);

  const under = compareAssignedToCapacity(30, 48);
  assert.equal(under.overAllocated, false, "assigned hours below capacity should not warn");

  const exact = compareAssignedToCapacity(48, 48);
  assert.equal(exact.overAllocated, false, "assigned hours exactly at capacity should not warn");

  // FLOAT_PRECISION_AT_BOUNDARY -- a sum that's mathematically equal to
  // capacity but lands as e.g. 7.700000000000001 due to float representation
  // must not be treated as over-allocated (review-patch: found by Edge Case
  // Hunter -- assignedHours previously wasn't rounded before comparing).
  const floatEqual = compareAssignedToCapacity(1.1 + 6.6, 7.7);
  assert.notEqual(1.1 + 6.6, 7.7, "sanity check: this sum must actually hit float noise for the test to mean anything");
  assert.equal(floatEqual.overAllocated, false, "a float-noisy but mathematically-equal sum should not warn");
  assert.equal(floatEqual.assignedHours, 7.7, "assignedHours should be rounded in the result, matching capacityHours's rounding");
}

console.log("capacity.selfcheck: all assertions passed");
