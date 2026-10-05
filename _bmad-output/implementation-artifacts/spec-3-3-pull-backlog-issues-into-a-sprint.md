---
title: 'Pull Backlog Issues into a Sprint'
type: 'feature'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 3.2 lets the PM browse YouTrack's backlog, but nothing yet brings any of it into the Sprint — the Sprint plan still has zero real tracked work.

**Approach:** Add a persisted `BacklogIssue` model (per the Architecture Spine's ERD) and a `domain/backlog-issue.ts` `pullBacklogIssue` function, wired into the existing Backlog Drawer with a checkbox + editable estimate-hours field per row and a "Pull Selected" action that keeps the drawer open for further rounds. **Resolved ambiguity (human decision):** the ERD's `BacklogIssue.assigneeId` field carries no "nullable" annotation, and FR-18 describes pulling as directly counting hours "against the assignee's Capacity" — but the epic's own cross-story note says "pulling precedes assignment (3.4)," and Story 3.4 is titled "Assign Issues to Team Members." The human resolved this: `assigneeId` is nullable; pulling never requires or sets an assignee; Story 3.4 is the first and only place an assignee gets set. This story's own AC #1 ("counted against its assignee's Capacity") describes the eventual behavior once 3.4 assigns it, not something checked at pull time.

## Boundaries & Constraints

**Always:**
- **Rename to avoid a collision (prerequisite, mechanical):** `domain/youtrack.ts`'s existing `BacklogIssue` type (Story 3.2's YouTrack-side view model) → `YouTrackIssueSummary`; update its every usage (`infrastructure/youtrack/issues.ts`, `domain/youtrack.selfcheck.ts`, `app/(pm)/sprint/backlog-drawer.tsx`). The Architecture Spine's ERD reserves the name `BacklogIssue` for the persisted local record this story adds — Prisma models mirror Glossary terms exactly, no synonyms, so the *new* persisted concept keeps that name and the *existing* YouTrack-side one is renamed instead.
- `prisma/schema.prisma`: `model BacklogIssue { id, youtrackIssueId, sprintId (FK, cascade), title, assigneeId (nullable FK, set-null), estimateHours (Float), loggedHours (Float, default 0), loggedHoursPulledAt (nullable DateTime) }`, `@@unique([sprintId, youtrackIssueId])` — the DB-level backstop against double-pulling the same issue into the same Sprint (app-level pre-check + this constraint, same two-layer pattern as AD-6/Story 1.7's active-Sprint guard). Add the `backlogIssues` back-relations to `Sprint` and `TeamMember`.
- `domain/backlog-issue.ts` (new): `BacklogIssue` type; `BacklogIssueRepo = {create(data): Promise<BacklogIssue>; listForSprint(sprintId): Promise<BacklogIssue[]>}`; `pullBacklogIssue(repo, input: {sprintId, youtrackIssueId, title, estimateHours})` — validate all four fields non-empty/positive (`estimateHours > 0`), then `repo.create`; catch a unique-constraint violation (duck-typed `P2002`, mirroring `domain/sprint.ts`'s `isUniqueConstraintViolation`) and return a friendly "already pulled into this Sprint" error instead of throwing.
- `infrastructure/db/backlog-issue-repository.ts` (new): implement the port via Prisma.
- `app/actions/backlog-issues.ts` (new): `pullBacklogIssueAction(input)` — one issue per call (the drawer loops for "Pull Selected"), same try/catch/`revalidatePath("/sprint")` shape as every other Server Action.
- `app/(pm)/sprint/backlog-drawer.tsx`: when `activeSprintId` is provided, each non-already-pulled row gets a checkbox and an editable estimate-hours number input (pre-filled from `estimateHours` when YouTrack provided one, otherwise empty and required — this *is* the "prompted to enter manually" AC, satisfied via inline required-field validation, not a separate modal). A "Pull Selected" button pulls every checked, valid row (calls the action once per issue); successes are tracked client-side as pulled (badge, checkbox removed) without needing a full page reload; per-issue failures show inline without blocking the others. When `activeSprintId` is `null`, the pull controls are replaced with "Create a Sprint to pull issues" — browsing (Story 3.2) still works regardless.
- `app/(pm)/sprint/page.tsx`: when an active Sprint exists, also fetch `backlogIssueRepository.listForSprint(activeSprint.id)` and pass both `activeSprintId` and the resulting `pulledYoutrackIssueIds` into `<BacklogDrawer>`.

**Ask First:** _None known — the assignee-nullability ambiguity was already raised and resolved._

**Never:**
- No assignee selection or assignment UI anywhere in this story — Story 3.4's job entirely. `assigneeId` stays `null` on every row this story creates.
- No re-fetching YouTrack data at pull time — the drawer already has each issue's `summary`/`estimateHours` from its Story 3.2 browse fetch; pulling persists exactly that, not a fresh lookup.
- No changes to `client.ts`/`issues.ts`'s YouTrack adapters beyond the `BacklogIssue` → `YouTrackIssueSummary` rename.
- No carry-over/auto-re-pull logic — every pull is one explicit PM action per issue, matching the PRD's "no automatic carry-over" non-goal.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| ESTIMATE_FROM_YOUTRACK | Issue has a YouTrack estimate value | The estimate field pre-fills with it; pulling persists that value | N/A |
| ESTIMATE_MISSING | Issue has no YouTrack estimate value | The estimate field is empty and required; "Pull Selected" is blocked for that row until filled | Inline validation, no server round-trip on an empty/invalid value |
| DUPLICATE_PULL_SAME_SPRINT | The same `youtrackIssueId` is pulled into the same Sprint twice | The second attempt is rejected — no second row is created | A friendly "already pulled into this Sprint" error |
| DUPLICATE_PULL_DIFFERENT_SPRINT | The same `youtrackIssueId` is pulled into two different Sprints | Each Sprint gets its own independent `BacklogIssue` row — neither is overwritten or reused | N/A |
| NO_ACTIVE_SPRINT | No Sprint is active | Browsing still works; pull controls are replaced with "Create a Sprint to pull issues" | N/A |

</frozen-after-approval>

## Code Map

- `domain/youtrack.ts` — the `BacklogIssue` type/usages to rename to `YouTrackIssueSummary` (prerequisite).
- `domain/sprint.ts:36` `isUniqueConstraintViolation`, `:45` `createSprint`'s pre-check-then-DB-backstop shape — the exact pattern `pullBacklogIssue` mirrors for the `(sprintId, youtrackIssueId)` uniqueness.
- `infrastructure/db/sprint-repository.ts` — existing repo-implementation pattern to mirror for `backlog-issue-repository.ts`.
- `app/actions/youtrack.ts:49` `listBacklogIssuesAction` — the Server Action shape to mirror for `pullBacklogIssueAction`.
- `app/(pm)/sprint/backlog-drawer.tsx` — Story 3.2's drawer; add selection/estimate/pull state and UI to its existing `"loaded"` branch.
- `app/(pm)/sprint/page.tsx` — already fetches `activeSprint`; add the `backlogIssueRepository.listForSprint` fetch and thread both new props into `<BacklogDrawer>`.

## Tasks & Acceptance

**Execution:**
- [x] `domain/youtrack.ts` + usages -- rename `BacklogIssue` -> `YouTrackIssueSummary`.
- [x] `prisma/schema.prisma` -- add `BacklogIssue` model + back-relations -- migrate.
- [x] `domain/backlog-issue.ts` (new) -- `BacklogIssue`, `BacklogIssueRepo`, `pullBacklogIssue`.
- [x] `domain/backlog-issue.selfcheck.ts` (new) -- covers the I/O matrix using a fake repo (never a real DB).
- [x] `infrastructure/db/backlog-issue-repository.ts` (new) -- `BacklogIssueRepo` via Prisma.
- [x] `app/actions/backlog-issues.ts` (new) -- `pullBacklogIssueAction`.
- [x] `app/(pm)/sprint/backlog-drawer.tsx` -- selection, estimate inputs, Pull Selected, already-pulled tracking, no-active-Sprint gate.
- [x] `app/(pm)/sprint/page.tsx` -- fetch and thread `activeSprintId`/`pulledYoutrackIssueIds`.

**Acceptance Criteria:**
- Given a Backlog Issue with a value in the configured estimate custom field, when I pull it into the current Sprint, then its estimate hours are stored on the new `BacklogIssue` row (ready to be counted against whichever Team Member Story 3.4 later assigns it to).
- Given a Backlog Issue with no value in the configured estimate field, when I try to pull it, then I'm required to enter an hours estimate before the pull proceeds.
- Given the same YouTrack issue is pulled into two different Sprints over its lifetime, when each pull happens, then each Sprint gets its own independent local record — a later pull never overwrites or reuses an earlier Sprint's copy.

## Design Notes

"Prompted to enter an hours estimate manually" (AC #2) is implemented as an inline required number input rather than a separate modal/dialog — consistent with this app's existing non-modal validation style (the Allocation % editor, Leave Entry form) and avoiding a second UI pattern for what's fundamentally the same "fill in a required field before submitting" interaction already used elsewhere.

## Verification

**Commands:**
- `npx prisma migrate dev --name add_backlog_issue` -- expected: applies against the live Supabase connection.
- `npx tsc --noEmit` -- expected: no type errors.
- `npm run lint` -- expected: clean.
- `node domain/backlog-issue.selfcheck.ts` -- expected: all assertions pass, including the duplicate-pull rejection.
- Real-DB check (kept pattern from prior stories): pull the same issue into the same Sprint twice (confirm the second is rejected) and into two different Sprints (confirm two independent rows).
- `npm run dev` + manually: pull an issue with a YouTrack estimate and one without (confirm the required-field block); confirm a no-active-Sprint state shows "Create a Sprint to pull issues" instead of pull controls.

**Manual checks (if no CLI):**
- Visual check that a successfully-pulled row shows as pulled (badge, no longer selectable) without a page reload.

**Results (2026-08-19 pass):**

- Implemented directly (the prior two subagent dispatches this session were interrupted mid-task by transient failures, so this story was built in the main session for reliability).
- `npx prisma migrate dev --name add_backlog_issue` -- applied against the live Supabase connection; confirmed the generated SQL matches intent exactly (`BacklogIssue` table, `sprintId`/`assigneeId` FKs with `Cascade`/`SetNull`, the `(sprintId, youtrackIssueId)` unique index).
- `npx tsc --noEmit`, `npm run lint` -- both clean.
- `node domain/backlog-issue.selfcheck.ts` -- all assertions passed, including the two duplicate-pull scenarios. Re-ran `node domain/youtrack.selfcheck.ts` and `node infrastructure/youtrack/issues.selfcheck.ts` too, confirming the `BacklogIssue` -> `YouTrackIssueSummary` rename didn't break either sibling.
- **Real-DB check:** pulled the same YouTrack issue into the same (real, `closed`-status to avoid touching AD-6's active-Sprint constraint) Sprint twice via the real repo -- the second attempt was correctly rejected with "This issue has already been pulled into this Sprint," and pulling the same issue into a second Sprint correctly created an independent row (confirmed via `listForSprint` on both). Cascade-delete on Sprint cleanup left zero leftover `BacklogIssue` rows.
- Confirmed the Sprint page itself still renders correctly (SSR) with the new `backlogIssueRepository.listForSprint` fetch wired in.
- **Not verified this pass:** an interactive browser walkthrough of the drawer's actual pull UI (checkbox selection, estimate-field validation, the "Pull Selected" click flow, the pulled-badge transition) -- same standing Playwright-unreachable gap already logged for six prior stories; the headless-Edge fallback that worked for Story 2.4 didn't reproduce for Story 3.2's simpler async drawer, so it wasn't re-attempted here for an even more stateful one. The real-DB check above verifies the actual persistence/domain logic the UI calls into, not the UI interaction itself.

**Results (2026-08-19 review-patch pass):**

Three-layer adversarial review (Blind Hunter, Edge Case Hunter, Verification Gap) ran against the diff. Patched:

- `domain/backlog-issue.ts` -- added a real correctness gap all three layers converged on from different angles: `pullBacklogIssue` never checked that the target Sprint was actually active, so an issue could be pulled into a closed Sprint. Now takes an injected `Pick<SprintRepo, "findActive">` (mirroring `createSprint`'s own friendly pre-check pattern) and rejects with "This Sprint is no longer active." Also now distinguishes a foreign-key violation (`P2003`, e.g. the Sprint was deleted concurrently) from the existing unique-violation (`P2002`) handling, instead of letting it fall through to an opaque generic error.
- `prisma/schema.prisma` -- added `@@index([assigneeId])` (this schema's own established convention of indexing every FK column, which this model was missing) and a hand-added `CHECK ("estimateHours" > 0)` constraint, matching the two-layer app-check-plus-DB-constraint pattern already used for Leave/Holiday's `endDate` checks. Confirmed via real-DB check: writing a negative estimate directly through Prisma (bypassing the domain layer entirely) is now rejected by the constraint.
- `infrastructure/db/backlog-issue-repository.ts` -- `listForSprint` now has an explicit `orderBy: {id: "asc"}` -- Postgres gives no row-order guarantee without one, and a future "list of pulled issues" view (likely Story 3.4) would otherwise inherit unspecified ordering.
- `app/(pm)/sprint/backlog-drawer.tsx` -- the "Pull Selected (N)" button label counted every *checked* row (`selected.size`) even though only rows with a valid estimate actually get submitted (`selectedValid`) -- all three review layers independently flagged this exact mismatch. Now: the label counts `selectedValid.length`; a checked-but-invalid row shows an inline "Enter an estimate to include this issue when pulling" hint instead of silently being dropped with no explanation; the client-side validity check now also verifies `Number.isFinite` (matching the domain layer's own check) rather than just `> 0`; checkboxes and estimate inputs are now `disabled` while a pull is in flight; `pullErrors` now merges across batches instead of replacing the whole map (a still-checked, not-retried item's error from an earlier batch no longer vanishes when a later batch pulls different issues); removed the estimate input's inert `required` attribute (there's no surrounding `<form>`, so it never did anything -- the actual gating is the inline hint plus the button's `disabled` state); added `aria-live="polite"` to the issue list so pulled/error state changes are announced.

Deferred (see `deferred-work.md`): no upper bound on `estimateHours` or max-length on `title`/`youtrackIssueId` (product judgment call, low urgency); `page.tsx` discarding all `BacklogIssue` fields but `youtrackIssueId` (no current UI needs more); `pulledIds` not re-synced from the server prop on reopen (narrow, single-PM-tool risk); no persistent automated test for the repository's own Prisma mapping (real-DB check already covered this pass); no protection against overlapping drawer-reopen requests or a pull-batch timeout (same-origin DB calls, not the external-network case Stories 3.1/3.2 needed timeouts for).

Re-ran `npx tsc --noEmit`, `npm run lint`, `node domain/backlog-issue.selfcheck.ts` (now covering the active-Sprint rejection too) -- all clean/passing after patches. Re-ran the real-DB check: pulling into a closed Sprint and into a nonexistent Sprint id are both now correctly rejected with "This Sprint is no longer active"; the CHECK constraint correctly fires on a direct negative-estimate write that bypasses the domain layer entirely; zero leftover rows after cleanup.

## Suggested Review Order

**Domain: validate → active-Sprint check → persist**

- `pullBacklogIssue` -- the review-patch active-Sprint guard is the most consequential fix in this pass; also now distinguishes a foreign-key violation from the existing unique-violation handling.
  [`backlog-issue.ts:59`](../../domain/backlog-issue.ts#L59)

- `backlog-issue.selfcheck.ts` -- covers the I/O matrix plus the review-patch `SPRINT_NOT_ACTIVE` case (no active Sprint, and a Sprint that doesn't match the active one).
  [`backlog-issue.selfcheck.ts:1`](../../domain/backlog-issue.selfcheck.ts#L1)

**Infrastructure: the two-layer constraint pattern**

- `prisma/schema.prisma`'s `BacklogIssue` model -- the review-patch `@@index([assigneeId])` and hand-added `estimateHours > 0` CHECK constraint, mirroring this schema's established conventions.
  [`schema.prisma:126`](../../prisma/schema.prisma#L126)

- `backlogIssueRepository` -- the review-patch `orderBy` fix.
  [`backlog-issue-repository.ts:4`](../../infrastructure/db/backlog-issue-repository.ts#L4)

**UI**

- `BacklogDrawer` -- the review-patch fixes to the "Pull Selected" count/validity mismatch (flagged independently by all three review layers), the merge-not-replace `pullErrors` fix, and the in-flight `disabled` states.
  [`backlog-drawer.tsx:25`](../../app/(pm)/sprint/backlog-drawer.tsx#L25)

- `pullBacklogIssueAction` -- now injects the real `sprintRepository` alongside `backlogIssueRepository`.
  [`backlog-issues.ts:8`](../../app/actions/backlog-issues.ts#L8)
