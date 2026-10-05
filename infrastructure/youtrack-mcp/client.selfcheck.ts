// Runnable self-check for client.ts's pure, network-free logic: the
// connection-error-message translation and the read-only tool allowlist
// gate. No test framework installed (see AGENTS.md / project conventions) --
// plain assert-based script. Run with: node infrastructure/youtrack-mcp/client.selfcheck.ts
//
// Never touches the real @modelcontextprotocol/client network path -- only
// exercises the exported pure functions directly.

import assert from "node:assert/strict";
import { UnauthorizedError } from "@modelcontextprotocol/client";
import { callAllowedTool, translateConnectionError } from "./client.ts";

async function main() {
  // ERROR_TRANSLATION -- UnauthorizedError maps to the token-rejected
  // message; every other error maps to the generic unreachable message.
  assert.equal(
    translateConnectionError(new UnauthorizedError("401")),
    "The auth token was rejected — check that it's valid and not expired",
    "UnauthorizedError should translate to the token-rejected message",
  );
  assert.equal(
    translateConnectionError(new Error("ECONNREFUSED")),
    "Could not reach the YouTrack MCP server. Check the server URL and try again.",
    "any other error should translate to the generic unreachable message",
  );

  // DISALLOWED_TOOL (Story 5.2) -- callAllowedTool rejects a tool name that
  // isn't in READ_ONLY_TOOL_NAMES before ever attempting to connect. Uses a
  // deliberately unreachable server URL -- if this test ever tried to
  // connect, it would hang/fail on a real network call instead of returning
  // instantly with the allowlist error.
  {
    const config = { serverUrl: "https://example.invalid/mcp", projectId: "DEMO", authToken: "tok" };
    const result = await callAllowedTool(config, "create_issue", {});
    assert.equal(result.ok, false, "a write-capable/unlisted tool name should be rejected");
    assert.ok(!result.ok);
    assert.match(result.error, /not in the read-only allowlist/);
  }

  console.log("client.selfcheck: all assertions passed");
}

main().catch((err) => {
  console.error("client.selfcheck: FAILED");
  console.error(err);
  process.exitCode = 1;
});
