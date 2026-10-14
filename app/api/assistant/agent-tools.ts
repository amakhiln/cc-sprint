// App-local assistant tools (agent mode), bound to the real data sources. The
// logic lives in agent-tool-logic.ts. list/show and the get_* Sprint-figure
// tools are read-only;
// add_issues_to_sprint goes through the picker's own Add path
// (app/actions/assistant-sprint.ts). Nothing ever writes to YouTrack.
// Never imported by app/share/[token]/.
import { listBacklogIssues } from "@/domain/youtrack";
import { youTrackConfigRepository } from "@/infrastructure/youtrack/config";
import { youTrackIssuesAdapter } from "@/infrastructure/youtrack/issues";
import { sprintRepository } from "@/infrastructure/db/sprint-repository";
import { backlogIssueRepository } from "@/infrastructure/db/backlog-issue-repository";
import { addIssuesToActiveSprintAction } from "@/app/actions/assistant-sprint";
import { teamMemberRepository } from "@/infrastructure/db/team-member-repository";
import { leaveRepository } from "@/infrastructure/db/leave-repository";
import { holidayRepository } from "@/infrastructure/db/holiday-repository";
import { rangesOverlap } from "@/domain/calendar";
import { getSprintPlanData } from "@/app/sprint-plan-data";
import { getProgressData } from "@/app/progress-data";
import { getVelocityHistoryData } from "@/app/velocity-history-data";
import { runAgentToolWith, type AppData, type BacklogState, type DateRange, type LeaveData } from "./agent-tool-logic.ts";

// Same query as app/(pm)/leave/page.tsx: current members' leave plus
// holidays overlapping the range; no range -> the active Sprint's dates.
async function loadLeave(requested: DateRange | null): Promise<LeaveData | null> {
  const range = requested ?? (await sprintRepository.findActive());
  if (!range) return null;
  const [teamMembers, holidays] = await Promise.all([teamMemberRepository.list(), holidayRepository.list()]);
  const nameById = new Map(teamMembers.map((member) => [member.id, member.name]));
  const leaves = (await leaveRepository.listForTeamMembers(teamMembers.map((member) => member.id)))
    .filter((leave) => rangesOverlap(leave, range))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  return {
    range: { startDate: range.startDate, endDate: range.endDate },
    leaves: leaves.map((leave) => ({ ...leave, memberName: nameById.get(leave.teamMemberId) ?? "Unknown member" })),
    holidays: holidays.filter((holiday) => rangesOverlap(holiday, range)),
  };
}

const appData: AppData = {
  capacity: getSprintPlanData,
  progress: getProgressData,
  velocity: getVelocityHistoryData,
  leave: loadLeave,
};

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
  return runAgentToolWith(() => (state ??= loadBacklogState()), addIssuesToActiveSprintAction, appData);
}
