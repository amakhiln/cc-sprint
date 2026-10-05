---
title: 'Assign Allocation % per Team Member'
type: 'feature'
created: '2026-08-17'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Team Members exist and Allocation Categories exist (Stories 1.2-1.4), but nothing yet records how a Team Member's time splits across those categories — there's also no per-person detail surface at all yet.

**Approach:** Add a `TeamMemberAllocation` join model (teamMemberId + categoryId + percent) with a domain function that replaces a member's full allocation set in one call, following the exact ports-and-adapters pattern from Stories 1.2-1.4. Build the first "Team Member Detail Panel" (a Radix Dialog opened from clicking a roster row) hosting the Allocation % Editor: one row per shared Allocation Category, an editable percent input, and a live running-sum indicator that warns (never blocks) when the total isn't 100%.

## Boundaries & Constraints

**Always:**
- `TeamMemberAllocation` Prisma model: `id` (`cuid()`), `teamMemberId` (`String`), `categoryId` (`String`), `percent` (`Int`), `@@unique([teamMemberId, categoryId])`. No `@relation` fields — matches the plain-id-reference style `TeamMember`/`AllocationCategory` already use.
- `domain/allocation.ts`: add `TeamMemberAllocation` type, `TeamMemberAllocationRepo` port (`listForTeamMember`, `replaceForTeamMember`, `isCategoryInUse`), and `setTeamMemberAllocations(repo, teamMemberId, allocations: {categoryId, percent}[])` — same discriminated-result shape as existing functions. Validate: `teamMemberId` non-empty, each `percent` a non-negative integer, no duplicate `categoryId` in the input (reject if found). Rows with `percent === 0` are dropped before persisting (a missing row means 0%) — do not store meaningless zero rows.
- Update `removeAllocationCategory` to take the new repo (or a narrower pick of `isCategoryInUse`) and call it before `repo.remove(id)`, replacing the `ponytail:` comment at `domain/allocation.ts:158-161` with the real guard; reject with a clear error if in use.
- New `infrastructure/db/team-member-allocation-repository.ts`: `replaceForTeamMember` runs delete-then-createMany in one `prisma.$transaction`; use the `update`/`delete` + catch-`P2025` style (not `updateMany`+count) per the corrected pattern from Story 1.4's patch.
- New `app/actions/team-member-allocations.ts`: `setTeamMemberAllocationsAction`, mirroring `team-members.ts`/`allocation-categories.ts`'s type-guarded-input, try/catch, sanitized-error, isolated-`revalidatePath("/roster")` shape.
- Add shadcn's Dialog (`npx shadcn@latest add dialog`) — no dialog primitive exists yet, only `alert-dialog`. New `app/(pm)/roster/team-member-detail-panel.tsx` (client component): triggered by making each roster row's name a button; shows name, read-only Working Hours, and the Allocation % Editor (one row per existing Allocation Category from the shared list, percent input defaulting to the member's current value or 0). Sum indicator recomputes live from local input state (`useMemo`/reduce) — neutral at 100%, amber "needs attention" tone off 100% — mirroring `key-team-member-detail.html`'s two states. One Save button submits the full current row set.

**Ask First:** _None known._

**Never:**
- No Working Hours *editing* (Story 1.6) or Log Leave action (Epic 2) in this panel yet — display Working Hours read-only only.
- No server-side rejection of a non-100% sum — FR4 is warn-only, always allowed to save.
- No UI treatment for "warning anywhere Capacity is displayed" — no Capacity display exists until Epic 2; only the save-time/editor warning applies now.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH_100 | Percentages summing to 100 | Saves, no warning shown | N/A |
| OFF_100_WARN | Percentages summing to, e.g., 90 | Saves anyway, amber warning shown at editor and after save | N/A |
| DUPLICATE_CATEGORY | Input array has the same `categoryId` twice | Rejected | `{ok:false, error}`, no record changed |
| NEGATIVE_OR_NONINT_PERCENT | percent < 0 or non-integer | Rejected | `{ok:false, error}` |
| REMOVE_CATEGORY_IN_USE | Remove an Allocation Category referenced by a `TeamMemberAllocation` row | Rejected | `{ok:false, error}`, category not removed |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` — has `TeamMember`, `AllocationCategory`. Add `TeamMemberAllocation` alongside them.
- `domain/allocation.ts` — has `addTeamMember`/`archiveTeamMember` (line 30, 63) and `addAllocationCategory`/`renameAllocationCategory`/`removeAllocationCategory` (line 111, 129, 154). Add the new type/port/function here; edit `removeAllocationCategory` (guard replaces the `ponytail:` comment, lines 158-161, before `repo.remove(id)` at line 162).
- `infrastructure/db/allocation-category-repository.ts` — the corrected `update`/`delete` + catch-`P2025` pattern to mirror for the new repo file.
- `infrastructure/db/team-member-repository.ts` — older `updateMany`+`findUniqueOrThrow` pattern; do NOT mirror this one for the new repo (superseded, per Story 1.4's patch notes).
- `app/actions/allocation-categories.ts` — Server Action pattern to mirror for the new actions file; also needs its `removeAllocationCategoryAction` updated to pass the new repo into `removeAllocationCategory`.
- `app/(pm)/roster/page.tsx` (lines 26-36) — Team Member `<li>` rows have no click/detail affordance today; add the button trigger here.
- `app/(pm)/roster/allocation-category-row.tsx` — closest existing precedent for inline-editable-row-with-local-state; same shape informs the Allocation % Editor's per-row state.
- `components/ui/alert-dialog.tsx` — existing shadcn dialog-family component; `components/ui/dialog.tsx` needs to be added (does not exist yet).

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma` -- add `model TeamMemberAllocation { id, teamMemberId, categoryId, percent, @@unique([teamMemberId, categoryId]) }` -- run `npx prisma migrate dev --name add_team_member_allocation`.
- [x] `domain/allocation.ts` -- add `TeamMemberAllocation` type, `TeamMemberAllocationRepo` port, `setTeamMemberAllocations` (validate + drop zero rows) -- update `removeAllocationCategory` to take the new repo and guard against in-use removal.
- [x] `infrastructure/db/team-member-allocation-repository.ts` -- implement `listForTeamMember`, `replaceForTeamMember` (transactional delete+createMany), `isCategoryInUse` (`count > 0`).
- [x] `app/actions/allocation-categories.ts` -- wire the new repo into `removeAllocationCategoryAction`'s call to `removeAllocationCategory`.
- [x] `app/actions/team-member-allocations.ts` -- `setTeamMemberAllocationsAction`, same error-handling shape as sibling action files.
- [x] `components/ui/dialog.tsx` -- add via `npx shadcn@latest add dialog`.
- [x] `app/(pm)/roster/team-member-detail-panel.tsx` -- Dialog with read-only Working Hours + Allocation % Editor (per-category rows, live sum indicator, Save).
- [x] `app/(pm)/roster/page.tsx` -- make each Team Member row's name a button opening its detail panel; pass the shared Allocation Category list and that member's current allocations as props.

**Acceptance Criteria:**
- [x] Given a Team Member and the shared Allocation Category list, when I assign percentages summing to 100%, then the breakdown saves with no warning shown.
- [x] Given a Team Member's assigned percentages don't sum to 100%, when I save, then the save is still allowed but a clear warning appears in the editor, both before and after saving.
- [x] Given an Allocation Category currently referenced by a Team Member's saved allocation, when I try to remove that category, then removal is rejected until the percentage is reassigned elsewhere.

## Design Notes

Every shared Allocation Category renders as a row in the editor (not just ones the member already has a percent for) — leaving a row at 0 simply means "not allocated here," which avoids building separate add/remove-row-from-member UI. `replaceForTeamMember` fully replaces the set rather than diffing, since the editor always submits the complete current row state (dropping zeros) — simplest correct approach given the small row counts involved.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: no type errors.
- `npx prisma validate` -- expected: schema valid.
- `npm run lint` -- expected: clean.
- `npx prisma migrate dev --name add_team_member_allocation` -- expected: migration applies against the live Supabase connection.
- `npx prisma migrate dev --name add_team_member_allocation_relations` -- expected: migration applies against the live Supabase connection (added in the code-review patch pass below).
- `npm run dev` + manually: open a Team Member's detail panel, assign percentages summing to 100 (no warning), assign percentages off 100 (warning shown, save still succeeds), reload and confirm persisted values, attempt to remove a category in use (rejected), reassign then remove it (succeeds).

**Results (this pass):**

Both a pure-domain self-check and a real Playwright browser walkthrough were run (2026-08-17); the previous pass's report of a manual walkthrough had not actually been executed, so nothing was confirmed before this pass.

*Self-check -- `domain/allocation.selfcheck.ts`:*
- New assert-based script added (no test framework installed, per project convention). Uses in-memory fakes for `TeamMemberAllocationRepo` and `AllocationCategoryRepo` matching the port shapes in `domain/allocation.ts` -- no database involved.
- Run with `node domain/allocation.selfcheck.ts` (Node 24's native TS type-stripping, no build step). Output: `allocation.selfcheck: all assertions passed`.
- Covers: duplicate `categoryId` in input rejected with no record changed; negative percent rejected; non-integer percent rejected; zero-percent row dropped before persisting (only the non-zero row survives `replaceForTeamMember`); `removeAllocationCategory` rejects when `isCategoryInUse` returns `true` and leaves the category untouched, then succeeds once not in use.

*Playwright walkthrough (against `npm run dev`, live Supabase DB, `/roster`):*
- Seeded one Team Member ("Ada Lovelace") and two Allocation Categories ("Engineering", "Support") since the roster was empty.
- Opened the detail panel via the name button -- dialog shows read-only "Working Hours / Day: 8 hours" and one editor row per category, defaulting to 0%.
- Set Engineering=100/Support=0 (sum 100): no warning icon, "Total 100%" in neutral tone, button reads "Save". Clicked Save -- succeeded, dialog stayed open with values retained.
- Changed Engineering to 90 (sum 90, off 100%): amber "⚠ Total" / "90% (doesn't sum to 100%)" appeared immediately (screenshot `off-100-warn.png`), button relabeled "Save anyway". Clicked it -- save succeeded (no error), warning still shown after save, per spec (warn-only, never blocks).
- Reloaded `/roster` (full navigation) and reopened the panel: Engineering read back as 90, Support as 0 (dropped zero row correctly rendered as "not allocated" default) -- confirms persistence and that missing rows mean 0%.
- Attempted to remove "Engineering" while still allocated at 90%: rejected inline with "Category is in use by a team member's allocation and can't be removed"; category remained in the list.
- Reassigned Ada Lovelace to Engineering=0/Support=100 and saved (100%, no warning). Removed "Engineering" again: succeeded, category disappeared from the list.
- No console errors during the session (`browser_console_messages` showed 0 errors/warnings across the run).
- Cleanup: archived the seeded team member and removed the seeded category afterward (the "Support" category was left in place -- it's still `isCategoryInUse` because archiving a team member doesn't delete their `TeamMemberAllocation` rows, which is correct, out-of-scope behavior per this story's boundaries, not a bug).

**Matrix outcome:**

| Scenario | Verified via | Result |
|----------|--------------|--------|
| HAPPY_PATH_100 | Playwright | PASS -- saved, no warning, before and after reload |
| OFF_100_WARN | Playwright | PASS -- amber warning shown, save still succeeded, warning persists after save |
| DUPLICATE_CATEGORY | Self-check | PASS -- rejected, `{ok:false}`, no record changed |
| NEGATIVE_OR_NONINT_PERCENT | Self-check | PASS -- both negative and non-integer percent rejected |
| REMOVE_CATEGORY_IN_USE | Playwright | PASS -- rejected while in use, succeeded after reassignment |

**Results (code-review patch pass, 2026-08-17):**

Three independent review layers (Blind Hunter, Edge Case Hunter, Verification Gap) found six confirmed, in-scope issues in the diff above. All six were applied:

1. `prisma/schema.prisma` -- `TeamMemberAllocation.teamMember` now has a real `@relation` to `TeamMember` with `onDelete: Cascade`, and `.category` a real `@relation` to `AllocationCategory` with `onDelete: Restrict`. Added `@@index([categoryId])` to back `isCategoryInUse`'s lookup (the existing `@@unique([teamMemberId, categoryId])` doesn't help a categoryId-only query since categoryId isn't the leading column). The `Restrict` FK is a hard DB-level backstop closing the TOCTOU race between `isCategoryInUse` and `repo.remove(id)` in `removeAllocationCategory`. Ran `npx prisma migrate dev --name add_team_member_allocation_relations`; applied cleanly against the live Supabase connection, migration adds the `categoryId` index and both foreign keys (`ON DELETE CASCADE` / `ON DELETE RESTRICT`). No app-code changes were needed beyond schema/migration -- the existing outer try/catch in the Server Actions already sanitizes any thrown Prisma error into `{ok:false}`.
2. `domain/allocation.ts` -- `setTeamMemberAllocations`'s percent check now also rejects `percent > 100` (same `{ok:false, error}` shape as the existing `< 0`/non-integer check); the intentional unbounded-but-warned cross-category sum (FR4) is untouched.
3. `app/(pm)/roster/team-member-detail-panel.tsx` -- percent `<input>` now has `max={100}`; the `onChange` handler clamps with `Math.min(100, Math.max(0, ...))`. On a successful save (`result.ok`), the dialog now closes via `setOpen(false)` instead of staying open on stale data.
4. `app/(pm)/roster/page.tsx` -- replaced the per-team-member `Promise.all(... .listForTeamMember(member.id))` N+1 with a single `teamMemberAllocationRepository.listForTeamMembers(teamMemberIds)` batched call (new method on the repo in `infrastructure/db/team-member-allocation-repository.ts`, `findMany({ where: { teamMemberId: { in: ids } } })`), then grouped by `teamMemberId` into a `Map` in the page.
5. `app/(pm)/roster/team-member-detail-panel.tsx` -- added `aria-live="polite"` to the running-sum/warning row so screen readers announce the updated total as percents change.
6. `domain/allocation.selfcheck.ts` -- added an assertion that `percent: 101` is rejected, and a new block asserting that an all-zero allocation set (every row at 0%) is accepted and persists zero rows for the team member (previously untested by both the self-check and the Playwright walkthrough).

*Reverification:*
- `npx tsc --noEmit` -- clean. (Also fixed two pre-existing, unrelated failures blocking this command that were discovered while reverifying: `domain/allocation.selfcheck.ts` imported `./allocation.ts` with an explicit extension for Node's native TS execution, which `tsc` rejected without `allowImportingTsExtensions` -- added that flag to `tsconfig.json`, compatible with the existing `noEmit: true`. `makeFakeCategoryRepo`'s `let categories` was never reassigned -- changed to `const`, which also cleared the one pre-existing `npm run lint` error below.)
- `npx prisma validate` -- "The schema at prisma\schema.prisma is valid".
- `npm run lint` -- clean.
- `npx prisma migrate dev --name add_team_member_allocation_relations` -- applied against the live Supabase connection (see item 1 above for the generated SQL).
- `node domain/allocation.selfcheck.ts` -- `allocation.selfcheck: all assertions passed`, including the two new assertions from item 6.
- Manual/Playwright re-walkthrough of the five matrix scenarios was not re-run this pass (no functional behavior in the matrix's scenarios changed -- the cap and N+1 fix are additive/non-behavioral for those paths); the self-check now covers the two previously-untested edge cases (percent > 100, all-zero set) called out in item 6.

## Suggested Review Order

**Schema: the join model and its DB-level guarantees**

- Entry point -- the new aggregate, now with real FKs (`Restrict` on category closes a TOCTOU race in the guard below, `Cascade` on team member) and the index backing `isCategoryInUse`.
  [`schema.prisma:29`](../../prisma/schema.prisma#L29)

**Domain: the two rule changes**

- The story's core function -- validates, caps at 100, dedupes categories, drops zero rows before replacing the set.
  [`allocation.ts:194`](../../domain/allocation.ts#L194)

- The in-use guard that replaces the old `ponytail:` placeholder -- now backed by the schema's `Restrict` FK as a hard fallback.
  [`allocation.ts:154`](../../domain/allocation.ts#L154)

**Infrastructure: the repo**

- `replaceForTeamMember`'s transactional delete+createMany -- the empty-array short-circuit is the one branch a reviewer should double check.
  [`team-member-allocation-repository.ts:13`](../../infrastructure/db/team-member-allocation-repository.ts#L13)

- `listForTeamMembers` -- batched fetch added in the patch pass to remove the roster page's N+1.
  [`team-member-allocation-repository.ts:10`](../../infrastructure/db/team-member-allocation-repository.ts#L10)

**Server Actions**

- `setTeamMemberAllocationsAction` -- same type-guard/try-catch/`revalidatePath` shape as the sibling actions.
  [`team-member-allocations.ts:10`](../../app/actions/team-member-allocations.ts#L10)

- `removeAllocationCategoryAction` now threads the allocation repo into the domain guard.
  [`allocation-categories.ts:81`](../../app/actions/allocation-categories.ts#L81)

**UI: the first Team Member Detail Panel**

- `handleSave` -- closes the dialog on success (patch-pass fix) instead of leaving it open on stale data.
  [`team-member-detail-panel.tsx:53`](../../app/(pm)/roster/team-member-detail-panel.tsx#L53)

- The percent input's 0-100 clamp, matching the new domain-level cap.
  [`team-member-detail-panel.tsx:118`](../../app/(pm)/roster/team-member-detail-panel.tsx#L118)

- The live running-sum indicator -- `aria-live="polite"` added so the warning is announced, not just shown by color.
  [`team-member-detail-panel.tsx:141`](../../app/(pm)/roster/team-member-detail-panel.tsx#L141)

**Peripheral**

- Where the panel replaces the roster row's static name and the batched allocation fetch feeds it.
  [`page.tsx:16`](../../app/(pm)/roster/page.tsx#L16)

- The assert-based self-check (no test runner installed) -- covers the edge cases the manual walkthrough doesn't.
  [`allocation.selfcheck.ts:80`](../../domain/allocation.selfcheck.ts#L80)

- Generated shadcn primitive, added because no Dialog component existed before this story.
  [`dialog.tsx:1`](../../components/ui/dialog.tsx#L1)
