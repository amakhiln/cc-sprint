"use client";

// Story 4.4's assigned-issues cards, made clickable -- each opens its own
// detail in a side pane instead of only ever showing the trimmed card
// summary. Client-only for the open/selected state; sprint-plan-content.tsx
// (the Server Component parent) still owns all data loading.
import { useState } from "react";
import { Clock, ExternalLink } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { initials } from "@/lib/initials";
import type { SprintPlanAssignedIssue } from "@/app/sprint-plan-data";

export function AssignedIssuesList({
  issues,
  memberColorByName,
}: {
  issues: SprintPlanAssignedIssue[];
  memberColorByName: Record<string, string>;
}) {
  const [selected, setSelected] = useState<SprintPlanAssignedIssue | null>(null);
  const avatarColor = (name: string | null) => (name ? (memberColorByName[name] ?? "var(--ink-muted)") : "var(--ink-muted)");

  return (
    <>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {issues.map((issue, index) => (
          <li
            key={issue.id}
            className="glass-row motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 duration-500"
            style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
          >
            <button
              type="button"
              onClick={() => setSelected(issue)}
              className="flex w-full cursor-pointer flex-col gap-3 rounded-[inherit] px-4 py-3 text-left"
            >
              <p className="truncate text-foreground">{issue.title}</p>
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-heading text-[10px] font-semibold text-white"
                    style={{ background: avatarColor(issue.assigneeName) }}
                  >
                    {initials(issue.assigneeName ?? "?")}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">{issue.assigneeName ?? "Unassigned"}</span>
                </div>
                <span
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1"
                  style={{ background: "rgba(255, 139, 107, 0.14)" }}
                >
                  <Clock aria-hidden="true" className="size-3.5 text-[color:var(--accent-peach)]" />
                  <span className="font-heading text-sm font-semibold tabular-nums text-foreground">
                    {issue.estimateHours.toFixed(1)}h
                  </span>
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent>
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.title}</SheetTitle>
                <SheetDescription>Assigned Backlog Issue details</SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-5 px-4 pb-4">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-heading text-sm font-semibold text-white"
                    style={{ background: avatarColor(selected.assigneeName) }}
                  >
                    {initials(selected.assigneeName ?? "?")}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Assignee</p>
                    <p className="truncate font-heading text-foreground">{selected.assigneeName ?? "Unassigned"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="glass-row px-4 py-3">
                    <p className="text-xs text-muted-foreground">Estimate</p>
                    <p className="font-heading text-xl font-semibold tabular-nums text-foreground">
                      {selected.estimateHours.toFixed(1)}h
                    </p>
                  </div>
                  <div className="glass-row px-4 py-3">
                    <p className="text-xs text-muted-foreground">Logged</p>
                    <p className="font-heading text-xl font-semibold tabular-nums text-foreground">
                      {selected.loggedHours.toFixed(1)}h
                    </p>
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{Math.round(Math.min(100, (selected.loggedHours / Math.max(selected.estimateHours, 0.01)) * 100))}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--surface-glass)]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (selected.loggedHours / Math.max(selected.estimateHours, 0.01)) * 100)}%`,
                        background:
                          selected.loggedHours > selected.estimateHours ? "var(--signal-warning)" : "var(--accent-mint)",
                      }}
                    />
                  </div>
                </div>

                {selected.youtrackUrl && (
                  <a
                    href={selected.youtrackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-full border border-[color:var(--border-glass)] px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-[color:var(--surface-glass)]"
                  >
                    Open in YouTrack
                    <ExternalLink aria-hidden="true" className="size-3.5" />
                  </a>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
