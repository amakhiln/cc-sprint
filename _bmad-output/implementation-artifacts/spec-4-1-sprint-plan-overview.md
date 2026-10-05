---
title: 'Sprint Plan Overview'
type: 'feature'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 1
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Everything a PM needs to assess a Sprint plan at a glance — roster, per-person Capacity/Allocation, Leave/Holidays, assigned Backlog Issues, and total planned-vs-available Capacity — is scattered across three separate pages (`/roster`, `/leave`, `/sprint`) built incrementally across Epics 1-3, with no single consolidated view and no real home route (the app still ships Next's placeholder page).

**Approach:** Replace the placeholder `app/page.tsx` with a read-only aggregation view that reuses every domain function and most computations already built (`computeCapacityForTeam`, `computeAllocationBreakdown`, `compareAssignedToCapacity`, `sumEstimateHours`/`sumAssignedHoursByMember`, `scopeEntriesToSprint`) — no new domain logic. `/roster`, `/leave`, and `/sprint` keep their existing editing capabilities unchanged; this new page only reads.

## Boundaries & Constraints

**Always:**
- Rewrite `app/page.tsx` as an async Server Component (no `"use client"` — this page has no interactivity) with sections, in order: Sprint header (or empty state), team-wide Capacity Ledger, Roster (one row per Team Member: name, working hours/day, non-zero category allocation percentages, a per-member `CapacityLedger` with breakdown, and that member's Sprint-scoped Leave/Holiday entries), Assigned Backlog Issues (flat list: title, assignee name or "Unassigned", estimate hours).
- Reuse `CapacityLedger` (with its Story 3.5 `assignedHours`/`overAllocated` props) for both the team-wide figure and each per-member row — this literally *is* "total planned vs. available Capacity" from the AC; do not compute a second, competing figure.
- Reuse `scopeEntriesToSprint` (`domain/calendar.ts`) per member, combining that member's `Leave` rows with the global `Holiday` list exactly as `TeamMemberDetailPanel` already does for Story 2.4 — same merge, same "No leave or holidays this sprint." copy when empty, same `StatusChip variant="warning"` rendering per entry.
- When no active Sprint exists, render an empty state and reuse `CreateSprintForm` (from `app/(pm)/sprint/create-sprint-form.tsx`) inline so a PM can start planning without leaving the page.
- Add `app/error.tsx`, matching the existing per-route `error.tsx` pattern (e.g. `app/(pm)/roster/error.tsx`).
- Update `app/layout.tsx`'s `metadata` (currently the create-next-app placeholder title/description) to name the actual product.

**Ask First:** _None known._

**Never:**
- No editing affordances anywhere on this page — no allocation editor, no add/remove-member form, no leave-entry form, no assignee dropdown. Editing stays on `/roster`, `/leave`, `/sprint`.
- No new "Planned Velocity" concept or stored field — that belongs to Stories 4.2/4.3. This page only surfaces the same live assigned-vs-capacity comparison Story 3.5 already computes.
- No new schema field for a work-item "category" tag — `BacklogIssue` has no such field; show title/assignee/hours only, not the illustrative mockup's category label.
- Do not move, delete, or duplicate `/roster`, `/leave`, or `/sprint`'s own pages or forms.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| ACTIVE_SPRINT_FULL_DATA | Active Sprint, Team Members with allocations/leave, Holidays, assigned Backlog Issues | Every section renders populated: team Ledger, per-member rows with Ledger + Leave/Holiday chips, flat assigned-issues list | N/A |
| NO_ACTIVE_SPRINT | No active Sprint | Empty state message + inline `CreateSprintForm`; no Capacity/issues sections attempted | N/A |
| NO_TEAM_MEMBERS | Active Sprint, zero Team Members | Roster section shows the existing "no team members yet" message (mirroring `/roster`'s copy); other sections still render for whatever issue data exists | N/A |
| NO_DEV_CATEGORY | Active Sprint, Team Members, but no `AllocationCategory` marked `isDev` | Same fallback message already used on `/roster` ("Mark a category as Dev to see Capacity") in place of every Ledger; assigned-issues list still renders (it doesn't depend on Capacity) | N/A |
| MEMBER_NO_LEAVE_OR_HOLIDAY | A member with no Leave rows and no Holiday overlapping the Sprint | "No leave or holidays this sprint." (exact existing copy) | N/A |
| UNASSIGNED_ISSUE_IN_LIST | A pulled Backlog Issue with `assigneeId: null` | Shows "Unassigned" in place of a member name | N/A |
| ZERO_ASSIGNED_ISSUES | Active Sprint, Team Members, but no pulled Backlog Issues | Assigned Backlog Issues section shows an empty-state message, not an empty list | N/A |

</frozen-after-approval>

## Code Map

- `app/page.tsx:1` — the create-next-app placeholder being fully replaced.
- `app/layout.tsx:4-7` — placeholder `metadata` being updated.
- `app/(pm)/roster/page.tsx:36-183` — the exact data-fetching (`teamMemberRepository`, `allocationCategoryRepository`, `teamMemberAllocationRepository`, `leaveRepository`, `holidayRepository`, `sprintRepository`) and Capacity/breakdown computation this page's team-wide and per-member sections mirror; also its `groupBy` helper.
- `app/(pm)/roster/team-member-detail-panel.tsx:87-106` — the `scopeEntriesToSprint` merge-and-render pattern (leave + holidays, `LEAVE_TYPE_LABEL`, empty-state copy) this page's per-member Leave/Holiday block reuses.
- `domain/backlog-issue.ts` — `sumEstimateHours`, `sumAssignedHoursByMember` (Story 3.5).
- `domain/capacity.ts` — `compareAssignedToCapacity`, `computeCapacityForTeam`, `computeAllocationBreakdown`, `sumAllocationBreakdown`.
- `infrastructure/db/backlog-issue-repository.ts` — `listForSprint`, the source for the Assigned Backlog Issues list.
- `app/(pm)/sprint/create-sprint-form.tsx` — reused verbatim for the no-active-Sprint empty state.
- `components/capacity-ledger.tsx`, `components/status-chip.tsx` — reused verbatim, no changes.
- `app/(pm)/roster/error.tsx` — the `error.tsx` pattern `app/error.tsx` mirrors.

## Tasks & Acceptance

**Execution:**
- [ ] `app/page.tsx` -- rewrite as the Sprint Plan Overview (sections per Always clause).
- [ ] `app/error.tsx` -- add, mirroring the existing per-route pattern.
- [ ] `app/layout.tsx` -- update `metadata` title/description.

**Acceptance Criteria:**
- Given an active Sprint with Team Members, allocations, leave/holidays, and assigned issues, when I open the Sprint Plan screen (the app's home route), then I see roster, per-person Capacity and Allocation breakdown, Leave and Holidays, assigned Backlog Issues, and total planned vs. available Capacity all in one view.

## Design Notes

The mockup (`ux-designs/ux-pm-2026-08-12/mockups/key-sprint-plan-overview.html`) shows a sidebar with a selected-member detail panel and per-item "category" tags. Neither is built here: the sidebar-selection interaction isn't required by the AC's plain "see... in one view" wording (every per-member row already shows its own Ledger + breakdown + Leave/Holiday inline, so no selection step is needed to see anything), and the category tag has no backing schema field. Both are visual embellishments beyond this story's scope, not contract gaps.

## Suggested Review Order

**Main surface:**
- [app/page.tsx](../../app/page.tsx) — the rewritten home route.
- [app/error.tsx](../../app/error.tsx), [app/layout.tsx](../../app/layout.tsx) — supporting pieces.

**Cross-page consistency:**
- [app/actions/backlog-issues.ts](../../app/actions/backlog-issues.ts), [app/actions/allocation-categories.ts](../../app/actions/allocation-categories.ts), [app/actions/holiday.ts](../../app/actions/holiday.ts), [app/actions/leave.ts](../../app/actions/leave.ts), [app/actions/sprint.ts](../../app/actions/sprint.ts), [app/actions/team-member-allocations.ts](../../app/actions/team-member-allocations.ts), [app/actions/team-members.ts](../../app/actions/team-members.ts) — the `revalidatePath("/")` additions.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: no type errors.
- `npm run lint` -- expected: clean.
- Real-DB check (synthetic fixtures, cleaned up after): confirm every section renders with real aggregated data end to end.

**Manual checks (if no CLI):**
- Visual check of the empty states (no active Sprint, no team members, no Dev category, zero assigned issues) alongside the full-data path.

### Results (2026-08-19, review_loop_iteration 1)

- `npx tsc --noEmit` — clean (run three times: after the initial page/error/layout changes, after the 7-file `revalidatePath("/")` additions, and after the two review patches below).
- `npm run lint` — clean, same three checkpoints.
- No new domain functions were written; every computation is reused verbatim from Stories 2.4/2.5/2.6/3.5, all already covered by existing selfchecks.
- Real-DB check via disposable routes (synthetic fixtures only, all cleaned up, confirmed zero rows remain): verified the no-active-Sprint empty state; the `NO_DEV_CATEGORY` fallback at both team-wide and per-member level (including against a pre-existing real Team Member, confirming the row-level patch below); the sprint date range under the heading; allocation-percent chips; the Holiday and Planned Leave chips; the full assigned/unassigned/over-allocated issue paths (an unassigned issue shows "Unassigned", an assigned one shows the real member's name, and a deliberately over-capacity assignment shows the "Over-allocated" warning); and the `<title>` metadata update.
- `NO_TEAM_MEMBERS` could not be verified against the real DB (a real Team Member already exists in this environment; removing it would violate the standing no-real-data-in-tests constraint) — logged to `deferred-work.md`. The branch is a direct copy of `/roster`'s already-proven identical ternary.
- Three-layer adversarial review (Blind Hunter, Edge Case Hunter, Verification Gap) — two real findings patched (below); one finding deferred (archived-assignee shows as "Unassigned" — third occurrence of this epic's recurring archived-assignee gap, see `deferred-work.md`); remaining Verification Gap items either closed by the follow-up real-DB check above or logged as accepted, low-value-to-close gaps.

**Patches applied after review:**
- `app/page.tsx`'s per-member Capacity Ledger slot now shows the "Mark a category as Dev to see Capacity" fallback (matching the frozen I/O matrix's "in place of every Ledger" wording) instead of rendering nothing when there's no Dev category (Blind Hunter).
- `app/page.tsx` now shows the active Sprint's formatted date range under the page heading, giving the "Sprint header" section actual Sprint-specific content instead of a static title (Blind Hunter).
