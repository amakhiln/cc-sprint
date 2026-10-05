// Runnable self-check for client.ts's tool-calling loop (Story 5.2). No test
// framework installed (see AGENTS.md / project conventions) -- plain
// assert-based script. Run with:
//   node infrastructure/query-assistant/client.selfcheck.ts
//
// Drives runAssistantTurnWith against a fake `ChatCompletionFn` -- never
// touches the real groq-sdk network path.

import assert from "node:assert/strict";
import {
  mapGroqStreamChunk,
  runAssistantTurnWith,
  type AssistantChunk,
  type ChatCompletionFn,
  type StreamEvent,
  type ToolExecutor,
} from "./client.ts";

async function collect(gen: AsyncGenerator<AssistantChunk>): Promise<AssistantChunk[]> {
  const chunks: AssistantChunk[] = [];
  for await (const chunk of gen) {
    chunks.push(chunk);
  }
  return chunks;
}

// A fake createCompletion that just replays a fixed list of stream events,
// one per call (simulating one real chat-completion request per iteration).
function fakeStream(...responses: StreamEvent[][]): ChatCompletionFn {
  let call = 0;
  return async function* () {
    const events = responses[Math.min(call, responses.length - 1)];
    call += 1;
    for (const event of events) {
      yield event;
    }
  };
}

async function main() {
  // HAPPY_PATH -- the model calls a tool, gets a real result, then answers
  // in plain text streamed as several small deltas (token-by-token). A
  // source chunk marks the tool that backed the answer.
  {
    const createCompletion = fakeStream(
      [{ type: "tool_call_delta", index: 0, id: "call_1", name: "search_issues", argumentsDelta: '{"query":"open bugs"}' }],
      [
        { type: "content", delta: "There are " },
        { type: "content", delta: "3 open bugs." },
      ],
    );
    const executeTool: ToolExecutor = async (name, args) => {
      assert.equal(name, "search_issues");
      assert.deepEqual(args, { query: "open bugs" });
      return { ok: true, result: { count: 3 } };
    };

    const chunks = await collect(
      runAssistantTurnWith(createCompletion, {
        model: "openai/gpt-oss-120b",
        messages: [{ role: "user", content: "How many open bugs are there?" }],
        tools: [{ name: "search_issues", parameters: {} }],
        executeTool,
      }),
    );

    assert.deepEqual(chunks, [
      { type: "source", label: "search_issues", value: JSON.stringify({ count: 3 }) },
      { type: "text", delta: "There are " },
      { type: "text", delta: "3 open bugs." },
    ]);
  }

  // NO_TOOL_ANSWERS -- the model declines without ever calling a tool; no
  // source chunk is emitted, and the streamed text arrives as it comes in.
  {
    const createCompletion = fakeStream([{ type: "content", delta: "I can't answer that from the data I have access to." }]);
    const executeTool: ToolExecutor = async () => {
      throw new Error("executeTool should never be called when the model calls no tool");
    };

    const chunks = await collect(
      runAssistantTurnWith(createCompletion, {
        model: "openai/gpt-oss-120b",
        messages: [{ role: "user", content: "What's the weather?" }],
        tools: [{ name: "search_issues", parameters: {} }],
        executeTool,
      }),
    );

    assert.deepEqual(chunks, [{ type: "text", delta: "I can't answer that from the data I have access to." }]);
  }

  // LOOP_CAP -- the model keeps calling tools forever; the loop stops at the
  // iteration cap with a generic error, never hanging indefinitely.
  {
    let calls = 0;
    const createCompletion: ChatCompletionFn = async function* () {
      calls += 1;
      yield { type: "tool_call_delta", index: 0, id: `call_${calls}`, name: "search_issues", argumentsDelta: "{}" };
    };
    const executeTool: ToolExecutor = async () => ({ ok: true, result: { ok: true } });

    const chunks = await collect(
      runAssistantTurnWith(createCompletion, {
        model: "openai/gpt-oss-120b",
        messages: [{ role: "user", content: "Keep going forever" }],
        tools: [{ name: "search_issues", parameters: {} }],
        executeTool,
      }),
    );

    assert.equal(calls, 6, "should stop calling the completion API at the iteration cap");
    const last = chunks[chunks.length - 1];
    assert.equal(last.type, "error");
    assert.ok(chunks.filter((c) => c.type === "source").length === 6, "one source chunk per successfully-called tool");
  }

  // MCP_UNREACHABLE -- a tool-call failure ends the turn immediately with an
  // error chunk, never fed back to the model as a normal result.
  {
    let completionCalls = 0;
    const createCompletion: ChatCompletionFn = async function* () {
      completionCalls += 1;
      yield { type: "tool_call_delta", index: 0, id: "call_1", name: "search_issues", argumentsDelta: "{}" };
    };
    const executeTool: ToolExecutor = async () => ({ ok: false, error: "Could not reach the YouTrack MCP server." });

    const chunks = await collect(
      runAssistantTurnWith(createCompletion, {
        model: "openai/gpt-oss-120b",
        messages: [{ role: "user", content: "Anything" }],
        tools: [{ name: "search_issues", parameters: {} }],
        executeTool,
      }),
    );

    assert.equal(completionCalls, 1, "should stop after the first failing tool call, not retry");
    assert.deepEqual(chunks, [{ type: "error", message: "Could not reach the YouTrack MCP server." }]);
  }

  // TOOLS_SHAPE -- createCompletion receives the exact
  // {type:"function", function:{name, description, parameters}} shape per
  // AssistantTool.
  {
    let receivedTools: unknown;
    const createCompletion: ChatCompletionFn = async function* (_model, _messages, tools) {
      receivedTools = tools;
      yield { type: "content", delta: "done" };
    };
    await collect(
      runAssistantTurnWith(createCompletion, {
        model: "openai/gpt-oss-120b",
        messages: [{ role: "user", content: "hi" }],
        tools: [{ name: "search_issues", description: "search issues", parameters: { type: "object" } }],
        executeTool: async () => ({ ok: true, result: null }),
      }),
    );
    assert.deepEqual(receivedTools, [
      { type: "function", function: { name: "search_issues", description: "search issues", parameters: { type: "object" } } },
    ]);
  }

  // NO_TOOLS -- an empty tools list is passed through as `undefined`, not
  // `[]` (Groq treats an empty array differently from omitting the field).
  {
    let receivedTools: unknown = "not set";
    const createCompletion: ChatCompletionFn = async function* (_model, _messages, tools) {
      receivedTools = tools;
      yield { type: "content", delta: "done" };
    };
    await collect(
      runAssistantTurnWith(createCompletion, {
        model: "openai/gpt-oss-120b",
        messages: [{ role: "user", content: "hi" }],
        tools: [],
        executeTool: async () => ({ ok: true, result: null }),
      }),
    );
    assert.equal(receivedTools, undefined, "an empty AssistantTool[] should map to tools: undefined, not []");
  }

  // EMPTY_FINAL_ANSWER -- a finished turn (no tool calls) with no streamed
  // content at all yields an explicit error, never nothing (which the UI
  // can't tell apart from a hang).
  {
    const createCompletion: ChatCompletionFn = async function* () {};
    const chunks = await collect(
      runAssistantTurnWith(createCompletion, {
        model: "openai/gpt-oss-120b",
        messages: [{ role: "user", content: "hi" }],
        tools: [],
        executeTool: async () => ({ ok: true, result: null }),
      }),
    );
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].type, "error");
  }

  // MULTI_TOOL_CALL -- two tool calls in the same turn interleave their
  // argument deltas across chunks by index; each still assembles correctly
  // and executes in order.
  {
    let call = 0;
    const createCompletion: ChatCompletionFn = async function* () {
      call += 1;
      if (call > 1) {
        yield { type: "content", delta: "done" };
        return;
      }
      yield { type: "tool_call_delta", index: 0, id: "call_1", name: "search_issues", argumentsDelta: '{"query":' };
      yield { type: "tool_call_delta", index: 1, id: "call_2", name: "get_issue", argumentsDelta: '{"id":' };
      yield { type: "tool_call_delta", index: 0, argumentsDelta: '"bugs"}' };
      yield { type: "tool_call_delta", index: 1, argumentsDelta: '"DEMO-1"}' };
    };
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const executeTool: ToolExecutor = async (name, args) => {
      calls.push({ name, args });
      return { ok: true, result: {} };
    };

    await collect(
      runAssistantTurnWith(createCompletion, {
        model: "openai/gpt-oss-120b",
        messages: [{ role: "user", content: "hi" }],
        tools: [{ name: "search_issues", parameters: {} }, { name: "get_issue", parameters: {} }],
        executeTool,
      }),
    );

    assert.deepEqual(calls, [
      { name: "search_issues", args: { query: "bugs" } },
      { name: "get_issue", args: { id: "DEMO-1" } },
    ]);
  }

  // MAP_GROQ_STREAM_CHUNK -- the real-SDK-shape-to-loop-shape mapping, fed a
  // couple of realistic fixture ChatCompletionChunk shapes.
  {
    const contentChunk = {
      choices: [{ delta: { content: "Hel" } }],
    } as Parameters<typeof mapGroqStreamChunk>[0];
    assert.deepEqual(mapGroqStreamChunk(contentChunk), [{ type: "content", delta: "Hel" }]);

    const toolCallChunk = {
      choices: [
        {
          delta: {
            tool_calls: [{ index: 0, id: "call_1", function: { name: "get_issue", arguments: "" } }],
          },
        },
      ],
    } as Parameters<typeof mapGroqStreamChunk>[0];
    assert.deepEqual(mapGroqStreamChunk(toolCallChunk), [
      { type: "tool_call_delta", index: 0, id: "call_1", name: "get_issue", argumentsDelta: "" },
    ]);

    const emptyChunk = { choices: [{}] } as Parameters<typeof mapGroqStreamChunk>[0];
    assert.deepEqual(mapGroqStreamChunk(emptyChunk), []);
  }

  console.log("query-assistant client.selfcheck: all assertions passed");
}

main().catch((err) => {
  console.error("query-assistant client.selfcheck: FAILED");
  console.error(err);
  process.exitCode = 1;
});
