// Thin wiring only (AD-8): parse the request, load the saved MCP config,
// build the read-only tool registry, and hand it all to
// infrastructure/query-assistant/'s generic loop -- this is the one place
// infrastructure/query-assistant/ (generic) and infrastructure/youtrack-mcp/
// (YouTrack-specific) get composed together. Wired only into app/(pm)/ --
// never imported by or reachable from app/share/[token]/ (AD-4).
import { youTrackMcpConfigRepository } from "@/infrastructure/youtrack-mcp/config";
import { callAllowedTool, getReadOnlyToolRegistry } from "@/infrastructure/youtrack-mcp/client";
import {
  runAssistantTurn,
  type AssistantChunk,
  type AssistantMessage,
  type AssistantTool,
} from "@/infrastructure/query-assistant/client";
import { isClientMessage } from "./is-client-message.ts";

const MODEL = "openai/gpt-oss-120b";

// Overall wall-clock bound for the whole request, on top of the fixed
// per-call timeouts already inside runAssistantTurn (Groq) and
// callAllowedTool (MCP) -- belt and suspenders so a pathological run (loop
// cap x each call's own timeout) still can't hang the response indefinitely.
const REQUEST_TIMEOUT_MS = 60_000;

const SYSTEM_PROMPT = [
  "You are a read-only assistant helping a project manager ask questions about their YouTrack project data.",
  "Prefer calling a tool over guessing. Never state a specific figure, count, status, or fact unless a tool call actually returned it.",
  "If no available tool can answer the question, say so plainly instead of inventing an answer.",
  "Keep answers concise and grounded only in the tool results you actually received this turn.",
  "search_issues returns one page of matching issues plus hasNextPage/nextPageOffset -- it has no total-count field.",
  "If asked how many issues match some criteria, page through search_issues using nextPageOffset as the next call's offset, counting issuesPage entries yourself, until hasNextPage is false.",
  "If you run out of tool calls before hasNextPage is false, say the count is incomplete rather than reporting a partial number as the total.",
  "Never paste raw tool-call JSON into your answer -- always summarize results in plain prose or a markdown list.",
  "When listing issues, include each issue's assignee if the tool result includes one; if it doesn't, say the assignee isn't available rather than guessing.",
].join(" ");

function encodeChunk(chunk: AssistantChunk): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(chunk) + "\n");
}

// Single-chunk NDJSON stream -- used for every early-exit failure so the
// client's reader (which always expects NDJSON AssistantChunk lines) never
// has to special-case a different response shape for "never even started"
// vs. "failed mid-turn".
function errorStream(message: string): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encodeChunk({ type: "error", message }));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorStream("Invalid request body.");
  }

  const rawMessages = (body as { messages?: unknown } | null)?.messages;
  // Only "user"/"assistant" are accepted from the client -- it can never
  // smuggle in its own "system" message to override the prompt above. An
  // empty array passes `.every()` vacuously, so it's rejected explicitly --
  // otherwise the model would run with only the system prompt and no
  // actual question.
  if (!Array.isArray(rawMessages) || rawMessages.length === 0 || !rawMessages.every(isClientMessage)) {
    return errorStream("Invalid request body.");
  }
  const clientMessages: AssistantMessage[] = rawMessages;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("Assistant route: GROQ_API_KEY is not set.");
    return errorStream("The assistant isn't configured yet.");
  }

  // NOT_CONFIGURED -- YOUTRACK_MCP_* env vars not set: immediate error, no
  // LLM call made. Wrapped in try/catch so an unexpected failure here also
  // returns the same ndjson error contract as every other failure path,
  // instead of escaping as a raw unhandled framework error.
  let config;
  try {
    config = await youTrackMcpConfigRepository.get();
  } catch (error) {
    console.error("Assistant route: failed to load the YouTrack MCP config:", error);
    return errorStream("Could not check the YouTrack MCP connection. Please try again.");
  }
  if (!config) {
    return errorStream("Set YOUTRACK_MCP_SERVER_URL, YOUTRACK_MCP_PROJECT_ID, and YOUTRACK_MCP_AUTH_TOKEN first.");
  }

  let tools: AssistantTool[];
  try {
    const registry = await getReadOnlyToolRegistry(config);
    tools = registry.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: (tool.inputSchema as Record<string, unknown> | undefined) ?? {},
    }));
  } catch (error) {
    console.error("Assistant route: failed to load the YouTrack MCP tool registry:", error);
    return errorStream(error instanceof Error ? error.message : "Could not reach the YouTrack MCP server.");
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const turn = runAssistantTurn({
        apiKey,
        model: MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...clientMessages],
        tools,
        executeTool: (name, args) => callAllowedTool(config, name, args),
      });

      // Bounds the whole turn's wall-clock time -- if it's still running
      // past the deadline, the client sees a clean error now rather than
      // waiting on whatever's currently in flight.
      const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
      const deadline = new Promise<"timeout">((resolve) => {
        timeoutSignal.addEventListener("abort", () => resolve("timeout"), { once: true });
      });

      try {
        const iterator = turn[Symbol.asyncIterator]();
        while (true) {
          const nextPromise = iterator.next();
          const next = await Promise.race([nextPromise, deadline]);
          if (next === "timeout") {
            // The abandoned iterator.next() call keeps running in the
            // background -- if it later rejects (e.g. the MCP call fails
            // after we've already moved on), swallow it instead of letting
            // it surface as an unhandled promise rejection.
            nextPromise.catch(() => {});
            controller.enqueue(encodeChunk({ type: "error", message: "That took too long -- please try again." }));
            break;
          }
          if (next.done) {
            break;
          }
          controller.enqueue(encodeChunk(next.value));
        }
      } catch (error) {
        console.error("Assistant route: turn failed:", error);
        controller.enqueue(encodeChunk({ type: "error", message: "Something went wrong answering that." }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } });
}
