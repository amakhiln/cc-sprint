import type { TeamMemberRepo } from "@/domain/allocation";
import { prisma } from "@/infrastructure/db/client";

export const teamMemberRepository: TeamMemberRepo = {
  create(data) {
    return prisma.teamMember.create({ data });
  },
  list() {
    return prisma.teamMember.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
    });
  },
  async archive(id) {
    // Atomic "active id -> archived" check-and-write: the where clause only
    // matches a currently-active row, so a concurrent second call for the
    // same id updates zero rows instead of racing past the check.
    const { count } = await prisma.teamMember.updateMany({
      where: { id, archivedAt: null },
      data: { archivedAt: new Date() },
    });
    if (count === 0) {
      return null;
    }
    return prisma.teamMember.findUniqueOrThrow({ where: { id } });
  },
  async updateWorkingHours(id, workingHoursPerDay) {
    // Deliberately not the update()+catch-P2025 pattern used elsewhere in this
    // file: update() can only filter on a unique field, so it can't also
    // require archivedAt: null atomically. updateMany can, so we use the same
    // atomic active-only shape as archive() to keep archived members excluded
    // from edits.
    const { count } = await prisma.teamMember.updateMany({
      where: { id, archivedAt: null },
      data: { workingHoursPerDay },
    });
    if (count === 0) {
      return null;
    }
    return prisma.teamMember.findUniqueOrThrow({ where: { id } });
  },
};
