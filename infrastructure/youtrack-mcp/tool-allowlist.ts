// The single source of truth for which YouTrack MCP tools this app will ever
// register or advertise to the LLM (Story 5.1 / AD-7). Deny-by-default: only
// names listed here pass, regardless of what the server's own `readOnlyHint`
// annotation claims -- a compromised or misconfigured server could mark a
// write tool `readOnlyHint: true`, and this app must not trust that.
//
// Verified live 2026-08-25 against https://admarentech.myjetbrains.com/mcp
// (see spec-5-1-connect-a-youtrack-mcp-server.md's Design Notes) -- 23 tools
// total, 13 read-only (below), 10 write-capable (never allowlisted):
// create_issue, update_issue, add_issue_comment, manage_issue_tags,
// link_issues, change_issue_assignee, log_work, create_draft_issue,
// create_article, update_article.
export const READ_ONLY_TOOL_NAMES = [
  "search_issues",
  "get_issue",
  "get_issue_comments",
  "get_issue_fields_schema",
  "get_saved_issue_searches",
  "search_articles",
  "get_article",
  "get_project",
  "find_projects",
  "find_user",
  "find_user_groups",
  "get_user_group_members",
  "get_current_user",
] as const;

export type ReadOnlyToolName = (typeof READ_ONLY_TOOL_NAMES)[number];

const ALLOWED_NAMES: ReadonlySet<string> = new Set(READ_ONLY_TOOL_NAMES);

// Generic over `{name: string}` rather than the MCP SDK's own `Tool` type --
// this is the one shared filter every caller (the connection tester, the
// registry builder, and this file's own self-check fixture) runs a plain
// list of tool-shaped objects through, with no SDK dependency required.
export function filterToAllowedTools<T extends { name: string }>(tools: readonly T[]): T[] {
  return tools.filter((tool) => ALLOWED_NAMES.has(tool.name));
}
