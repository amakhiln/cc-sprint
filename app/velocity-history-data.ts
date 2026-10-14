// Closed-Sprint velocity rows, shared by app/(pm)/velocity-history/page.tsx
// and the assistant's get_velocity_history tool -- one source for both.
// Closed Sprints read their snapshot fields, never recomputed (AD-2).
import { sprintRepository } from "@/infrastructure/db/sprint-repository";
import { backlogIssueRepository } from "@/infrastructure/db/backlog-issue-repository";
import { computePlannedVelocityHours, computeVelocityDelta } from "@/domain/velocity";
import type { Sprint } from "@/domain/sprint";

export type VelocityHistoryRow = {
  sprint: Sprint;
  snapshotCapacityHours: number | null;
  plannedVelocityHours: number;
  actualVelocityHours: number;
  delta: number;
};

export type VelocityHistoryData = { rows: VelocityHistoryRow[]; averageDelta: number };

// Most-recent-first, as sprintRepository.listClosed returns them.
export async function getVelocityHistoryData(): Promise<VelocityHistoryData> {
  const closedSprints = await sprintRepository.listClosed();
  const rows = await Promise.all(
    closedSprints.map(async (sprint) => {
      const issues = await backlogIssueRepository.listForSprint(sprint.id);
      const plannedVelocityHours = computePlannedVelocityHours(issues);
      // A closed Sprint always has this written by Story 4.2's close flow;
      // the `?? 0` is a type-level fallback (the field is nullable until
      // close), never expected to actually apply to a closed row.
      const actualVelocityHours = sprint.snapshotActualVelocityHours ?? 0;
      return {
        sprint,
        snapshotCapacityHours: sprint.snapshotCapacityHours,
        plannedVelocityHours,
        actualVelocityHours,
        delta: computeVelocityDelta(actualVelocityHours, plannedVelocityHours),
      };
    }),
  );
  const averageDelta = rows.length > 0 ? rows.reduce((sum, row) => sum + row.delta, 0) / rows.length : 0;
  return { rows, averageDelta };
}
