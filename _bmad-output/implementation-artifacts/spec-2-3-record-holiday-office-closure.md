---
title: 'Record Holiday / Office Closure'
type: 'feature'
created: '2026-08-17'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** There's no way to mark a company-wide Holiday — Capacity computation (Story 2.5) needs this data to reduce every Team Member's hours uniformly, without the PM having to log a Leave entry per person.

**Approach:** Add a `Holiday` model/domain function (new aggregate, no per-person scoping) and a minimal Holiday Manager page at `app/(pm)/leave` — the route the Architecture Spine's Capability Map assigns to "Leave & Holidays" (confirmed with the human over EXPERIENCE.md's conflicting "lives in Settings" framing; no Settings section exists or is being built). A flat list of existing Holidays plus an "Add Holiday" date-range form — no per-holiday removal, since neither this story's AC nor EXPERIENCE.md's Holiday Manager pattern mentions it.

## Boundaries & Constraints

**Always:**
- `Holiday` Prisma model exactly per the Architecture Spine ERD: `id` (`cuid()`), `startDate`/`endDate` (`DateTime @db.Date`). No `teamMemberId`, no `sprintId` — company-wide, evaluated against whichever Sprint's range it overlaps at Capacity-computation time (Story 2.5), same as `Leave`.
- Add the same DB-level defense-in-depth as `Leave`/`Sprint`: a hand-added `CHECK ("endDate" >= "startDate")` constraint via `--create-only` + hand-edit + apply (matching `Leave_endDate_check`'s exact pattern).
- `domain/holiday.ts` (new file, new aggregate): `HolidayRepo` port (`list(): Promise<Holiday[]>`, `create(data): Promise<Holiday>`) and `recordHoliday(repo, input: {startDate, endDate})` — same discriminated-result shape as `domain/leave.ts`. Validate: both dates are valid `Date`s; `endDate >= startDate` (inclusive). Trim is not applicable here (no string id field to trim).
- New `infrastructure/db/holiday-repository.ts` implementing `HolidayRepo` against Prisma.
- New `app/actions/holiday.ts`: `recordHolidayAction(startDate, endDate)`, same type-guarded/try-catch/sanitized-error shape as `app/actions/leave.ts`; `revalidatePath("/leave")` (this new route).
- New route `app/(pm)/leave/page.tsx` (Server Component): heading "Leave & Holidays" (the Architecture Spine's capability name — Story 2.4 will later add Leave-viewing to this same page), a "Holidays" section listing existing holidays (`.glass-row` list items, matching the Roster page's established list styling) each showing its date range, plus an `AddHolidayForm` (start/end date inputs + submit) below the list — mirroring `add-team-member-form.tsx`'s established shape. No navigation links to/from `/roster` or `/sprint` — no nav shell exists anywhere yet in this app; don't introduce one speculatively.

**Ask First:** _None known._

**Never:**
- No removal/edit of a recorded Holiday — not requested by this story's AC or EXPERIENCE.md's Holiday Manager description.
- No `domain/calendar.ts`, no working-day/overlap calculation, no Capacity display or recalculation — recording a Holiday is a validated write, nothing more. That logic starts at Story 2.5.
- No Settings section/route — this story confirmed with the human that Holiday Manager lives at `app/(pm)/leave` per the Architecture Spine, not a separate Settings page EXPERIENCE.md otherwise describes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | Valid start/end dates (`end >= start`) | Holiday recorded, appears in the list | N/A |
| INVALID_DATE_RANGE | `endDate` before `startDate` | Rejected | `{ok:false, error}`, no record created |
| INVALID_DATES | Missing or unparseable start or end date | Rejected | `{ok:false, error}` |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` — has `TeamMember`, `AllocationCategory`, `TeamMemberAllocation`, `Sprint`/`SprintStatus`, `Leave`/`LeaveType`. Add `Holiday`, following `Leave`'s field/CHECK-constraint pattern (no relation needed here, since `Holiday` references nothing).
- `domain/leave.ts` — the current discriminated-result/repo-as-parameter/self-check pattern to mirror in `domain/holiday.ts` (simpler here — no `type`, no `teamMemberId`, no trim concern).
- `infrastructure/db/leave-repository.ts` — the simplest repo pattern to mirror for `holiday-repository.ts`.
- `app/actions/leave.ts` — the Server Action pattern to mirror for `app/actions/holiday.ts`.
- `app/(pm)/roster/page.tsx` and `add-team-member-form.tsx` — the established list+add-form page shape and `.glass`/`font-heading` conventions to mirror for the new `app/(pm)/leave/page.tsx` and `add-holiday-form.tsx`.
- `prisma/migrations/20260817112416_add_leave_date_check/migration.sql` — the exact CHECK-constraint migration pattern to replicate for `Holiday`.

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma` -- add `model Holiday { id, startDate, endDate }` -- run `npx prisma migrate dev --name add_holiday`.
- [x] Add `Holiday_endDate_check` CHECK constraint via `--create-only` + hand-edit + apply, same as `Leave_endDate_check`.
- [x] `domain/holiday.ts` (new) -- `HolidayRepo` port, `recordHoliday` (validate dates, `endDate >= startDate`).
- [x] `domain/holiday.selfcheck.ts` (new, kept) -- assert-based self-check covering the I/O matrix, same pattern as `domain/leave.selfcheck.ts`.
- [x] `infrastructure/db/holiday-repository.ts` (new) -- `list`, `create`.
- [x] `app/actions/holiday.ts` (new) -- `recordHolidayAction`.
- [x] `app/(pm)/leave/page.tsx` (new) -- "Leave & Holidays" heading, Holidays list, `AddHolidayForm`.
- [x] `app/(pm)/leave/add-holiday-form.tsx` (new) -- start/end date inputs, Save button.

**Acceptance Criteria:**
- Given no prior Holidays, when I add one with a valid start/end date range, then it's recorded and appears in the Holidays list without needing to log a Leave entry for any Team Member.
- Given an invalid date range (end before start, or a missing/unparseable date), when I try to save, then the save is rejected with a clear error and no record is created.

## Design Notes

`Holiday` deliberately has no relation to `TeamMember` or `Sprint` — it's evaluated against whichever Sprint's date range it overlaps at Capacity-computation time (Story 2.5), exactly like `Leave`. This keeps both models simple and avoids inventing a join the architecture doesn't call for.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: no type errors.
- `npx prisma validate` -- expected: schema valid.
- `npm run lint` -- expected: clean.
- `npx prisma migrate dev --name add_holiday` -- expected: migration applies against the live Supabase connection.
- `node domain/holiday.selfcheck.ts` -- expected: all assertions pass.
- Real-DB check (kept pattern from prior stories): call `recordHolidayAction`/`holidayRepository` directly against the live DB for the full I/O matrix, plus a direct bypass call confirming the DB CHECK constraint fires independently.
- `npm run dev` + manually: open `/leave`, add a Holiday with a valid range (appears in list), attempt an invalid range (rejected with error shown).

**Results (this pass):**

- `npx tsc --noEmit`, `npx prisma validate`, `npm run lint` — all clean.
- `npx prisma migrate dev --name add_holiday` then the `Holiday_endDate_check` CHECK constraint (`--create-only` + hand-edit + apply, same as `Leave_endDate_check`) — both applied against the live Supabase connection.
- `node domain/holiday.selfcheck.ts` — all assertions passed.
- Real-DB check: since `app/actions/holiday.ts` imports `next/cache`, plain `node` can't run it directly (path aliases and `next/cache` only resolve inside the Next runtime) — exercised through a temporary API route (`app/api/holidaycheck123/route.ts`, deleted after use) instead. Confirmed against the live DB: HAPPY_PATH recorded and appeared in `list()`; INVALID_DATE_RANGE and INVALID_DATES both rejected with no record created; a raw Prisma bypass call (skipping `recordHoliday`'s app-level check entirely) confirmed `Holiday_endDate_check` fires independently at the DB level. Ran twice to confirm cleanup left the table empty both times.
- `npm run dev` + fetched `/leave` directly (curl-equivalent, no browser tooling available) — confirmed the heading, empty-state copy, and "Add Holiday" form render with no server error. Full interactive click-through not performed.
- Temporary artifacts cleaned up: deleted the temp API route and the now-empty `app/api` directory; only dev-server processes started for this pass were stopped (verified before killing, to avoid touching the separate pre-existing dev server already running on this machine).

**Results (2026-08-17 -- post-review fixes):**

Applied three confirmed patch findings from code review:
- `infrastructure/db/holiday-repository.ts` -- `list()` now passes `{ orderBy: { startDate: "asc" } }` to `findMany`, so holidays render chronologically instead of insertion order.
- `app/(pm)/leave/error.tsx` (new) -- route-segment error boundary, copied exactly from `app/(pm)/sprint/error.tsx`'s shape/pattern (generic retry button, same `.glass`-page/token styling, heading swapped to "Leave").
- `app/(pm)/leave/add-holiday-form.tsx` -- (a) both date inputs' `onChange` now also call `setError(null)`, clearing a stale error once the user edits a date after a failed submit; (b) `handleSubmit`'s `startTransition` callback now wraps the `recordHolidayAction` call in try/catch, matching `app/(pm)/roster/leave-entry-form.tsx` and `app/(pm)/sprint/create-sprint-form.tsx` exactly -- catch sets `"Something went wrong. Please try again."`.

Re-verification:
- `npx tsc --noEmit`, `npx prisma validate`, `npm run lint` -- all clean.
- `node domain/holiday.selfcheck.ts` -- all assertions passed (unaffected by these changes, re-run for completeness).
- New real-DB check closing the populated-list coverage gap: prior passes only ever fetched `/leave` while the Holidays table was empty. Re-created the same temporary API route (`app/api/holidaycheck123/route.ts`, deleted after use) with `?action=seed` (creates one Holiday via `holidayRepository.create`, dates 2026-12-25/26) and `?action=cleanup&id=...` (deletes it, returns remaining count). Started a scoped `npm run dev` (confirmed its PID/start-time before touching it, left the separate pre-existing dev server on port 3001 alone), seeded one Holiday, then fetched `/leave`: the response HTML contained `<li class="glass-row ..."><span class="text-foreground">Dec 25, 2026<!-- --> – <!-- -->Dec 26, 2026</span></li>` -- confirming `holidays.map(...)` in `page.tsx` renders and formats a real row correctly, not just the empty state. Also incidentally confirmed via the RSC payload that the new `(pm)/leave/error.tsx` boundary is wired into the route tree. Cleaned up: deleted the seeded row (`remaining: 0` confirmed), deleted the temp route and the now-empty `app/api` directory, stopped only the dev server started for this pass.

## Suggested Review Order

**Domain: the simplest aggregate yet**

- Entry point -- no `type`, no `teamMemberId`, no trim concern; just date validation and the inclusive-range check.
  [`holiday.ts:24`](../../domain/holiday.ts#L24)

**Schema: same two-layer pattern as Leave**

- `Holiday_endDate_check` -- the DB-level backstop, identical pattern to `Leave_endDate_check`.
  [`migration.sql:2`](../../prisma/migrations/20260817115214_add_holiday_date_check/migration.sql#L2)

- The `Holiday` model -- no relations at all, company-wide by design.
  [`schema.prisma:74`](../../prisma/schema.prisma#L74)

**Infrastructure**

- `list()` -- patch-pass fix added chronological ordering.
  [`holiday-repository.ts:5`](../../infrastructure/db/holiday-repository.ts#L5)

**UI: the new route**

- The page -- confirmed via the patch pass to render both the empty state and a populated list correctly.
  [`page.tsx:16`](../../app/(pm)/leave/page.tsx#L16)

- `AddHolidayForm` -- a real `<form onSubmit>` (unlike the Leave Entry popover), now with the same try/catch and stale-error-clearing patches applied elsewhere this session.
  [`add-holiday-form.tsx:12`](../../app/(pm)/leave/add-holiday-form.tsx#L12)

- The new error boundary, mirroring `/sprint`'s.
  [`error.tsx:1`](../../app/(pm)/leave/error.tsx#L1)

**Peripheral**

- The self-check -- covers the full I/O matrix against a fake repo.
  [`holiday.selfcheck.ts:34`](../../domain/holiday.selfcheck.ts#L34)
