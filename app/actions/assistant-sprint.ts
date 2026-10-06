"use server";

import { revalidatePath } from "next/cache";
import { pullBacklogIssue } from "@/domain/backlog-issue";
import { backlogIssueRepository } from "@/infrastructure/db/backlog-issue-repository";
import { sprintRepository } from "@/infrastructure/db/sprint-repository";
import { loadBacklogState } from "@/app/api/assistant/agent-tools";
import { addIssuesWith, type AddIssuesToActiveSprintResult } from "@/app/api/assistant/agent-tool-logic";

// The assistant picker's Add button -- see addIssuesWith for the rules.
export async function addIssuesToActiveSprintAction(ids: string[]): Promise<AddIssuesToActiveSprintResult> {
  try {
    const result = await addIssuesWith(
      loadBacklogState,
      (input) => pullBacklogIssue(backlogIssueRepository, sprintRepository, input),
      ids,
    );
    if (result.ok && result.results.some((row) => row.status === "added")) {
      try {
        revalidatePath("/sprint");
        revalidatePath("/roster");
        revalidatePath("/");
      } catch (revalidateError) {
        console.error("revalidatePath after assistant add failed:", revalidateError);
      }
    }
    return result;
  } catch (error) {
    console.error("addIssuesToActiveSprintAction failed:", error);
    return { ok: false, error: "Failed to add issues. Please try again." };
  }
}
