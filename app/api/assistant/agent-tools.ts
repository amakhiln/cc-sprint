// App-local assistant tools (agent mode), bound to the real data sources. The
// logic lives in agent-tool-logic.ts. list/show are read-only;
// add_issues_to_sprint goes through the picker's own Add path
// (app/actions/assistant-sprint.ts). Nothing ever writes to YouTrack.
// Never imported by app/share/[token]/.
import { listBacklogIssues } from "@/domain/youtrack";
import { youTrackConfigRepository } from "@/infrastructure/youtrack/config";
import { youTrackIssuesAdapter } from "@/infrastructure/youtrack/issues";
import { sprintRepository } from "@/infrastructure/db/sprint-repository";
import { backlogIssueRepository } from "@/infrastructure/db/backlog-issue-repository";
import { addIssuesToActiveSprintAction } from "@/app/actions/assistant-sprint";
import { runAgentToolWith, type BacklogState } from "./agent-tool-logic.ts";

// Shared with the Add-to-sprint Server Action so both apply the exact same
// pullable rule against freshly fetched data.
export async function loadBacklogState(): Promise<BacklogState> {
  const [listing, activeSprint] = await Promise.all([
    listBacklogIssues(youTrackConfigRepository, youTrackIssuesAdapter),
    sprintRepository.findActive(),
  ]);
  if (!listing.ok) return listing;
  const pulled = activeSprint ? await backlogIssueRepository.listForSprint(activeSprint.id) : [];
  return {
    ok: true,
    issues: listing.data,
    rollups: listing.rollups,
    truncated: listing.truncated,
    activeSprint,
    pulledIds: new Set(pulled.map((issue) => issue.youtrackIssueId)),
  };
}

// One executor per assistant turn: the backlog is fetched once and shared by
// every tool call in that turn (list, then picker) instead of once per call.
export function createAgentToolExecutor() {
  let state: Promise<BacklogState> | null = null;
  return runAgentToolWith(() => (state ??= loadBacklogState()), addIssuesToActiveSprintAction);
}
