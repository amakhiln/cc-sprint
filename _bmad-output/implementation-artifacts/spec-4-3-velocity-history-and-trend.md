---
title: 'Velocity History and Trend'
type: 'feature'
created: '2026-08-20'
status: 'done'
review_loop_iteration: 1
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 4.2 lets a PM close a Sprint and confirm its Actual Velocity, but that figure — and the Planned Velocity it's meant to be compared against — is only ever visible at the moment of closing. Nothing shows the trend across Sprints that would make future capacity estimates more accurate.

**Approach:** A new read-only page, reached contextually from the Sprint Plan Overview, listing every closed Sprint most-recent-first as a table: Sprint (date range), Planned Velocity, Actual Velocity, delta. Planned Velocity is recomputed on demand from each closed Sprint's still-existing `BacklogIssue` rows (Story 4.2's own design: `estimateHours` never changes after pull, so no snapshot copy was ever needed); Actual Velocity is read directly from the Sprint's already-stored `snapshotActualVelocityHours` (never recomputed, per AD-2).

## Boundaries & Constraints

**Always:**
- `domain/velocity.ts` (extend): `computeVelocityDelta(actualVelocityHours: number, plannedVelocityHours: number): number` — `actual - planned` (positive means the team delivered more than planned, negative means less). One shared implementation, not reimplemented at the call site (AD-1's established rule for every other Capacity/Velocity figure in this codebase).
- `infrastructure/db/sprint-repository.ts` (extend): `SprintRepo.listClosed(): Promise<Sprint[]>` — every Sprint with `status: 'closed'`, ordered by `startDate` descending (no `closedAt` field exists; `startDate` is the closest available proxy for chronological recency, and Sprints don't overlap so this ordering is unambiguous).
- `app/(pm)/velocity-history/page.tsx` (new): a Server Component listing every closed Sprint via `listClosed()`, computing each one's Planned Velocity from `backlogIssueRepository.listForSprint(sprint.id)` + `computePlannedVelocityHours` (Story 4.2), reading Actual Velocity from `sprint.snapshotActualVelocityHours`, and delta from the new `computeVelocityDelta`. One table: Sprint (formatted date range), Planned Velocity, Actual Velocity, delta — matching EXPERIENCE.md's Velocity History Trend pattern exactly (table only, no chart, tabular-number alignment, most recent first).
- `app/page.tsx`: add a link to `/velocity-history`, matching epic-4-context's "reached contextually from [Sprint Plan Overview]" framing (the same pattern already established for Close Sprint's modal and the Backlog Drawer).

**Ask First:** _None known._

**Never:**
- No chart/visualization — EXPERIENCE.md explicitly scopes v1 to a table only.
- No write affordances anywhere on this page — purely a historical read, matching every closed Sprint's read-only nature (AD-2).
- No new snapshot field for Planned Velocity — it's always safely recomputable from `BacklogIssue.estimateHours`, which is immutable after pull (Story 4.2's own established design, not to be second-guessed here).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| SINGLE_CLOSED_SPRINT | Exactly one closed Sprint | That Sprint's row shows its Planned Velocity, Actual Velocity, and delta | N/A |
| MULTIPLE_CLOSED_SPRINTS | Several closed Sprints with different start dates | All shown together, ordered most-recent-first by `startDate` | N/A |
| NO_CLOSED_SPRINTS | Zero closed Sprints (none ever closed) | An empty-state message, not an empty table | N/A |
| ZERO_ASSIGNED_ISSUES_AT_CLOSE | A closed Sprint that had no assigned issues | Planned Velocity shows 0h, not blank/NaN | N/A |
| POSITIVE_AND_NEGATIVE_DELTA | One Sprint delivered more than planned, another less | Both deltas render correctly (a plain signed number, no special-casing needed) | N/A |
| ACTIVE_SPRINT_EXCLUDED | An active (not yet closed) Sprint exists alongside closed ones | It never appears in this table — only `status: 'closed'` rows are listed | N/A |

</frozen-after-approval>

## Code Map

- `domain/velocity.ts` — `computePlannedVelocityHours`, `computeActualVelocityHours` (Story 4.2); `computeVelocityDelta` added alongside.
- `domain/sprint.ts` — `Sprint` type, including `snapshotActualVelocityHours`.
- `infrastructure/db/sprint-repository.ts` — `findActive`/`create`/`close`; `listClosed` added alongside.
- `infrastructure/db/backlog-issue-repository.ts` — `listForSprint`, reused per closed Sprint.
- `app/(pm)/leave/page.tsx` — the closest existing analog for a simple, non-editable-list Server Component page's structure/empty-state convention.
- `app/page.tsx` — where the new link to `/velocity-history` is added.

## Tasks & Acceptance

**Execution:**
- [ ] `domain/velocity.ts` -- `computeVelocityDelta`.
- [ ] `domain/velocity.selfcheck.ts` (extend) -- cover positive/negative/zero delta.
- [ ] `infrastructure/db/sprint-repository.ts` -- `listClosed`.
- [ ] `app/(pm)/velocity-history/page.tsx` (new) -- the table + empty state.
- [ ] `app/page.tsx` -- the link to `/velocity-history`.

**Acceptance Criteria:**
- Given at least one closed Sprint, when I view Velocity History, then I see that Sprint's Planned Velocity and confirmed Actual Velocity.
- Given multiple closed Sprints, when I view Velocity History, then I see them together as a sprint-over-sprint trend.

## Design Notes

Planned Velocity is recomputed per page view rather than stored — this mirrors Story 4.2's own explicit design decision (documented in its Design Notes) and keeps this story from introducing a second source of truth for a figure that's already safely derivable. The N+1 `listForSprint` query per closed Sprint is an accepted, matching EXPERIENCE.md's own sizing assumption ("a handful of closed Sprints reads fine as a table").

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: no type errors.
- `npm run lint` -- expected: clean.
- `node domain/velocity.selfcheck.ts` -- expected: all assertions pass, including the new delta cases.
- Real-DB check (synthetic fixtures, cleaned up after): close two synthetic Sprints with different Planned/Actual figures, confirm the table shows both, most-recent-first, with correct deltas; confirm an active Sprint never appears in the list.

**Manual checks (if no CLI):**
- Visual check of the empty state (no closed Sprints) alongside the populated table.

## Suggested Review Order

- [domain/velocity.ts](../../domain/velocity.ts), [domain/velocity.selfcheck.ts](../../domain/velocity.selfcheck.ts) — `computeVelocityDelta`.
- [infrastructure/db/sprint-repository.ts](../../infrastructure/db/sprint-repository.ts) — `listClosed`, including the ordering tiebreaker added during review.
- [app/(pm)/velocity-history/page.tsx](../../app/(pm)/velocity-history/page.tsx), [app/(pm)/velocity-history/error.tsx](../../app/(pm)/velocity-history/error.tsx)
- [app/page.tsx](../../app/page.tsx) — the link, in both the active-Sprint and no-active-Sprint branches.

### Results (2026-08-20, review_loop_iteration 1)

- `npx tsc --noEmit` — clean at every checkpoint.
- `npm run lint` — clean at every checkpoint.
- `node domain/velocity.selfcheck.ts` (4 new `computeVelocityDelta` cases: positive, negative, zero-matching-plan, zero-zero) and `node domain/sprint.selfcheck.ts` (fake repos updated with `listClosed` stubs) — both pass.
- Real-DB checks via disposable routes (synthetic fixtures only, all cleaned up, confirmed zero rows remain), across two passes:
  - First pass: empty state with zero closed Sprints; two closed Sprints with different Planned/Actual figures (one over-delivered +2h, one under-delivered -5h, the latter also with a deliberately unassigned 100h issue confirmed excluded from Planned Velocity) alongside a genuine active Sprint — confirmed exactly 2 rows (not 3), most-recent-first ordering, and exact figures via raw HTML inspection; confirmed the home page's link to `/velocity-history` renders.
  - Second pass (after review patches): confirmed the link now also renders in the no-active-Sprint empty state (the exact gap Blind Hunter found); added a third closed Sprint with a distinct date to confirm three-way most-recent-first ordering (closing the "only ever tested two, not a real trend" gap Verification Gap raised).
- Three-layer adversarial review (Blind Hunter, Edge Case Hunter, Verification Gap) — two real findings patched; one finding deferred (see below).

**Patches applied after review:**
- `app/page.tsx` now shows the "Velocity History" link in the no-active-Sprint empty state too, not only when a Sprint is active — the frozen spec's Always clause was unconditional, and the moment right after closing a Sprint (no active one yet) is exactly when a PM is most likely to want it (Blind Hunter).
- `infrastructure/db/sprint-repository.ts`'s `listClosed` now orders by `[{startDate: "desc"}, {id: "desc"}]` instead of `startDate` alone — `startDate` has no uniqueness constraint, so two closed Sprints sharing one could otherwise flip order unpredictably between page loads with no tiebreaker (Edge Case Hunter).

**Deferred** (see `deferred-work.md`): `snapshotActualVelocityHours ?? 0` conflates "genuinely zero" with "never recorded" — unreachable through any current in-app code path (the only close path always writes a real number), so not fixed speculatively.
