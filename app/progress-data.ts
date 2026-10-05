// Live Sprint progress for app/(pm)/progress/page.tsx -- the pulled issues
// and their estimates come from this app's DB, logged time straight from
// YouTrack's work items on every load (the stored loggedHours column is
// only written at Sprint close, Story 4.2).

import { sprintRepository } from "@/infrastructure/db/sprint-repository";
import { backlogIssueRepository } from "@/infrastructure/db/backlog-issue-repository";
import { teamMemberRepository } from "@/infrastructure/db/team-member-repository";
import { youTrackConfigRepository } from "@/infrastructure/youtrack/config";
import { youTrackIssuesAdapter } from "@/infrastructure/youtrack/issues";
import {
  computeIssueProgress,
  sumLoggedInSprint,
  sumProgress,
  computeBurndown,
  type IssueProgress,
  type ProgressTotals,
  type BurndownPoint,
  type WorkLog,
} from "@/domain/progress";

export type ProgressIssue = IssueProgress & {
  id: string;
  youtrackIssueId: string;
  title: string;
  assigneeId: string | null;
  assigneeName: string | null;
  youtrackUrl: string | null;
};

export type ProgressMember = ProgressTotals & { key: string; name: string };

export type ProgressData = {
  sprint: { startDate: Date; endDate: Date };
  // false when YouTrack isn't configured or the work-item fetch failed --
  // the page shows that instead of rendering every issue as 0h logged.
  loggedAvailable: boolean;
  totals: ProgressTotals;
  members: ProgressMember[];
  issues: ProgressIssue[];
  burndown: BurndownPoint[];
};

const UNASSIGNED_KEY = "__unassigned__";

export async function getProgressData(): Promise<ProgressData | null> {
  const [sprint, teamMembers, config] = await Promise.all([
    sprintRepository.findActive(),
    teamMemberRepository.list(),
    youTrackConfigRepository.get(),
  ]);
  if (!sprint) return null;

  const pulled = await backlogIssueRepository.listForSprint(sprint.id);
  let logs: WorkLog[] | null = null;
  if (config) {
    logs = pulled.length > 0
      ? await youTrackIssuesAdapter.listWorkLogs(config, pulled.map((issue) => issue.youtrackIssueId))
      : [];
  }
  const loggedByIssue = sumLoggedInSprint(logs ?? [], sprint);

  const nameById = new Map(teamMembers.map((member) => [member.id, member.name]));
  // Same trailing-"/mcp" trim as app/sprint-plan-data.ts.
  const youtrackBaseUrl = config?.instanceUrl.replace(/\/mcp\/?$/, "").replace(/\/$/, "") ?? null;

  const issues: ProgressIssue[] = pulled
    .map((issue) => ({
      id: issue.id,
      youtrackIssueId: issue.youtrackIssueId,
      title: issue.title,
      assigneeId: issue.assigneeId,
      assigneeName: issue.assigneeId ? (nameById.get(issue.assigneeId) ?? null) : null,
      youtrackUrl: youtrackBaseUrl ? `${youtrackBaseUrl}/issue/${issue.youtrackIssueId}` : null,
      ...computeIssueProgress(issue.estimateHours, loggedByIssue.get(issue.youtrackIssueId) ?? 0),
    }))
    .sort(
      (a, b) =>
        // Unassigned last, then by member name, then title.
        Number(a.assigneeName === null) - Number(b.assigneeName === null) ||
        (a.assigneeName ?? "").localeCompare(b.assigneeName ?? "") ||
        a.title.localeCompare(b.title),
    );

  const byMember = new Map<string, ProgressIssue[]>();
  for (const issue of issues) {
    const key = issue.assigneeId ?? UNASSIGNED_KEY;
    byMember.set(key, [...(byMember.get(key) ?? []), issue]);
  }
  const members: ProgressMember[] = Array.from(byMember, ([key, memberIssues]) => ({
    key,
    name: key === UNASSIGNED_KEY ? "Unassigned" : (memberIssues[0].assigneeName ?? "Unknown member"),
    ...sumProgress(memberIssues),
  }));

  return {
    sprint: { startDate: sprint.startDate, endDate: sprint.endDate },
    loggedAvailable: logs !== null,
    totals: sumProgress(issues),
    members,
    issues,
    burndown: computeBurndown({ sprint, issues: pulled, logs: logs ?? [], today: new Date() }),
  };
}
