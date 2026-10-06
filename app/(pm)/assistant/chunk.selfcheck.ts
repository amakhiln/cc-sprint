// Run with: node "app/(pm)/assistant/chunk.selfcheck.ts"
import assert from "node:assert/strict";
import { isAssistantChunk } from "./chunk.ts";

assert.ok(isAssistantChunk({ type: "text", delta: "hi" }));
assert.ok(isAssistantChunk({ type: "source", label: "list_backlog_issues", value: "{}" }));
assert.ok(isAssistantChunk({ type: "ui", surface: { surfaceId: "s", messages: [] } }));
assert.ok(isAssistantChunk({ type: "error", message: "nope" }));
assert.ok(!isAssistantChunk({ type: "ui" }), "ui without a surface is dropped");
assert.ok(!isAssistantChunk({ type: "ui", surface: null }));
assert.ok(!isAssistantChunk({ type: "text" }));
assert.ok(!isAssistantChunk({ type: "other" }));
assert.ok(!isAssistantChunk(null));
console.log("chunk.selfcheck: all assertions passed");
