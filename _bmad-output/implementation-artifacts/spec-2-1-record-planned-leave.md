---
title: 'Record Planned Leave'
type: 'feature'
created: '2026-08-17'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** There's no way to record that a Team Member will be away during a Sprint — Capacity computation (Story 2.5) will need this data, and today nothing captures it.

**Approach:** Add a `Leave` model/domain function (generic over Planned/Emergency `type`, since that's intrinsic to the record — Story 2.2 is expected to reuse this unchanged) and a "Log Leave" action on the existing Team Member Detail Panel opening a small, independently-saved Leave Entry form. This story's UI only exposes Planned Leave; the Emergency option is Story 2.2's scope.

## Boundaries & Constraints

**Always:**
- `Leave` Prisma model exactly per the Architecture Spine ERD, with a real relation for integrity (matching the established convention from `TeamMemberAllocation`): `id` (`cuid()`), `teamMemberId` (`String`, `@relation` to `TeamMember`, `onDelete: Cascade`), `type` (`LeaveType` enum: `planned`/`emergency` — the ERD notates this as a plain string, but use an enum matching the established `SprintStatus` convention), `startDate`/`endDate` (`DateTime @db.Date`). No `sprintId` — a Leave entry isn't tied to one Sprint by reference, matching `Holiday`'s same pattern in the ERD; both are evaluated against whichever Sprint's range they overlap at Capacity-computation time (Story 2.5).
- `domain/leave.ts` (new file, new aggregate): `LeaveRepo` port (`listForTeamMember(teamMemberId): Promise<Leave[]>`, `create(data): Promise<Leave>`) and `recordLeave(repo, input: {teamMemberId, type, startDate, endDate})` — same discriminated-result shape as `domain/sprint.ts`. Validate: `teamMemberId` non-empty; `type` is exactly `"planned"` or `"emergency"`; both dates are valid `Date`s; `endDate >= startDate` (inclusive, both ends — a real check here since these are two independently-typed dates, unlike Sprint's computed `endDate`).
- New `infrastructure/db/leave-repository.ts` implementing `LeaveRepo` against Prisma.
- New `app/actions/leave.ts`: `recordLeaveAction(teamMemberId, type, startDate, endDate)`, same type-guarded/try-catch/sanitized-error/`revalidatePath("/roster")` shape as the existing Team Member/Allocation actions.
- Add shadcn's Popover (`npx shadcn@latest add popover`) — no popover primitive exists yet, only `dialog`/`alert-dialog`. New `app/(pm)/roster/leave-entry-form.tsx` (client component): a start-date input, an end-date input, and a Save button that calls `recordLeaveAction` with `type` hardcoded to `"planned"` (no visible Planned/Emergency toggle in this story) and closes the popover on success.
- `app/(pm)/roster/team-member-detail-panel.tsx`: add a "Log Leave" button inside the existing Dialog (below the Allocation section, its own independent action, not bundled into the panel's existing `handleSave`) that opens `LeaveEntryForm` in a Popover anchored to that button — matching EXPERIENCE.md's "saving applies immediately, no review step" pattern for Leave Entry.

**Ask First:** _None known._

**Never:**
- No Emergency Leave toggle/option in this story's UI — `recordLeave`/`recordLeaveAction` accept `type` generically since it's intrinsic to the schema, but the form built here only ever sends `"planned"`. Story 2.2 adds the toggle.
- No `domain/calendar.ts`, no working-day/overlap calculation, no Capacity display or recalculation anywhere in this story — recording a Leave entry is a validated write, nothing more. That logic starts at Story 2.5.
- No Leave list/display in the panel — viewing recorded entries is Story 2.4's own scope (which needs Sprint-scoping this story has no UI hook for yet).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | Valid `teamMemberId`, valid start/end dates (`end >= start`) | Leave recorded | N/A |
| INVALID_DATE_RANGE | `endDate` before `startDate` | Rejected | `{ok:false, error}`, no record created |
| INVALID_DATES | Missing or unparseable start or end date | Rejected | `{ok:false, error}` |
| MISSING_TEAM_MEMBER_ID | Empty/invalid `teamMemberId` | Rejected | `{ok:false, error}` |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` — has `TeamMember`, `AllocationCategory`, `TeamMemberAllocation`, `Sprint`/`SprintStatus`. Add `LeaveType` enum and `Leave` model, following `TeamMemberAllocation`'s `@relation`+`onDelete` pattern (line 62-63) for the `teamMemberId` FK.
- `domain/sprint.ts` — the most recent discriminated-result/repo-as-parameter/self-check pattern to mirror in `domain/leave.ts` (including keeping a persisted `.selfcheck.ts` per that story's precedent, not a throwaway).
- `infrastructure/db/sprint-repository.ts` — the current, simplest repo pattern (no update/delete complexity) to mirror for `leave-repository.ts`'s `create`/`listForTeamMember`.
- `app/actions/sprint.ts` — the Server Action pattern to mirror for `app/actions/leave.ts`.
- `app/(pm)/roster/team-member-detail-panel.tsx` (lines 133-179) — where the new "Log Leave" button/Popover attaches, right after the Allocation section's closing `</div>` (line 179).
- `components/ui/dialog.tsx` — existing shadcn overlay-family component to reference for how project conventions wire a shadcn primitive in; `components/ui/popover.tsx` needs to be added (does not exist yet).

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma` -- add `enum LeaveType { planned emergency }` and `model Leave { id, teamMemberId (+relation), type, startDate, endDate }` -- run `npx prisma migrate dev --name add_leave`.
- [x] `domain/leave.ts` (new) -- `LeaveRepo` port, `recordLeave` (validate teamMemberId/type/dates, `endDate >= startDate`).
- [x] `domain/leave.selfcheck.ts` (new, kept) -- assert-based self-check covering the I/O matrix, same pattern as `domain/sprint.selfcheck.ts`.
- [x] `infrastructure/db/leave-repository.ts` (new) -- `listForTeamMember`, `create`.
- [x] `app/actions/leave.ts` (new) -- `recordLeaveAction`.
- [x] `components/ui/popover.tsx` -- add via `npx shadcn@latest add popover`.
- [x] `app/(pm)/roster/leave-entry-form.tsx` (new) -- start/end date inputs, Save button, `type` hardcoded to `"planned"`.
- [x] `app/(pm)/roster/team-member-detail-panel.tsx` -- add "Log Leave" button + Popover wiring `LeaveEntryForm`, independent of the panel's existing Save.

**Acceptance Criteria:**
- [x] Given a Team Member, when I enter a Planned Leave date range for them, then the entry is recorded (verified by reading it back via `LeaveRepo.listForTeamMember`, since no Capacity display or Leave list exists yet to show it in this story's own UI).
- [x] Given an invalid date range (end before start, or a missing/unparseable date), when I try to save, then the save is rejected with a clear error and no record is created.

## Design Notes

`recordLeave` being generic over `type` from day one (rather than a `recordPlannedLeave`-only function) means Story 2.2 likely needs no domain/infrastructure changes at all — just adding the Emergency option to the form's toggle and wiring it to the same action. This mirrors how `setTeamMemberAllocations` in Epic 1 was designed once and reused unchanged across Stories 1.5/1.6.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: no type errors.
- `npx prisma validate` -- expected: schema valid.
- `npm run lint` -- expected: clean.
- `npx prisma migrate dev --name add_leave` -- expected: migration applies against the live Supabase connection.
- `node domain/leave.selfcheck.ts` -- expected: all assertions pass.
- `npm run dev` + manually: open a Team Member's detail panel, click Log Leave, enter a valid date range and save (popover closes, no error), attempt an invalid range (end before start, rejected with error shown).

**Results (this pass):**

`domain/leave.selfcheck.ts` only exercises `recordLeave` against a fake in-memory repo -- it never touches the real Prisma-backed `leave-repository.ts`, and never exercises `recordLeaveAction`'s own `new Date(startDateRaw)` string-parsing from a real `<input type="date">`-shaped string. Closed that gap with a throwaway script (deleted after, not committed), run via `npx tsx` against the live Supabase DB (plain `node` can't resolve `recordLeaveAction`'s `next/cache` import outside Next's bundler, same constraint hit in the Sprint story's verification pass):

1. Seeded a throwaway Team Member directly via the real `teamMemberRepository.create`.
2. Called the real `recordLeaveAction` (not the domain function directly) with real string args (`startDate: "2026-08-18"`, `endDate: "2026-08-22"`) -- succeeded. Read it back via `leaveRepository.listForTeamMember` and asserted the persisted `startDate`/`endDate` via `getUTCFullYear()/getUTCMonth()/getUTCDate()` -- exact match to what the input strings imply (2026-08-18 / 2026-08-22). This was the exact unverified gap; confirmed clean.
3. Called `recordLeaveAction` again with `endDate` ("2026-08-18") before `startDate` ("2026-08-22") -- rejected (`"End date must be on or after the start date"`), row count unchanged.
4. Called it with an unparseable `startDate` ("not-a-date") and separately an empty-string `endDate` -- both rejected, row count unchanged.
5. Called it with an empty-string `teamMemberId` -- rejected by the action's own type guard (`"Invalid leave submission"`) before reaching the domain function.
6. Cleanup: deleted the seeded Leave row(s) and the seeded Team Member; independently reconfirmed 0 leftover rows for both.

The action's `revalidatePath("/roster")` try/catch also fired as designed (logged an "Invariant: static generation store missing" error, since there's no real Next request context outside the dev server) without failing the result -- exercising that fallback path too, same as the Sprint story precedent.

**Matrix outcome (real DB, this pass):**

| Scenario | Result |
|----------|--------|
| HAPPY_PATH | PASS -- recorded, persisted dates match input strings exactly |
| INVALID_DATE_RANGE | PASS -- rejected, no row created |
| INVALID_DATES | PASS -- rejected (unparseable and empty-string cases), no row created |
| MISSING_TEAM_MEMBER_ID | PASS -- rejected, no row created |

No `npm run dev` manual browser walkthrough was performed this pass (no browser tooling available) -- the real gap named for this pass (the Server Action's string-to-Date parsing against a live DB) was verified directly instead, which is the stronger check for that specific concern.

**Results (2026-08-17 patch pass):**

Applied six confirmed findings from the Blind Hunter / Edge Case Hunter / Verification Gap review layers:

1. `components/ui/popover.tsx` -- `PopoverContent` now uses `glass-strong` (matching `DialogContent`/`AlertDialogContent`'s existing Aurora Light treatment) instead of the shadcn-default `bg-popover`/`shadow-md`/`ring-1 ring-foreground/10`.
2. `app/(pm)/roster/team-member-detail-panel.tsx` -- added `setLeavePopoverOpen(false)` to the outer Dialog's `onOpenChange` `if (next)` reset block, alongside the existing `percents`/`hours`/`error` resets.
3. `prisma/schema.prisma` / `prisma/migrations/20260817112416_add_leave_date_check/migration.sql` -- added `Leave_endDate_check` CHECK constraint (`"endDate" >= "startDate"`), same defense-in-depth pattern as `TeamMember_workingHoursPerDay_check`. Created via `npx prisma migrate dev --name add_leave_date_check --create-only`, hand-edited, then applied with `npx prisma migrate dev`.
4. `domain/leave.ts` -- `recordLeave` now trims `teamMemberId` once after the emptiness check (`const teamMemberId = input.teamMemberId.trim()`) and passes the trimmed value to `repo.create`, instead of persisting the original untrimmed input.
5. `app/(pm)/roster/leave-entry-form.tsx` -- added `required` to both the start-date and end-date `<input type="date">` elements, matching `create-sprint-form.tsx`'s convention.
6. `app/(pm)/roster/leave-entry-form.tsx` -- added a visible "Log Leave" heading at the top of the form (rendered inside the Popover), since the popover previously had no heading/label describing its purpose.

**Re-verification (2026-08-17 patch pass):**

- `npx tsc --noEmit` -- clean, no errors.
- `npx prisma validate` -- `The schema at prisma\schema.prisma is valid`.
- `npm run lint` -- clean.
- `node domain/leave.selfcheck.ts` (via `npx tsx`) -- `leave.selfcheck: all assertions passed`.
- Real-DB check (throwaway script `_verify-leave-check.ts` at repo root, run via `npx tsx -r dotenv/config`, deleted after -- placed at repo root rather than the scratchpad so the `@/*` tsconfig path aliases resolved for `infrastructure/db/*` and `domain/leave` imports):
  1. Seeded a throwaway Team Member via the real `teamMemberRepository.create`.
  2. Called `leaveRepository.create` **directly** (bypassing `recordLeave`'s app-level guard entirely) with `endDate` ("2026-08-18") before `startDate` ("2026-08-22") -- the insert was rejected by the database itself, proving the `Leave_endDate_check` CHECK constraint fires independently of application code, not just the app-level check re-verified in the previous pass.
  3. Called `recordLeave` with a whitespace-padded `teamMemberId` (`"  <id>  "`) -- succeeded, and the persisted row's `teamMemberId` was asserted to equal the trimmed id exactly (no leading/trailing whitespace), confirming the fix in item 4.
  4. Cleanup: deleted the seeded Leave row(s) and Team Member; reconfirmed 0 leftover Leave rows and a `null` lookup for the deleted Team Member.

| Scenario | Result |
|----------|--------|
| DB_CHECK_CONSTRAINT (bypassing app-level guard, direct repo call, endDate < startDate) | PASS -- rejected at the DB level |
| TEAM_MEMBER_ID_TRIMMED (leading/trailing whitespace input) | PASS -- persisted value is trimmed |

All six patch items applied and hold under tsc/prisma validate/lint/self-check/real-DB re-verification.

## Suggested Review Order

**Domain: the generic-over-type function**

- Entry point -- validates, trims the id (patch-pass fix), enforces the inclusive-range check on two independently-typed dates.
  [`leave.ts:35`](../../domain/leave.ts#L35)

**Schema: two-layer date-range enforcement**

- `Leave_endDate_check` -- the DB-level backstop added in the patch pass, same pattern as `TeamMember_workingHoursPerDay_check`; confirmed to fire independently of the app-level check.
  [`migration.sql:2`](../../prisma/migrations/20260817112416_add_leave_date_check/migration.sql#L2)

- The `Leave` model itself -- no `sprintId`, matching `Holiday`'s ERD pattern.
  [`schema.prisma:58`](../../prisma/schema.prisma#L58)

**UI: the independent Log Leave action**

- The Popover's stale-state fix -- `leavePopoverOpen` now resets alongside the panel's other state when the outer Dialog reopens.
  [`team-member-detail-panel.tsx:89`](../../app/(pm)/roster/team-member-detail-panel.tsx#L89)

- `LeaveEntryForm` -- saves independently of the panel's main Save, `type` hardcoded to `"planned"` per this story's scope.
  [`leave-entry-form.tsx:19`](../../app/(pm)/roster/leave-entry-form.tsx#L19)

- The glass-styling fix -- `PopoverContent` now matches `Dialog`/`AlertDialog`'s existing treatment instead of the shadcn default.
  [`popover.tsx:20`](../../components/ui/popover.tsx#L20)

**Peripheral**

- Infrastructure and Server Action -- thin, deliberately unremarkable passthroughs.
  [`leave-repository.ts:4`](../../infrastructure/db/leave-repository.ts#L4)

- The self-check -- covers the full I/O matrix plus the generic-type (`emergency`) case, though only against a fake repo.
  [`leave.selfcheck.ts:36`](../../domain/leave.selfcheck.ts#L36)
</frozen-after-approval>
