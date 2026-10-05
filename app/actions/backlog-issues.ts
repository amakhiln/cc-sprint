"use server";

import { revalidatePath } from "next/cache";
import {
  pullBacklogIssue,
  assignBacklogIssue,
  type PullBacklogIssueResult,
  type AssignBacklogIssueResult,
} from "@/domain/backlog-issue";
import { backlogIssueRepository } from "@/infrastructure/db/backlog-issue-repository";
import { sprintRepository } from "@/infrastructure/db/sprint-repository";

export async function pullBacklogIssueAction(input: {
  sprintId: string;
  youtrackIssueId: string;
  title: string;
  estimateHours: number;
}): Promise<PullBacklogIssueResult> {
  if (
    typeof input?.sprintId !== "string" ||
    typeof input?.youtrackIssueId !== "string" ||
    typeof input?.title !== "string" ||
    typeof input?.estimateHours !== "number"
  ) {
    return { ok: false, error: "Invalid pull request" };
  }

  try {
    const result = await pullBacklogIssue(backlogIssueRepository, sprintRepository, input);

    if (result.ok) {
      try {
        revalidatePath("/sprint");
        // Story 3.5 -- Roster's Capacity Ledgers now read BacklogIssue data
        // (assigned-hours-vs-capacity), so a pull must invalidate it too.
        revalidatePath("/roster");
        // Story 4.1 -- the Sprint Plan Overview (home route) also reads
        // BacklogIssue data (assigned issues list + the same Capacity
        // comparison), same reasoning.
        revalidatePath("/");
      } catch (revalidateError) {
        // The record was already saved -- a revalidation hiccup shouldn't
        // report failure and risk a confusing duplicate resubmission.
        console.error("revalidatePath('/sprint') failed:", revalidateError);
      }
    }

    return result;
  } catch (error) {
    // Never throw to the caller, and never leak internal error details.
    console.error("pullBacklogIssueAction failed:", error);
    return { ok: false, error: "Failed to pull issue. Please try again." };
  }
}

export async function assignBacklogIssueAction(input: {
  issueId: string;
  assigneeId: string | null;
}): Promise<AssignBacklogIssueResult> {
  if (
    typeof input?.issueId !== "string" ||
    !(input?.assigneeId === null || typeof input?.assigneeId === "string")
  ) {
    return { ok: false, error: "Invalid assignment request" };
  }

  try {
    const result = await assignBacklogIssue(backlogIssueRepository, sprintRepository, input);

    if (result.ok) {
      try {
        revalidatePath("/sprint");
        revalidatePath("/roster");
        revalidatePath("/");
      } catch (revalidateError) {
        console.error("revalidatePath('/sprint') failed:", revalidateError);
      }
    }

    return result;
  } catch (error) {
    console.error("assignBacklogIssueAction failed:", error);
    return { ok: false, error: "Failed to update assignment. Please try again." };
  }
}
