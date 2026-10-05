import type { YouTrackConfigRepo } from "@/domain/youtrack";

// Replaces the DB-backed YouTrackConfig table -- these are deploy-time
// values (YOUTRACK_INSTANCE_URL/YOUTRACK_PROJECT_ID/YOUTRACK_AUTH_TOKEN),
// not user-editable via Settings anymore, so `get()` is the only op left.
export const youTrackConfigRepository: YouTrackConfigRepo = {
  async get() {
    const instanceUrl = process.env.YOUTRACK_INSTANCE_URL;
    const projectId = process.env.YOUTRACK_PROJECT_ID;
    const authToken = process.env.YOUTRACK_AUTH_TOKEN;
    if (!instanceUrl || !projectId || !authToken) {
      return null;
    }
    return { instanceUrl, projectId, authToken };
  },
};
