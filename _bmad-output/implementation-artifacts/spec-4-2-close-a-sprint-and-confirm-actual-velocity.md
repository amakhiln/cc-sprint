---
title: 'Close a Sprint and Confirm Actual Velocity'
type: 'feature'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 1
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nothing yet lets a PM finish a Sprint. Capacity is always computed live (Epic 2), and issues can be pulled/assigned (Epic 3), but there is no way to lock in what actually happened, free up the single-active-Sprint slot for the next one, or record a real Planned-vs-Actual Velocity for history (Epic 4.3 depends on this existing).

**Approach:** A "Close Sprint" modal, reached from the Sprint Plan Overview: it pulls each *assigned* Backlog Issue's logged hours from YouTrack (best-effort, matching AD-3's pull-based, tolerant-parsing convention already used for estimate hours), lets the PM review/edit every figure before committing, then atomically (a) writes each issue's confirmed logged hours, (b) snapshots the Sprint's current live Capacity/breakdown/Actual-Velocity onto the Sprint record (AD-2), and (c) flips the Sprint to `closed` — which is what frees the single-active-Sprint slot (AD-6) for the next one.

## Boundaries & Constraints

**Always:**
- `domain/velocity.ts` (new): `computePlannedVelocityHours(issues: BacklogIssue[]): number` — sum of `estimateHours` for issues with a non-null `assigneeId` only (unassigned pulled work was never "committed," per epic-4-context's exact definition — deliberately narrower than Story 3.5/4.1's all-issues team-Capacity comparison, a different metric for a different purpose). Works identically whether the Sprint is active or closed — `estimateHours` never changes after pull, so no snapshot copy of Planned Velocity is needed; it's always safely recomputable from the (never-deleted) `BacklogIssue` rows.
- `domain/youtrack.ts` / `infrastructure/youtrack/issues.ts` (extend): a new port method fetching one assigned issue's logged time from its YouTrack `customFields`, reusing the existing `findCustomField`/`extractEstimateHours` helpers verbatim (same Period-type parsing already built for the Estimate field) against candidate names `["spent time", "time spent", "logged time"]`. Returns `null` (not an error) for "field not found/unparseable" — that is what feeds the "Not yet checked" vs "0h logged" distinction, not an error state.
- `domain/sprint.ts` (extend): `SprintRepo.close(id, data)` — one atomic, transactional write covering (a) every confirmed issue's `loggedHours`/`loggedHoursPulledAt`, and (b) the Sprint's `status: 'closed'` + three snapshot fields, guarded on `status: 'active'` so a stale client can't double-close. `closeSprint(repo, input)` domain function: validates there's an active Sprint matching `input.sprintId`, that every confirmed-hours value is a non-negative finite number, then calls `repo.close(...)`.
- `prisma/schema.prisma`: change `Sprint.snapshotCapacityHours` and `Sprint.snapshotActualVelocityHours` from `Int` to `Float` (matching the `Float` convention every other hours figure in this schema already uses — `BacklogIssue.estimateHours`/`loggedHours` are `Float`, and `computeCapacityForTeam`'s output is `Float`-precision). These two columns are unused in every row today (this is the first story to ever write them), so this is a zero-data-risk type correction, not a migration of real data.
- `app/actions/sprint.ts` (extend): `initiateSprintCloseAction(sprintId)` — read-only preview; for each assigned issue in the Sprint, best-effort pulls logged hours (skips the network call entirely, returning `null` for every issue, if YouTrack isn't configured — Close Sprint must work without YouTrack, per AD-3's optional-integration stance). `confirmSprintCloseAction(sprintId, confirmedHoursByIssueId)` — computes the live Capacity/breakdown snapshot (via existing `domain/capacity.ts` functions) and Actual Velocity total from the confirmed hours, then calls `closeSprint`. Both `revalidatePath("/")`, `/sprint`, `/roster` on success (this page's data is exactly what changes).
- A new client component (e.g. `app/close-sprint-dialog.tsx`) reusing the existing `Dialog` component (Story 2.x precedent) — one row per assigned issue: title, an editable hours input pre-filled with the pulled value when present, and a distinct muted-italic "Not yet checked" caption (not a bare 0) when the pull returned `null`; a running total; a single "Confirm and close" action. Rendered from `app/page.tsx` behind a "Close Sprint" button, shown only when there's an active Sprint.
- Closed-Sprint rendering: once `activeSprint` is null because the Sprint just closed, `app/page.tsx`'s existing empty state (Story 4.1) takes over — no separate "closed Sprint view" is built by this story (Story 4.3's Velocity History is the closed-Sprint-facing surface; this story only produces the data it will read).

**Ask First:** _None known._

**Never:**
- No write-back to YouTrack, ever (AD-3's non-goal) — this story only reads logged-time custom fields.
- No automatic carry-over of unfinished/unassigned issues into a future Sprint — `BacklogIssue` rows are simply left as historical rows tied to the now-closed Sprint; the PM re-pulls manually next Sprint (epics.md's explicit AC4 wording).
- Never let closing block on a YouTrack failure, a missing YouTrack config, or an unparseable logged-hours field for any individual issue — every one of those degrades to an editable, PM-fillable "Not yet checked" row, never a hard error that prevents closing.
- Never recompute a closed Sprint's snapshot fields after the fact — once written, `snapshotCapacityHours`/`snapshotAllocationBreakdown`/`snapshotActualVelocityHours` are read directly, never regenerated from current roster/allocation/leave state (AD-2).
- No new "reopen a closed Sprint" capability — out of scope; closing is a one-way transition in this version.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| NORMAL_PULL | An assigned issue has a parseable logged-time custom field | Its row pre-fills with that value; caption reads "Xh logged" | N/A |
| ZERO_LOGGED | An assigned issue's logged-time field parses to exactly 0 | Row shows "0h logged", pre-filled with 0 — never conflated with "not yet checked" | N/A |
| NOT_YET_CHECKED | YouTrack not configured, the pull fails, or the field is unparseable for that issue | Row shows "Not yet checked" (muted italic), input starts blank/0 and must be filled in manually before confirming | N/A |
| UNASSIGNED_ISSUE_EXCLUDED | A pulled issue with `assigneeId: null` | Excluded entirely from the Close Sprint review list and from both Planned and Actual Velocity totals | N/A |
| CONFIRM_EDITED_VALUE | PM edits a pre-filled or manually-entered value before confirming | The edited value — not the raw pull — is what gets written to `loggedHours` and summed into Actual Velocity | N/A |
| DOUBLE_CLOSE_RACE | Two confirm requests for the same Sprint race | `SprintRepo.close`'s `status: 'active'` guard means only the first commits; the second's atomic condition matches zero rows and is rejected, not silently overwritten | Friendly "already closed" error |
| POST_CLOSE_YOUTRACK_DRIFT | YouTrack's logged time for an issue changes after the Sprint closed | The closed Sprint's stored `snapshotActualVelocityHours`/`BacklogIssue.loggedHours` are untouched — nothing re-reads YouTrack for a closed Sprint | N/A |
| NO_ASSIGNED_ISSUES | Active Sprint with zero assigned issues | Close Sprint modal shows an empty review list (no rows) and a running total of 0; closing is still fully allowed | N/A |

</frozen-after-approval>

## Code Map

- `domain/sprint.ts:14-17,45-84` — existing `SprintRepo`/`createSprint`; `close`/`closeSprint` are added alongside.
- `infrastructure/db/sprint-repository.ts` — `findActive`/`create`; `close` implemented via `prisma.$transaction`.
- `domain/backlog-issue.ts` — `BacklogIssue` type, `sumAssignedHoursByMember` (the existing per-member map this story's Planned Velocity sum deliberately does NOT reuse, computing its own flat filter+sum instead — see Design Notes).
- `infrastructure/youtrack/issues.ts:138-159` — `enrichWithCustomFields`'s per-issue `get_issue` call shape, mirrored for the new logged-hours fetch.
- `components/ui/dialog.tsx` — the existing Dialog primitive (already used by `team-member-detail-panel.tsx`).
- `app/page.tsx` — the Sprint Plan Overview (Story 4.1); hosts the new "Close Sprint" button/trigger.
- `app/actions/sprint.ts` — existing `createSprintAction`; two new actions added alongside.
- `prisma/schema.prisma:53,55` — the `Int` → `Float` type fix.

## Tasks & Acceptance

**Execution:**
- [ ] `prisma/schema.prisma` + migration -- `snapshotCapacityHours`/`snapshotActualVelocityHours` `Int` → `Float`.
- [ ] `domain/velocity.ts` (new) -- `computePlannedVelocityHours`.
- [ ] `domain/velocity.selfcheck.ts` (new) -- cover assigned/unassigned exclusion, empty list.
- [ ] `domain/youtrack.ts` -- extend `YouTrackIssuesPort` with the logged-hours method.
- [ ] `infrastructure/youtrack/issues.ts` -- implement it, reusing existing parsing helpers.
- [ ] `domain/sprint.ts` -- `SprintRepo.close`, `closeSprint`.
- [ ] `domain/sprint.selfcheck.ts` (extend) -- cover the I/O matrix's close-specific rows.
- [ ] `infrastructure/db/sprint-repository.ts` -- `close` via `$transaction`.
- [ ] `app/actions/sprint.ts` -- `initiateSprintCloseAction`, `confirmSprintCloseAction`.
- [ ] `app/close-sprint-dialog.tsx` (new) -- the modal.
- [ ] `app/page.tsx` -- the "Close Sprint" trigger.

**Acceptance Criteria:**
- Given an active Sprint ready to close, when I initiate closing it, then the system pulls Actual Velocity automatically from each assigned Backlog Issue's logged time-tracking hours in YouTrack and shows the pulled figures, editable, per issue and in total.
- Given an issue with no logged time, when its Actual Velocity is pulled, then it shows as 0 hours, clearly distinguished from "not yet checked."
- Given I've reviewed and optionally adjusted the pulled hours, when I confirm the close, then the confirmed Actual Velocity is locked into Velocity History, the Sprint becomes read-only, and any unfinished Backlog Issue stays in YouTrack, unassigned from any Sprint, until I manually re-pull it later.
- Given a Sprint has already been closed, when YouTrack data for one of its issues changes afterward, then the closed Sprint's stored Actual Velocity is not silently overwritten.

## Design Notes

`computePlannedVelocityHours` deliberately does its own flat `filter(assigneeId).reduce(estimateHours)` rather than summing `sumAssignedHoursByMember`'s Map values — building a per-member Map just to immediately discard the keys would be reuse for reuse's sake, not genuine simplification, for a function that only ever needs one flat total.

No live YouTrack server exists in this environment (same constraint as Epic 3) — the logged-hours fetch is built against the real, installed MCP SDK and the same documented `get_issue` tool already used for Estimate, but its actual live behavior against a real instance can't be exercised this pass; disclosed in `deferred-work.md` alongside Epic 3's identical disclosures.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: no type errors.
- `npm run lint` -- expected: clean.
- `node domain/velocity.selfcheck.ts`, `node domain/sprint.selfcheck.ts` -- expected: all assertions pass.
- Real-DB check (synthetic fixtures, cleaned up after): pull/assign issues, run the full initiate→confirm close flow with a fake YouTrack port, confirm the Sprint transitions to `closed` with correct snapshot values, `BacklogIssue.loggedHours` written, and creating a new Sprint afterward succeeds (the single-active-Sprint slot freed up).

**Manual checks (if no CLI):**
- Visual check of the Close Sprint modal's "0h logged" vs "Not yet checked" distinction, and that a closed Sprint shows no edit affordances anywhere.

## Suggested Review Order

**Domain logic (pure, start here):**
- [domain/velocity.ts](../../domain/velocity.ts), [domain/velocity.selfcheck.ts](../../domain/velocity.selfcheck.ts)
- [domain/sprint.ts](../../domain/sprint.ts) — `closeSprint`, including the `repo.findActive()` pre-check added during review.
- [domain/sprint.selfcheck.ts](../../domain/sprint.selfcheck.ts) — the 4 new close-specific cases.
- [domain/youtrack.ts](../../domain/youtrack.ts), [infrastructure/youtrack/issues.ts](../../infrastructure/youtrack/issues.ts) — `getLoggedHours`.

**The atomicity fix (most important review target):**
- [infrastructure/db/sprint-repository.ts](../../infrastructure/db/sprint-repository.ts) — `close`, rewritten from an array-form `$transaction` to an interactive one after three review layers independently found the original let per-issue writes commit even when the Sprint's own guard failed, and the per-issue write wasn't scoped to `sprintId` at all.

**Server Actions and UI:**
- [app/actions/sprint.ts](../../app/actions/sprint.ts) — `initiateSprintCloseAction`, `confirmSprintCloseAction` (including the re-validation-against-current-assigned-issues patch).
- [app/close-sprint-dialog.tsx](../../app/close-sprint-dialog.tsx), [app/page.tsx](../../app/page.tsx).

**Schema:**
- [prisma/schema.prisma](../../prisma/schema.prisma) — the `Int` → `Float` fix and its migration.

### Results (2026-08-20, review_loop_iteration 1)

- `npx tsc --noEmit` — clean, at every checkpoint through implementation and after review patches.
- `npm run lint` — clean, same checkpoints.
- `node domain/velocity.selfcheck.ts`, `node domain/sprint.selfcheck.ts` (4 new closeSprint cases), `node domain/backlog-issue.selfcheck.ts`, `node domain/capacity.selfcheck.ts`, `node domain/youtrack.selfcheck.ts`, `node infrastructure/youtrack/issues.selfcheck.ts` (extended with a "spent time" candidate-name assertion) — all pass.
- Real-DB checks via disposable routes (synthetic fixtures only, all cleaned up, confirmed zero rows remain), across two passes:
  - First pass: full initiate→confirm flow (assigned + unassigned issues, an edited hours value, a real double-close rejection, and confirmed a new Sprint could be created afterward — the single-active-Sprint slot correctly freed).
  - Second pass (after review patches): a cross-Sprint injection attempt (a forged issue id belonging to an unrelated, already-closed Sprint) — confirmed the foreign Sprint's `loggedHours` stayed untouched and the injected hours were excluded from Actual Velocity; a direct call to `sprintRepository.close` against an already-closed Sprint (bypassing every higher-layer pre-check) — confirmed the interactive transaction's rollback actually prevents the per-issue write from committing, closing the exact bug three review layers found; a genuine `0`-hours confirm (ZERO_LOGGED, distinct from the null "not yet checked" state); and closing a Sprint with zero assigned issues against the real transaction (NO_ASSIGNED_ISSUES).
- Three-layer adversarial review (Blind Hunter, Edge Case Hunter, Verification Gap) — all three independently converged on the same critical finding (see Patches below); two additional findings deferred; the remaining findings were either already covered or out of this story's scope.

**Patches applied after review (all three review layers independently found the same core issue):**
- `infrastructure/db/sprint-repository.ts`'s `close` rewritten from an array-form `$transaction` (which commits every statement regardless of another's row-match count) to an interactive transaction that throws and rolls back everything, including per-issue writes, when the Sprint's own `status:'active'` guard fails.
- The per-issue `updateMany` inside `close` is now scoped to `(id, sprintId)`, not just `id` — a stale/foreign issue id can no longer write into a different Sprint's data.
- `app/actions/sprint.ts`'s `confirmSprintCloseAction` now re-fetches the Sprint's *current* assigned issues and filters the client-submitted `confirmedHoursByIssueId` down to only those before summing/writing — a stale preview or a tampered payload can no longer inflate Actual Velocity with hours for an issue that was never actually reviewed.
- `domain/sprint.ts`'s `closeSprint` now calls `repo.findActive()` as its own pre-check, matching what the frozen spec assigns to it (previously only implemented one layer up, in the Server Action).
- `app/close-sprint-dialog.tsx`'s hours input now guards against non-finite/negative values client-side, so an emptied or partially-typed field can never show "NaNh" in the running total or reach the server.
