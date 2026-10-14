// Runnable self-check for the pure YouTrack-config domain logic -- no test
// framework installed (see AGENTS.md / project conventions), so this is a
// plain assert-based script. Run with: node domain/youtrack.selfcheck.ts
//
// ponytail: no framework, this is the smallest thing that fails when the
// logic breaks. Add real tests if a runner ever gets installed.
//
// Uses a fake repo and a fake issues port -- never the real
// @modelcontextprotocol/client SDK or a network call.

import assert from "node:assert/strict";
import {
  filterBacklogIssues,
  listBacklogIssues,
  selectableSprints,
  suggestSprintFit,
  type YouTrackSprint,
  type YouTrackConfig,
  type YouTrackConfigRepo,
  type YouTrackIssuesPort,
  type ListOpenIssuesResult,
} from "./youtrack.ts";

function makeFakeRepo(initial: YouTrackConfig | null = null): YouTrackConfigRepo {
  return {
    async get() {
      return initial;
    },
  };
}

function makeFakeIssuesPort(result: ListOpenIssuesResult): YouTrackIssuesPort {
  return {
    async listOpenIssues() { return result; },
    async getLoggedHours() { throw new Error("not used by these tests"); },
    async listSubItems() { throw new Error("not used by these tests"); },
    async listWorkLogs() { throw new Error("not used by these tests"); },
  };
}

async function main() {
  const validConfig = { instanceUrl: "https://youtrack.example.com", projectId: "PROJ", authToken: "tok-123" };

  // NOT_CONFIGURED -- listBacklogIssues never calls the issues port when no
  // config is set (env vars missing).
  {
    const repo = makeFakeRepo(null);
    let portCalled = false;
    const port: YouTrackIssuesPort = {
      async listOpenIssues() {
        portCalled = true;
        return { ok: true, data: [], truncated: false, rollups: {} };
      },
      async getLoggedHours() {
        throw new Error("not used by this test");
      },
      async listSubItems() {
        throw new Error("not used by this test");
      },
      async listWorkLogs() {
        throw new Error("not used by this test");
      },
    };
    const result = await listBacklogIssues(repo, port);
    assert.equal(result.ok, false, "no config should be rejected");
    assert.ok(!result.ok);
    assert.equal(result.error, "YouTrack is not connected yet — set YOUTRACK_INSTANCE_URL, YOUTRACK_PROJECT_ID, and YOUTRACK_AUTH_TOKEN.");
    assert.equal(portCalled, false, "the issues port should never be called with no config");
  }

  // FETCH_FAILS -- a configured connection delegates to the port, and the
  // port's own error is returned verbatim on failure.
  {
    const repo = makeFakeRepo(validConfig);
    const port = makeFakeIssuesPort({ ok: false, error: "Could not load backlog issues from YouTrack. Check your connection in Settings." });
    const result = await listBacklogIssues(repo, port);
    assert.equal(result.ok, false, "a failing port should propagate its error");
    assert.ok(!result.ok);
    assert.equal(result.error, "Could not load backlog issues from YouTrack. Check your connection in Settings.");
  }

  // HAPPY_PATH -- a configured connection with a successful port returns its
  // issues verbatim, including issues with null optional fields.
  {
    const repo = makeFakeRepo(validConfig);
    const issues = [
      { id: "PROJ-1", summary: "Fix login bug", assignee: "ada", priority: "Critical", estimateHours: 4, type: "Bug", state: "Open" },
      { id: "PROJ-2", summary: "Refactor cache layer", assignee: null, priority: null, estimateHours: null, type: null, state: null },
    ];
    const port = makeFakeIssuesPort({ ok: true, data: issues, truncated: false, rollups: {} });
    const result = await listBacklogIssues(repo, port);
    assert.equal(result.ok, true, "a configured connection with a successful port should succeed");
    assert.ok(result.ok);
    assert.deepEqual(result.data, issues, "issues with null optional fields should pass through unchanged");
  }

  // FILTER_BACKLOG -- type is case-insensitive, parents (rollups key) and
  // already-pulled issues are never offered, null and 0 estimates both count
  // as "without", search matches id or summary.
  {
    const mk = (id: string, type: string | null, estimateHours: number | null, summary = `Issue ${id}`) => ({
      id, summary, type, estimateHours, assignee: null, priority: null, state: null,
    });
    const issues = [
      mk("P-1", "Sub-task", 3),
      mk("P-2", "sub-task", null),
      mk("P-3", "Sub-task", 0),
      mk("P-4", "Task", 5, "Login page"),
      mk("P-5", "Sub-task", 2), // parent
      mk("P-6", "Sub-task", 4), // already pulled
    ];
    const rollups = { "P-5": 8 };
    const pulled = new Set(["P-6"]);
    const ids = (f: Parameters<typeof filterBacklogIssues>[3]) =>
      filterBacklogIssues(issues, rollups, pulled, f).map((i) => i.id);

    assert.deepEqual(ids({}), ["P-1", "P-2", "P-3", "P-4"]);
    assert.deepEqual(ids({ type: "SUB-TASK" }), ["P-1", "P-2", "P-3"]);
    assert.deepEqual(ids({ type: "sub-task", estimate: "without" }), ["P-2", "P-3"]);
    assert.deepEqual(ids({ estimate: "with" }), ["P-1", "P-4"]);
    assert.deepEqual(ids({ estimate: "any", search: "login" }), ["P-4"]);
    assert.deepEqual(ids({ search: "p-3" }), ["P-3"]);
    assert.deepEqual(ids({ type: "Epic" }), []);
  }

  // selectableSprints -- live shape: start at 00:00:00.000Z, finish at
  // 23:59:59.999Z the last day. Oct 15..Oct 28 = 14 inclusive days.
  {
    const day = (iso: string) => Date.parse(`${iso}T00:00:00.000Z`);
    const end = (iso: string) => Date.parse(`${iso}T23:59:59.999Z`);
    const sprint = (id: string, start: number | null, finish: number | null, archived = false): YouTrackSprint => ({
      id, name: `Sprint ${id}`, start, finish, archived,
    });
    const today = new Date("2026-10-13T15:00:00Z");
    const result = selectableSprints(
      [
        sprint("23", day("2026-10-29"), end("2026-11-11")),
        sprint("22", day("2026-10-15"), end("2026-10-28")),
        sprint("21", day("2026-10-01"), end("2026-10-12")), // finished yesterday
        sprint("20", day("2026-09-30"), end("2026-10-13")), // finishes today -- counts as over
        sprint("19", day("2026-10-14"), end("2026-10-27")), // already imported
        sprint("18", null, null), // undated
        sprint("17", day("2026-10-14"), null), // no finish
        sprint("16", day("2026-10-14"), end("2026-10-27"), true), // archived
      ],
      ["19"],
      today,
    );
    assert.deepEqual(result.map((s) => s.youtrackSprintId), ["22", "23"], "sorted by start, filtered");
    assert.deepEqual(result[0], { youtrackSprintId: "22", name: "Sprint 22", startDate: "2026-10-15", lengthDays: 14 });
    assert.deepEqual(selectableSprints([], [], today), []);
  }

  // suggestSprintFit -- greedy, deterministic, only estimated issues.
  {
    const issue = (id: string, type: string, priority: string | null, estimateHours: number | null) => ({
      id, summary: id, type, priority, estimateHours, assignee: null, state: null,
    });
    const issues = [
      issue("A-1", "Task", "Normal", 20),
      issue("A-2", "Bug", "Minor", 8),
      issue("A-3", "Task", "Critical", 15),
      issue("A-4", "Bug", null, 30),
      issue("A-5", "Task", "Normal", 20),
      issue("A-6", "Task", "Major", null), // no estimate -> never eligible
      issue("A-7", "Task", "Major", 0),
    ];
    const ids = (fit: ReturnType<typeof suggestSprintFit>) => fit.selected.map((i) => i.id);

    // Priority (Critical > Normal > Minor > none), then largest estimate, then
    // id; A-5/A-2/A-4 skipped once they no longer fit, later ones still tried.
    const fit = suggestSprintFit(issues, 40);
    assert.deepEqual(ids(fit), ["A-3", "A-1"]);
    assert.deepEqual([fit.selectedHours, fit.leftoverHours, fit.smallestEligibleHours], [35, 5, 8]);
    // Skip-and-continue: 43h budget picks the 8h Minor after the 20h A-5 misses.
    assert.deepEqual(ids(suggestSprintFit(issues, 43)), ["A-3", "A-1", "A-2"]);
    // Deterministic regardless of input order.
    assert.deepEqual(ids(suggestSprintFit([...issues].reverse(), 40)), ids(fit));

    // prioritizeTypes first, case-insensitive, then the usual order (Minor before no priority).
    assert.deepEqual(ids(suggestSprintFit(issues, 40, { prioritizeTypes: ["bug"] })), ["A-2", "A-4"]);
    assert.deepEqual(ids(suggestSprintFit(issues, 100, { prioritizeTypes: ["Bug", " "] })), ["A-2", "A-4", "A-3", "A-1", "A-5"]);

    // No room / nothing fits.
    const none = suggestSprintFit(issues, 0);
    assert.deepEqual([none.selected, none.selectedHours, none.smallestEligibleHours], [[], 0, 8]);
    assert.deepEqual(ids(suggestSprintFit(issues, 7)), []);
    assert.equal(suggestSprintFit([issues[5]], 10).smallestEligibleHours, null);
    // Show-stopper ranks ahead of Critical.
    assert.deepEqual(ids(suggestSprintFit([issues[2], issue("S-1", "Task", "Show-stopper", 15)], 15)), ["S-1"]);
    // Float sums don't reject an exact fit.
    assert.equal(suggestSprintFit([issue("F-1", "Task", null, 0.1), issue("F-2", "Task", null, 0.2)], 0.3).selected.length, 2);
  }

  console.log("youtrack.selfcheck: all assertions passed");
}

main().catch((err) => {
  console.error("youtrack.selfcheck: FAILED");
  console.error(err);
  process.exitCode = 1;
});
