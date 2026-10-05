// Framework-free business logic. Zero imports from @prisma/client, next, or
// infrastructure/ — see AD-1 in the Architecture Spine.

import { countWorkingDays, getDistinctWorkingDaysLost } from "./calendar.ts";

export type CapacityHours = { capacityHours: number; fullDevHours: number };

// Percent fractions (devPercent/100) combined with day/hour multiplication
// can drift into float noise (e.g. 47.99999999999999) -- round to the
// nearest hundredth so callers get a clean number, not just a display that
// happens to mask it via toFixed.
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// Story 2.5 -- the Sprint Capacity formula: Sprint working days x Working
// Hours x Dev Allocation % minus distinct working days lost to
// Leave/Holiday. `fullDevHours` is the undiminished Dev-scoped pool (the
// ledger bar's max, per DESIGN.md); `capacityHours` is that pool after
// deducting lost days. Never factors YouTrack-issue-hours -- Epic 3's job.
export function computeTeamMemberCapacityHours({
  workingHoursPerDay,
  devPercent,
  sprint,
  leaves,
  holidays,
}: {
  workingHoursPerDay: number;
  devPercent: number;
  sprint: { startDate: Date; endDate: Date };
  leaves: { startDate: Date; endDate: Date }[];
  holidays: { startDate: Date; endDate: Date }[];
}): CapacityHours {
  const sprintWorkingDays = countWorkingDays(sprint);
  const devFraction = devPercent / 100;
  const fullDevHours = sprintWorkingDays * workingHoursPerDay * devFraction;

  const daysLost = getDistinctWorkingDaysLost([...leaves, ...holidays], sprint);
  const capacityHours = fullDevHours - daysLost * workingHoursPerDay * devFraction;

  return { capacityHours: round2(capacityHours), fullDevHours: round2(fullDevHours) };
}

// The Roster page's per-member join: resolve each Team Member's devPercent
// from their allocation rows, then compute their Capacity. Lives here (not
// in app/(pm)/roster/page.tsx) per AD-1, and so the join itself -- not just
// the formula in isolation -- is covered by a self-check.
export function computeCapacityForTeam({
  teamMembers,
  allocationsByMemberId,
  leavesByMemberId,
  holidays,
  devCategoryId,
  sprint,
}: {
  teamMembers: { id: string; workingHoursPerDay: number }[];
  allocationsByMemberId: Map<string, { categoryId: string; percent: number }[]>;
  leavesByMemberId: Map<string, { startDate: Date; endDate: Date }[]>;
  holidays: { startDate: Date; endDate: Date }[];
  devCategoryId: string;
  sprint: { startDate: Date; endDate: Date };
}): Map<string, CapacityHours> {
  const result = new Map<string, CapacityHours>();
  for (const member of teamMembers) {
    const devAllocation = (allocationsByMemberId.get(member.id) ?? []).find(
      (allocation) => allocation.categoryId === devCategoryId,
    );
    result.set(
      member.id,
      computeTeamMemberCapacityHours({
        workingHoursPerDay: member.workingHoursPerDay,
        devPercent: devAllocation?.percent ?? 0,
        sprint,
        leaves: leavesByMemberId.get(member.id) ?? [],
        holidays,
      }),
    );
  }
  return result;
}

// FR12 -- team-wide Capacity is the sum of every Team Member's individual
// Capacity. Trivial arithmetic, but lives here (not inlined in the Roster
// page) per AD-1: Capacity calculations live only in domain/.
export function sumCapacityHours(perMember: CapacityHours[]): CapacityHours {
  const totals = perMember.reduce(
    (totals, member) => ({
      capacityHours: totals.capacityHours + member.capacityHours,
      fullDevHours: totals.fullDevHours + member.fullDevHours,
    }),
    { capacityHours: 0, fullDevHours: 0 },
  );
  // Summing already-rounded per-member figures can still drift (same class
  // of float noise `round2` guards against above) -- round the total too,
  // matching sumAllocationBreakdown's contract.
  return { capacityHours: round2(totals.capacityHours), fullDevHours: round2(totals.fullDevHours) };
}

// Story 3.5 -- the over-allocation comparison, one shared implementation
// per AD-1 rather than an inline `assignedHours > capacityHours` at each
// call site (Roster's team-wide figure and every per-member row).
export type AssignedVsCapacity = { assignedHours: number; capacityHours: number; overAllocated: boolean };

export function compareAssignedToCapacity(assignedHours: number, capacityHours: number): AssignedVsCapacity {
  // capacityHours always arrives pre-rounded (round2, above); assignedHours
  // is a raw sum of estimateHours and needs the same rounding here, or a
  // mathematically-equal sum landing as e.g. 7.700000000000001 due to float
  // representation would wrongly compare greater-than an exactly-equal
  // capacity (review-patch: found by Edge Case Hunter for Story 3.5).
  const roundedAssigned = round2(assignedHours);
  return { assignedHours: roundedAssigned, capacityHours, overAllocated: roundedAssigned > capacityHours };
}

export type CategoryHours = { categoryId: string; hours: number };

// Story 2.6 / FR13 -- the per-category Allocated Hours breakdown. Reuses
// computeTeamMemberCapacityHours once per category (see spec Design Notes:
// the day-loss count doesn't depend on category, so this is a few redundant
// cheap calls, not a second formula) -- the same Leave/Holiday deduction
// Story 2.5 already applies to Dev now applies uniformly to every category.
// No category-name lookup here -- that's a display concern for the caller.
export function computeAllocationBreakdown({
  workingHoursPerDay,
  categoryIds,
  allocations,
  sprint,
  leaves,
  holidays,
}: {
  workingHoursPerDay: number;
  categoryIds: string[];
  allocations: { categoryId: string; percent: number }[];
  sprint: { startDate: Date; endDate: Date };
  leaves: { startDate: Date; endDate: Date }[];
  holidays: { startDate: Date; endDate: Date }[];
}): CategoryHours[] {
  return categoryIds.map((categoryId) => {
    const allocation = allocations.find((row) => row.categoryId === categoryId);
    const { capacityHours } = computeTeamMemberCapacityHours({
      workingHoursPerDay,
      devPercent: allocation?.percent ?? 0,
      sprint,
      leaves,
      holidays,
    });
    return { categoryId, hours: capacityHours };
  });
}

// The team-wide per-category total -- mirrors sumCapacityHours's role but
// keyed by category instead of one total (I/O matrix: TEAM_WIDE_PER_CATEGORY_TOTAL).
export function sumAllocationBreakdown(perMember: CategoryHours[][]): CategoryHours[] {
  const totalsByCategoryId = new Map<string, number>();
  for (const memberBreakdown of perMember) {
    for (const { categoryId, hours } of memberBreakdown) {
      totalsByCategoryId.set(categoryId, (totalsByCategoryId.get(categoryId) ?? 0) + hours);
    }
  }
  return Array.from(totalsByCategoryId, ([categoryId, hours]) => ({ categoryId, hours: round2(hours) }));
}
