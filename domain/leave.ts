// Framework-free business logic. Zero imports from @prisma/client, next, or
// infrastructure/ — see AD-1 in the Architecture Spine.

export type LeaveType = "planned" | "emergency";

export type Leave = {
  id: string;
  teamMemberId: string;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
};

export type LeaveRepo = {
  listForTeamMember(teamMemberId: string): Promise<Leave[]>;
  listForTeamMembers(teamMemberIds: string[]): Promise<Leave[]>;
  create(data: {
    teamMemberId: string;
    type: LeaveType;
    startDate: Date;
    endDate: Date;
  }): Promise<Leave>;
};

export type RecordLeaveInput = {
  teamMemberId: string;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
};

export type RecordLeaveResult =
  | { ok: true; data: Leave }
  | { ok: false; error: string };

export async function recordLeave(
  repo: LeaveRepo,
  input: RecordLeaveInput,
): Promise<RecordLeaveResult> {
  if (!input.teamMemberId?.trim()) {
    return { ok: false, error: "Team member id is required" };
  }
  const teamMemberId = input.teamMemberId.trim();

  if (input.type !== "planned" && input.type !== "emergency") {
    return { ok: false, error: "Type must be 'planned' or 'emergency'" };
  }

  if (!(input.startDate instanceof Date) || Number.isNaN(input.startDate.getTime())) {
    return { ok: false, error: "Start date is required and must be a valid date" };
  }
  if (!(input.endDate instanceof Date) || Number.isNaN(input.endDate.getTime())) {
    return { ok: false, error: "End date is required and must be a valid date" };
  }

  // Inclusive on both ends -- both dates are independently typed by the
  // user here (unlike Sprint's computed endDate), so this is a real check.
  if (input.endDate.getTime() < input.startDate.getTime()) {
    return { ok: false, error: "End date must be on or after the start date" };
  }

  const data = await repo.create({
    teamMemberId,
    type: input.type,
    startDate: input.startDate,
    endDate: input.endDate,
  });

  return { ok: true, data };
}
