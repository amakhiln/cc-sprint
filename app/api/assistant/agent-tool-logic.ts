// Pure core of the assistant's app-local agent tools and the picker's Add
// action -- no DB/YouTrack singletons, so agent-tool-logic.selfcheck.ts can
// drive it with fakes. agent-tools.ts and app/actions/assistant-sprint.ts bind
// it to the real data sources.
import { randomUUID } from "node:crypto";
import {
  filterBacklogIssues,
  hasPullableEstimate,
  type BacklogFilter,
  type YouTrackIssueSummary,
} from "../../../domain/youtrack.ts";
import { ALREADY_PULLED_ERROR, type PullBacklogIssueInput, type PullBacklogIssueResult } from "../../../domain/backlog-issue.ts";
import type { Sprint } from "../../../domain/sprint.ts";
import type { LeaveType } from "../../../domain/leave.ts";
import { getDistinctWorkingDaysLost } from "../../../domain/calendar.ts";
import { summarizeBurndown } from "../../../domain/progress.ts";
import type { SprintPlanData, NamedCategoryHours } from "../../sprint-plan-data.ts";
import type { ProgressData } from "../../progress-data.ts";
import type { VelocityHistoryData } from "../../velocity-history-data.ts";
import type { AssistantTool, ToolExecutor } from "../../../infrastructure/query-assistant/client.ts";
import { buildPickerSurface } from "./picker-surface.ts";
import { buildResultSurface } from "./result-surface.ts";

// Keeps the model's context small; `total` still reports the real count.
// Kept small for Groq free-tier input-token limits; the picker still caps at MAX_PICKER_IDS.
const MAX_ROWS_TO_MODEL = 50;
export const MAX_PICKER_IDS = 150;

export type BacklogState =
  | {
      ok: true;
      issues: YouTrackIssueSummary[];
      rollups: Record<string, number>;
      truncated: boolean;
      activeSprint: Sprint | null;
      pulledIds: Set<string>;
    }
  | { ok: false; error: string };

export const AGENT_TOOLS: AssistantTool[] = [
  {
    name: "list_backlog_issues",
    description:
      "List open backlog issues that can be pulled into this app's active Sprint (unresolved leaf issues not already in it; parent issues are never included). Filter by YouTrack Type (any type name, case-insensitive), by whether an estimate is set, and by text in the id or summary. Returns total, the matching issues (capped), the Type values available, and the active Sprint's dates (null if none).",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", description: "A YouTrack Type value, e.g. \"Task\" or \"Sub-task\". Omit for all types." },
        estimate: { type: "string", enum: ["with", "without", "any"], description: "Estimate filter. Default any." },
        search: { type: "string", description: "Text to match in the issue id or summary." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "show_issue_picker",
    description:
      "Show the PM an interactive checklist of backlog issues, by id, with an \"Add to sprint\" button. Use ids from list_backlog_issues. Issues without an estimate are listed separately as needing one and can't be ticked. Only the PM's click adds anything -- calling this adds nothing.",
    parameters: {
      type: "object",
      properties: {
        issueIds: { type: "array", items: { type: "string" }, description: "Issue ids to show, from list_backlog_issues." },
        preselect: { type: "boolean", description: "Pre-tick every row. Use when the PM asked to add these issues." },
      },
      required: ["issueIds"],
      additionalProperties: false,
    },
  },
  {
    name: "add_issues_to_sprint",
    description:
      "Add backlog issues to the active Sprint. Only when the PM explicitly asked you to add specific issues, or the ones they have ticked, in their latest message. Ids must come from list_backlog_issues or the PM's ticked list. Each id is re-checked (open, pullable, has an estimate); reports added / already in the Sprint / failed per id.",
    parameters: {
      type: "object",
      properties: {
        issueIds: { type: "array", items: { type: "string" }, description: "Issue ids to add." },
      },
      required: ["issueIds"],
      additionalProperties: false,
    },
  },
  // App-local, read-only Sprint figures (AD-1/AD-2). Descriptions stay <= 200
  // chars for Groq's free-tier input-token budget.
  {
    name: "get_sprint_capacity",
    description:
      "This app's active Sprint capacity: team and per-member capacity, Dev hours, assigned hours, remaining capacity, over-allocation, days off, category hours.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_sprint_progress",
    description:
      "This app's active Sprint progress: estimate, logged (YouTrack work items), remaining and overrun per issue and in total, and where the burndown stands vs ideal.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_velocity_history",
    description:
      "This app's closed Sprints, most recent first: snapshot capacity, planned and actual velocity hours, delta (latest 12), and the average delta over all `total` of them.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_leave",
    description:
      "Team leave and company holidays overlapping a date range (from/to, YYYY-MM-DD, inclusive). Omit both for the active Sprint.",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string", description: "Start date, YYYY-MM-DD." },
        to: { type: "string", description: "End date, YYYY-MM-DD." },
      },
      additionalProperties: false,
    },
  },
];

type ToolOutcome = Awaited<ReturnType<ToolExecutor>>;

export type DateRange = { startDate: Date; endDate: Date };

export type LeaveData = {
  range: DateRange;
  leaves: { memberName: string; type: LeaveType; startDate: Date; endDate: Date }[];
  holidays: DateRange[];
};

// The app's own loaders, injected so the core stays testable with fakes.
// null = no active Sprint (for leave: only when no range was given).
export type AppData = {
  capacity: () => Promise<SprintPlanData | null>;
  progress: () => Promise<ProgressData | null>;
  velocity: () => Promise<VelocityHistoryData>;
  leave: (range: DateRange | null) => Promise<LeaveData | null>;
};

const APP_TOOL_NAMES = new Set(["get_sprint_capacity", "get_sprint_progress", "get_velocity_history", "get_leave"]);
// Rows sent to the model per list; counts still report the real total.
const MAX_APP_ROWS = 50;
const MAX_VELOCITY_SPRINTS = 12;

const hasRows = (result: unknown) =>
  result !== null && typeof result === "object" && Object.values(result).some((value) => Array.isArray(value) && value.length > 0);

const iso = (date: Date) => date.toISOString().slice(0, 10);
const hours = (value: number) => Math.round(value * 10) / 10;
const optionalHours = (value: number | null | undefined) => (value == null ? null : hours(value));
const sprintInfo = (sprint: { name: string | null; startDate: Date; endDate: Date }) => ({
  name: sprint.name,
  startDate: iso(sprint.startDate),
  endDate: iso(sprint.endDate),
});
const categoryHours = (breakdown: NamedCategoryHours[]) =>
  Object.fromEntries(breakdown.map((category) => [category.categoryName, hours(category.hours)]));

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  // Round-trip rejects impossible days like 2026-02-30.
  return !Number.isNaN(date.getTime()) && iso(date) === value ? date : null;
}

// Each result's first array is the rows the PM sees as a table
// (buildResultSurface renders the first array). Every figure is precomputed
// so the model only narrates; it never does arithmetic.
async function runAppTool(name: string, args: Record<string, unknown>, data: AppData): Promise<ToolOutcome> {
  if (name === "get_sprint_capacity") {
    const plan = await data.capacity();
    if (!plan) return { ok: true, result: { activeSprint: null } };
    const { team } = plan;
    const teamCapacity = hours(team.capacityHours);
    const teamAssigned = optionalHours(team.assignedHours);
    return {
      ok: true,
      result: {
        sprint: sprintInfo(plan.activeSprint),
        ...(!plan.devCategoryExists && { note: "No Dev allocation category is set up, so capacity is 0." }),
        team: {
          capacityHours: teamCapacity,
          fullDevHours: hours(team.fullDevHours),
          assignedHours: teamAssigned,
          // From the rounded figures, so the three shown numbers reconcile.
          // Positive = room for more work; negative = over-allocated by that much.
          remainingCapacityHours: teamAssigned === null ? null : hours(teamCapacity - teamAssigned),
          // null = not computed (e.g. no Dev category), never a false "fine".
          overAllocated: team.overAllocated ?? null,
          categoryHours: categoryHours(team.breakdown),
        },
        members: plan.members.map((member) => ({
          name: member.name,
          capacityHours: hours(member.capacityHours),
          assignedHours: optionalHours(member.assignedHours),
          overAllocated: member.overAllocated ?? null,
          daysOff: getDistinctWorkingDaysLost(member.sprintEntries, plan.activeSprint),
          fullDevHours: hours(member.fullDevHours),
          categoryHours: categoryHours(member.breakdown),
        })),
      },
    };
  }

  if (name === "get_sprint_progress") {
    const progress = await data.progress();
    if (!progress) return { ok: true, result: { activeSprint: null } };
    if (!progress.loggedAvailable) {
      return {
        ok: false,
        error: "Couldn't load logged time from YouTrack (not connected, or the request failed), so Sprint progress isn't available right now.",
      };
    }
    const { totals } = progress;
    const burndown = summarizeBurndown(progress.burndown);
    return {
      ok: true,
      result: {
        sprint: sprintInfo(progress.sprint),
        totals: {
          issueCount: totals.issueCount,
          estimateHours: hours(totals.estimateHours),
          loggedHours: hours(totals.loggedHours),
          remainingHours: hours(totals.remainingHours),
          overrunHours: hours(totals.overrunHours),
          overrunIssueCount: totals.overrunIssueCount,
        },
        total: progress.issues.length,
        issues: progress.issues.slice(0, MAX_APP_ROWS).map((issue) => ({
          id: issue.youtrackIssueId,
          title: issue.title,
          assignee: issue.assigneeName ?? "Unassigned",
          estimateHours: hours(issue.estimateHours),
          remainingHours: hours(issue.remainingHours),
          loggedHours: hours(issue.loggedHours),
          ...(issue.overrunHours > 0 && { overrunHours: hours(issue.overrunHours) }),
        })),
        // After issues, so issues stays the table's (first) array.
        members: progress.members.map((member) => ({
          name: member.name,
          estimateHours: hours(member.estimateHours),
          loggedHours: hours(member.loggedHours),
          remainingHours: hours(member.remainingHours),
          overrunHours: hours(member.overrunHours),
        })),
        // Latest known point only, never the full series. behindByHours > 0 =
        // behind the ideal line, < 0 = ahead.
        burndown: burndown && {
          date: iso(burndown.date),
          idealHours: hours(burndown.idealHours),
          remainingHours: hours(burndown.remainingHours),
          behindByHours: hours(burndown.behindByHours),
        },
      },
    };
  }

  if (name === "get_velocity_history") {
    const { rows, averageDelta } = await data.velocity();
    return {
      ok: true,
      result: {
        total: rows.length,
        // Over all `total` closed Sprints, not just the rows listed.
        averageDeltaHours: hours(averageDelta),
        sprints: rows.slice(0, MAX_VELOCITY_SPRINTS).map(({ sprint, ...row }) => ({
          name: sprint.name,
          dates: `${iso(sprint.startDate)} to ${iso(sprint.endDate)}`,
          capacityHours: optionalHours(row.snapshotCapacityHours),
          plannedHours: hours(row.plannedVelocityHours),
          actualHours: hours(row.actualVelocityHours),
          deltaHours: hours(row.delta),
        })),
      },
    };
  }

  // get_leave
  let range: DateRange | null = null;
  if (args.from !== undefined || args.to !== undefined) {
    const startDate = parseIsoDate(args.from);
    const endDate = parseIsoDate(args.to);
    if (!startDate || !endDate) return { ok: false, error: "Give both from and to as dates like 2026-10-14." };
    if (startDate > endDate) return { ok: false, error: "The from date is after the to date." };
    range = { startDate, endDate };
  }
  const leave = await data.leave(range);
  if (!leave) return { ok: true, result: { activeSprint: null } };
  // One row list (the table renders only the first array): leave plus
  // company-wide holidays as "Everyone".
  const entries = [
    ...leave.leaves.map((entry) => ({ member: entry.memberName, type: entry.type as string, startDate: entry.startDate, endDate: entry.endDate })),
    ...leave.holidays.map((holiday) => ({ member: "Everyone", type: "holiday", startDate: holiday.startDate, endDate: holiday.endDate })),
  ].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  return {
    ok: true,
    result: {
      from: iso(leave.range.startDate),
      to: iso(leave.range.endDate),
      total: entries.length,
      entries: entries
        .slice(0, MAX_APP_ROWS)
        .map((entry) => ({ ...entry, startDate: iso(entry.startDate), endDate: iso(entry.endDate) })),
    },
  };
}

// Binds add_issues_to_sprint to the same path as the picker's Add button
// (validation, pulls, page revalidation). Absent -> the tool reports it.
export type AddIssues = (ids: string[]) => Promise<AddIssuesToActiveSprintResult>;

const AGENT_TOOL_NAMES = new Set(AGENT_TOOLS.map((tool) => tool.name));

export function isAgentTool(name: string): boolean {
  return AGENT_TOOL_NAMES.has(name);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function runAgentToolWith(loadState: () => Promise<BacklogState>, addIssues?: AddIssues, appData?: AppData): ToolExecutor {
  return async (name, args) => {
    if (!isAgentTool(name)) return { ok: false, error: `Unknown tool: ${name}` };
    // Before loadState() -- these never need the YouTrack backlog.
    if (APP_TOOL_NAMES.has(name)) {
      if (!appData) return { ok: false, error: "Sprint figures aren't available here." };
      try {
        return await runAppTool(name, args, appData);
      } catch (error) {
        console.error(`Assistant agent tool ${name} failed:`, error);
        return { ok: false, error: "Could not load this app's Sprint figures. Please try again." };
      }
    }
    if (name === "add_issues_to_sprint") {
      if (!addIssues) return { ok: false, error: "Adding to the Sprint isn't available here." };
      const ids = Array.isArray(args.issueIds) ? args.issueIds.filter((id): id is string => typeof id === "string") : [];
      const added = await addIssues(Array.from(new Set(ids.map((id) => id.trim().toUpperCase()))));
      if (!added.ok) return { ok: false, error: added.error };
      const count = (status: AddToSprintRowResult["status"]) => added.results.filter((row) => row.status === status).length;
      return {
        ok: true,
        summary: [`${count("added")} added`, count("already") && `${count("already")} already in the Sprint`, count("failed") && `${count("failed")} failed`]
          .filter(Boolean)
          .join(" · "),
        result: { results: added.results },
      };
    }
    try {
      const state = await loadState();
      if (!state.ok) return { ok: false, error: state.error };
      const pullable = filterBacklogIssues(state.issues, state.rollups, state.pulledIds);
      const activeSprint = state.activeSprint
        ? { startDate: state.activeSprint.startDate.toISOString().slice(0, 10), endDate: state.activeSprint.endDate.toISOString().slice(0, 10) }
        : null;

      if (name === "list_backlog_issues") {
        const estimate = args.estimate === "with" || args.estimate === "without" ? args.estimate : "any";
        const filter: BacklogFilter = { type: optionalString(args.type), estimate, search: optionalString(args.search) };
        const matches = filterBacklogIssues(pullable, {}, new Set(), filter);
        return {
          ok: true,
          result: {
            total: matches.length,
            // returned < total means the list below is partial.
            returned: Math.min(matches.length, MAX_ROWS_TO_MODEL),
            // YouTrack listing itself was capped -- counts may be incomplete.
            backlogTruncated: state.truncated,
            activeSprint,
            availableTypes: Array.from(new Set(pullable.map((issue) => issue.type).filter((type) => type !== null))).sort(),
            issues: matches.slice(0, MAX_ROWS_TO_MODEL).map(({ id, summary, type, estimateHours }) => ({ id, summary, type, estimateHours })),
          },
          summary: `${matches.length} pullable ${matches.length === 1 ? "issue" : "issues"}${state.truncated ? " (backlog listing capped)" : ""}`,
          // The list *is* the picker -- the PM can tick and add straight away,
          // without relying on the model to follow up with show_issue_picker.
          ...(matches.length > 0 && {
            ui: buildPickerSurface(`picker-${randomUUID()}`, matches.slice(0, MAX_PICKER_IDS), {
              preselect: false,
              hasActiveSprint: state.activeSprint !== null,
            }),
          }),
        };
      }

      // show_issue_picker
      const requested = Array.isArray(args.issueIds) ? args.issueIds.filter((id): id is string => typeof id === "string") : [];
      const wanted = new Set(requested.slice(0, MAX_PICKER_IDS).map((id) => id.trim().toUpperCase()));
      // Ids not in the real listing (hallucinated, parents, already pulled)
      // are dropped -- every row is built from fetched data, never from args.
      const rows = pullable.filter((issue) => wanted.has(issue.id.toUpperCase()));
      if (rows.length === 0) {
        return { ok: false, error: "None of those issues are open, pullable backlog issues -- nothing to show." };
      }
      const shownIds = new Set(rows.map((issue) => issue.id.toUpperCase()));
      return {
        ok: true,
        summary: `${rows.length} ${rows.length === 1 ? "issue" : "issues"} to pick from`,
        result: {
          shown: rows.length,
          needsEstimate: rows.filter((issue) => !hasPullableEstimate(issue)).length,
          // Not pullable, unknown, or past the MAX_PICKER_IDS cap.
          dropped: requested.filter((id) => !shownIds.has(id.trim().toUpperCase())),
          activeSprint,
        },
        ui: buildPickerSurface(`picker-${randomUUID()}`, rows, {
          preselect: args.preselect === true,
          hasActiveSprint: state.activeSprint !== null,
        }),
      };
    } catch (error) {
      console.error(`Assistant agent tool ${name} failed:`, error);
      return { ok: false, error: "Could not load the backlog. Please try again." };
    }
  };
}

export type AddToSprintRowResult = {
  id: string;
  status: "added" | "already" | "failed";
  message?: string;
};

export type AddIssuesToActiveSprintResult =
  | { ok: true; results: AddToSprintRowResult[] }
  | { ok: false; error: string };

// The picker's Add button. Takes only YouTrack ids -- title and estimate come
// from the freshly loaded state, never from the client -- and re-applies the
// Backlog Drawer's pullable rule before each pull.
export async function addIssuesWith(
  loadState: () => Promise<BacklogState>,
  pull: (input: PullBacklogIssueInput) => Promise<PullBacklogIssueResult>,
  ids: unknown,
): Promise<AddIssuesToActiveSprintResult> {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_PICKER_IDS || !ids.every((id) => typeof id === "string")) {
    return { ok: false, error: "Invalid add request" };
  }
  const state = await loadState();
  if (!state.ok) return { ok: false, error: state.error };
  if (!state.activeSprint) return { ok: false, error: "No active Sprint" };

  const pullable = new Map(
    filterBacklogIssues(state.issues, state.rollups, state.pulledIds).map((issue) => [issue.id, issue]),
  );
  const results: AddToSprintRowResult[] = [];
  // Sequential on purpose -- one DB write at a time keeps the pool calm.
  for (const id of Array.from(new Set(ids as string[]))) {
    if (state.pulledIds.has(id)) {
      results.push({ id, status: "already" });
      continue;
    }
    const issue = pullable.get(id);
    if (!issue || !hasPullableEstimate(issue)) {
      results.push({ id, status: "failed", message: issue ? "Needs an estimate in YouTrack." : "Not an open, pullable backlog issue." });
      continue;
    }
    let result: PullBacklogIssueResult;
    try {
      result = await pull({
        sprintId: state.activeSprint.id,
        youtrackIssueId: issue.id,
        title: issue.summary,
        estimateHours: issue.estimateHours!,
      });
    } catch (error) {
      // One row's failure must not hide the rows already added before it.
      console.error(`Add to sprint failed for ${id}:`, error);
      result = { ok: false, error: "Failed to add. Please try again." };
    }
    if (result.ok) {
      results.push({ id, status: "added" });
    } else if (result.error === ALREADY_PULLED_ERROR) {
      results.push({ id, status: "already" });
    } else {
      results.push({ id, status: "failed", message: result.error });
    }
  }
  return { ok: true, results };
}

// The route's composition, pure so it's testable: agent tools are advertised
// first and dispatched locally; every other name goes to the MCP executor
// (which re-checks its own read-only allowlist). An MCP tool reusing an agent
// tool's name is dropped rather than advertised twice. Any successful result
// with rows and no surface of its own gets a read-only A2UI list.
export function composeTools(
  mcpTools: AssistantTool[],
  runAgent: ToolExecutor,
  runMcp: ToolExecutor,
): { tools: AssistantTool[]; executeTool: ToolExecutor } {
  return {
    tools: [...AGENT_TOOLS, ...mcpTools.filter((tool) => !isAgentTool(tool.name))],
    executeTool: async (name, args) => {
      const outcome = await (isAgentTool(name) ? runAgent(name, args) : runMcp(name, args));
      if (!outcome.ok || outcome.ui != null) return outcome;
      // App tools with no rows get no table -- the single-record fallback
      // would render their wrapper as a misleading "1 result". MCP results
      // (e.g. get_current_user) keep that fallback.
      if (APP_TOOL_NAMES.has(name) && !hasRows(outcome.result)) return outcome;
      const table = buildResultSurface(`result-${randomUUID()}`, name, outcome.result);
      return table ? { ...outcome, ui: table.surface, summary: outcome.summary ?? table.summary } : outcome;
    },
  };
}
