"use server";

import { listBacklogIssues, listSubItems, type ListOpenIssuesResult, type ListSubItemsResult } from "@/domain/youtrack";
import { youTrackConfigRepository } from "@/infrastructure/youtrack/config";
import { youTrackIssuesAdapter } from "@/infrastructure/youtrack/issues";

export async function listBacklogIssuesAction(): Promise<ListOpenIssuesResult> {
  try {
    return await listBacklogIssues(youTrackConfigRepository, youTrackIssuesAdapter);
  } catch (error) {
    // Never throw to the caller, and never leak internal error details.
    console.error("listBacklogIssuesAction failed:", error);
    return { ok: false, error: "Failed to load backlog issues. Please try again." };
  }
}

export async function listSubItemsAction(parentIssueId: string): Promise<ListSubItemsResult> {
  if (typeof parentIssueId !== "string") {
    return { ok: false, error: "Invalid sub-items request" };
  }
  try {
    return await listSubItems(youTrackConfigRepository, youTrackIssuesAdapter, parentIssueId);
  } catch (error) {
    console.error("listSubItemsAction failed:", error);
    return { ok: false, error: "Failed to load sub-items. Please try again." };
  }
}
