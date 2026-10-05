// Story 4.4 -- extracted from app/page.tsx so both the PM's own Sprint Plan
// Overview and the read-only Team View (app/share/[token]/page.tsx) render
// from one shared data loader. AD-4's structural rule: this module (and
// components/sprint-plan-content.tsx, which consumes its output) may only
// import repositories and domain/* -- never anything from app/actions/.

import { teamMemberRepository } from "@/infrastructure/db/team-member-repository";
import { allocationCategoryRepository } from "@/infrastructure/db/allocation-category-repository";
import { teamMemberAllocationRepository } from "@/infrastructure/db/team-member-allocation-repository";
import { leaveRepository } from "@/infrastructure/db/leave-repository";
import { holidayRepository } from "@/infrastructure/db/holiday-repository";
import { sprintRepository } from "@/infrastructure/db/sprint-repository";
import { backlogIssueRepository } from "@/infrastructure/db/backlog-issue-repository";
import { youTrackConfigRepository } from "@/infrastructure/youtrack/config";
import { scopeEntriesToSprint, type SprintScopedEntry } from "@/domain/calendar";
import {
  computeCapacityForTeam,
  sumCapacityHours,
  computeAllocationBreakdown,
  sumAllocationBreakdown,
  compareAssignedToCapacity,
  type CapacityHours,
  type CategoryHours,
} from "@/domain/capacity";
import { sumEstimateHours, sumAssignedHoursByMember } from "@/domain/backlog-issue";
import type { Leave } from "@/domain/leave";

const LEAVE_TYPE_LABEL: Record<Leave["type"], string> = {
  planned: "Planned Leave",
  emergency: "Emergency Leave",
};

function groupBy<T, K>(items: T[], keyOf: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const existing = map.get(key);
    if (existing) {
      existing.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return map;
}

// Story 2.4's exact merge -- mirrors team-member-detail-panel.tsx's
// sprintEntries composition so both surfaces render the same Leave/Holiday
// data identically.
function sprintEntriesFor(
  leaves: Leave[],
  holidays: { id: string; startDate: Date; endDate: Date }[],
  sprint: { startDate: Date; endDate: Date } | null,
): SprintScopedEntry[] {
  const entries: SprintScopedEntry[] = [
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
  return scopeEntriesToSprint(entries, sprint);
}

export type NamedCategoryHours = { categoryId: string; categoryName: string; hours: number };

export type SprintPlanMember = {
  id: string;
  name: string;
  workingHoursPerDay: number;
  capacityHours: number;
  fullDevHours: number;
  breakdown: NamedCategoryHours[];
  assignedHours: number | undefined;
  overAllocated: boolean | undefined;
  nonZeroAllocations: { categoryId: string; categoryName: string; percent: number }[];
  sprintEntries: SprintScopedEntry[];
};

export type SprintPlanAssignedIssue = {
  id: string;
  title: string;
  assigneeName: string | null;
  estimateHours: number;
  loggedHours: number;
  youtrackUrl: string | null;
};

export type SprintPlanData = {
  activeSprint: { id: string; startDate: Date; endDate: Date };
  devCategoryExists: boolean;
  team: {
    capacityHours: number;
    fullDevHours: number;
    breakdown: NamedCategoryHours[];
    assignedHours: number | undefined;
    overAllocated: boolean | undefined;
  };
  members: SprintPlanMember[];
  assignedIssues: SprintPlanAssignedIssue[];
};

export async function getSprintPlanData(): Promise<SprintPlanData | null> {
  const [teamMembers, allocationCategories, activeSprint, holidays, youtrackConfig] = await Promise.all([
    teamMemberRepository.list(),
    allocationCategoryRepository.list(),
    sprintRepository.findActive(),
    holidayRepository.list(),
    youTrackConfigRepository.get(),
  ]);

  if (!activeSprint) {
    return null;
  }

  // Same trailing-"/mcp" trim as infrastructure/youtrack/rest-client.ts's
  // restBaseUrl -- duplicated inline rather than imported, since this
  // module may only import repositories and domain/* (AD-4).
  const youtrackBaseUrl = youtrackConfig?.instanceUrl.replace(/\/mcp\/?$/, "").replace(/\/$/, "") ?? null;

  const memberIds = teamMembers.map((member) => member.id);
  const [allocationRows, leaveRows, pulledIssues] = await Promise.all([
    teamMemberAllocationRepository.listForTeamMembers(memberIds),
    leaveRepository.listForTeamMembers(memberIds),
    backlogIssueRepository.listForSprint(activeSprint.id),
  ]);
  const allocationsByMemberId = groupBy(allocationRows, (row) => row.teamMemberId);
  const leavesByMemberId = groupBy(leaveRows, (leave) => leave.teamMemberId);
  const nameByMemberId = new Map(teamMembers.map((member) => [member.id, member.name]));

  const devCategory = allocationCategories.find((category) => category.isDev);
  const capacityByMemberId: Map<string, CapacityHours> = devCategory
    ? computeCapacityForTeam({
        teamMembers,
        allocationsByMemberId,
        leavesByMemberId,
        holidays,
        devCategoryId: devCategory.id,
        sprint: activeSprint,
      })
    : new Map();
  const teamCapacity = sumCapacityHours(Array.from(capacityByMemberId.values()));

  const assignedHoursByMemberId = sumAssignedHoursByMember(pulledIssues);
  const teamAllocationComparison = devCategory
    ? compareAssignedToCapacity(sumEstimateHours(pulledIssues), teamCapacity.capacityHours)
    : null;
  const allocationComparisonByMemberId = devCategory
    ? new Map(
        teamMembers.map((member) => [
          member.id,
          compareAssignedToCapacity(
            assignedHoursByMemberId.get(member.id) ?? 0,
            capacityByMemberId.get(member.id)?.capacityHours ?? 0,
          ),
        ]),
      )
    : new Map();

  const categoryIds = allocationCategories.map((category) => category.id);
  const categoryNameById = new Map(allocationCategories.map((category) => [category.id, category.name]));
  const breakdownByMemberId: Map<string, CategoryHours[]> = devCategory
    ? new Map(
        teamMembers.map((member) => [
          member.id,
          computeAllocationBreakdown({
            workingHoursPerDay: member.workingHoursPerDay,
            categoryIds,
            allocations: allocationsByMemberId.get(member.id) ?? [],
            sprint: activeSprint,
            leaves: leavesByMemberId.get(member.id) ?? [],
            holidays,
          }),
        ]),
      )
    : new Map();
  const teamBreakdown = sumAllocationBreakdown(Array.from(breakdownByMemberId.values()));

  function toNamedBreakdown(categoryHours: CategoryHours[]): NamedCategoryHours[] {
    return categoryHours.map(({ categoryId, hours }) => ({
      categoryId,
      categoryName: categoryNameById.get(categoryId) ?? categoryId,
      hours,
    }));
  }

  return {
    activeSprint: { id: activeSprint.id, startDate: activeSprint.startDate, endDate: activeSprint.endDate },
    devCategoryExists: Boolean(devCategory),
    team: {
      capacityHours: teamCapacity.capacityHours,
      fullDevHours: teamCapacity.fullDevHours,
      breakdown: toNamedBreakdown(teamBreakdown),
      assignedHours: teamAllocationComparison?.assignedHours,
      overAllocated: teamAllocationComparison?.overAllocated,
    },
    members: teamMembers.map((member) => ({
      id: member.id,
      name: member.name,
      workingHoursPerDay: member.workingHoursPerDay,
      capacityHours: capacityByMemberId.get(member.id)?.capacityHours ?? 0,
      fullDevHours: capacityByMemberId.get(member.id)?.fullDevHours ?? 0,
      breakdown: toNamedBreakdown(breakdownByMemberId.get(member.id) ?? []),
      assignedHours: allocationComparisonByMemberId.get(member.id)?.assignedHours,
      overAllocated: allocationComparisonByMemberId.get(member.id)?.overAllocated,
      nonZeroAllocations: (allocationsByMemberId.get(member.id) ?? [])
        .filter((row) => row.percent > 0)
        .map((row) => ({
          categoryId: row.categoryId,
          categoryName: categoryNameById.get(row.categoryId) ?? row.categoryId,
          percent: row.percent,
        })),
      sprintEntries: sprintEntriesFor(leavesByMemberId.get(member.id) ?? [], holidays, activeSprint),
    })),
    assignedIssues: pulledIssues.map((issue) => ({
      id: issue.id,
      title: issue.title,
      assigneeName: issue.assigneeId ? (nameByMemberId.get(issue.assigneeId) ?? "Unassigned") : null,
      estimateHours: issue.estimateHours,
      loggedHours: issue.loggedHours,
      youtrackUrl: youtrackBaseUrl ? `${youtrackBaseUrl}/issue/${issue.youtrackIssueId}` : null,
    })),
  };
}
