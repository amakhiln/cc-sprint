import Link from "next/link";
import { CalendarRange, ArrowUpRight } from "lucide-react";
import { sprintRepository } from "@/infrastructure/db/sprint-repository";
import { backlogIssueRepository } from "@/infrastructure/db/backlog-issue-repository";
import { teamMemberRepository } from "@/infrastructure/db/team-member-repository";
import { CreateSprintForm } from "./create-sprint-form";
import { BacklogDrawer } from "./backlog-drawer";

function formatDate(date: Date): string {
  // Sprint dates are stored as UTC midnight (day-granularity, no
  // time-of-day) -- format in UTC so the displayed day never shifts with
  // the viewer's local timezone.
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function SprintPage() {
  const [activeSprint, teamMembers] = await Promise.all([
    sprintRepository.findActive(),
    teamMemberRepository.list(),
  ]);
  const pulledIssues = activeSprint
    ? (await backlogIssueRepository.listForSprint(activeSprint.id)).map((issue) => ({
        youtrackIssueId: issue.youtrackIssueId,
        id: issue.id,
        assigneeId: issue.assigneeId,
      }))
    : [];

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pt-6 pb-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[color:var(--border-glass)] pb-5">
        <h1
          id="sprint-heading"
          tabIndex={-1}
          className="font-heading text-2xl font-medium text-foreground outline-none sm:text-3xl"
        >
          Backlog
        </h1>
        {/* Story 3.2 -- browsing only requires a saved YouTrack connection,
            not an active Sprint, so this renders regardless of Sprint state. */}
        <BacklogDrawer
          activeSprintId={activeSprint?.id ?? null}
          pulledIssues={pulledIssues}
          teamMembers={teamMembers.map((member) => ({ id: member.id, name: member.name }))}
        />
      </div>

      {activeSprint ? (
        <section className="glass flex flex-wrap items-center justify-between gap-6 p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--surface-glass)]">
              <CalendarRange className="size-5 text-[color:var(--accent-peach)]" />
            </span>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Sprint active</p>
              <p className="font-heading text-lg text-foreground">
                {formatDate(activeSprint.startDate)} – {formatDate(activeSprint.endDate)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="font-heading text-2xl font-semibold text-foreground">{pulledIssues.length}</p>
              <p className="text-xs text-muted-foreground">Issues pulled</p>
            </div>
            <Link
              href="/"
              className="group inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-[color:var(--surface-glass)] hover:text-foreground"
            >
              Sprint Plan
              <ArrowUpRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </section>
      ) : (
        <section className="glass p-6 sm:p-8">
          <p className="mb-6 text-muted-foreground">
            No active Sprint yet — create one to start planning.
          </p>
          <CreateSprintForm />
        </section>
      )}
    </div>
  );
}
