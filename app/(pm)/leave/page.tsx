import { CalendarDays } from "lucide-react";
import { holidayRepository } from "@/infrastructure/db/holiday-repository";
import { leaveRepository } from "@/infrastructure/db/leave-repository";
import { sprintRepository } from "@/infrastructure/db/sprint-repository";
import { teamMemberRepository } from "@/infrastructure/db/team-member-repository";
import { rangesOverlap } from "@/domain/calendar";
import type { Leave } from "@/domain/leave";
import { StatusChip } from "@/components/status-chip";
import { initials } from "@/lib/initials";
import { sprintEntryVariant } from "@/lib/sprint-entry-variant";
import { AddHolidayForm } from "./add-holiday-form";

const LEAVE_TYPE_LABEL: Record<Leave["type"], string> = {
  planned: "Planned Leave",
  emergency: "Emergency Leave",
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function formatDate(date: Date): string {
  // Holiday dates are stored as UTC midnight (day-granularity, no
  // time-of-day) -- format in UTC so the displayed day never shifts with
  // the viewer's local timezone.
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Year-less, for rows under a heading that already shows the Sprint's
// dates; a single-day range collapses to one date.
function formatShortRange(start: Date, end: Date): string {
  const fmt = (date: Date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return start.getTime() === end.getTime() ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

// Inclusive day count -- a holiday spanning a single day (start === end) is
// 1 day, matching how Sprint length is counted elsewhere in this app.
function dayCount(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
}

export default async function LeavePage() {
  const [holidays, activeSprint, teamMembers] = await Promise.all([
    holidayRepository.list(),
    sprintRepository.findActive(),
    teamMemberRepository.list(),
  ]);
  const memberName = new Map(teamMembers.map((member) => [member.id, member.name]));
  // Leave overlapping the active Sprint, for current (non-archived) members.
  const sprintLeaves = activeSprint
    ? (await leaveRepository.listForTeamMembers(teamMembers.map((member) => member.id)))
        .filter((leave) => rangesOverlap(leave, activeSprint))
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    : [];

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pt-6 pb-12">
      <div className="mb-8 flex flex-wrap items-center gap-3 border-b border-[color:var(--border-glass)] pb-5">
        <h1
          id="leave-heading"
          tabIndex={-1}
          className="font-heading text-2xl font-medium text-foreground outline-none sm:text-3xl"
        >
          Leave &amp; Holidays
        </h1>
        <span className="rounded-full border border-[color:var(--border-glass)] bg-[color:var(--surface-glass)] px-3 py-1 text-xs font-medium text-muted-foreground">
          {holidays.length} {holidays.length === 1 ? "holiday" : "holidays"}
        </span>
      </div>

      {/* Read-only: Leave is logged per member from the Roster page. */}
      <section className="glass mb-8 p-6 sm:p-8">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-heading text-xl font-medium text-foreground">Leave this Sprint</h2>
          {activeSprint && (
            <p className="text-sm text-muted-foreground">
              {formatDate(activeSprint.startDate)} – {formatDate(activeSprint.endDate)}
            </p>
          )}
        </div>
        {!activeSprint ? (
          <p className="text-muted-foreground">No active Sprint — leave will show here once one starts.</p>
        ) : sprintLeaves.length === 0 ? (
          <p className="text-muted-foreground">
            No leave during this Sprint. Log leave from a member&apos;s row on the Roster page.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sprintLeaves.map((leave) => {
              const name = memberName.get(leave.teamMemberId) ?? "Unknown member";
              const label = LEAVE_TYPE_LABEL[leave.type];
              const days = dayCount(leave.startDate, leave.endDate);
              return (
                <li key={leave.id} className="glass-row flex items-center gap-3 px-4 py-3">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--surface-glass)] text-xs font-medium text-foreground"
                  >
                    {initials(name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-foreground">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatShortRange(leave.startDate, leave.endDate)} · {days} {days === 1 ? "day" : "days"}
                    </p>
                  </div>
                  <StatusChip variant={sprintEntryVariant(label)}>{label}</StatusChip>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Per-person Leave is logged from each member's row on the Roster
          page (Log Leave) -- this page is company-wide Holidays only,
          which reduce capacity for every team member at once. */}
      <section className="glass mb-8 p-6 sm:p-8">
        <h2 className="mb-4 font-heading text-xl font-medium text-foreground">Holidays</h2>
        {holidays.length === 0 ? (
          <p className="text-muted-foreground">
            No holidays yet — add one to reduce capacity for every team member.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {holidays.map((holiday, index) => {
              const days = dayCount(holiday.startDate, holiday.endDate);
              return (
                <li
                  key={holiday.id}
                  className="glass-row motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 flex items-center gap-3 px-4 py-3 duration-500"
                  style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--surface-glass)]"
                  >
                    <CalendarDays className="size-4 text-[color:var(--accent-peach)]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-foreground">
                      {formatDate(holiday.startDate)} – {formatDate(holiday.endDate)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {days} {days === 1 ? "day" : "days"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="glass p-6 sm:p-8">
        <h2 className="mb-4 font-heading text-xl font-medium text-foreground">Add Holiday</h2>
        <AddHolidayForm />
      </div>
    </div>
  );
}
