// REST-based YouTrack issue listing -- replaces the original YouTrack-MCP-tool
// implementation (2026-08-24 migration; see rest-client.ts's header comment
// for why). domain/youtrack.ts depends on the YouTrackIssuesPort port instead
// of this module directly (AD-1), so nothing outside infrastructure/youtrack/
// changed for this swap.
//
// Every shape below is confirmed against a live YouTrack REST API response,
// not guessed from documentation prose:
// - GET /api/issues returns a bare array directly -- no issuesPage/issues
//   wrapper (that wrapping was a search_issues MCP-tool-specific quirk).
// - customFields is always {name, value, $type}[] -- never the flattened
//   {fieldName: value} map the MCP tool happened to return.
// - A Period field's value (Estimation, Spent time) is always
//   {minutes, presentation, $type} -- never a bare presentation string, so
//   no string parsing is needed at all.
// - This org's assignee data lives on "Assignees" (a MultiUserIssueCustomField,
//   plural, resolving to an array of users) rather than "Assignee" -- both
//   candidate names are checked, and an array value resolves to its first
//   entry (the app has no UI for showing more than one assignee).
import type {
  YouTrackConfig,
  YouTrackIssuesPort,
  YouTrackIssueSummary,
  ListOpenIssuesResult,
  ListSubItemsResult,
} from "@/domain/youtrack";
import type { WorkLog } from "@/domain/progress";
import { restGet, YouTrackRestError } from "./rest-client.ts";

const GENERIC_ERROR = "Could not load backlog issues from YouTrack. Check your connection in Settings.";

// YouTrack REST's $top has no fixed ceiling the way the old MCP tool did (a
// live server rejected limit:50 with "exceeds maximum 20.0") -- 500 is a
// deliberate page size, not a forced one (raised from 20 on 2026-09-30: ADM
// had 551 unresolved issues, so 20 hid most of the backlog). Requesting one
// extra row is a reliable way to know there's more, rather than the old
// length-equals-limit heuristic (ambiguous when a project has exactly that
// many open issues).
// ponytail: single fetch, add search/$skip paging if the drawer gets slow.
const PAGE_SIZE = 500;

const ISSUE_FIELDS = "idReadable,summary,customFields(name,value(name,login,fullName,minutes,presentation))";
const LOGGED_HOURS_FIELDS = "customFields(name,value(minutes,presentation))";
const SUB_ITEMS_FIELDS = `links(direction,linkType(name),issues(${ISSUE_FIELDS}))`;
// Whole-project tree for estimate rollups -- only the Estimation field (via the
// customFields= filter) and each issue's parent, so ~2,100 issues come back as
// ~0.5MB instead of ~11MB with every field.
const TREE_FIELDS = "idReadable,customFields(name,value(minutes)),parent(issues(idReadable))";
// ponytail: one unpaged fetch; page with $skip if a project outgrows this.
const TREE_LIMIT = 10000;

const WORK_ITEM_FIELDS = "date,duration(minutes),issue(idReadable)";
// Issue ids per /api/workItems query -- keeps the query string well under URL
// length limits for a large Sprint.
const WORK_ITEM_BATCH = 50;

type RestWorkItem = { date?: number; duration?: { minutes?: number }; issue?: { idReadable?: string } };

// YouTrack work item dates are epoch ms at UTC midnight (confirmed live) --
// floored to the day anyway so a time-of-day value can never shift a log
// into the wrong day.
export function toWorkLog(item: RestWorkItem): WorkLog | null {
  const id = item.issue?.idReadable;
  const minutes = item.duration?.minutes;
  if (!id || typeof item.date !== "number" || typeof minutes !== "number") return null;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return { youtrackIssueId: id, date: new Date(Math.floor(item.date / MS_PER_DAY) * MS_PER_DAY), hours: minutes / 60 };
}

// Story 4.2 -- YouTrack's standard time-tracking custom field. Reuses
// extractEstimateHours: a logged-time field is the same Period type as
// Estimate, just a different field name.
const LOGGED_HOURS_FIELD_NAMES = ["spent time", "time spent", "logged time"];

type RestCustomField = { name: string; value: unknown };
type RestIssue = { idReadable?: string; id?: string; summary?: string; customFields?: RestCustomField[] };
type RestLink = { direction?: string; linkType?: { name?: string }; issues?: RestIssue[] };

// Exported for issues.selfcheck.ts -- pure, no network/server needed to test.
export function findCustomField(customFields: RestCustomField[] | undefined, candidateNames: string[]): unknown {
  if (!Array.isArray(customFields)) return null;
  const match = customFields.find((field) => candidateNames.includes(field.name.toLowerCase()));
  return match ? (match.value ?? null) : null;
}

export function extractFieldName(value: unknown): string | null {
  if (Array.isArray(value)) return value.length > 0 ? extractFieldName(value[0]) : null;
  if (value && typeof value === "object") {
    const named =
      (value as { name?: unknown }).name ?? (value as { fullName?: unknown }).fullName ?? (value as { login?: unknown }).login;
    if (typeof named === "string") return named;
  }
  return null;
}

export function extractEstimateHours(value: unknown): number | null {
  const minutes = value && typeof value === "object" ? (value as { minutes?: unknown }).minutes : undefined;
  return typeof minutes === "number" ? Math.round((minutes / 60) * 100) / 100 : null;
}

export function toIssueSummary(issue: RestIssue): YouTrackIssueSummary {
  const fields = issue.customFields;
  return {
    id: issue.idReadable || issue.id || "",
    summary: issue.summary ?? "",
    assignee: extractFieldName(findCustomField(fields, ["assignee", "assignees"])),
    priority: extractFieldName(findCustomField(fields, ["priority"])),
    estimateHours: extractEstimateHours(findCustomField(fields, ["estimation", "estimate"])),
    // Type is already present in every response -- the fields projection
    // above requests a sub-shape applied to every custom field YouTrack
    // returns, not a specific named subset (confirmed live: the response
    // includes Module/State/Type/etc. even though only value(name,...) was
    // requested), so no fields-string change was needed to add this.
    type: extractFieldName(findCustomField(fields, ["type"])),
    state: extractFieldName(findCustomField(fields, ["state"])),
  };
}

// Confirmed live (ADM-2151): children sit on the "Subtask" link type with
// direction OUTWARD ("parent for"); INWARD on the same type is the parent.
export function extractSubItems(links: RestLink[] | undefined): YouTrackIssueSummary[] {
  if (!Array.isArray(links)) return [];
  return links
    .filter((link) => link.linkType?.name === "Subtask" && link.direction === "OUTWARD")
    .flatMap((link) => link.issues ?? [])
    .map(toIssueSummary)
    .filter((issue) => issue.id !== "");
}

export type TreeNode = { id: string; estimateHours: number | null; parentId: string | null };

// Rolled-up hours for every node that has children: a leaf contributes its own
// estimate (0 if unset), a parent contributes the sum of its children -- never
// its own estimate. A parent/child cycle contributes 0 rather than recursing
// forever.
export function computeRollups(nodes: TreeNode[]): Record<string, number> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const children = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.parentId && byId.has(node.parentId)) {
      children.set(node.parentId, [...(children.get(node.parentId) ?? []), node.id]);
    }
  }
  const memo = new Map<string, number>();
  const visiting = new Set<string>();
  function total(id: string): number {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const kids = children.get(id);
    const value = kids ? kids.reduce((sum, kid) => sum + total(kid), 0) : (byId.get(id)?.estimateHours ?? 0);
    visiting.delete(id);
    memo.set(id, value);
    return value;
  }
  const rollups: Record<string, number> = {};
  for (const id of children.keys()) rollups[id] = Math.round(total(id) * 100) / 100;
  return rollups;
}

function toTreeNode(issue: RestIssue & { parent?: { issues?: RestIssue[] } }): TreeNode {
  return {
    id: issue.idReadable || issue.id || "",
    estimateHours: extractEstimateHours(findCustomField(issue.customFields, ["estimation", "estimate"])),
    parentId: issue.parent?.issues?.[0]?.idReadable ?? null,
  };
}

export const youTrackIssuesAdapter: YouTrackIssuesPort = {
  async getLoggedHours(config: YouTrackConfig, youtrackIssueId: string): Promise<number | null> {
    try {
      const data = await restGet(
        config.instanceUrl,
        `/api/issues/${encodeURIComponent(youtrackIssueId)}?fields=${encodeURIComponent(LOGGED_HOURS_FIELDS)}`,
        config.authToken,
      );
      return extractEstimateHours(findCustomField((data as RestIssue | null)?.customFields, LOGGED_HOURS_FIELD_NAMES));
    } catch (error) {
      // A network/connection failure for one issue degrades to "not yet
      // checked," not an error -- Story 4.2's Never clause: closing must
      // never hard-block on YouTrack.
      console.error(`YouTrack getLoggedHours failed for ${youtrackIssueId}:`, error);
      return null;
    }
  },

  async listWorkLogs(config: YouTrackConfig, youtrackIssueIds: string[]): Promise<WorkLog[] | null> {
    try {
      const batches: string[][] = [];
      for (let i = 0; i < youtrackIssueIds.length; i += WORK_ITEM_BATCH) {
        batches.push(youtrackIssueIds.slice(i, i + WORK_ITEM_BATCH));
      }
      const results = await Promise.all(
        batches.map((ids) =>
          restGet(
            config.instanceUrl,
            `/api/workItems?query=${encodeURIComponent(`issue id: ${ids.join(", ")}`)}&fields=${encodeURIComponent(WORK_ITEM_FIELDS)}&$top=${TREE_LIMIT}`,
            config.authToken,
          ),
        ),
      );
      if (!results.every(Array.isArray)) return null;
      return (results as RestWorkItem[][]).flat().map(toWorkLog).filter((log) => log !== null);
    } catch (error) {
      console.error("YouTrack listWorkLogs failed:", error);
      return null;
    }
  },

  async listSubItems(config: YouTrackConfig, parentIssueId: string): Promise<ListSubItemsResult> {
    try {
      const data = await restGet(
        config.instanceUrl,
        `/api/issues/${encodeURIComponent(parentIssueId)}?fields=${encodeURIComponent(SUB_ITEMS_FIELDS)}`,
        config.authToken,
      );
      return { ok: true, data: extractSubItems((data as { links?: RestLink[] } | null)?.links) };
    } catch (error) {
      console.error(`YouTrack listSubItems failed for ${parentIssueId}:`, error);
      return { ok: false, error: "Could not load sub-items from YouTrack. Please try again." };
    }
  },

  async listOpenIssues(config: YouTrackConfig): Promise<ListOpenIssuesResult> {
    try {
      const query = `project: ${config.projectId} #Unresolved`;
      const treeQuery = `project: ${config.projectId}`;
      const [data, tree] = await Promise.all([
        restGet(
          config.instanceUrl,
          `/api/issues?query=${encodeURIComponent(query)}&fields=${encodeURIComponent(ISSUE_FIELDS)}&$top=${PAGE_SIZE + 1}`,
          config.authToken,
        ),
        restGet(
          config.instanceUrl,
          `/api/issues?query=${encodeURIComponent(treeQuery)}&fields=${encodeURIComponent(TREE_FIELDS)}&customFields=Estimation&$top=${TREE_LIMIT}`,
          config.authToken,
        ),
      ]);
      // A failed tree fails the whole load -- without it every parent would
      // look like a pullable leaf.
      if (!Array.isArray(data) || !Array.isArray(tree)) {
        // A malformed/unrecognized response is a fetch error, not "zero open
        // issues" -- those are different states the UI must not conflate.
        console.error(
          "YouTrack /api/issues returned an unrecognized response shape. Raw result:",
          JSON.stringify(data, null, 2),
        );
        return { ok: false, error: GENERIC_ERROR };
      }
      const truncated = data.length > PAGE_SIZE;
      const issues = (data as RestIssue[])
        .slice(0, PAGE_SIZE)
        .map(toIssueSummary)
        .filter((issue) => issue.id !== "");
      const rollups = computeRollups((tree as RestIssue[]).map(toTreeNode).filter((node) => node.id !== ""));
      return { ok: true, data: issues, truncated, rollups };
    } catch (error) {
      if (error instanceof YouTrackRestError) {
        // A malformed query (e.g. a Project ID that doesn't exist) --
        // YouTrack reports this as 400 invalid_query, not a network failure.
        console.error(`YouTrack /api/issues rejected the query: ${error.message}`);
      } else {
        console.error("YouTrack listOpenIssues failed:", error);
      }
      return { ok: false, error: GENERIC_ERROR };
    }
  },
};
