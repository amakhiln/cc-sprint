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
import type { AssistantTool, ToolExecutor } from "../../../infrastructure/query-assistant/client.ts";
import { buildPickerSurface } from "./picker-surface.ts";

// Keeps the model's context small; `total` still reports the real count.
const MAX_ROWS_TO_MODEL = 150;
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
];

const AGENT_TOOL_NAMES = new Set(AGENT_TOOLS.map((tool) => tool.name));

export function isAgentTool(name: string): boolean {
  return AGENT_TOOL_NAMES.has(name);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function runAgentToolWith(loadState: () => Promise<BacklogState>): ToolExecutor {
  return async (name, args) => {
    if (!isAgentTool(name)) return { ok: false, error: `Unknown tool: ${name}` };
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
// tool's name is dropped rather than advertised twice.
export function composeTools(
  mcpTools: AssistantTool[],
  runAgent: ToolExecutor,
  runMcp: ToolExecutor,
): { tools: AssistantTool[]; executeTool: ToolExecutor } {
  return {
    tools: [...AGENT_TOOLS, ...mcpTools.filter((tool) => !isAgentTool(tool.name))],
    executeTool: (name, args) => (isAgentTool(name) ? runAgent(name, args) : runMcp(name, args)),
  };
}
