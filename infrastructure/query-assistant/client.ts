// Generic LLM tool-calling loop (Story 5.2 / AD-8). Zero YouTrack/MCP
// imports -- this module only ever sees generic tool defs ({name,
// description?, parameters}) and an injected executor; the one thing it
// knows about the outside world is Groq's OpenAI-compatible chat-completions
// API. app/api/assistant/route.ts is the only caller, and it's the one that
// injects the actual YouTrack MCP tool registry + executor (AD-8: no
// infra->infra import).
import Groq from "groq-sdk";

export type AssistantMessage = { role: "system" | "user" | "assistant"; content: string };

export type AssistantTool = {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
};

export type ToolExecutor = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ ok: true; result: unknown } | { ok: false; error: string }>;

export type AssistantChunk =
  | { type: "text"; delta: string }
  | { type: "source"; label: string; value: string }
  | { type: "error"; message: string };

// Model keeps calling tools without ever finishing -> stop and surface a
// generic error rather than loop forever (bounds the tool-calling loop; the
// overall request is separately bounded by route.ts's AbortSignal.timeout).
const MAX_ITERATIONS = 6;

// Bounds each individual call to Groq -- one real network call this module
// makes, so it gets its own timeout the same way infrastructure/youtrack-mcp
// bounds its own MCP calls.
const REQUEST_TIMEOUT_MS = 30_000;

// One piece of a streamed completion, already flattened out of Groq's
// per-chunk delta shape (a raw chunk can carry content and/or one or more
// partial tool_calls at once -- see mapGroqStreamChunk). `index` on a
// tool-call delta is the position among the tool calls in *this* response,
// not a token index -- the model can call more than one tool in the same
// turn, and each one streams in incrementally across many chunks that share
// that index.
export type StreamEvent =
  | { type: "content"; delta: string }
  | { type: "tool_call_delta"; index: number; id?: string; name?: string; argumentsDelta?: string };

// The only seam this module exposes for client.selfcheck.ts to fake a Groq
// streaming response with no network call: a plain function from
// (model, messages, tools) to an async iterable of StreamEvents.
// runAssistantTurn (the documented public entry point) just plugs the real
// Groq SDK streaming call in here.
export type ChatCompletionFn = (
  model: string,
  messages: Groq.Chat.ChatCompletionMessageParam[],
  tools: Groq.Chat.ChatCompletionTool[] | undefined,
) => AsyncIterable<StreamEvent>;

function toGroqTools(tools: AssistantTool[]): Groq.Chat.ChatCompletionTool[] | undefined {
  if (tools.length === 0) {
    return undefined;
  }
  return tools.map((tool) => ({
    type: "function",
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }));
}

// Exported so client.selfcheck.ts can drive the real loop logic against a
// fake `createCompletion`. runAssistantTurn below is the only entry point
// app/api/assistant/route.ts calls.
export async function* runAssistantTurnWith(
  createCompletion: ChatCompletionFn,
  { model, messages, tools, executeTool }: { model: string; messages: AssistantMessage[]; tools: AssistantTool[]; executeTool: ToolExecutor },
): AsyncGenerator<AssistantChunk> {
  const groqTools = toGroqTools(tools);
  const working: Groq.Chat.ChatCompletionMessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    let content = "";
    const toolCallsByIndex = new Map<number, { id: string; name: string; argumentsJson: string }>();

    try {
      for await (const event of createCompletion(model, working, groqTools)) {
        if (event.type === "content") {
          // Streamed straight to the UI as it arrives -- this is the
          // token-by-token display, not buffered until the turn finishes.
          content += event.delta;
          yield { type: "text", delta: event.delta };
          continue;
        }
        const call = toolCallsByIndex.get(event.index) ?? { id: "", name: "", argumentsJson: "" };
        if (event.id) call.id = event.id;
        if (event.name) call.name += event.name;
        if (event.argumentsDelta) call.argumentsJson += event.argumentsDelta;
        toolCallsByIndex.set(event.index, call);
      }
    } catch (error) {
      console.error("Query Assistant: chat completion request failed:", error);
      yield { type: "error", message: "Couldn't reach the language model. Please try again." };
      return;
    }

    const toolCalls = [...toolCallsByIndex.entries()].sort(([a], [b]) => a - b).map(([, call]) => call);

    if (toolCalls.length === 0) {
      // A "finished" turn with no tool calls and no content is otherwise
      // indistinguishable from a hang in the UI -- surface it explicitly.
      // Any real content was already streamed above, chunk by chunk.
      if (!content) {
        yield { type: "error", message: "The assistant didn't return an answer. Please try rephrasing your question." };
      }
      return;
    }

    working.push({
      role: "assistant",
      content: content || null,
      tool_calls: toolCalls.map((call) => ({
        id: call.id,
        type: "function",
        function: { name: call.name, arguments: call.argumentsJson },
      })),
    });

    for (const call of toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = call.argumentsJson ? JSON.parse(call.argumentsJson) : {};
      } catch {
        // Malformed JSON from the model -- fall through with {} so the real
        // executor rejects it cleanly instead of this loop throwing.
      }

      const result = await executeTool(call.name, args);
      if (!result.ok) {
        // A real tool-call failure (MCP unreachable, timeout, disallowed
        // name) ends the turn immediately -- never fed back to the model as
        // if it were a normal result to reason around (never a silent
        // wrong answer).
        yield { type: "error", message: result.error };
        return;
      }

      yield { type: "source", label: call.name, value: JSON.stringify(result.result) };
      working.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result.result) });
    }
  }

  yield { type: "error", message: "Couldn't answer that after several tool calls -- try rephrasing the question." };
}

// The one piece of real-SDK-shape-to-loop-shape mapping this module does --
// pulled out as its own pure function (rather than left inline in
// runAssistantTurn's closure) so client.selfcheck.ts can exercise it
// directly against realistic fixture ChatCompletionChunk shapes with no fake
// network call needed. A single raw chunk can carry content and/or more than
// one partial tool_calls entry, hence the array result.
export function mapGroqStreamChunk(chunk: Groq.Chat.ChatCompletionChunk): StreamEvent[] {
  const delta = chunk.choices[0]?.delta;
  if (!delta) {
    return [];
  }
  const events: StreamEvent[] = [];
  if (delta.content) {
    events.push({ type: "content", delta: delta.content });
  }
  for (const toolCall of delta.tool_calls ?? []) {
    events.push({
      type: "tool_call_delta",
      index: toolCall.index,
      id: toolCall.id,
      name: toolCall.function?.name,
      argumentsDelta: toolCall.function?.arguments,
    });
  }
  return events;
}

export function runAssistantTurn({
  apiKey,
  model,
  messages,
  tools,
  executeTool,
}: {
  apiKey: string;
  model: string;
  messages: AssistantMessage[];
  tools: AssistantTool[];
  executeTool: ToolExecutor;
}): AsyncGenerator<AssistantChunk> {
  const client = new Groq({ apiKey, timeout: REQUEST_TIMEOUT_MS });

  const createCompletion: ChatCompletionFn = async function* (createModel, createMessages, createTools) {
    const stream = await client.chat.completions.create({
      model: createModel,
      messages: createMessages,
      tools: createTools,
      stream: true,
    });
    for await (const chunk of stream) {
      yield* mapGroqStreamChunk(chunk);
    }
  };

  return runAssistantTurnWith(createCompletion, { model, messages, tools, executeTool });
}
