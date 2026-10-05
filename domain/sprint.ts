// Framework-free business logic. Zero imports from @prisma/client, next, or
// infrastructure/ — see AD-1 in the Architecture Spine.

import { computeActualVelocityHours } from "./velocity.ts";
import type { CategoryHours } from "./capacity.ts";

export type Sprint = {
  id: string;
  startDate: Date;
  endDate: Date;
  status: "active" | "closed";
  snapshotCapacityHours: number | null;
  snapshotAllocationBreakdown: unknown;
  snapshotActualVelocityHours: number | null;
};

export type SprintRepo = {
  findActive(): Promise<Sprint | null>;
  create(data: { startDate: Date; endDate: Date }): Promise<Sprint>;
  // Story 4.2 -- one atomic, transactional write: every confirmed issue's
  // loggedHours alongside the Sprint's own status flip + snapshot fields.
  // Scoped to status: 'active' in the same query as the write (mirrors
  // team-member-repository.ts's updateWorkingHours) so a stale client can't
  // double-close. null means "wasn't the active Sprint" -- never thrown.
  close(
    id: string,
    data: {
      issueLoggedHours: { issueId: string; loggedHours: number }[];
      snapshotCapacityHours: number;
      snapshotAllocationBreakdown: CategoryHours[];
      snapshotActualVelocityHours: number;
    },
  ): Promise<Sprint | null>;
  // Story 4.3 -- every closed Sprint, most-recent-first. No closedAt field
  // exists; startDate is the closest available recency proxy, and Sprints
  // never overlap so the ordering is unambiguous.
  listClosed(): Promise<Sprint[]>;
};

export type CreateSprintInput = {
  startDate: Date;
  lengthDays?: number;
};

export type CreateSprintResult =
  | { ok: true; data: Sprint }
  | { ok: false; error: string };

const DEFAULT_LENGTH_DAYS = 14;
const MAX_LENGTH_DAYS = 365;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ALREADY_ACTIVE_ERROR =
  "A Sprint is already active. Close it before starting a new one.";

// Duck-typed check for Prisma's unique-constraint violation code -- avoids
// importing @prisma/client into this framework-free domain file (AD-1).
function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export async function createSprint(
  repo: SprintRepo,
  input: CreateSprintInput,
): Promise<CreateSprintResult> {
  if (!(input.startDate instanceof Date) || Number.isNaN(input.startDate.getTime())) {
    return { ok: false, error: "Start date is required and must be a valid date" };
  }

  const lengthDays = input.lengthDays ?? DEFAULT_LENGTH_DAYS;
  if (!Number.isInteger(lengthDays) || lengthDays < 1 || lengthDays > MAX_LENGTH_DAYS) {
    return {
      ok: false,
      error: `Length must be a whole number of days, between 1 and ${MAX_LENGTH_DAYS}`,
    };
  }

  // Friendly pre-check -- the primary UX path (AD-6). The partial unique
  // index on Sprint.status is the atomic backstop for the race window
  // between this check and the write below.
  const active = await repo.findActive();
  if (active) {
    return { ok: false, error: ALREADY_ACTIVE_ERROR };
  }

  // Inclusive on both ends -- 14 days starting Aug 18 ends Aug 31.
  const endDate = new Date(input.startDate.getTime() + (lengthDays - 1) * MS_PER_DAY);

  try {
    const data = await repo.create({ startDate: input.startDate, endDate });
    return { ok: true, data };
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      // The partial unique index fired -- a concurrent request won the race
      // between our pre-check and this write. Same rejection as the
      // pre-check case rather than letting it throw.
      return { ok: false, error: ALREADY_ACTIVE_ERROR };
    }
    throw error;
  }
}

export type CloseSprintInput = {
  sprintId: string;
  // Confirmed (possibly PM-edited) logged hours per assigned issue reviewed
  // in the Close Sprint flow -- the source of truth for what gets written
  // and summed, not whatever YouTrack originally returned.
  confirmedHoursByIssueId: Map<string, number>;
  // Computed by the caller from current live roster/allocation/leave state
  // (domain/capacity.ts) -- this is the last live read before it becomes a
  // permanent, never-recomputed snapshot (AD-2).
  snapshotCapacityHours: number;
  snapshotAllocationBreakdown: CategoryHours[];
};

export type CloseSprintResult =
  | { ok: true; data: Sprint }
  | { ok: false; error: string };

const SPRINT_NOT_ACTIVE_ERROR = "This Sprint is no longer active.";

// Story 4.2 -- close the active Sprint: locks in every confirmed issue's
// logged hours, snapshots Capacity/breakdown/Actual Velocity, and flips
// status to 'closed' (which is what frees AD-6's single-active-Sprint slot
// for the next one). A one-way transition -- no "reopen" exists.
export async function closeSprint(repo: SprintRepo, input: CloseSprintInput): Promise<CloseSprintResult> {
  if (!input.sprintId?.trim()) {
    return { ok: false, error: "Sprint is required" };
  }
  for (const hours of input.confirmedHoursByIssueId.values()) {
    if (!Number.isFinite(hours) || hours < 0) {
      return { ok: false, error: "Logged hours must be a non-negative number" };
    }
  }
  if (!Number.isFinite(input.snapshotCapacityHours) || input.snapshotCapacityHours < 0) {
    return { ok: false, error: "Invalid Capacity snapshot" };
  }

  // Friendly pre-check (AD-6's established two-layer pattern) -- repo.close's
  // own atomic status:'active' guard is the real backstop for a race; this
  // gives every caller (not just app/actions/sprint.ts, which duplicates
  // this same check today) a clean rejection without depending on the
  // transaction ever running (review-patch: the frozen spec assigns this
  // validation to closeSprint itself, not just to its caller).
  const active = await repo.findActive();
  if (!active || active.id !== input.sprintId) {
    return { ok: false, error: SPRINT_NOT_ACTIVE_ERROR };
  }

  const data = await repo.close(input.sprintId, {
    issueLoggedHours: Array.from(input.confirmedHoursByIssueId, ([issueId, loggedHours]) => ({ issueId, loggedHours })),
    snapshotCapacityHours: input.snapshotCapacityHours,
    snapshotAllocationBreakdown: input.snapshotAllocationBreakdown,
    snapshotActualVelocityHours: computeActualVelocityHours(input.confirmedHoursByIssueId),
  });
  if (!data) {
    return { ok: false, error: SPRINT_NOT_ACTIVE_ERROR };
  }
  return { ok: true, data };
}
