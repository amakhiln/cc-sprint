---
title: 'Compute Sprint Capacity Per-Person and Team Total'
type: 'feature'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Leave/Holiday can be recorded (2.1-2.3) and viewed (2.4), and Allocation %/Working Hours exist (1.5/1.6), but no screen shows a real computed Capacity number — the PM still can't answer "how many hours does this person actually have this Sprint," the product's core value proposition.

**Approach:** Add `domain/calendar.ts` working-day/day-loss helpers and a new `domain/capacity.ts` formula (Sprint working days × Working Hours × Dev Allocation % − distinct working days lost to Leave/Holiday). Render it as a new `CapacityLedger` component: a small per-row instance in each Roster row, plus one team-wide instance (sum of all members) at the top of the Roster page — Sprint Plan Overview (Epic 4) doesn't exist yet, so Roster is the interim home. Depends on `AllocationCategory.isDev` (a separate, already-carved-out prerequisite — see Code Map) to identify the Dev-allocation percent per member.

## Boundaries & Constraints

**Always:**
- `domain/calendar.ts` (extend, not reimplement elsewhere): `isWorkingDay(date): boolean` (Mon–Fri, UTC day-of-week); `countWorkingDays(range): number`; `getDistinctWorkingDaysLost(entries, sprint): number` — clip each entry to its overlap with `sprint` (skip non-overlapping entries), expand the clipped range to individual UTC calendar days, keep only working days, dedupe via a `Set` keyed by day-index (`Math.floor(ms / MS_PER_DAY)`), return the set's size.
- `domain/capacity.ts` (new): `computeTeamMemberCapacityHours({workingHoursPerDay, devPercent, sprint, leaves, holidays}): {capacityHours: number; fullDevHours: number}` — `fullDevHours = sprintWorkingDays * workingHoursPerDay * (devPercent/100)` (the undiminished pool, i.e. the ledger bar's max); `capacityHours = fullDevHours - daysLost * workingHoursPerDay * (devPercent/100)`.
- `components/capacity-ledger.tsx` (new): `CapacityLedger({capacityHours, fullHours, size: "default" | "small"})` — Data Figure headline (1 decimal) + a single Dev-colored fill over a `surface-glass` track at `capacityHours/fullHours` (guard `fullHours === 0` → empty track, never `NaN`). True per-category segments are Story 2.6's job — see Never.
- `app/(pm)/roster/page.tsx`: find `devCategory = allocationCategories.find(c => c.isDev)`. No `devCategory` → advisory "Mark a category as Dev to see Capacity", no ledger. No `activeSprint` → "No active Sprint" (existing tone), no ledger. Otherwise compute each member's `devPercent` from `allocationsByMemberId` (0 if the member has no row for `devCategory.id`), call `domain/capacity.ts` per member (that member's leaves + shared `holidays` + `activeSprint`), render a small `CapacityLedger` per row and one larger `CapacityLedger` at the top summing `capacityHours`/`fullHours` across members.

**Ask First:** _None known._

**Never:**
- No per-category Allocation Breakdown view/segments — Story 2.6's job; this story only computes and displays the single Dev-based headline figure.
- No Sprint Plan Overview page — Epic 4/Story 4.1; the top-of-Roster placement is an explicit interim stand-in, not a preview of that page.
- No live/animated recalculation transition or websocket-style push updates — this figure recomputes on every page load/revalidate like every other figure in the app today; no new live-update mechanism.
- No YouTrack-issue-hours factored into Capacity yet — Epic 3's job.
- No changes to `AllocationCategory`'s schema, the Dev-flag-setting mechanism, or its row UI — that is a separate, already-carved-out prerequisite (see `deferred-work.md`); this spec only *reads* `isDev`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| NO_LEAVE_NO_HOLIDAY | 10-working-day Sprint, 8h/day, 60% Dev, no Leave/Holiday | `capacityHours` = 48 | N/A |
| WORKED_EXAMPLE | Same Sprint/hours/%, 2 Leave days + 1 non-overlapping Holiday day | 14.4 hours deducted → `capacityHours` = 33.6 | N/A |
| OVERLAP_DEDUP | A Leave range includes a Holiday date | that calendar day counts once (3 distinct days lost, not 4) | N/A |
| WEEKEND_SPAN | A Leave range spans a weekend | weekend days excluded entirely from the day-count | N/A |
| TEAM_TOTAL | Every Team Member's Capacity computed | team total = sum of every member's `capacityHours` | N/A |
| NO_DEV_CATEGORY | No `AllocationCategory` has `isDev = true` | Roster shows "Mark a category as Dev to see Capacity", no ledger rendered | N/A |
| NO_ACTIVE_SPRINT | No Sprint active | Roster shows "No active Sprint" in place of the ledger(s) | N/A |

</frozen-after-approval>

## Code Map

- **Prerequisite (separate spec, build first):** `AllocationCategory.isDev` (schema flag), `domain/allocation.ts`'s `setDev`/`setDevAllocationCategory`, and the Roster category row's "Mark as Dev" toggle — carved out to `deferred-work.md` from this spec's first draft. This spec's `page.tsx` code assumes `isDev` already exists on the Prisma model and the domain `AllocationCategory` type.
- `domain/calendar.ts:8` `rangesOverlap`, `:22` `scopeEntriesToSprint` — add `isWorkingDay`/`countWorkingDays`/`getDistinctWorkingDaysLost` here (the epic's one shared home for this logic).
- `domain/capacity.ts` (new) — `computeTeamMemberCapacityHours`, calls `domain/calendar.ts`.
- `app/(pm)/roster/page.tsx:27` `RosterPage`, `:36` batched `Promise.all` — find `devCategory`, compute per-member Capacity, render `CapacityLedger` (team total + per-row).
- `components/status-chip.tsx` — existing pattern for a small reusable DESIGN.md-driven presentational component; `components/capacity-ledger.tsx` follows the same shape.

## Tasks & Acceptance

**Execution:**
- [x] `domain/calendar.ts` -- `isWorkingDay`, `countWorkingDays`, `getDistinctWorkingDaysLost`.
- [x] `domain/calendar.selfcheck.ts` -- extend with the I/O matrix's calendar-level cases (weekend span, overlap dedup).
- [x] `domain/capacity.ts` (new) -- `computeTeamMemberCapacityHours`, `sumCapacityHours` (team total, extracted per AD-1 during the Matrix Test Audit -- see Verification).
- [x] `domain/capacity.selfcheck.ts` (new) -- covers NO_LEAVE_NO_HOLIDAY, WORKED_EXAMPLE, OVERLAP_DEDUP, WEEKEND_SPAN, TEAM_TOTAL.
- [x] `components/capacity-ledger.tsx` (new) -- `CapacityLedger` presentational component.
- [x] `app/(pm)/roster/page.tsx` -- devCategory lookup, per-member Capacity computation, team total via `sumCapacityHours`, empty states, render ledgers.

**Acceptance Criteria:**
- Given the team-wide ledger, when I open the Roster page, then it appears above the team member list, distinct from each row's smaller instance.
- Given a Team Member has 0% allocated to the Dev category (or no row at all), when Capacity is computed, then their `capacityHours` and `fullDevHours` are both 0, rendered without error.

## Design Notes

`fullDevHours` (the ledger bar's max) is the *undiminished* Dev-scoped pool (`sprintWorkingDays × workingHoursPerDay × devPercent/100`), not the member's total Working Hours pool — this matches the Glossary's "Dev-allocated hours" definition and means the bar visually shrinks as Leave/Holiday deduct hours, per EXPERIENCE.md's UJ-2 flow, rather than shrinking against an unrelated 100% baseline.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: no type errors.
- `npm run lint` -- expected: clean.
- `node domain/calendar.selfcheck.ts` -- expected: all assertions pass (including new working-day/day-loss cases).
- `node domain/capacity.selfcheck.ts` -- expected: all assertions pass, including the PRD's worked example (33.6 capacityHours).
- Real-DB check (kept pattern from prior stories): seed a Sprint, a Team Member with a Dev-flagged category at a known %, overlapping Leave/Holiday rows; confirm `computeTeamMemberCapacityHours`'s output against a hand-computed expected value.
- `npm run dev` + manually: confirm the Roster page's team-wide and per-row ledgers show sensible numbers with and without Leave/Holiday recorded; confirm the no-Dev-category and no-active-Sprint empty states.

**Manual checks (if no CLI):**
- Visual check of the `CapacityLedger`'s bar fill and headline figure against DESIGN.md's `capacity-ledger`/`data-figure` tokens (Display face, `surface-glass` track, `rounded.full`).

**Results (2026-08-19 pass):**

- `npx tsc --noEmit`, `npm run lint` -- both clean.
- `node domain/calendar.selfcheck.ts`, `node domain/capacity.selfcheck.ts` -- all assertions passed, including NO_LEAVE_NO_HOLIDAY, WORKED_EXAMPLE (33.6h), OVERLAP_DEDUP, WEEKEND_SPAN, and the 0%-Dev edge case.
- Real-DB + Playwright check (implementer subagent, against the live Supabase DB): drove the actual Roster page through NO_DEV_CATEGORY → toggled a real category's Dev flag → NO_ACTIVE_SPRINT → created a real Sprint → 0%-allocation edge case (both ledgers render `0.0h`, empty track, no error) → 100% allocation (10 working days × 9h/day × 100% = 90.0h, verified by hand on both the team-wide and per-row ledger). Test mutations (allocation %, Dev flag) were reverted through the same UI afterward.
- **Matrix Test Audit gap found and fixed:** TEAM_TOTAL was not actually exercised by an automated test -- the summation was inline `Array.reduce` in `page.tsx`, and the manual check above only had one real (non-archived) Team Member, so summing was never distinguished from a single value. Extracted the summation into `domain/capacity.ts`'s `sumCapacityHours` (per AD-1 -- Capacity math lives in `domain/`, not inlined in a page component) and added a `capacity.selfcheck.ts` case summing two members with distinct figures (48h + 54h = 102h) plus an empty-roster case. `page.tsx` now calls `sumCapacityHours` instead of reducing inline. Re-ran `tsc`/`lint`/self-checks clean after the change.
- **One real side effect left in the live DB, not yet cleaned up:** the Playwright verification pass needed an active Sprint (this app has no close/delete-Sprint UI yet -- Epic 4's job) and created one (Aug 17-30, 2026) that is still `active` in the shared Supabase database. AD-6 allows only one active Sprint at a time, so this should be removed before a real Sprint is created -- flagged to the human rather than deleted unilaterally, since it's a live shared DB.

**Results (2026-08-19 review-patch pass):**

Three-layer adversarial review (Blind Hunter, Edge Case Hunter, Verification Gap) ran against the diff. Patched:

- `app/actions/holiday.ts` / `app/actions/sprint.ts` -- both were missing `revalidatePath("/roster")`, so recording a Holiday or creating a Sprint left Roster's Capacity Ledgers stale until an unrelated navigation revalidated them.
- `components/capacity-ledger.tsx` -- added `role="progressbar"`/`aria-valuenow`/`aria-valuemin`/`aria-valuemax`/`aria-label`, missing from the original fill bar.
- `domain/capacity.ts` -- rounded `capacityHours`/`fullDevHours` to 2 decimals (float drift, e.g. `47.99999999999999`, was previously masked only by `.toFixed(1)` at display time, not fixed at the source).
- **Real verification-gap fix:** the Verification Gap and Blind Hunter layers independently flagged that `page.tsx`'s `devCategory`/allocation join (the wiring between repositories and the Capacity formula) had zero automated coverage -- only a one-off manual Playwright pass exercised it. Extracted the join into `domain/capacity.ts`'s `computeCapacityForTeam` (per AD-1) and added a `capacity.selfcheck.ts` case with two members -- one with a Dev-category allocation row, one without -- confirming the join resolves by `categoryId` correctly rather than coincidentally. `page.tsx` now calls this instead of looping inline.
- Added a `capacity.selfcheck.ts` case for a Sprint with zero working days (a full weekend), exercising `CapacityLedger`'s `fullHours === 0` guard's actual real trigger path, not just a synthetic 0%-Dev case.

Deferred (see `deferred-work.md`): no input validation on `computeTeamMemberCapacityHours`/`computeCapacityForTeam`/`countWorkingDays`/`getDistinctWorkingDaysLost` (unreachable via any real caller today -- every upstream write already validates); no tooltip/click-through explaining *why* Capacity dropped; the `size="small"` ledger variant's exact pixel values aren't in DESIGN.md's tokens.

Rejected as noise: a claimed "dead code" `?? 0` fallback in `page.tsx` (required by TypeScript's `Map.get` return type, not defensive cruft); the `fillPercent` clamp "masking" a hypothetical future over-allocation (that display is explicitly Story 3.5's job); LeaveType (planned/emergency) not being distinguished in the formula (correct per FR-9 as written, just undocumented as a deliberate choice).

Re-ran `npx tsc --noEmit`, `npm run lint`, `node domain/calendar.selfcheck.ts`, `node domain/capacity.selfcheck.ts` -- all clean/passing after patches. Re-verified the refactored join against the live Supabase DB directly (curl against `/roster`'s server-rendered HTML, not Playwright): confirmed both the team-wide and per-row `CapacityLedger` render `90.0h` with `aria-valuenow="100"` for a 10-working-day Sprint, 9h/day, 100% Dev allocation -- matching the hand-computed expectation -- then reverted the fixtures and confirmed zero leftover rows. The leftover test Sprint noted in the prior pass's Results was deleted (user-confirmed) before this pass; zero active Sprints remain in the live DB.

## Suggested Review Order

**Domain: the Capacity formula and its calendar building blocks**

- `computeTeamMemberCapacityHours` -- the core formula: Sprint working days × Working Hours × Dev% − distinct days lost, rounded to avoid float drift.
  [`capacity.ts:21`](../../domain/capacity.ts#L21)

- `computeCapacityForTeam` -- the review-patch extraction: the Roster page's per-member join now lives here, testable independently of the RSC page.
  [`capacity.ts:48`](../../domain/capacity.ts#L48)

- `sumCapacityHours` -- team-wide total, extracted per AD-1 during the Matrix Test Audit so TEAM_TOTAL has real coverage.
  [`capacity.ts:85`](../../domain/capacity.ts#L85)

- `getDistinctWorkingDaysLost` -- the dedup-across-Leave-and-Holiday, weekend-exclusion logic the whole formula depends on.
  [`calendar.ts:40`](../../domain/calendar.ts#L40)

- `isWorkingDay` / `countWorkingDays` -- the Mon-Fri/UTC building blocks `getDistinctWorkingDaysLost` and the Sprint-working-days denominator both call.
  [`calendar.ts:22`](../../domain/calendar.ts#L22)

**UI: rendering the figure**

- `CapacityLedger` -- headline figure + fill bar, with the review-patch `role="progressbar"` accessibility fix.
  [`capacity-ledger.tsx:8`](../../components/capacity-ledger.tsx#L8)

- `RosterPage`'s devCategory lookup and empty-state branching (no Dev category / no active Sprint) plus both ledger placements (team-wide, per-row).
  [`page.tsx:49`](../../app/(pm)/roster/page.tsx#L49)

**Infrastructure: keeping the figure fresh**

- The review-patch `revalidatePath("/roster")` additions -- without these, recording a Holiday or creating a Sprint left Roster's Capacity stale.
  [`holiday.ts:31`](../../app/actions/holiday.ts#L31)
  [`sprint.ts:36`](../../app/actions/sprint.ts#L36)

**Peripheral**

- The self-checks -- cover the I/O matrix (worked example, overlap dedup, weekend span, team total, zero-working-day Sprint) and the review-patch join test.
  [`capacity.selfcheck.ts:1`](../../domain/capacity.selfcheck.ts#L1)
  [`calendar.selfcheck.ts:1`](../../domain/calendar.selfcheck.ts#L1)
