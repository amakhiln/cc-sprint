// The Progress page's markup, split from app/(pm)/progress/page.tsx so the
// page file only loads data.
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { ProgressData } from "@/app/progress-data";
import { BurndownChart, type BurndownChartPoint } from "@/components/burndown-chart";
import { StatusChip } from "@/components/status-chip";

// Sprint dates are stored as UTC midnight -- format in UTC so the day never
// shifts with the viewer's timezone. Mirrors app/(pm)/page.tsx's helper.
function formatDate(date: Date, withYear = true): string {
  return date.toLocaleDateString("en-US", {
    ...(withYear ? { year: "numeric" } : {}),
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function hours(value: number): string {
  return `${value.toFixed(1)}h`;
}

function percentDone(logged: number, estimate: number): number {
  return estimate > 0 ? Math.round(Math.min(100, (logged / estimate) * 100)) : 0;
}

// Fill carries state: mint while within estimate, warning once over. The
// overrun chip beside it carries the same state in text, never color alone.
function ProgressBar({ logged, estimate }: { logged: number; estimate: number }) {
  const over = logged > estimate;
  return (
    <div
      className="h-1.5 w-24 overflow-hidden rounded-full bg-[color:var(--surface-glass)]"
      role="img"
      aria-label={`${hours(logged)} logged of ${hours(estimate)} estimated`}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${percentDone(logged, estimate)}%`,
          background: over ? "var(--signal-warning)" : "var(--accent-mint)",
        }}
      />
    </div>
  );
}

function OverrunChip({ overrunHours }: { overrunHours: number }) {
  if (overrunHours <= 0) return null;
  return (
    <StatusChip variant="warning">
      <span className="inline-flex items-center gap-1">
        <AlertTriangle className="size-3" aria-hidden="true" />
        Over by {hours(overrunHours)}
      </span>
    </StatusChip>
  );
}

function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="glass flex flex-col gap-1 p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-heading text-2xl font-semibold text-foreground">{value}</span>
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </div>
  );
}

function toChartPoints(burndown: ProgressData["burndown"]): BurndownChartPoint[] {
  const lastIndex = burndown.length - 1;
  return burndown.map((point, index) => ({
    label: point.isStart ? "Start" : formatDate(point.date, false),
    ideal: point.idealHours,
    remaining: point.remainingHours,
    // Label the start, each Monday, and the last day -- not every day, and
    // not day 1 (it would sit on top of "Start").
    tick: point.isStart || index === lastIndex || (index > 1 && point.date.getUTCDay() === 1),
  }));
}

export function ProgressView({ data }: { data: ProgressData | null }) {
  if (!data) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 pt-6 pb-12">
        <h1 className="mb-6 font-heading text-2xl font-medium text-foreground">Progress</h1>
        <section className="glass p-6 sm:p-8">
          <p className="text-muted-foreground">
            No active Sprint —{" "}
            <Link href="/" className="text-foreground underline-offset-2 hover:underline">
              create one on Sprint Plan
            </Link>{" "}
            to track progress.
          </p>
        </section>
      </div>
    );
  }

  const { sprint, totals, members, issues, loggedAvailable } = data;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pt-6 pb-12">
      <div className="mb-8 flex flex-wrap items-center gap-3 border-b border-[color:var(--border-glass)] pb-5">
        <h1 id="progress-heading" tabIndex={-1} className="font-heading text-2xl font-medium text-foreground outline-none sm:text-3xl">
          Progress
        </h1>
        <span className="rounded-full border border-[color:var(--border-glass)] bg-[color:var(--surface-glass)] px-3 py-1 text-xs font-medium text-muted-foreground">
          {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
        </span>
      </div>

      {!loggedAvailable && (
        <p role="alert" className="glass mb-6 p-4 text-sm text-destructive">
          Couldn&apos;t load logged time from YouTrack, so logged and remaining hours aren&apos;t shown.{" "}
          <Link href="/settings" className="underline underline-offset-2">Check the connection</Link> and reload.
        </p>
      )}

      {issues.length === 0 ? (
        <section className="glass p-6 sm:p-8">
          <p className="text-muted-foreground">
            No issues in this Sprint yet —{" "}
            <Link href="/sprint" className="text-foreground underline-offset-2 hover:underline">
              pull some from the Backlog
            </Link>
            .
          </p>
        </section>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatTile label="Estimated" value={hours(totals.estimateHours)} note={`${totals.issueCount} issues`} />
            <StatTile label="Logged" value={loggedAvailable ? hours(totals.loggedHours) : "—"} />
            <StatTile label="Remaining" value={loggedAvailable ? hours(totals.remainingHours) : "—"} />
            <StatTile
              label="Done"
              value={loggedAvailable ? `${percentDone(totals.loggedHours, totals.estimateHours)}%` : "—"}
              note="logged vs estimated"
            />
            <StatTile
              label="Overrun"
              value={loggedAvailable ? String(totals.overrunIssueCount) : "—"}
              note={loggedAvailable && totals.overrunHours > 0 ? `${hours(totals.overrunHours)} over` : "issues over estimate"}
            />
          </div>

          {loggedAvailable && (
            <section className="glass p-6" aria-labelledby="burndown-heading">
              <h2 id="burndown-heading" className="mb-1 font-heading text-lg font-medium text-foreground">
                Burndown
              </h2>
              <p className="mb-4 text-xs text-muted-foreground">
                Estimated hours left, from time logged in YouTrack during this Sprint.
              </p>
              <BurndownChart points={toChartPoints(data.burndown)} />
            </section>
          )}

          <section className="glass p-6" aria-labelledby="members-heading">
            <h2 id="members-heading" className="mb-4 font-heading text-lg font-medium text-foreground">
              By member
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3 font-medium">Member</th>
                    <th className="pb-3 text-right font-medium">Issues</th>
                    <th className="pb-3 text-right font-medium">Estimated</th>
                    <th className="pb-3 text-right font-medium">Logged</th>
                    <th className="pb-3 text-right font-medium">Remaining</th>
                    <th className="pb-3 pl-6 font-medium">Progress</th>
                    <th className="pb-3 font-medium">Overrun</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.key} className="border-t border-border">
                      <td className="py-3 text-foreground">{member.name}</td>
                      <td className="py-3 text-right text-muted-foreground">{member.issueCount}</td>
                      <td className="py-3 text-right font-heading text-foreground">{hours(member.estimateHours)}</td>
                      <td className="py-3 text-right font-heading text-foreground">
                        {loggedAvailable ? hours(member.loggedHours) : "—"}
                      </td>
                      <td className="py-3 text-right font-heading text-foreground">
                        {loggedAvailable ? hours(member.remainingHours) : "—"}
                      </td>
                      <td className="py-3 pl-6">
                        {loggedAvailable && <ProgressBar logged={member.loggedHours} estimate={member.estimateHours} />}
                      </td>
                      <td className="py-3">
                        {loggedAvailable && member.overrunIssueCount > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {member.overrunIssueCount} {member.overrunIssueCount === 1 ? "issue" : "issues"},{" "}
                            {hours(member.overrunHours)} over
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="glass p-6" aria-labelledby="issues-heading">
            <h2 id="issues-heading" className="mb-4 font-heading text-lg font-medium text-foreground">
              Issues
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3 font-medium">Issue</th>
                    <th className="pb-3 font-medium">Assignee</th>
                    <th className="pb-3 text-right font-medium">Estimated</th>
                    <th className="pb-3 text-right font-medium">Logged</th>
                    <th className="pb-3 text-right font-medium">Remaining</th>
                    <th className="pb-3 pl-6 font-medium">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((issue) => (
                    <tr key={issue.id} className="border-t border-border align-top">
                      <td className="py-3 pr-4">
                        <div className="text-foreground">{issue.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {issue.youtrackUrl ? (
                            <a href={issue.youtrackUrl} target="_blank" rel="noreferrer" className="hover:text-foreground hover:underline">
                              {issue.youtrackIssueId}
                            </a>
                          ) : (
                            issue.youtrackIssueId
                          )}
                        </div>
                      </td>
                      <td className="py-3 whitespace-nowrap text-muted-foreground">{issue.assigneeName ?? "Unassigned"}</td>
                      <td className="py-3 text-right font-heading text-foreground">{hours(issue.estimateHours)}</td>
                      <td className="py-3 text-right font-heading text-foreground">
                        {loggedAvailable ? hours(issue.loggedHours) : "—"}
                      </td>
                      <td className="py-3 text-right font-heading text-foreground">
                        {loggedAvailable ? hours(issue.remainingHours) : "—"}
                      </td>
                      <td className="py-3 pl-6">
                        {loggedAvailable && (
                          <div className="flex flex-col items-start gap-1.5">
                            <ProgressBar logged={issue.loggedHours} estimate={issue.estimateHours} />
                            <OverrunChip overrunHours={issue.overrunHours} />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
