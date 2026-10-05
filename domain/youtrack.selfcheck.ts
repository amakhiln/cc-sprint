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

  console.log("youtrack.selfcheck: all assertions passed");
}

main().catch((err) => {
  console.error("youtrack.selfcheck: FAILED");
  console.error(err);
  process.exitCode = 1;
});
