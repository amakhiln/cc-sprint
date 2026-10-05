import type { BacklogIssueRepo } from "@/domain/backlog-issue";
import { prisma } from "@/infrastructure/db/client";

export const backlogIssueRepository: BacklogIssueRepo = {
  create(data) {
    return prisma.backlogIssue.create({ data });
  },
  listForSprint(sprintId) {
    // Postgres gives no row-order guarantee without an explicit ORDER BY --
    // id (cuid) is roughly creation-ordered, cheap insurance against
    // shuffling order for a future "list of pulled issues" UI.
    return prisma.backlogIssue.findMany({ where: { sprintId }, orderBy: { id: "asc" } });
  },
  async updateAssignee(id, sprintId, assigneeId) {
    // Atomic "belongs to this Sprint" check-and-write, same shape as
    // team-member-repository.ts's updateWorkingHours -- the where clause
    // only matches a row still in this Sprint, so a stale client can't
    // reassign an issue that's since left it.
    const { count } = await prisma.backlogIssue.updateMany({
      where: { id, sprintId },
      data: { assigneeId },
    });
    if (count === 0) {
      return null;
    }
    // findUnique (not Throw): unlike TeamMember (soft-deleted, never really
    // gone), a BacklogIssue row can vanish via Sprint cascade-delete in the
    // narrow window between the updateMany above and this refetch -- treat
    // that the same as "not found" rather than throwing.
    return prisma.backlogIssue.findUnique({ where: { id } });
  },
};
