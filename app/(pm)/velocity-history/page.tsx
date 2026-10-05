import { sprintRepository } from "@/infrastructure/db/sprint-repository";
import { backlogIssueRepository } from "@/infrastructure/db/backlog-issue-repository";
import { computePlannedVelocityHours, computeVelocityDelta } from "@/domain/velocity";

// Sprint dates are stored as UTC midnight (day-granularity, no time-of-day)
// -- format in UTC so the displayed day never shifts with the viewer's local
// timezone. Mirrors app/(pm)/sprint/page.tsx's identical helper.
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatSignedHours(hours: number): string {
  const sign = hours > 0 ? "+" : "";
  return `${sign}${hours.toFixed(1)}h`;
}

export default async function VelocityHistoryPage() {
  const closedSprints = await sprintRepository.listClosed();
  const rows = await Promise.all(
    closedSprints.map(async (sprint) => {
      const issues = await backlogIssueRepository.listForSprint(sprint.id);
      const plannedVelocityHours = computePlannedVelocityHours(issues);
      // A closed Sprint always has this written by Story 4.2's close flow;
      // the `?? 0` is a type-level fallback (the field is nullable until
      // close), never expected to actually apply to a closed row.
      const actualVelocityHours = sprint.snapshotActualVelocityHours ?? 0;
      return {
        sprint,
        plannedVelocityHours,
        actualVelocityHours,
        delta: computeVelocityDelta(actualVelocityHours, plannedVelocityHours),
      };
    }),
  );

  // Bullet-graph scale: the actual/planned fill and target tick in every
  // row read off the same axis, so a glance down the Trend column compares
  // sprints directly against each other, not just against themselves.
  const maxScale = Math.max(1, ...rows.map((row) => Math.max(row.plannedVelocityHours, row.actualVelocityHours)));
  const averageDelta = rows.length > 0 ? rows.reduce((sum, row) => sum + row.delta, 0) / rows.length : 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pt-6 pb-12">
      <div className="mb-8 flex flex-wrap items-center gap-3 border-b border-[color:var(--border-glass)] pb-5">
        <h1
          id="velocity-history-heading"
          tabIndex={-1}
          className="font-heading text-2xl font-medium text-foreground outline-none sm:text-3xl"
        >
          Velocity History
        </h1>
        <span className="rounded-full border border-[color:var(--border-glass)] bg-[color:var(--surface-glass)] px-3 py-1 text-xs font-medium text-muted-foreground">
          {rows.length} closed {rows.length === 1 ? "sprint" : "sprints"}
        </span>
        {rows.length > 0 && (
          <span
            className="rounded-full border border-[color:var(--border-glass)] bg-[color:var(--surface-glass)] px-3 py-1 text-xs font-medium"
            style={{ color: averageDelta >= 0 ? "var(--accent-mint)" : "var(--signal-warning)" }}
          >
            Avg delta {formatSignedHours(averageDelta)}
          </span>
        )}
      </div>

      <section className="glass p-6 sm:p-8">
        {rows.length === 0 ? (
          <p className="text-muted-foreground">No closed Sprints yet — closed Sprints will appear here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-3 font-medium">Sprint</th>
                  <th className="pb-3 font-medium">Trend</th>
                  <th className="pb-3 text-right font-medium">Planned</th>
                  <th className="pb-3 text-right font-medium">Actual</th>
                  <th className="pb-3 text-right font-medium">Delta</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ sprint, plannedVelocityHours, actualVelocityHours, delta }) => (
                  <tr key={sprint.id} className="border-t border-border">
                    <td className="py-3 whitespace-nowrap text-foreground">
                      {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
                    </td>
                    <td className="py-3 pr-6">
                      <div
                        className="relative h-2 w-32 overflow-hidden rounded-full bg-[color:var(--surface-glass)]"
                        role="img"
                        aria-label={`Actual ${actualVelocityHours.toFixed(1)}h against a planned target of ${plannedVelocityHours.toFixed(1)}h`}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (actualVelocityHours / maxScale) * 100)}%`,
                            background: delta >= 0 ? "var(--accent-mint)" : "var(--signal-warning)",
                          }}
                        />
                        <div
                          aria-hidden="true"
                          className="absolute top-0 h-full w-0.5 bg-[color:var(--ink-primary)]"
                          style={{ left: `${Math.min(100, (plannedVelocityHours / maxScale) * 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3 text-right font-heading text-foreground">{plannedVelocityHours.toFixed(1)}h</td>
                    <td className="py-3 text-right font-heading text-foreground">{actualVelocityHours.toFixed(1)}h</td>
                    <td
                      className="py-3 text-right font-heading font-semibold"
                      style={{ color: delta >= 0 ? "var(--accent-mint)" : "var(--signal-warning)" }}
                    >
                      {formatSignedHours(delta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
