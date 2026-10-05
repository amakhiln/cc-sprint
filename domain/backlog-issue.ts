// Framework-free business logic. Zero imports from @prisma/client, next, or
// infrastructure/ -- see AD-1 in the Architecture Spine.

import type { SprintRepo } from "./sprint.ts";

export type BacklogIssue = {
  id: string;
  youtrackIssueId: string;
  sprintId: string;
  title: string;
  assigneeId: string | null;
  estimateHours: number;
  loggedHours: number;
  loggedHoursPulledAt: Date | null;
};

export type BacklogIssueRepo = {
  create(data: {
    youtrackIssueId: string;
    sprintId: string;
    title: string;
    estimateHours: number;
  }): Promise<BacklogIssue>;
  listForSprint(sprintId: string): Promise<BacklogIssue[]>;
  // Scoped to sprintId in the same query as the write (atomic updateMany +
  // count + refetch, mirroring team-member-repository.ts's updateWorkingHours)
  // so a stale client can't reassign an issue that's since left the active
  // Sprint. null means "not found in that Sprint" -- never thrown.
  updateAssignee(id: string, sprintId: string, assigneeId: string | null): Promise<BacklogIssue | null>;
};

export type PullBacklogIssueInput = {
  sprintId: string;
  youtrackIssueId: string;
  title: string;
  estimateHours: number;
};

export type PullBacklogIssueResult =
  | { ok: true; data: BacklogIssue }
  | { ok: false; error: string };

const ALREADY_PULLED_ERROR = "This issue has already been pulled into this Sprint.";
const SPRINT_NOT_ACTIVE_ERROR = "This Sprint is no longer active.";
const ASSIGNEE_NOT_FOUND_ERROR = "Selected Team Member no longer exists.";

// Duck-typed check for Prisma's known-request-error codes -- avoids
// importing @prisma/client into this framework-free domain file (AD-1).
// P2002 mirrors domain/sprint.ts's identical unique-violation helper;
// P2003 is a foreign-key violation (e.g. sprintId deleted concurrently).
function prismaErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    return (error as { code?: unknown }).code as string | undefined;
  }
  return undefined;
}

// Story 3.3 -- pulling never sets an assignee (human decision: the
// Architecture Spine ERD's assigneeId carries no nullable annotation and
// FR-18 reads as if pulling ties hours to an assignee, but the epic's own
// "pulling precedes assignment (3.4)" note and Story 3.4's title say
// otherwise -- assigneeId is nullable and stays null until Story 3.4 sets
// it. This story's own AC "counted against its assignee's Capacity"
// describes that eventual state, not something pulling itself checks.
export async function pullBacklogIssue(
  repo: BacklogIssueRepo,
  sprintRepo: Pick<SprintRepo, "findActive">,
  input: PullBacklogIssueInput,
): Promise<PullBacklogIssueResult> {
  if (!input.sprintId?.trim()) {
    return { ok: false, error: "Sprint is required" };
  }
  if (!input.youtrackIssueId?.trim()) {
    return { ok: false, error: "Issue is required" };
  }
  const title = input.title?.trim();
  if (!title) {
    return { ok: false, error: "Title is required" };
  }
  if (!Number.isFinite(input.estimateHours) || input.estimateHours <= 0) {
    return { ok: false, error: "Estimate hours must be a positive number" };
  }

  // Friendly pre-check -- catches the common case (Sprint closed between
  // page load and this pull) before writing. Not a full guarantee against
  // a race with a concurrent close; the FK/CHECK constraints below are the
  // DB-level backstop for anything this pre-check misses, same two-layer
  // pattern as AD-6.
  const activeSprint = await sprintRepo.findActive();
  if (!activeSprint || activeSprint.id !== input.sprintId) {
    return { ok: false, error: SPRINT_NOT_ACTIVE_ERROR };
  }

  try {
    const data = await repo.create({
      youtrackIssueId: input.youtrackIssueId,
      sprintId: input.sprintId,
      title,
      estimateHours: input.estimateHours,
    });
    return { ok: true, data };
  } catch (error) {
    const code = prismaErrorCode(error);
    if (code === "P2002") {
      // The (sprintId, youtrackIssueId) unique index fired -- already
      // pulled into this Sprint.
      return { ok: false, error: ALREADY_PULLED_ERROR };
    }
    if (code === "P2003") {
      // Foreign-key violation -- sprintId no longer exists (e.g. deleted
      // concurrently with this request, despite the pre-check above).
      return { ok: false, error: SPRINT_NOT_ACTIVE_ERROR };
    }
    throw error;
  }
}

// Story 3.5 -- the team's total planned work for the over-allocation
// warning, regardless of assignee (an unassigned pulled issue is still real
// planned work counted against team Capacity, just not against any one
// member's).
export function sumEstimateHours(issues: BacklogIssue[]): number {
  return issues.reduce((total, issue) => total + issue.estimateHours, 0);
}

// Story 3.5 -- per-member assigned hours, keyed by assigneeId. Unassigned
// issues (assigneeId: null) are excluded -- they count toward
// sumEstimateHours's team total but no individual member's.
export function sumAssignedHoursByMember(issues: BacklogIssue[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const issue of issues) {
    if (!issue.assigneeId) continue;
    totals.set(issue.assigneeId, (totals.get(issue.assigneeId) ?? 0) + issue.estimateHours);
  }
  return totals;
}

export type AssignBacklogIssueInput = {
  issueId: string;
  assigneeId: string | null;
};

export type AssignBacklogIssueResult =
  | { ok: true; data: BacklogIssue }
  | { ok: false; error: string };

// Story 3.4 -- assign or reassign a pulled issue to a Team Member.
// Reassignment reuses this exact same function; assigneeId: null clears the
// assignment (the "Unassigned" option), matching how every pulled issue
// starts. No validation that assigneeId is a real, non-archived Team Member
// -- the UI dropdown only ever offers non-archived members, same
// defense-in-depth gap already accepted for Stories 1.5/2.1's analogous checks.
export async function assignBacklogIssue(
  repo: BacklogIssueRepo,
  sprintRepo: Pick<SprintRepo, "findActive">,
  input: AssignBacklogIssueInput,
): Promise<AssignBacklogIssueResult> {
  if (!input.issueId?.trim()) {
    return { ok: false, error: "Issue is required" };
  }
  // "" is not a valid Team Member id -- normalize here (not just client-side)
  // so a direct call with assigneeId:"" is rejected/cleared the same way the
  // UI's "Unassigned" option is, rather than reaching the FK constraint.
  const assigneeId = input.assigneeId === "" ? null : input.assigneeId;

  const activeSprint = await sprintRepo.findActive();
  if (!activeSprint) {
    return { ok: false, error: SPRINT_NOT_ACTIVE_ERROR };
  }

  try {
    const data = await repo.updateAssignee(input.issueId, activeSprint.id, assigneeId);
    if (!data) {
      return { ok: false, error: "Issue not found in the active Sprint." };
    }
    return { ok: true, data };
  } catch (error) {
    if (prismaErrorCode(error) === "P2003") {
      // Foreign-key violation -- assigneeId doesn't reference a real Team
      // Member (e.g. a stale id from a client that hasn't refreshed).
      return { ok: false, error: ASSIGNEE_NOT_FOUND_ERROR };
    }
    throw error;
  }
}
