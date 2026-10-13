// Run with: node "app/(pm)/assistant/chunk.selfcheck.ts"
import assert from "node:assert/strict";
import { isAssistantChunk } from "./chunk.ts";

assert.ok(isAssistantChunk({ type: "text", delta: "hi" }));
assert.ok(isAssistantChunk({ type: "step", id: "c1", name: "list_backlog_issues", args: {}, status: "running" }));
assert.ok(isAssistantChunk({ type: "step", id: "c1", name: "list_backlog_issues", args: {}, status: "done", summary: "3 issues" }));
assert.ok(!isAssistantChunk({ type: "step", id: "c1", name: "x", args: {}, status: "weird" }));
assert.ok(!isAssistantChunk({ type: "source", label: "x", value: "{}" }), "the old source chunk is gone");
assert.ok(isAssistantChunk({ type: "ui", surface: { surfaceId: "s", messages: [] } }));
assert.ok(isAssistantChunk({ type: "error", message: "nope" }));
assert.ok(!isAssistantChunk({ type: "ui" }), "ui without a surface is dropped");
assert.ok(!isAssistantChunk({ type: "ui", surface: null }));
assert.ok(!isAssistantChunk({ type: "text" }));
assert.ok(!isAssistantChunk({ type: "other" }));
assert.ok(!isAssistantChunk(null));
console.log("chunk.selfcheck: all assertions passed");
