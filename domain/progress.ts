// Framework-free business logic. Zero imports from @prisma/client, next, or
// infrastructure/ -- see AD-1 in the Architecture Spine.
//
// Live Sprint progress: logged / remaining / overrun per issue, per member,
// and a burndown. Logged time comes from YouTrack's dated work items, so the
// burndown is rebuilt from history on every load -- no daily snapshots.

import { isWorkingDay } from "./calendar.ts";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// One YouTrack work item. date is UTC midnight (day granularity), matching
// how Sprint dates are stored throughout this app.
export type WorkLog = { youtrackIssueId: string; date: Date; hours: number };

export type IssueProgress = {
  estimateHours: number;
  loggedHours: number;
  remainingHours: number;
  overrunHours: number;
};

// Remaining never goes below 0 -- the excess is reported as overrun instead.
export function computeIssueProgress(estimateHours: number, loggedHours: number): IssueProgress {
  return {
    estimateHours,
    loggedHours,
    remainingHours: Math.max(estimateHours - loggedHours, 0),
    overrunHours: Math.max(loggedHours - estimateHours, 0),
  };
}

// Only work dated inside the Sprint counts -- time logged on an issue before
// it was pulled into this Sprint belongs to earlier work.
export function sumLoggedInSprint(
  logs: WorkLog[],
  sprint: { startDate: Date; endDate: Date },
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const log of logs) {
    if (log.date < sprint.startDate || log.date > sprint.endDate) continue;
    totals.set(log.youtrackIssueId, (totals.get(log.youtrackIssueId) ?? 0) + log.hours);
  }
  return totals;
}

export type ProgressTotals = IssueProgress & { issueCount: number; overrunIssueCount: number };

export function sumProgress(issues: IssueProgress[]): ProgressTotals {
  return issues.reduce<ProgressTotals>(
    (total, issue) => ({
      estimateHours: total.estimateHours + issue.estimateHours,
      loggedHours: total.loggedHours + issue.loggedHours,
      remainingHours: total.remainingHours + issue.remainingHours,
      overrunHours: total.overrunHours + issue.overrunHours,
      issueCount: total.issueCount + 1,
      overrunIssueCount: total.overrunIssueCount + (issue.overrunHours > 0 ? 1 : 0),
    }),
    { estimateHours: 0, loggedHours: 0, remainingHours: 0, overrunHours: 0, issueCount: 0, overrunIssueCount: 0 },
  );
}

// index 0 is the Sprint's start (nothing logged yet); index N is the end of
// the Sprint's Nth calendar day. remainingHours is null for days after today.
export type BurndownPoint = { date: Date; isStart: boolean; idealHours: number; remainingHours: number | null };

// Ideal steps down evenly across working days only, staying flat over
// weekends. Actual remaining is summed per issue (each clamped at 0), so an
// overrun issue never "pays back" hours for another.
// ponytail: ideal ignores team Holidays/Leave -- factor in Capacity if the
// line needs to reflect who is actually available each day.
export function computeBurndown({
  sprint,
  issues,
  logs,
  today,
}: {
  sprint: { startDate: Date; endDate: Date };
  issues: { youtrackIssueId: string; estimateHours: number }[];
  logs: WorkLog[];
  today: Date;
}): BurndownPoint[] {
  const totalEstimate = issues.reduce((sum, issue) => sum + issue.estimateHours, 0);
  const days: Date[] = [];
  for (let ms = sprint.startDate.getTime(); ms <= sprint.endDate.getTime(); ms += MS_PER_DAY) {
    days.push(new Date(ms));
  }
  const totalWorkingDays = days.filter(isWorkingDay).length;
  const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  const inSprint = logs.filter((log) => log.date >= sprint.startDate && log.date <= sprint.endDate);
  const loggedThrough = new Map<string, number>();
  let logIndex = 0;
  const sortedLogs = [...inSprint].sort((a, b) => a.date.getTime() - b.date.getTime());

  function remainingNow(): number {
    return issues.reduce(
      (sum, issue) => sum + Math.max(issue.estimateHours - (loggedThrough.get(issue.youtrackIssueId) ?? 0), 0),
      0,
    );
  }

  const points: BurndownPoint[] = [
    { date: sprint.startDate, isStart: true, idealHours: totalEstimate, remainingHours: totalEstimate },
  ];
  let workingDaysElapsed = 0;
  for (const day of days) {
    while (logIndex < sortedLogs.length && sortedLogs[logIndex].date.getTime() <= day.getTime()) {
      const log = sortedLogs[logIndex++];
      loggedThrough.set(log.youtrackIssueId, (loggedThrough.get(log.youtrackIssueId) ?? 0) + log.hours);
    }
    if (isWorkingDay(day)) workingDaysElapsed++;
    const idealHours =
      totalWorkingDays > 0 ? totalEstimate * (1 - workingDaysElapsed / totalWorkingDays) : 0;
    points.push({
      date: day,
      isStart: false,
      idealHours: Math.round(idealHours * 100) / 100,
      remainingHours: day.getTime() <= todayMs ? Math.round(remainingNow() * 100) / 100 : null,
    });
  }
  return points;
}
