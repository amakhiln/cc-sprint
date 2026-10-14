// Runnable self-check for the agent tools + Add action, against fake data
// sources (no DB, no YouTrack). Run with:
//   node app/api/assistant/agent-tool-logic.selfcheck.ts
import assert from "node:assert/strict";
import { addIssuesWith, composeTools, runAgentToolWith, type AppData, type BacklogState } from "./agent-tool-logic.ts";
import type { ResultTableProps } from "./result-surface.ts";
import type { ToolExecutor } from "../../../infrastructure/query-assistant/client.ts";
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
    assert.deepEqual(tools.map((t) => t.name), [
      "list_backlog_issues", "show_issue_picker", "add_issues_to_sprint",
      "get_sprint_capacity", "get_sprint_progress", "get_velocity_history", "get_leave",
      "search_issues",
    ]);
    // Groq free-tier budget.
    for (const tool of tools.filter((t) => t.name.startsWith("get_"))) assert.ok(tool.description!.length <= 200, tool.name);
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

  // APP DATA TOOLS -- precomputed, 1-decimal, ISO dates; first array = table rows.
  {
    const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
    const active = { id: "s1", name: "Sprint 7", startDate: d("2026-10-05"), endDate: d("2026-10-16") };
    const cat = (hours: number) => [{ categoryId: "c1", categoryName: "Dev", hours }];
    const leaveRanges: (unknown | null)[] = [];
    const appData: AppData = {
      capacity: async () => ({
        activeSprint: active,
        devCategoryExists: true,
        team: { capacityHours: 100.04, fullDevHours: 120, breakdown: cat(100.04), assignedHours: 110.26, overAllocated: true },
        members: [{
          id: "m1", name: "Asha", workingHoursPerDay: 8, capacityHours: 50.04, fullDevHours: 60, breakdown: cat(50.04),
          assignedHours: undefined, overAllocated: undefined, nonZeroAllocations: [],
          // Mon-Tue leave + a Tue holiday -> 2 distinct working days off.
          sprintEntries: [
            { key: "l", label: "Planned Leave", startDate: d("2026-10-05"), endDate: d("2026-10-06") },
            { key: "h", label: "Holiday", startDate: d("2026-10-06"), endDate: d("2026-10-06") },
          ],
        }],
        assignedIssues: [],
      }),
      progress: async () => ({
        sprint: active,
        loggedAvailable: true,
        totals: { estimateHours: 10, loggedHours: 7.25, remainingHours: 4, overrunHours: 1.25, issueCount: 2, overrunIssueCount: 1 },
        members: [{ key: "m1", name: "Asha", estimateHours: 4, loggedHours: 5.25, remainingHours: 0, overrunHours: 1.25, issueCount: 1, overrunIssueCount: 1 }],
        issues: [
          { id: "b1", youtrackIssueId: "P-1", title: "One", assigneeId: null, assigneeName: null, youtrackUrl: null, estimateHours: 6, loggedHours: 2, remainingHours: 4, overrunHours: 0 },
          { id: "b2", youtrackIssueId: "P-2", title: "Two", assigneeId: "m1", assigneeName: "Asha", youtrackUrl: null, estimateHours: 4, loggedHours: 5.25, remainingHours: 0, overrunHours: 1.25 },
        ],
        burndown: [
          { date: d("2026-10-05"), isStart: true, idealHours: 10, remainingHours: 10 },
          { date: d("2026-10-05"), isStart: false, idealHours: 9, remainingHours: 9.5 },
          { date: d("2026-10-06"), isStart: false, idealHours: 8, remainingHours: null },
        ],
      }),
      velocity: async () => ({
        rows: [{
          sprint: { ...active, youtrackSprintId: null, status: "closed", snapshotCapacityHours: 80.06, snapshotAllocationBreakdown: null, snapshotActualVelocityHours: 70 },
          snapshotCapacityHours: 80.06, plannedVelocityHours: 75, actualVelocityHours: 70, delta: -5,
        }],
        averageDelta: -5.04,
      }),
      leave: async (range) => {
        leaveRanges.push(range);
        return {
          range: range ?? active,
          leaves: [{ memberName: "Asha", type: "planned", startDate: d("2026-10-05"), endDate: d("2026-10-06") }],
          holidays: [{ startDate: d("2026-10-06"), endDate: d("2026-10-06") }],
        };
      },
    };
    const run = runAgentToolWith(async () => { throw new Error("app tools must not load the backlog"); }, undefined, appData);

    const cap = await run("get_sprint_capacity", {});
    assert.ok(cap.ok);
    assert.deepEqual(cap.result, {
      sprint: { name: "Sprint 7", startDate: "2026-10-05", endDate: "2026-10-16" },
      // remaining from the rounded 100 and 110.3 (-10.3), not raw 100.04-110.26 (-10.2).
      team: { capacityHours: 100, fullDevHours: 120, assignedHours: 110.3, remainingCapacityHours: -10.3, overAllocated: true, categoryHours: { Dev: 100 } },
      // Comparison never computed -> null, not a false "not over-allocated".
      members: [{ name: "Asha", capacityHours: 50, assignedHours: null, overAllocated: null, daysOff: 2, fullDevHours: 60, categoryHours: { Dev: 50 } }],
    });

    const prog = await run("get_sprint_progress", {});
    assert.ok(prog.ok);
    const p = prog.result as { total: number; totals: { loggedHours: number }; issues: { id: string; assignee: string; overrunHours?: number }[]; members: unknown; burndown: unknown };
    assert.equal(p.total, 2);
    assert.equal(p.totals.loggedHours, 7.3);
    assert.deepEqual(p.issues.map((i) => [i.id, i.assignee, i.overrunHours]), [["P-1", "Unassigned", undefined], ["P-2", "Asha", 1.3]]);
    assert.deepEqual(p.members, [{ name: "Asha", estimateHours: 4, loggedHours: 5.3, remainingHours: 0, overrunHours: 1.3 }]);
    assert.deepEqual(p.burndown, { date: "2026-10-05", idealHours: 9, remainingHours: 9.5, behindByHours: 0.5 });
    assert.equal(Object.values(p).find(Array.isArray), p.issues, "issues is the first array");

    const vel = await run("get_velocity_history", {});
    assert.ok(vel.ok);
    assert.deepEqual(vel.result, {
      total: 1,
      averageDeltaHours: -5,
      sprints: [{ name: "Sprint 7", dates: "2026-10-05 to 2026-10-16", capacityHours: 80.1, plannedHours: 75, actualHours: 70, deltaHours: -5 }],
    });
    const noVel = await runAgentToolWith(async () => state(), undefined, { ...appData, velocity: async () => ({ rows: [], averageDelta: 0 }) })("get_velocity_history", {});
    assert.deepEqual(noVel, { ok: true, result: { total: 0, averageDeltaHours: 0, sprints: [] } });

    const leave = await run("get_leave", { from: "2026-10-12", to: "2026-10-16" });
    assert.ok(leave.ok);
    assert.deepEqual(leaveRanges.pop(), { startDate: d("2026-10-12"), endDate: d("2026-10-16") });
    assert.deepEqual(leave.result, {
      from: "2026-10-12", to: "2026-10-16",
      total: 2,
      entries: [
        { member: "Asha", type: "planned", startDate: "2026-10-05", endDate: "2026-10-06" },
        { member: "Everyone", type: "holiday", startDate: "2026-10-06", endDate: "2026-10-06" },
      ],
    });
    const sprintLeave = await run("get_leave", {});
    assert.ok(sprintLeave.ok);
    assert.equal(leaveRanges.pop(), null, "no range -> loader defaults to the active Sprint");
    assert.equal((sprintLeave.result as { from: string }).from, "2026-10-05");
    for (const bad of [{ from: "2026-10-16", to: "2026-10-12" }, { from: "2026-02-30", to: "2026-03-01" }, { from: "2026-10-12" }, { from: "next week", to: "2026-10-16" }]) {
      assert.equal((await run("get_leave", bad)).ok, false, JSON.stringify(bad));
    }

    // NO_ACTIVE_SPRINT -- capacity / progress / leave-without-range.
    const none = runAgentToolWith(async () => state(), undefined, {
      ...appData, capacity: async () => null, progress: async () => null, leave: async () => null,
    });
    for (const tool of ["get_sprint_capacity", "get_sprint_progress", "get_leave"]) {
      assert.deepEqual(await none(tool, {}), { ok: true, result: { activeSprint: null } }, tool);
    }

    // YouTrack worklog failure / loader throwing -> plain-word tool error.
    const failing = runAgentToolWith(async () => state(), undefined, {
      ...appData,
      progress: async () => ({ ...(await appData.progress())!, loggedAvailable: false }),
      velocity: async () => { throw new Error("db down"); },
    });
    assert.equal((await failing("get_sprint_progress", {})).ok, false);
    assert.equal((await failing("get_velocity_history", {})).ok, false);
    // Not bound -> clean error.
    assert.equal((await runAgentToolWith(async () => state())("get_sprint_capacity", {})).ok, false);

    // Rendering -- the table is built from each tool's intended row array.
    const tableOf = async (executor: ToolExecutor, tool: string, args: Record<string, unknown> = {}) => {
      const out = await composeTools([], executor, async () => ({ ok: true, result: null })).executeTool(tool, args);
      assert.ok(out.ok, tool);
      const ui = out.ui as { messages: { updateComponents?: { components: ResultTableProps[] } }[] } | undefined;
      return ui && ui.messages[1].updateComponents!.components[0];
    };
    const capTable = (await tableOf(run, "get_sprint_capacity"))!;
    assert.deepEqual([capTable.columns[0], capTable.rows.map((r) => r.cells[0])], ["name", ["Asha"]]);
    const progTable = (await tableOf(run, "get_sprint_progress"))!;
    assert.deepEqual([progTable.columns.slice(0, 2), progTable.rows.map((r) => r.cells[0])], [["id", "title"], ["P-1", "P-2"]]);
    const velTable = (await tableOf(run, "get_velocity_history"))!;
    assert.deepEqual([velTable.columns.slice(0, 2), velTable.rows.length], [["name", "dates"], 1]);
    const leaveTable = (await tableOf(run, "get_leave"))!;
    assert.deepEqual(leaveTable.columns, ["member", "type", "startDate", "endDate"]);
    assert.equal(leaveTable.rows.length, 2);

    // Holidays only -> labelled holiday rows.
    const holidaysOnly = runAgentToolWith(async () => state(), undefined, {
      ...appData,
      leave: async () => ({ range: active, leaves: [], holidays: [{ startDate: d("2026-10-06"), endDate: d("2026-10-06") }] }),
    });
    assert.deepEqual((await tableOf(holidaysOnly, "get_leave"))!.rows.map((r) => r.cells), [["Everyone", "holiday", "2026-10-06", "2026-10-06"]]);

    // Truncated -> real total in the result and in the table title ("50 of 60").
    const many = Array.from({ length: 60 }, (_, i) => ({ memberName: `M${i}`, type: "planned" as const, startDate: d("2026-10-05"), endDate: d("2026-10-05") }));
    const truncated = runAgentToolWith(async () => state(), undefined, { ...appData, leave: async () => ({ range: active, leaves: many, holidays: [] }) });
    const tr = await truncated("get_leave", {});
    assert.ok(tr.ok);
    assert.deepEqual([(tr.result as { total: number }).total, (tr.result as { entries: unknown[] }).entries.length], [60, 50]);
    assert.match((await tableOf(truncated, "get_leave"))!.title, /^50 of 60 shown/);

    // Empty row lists / no active Sprint -> no table (not a "1 result" wrapper row).
    const empty = runAgentToolWith(async () => state(), undefined, {
      ...appData,
      capacity: async () => ({ ...(await appData.capacity())!, members: [] }),
      progress: async () => ({ ...(await appData.progress())!, issues: [], members: [] }),
      velocity: async () => ({ rows: [], averageDelta: 0 }),
      leave: async () => ({ range: active, leaves: [], holidays: [] }),
    });
    for (const tool of ["get_sprint_capacity", "get_sprint_progress", "get_velocity_history", "get_leave"]) {
      assert.equal(await tableOf(empty, tool), undefined, `${tool} empty -> no table`);
      // Velocity doesn't depend on the active Sprint.
      if (tool !== "get_velocity_history") assert.equal(await tableOf(none, tool), undefined, `${tool} no sprint -> no table`);
    }
  }

  console.log("agent-tool-logic.selfcheck: all assertions passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
