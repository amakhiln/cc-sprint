// Shared REST plumbing for both client.ts (connection test) and issues.ts
// (issue listing / logged hours) -- this project moved off the YouTrack MCP
// server to YouTrack's own REST API (2026-08-24): no per-call connect/close
// handshake, a fully documented response shape (verified live, see issues.ts's
// header comment), and no artificial page-size ceiling. The
// @modelcontextprotocol/client dependency and infrastructure/youtrack/'s MCP
// approach are otherwise untouched -- kept installed for other integrations.

const REQUEST_TIMEOUT_MS = 10_000;

// Configs saved before this migration hold the YouTrack MCP server's URL
// (e.g. "https://instance.example.com/mcp"), since that's what the
// connection form asked for at the time. Stripping that suffix keeps an
// already-saved connection working without forcing a re-save; a freshly
// saved config is just the plain instance URL already, so this is a no-op
// for those.
export function restBaseUrl(instanceUrl: string): string {
  return instanceUrl.replace(/\/mcp\/?$/, "");
}

export type RestErrorBody = {
  error?: string;
  error_description?: string;
  error_field?: string;
};

export class YouTrackRestError extends Error {
  status: number;
  body: RestErrorBody | null;

  constructor(status: number, body: RestErrorBody | null) {
    super(body?.error_description ?? body?.error ?? `YouTrack REST API returned ${status}`);
    this.status = status;
    this.body = body;
  }
}

// GET against the YouTrack REST API with the standard bearer auth, a
// request timeout (the MCP client enforced one per call; fetch doesn't by
// default), and one place that turns a non-2xx response into a typed error
// instead of every call site re-deriving ok/status handling itself.
export async function restGet(instanceUrl: string, path: string, authToken: string): Promise<unknown> {
  const url = `${restBaseUrl(instanceUrl)}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${authToken}`, Accept: "application/json" },
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new YouTrackRestError(response.status, body as RestErrorBody | null);
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}
