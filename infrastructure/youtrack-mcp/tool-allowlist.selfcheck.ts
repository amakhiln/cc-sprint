// Runnable self-check for the read-only tool allowlist (Story 5.1 / AD-7) --
// no test framework installed (see AGENTS.md / project conventions), so this
// is a plain assert-based script.
// Run with: node infrastructure/youtrack-mcp/tool-allowlist.selfcheck.ts
//
// ponytail: no framework, this is the smallest thing that fails when the
// deny-by-default filter breaks.

import assert from "node:assert/strict";
import { READ_ONLY_TOOL_NAMES, filterToAllowedTools } from "./tool-allowlist.ts";

// The full 23-tool live list captured against the real server (see
// tool-allowlist.ts's header comment) -- 13 read-only, 10 write-capable.
const READ_TOOLS = [
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
];

const WRITE_TOOLS = [
  "create_issue",
  "update_issue",
  "add_issue_comment",
  "manage_issue_tags",
  "link_issues",
  "change_issue_assignee",
  "log_work",
  "create_draft_issue",
  "create_article",
  "update_article",
];

function main() {
  assert.equal(READ_TOOLS.length, 13, "the fixture's own read-tool count should be 13");
  assert.equal(WRITE_TOOLS.length, 10, "the fixture's own write-tool count should be 10");

  const allTools = [...READ_TOOLS, ...WRITE_TOOLS].map((name) => ({ name }));
  assert.equal(allTools.length, 23, "the fixture's own total should be 23");

  // TOOL_FILTER -- the full live list filters down to exactly the 13
  // allowlisted read-only names.
  const filtered = filterToAllowedTools(allTools);
  assert.deepEqual(
    filtered.map((tool) => tool.name).sort(),
    [...READ_TOOLS].sort(),
    "filtering the full 23-tool live list should return exactly the 13 read-only tools",
  );
  assert.equal(READ_ONLY_TOOL_NAMES.length, 13, "the allowlist constant itself should hold exactly 13 names");

  // Every write-capable tool -- even one the server itself marks
  // `readOnlyHint: true` -- must never pass, since the filter only ever
  // checks the name against the fixed constant, not any server-supplied
  // annotation.
  for (const name of WRITE_TOOLS) {
    assert.deepEqual(filterToAllowedTools([{ name }]), [], `${name} must never pass the filter`);
  }

  // DENY_BY_DEFAULT -- an unlisted/unknown tool name (never seen on the live
  // server, and not any known write tool either) never passes.
  assert.deepEqual(
    filterToAllowedTools([{ name: "some_future_tool_nobody_reviewed" }]),
    [],
    "an unknown tool name must never pass the filter",
  );

  console.log("tool-allowlist.selfcheck: all assertions passed");
}

main();
