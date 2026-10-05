// The real YouTrack MCP adapter -- the only module in this feature that
// imports @modelcontextprotocol/client (Story 5.1 / AD-1: domain never talks
// to the SDK directly). Fully separate from infrastructure/youtrack/ (REST,
// AD-3) -- no shared module, no assumption the two projectIds match.
//
// v2 of the MCP TypeScript SDK -- see node_modules/@modelcontextprotocol/client's
// README/type definitions (AGENTS.md: this is not the SDK version your
// training data knows). Key exports confirmed by reading
// node_modules/@modelcontextprotocol/client/dist/index.d.mts directly:
// `Client` (constructor `(clientInfo: {name,version}, options?)`),
// `StreamableHTTPClientTransport` (constructor `(url: URL, opts?: {authProvider?, ...})`),
// `AuthProvider` (`{token(): Promise<string|undefined>}`),
// `client.connect(transport, options?)`, `client.listTools()`,
// `client.callTool(params, options?)`, `client.close()`, `UnauthorizedError`.
import { Client, StreamableHTTPClientTransport, UnauthorizedError, type Tool } from "@modelcontextprotocol/client";
import type { YouTrackMcpConfig } from "@/domain/youtrack-mcp";
import { filterToAllowedTools } from "./tool-allowlist.ts";

const REQUEST_TIMEOUT_MS = 10_000;

function newClient(config: YouTrackMcpConfig): { client: Client; transport: StreamableHTTPClientTransport } {
  const client = new Client({ name: "pm-youtrack-mcp", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(config.serverUrl), {
    authProvider: { token: async () => config.authToken },
  });
  return { client, transport };
}

// client.close() has no timeout of its own -- races it against the same
// bound every other call already gets so a server that never acknowledges
// close can't hang this indefinitely.
function closeWithTimeout(client: Client): Promise<void> {
  return Promise.race([
    client.close().catch(() => {}),
    new Promise<void>((resolve) => setTimeout(resolve, REQUEST_TIMEOUT_MS)),
  ]);
}

// Shared catch-block translation for both test() and getReadOnlyToolRegistry
// -- exported so client.selfcheck.ts can exercise the UnauthorizedError
// mapping without a real network call.
export function translateConnectionError(error: unknown): string {
  if (error instanceof UnauthorizedError) {
    return "The auth token was rejected — check that it's valid and not expired";
  }
  return "Could not reach the YouTrack MCP server. Check the server URL and try again.";
}

// Connects, lists every tool the server advertises, filters it down to the
// fixed read-only allowlist, and closes -- the one place a later story (the
// Query Assistant's tool-calling loop, Story 5.2) gets the tool registry
// it's ever allowed to call. No caller yet this story, but exported, so it
// gets the same clean-failure treatment as test() rather than an unhandled
// throw straight from the SDK.
// The Query Assistant's (Story 5.2) actual execution boundary: re-validates
// the tool name against READ_ONLY_TOOL_NAMES here too, not just wherever the
// tool list was originally built -- a stale or tampered tool list handed to
// the LLM can never reach a write-capable tool through this path. Never
// throws; every failure (disallowed name, connection failure, tool error)
// comes back as {ok:false, error}.
export async function callAllowedTool(
  config: YouTrackMcpConfig,
  name: string,
  args: Record<string, unknown>,
): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  if (filterToAllowedTools([{ name }]).length === 0) {
    return { ok: false, error: `Tool "${name}" is not in the read-only allowlist` };
  }

  let client: Client;
  let transport: StreamableHTTPClientTransport;
  try {
    ({ client, transport } = newClient(config));
  } catch {
    return { ok: false, error: "MCP Server URL must be a valid URL" };
  }

  try {
    await client.connect(transport, { timeout: REQUEST_TIMEOUT_MS });
    const result = await client.callTool({ name, arguments: args }, { timeout: REQUEST_TIMEOUT_MS });

    if (result.isError) {
      console.error(`YouTrack MCP tool call failed (${name}):`, result.content);
      return { ok: false, error: `The "${name}" tool call failed.` };
    }

    return { ok: true, result: result.content };
  } catch (error) {
    if (!(error instanceof UnauthorizedError)) {
      console.error(`callAllowedTool(${name}) failed:`, error);
    }
    return { ok: false, error: translateConnectionError(error) };
  } finally {
    await closeWithTimeout(client);
  }
}

export async function getReadOnlyToolRegistry(config: YouTrackMcpConfig): Promise<Tool[]> {
  let client: Client;
  let transport: StreamableHTTPClientTransport;
  try {
    ({ client, transport } = newClient(config));
  } catch {
    throw new Error("MCP Server URL must be a valid URL");
  }

  try {
    await client.connect(transport, { timeout: REQUEST_TIMEOUT_MS });
    const { tools } = await client.listTools({}, { timeout: REQUEST_TIMEOUT_MS });
    return filterToAllowedTools(tools);
  } catch (error) {
    if (!(error instanceof UnauthorizedError)) {
      console.error("getReadOnlyToolRegistry failed:", error);
    }
    throw new Error(translateConnectionError(error));
  } finally {
    await closeWithTimeout(client);
  }
}
