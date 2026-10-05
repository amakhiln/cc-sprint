import type { YouTrackMcpConfigRepo } from "@/domain/youtrack-mcp";

// Replaces the DB-backed YouTrackMcpConfig table -- these are deploy-time
// values (YOUTRACK_MCP_SERVER_URL/YOUTRACK_MCP_PROJECT_ID/YOUTRACK_MCP_AUTH_TOKEN),
// not user-editable via Settings anymore, so `get()` is the only op left.
export const youTrackMcpConfigRepository: YouTrackMcpConfigRepo = {
  async get() {
    const serverUrl = process.env.YOUTRACK_MCP_SERVER_URL;
    const projectId = process.env.YOUTRACK_MCP_PROJECT_ID;
    const authToken = process.env.YOUTRACK_MCP_AUTH_TOKEN;
    if (!serverUrl || !projectId || !authToken) {
      return null;
    }
    return { serverUrl, projectId, authToken };
  },
};
