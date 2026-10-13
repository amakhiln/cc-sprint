// Runnable self-check for the agent tools + Add action, against fake data
// sources (no DB, no YouTrack). Run with:
//   node app/api/assistant/agent-tool-logic.selfcheck.ts
import assert from "node:assert/strict";
import { addIssuesWith, composeTools, runAgentToolWith, type BacklogState } from "./agent-tool-logic.ts";
import { ALREADY_PULLED_ERROR, type PullBacklogIssueInput } from "../../../domain/backlog-issue.ts";

const mk = (id: string, type: string, estimateHours: number | null) => ({
  id, summary: `Issue ${id}`, type, estimateHours, assignee: null, priority: null, state: null,
});
const sprint = { id: "s1", startDate: new Date("2026-10-05"), endDate: new Date("2026-10-18") } as never;
const state = (over: Partial<Extract<BacklogState, { ok: true }>> = {}): BacklogState => ({
  ok: true,
  issues: [mk("P-1", "Sub-task", 3), mk("P-2", "Sub-task", null), mk("P-3", "Task", 2), mk("P-4", "Story", 5), mk("P-5", "Task", 1)],
  rollups: { "P-4": 5 }, // parent
  truncated: false,
  activeSprint: sprint,
  pulledIds: new Set(["P-5"]),
  ...over,
});

async function main() {
  // FILTER -- generic type + estimate filter over pullable issues only.
  {
    const run = runAgentToolWith(async () => state());
    const res = await run("list_backlog_issues", { type: "sub-task", estimate: "without" });
    assert.ok(res.ok);
    const result = res.result as { total: number; issues: { id: string }[]; availableTypes: string[] };
    assert.equal(result.total, 1);
    assert.deepEqual(result.issues.map((i) => i.id), ["P-2"]);
    assert.deepEqual(result.availableTypes, ["Sub-task", "Task"]); // parent Story + pulled Task excluded
    // The list is itself the picker, so adding never depends on a follow-up call.
    assert.match((res.ui as { surfaceId: string }).surfaceId, /^picker-/);
  }

  // PROPOSE_ADD + HALLUCINATED_ID -- unknown/parent/pulled ids dropped, rows from real data.
  {
    const run = runAgentToolWith(async () => state());
    const res = await run("show_issue_picker", { issueIds: ["p-1", "P-2", "P-4", "P-5", "FAKE-9"], preselect: true });
    assert.ok(res.ok);
    const result = res.result as { shown: number; needsEstimate: number; dropped: string[] };
    assert.equal(result.shown, 2);
    assert.equal(result.needsEstimate, 1);
    assert.deepEqual(result.dropped, ["P-4", "P-5", "FAKE-9"]);
    assert.ok(!("ui" in result), "the A2UI payload never goes to the model");
    assert.equal((res as { ui: { messages: unknown[] } }).ui.messages.length, 2);

    const none = await run("show_issue_picker", { issueIds: ["FAKE-1"] });
    assert.equal(none.ok, false);
  }

  // Caps -- >50 matches (rows to model) / >150 (picker): total vs returned says the list is partial; ids past
  // the picker cap are reported as dropped, not silently lost.
  {
    const many = Array.from({ length: 160 }, (_, i) => mk(`M-${i}`, "Task", 1));
    const run = runAgentToolWith(async () => state({ issues: many, rollups: {}, pulledIds: new Set(), truncated: true }));
    const list = await run("list_backlog_issues", {});
    assert.ok(list.ok);
    const r = list.result as { total: number; returned: number; issues: unknown[]; backlogTruncated: boolean; activeSprint: unknown };
    assert.deepEqual([r.total, r.returned, r.issues.length, r.backlogTruncated], [160, 50, 50, true]);
    assert.deepEqual(r.activeSprint, { startDate: "2026-10-05", endDate: "2026-10-18" });
    const pick = await run("show_issue_picker", { issueIds: many.map((i) => i.id) });
    assert.ok(pick.ok);
    const p = pick.result as { shown: number; dropped: string[] };
    assert.equal(p.shown, 150);
    assert.deepEqual(p.dropped, many.slice(150).map((i) => i.id));
  }

  // Route composition -- agent names run locally, everything else via MCP;
  // a clashing MCP tool name is dropped, not advertised twice.
  {
    const calls: string[] = [];
    const { tools, executeTool } = composeTools(
      [{ name: "search_issues", parameters: {} }, { name: "show_issue_picker", parameters: {} }],
      async (name) => (calls.push(`agent:${name}`), { ok: true, result: null }),
      async (name) => (calls.push(`mcp:${name}`), { ok: true, result: null }),
    );
    assert.deepEqual(tools.map((t) => t.name), ["list_backlog_issues", "show_issue_picker", "add_issues_to_sprint", "search_issues"]);
    await executeTool("list_backlog_issues", {});
    await executeTool("show_issue_picker", {});
    await executeTool("search_issues", {});
    assert.deepEqual(calls, ["agent:list_backlog_issues", "agent:show_issue_picker", "mcp:search_issues"]);
  }

  // CHAT_ADD -- add_issues_to_sprint goes through the injected Add path with
  // normalised, de-duplicated ids and reports per-status counts.
  {
    let sent: string[] = [];
    const run = runAgentToolWith(async () => state(), async (ids) => {
      sent = ids;
      return { ok: true, results: [{ id: "P-1", status: "added" }, { id: "P-4", status: "already" }, { id: "FAKE-9", status: "failed", message: "nope" }] };
    });
    const res = await run("add_issues_to_sprint", { issueIds: ["p-1", "P-1", " P-4 ", "FAKE-9", 7] });
    assert.deepEqual(sent, ["P-1", "P-4", "FAKE-9"]);
    assert.ok(res.ok);
    assert.equal(res.summary, "1 added · 1 already in the Sprint · 1 failed");
    // No Add path bound -> clean tool error, never a silent no-op.
    assert.equal((await runAgentToolWith(async () => state())("add_issues_to_sprint", { issueIds: ["P-1"] })).ok, false);
  }

  // YOUTRACK_DOWN / NOT_CONFIGURED -- load failure surfaces as a tool error.
  {
    const run = runAgentToolWith(async () => ({ ok: false, error: "YouTrack is not connected yet" }));
    assert.deepEqual(await run("list_backlog_issues", {}), { ok: false, error: "YouTrack is not connected yet" });
    const throwing = runAgentToolWith(async () => { throw new Error("boom"); });
    assert.equal((await throwing("list_backlog_issues", {})).ok, false);
  }

  // CONFIRM_ADD -- per-row results; title/estimate from loaded state, not the client.
  {
    const pulls: PullBacklogIssueInput[] = [];
    const pull = async (input: PullBacklogIssueInput) => {
      pulls.push(input);
      if (input.youtrackIssueId === "P-3") return { ok: false as const, error: ALREADY_PULLED_ERROR };
      return { ok: true as const, data: { id: "b", youtrackIssueId: input.youtrackIssueId, assigneeId: null } as never };
    };
    const res = await addIssuesWith(async () => state(), pull, ["P-1", "P-1", "P-2", "P-3", "P-4", "P-5", "FAKE"]);
    assert.ok(res.ok);
    assert.deepEqual(
      res.results.map((r) => [r.id, r.status]),
      [["P-1", "added"], ["P-2", "failed"], ["P-3", "already"], ["P-4", "failed"], ["P-5", "already"], ["FAKE", "failed"]],
    );
    assert.deepEqual(pulls.map((p) => [p.youtrackIssueId, p.title, p.estimateHours]), [["P-1", "Issue P-1", 3], ["P-3", "Issue P-3", 2]]);
  }

  // A pull that throws mid-batch fails only its own row.
  {
    const pull = async (input: PullBacklogIssueInput) => {
      if (input.youtrackIssueId === "P-1") throw new Error("db down");
      return { ok: true as const, data: {} as never };
    };
    const res = await addIssuesWith(async () => state(), pull, ["P-1", "P-3"]);
    assert.ok(res.ok);
    assert.deepEqual(res.results.map((r) => [r.id, r.status]), [["P-1", "failed"], ["P-3", "added"]]);
  }

  // NO_ACTIVE_SPRINT + invalid input.
  {
    const pull = async () => { throw new Error("must not pull"); };
    assert.deepEqual(await addIssuesWith(async () => state({ activeSprint: null }), pull, ["P-1"]), { ok: false, error: "No active Sprint" });
    assert.equal((await addIssuesWith(async () => state(), pull, [])).ok, false);
    assert.equal((await addIssuesWith(async () => state(), pull, [1])).ok, false);
  }

  console.log("agent-tool-logic.selfcheck: all assertions passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
