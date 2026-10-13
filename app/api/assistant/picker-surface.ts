// Builds the assistant's issue picker: the app's ResultTable (result-surface.ts)
// in selection mode. Pure: every row is built from real YouTrack issue data by
// app code -- the model only ever picked which ids to show (Story 5.2
// grounding stance).
import { hasPullableEstimate, type YouTrackIssueSummary } from "../../../domain/youtrack.ts";
import { tableSurface, type A2uiSurfaceMessages } from "./result-surface.ts";

export const ADD_TO_SPRINT_EVENT = "add_to_sprint";

const COLUMNS = ["id", "summary", "type", "state", "assignee", "estimateHours"];
const NEEDS_ESTIMATE = "Needs an estimate in YouTrack before it can be added";

function cells(issue: YouTrackIssueSummary): string[] {
  const estimate = issue.estimateHours !== null && issue.estimateHours > 0 ? issue.estimateHours.toFixed(1) : "";
  return [issue.id, issue.summary, issue.type ?? "", issue.state ?? "", issue.assignee ?? "", estimate];
}

export function buildPickerSurface(
  surfaceId: string,
  issues: YouTrackIssueSummary[],
  { preselect, hasActiveSprint }: { preselect: boolean; hasActiveSprint: boolean },
): A2uiSurfaceMessages {
  const addable = issues.filter(hasPullableEstimate);
  const needsEstimate = issues.filter((issue) => !hasPullableEstimate(issue));
  const title = [
    `${addable.length} ${addable.length === 1 ? "issue" : "issues"} ready to add`,
    needsEstimate.length > 0 ? `${needsEstimate.length} need an estimate` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return tableSurface(surfaceId, {
    title,
    columns: COLUMNS,
    badgeColumns: ["type", "state"],
    // Addable first; unestimated rows stay visible but can never be ticked.
    rows: [
      ...addable.map((issue) => ({ id: issue.id, cells: cells(issue) })),
      ...needsEstimate.map((issue) => ({ id: issue.id, cells: cells(issue), disabledReason: NEEDS_ESTIMATE })),
    ],
    select: {
      event: ADD_TO_SPRINT_EVENT,
      buttonLabel: "Add to sprint",
      preselect,
      ...(hasActiveSprint ? {} : { blockedReason: "No active Sprint — start one to add issues." }),
    },
  });
}

// The Add action's `context.ids` -> issue ids. Anything that isn't a string is
// ignored; the server re-checks every id against fresh data anyway.
export function pickedIssueIds(contextIds: unknown): string[] {
  if (!Array.isArray(contextIds)) return [];
  return contextIds.filter((id): id is string => typeof id === "string");
}
