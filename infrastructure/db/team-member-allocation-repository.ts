import type { TeamMemberAllocation, TeamMemberAllocationRepo } from "@/domain/allocation";
import { prisma } from "@/infrastructure/db/client";

export const teamMemberAllocationRepository: TeamMemberAllocationRepo & {
  listForTeamMembers(teamMemberIds: string[]): Promise<TeamMemberAllocation[]>;
} = {
  listForTeamMember(teamMemberId) {
    return prisma.teamMemberAllocation.findMany({ where: { teamMemberId } });
  },
  listForTeamMembers(teamMemberIds) {
    return prisma.teamMemberAllocation.findMany({ where: { teamMemberId: { in: teamMemberIds } } });
  },
  async replaceForTeamMember(teamMemberId, allocations) {
    return prisma.$transaction(async (tx) => {
      await tx.teamMemberAllocation.deleteMany({ where: { teamMemberId } });
      if (allocations.length === 0) {
        return [];
      }
      await tx.teamMemberAllocation.createMany({
        data: allocations.map(({ categoryId, percent }) => ({
          teamMemberId,
          categoryId,
          percent,
        })),
      });
      return tx.teamMemberAllocation.findMany({ where: { teamMemberId } });
    });
  },
  async isCategoryInUse(categoryId) {
    const count = await prisma.teamMemberAllocation.count({ where: { categoryId } });
    return count > 0;
  },
};
