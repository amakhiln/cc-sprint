import Link from "next/link";
import { ArrowUpRight, CalendarRange } from "lucide-react";
import { getSprintPlanData } from "@/app/sprint-plan-data";
import { SprintPlanContent } from "@/components/sprint-plan-content";
import { shareTokenRepository } from "@/infrastructure/db/share-token-repository";
import { teamMemberRepository } from "@/infrastructure/db/team-member-repository";
import { CreateSprintForm } from "./sprint/create-sprint-form";
import { CloseSprintDialog } from "@/app/close-sprint-dialog";

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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// "Day N of total" against today's UTC calendar date -- matches the
// UTC-midnight, day-granularity semantics the sprint's own start/end
// dates use (see formatDate above). Clamped to the sprint's bounds so a
// server clock skew or an overrun sprint never reads as "Day 0" or
// "Day 17 of 14".
function sprintProgress(startDate: Date, endDate: Date): { day: number; totalDays: number } {
  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;
  const now = new Date();
  const todayUtcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const rawDay = Math.floor((todayUtcMidnight - startDate.getTime()) / MS_PER_DAY) + 1;
  return { day: Math.max(1, Math.min(totalDays, rawDay)), totalDays };
}

export default async function SprintPlanOverviewPage() {
  const [data, shareToken] = await Promise.all([getSprintPlanData(), shareTokenRepository.getOrCreate()]);

  if (!data) {
    const teamMembers = await teamMemberRepository.list();
    return (
      <div className="mx-auto w-full max-w-2xl px-6 pt-6 pb-12">
        <div className="mb-6 flex items-center justify-between gap-4 border-b border-[color:var(--border-glass)] pb-5">
          <h1 id="sprint-plan-heading" tabIndex={-1} className="font-heading text-2xl font-medium text-foreground outline-none">
            Sprint Plan
          </h1>
          <Link
            href={`/share/${shareToken.token}`}
            className="group inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-[color:var(--surface-glass)] hover:text-foreground"
          >
            Team View
            <ArrowUpRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
        {teamMembers.length === 0 && (
          <section className="glass mb-6 p-6 sm:p-8">
            <h2 className="mb-3 font-heading text-lg font-medium text-foreground">Getting started</h2>
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-muted-foreground">
              <li>
                Add your team on <Link href="/roster" className="text-foreground underline-offset-2 hover:underline">Roster</Link>, and mark one Allocation Category as Dev.
              </li>
              <li>
                Optionally connect YouTrack on <Link href="/settings" className="text-foreground underline-offset-2 hover:underline">Settings</Link> to pull real issues later.
              </li>
              <li>Create a Sprint below to start planning.</li>
            </ol>
          </section>
        )}
        <section className="glass p-6 sm:p-8">
          <p className="mb-6 text-muted-foreground">No active Sprint yet — create one to start planning.</p>
          <CreateSprintForm />
        </section>
      </div>
    );
  }

  const { day, totalDays } = sprintProgress(data.activeSprint.startDate, data.activeSprint.endDate);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pt-6 pb-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[color:var(--border-glass)] pb-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1
            id="sprint-plan-heading"
            tabIndex={-1}
            className="font-heading text-2xl font-medium text-foreground outline-none sm:text-3xl"
          >
            Sprint Plan
          </h1>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-glass)] bg-[color:var(--surface-glass)] px-3 py-1 text-xs font-medium text-muted-foreground">
            <CalendarRange className="size-3.5" />
            Day {day} of {totalDays} · {formatDate(data.activeSprint.startDate)} – {formatDate(data.activeSprint.endDate)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/progress"
            className="group inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-[color:var(--surface-glass)] hover:text-foreground"
          >
            Progress
            <ArrowUpRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
          <Link
            href={`/share/${shareToken.token}`}
            className="group inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-[color:var(--surface-glass)] hover:text-foreground"
          >
            Team View
            <ArrowUpRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
          <CloseSprintDialog sprintId={data.activeSprint.id} />
        </div>
      </div>

      <SprintPlanContent data={data} />
    </div>
  );
}
