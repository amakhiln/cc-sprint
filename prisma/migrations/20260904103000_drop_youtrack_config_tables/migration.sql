-- YouTrackConfig and YouTrackMcpConfig moved to env vars (YOUTRACK_* /
-- YOUTRACK_MCP_*) -- no more runtime-editable connection settings, so no
-- table to back them.
DROP TABLE "YouTrackConfig";
DROP TABLE "YouTrackMcpConfig";
