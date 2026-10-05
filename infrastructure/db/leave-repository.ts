import type { LeaveRepo } from "@/domain/leave";
import { prisma } from "@/infrastructure/db/client";

export const leaveRepository: LeaveRepo = {
  listForTeamMember(teamMemberId) {
    return prisma.leave.findMany({ where: { teamMemberId } });
  },
  listForTeamMembers(teamMemberIds) {
    return prisma.leave.findMany({ where: { teamMemberId: { in: teamMemberIds } } });
  },
  create(data) {
    return prisma.leave.create({ data });
  },
};
