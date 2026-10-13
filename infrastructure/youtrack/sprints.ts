// REST listing of an agile board's sprints, for the Create Sprint pre-fill.
// Same result-shape and log-don't-leak error pattern as issues.ts.
import type { ListSprintsResult, YouTrackSprintsPort } from "@/domain/youtrack";
import { restGet } from "./rest-client.ts";

const SPRINT_FIELDS = "id,name,start,finish,archived";
// YouTrack's default page size would drop the newest sprints on a busy board.
// ponytail: one page; add $skip paging if a board ever passes this.
const SPRINT_LIMIT = 500;

type RestSprint = { id?: string; name?: string; start?: number | null; finish?: number | null; archived?: boolean };

export const youTrackSprintsAdapter: YouTrackSprintsPort = {
  async listSprints(config, boardId): Promise<ListSprintsResult> {
    try {
      const data = await restGet(
        config.instanceUrl,
        `/api/agiles/${encodeURIComponent(boardId)}/sprints?fields=${encodeURIComponent(SPRINT_FIELDS)}&$top=${SPRINT_LIMIT}`,
        config.authToken,
      );
      if (!Array.isArray(data)) {
        console.error("YouTrack /api/agiles/{id}/sprints returned an unrecognized response shape:", JSON.stringify(data));
        return { ok: false, error: "Couldn't load YouTrack sprints" };
      }
      return {
        ok: true,
        data: (data as RestSprint[])
          .filter((s) => typeof s.id === "string" && s.id !== "")
          .map((s) => ({
            id: s.id as string,
            name: s.name ?? "",
            start: typeof s.start === "number" ? s.start : null,
            finish: typeof s.finish === "number" ? s.finish : null,
            archived: s.archived === true,
          })),
      };
    } catch (error) {
      console.error(`YouTrack listSprints failed for board ${boardId}:`, error);
      return { ok: false, error: "Couldn't load YouTrack sprints" };
    }
  },
};
