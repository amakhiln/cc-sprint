// Runnable self-check: tool results with rows become a read-only A2UI
// ResultTable the real v0.9 MessageProcessor accepts against the app catalog, and composeTools attaches it to
// every tool except ones that bring their own surface. Run with:
//   node app/api/assistant/result-surface.selfcheck.ts
import assert from "node:assert/strict";
import { Catalog, MessageProcessor } from "@a2ui/web_core/v0_9";
import { APP_CATALOG_ID, ResultTableApi, buildResultSurface, type ResultTableProps } from "./result-surface.ts";
import { composeTools } from "./agent-tool-logic.ts";

const mcpEnvelope = (payload: unknown) => [{ type: "text", text: JSON.stringify(payload) }];

{
  const result = mcpEnvelope({
    issuesPage: [
      { id: "FAKE-1", url: "https://example.test/FAKE-1", summary: "First", createdAt: "2026-01-02T03:04:05Z", customFields: { Type: "Task", State: "Open" } },
      { id: "FAKE-2", summary: "Second", customFields: { Type: "Bug", State: null } },
    ],
    hasNextPage: false,
  });
  const { surface, summary } = buildResultSurface("r1", "search_issues", result)!;
  assert.equal(summary, "2 results");
  const processor = new MessageProcessor([new Catalog(APP_CATALOG_ID, "0.9", [ResultTableApi])]);
  processor.processMessages(surface.messages as never);
  const props = processor.getSurface("r1")!.componentsModel.get("root")!.properties as ResultTableProps;
  assert.equal(props.title, "2 results · search issues");
  assert.deepEqual(props.columns, ["id", "summary", "createdAt", "Type", "State"]);
  assert.deepEqual(props.badgeColumns, ["Type", "State"]);
  assert.deepEqual(props.rows, [
    { cells: ["FAKE-1", "First", "2026-01-02", "Task", "Open"], href: "https://example.test/FAKE-1" },
    { cells: ["FAKE-2", "Second", "", "Bug", ""] },
  ]);
}

// The wrapper's own counts win over the row count.
const titleOf = (payload: unknown) =>
  ((buildResultSurface("t", "x", mcpEnvelope(payload))!.surface.messages[1] as { updateComponents: { components: ResultTableProps[] } })
    .updateComponents.components[0]).title;
assert.equal(titleOf({ total: 80, issues: [{ id: "FAKE-1" }] }), "1 of 80 shown · x");
assert.equal(titleOf({ issuesPage: [{ id: "FAKE-1" }], hasNextPage: true }), "1 shown · more available · x");

// A single record is one row; a scalar has no rows -> no surface.
assert.ok(buildResultSurface("r2", "get_current_user", mcpEnvelope({ login: "fake", name: "Fake User" })));
assert.equal(buildResultSurface("r3", "x", mcpEnvelope("plain text")), null);

{
  const { executeTool } = composeTools(
    [],
    async () => ({ ok: true, result: { shown: 1 }, ui: { surfaceId: "picker-x", messages: [] } }),
    async () => ({ ok: true, result: mcpEnvelope([{ id: "FAKE-3", summary: "Third" }]) }),
  );
  const mcp = await executeTool("search_issues", {});
  assert.ok(mcp.ok && (mcp.ui as { surfaceId: string }).surfaceId.startsWith("result-"));
  assert.equal(mcp.ok && mcp.summary, "1 result", "table count becomes the step summary");
  const picker = await executeTool("show_issue_picker", { issueIds: ["FAKE-3"] });
  assert.ok(picker.ok && (picker.ui as { surfaceId: string }).surfaceId === "picker-x", "own surface kept");
}

console.log("result-surface self-check passed");
