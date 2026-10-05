---
title: 'Assign Issues to Team Members within a Sprint'
type: 'feature'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 3.3 lets the PM pull issues into the Sprint, but every pulled `BacklogIssue.assigneeId` stays `null` forever — nothing assigns them to a real Team Member, so nothing can count their hours toward anyone's Capacity yet.

**Approach:** Add an `assignBacklogIssue` domain function (assign or reassign, scoped to the currently-active Sprint) and a Team Member `<select>` per pulled row in the existing Backlog Drawer — the only existing surface this can live on, since EXPERIENCE.md's other named location ("Sprint Plan's issue rows") doesn't exist yet (Epic 4).

## Boundaries & Constraints

**Always:**
- `domain/backlog-issue.ts` (extend): `BacklogIssueRepo` gains `updateAssignee(id, sprintId, assigneeId): Promise<BacklogIssue | null>` — scoped to `sprintId` in the same query as the write (atomic `updateMany` + count + refetch, mirroring Story 1.6's archived-member guard pattern), so a stale client can't reassign an issue that's since left the active Sprint. `assignBacklogIssue(repo, sprintRepo, {issueId, assigneeId})`: require `issueId`; look up the active Sprint via `sprintRepo.findActive()` (same "This Sprint is no longer active." rejection as `pullBacklogIssue` when none exists); call `repo.updateAssignee(issueId, activeSprint.id, assigneeId)`; `null` back means "not found in the active Sprint" (issue never existed, or belongs to a different/closed Sprint) — a friendly error, not a throw. `assigneeId` is `string | null` — passing `null` clears the assignment (the dropdown's "Unassigned" option), matching how every pulled issue starts.
- `infrastructure/db/backlog-issue-repository.ts`: implement `updateAssignee` via the atomic `updateMany({where: {id, sprintId}}, data: {assigneeId})` → count → `findUnique` pattern.
- `app/actions/backlog-issues.ts` (extend): `assignBacklogIssueAction({issueId, assigneeId})` — same try/catch/`revalidatePath("/sprint")` shape as `pullBacklogIssueAction`.
- `app/(pm)/sprint/page.tsx`: also fetch `teamMemberRepository.list()`; change the data threaded into `<BacklogDrawer>` from a bare `pulledYoutrackIssueIds: string[]` to `pulledIssues: {youtrackIssueId, id, assigneeId}[]` (the fields Story 3.3 fetched but discarded) plus the new `teamMembers` list.
- `app/(pm)/sprint/backlog-drawer.tsx`: each pulled row's "Pulled" chip is joined by a Team Member `<select>` (options: "Unassigned" + every team member, pre-selected to the issue's current `assigneeId`). Changing it calls `assignBacklogIssueAction` immediately (no separate save step, matching this app's existing inline-edit conventions) and updates local state on success; a failure shows an inline error without reverting the dropdown's visual selection until the PM tries again (matches this app's established optimistic-update-with-inline-rollback-error convention).

**Ask First:** _None known._

**Never:**
- No changes to `app/(pm)/sprint/page.tsx`'s own Sprint-summary display, no new "Sprint Plan" issue-row list — EXPERIENCE.md's other named assignment surface is Epic 4's Sprint Plan Overview, out of scope here.
- No validation that `assigneeId` refers to a non-archived Team Member — the dropdown only ever offers non-archived members (via the existing `teamMemberRepository.list()` convention, which already excludes archived rows), so server-side re-validation would be defense-in-depth only, same accepted-gap class already logged for Stories 1.5/2.1's analogous archived-member checks.
- No Capacity/over-allocation display changes — Story 3.5's job. This story only makes `assigneeId` a real, changeable value; nothing yet reads it for a Capacity figure.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| ASSIGN | A pulled issue with `assigneeId: null` | Assigning sets `assigneeId` to the chosen Team Member | N/A |
| REASSIGN | A pulled issue already assigned to Team Member A | Reassigning to Team Member B updates `assigneeId` to B — A no longer has it | N/A |
| UNASSIGN | A pulled issue already assigned | Choosing "Unassigned" sets `assigneeId` back to `null` | N/A |
| SPRINT_NO_LONGER_ACTIVE | The issue's Sprint has since closed | The assign/reassign is rejected | A friendly "no longer active"/"not found" error, not a throw |

</frozen-after-approval>

## Code Map

- `domain/backlog-issue.ts:59` `pullBacklogIssue` — the active-Sprint-lookup pattern `assignBacklogIssue` mirrors exactly.
- `infrastructure/db/team-member-repository.ts:27` `updateWorkingHours` — the exact `updateMany` (scoped where clause) → count → `findUniqueOrThrow` atomic-guard shape `updateAssignee` mirrors, scoped to `sprintId` instead of `archivedAt: null`.
- `app/(pm)/sprint/page.tsx` — already fetches `backlogIssueRepository.listForSprint`; stop discarding all but `youtrackIssueId`.
- `app/(pm)/sprint/backlog-drawer.tsx` — the existing "Pulled" `StatusChip` branch; add the assignee `<select>` alongside it.

## Tasks & Acceptance

**Execution:**
- [x] `domain/backlog-issue.ts` -- `updateAssignee` port method, `assignBacklogIssue`.
- [x] `domain/backlog-issue.selfcheck.ts` (extend) -- covers the I/O matrix using a fake repo.
- [x] `infrastructure/db/backlog-issue-repository.ts` -- implement `updateAssignee` (atomic guard).
- [x] `app/actions/backlog-issues.ts` -- `assignBacklogIssueAction`.
- [x] `app/(pm)/sprint/page.tsx` -- fetch `teamMembers`; thread the richer `pulledIssues` shape.
- [x] `app/(pm)/sprint/backlog-drawer.tsx` -- the assignee `<select>` per pulled row.

**Acceptance Criteria:**
- Given a Backlog Issue pulled into the current Sprint, when I assign it to a Team Member, then `assigneeId` is set to that Team Member (ready for Story 3.5's Capacity math to read).
- Given an issue already assigned to one Team Member, when I reassign it to a different Team Member, then `assigneeId` updates to the new one — the previous assignee no longer has it.

## Design Notes

Reassignment reuses the exact same domain function as first-time assignment (`assignBacklogIssue` doesn't distinguish "was null" from "was already set") — a reassignment is just an assignment where the previous value happened to be non-null. No separate "reassign" code path exists or is needed.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: no type errors.
- `npm run lint` -- expected: clean.
- `node domain/backlog-issue.selfcheck.ts` -- expected: all assertions pass, including assign/reassign/unassign and the no-longer-active-Sprint rejection.
- Real-DB check (kept pattern from prior stories): pull an issue, assign it to a real Team Member, reassign it to a different one, confirm the persisted row reflects only the latest assignee.

**Manual checks (if no CLI):**
- Visual check that the assignee `<select>` appears on every pulled row and pre-selects the correct current assignee.

**Results (2026-08-19 pass):**

- Implemented directly (continuing this session's established fallback given two earlier subagent dispatches this session were interrupted by transient failures).
- `npx tsc --noEmit`, `npm run lint` -- both clean.
- `node domain/backlog-issue.selfcheck.ts` -- all assertions passed, including the new ASSIGN, REASSIGN, UNASSIGN, and both SPRINT_NO_LONGER_ACTIVE (no active Sprint; issue belongs to a different Sprint) cases, plus an unknown-issue-id rejection.
- **Real-DB check:** pulled a real issue into a real active Sprint, assigned it to a real Team Member, reassigned it to a second Team Member, then unassigned it -- each step's persisted row reflected exactly the latest operation (confirmed via a direct `findUnique` after the full sequence, not just the domain function's own return value). Cascade-delete cleanup on Sprint removal left zero leftover `BacklogIssue` rows; zero leftover Team Members.
- Confirmed the Sprint page itself still renders correctly (SSR) with the new `teamMemberRepository.list()` fetch and the richer `pulledIssues` shape wired in.
- **Not verified this pass:** an interactive browser walkthrough of the assignee `<select>` itself (pre-selection, the onChange round-trip, inline error display) -- same standing Playwright-unreachable gap already logged for seven prior stories. The real-DB check above verifies the actual domain/persistence logic the dropdown calls into, not the dropdown interaction itself.

**Results (2026-08-19 review-patch pass):**

Three-layer adversarial review (Blind Hunter, Edge Case Hunter, Verification Gap) ran against the diff. Patched:

- **Real bug in the spec's own stated behavior:** the spec required "a failure shows an inline error without reverting the dropdown's visual selection" (Design Notes), but the actual implementation bound the `<select>`'s value only to the server-confirmed `pulledInfo.assigneeId` -- on failure it would visually snap back to the pre-change value despite the error message, contradicting the spec's own intent. Verification Gap caught this with a full reproduction trace. Fixed by updating the displayed assignee optimistically (before the request resolves) and never reverting it on failure -- only the error message reflects failure, matching the stated design.
- `domain/backlog-issue.ts` -- `assignBacklogIssue` had no `try`/`catch` around `repo.updateAssignee` at all, unlike its `pullBacklogIssue` sibling in the same file -- a foreign-key violation (a stale/nonexistent `assigneeId`) would have thrown uncaught. Now caught and translated to "Selected Team Member no longer exists." Also normalizes `assigneeId: ""` to `null` server-side in the domain layer itself (previously only the UI did this before calling the action, so a direct call with `""` would have hit the FK constraint instead of clearing the assignment).
- `infrastructure/db/backlog-issue-repository.ts` -- `updateAssignee`'s refetch now uses `findUnique` instead of `findUniqueOrThrow`: unlike `TeamMember` (soft-deleted, never truly gone), a `BacklogIssue` row can vanish via Sprint cascade-delete in the narrow window between the `updateMany` and the refetch -- now treated as "not found" instead of an uncaught throw.
- `app/(pm)/sprint/backlog-drawer.tsx` -- `handleAssigneeChange` now has a `try`/`catch` around the action call (a rejected promise, e.g. a transport failure, previously left the row silently stuck with no error); `assignErrors` is now reset alongside `pullErrors` when the drawer reopens; the select is now `disabled` while its own assignment request is in flight (prevents a second change racing an unresolved first one) and also disabled with a "No Team Members yet" placeholder when the roster is empty.
- `domain/backlog-issue.selfcheck.ts` -- added `ASSIGNEE_FK_VIOLATION` and `EMPTY_STRING_ASSIGNEE` cases covering the two paths above.

Deferred (see `deferred-work.md`): an archived-but-still-assigned Team Member's id has no matching `<select>` option (displays as "Unassigned" while the DB disagrees) -- needs a product decision on how to show it; the assignee `<select>` only covers issues in the live YouTrack browse window, with no persistent "all pulled issues" list -- overlaps with Epic 4's Sprint Plan Overview; `pulledByYoutrackId` not re-synced from the server prop on reopen (same class already deferred for Story 3.3); no multi-user conflict protection and a narrower active-Sprint race window than `pullBacklogIssue`'s (no DB-level backstop for assignment specifically) -- both very low likelihood for a single-PM tool.

Re-ran `npx tsc --noEmit`, `npm run lint`, `node domain/backlog-issue.selfcheck.ts` (now covering FK-violation and empty-string cases too) -- all clean/passing after patches. Re-ran the real-DB check: an assignment with a nonexistent Team Member id is now correctly rejected with the friendly error instead of throwing; an empty-string `assigneeId` correctly normalizes to `null` and persists that way, not as a literal empty string; zero leftover rows after cleanup.

## Suggested Review Order

**UI: the real bug this pass found**

- `handleAssigneeChange` -- the review-patch fix for the select-reverts-on-failure bug (optimistic update, never reverted, matching the spec's own stated intent that the original implementation didn't actually achieve).
  [`backlog-drawer.tsx:160`](../../app/(pm)/sprint/backlog-drawer.tsx#L160)

- `BacklogDrawer` -- the in-flight `disabled` state, the empty-`teamMembers` handling, and `assignErrors` reset on reopen.
  [`backlog-drawer.tsx:30`](../../app/(pm)/sprint/backlog-drawer.tsx#L30)

**Domain: assign/reassign and its error handling**

- `assignBacklogIssue` -- the review-patch `try`/`catch` (previously absent entirely, unlike its `pullBacklogIssue` sibling) and the server-side `"" -> null` normalization.
  [`backlog-issue.ts:133`](../../domain/backlog-issue.ts#L133)

- `pullBacklogIssue` -- unchanged this story; the pattern `assignBacklogIssue` mirrors.
  [`backlog-issue.ts:65`](../../domain/backlog-issue.ts#L65)

- `backlog-issue.selfcheck.ts` -- the review-patch `ASSIGNEE_FK_VIOLATION`/`EMPTY_STRING_ASSIGNEE` cases, alongside the I/O matrix's ASSIGN/REASSIGN/UNASSIGN/SPRINT_NOT_ACTIVE coverage.
  [`backlog-issue.selfcheck.ts:1`](../../domain/backlog-issue.selfcheck.ts#L1)

**Infrastructure**

- `backlogIssueRepository.updateAssignee` -- the atomic Sprint-scoped guard, and the review-patch `findUnique` (not `Throw`) fix.
  [`backlog-issue-repository.ts:4`](../../infrastructure/db/backlog-issue-repository.ts#L4)

- `assignBacklogIssueAction` -- the Server Action wrapper.
  [`backlog-issues.ts:49`](../../app/actions/backlog-issues.ts#L49)
