---
title: 'Over-Allocation Warning'
type: 'feature'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 1
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 3.4 lets the PM assign real YouTrack issue hours to Team Members, but nothing compares those assigned hours against the Capacity Epic 2 already computes — a PM can over-commit a person or the whole team with no visible signal until it's too late.

**Approach:** Add pure comparison functions (assigned-hours-vs-capacity, per member and team-wide) and extend the existing `CapacityLedger` — already showing Capacity on the Roster page (Stories 2.5/2.6), the same "affected Team Member's row" and "team-wide capacity display" EXPERIENCE.md names for this warning — with an assigned-hours figure and an advisory `StatusChip` when assigned exceeds Capacity. No new page; no blocking of any action, per the AC's own explicit "advisory only" requirement.

## Boundaries & Constraints

**Always:**
- `domain/backlog-issue.ts` (extend): `sumEstimateHours(issues): number` (every pulled issue's `estimateHours`, regardless of assignee — the team's total planned work); `sumAssignedHoursByMember(issues): Map<string, number>` (only issues with a non-null `assigneeId`, keyed by it).
- `domain/capacity.ts` (extend): `compareAssignedToCapacity(assignedHours, capacityHours): {assignedHours, capacityHours, overAllocated: boolean}` — `overAllocated` is `assignedHours > capacityHours`. One shared comparison, never reimplemented per call site (matches AD-1's existing rule for Capacity math).
- `components/capacity-ledger.tsx` (extend): new optional props `assignedHours?: number` and `overAllocated?: boolean`. When `assignedHours` is provided, render it ("Assigned: Xh") alongside the existing headline/bar; when `overAllocated` is also true, additionally render `<StatusChip variant="warning">Over-allocated</StatusChip>` next to it. Omitting `assignedHours` renders exactly as before (no new UI for callers that don't pass it).
- `app/(pm)/roster/page.tsx`: when `devCategory && activeSprint` (the same existing gate the Capacity Ledgers already use), also fetch `backlogIssueRepository.listForSprint(activeSprint.id)`, compute team and per-member assigned-hours-vs-capacity via the new domain functions, and pass `assignedHours`/`overAllocated` into both the team-wide and every per-row `CapacityLedger`.
- `app/actions/backlog-issues.ts`: both `pullBacklogIssueAction` and `assignBacklogIssueAction` also `revalidatePath("/roster")` alongside their existing `revalidatePath("/sprint")` — Roster's Capacity Ledgers now depend on `BacklogIssue` data for the first time, the same cross-page revalidation gap already caught and fixed for Holiday/Sprint actions during Story 2.5's review.

**Ask First:** _None known._

**Never:**
- No blocking of assigning issues, pulling issues, or any other action anywhere — the warning is purely advisory, per the AC's own explicit second scenario.
- No new page or route — reuses the existing Roster page's Capacity Ledgers exactly as EXPERIENCE.md names them ("the affected Team Member's row," "the team-wide capacity display").
- No changes to `domain/backlog-issue.ts`'s existing `pullBacklogIssue`/`assignBacklogIssue` functions or their signatures — this story only adds new, independent read/aggregate functions.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| OVER_ALLOCATED_MEMBER | A member's assigned issue hours exceed their computed Capacity | `overAllocated: true`; the Roster row shows the warning chip | N/A |
| WITHIN_CAPACITY | A member's assigned hours are at or below Capacity | `overAllocated: false`; no chip shown | N/A |
| OVER_ALLOCATED_TEAM | Total planned issue hours (all pulled issues, assigned or not) exceed team Capacity | The team-wide Ledger shows the warning chip | N/A |
| UNASSIGNED_ISSUE_COUNTS_FOR_TEAM_NOT_MEMBER | A pulled issue has no assignee | Its hours count toward the team-wide total but toward no individual member's assigned hours | N/A |
| NOTHING_BLOCKED | Any of the above, at any assigned-hours level | Pulling, assigning, and every other existing action remain fully usable | N/A |

</frozen-after-approval>

## Code Map

- `domain/capacity.ts:85` `sumCapacityHours` — the existing aggregate-function shape `compareAssignedToCapacity` mirrors.
- `domain/backlog-issue.ts` — add the two new sum functions near the existing `pullBacklogIssue`/`assignBacklogIssue` (same file, same aggregate owned by `BacklogIssue`).
- `components/capacity-ledger.tsx:8` `CapacityLedger` — existing headline/bar/breakdown structure; the new assigned-hours/warning row slots in after the bar, before the breakdown `<details>`.
- `components/status-chip.tsx` — the existing `warning` variant, already used by Story 2.4's Leave/Holiday chips; reused verbatim here.
- `app/(pm)/roster/page.tsx:36-91` — the existing Capacity/breakdown computation block this story extends with one more `Promise.all` fetch and two more domain-function calls.
- `app/actions/backlog-issues.ts` — both existing actions' `revalidatePath` calls.

## Tasks & Acceptance

**Execution:**
- [ ] `domain/backlog-issue.ts` -- `sumEstimateHours`, `sumAssignedHoursByMember`.
- [ ] `domain/capacity.ts` -- `compareAssignedToCapacity`.
- [ ] `domain/capacity.selfcheck.ts` / `domain/backlog-issue.selfcheck.ts` (extend) -- cover the I/O matrix.
- [ ] `components/capacity-ledger.tsx` -- `assignedHours`/`overAllocated` props and rendering.
- [ ] `app/(pm)/roster/page.tsx` -- fetch pulled issues, compute and thread the new props.
- [ ] `app/actions/backlog-issues.ts` -- add `revalidatePath("/roster")` to both actions.

**Acceptance Criteria:**
- Given a Team Member's assigned issue hours exceed their computed Capacity, when I view the Roster page, then a warning is shown on that Team Member's row.
- Given the warning is showing, when I continue assigning issues or interacting with the Sprint in any way, then nothing is blocked.

## Design Notes

Showing the actual "Assigned: Xh" figure alongside the warning chip (not just a bare label) is a deliberate addition beyond the AC's literal minimum — a warning with no comparison numbers next to it would tell the PM *that* something's wrong but not *by how much*, undermining the product's own "capacity made visible" thesis.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: no type errors.
- `npm run lint` -- expected: clean.
- `node domain/backlog-issue.selfcheck.ts`, `node domain/capacity.selfcheck.ts` -- expected: all assertions pass, including the new sum/comparison functions.
- Real-DB check (kept pattern from prior stories): pull and assign issues totaling more than a member's Capacity; confirm `overAllocated: true` and the correct assigned-hours figure.

**Manual checks (if no CLI):**
- Visual check that the warning chip and assigned-hours figure appear on both the team-wide and per-row Capacity Ledgers when over-allocated, and that neither blocks any button/action.

### Results (2026-08-19, review_loop_iteration 1)

- `npx tsc --noEmit` — clean.
- `npm run lint` — clean.
- `node domain/backlog-issue.selfcheck.ts`, `node domain/capacity.selfcheck.ts` — all assertions pass, including the two new I/O-matrix cases and a float-precision boundary case added during patching.
- Real-DB check via a disposable route (synthetic fixtures only, all cleaned up, confirmed zero rows remain): called the actual `pullBacklogIssueAction`/`assignBacklogIssueAction` Server Actions against a synthetic Team Member and a real-or-synthetic-if-missing active Sprint/isDev category, then diffed the real `/roster` page's SSR output before and after — confirmed the "Assigned: Xh" figure and the "Over-allocated" `StatusChip` both appear only after assignment, and that `revalidatePath("/roster")` actually invalidates the cached render (the before/after diff would otherwise have shown stale data).
- Three-layer adversarial review (Blind Hunter, Edge Case Hunter, Verification Gap) — two real findings patched (see below); one finding deferred (archived-member orphaned-hours visibility, `deferred-work.md`); no other findings survived triage.

**Patches applied after review:**
- `domain/capacity.ts`'s `compareAssignedToCapacity` now rounds `assignedHours` the same way `capacityHours` is already rounded, closing a float-precision false-positive at the exact-capacity boundary (Edge Case Hunter).
- `app/(pm)/roster/page.tsx`'s `pulledIssues` fetch and `allocationComparisonByMemberId` computation are now gated on `devCategory && activeSprint` (matching the frozen spec's "Always" clause) instead of running on `activeSprint` alone (Blind Hunter).

## Suggested Review Order

**Domain logic (pure, start here):**
- [domain/capacity.ts](../../domain/capacity.ts) — `compareAssignedToCapacity` and its rounding fix.
- [domain/backlog-issue.ts](../../domain/backlog-issue.ts) — `sumEstimateHours`, `sumAssignedHoursByMember`.
- [domain/capacity.selfcheck.ts](../../domain/capacity.selfcheck.ts) / [domain/backlog-issue.selfcheck.ts](../../domain/backlog-issue.selfcheck.ts) — new assertions.

**UI:**
- [components/capacity-ledger.tsx](../../components/capacity-ledger.tsx) — new optional props and rendering.
- [app/(pm)/roster/page.tsx](../../app/(pm)/roster/page.tsx) — wiring and the gate fix.

**Cross-page consistency:**
- [app/actions/backlog-issues.ts](../../app/actions/backlog-issues.ts) — `revalidatePath("/roster")` additions.
