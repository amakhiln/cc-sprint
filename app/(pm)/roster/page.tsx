import { teamMemberRepository } from "@/infrastructure/db/team-member-repository";
import { allocationCategoryRepository } from "@/infrastructure/db/allocation-category-repository";
import { teamMemberAllocationRepository } from "@/infrastructure/db/team-member-allocation-repository";
import { leaveRepository } from "@/infrastructure/db/leave-repository";
import { holidayRepository } from "@/infrastructure/db/holiday-repository";
import { sprintRepository } from "@/infrastructure/db/sprint-repository";
import { backlogIssueRepository } from "@/infrastructure/db/backlog-issue-repository";
import { AddTeamMemberForm } from "./add-team-member-form";
import { AddAllocationCategoryForm } from "./add-allocation-category-form";
import { AllocationCategoryRow } from "./allocation-category-row";
import { RosterMemberRow } from "./roster-member-row";
import { CapacityLedger } from "@/components/capacity-ledger";
import { CATEGORY_PALETTE } from "@/lib/category-palette";
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

export default async function RosterPage() {
  const [teamMembers, allocationCategories, activeSprint, holidays] = await Promise.all([
    teamMemberRepository.list(),
    allocationCategoryRepository.list(),
    sprintRepository.findActive(),
    holidayRepository.list(),
  ]);

  const memberIds = teamMembers.map((member) => member.id);
  const [allocationRows, leaveRows] = await Promise.all([
    teamMemberAllocationRepository.listForTeamMembers(memberIds),
    leaveRepository.listForTeamMembers(memberIds),
  ]);
  const allocationsByMemberId = groupBy(allocationRows, (row) => row.teamMemberId);
  const leavesByMemberId = groupBy(leaveRows, (leave) => leave.teamMemberId);

  // Story 2.5 -- Sprint Capacity per person and team total. isDev identifies
  // the Dev-allocation percent per member (a separate, already-carved-out
  // prerequisite); no devCategory or no activeSprint means no ledger, just
  // an advisory message (see I/O matrix).
  const devCategory = allocationCategories.find((category) => category.isDev);
  const capacityByMemberId: Map<string, CapacityHours> =
    devCategory && activeSprint
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

  // Story 3.5 -- over-allocation warning: assigned hours (from pulled
  // BacklogIssue rows) vs. the Capacity just computed above. Same
  // devCategory && activeSprint gate -- the comparison is meaningless
  // without a Capacity figure to compare against.
  const pulledIssues = devCategory && activeSprint ? await backlogIssueRepository.listForSprint(activeSprint.id) : [];
  const assignedHoursByMemberId = sumAssignedHoursByMember(pulledIssues);
  const teamAllocationComparison =
    devCategory && activeSprint
      ? compareAssignedToCapacity(sumEstimateHours(pulledIssues), teamCapacity.capacityHours)
      : null;
  const allocationComparisonByMemberId =
    devCategory && activeSprint
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

  // Story 2.6 / FR13 -- per-member and team-wide Allocated Hours breakdown
  // by category, revealed via the Ledger's <details> disclosure. Same
  // devCategory && activeSprint gate as Story 2.5 -- the breakdown is a
  // sub-feature of the same Ledger, inheriting its empty states.
  const categoryIds = allocationCategories.map((category) => category.id);
  const categoryNameById = new Map(allocationCategories.map((category) => [category.id, category.name]));
  const breakdownByMemberId: Map<string, CategoryHours[]> = devCategory && activeSprint
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

  function toNamedBreakdown(categoryHours: CategoryHours[]) {
    return categoryHours.map(({ categoryId, hours }) => ({
      categoryId,
      categoryName: categoryNameById.get(categoryId) ?? categoryId,
      hours,
    }));
  }

  // Keys every category chip to the same color the Team Breakdown chart
  // uses for it (teamBreakdown is in stable creation order -- see
  // domain/capacity.ts's computeAllocationBreakdown, which always maps over
  // the full categoryIds list). A member's own allocation rows aren't in
  // that order, so chips must look the color up by id -- same approach as
  // components/sprint-plan-content.tsx.
  const categoryColorById: Record<string, string> = Object.fromEntries(
    teamBreakdown.map(({ categoryId }, index) => [categoryId, CATEGORY_PALETTE[index % CATEGORY_PALETTE.length]]),
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pt-6 pb-12">
      <div className="mb-8 flex flex-wrap items-center gap-3 border-b border-[color:var(--border-glass)] pb-5">
        <h1 id="roster-heading" tabIndex={-1} className="font-heading text-2xl font-medium text-foreground outline-none sm:text-3xl">
          Team Roster
        </h1>
        <span className="rounded-full border border-[color:var(--border-glass)] bg-[color:var(--surface-glass)] px-3 py-1 text-xs font-medium text-muted-foreground">
          {teamMembers.length} {teamMembers.length === 1 ? "member" : "members"}
        </span>
      </div>

      {/* Team-wide Capacity Ledger (Story 2.5) -- Sprint Plan Overview
          (Epic 4) doesn't exist yet, so Roster is the interim home. Sits
          above the member list, distinct from each row's smaller instance. */}
      <section className="glass mb-8 p-6 sm:p-8">
        <h2 className="mb-4 font-heading text-xl font-medium text-foreground">Team Capacity</h2>
        {!devCategory ? (
          <p className="text-muted-foreground">Mark a category as Dev to see Capacity</p>
        ) : !activeSprint ? (
          <p className="text-muted-foreground">No active Sprint</p>
        ) : (
          <CapacityLedger
            capacityHours={teamCapacity.capacityHours}
            fullHours={teamCapacity.fullDevHours}
            breakdown={toNamedBreakdown(teamBreakdown)}
            breakdownLabel="Team Breakdown"
            assignedHours={teamAllocationComparison?.assignedHours}
            overAllocated={teamAllocationComparison?.overAllocated}
          />
        )}
      </section>

      <section className="glass mb-8 p-6 sm:p-8">
        <h2 className="mb-4 font-heading text-xl font-medium text-foreground">Allocation Console</h2>
        {teamMembers.length === 0 ? (
          <p className="text-muted-foreground">
            No team members yet — add your first one to start planning.
          </p>
        ) : (
          <>
            <div className="hidden gap-4 px-5 pb-2 text-xs font-medium tracking-wide text-muted-foreground sm:flex">
              <span className="w-52 shrink-0">Member</span>
              <span className="w-20 shrink-0">Capacity</span>
              <span className="min-w-[140px] flex-1">Allocation</span>
              <span className="w-36 shrink-0">This Sprint</span>
              <span className="w-[72px] shrink-0" />
            </div>
            <ul className="flex flex-col gap-2">
              {teamMembers.map((member, index) => (
                <RosterMemberRow
                  key={member.id}
                  id={member.id}
                  name={member.name}
                  workingHoursPerDay={member.workingHoursPerDay}
                  categories={allocationCategories}
                  initialAllocations={allocationsByMemberId.get(member.id) ?? []}
                  activeSprint={activeSprint}
                  holidays={holidays}
                  leaves={leavesByMemberId.get(member.id) ?? []}
                  index={index}
                  devCategoryExists={Boolean(devCategory && activeSprint)}
                  capacityHours={capacityByMemberId.get(member.id)?.capacityHours ?? 0}
                  fullHours={capacityByMemberId.get(member.id)?.fullDevHours ?? 0}
                  assignedHours={allocationComparisonByMemberId.get(member.id)?.assignedHours}
                  overAllocated={allocationComparisonByMemberId.get(member.id)?.overAllocated}
                  categoryColorById={categoryColorById}
                  enterDelayMs={Math.min(index, 8) * 40}
                />
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="glass p-6 sm:p-8">
          <h2 className="mb-4 font-heading text-xl font-medium text-foreground">Add Team Member</h2>
          <AddTeamMemberForm />
        </div>
        <div className="glass p-6 sm:p-8">
          <h2 className="mb-4 font-heading text-xl font-medium text-foreground">Add Allocation Category</h2>
          <AddAllocationCategoryForm />
        </div>
      </div>

      <h2 className="mb-6 font-heading text-xl font-medium text-foreground">Allocation Categories</h2>

      <section className="glass p-6 sm:p-8">
        {allocationCategories.length === 0 ? (
          <p className="text-muted-foreground">
            No allocation categories yet — add one to start splitting time across work types.
          </p>
        ) : (
          <ul className="flex max-w-xl flex-col gap-3">
            {allocationCategories.map((category) => (
              <AllocationCategoryRow
                key={category.id}
                id={category.id}
                name={category.name}
                isDev={category.isDev}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
