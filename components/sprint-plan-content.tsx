// Story 4.4 -- extracted from app/page.tsx so both the PM's own Sprint Plan
// Overview and the read-only Team View (app/share/[token]/page.tsx) render
// the same content. Pure presentation: props in, JSX out. AD-4's structural
// rule: this module may only import repositories and domain/* -- never
// anything from app/actions/ (and in practice imports neither here, since
// all data arrives already computed via SprintPlanData).

import { CapacityLedger } from "@/components/capacity-ledger";
import { StatusChip } from "@/components/status-chip";
import { AssignedIssuesList } from "@/components/assigned-issues-list";
import { CATEGORY_PALETTE } from "@/lib/category-palette";
import { initials } from "@/lib/initials";
import { sprintEntryVariant } from "@/lib/sprint-entry-variant";
import type { SprintPlanData } from "@/app/sprint-plan-data";

export function SprintPlanContent({ data }: { data: SprintPlanData }) {
  const { devCategoryExists, team, members, assignedIssues } = data;

  // Keys every category chip to the same color the Team Breakdown chart
  // uses for it (team.breakdown is in stable creation order -- see
  // domain/capacity.ts's computeAllocationBreakdown, which always maps
  // over the full categoryIds list). A member's own nonZeroAllocations
  // array isn't in that order, so chips must look the color up by id
  // rather than by their own local index.
  const categoryColorById = new Map(
    team.breakdown.map((category, index) => [category.categoryId, CATEGORY_PALETTE[index % CATEGORY_PALETTE.length]]),
  );

  // Same color a member's own Roster card avatar uses (index into
  // CATEGORY_PALETTE in members' list order) -- keyed by name since
  // SprintPlanAssignedIssue only carries assigneeName, not assigneeId.
  const memberColorByName = new Map(
    members.map((member, index) => [member.name, CATEGORY_PALETTE[index % CATEGORY_PALETTE.length]]),
  );

  return (
    <>
      <section className="glass mb-8 p-6 sm:p-8">
        <h2 className="mb-4 font-heading text-xl font-medium text-foreground">Sprint Capacity</h2>
        {!devCategoryExists ? (
          <p className="text-muted-foreground">Mark a category as Dev to see Capacity</p>
        ) : (
          <CapacityLedger
            capacityHours={team.capacityHours}
            fullHours={team.fullDevHours}
            breakdown={team.breakdown}
            breakdownLabel="Team Breakdown"
            assignedHours={team.assignedHours}
            overAllocated={team.overAllocated}
          />
        )}
      </section>

      <section className="glass mb-8 p-6 sm:p-8">
        <h2 className="mb-4 font-heading text-xl font-medium text-foreground">Roster</h2>
        {members.length === 0 ? (
          <p className="text-muted-foreground">No team members yet — add your first one to start planning.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {members.map((member, index) => (
              <li
                key={member.id}
                className="glass-row motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 flex flex-col gap-4 px-5 py-4 duration-500"
                style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-heading text-sm font-semibold text-white"
                    style={{ background: CATEGORY_PALETTE[index % CATEGORY_PALETTE.length] }}
                  >
                    {initials(member.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-heading text-foreground">{member.name}</p>
                    <p className="text-sm text-muted-foreground">{member.workingHoursPerDay}h/day</p>
                  </div>
                </div>

                {devCategoryExists ? (
                  <CapacityLedger
                    capacityHours={member.capacityHours}
                    fullHours={member.fullDevHours}
                    size="small"
                    breakdown={member.breakdown}
                    breakdownLabel={`Breakdown for ${member.name}`}
                    assignedHours={member.assignedHours}
                    overAllocated={member.overAllocated}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Mark a category as Dev to see Capacity</p>
                )}

                <div className="flex flex-col gap-2 border-t border-[color:var(--border-glass)] pt-3">
                  {member.nonZeroAllocations.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {member.nonZeroAllocations.map((allocation, allocationIndex) => (
                        <span
                          key={allocation.categoryId}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--surface-glass)] px-2.5 py-1 text-xs text-muted-foreground"
                        >
                          <span
                            aria-hidden="true"
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{
                              background:
                                categoryColorById.get(allocation.categoryId) ??
                                CATEGORY_PALETTE[allocationIndex % CATEGORY_PALETTE.length],
                            }}
                          />
                          {allocation.categoryName} {allocation.percent}%
                        </span>
                      ))}
                    </div>
                  )}
                  {member.sprintEntries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No leave or holidays this sprint.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {member.sprintEntries.map((entry) => (
                        <StatusChip key={entry.key} variant={sprintEntryVariant(entry.label)}>
                          {entry.label}
                        </StatusChip>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass p-6 sm:p-8">
        <h2 className="mb-4 font-heading text-xl font-medium text-foreground">Assigned Backlog Issues</h2>
        {assignedIssues.length === 0 ? (
          <p className="text-muted-foreground">No Backlog Issues pulled into this Sprint yet.</p>
        ) : (
          <AssignedIssuesList issues={assignedIssues} memberColorByName={Object.fromEntries(memberColorByName)} />
        )}
      </section>
    </>
  );
}
