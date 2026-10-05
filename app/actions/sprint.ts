"use server";

import { revalidatePath } from "next/cache";
import { createSprint, closeSprint, type CreateSprintResult, type CloseSprintResult } from "@/domain/sprint";
import { sprintRepository } from "@/infrastructure/db/sprint-repository";
import { backlogIssueRepository } from "@/infrastructure/db/backlog-issue-repository";
import { youTrackConfigRepository } from "@/infrastructure/youtrack/config";
import { youTrackIssuesAdapter } from "@/infrastructure/youtrack/issues";
import { teamMemberRepository } from "@/infrastructure/db/team-member-repository";
import { allocationCategoryRepository } from "@/infrastructure/db/allocation-category-repository";
import { teamMemberAllocationRepository } from "@/infrastructure/db/team-member-allocation-repository";
import { leaveRepository } from "@/infrastructure/db/leave-repository";
import { holidayRepository } from "@/infrastructure/db/holiday-repository";
import { computeCapacityForTeam, sumCapacityHours, computeAllocationBreakdown, sumAllocationBreakdown } from "@/domain/capacity";

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

export async function createSprintAction(
  formData: FormData,
): Promise<CreateSprintResult> {
  const startDateRaw = formData.get("startDate");
  const lengthDaysRaw = formData.get("lengthDays");

  if (typeof startDateRaw !== "string" || typeof lengthDaysRaw !== "string") {
    return { ok: false, error: "Invalid form submission" };
  }
  if (!startDateRaw) {
    return { ok: false, error: "Start date is required" };
  }

  // YYYY-MM-DD from <input type="date">: plain `new Date(...)` parses this
  // as UTC midnight per spec -- already correct for a day-granularity,
  // no-time-of-day field, no timezone conversion needed.
  const startDate = new Date(startDateRaw);
  const lengthDays = lengthDaysRaw !== "" ? Number(lengthDaysRaw) : undefined;

  try {
    const result = await createSprint(sprintRepository, { startDate, lengthDays });

    if (result.ok) {
      try {
        revalidatePath("/sprint");
        // Roster's Capacity Ledgers (Story 2.5) read the active Sprint on
        // every render -- without this, Roster's "No active Sprint"
        // advisory won't flip to a real ledger until something unrelated
        // revalidates it.
        revalidatePath("/roster");
        // Story 4.1 -- the Sprint Plan Overview (home route) is entirely
        // gated on there being an active Sprint (it renders an empty state
        // otherwise), so creating one must flip that view too.
        revalidatePath("/");
      } catch (revalidateError) {
        // The Sprint was already created -- a revalidation hiccup shouldn't
        // report failure and risk a confusing duplicate resubmission.
        console.error("revalidatePath failed:", revalidateError);
      }
    }

    return result;
  } catch (error) {
    // Never throw to the caller, and never leak internal error details.
    console.error("createSprintAction failed:", error);
    return { ok: false, error: "Failed to create sprint. Please try again." };
  }
}

export type SprintCloseIssuePreview = {
  issueId: string;
  title: string;
  // null -- "not yet checked" (no YouTrack config, or the pull failed/was
  // unparseable for this one issue). Never an error state; see
  // domain/youtrack.ts's YouTrackIssuesPort.getLoggedHours contract.
  pulledHours: number | null;
};

// Story 4.2 -- read-only preview for the Close Sprint modal: every
// *assigned* issue (unassigned ones are excluded from Velocity entirely,
// see domain/velocity.ts), with its best-effort pulled logged hours. Writes
// nothing -- confirmSprintCloseAction is the only action that persists.
export async function initiateSprintCloseAction(
  sprintId: string,
): Promise<{ ok: true; data: SprintCloseIssuePreview[] } | { ok: false; error: string }> {
  if (typeof sprintId !== "string" || !sprintId) {
    return { ok: false, error: "Sprint is required" };
  }

  try {
    const issues = await backlogIssueRepository.listForSprint(sprintId);
    const assignedIssues = issues.filter((issue) => issue.assigneeId !== null);
    const config = await youTrackConfigRepository.get();

    const data = await Promise.all(
      assignedIssues.map(async (issue) => ({
        issueId: issue.id,
        title: issue.title,
        pulledHours: config ? await youTrackIssuesAdapter.getLoggedHours(config, issue.youtrackIssueId) : null,
      })),
    );

    return { ok: true, data };
  } catch (error) {
    console.error("initiateSprintCloseAction failed:", error);
    return { ok: false, error: "Failed to prepare Sprint close. Please try again." };
  }
}

// Story 4.2 -- commit the close: recompute the live Capacity/breakdown one
// last time (the last live read before it becomes a permanent,
// never-recomputed snapshot per AD-2), sum the PM-confirmed hours into
// Actual Velocity, and hand off to the domain layer's atomic close.
export async function confirmSprintCloseAction(
  sprintId: string,
  confirmedHoursByIssueId: Record<string, number>,
): Promise<CloseSprintResult> {
  if (typeof sprintId !== "string" || !sprintId || typeof confirmedHoursByIssueId !== "object" || confirmedHoursByIssueId === null) {
    return { ok: false, error: "Invalid close request" };
  }

  try {
    // Friendly pre-check (AD-6's established two-layer pattern) -- the
    // atomic status:'active' guard inside SprintRepo.close is the real
    // backstop for a race, this just gives a clean message for the common
    // case (a stale client after the Sprint already closed).
    const activeSprint = await sprintRepository.findActive();
    if (!activeSprint || activeSprint.id !== sprintId) {
      return { ok: false, error: "This Sprint is no longer active." };
    }

    // Re-validate the client-submitted map against the Sprint's *current*
    // assigned issues -- never trust it verbatim. A stale preview (an issue
    // assigned/unassigned after the dialog opened) or a tampered/foreign
    // issueId is silently dropped here rather than being written or summed
    // into Actual Velocity (review-patch: a real cross-Sprint data-integrity
    // bug three review layers independently found -- repo.close's own
    // (id, sprintId)-scoped write is the DB-level backstop for this same
    // concern, this is the friendly, sum-correctness half of the fix).
    const currentIssues = await backlogIssueRepository.listForSprint(sprintId);
    const currentlyAssignedIds = new Set(
      currentIssues.filter((issue) => issue.assigneeId !== null).map((issue) => issue.id),
    );
    const validatedConfirmedHours = Object.fromEntries(
      Object.entries(confirmedHoursByIssueId).filter(([issueId]) => currentlyAssignedIds.has(issueId)),
    );

    const [teamMembers, allocationCategories, holidays] = await Promise.all([
      teamMemberRepository.list(),
      allocationCategoryRepository.list(),
      holidayRepository.list(),
    ]);
    const memberIds = teamMembers.map((member) => member.id);
    const [allocationRows, leaveRows] = await Promise.all([
      teamMemberAllocationRepository.listForTeamMembers(memberIds),
      leaveRepository.listForTeamMembers(memberIds),
    ]);
    const allocationsByMemberId = groupBy(allocationRows, (row) => row.teamMemberId);
    const leavesByMemberId = groupBy(leaveRows, (leave) => leave.teamMemberId);

    const devCategory = allocationCategories.find((category) => category.isDev);
    const capacityByMemberId = devCategory
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

    const categoryIds = allocationCategories.map((category) => category.id);
    const teamBreakdown = devCategory
      ? sumAllocationBreakdown(
          teamMembers.map((member) =>
            computeAllocationBreakdown({
              workingHoursPerDay: member.workingHoursPerDay,
              categoryIds,
              allocations: allocationsByMemberId.get(member.id) ?? [],
              sprint: activeSprint,
              leaves: leavesByMemberId.get(member.id) ?? [],
              holidays,
            }),
          ),
        )
      : [];

    const result = await closeSprint(sprintRepository, {
      sprintId,
      confirmedHoursByIssueId: new Map(Object.entries(validatedConfirmedHours)),
      snapshotCapacityHours: teamCapacity.capacityHours,
      snapshotAllocationBreakdown: teamBreakdown,
    });

    if (result.ok) {
      try {
        revalidatePath("/sprint");
        revalidatePath("/roster");
        revalidatePath("/");
        // The newly closed Sprint's row lives here -- without this the
        // (prerendered) Velocity History page never shows it in production.
        revalidatePath("/velocity-history");
      } catch (revalidateError) {
        console.error("revalidatePath failed:", revalidateError);
      }
    }

    return result;
  } catch (error) {
    console.error("confirmSprintCloseAction failed:", error);
    return { ok: false, error: "Failed to close Sprint. Please try again." };
  }
}
