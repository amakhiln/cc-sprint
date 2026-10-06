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

  console.log("youtrack.selfcheck: all assertions passed");
}

main().catch((err) => {
  console.error("youtrack.selfcheck: FAILED");
  console.error(err);
  process.exitCode = 1;
});
