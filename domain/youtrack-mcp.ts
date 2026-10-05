// Framework-free business logic. Zero imports from @prisma/client, next, or
// infrastructure/ -- see AD-1 in the Architecture Spine.
//
// Independent from domain/youtrack.ts (the REST connection, AD-3) -- this is
// a second, separate connection type for the Query Assistant's read-only MCP
// access (Epic 5). No shared module, no assumption the two projectIds match.

export type YouTrackMcpConfig = {
  serverUrl: string;
  projectId: string;
  authToken: string;
};

// Sourced from env vars (infrastructure/youtrack-mcp/config.ts) -- deploy-time
// config, not user-editable via Settings, so `get` is the only op.
export type YouTrackMcpConfigRepo = {
  get(): Promise<YouTrackMcpConfig | null>;
};
