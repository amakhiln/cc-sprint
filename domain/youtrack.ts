// Framework-free business logic. Zero imports from @prisma/client, next, or
// infrastructure/ -- see AD-1 in the Architecture Spine.

import type { WorkLog } from "./progress.ts";

export type YouTrackConfig = {
  instanceUrl: string;
  projectId: string;
  authToken: string;
};

// Sourced from env vars (infrastructure/youtrack/config.ts) -- deploy-time
// config, not user-editable via Settings, so `get` is the only op.
export type YouTrackConfigRepo = {
  get(): Promise<YouTrackConfig | null>;
};

// Story 3.2 -- a single issue as shown in the browse-only drawer, straight
// from YouTrack. Named YouTrackIssueSummary (not BacklogIssue) to leave that
// name free for Story 3.3's persisted local pull record (domain/backlog-issue.ts)
// -- the Architecture Spine's ERD reserves "BacklogIssue" for that concept.
// assignee/priority/estimateHours/type are all nullable: not every issue has
// every custom field set (see infrastructure/youtrack/issues.ts). type is the
// project's own Type field value (e.g. "Task", "Story", "Sub-task") -- an
// open string, not a fixed enum, since every YouTrack project defines its
// own set of type names. state is the State field value (e.g. "Backlog",
// "In Progress") -- also an open, project-defined string.
export type YouTrackIssueSummary = {
  id: string;
  summary: string;
  assignee: string | null;
  priority: string | null;
  estimateHours: number | null;
  type: string | null;
  state: string | null;
};

// Exported so callers (the Backlog Drawer) can route on this exact case by
// value equality without duplicating the literal -- a review-patch fix
// after the drawer's own copy of this string drifted from this one.
export const NOT_CONFIGURED_MESSAGE = "YouTrack is not connected yet — set YOUTRACK_INSTANCE_URL, YOUTRACK_PROJECT_ID, and YOUTRACK_AUTH_TOKEN.";

// rollups: rolled-up estimate hours for every issue in the project that has
// sub-items (absent key = leaf issue). Estimates live on leaf issues only; a
// parent's total is the sum of its descendants' leaf estimates, resolved ones
// included -- the parent's own YouTrack estimate is not part of it.
export type ListOpenIssuesResult =
  | { ok: true; data: YouTrackIssueSummary[]; truncated: boolean; rollups: Record<string, number> }
  | { ok: false; error: string };

// An injected port -- domain never imports the real MCP client directly
// (AD-1).
export type ListSubItemsResult =
  | { ok: true; data: YouTrackIssueSummary[] }
  | { ok: false; error: string };

export type YouTrackIssuesPort = {
  listOpenIssues(config: YouTrackConfig): Promise<ListOpenIssuesResult>;
  // An issue's direct sub-items (YouTrack's "Subtask" link, "parent for"
  // direction) -- resolved ones included, since a parent's full breakdown
  // is the point of the view.
  listSubItems(config: YouTrackConfig, parentIssueId: string): Promise<ListSubItemsResult>;
  // Story 4.2 -- one assigned issue's logged time-tracking hours, pulled at
  // Sprint close. Returns `null` (never throws, never an error result) for
  // every failure mode -- no config passed a network error, an unparseable
  // field -- all mean "not yet checked," a distinct, non-error state the
  // Close Sprint UI renders differently from a genuine 0 (this story's
  // Never clause: closing must never hard-block on YouTrack).
  getLoggedHours(config: YouTrackConfig, youtrackIssueId: string): Promise<number | null>;
  // Every dated work item on the given issues, for the live Progress page.
  // null (never throws) on any failure -- the page shows "couldn't load"
  // rather than a misleading 0h logged.
  listWorkLogs(config: YouTrackConfig, youtrackIssueIds: string[]): Promise<WorkLog[] | null>;
};

export async function listBacklogIssues(
  configRepo: Pick<YouTrackConfigRepo, "get">,
  issuesPort: YouTrackIssuesPort,
): Promise<ListOpenIssuesResult> {
  const config = await configRepo.get();
  if (!config) {
    return { ok: false, error: NOT_CONFIGURED_MESSAGE };
  }
  return issuesPort.listOpenIssues(config);
}

export async function listSubItems(
  configRepo: Pick<YouTrackConfigRepo, "get">,
  issuesPort: Pick<YouTrackIssuesPort, "listSubItems">,
  parentIssueId: string,
): Promise<ListSubItemsResult> {
  if (!parentIssueId?.trim()) {
    return { ok: false, error: "Issue is required" };
  }
  const config = await configRepo.get();
  if (!config) {
    return { ok: false, error: NOT_CONFIGURED_MESSAGE };
  }
  return issuesPort.listSubItems(config, parentIssueId);
}

// A sprint on the configured YouTrack agile board. start/finish are epoch ms
// (verified live: start at 00:00:00.000Z, finish at 23:59:59.999Z), null when
// the sprint has no dates set.
export type YouTrackSprint = {
  id: string;
  name: string;
  start: number | null;
  finish: number | null;
  archived: boolean;
};

export type ListSprintsResult =
  | { ok: true; data: YouTrackSprint[] }
  | { ok: false; error: string };

export type YouTrackSprintsPort = {
  listSprints(config: YouTrackConfig, boardId: string): Promise<ListSprintsResult>;
};

// What the Create Sprint form pre-fills from: startDate is YYYY-MM-DD (UTC
// calendar date), lengthDays the inclusive day count -- the same inclusive
// formula createSprint uses for endDate, so the saved range matches YouTrack's.
export type SprintSuggestion = {
  youtrackSprintId: string;
  name: string;
  startDate: string;
  lengthDays: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function utcDay(ms: number): number {
  return Math.floor(ms / MS_PER_DAY);
}

// Sprints the PM can still create locally: dated, not archived, not already
// linked to a local Sprint, and finishing after today (a sprint in its last
// day counts as over) -- earliest start first.
export function selectableSprints(
  sprints: YouTrackSprint[],
  importedIds: Iterable<string>,
  today: Date,
): SprintSuggestion[] {
  const imported = new Set(importedIds);
  const todayDay = utcDay(today.getTime());
  return sprints
    .filter(
      (s): s is YouTrackSprint & { start: number; finish: number } =>
        typeof s.start === "number" &&
        typeof s.finish === "number" &&
        !s.archived &&
        !imported.has(s.id) &&
        utcDay(s.finish) > todayDay &&
        utcDay(s.finish) >= utcDay(s.start),
    )
    .sort((a, b) => a.start - b.start)
    .map((s) => ({
      youtrackSprintId: s.id,
      name: s.name,
      startDate: new Date(utcDay(s.start) * MS_PER_DAY).toISOString().slice(0, 10),
      lengthDays: utcDay(s.finish) - utcDay(s.start) + 1,
    }));
}
