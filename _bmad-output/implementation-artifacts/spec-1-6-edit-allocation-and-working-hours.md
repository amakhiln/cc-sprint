---
title: 'Edit Allocation % and Working Hours'
type: 'feature'
created: '2026-08-17'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Working Hours per Day is only ever set once, at Team Member creation (Story 1.2) — there's no way to change it afterward. Re-editing Allocation % is already possible today (Story 1.5's panel reopens pre-filled and re-saves via a full replace), so the only missing capability is Working Hours editing.

**Approach:** Add a `updateTeamMemberWorkingHours` domain function (same validation range as creation, extracted into a shared helper) and wire the existing Team Member Detail Panel's read-only Working Hours display into an editable input, saved together with Allocation % in the same Save action.

## Boundaries & Constraints

**Always:**
- Extract `addTeamMember`'s inline working-hours range check (integer, 1-24) into a shared `validateWorkingHoursPerDay` helper — same shape as the existing `validateAllocationCategoryName` helper — reused by both `addTeamMember` and the new function.
- `domain/allocation.ts`: add `TeamMemberRepo.updateWorkingHours(id, workingHoursPerDay): Promise<TeamMember | null>` (null means not found) and `updateTeamMemberWorkingHours(repo, id, workingHoursPerDay)` — same discriminated-result shape as existing functions.
- `infrastructure/db/team-member-repository.ts`'s new `updateWorkingHours` uses the `update()` + catch-`P2025` style (not `updateMany`+count) — the corrected pattern from Story 1.4's patch pass, not `archive`'s older un-retrofitted style.
- New `updateTeamMemberWorkingHoursAction` in `app/actions/team-members.ts` (same file as the other Team Member actions), same type-guarded/try-catch/`revalidatePath("/roster")` shape.
- `app/(pm)/roster/team-member-detail-panel.tsx`: the read-only "Working Hours / Day" display becomes an editable number input (same `min={1} max={24}` range as `add-team-member-form.tsx`), local state alongside `percents`. The one Save button submits both the allocation set and the working-hours update together (e.g. `Promise.all` of both actions); only close the dialog if both succeed, otherwise show whichever error occurred.

**Ask First:** _None known._

**Never:**
- No closed-Sprint immutability enforcement in this story — no `Sprint` model exists yet (Story 1.7) and no snapshot mechanism exists until Epic 4, so "a closed Sprint's recorded Capacity isn't recalculated" is vacuously true today, not implemented. Don't build speculative snapshot/versioning logic here.
- No change to how Allocation % editing already works (Story 1.5's `setTeamMemberAllocations` full-replace is already re-editable) — this story only adds Working Hours editing.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_EDIT_HOURS | Valid new Working Hours (1-24) | Saved, reflected on reload | N/A |
| INVALID_HOURS | 0, >24, or non-integer | Rejected | `{ok:false, error}`, no change |
| HOURS_NOT_FOUND | Update targeting a removed/nonexistent id | Rejected | `{ok:false, error}`, not an unhandled throw |
| RE_EDIT_PERCENT_REGRESSION | Change an already-saved allocation breakdown to new percentages | Saved, new values persist and display on reload | N/A |

</frozen-after-approval>

## Code Map

- `domain/allocation.ts` — `addTeamMember` (line 30) has the inline working-hours range check to extract; `validateAllocationCategoryName` (line 100) is the helper shape to mirror for the new `validateWorkingHoursPerDay`; `TeamMemberRepo` port (line 11) needs the new `updateWorkingHours` method.
- `infrastructure/db/team-member-repository.ts` — `archive` (line 14) uses the older `updateMany`+`findUniqueOrThrow` pattern; do NOT mirror it. `infrastructure/db/allocation-category-repository.ts`'s `rename`/`remove` (the `update`/`delete` + catch-`P2025` style) is the pattern to mirror instead.
- `app/actions/team-members.ts` — `addTeamMemberAction`/`removeTeamMemberAction` (lines 12, 48) are the Server Action pattern to mirror for the new `updateTeamMemberWorkingHoursAction`.
- `app/(pm)/roster/team-member-detail-panel.tsx` — read-only Working Hours display (lines 99-103) becomes editable; `handleSave` (line 53) needs to also submit the working-hours update.
- `app/(pm)/roster/add-team-member-form.tsx` — the existing `min={1} max={24}` number input to mirror for the new editable field.

## Tasks & Acceptance

**Execution:**
- [x] `domain/allocation.ts` -- extract `validateWorkingHoursPerDay` from `addTeamMember`'s inline check; add `TeamMemberRepo.updateWorkingHours` to the port; add `updateTeamMemberWorkingHours(repo, id, workingHoursPerDay)`.
- [x] `infrastructure/db/team-member-repository.ts` -- implement `updateWorkingHours` using `update()` + catch-`P2025`.
- [x] `app/actions/team-members.ts` -- add `updateTeamMemberWorkingHoursAction`, same error-handling shape as sibling actions.
- [x] `app/(pm)/roster/team-member-detail-panel.tsx` -- make Working Hours an editable, bounded number input; `handleSave` submits both the allocation set and the working-hours update together, closing the dialog only if both succeed.
- [x] `app/(pm)/roster/page.tsx` -- no change expected (already passes `workingHoursPerDay`; confirm the panel still receives fresh data after `revalidatePath`).

**Acceptance Criteria:**
- [x] Given a Team Member has an existing Allocation % breakdown, when I edit and save new percentages or Working Hours, then the change applies (current and future display) immediately.
- [x] Given invalid Working Hours (0, >24, or non-integer), when I try to save, then the save is rejected with a clear error and no change is persisted.

## Design Notes

`validateWorkingHoursPerDay`'s extraction is a pure refactor of existing logic — `addTeamMember`'s behavior must not change (same error message, same 1-24 range). The panel's combined save (`Promise.all` of two independent Server Actions) keeps the two aggregates' domain functions separate per the hexagonal one-repo-per-aggregate convention, while still giving the user one Save button for the whole panel, matching the mockup's single-panel-single-save shape.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: no type errors.
- `npm run lint` -- expected: clean.
- `node domain/allocation.selfcheck.ts` -- expected: extend with `updateTeamMemberWorkingHours` cases (valid, 0, >24, non-integer, not-found) and confirm `addTeamMember`'s existing behavior is unchanged after the extraction; all assertions pass.
- `npm run dev` + manually: open a Team Member's detail panel, edit Working Hours to a valid value and save (persists on reload), attempt an invalid value (rejected, no change), edit an already-set Allocation % breakdown to new values and save (persists on reload).

**Results (previous pass)**

Playwright browser tools were unavailable in that session (confirmed via tool search before starting — no browser-navigate-capable tool present; a prior run had stalled 10 minutes waiting on a disconnected Playwright MCP session). Per fallback instructions, ran an **infra-level verification against the real Supabase Postgres DB** instead of a browser walkthrough — this is not a substitute for a full UI/browser check, only for the real-repo behavior underneath it.

Method: a throwaway Node script (`_selfcheck-real-db.ts`, deleted after the run, along with its throwaway ESM loader hook used only to resolve the project's `@/...` path aliases and extensionless relative imports under plain `node`) imported the real `teamMemberRepository`, `teamMemberAllocationRepository`, and `allocationCategoryRepository` from `infrastructure/db/`, plus `updateTeamMemberWorkingHours` and `setTeamMemberAllocations` from `domain/allocation.ts`. It seeded one team member and one allocation category directly through the real repos, exercised each scenario, asserted against a fresh `list()`/`listForTeamMember()` read (not just the mutating call's return value), then hard-deleted the seeded team member (cascades its allocations) and category and disconnected. A follow-up raw-SQL count confirmed zero leftover `SELFCHECK-REALDB%` rows in `TeamMember`/`AllocationCategory` after cleanup.

| Scenario | Path taken | Outcome |
|----------|-----------|---------|
| HAPPY_EDIT_HOURS | Infra fallback (real Postgres) | PASS — `updateTeamMemberWorkingHours(teamMemberRepository, id, 5)` returned `{ok:true}`; a fresh `teamMemberRepository.list()` read back `workingHoursPerDay === 5`. |
| INVALID_HOURS | Infra fallback (real Postgres) | PASS — `0`, `25`, and `4.5` were each rejected (`{ok:false}`); a fresh `list()` after all three attempts still showed the prior value (`5`), unchanged. |
| HOURS_NOT_FOUND | Not re-verified this pass (already covered by the fake-repo self-check, per instruction) | N/A |
| RE_EDIT_PERCENT_REGRESSION | Infra fallback (real Postgres) | PASS — first `setTeamMemberAllocations(..., [{categoryId, percent: 30}])` persisted one row at 30%; a second call with `percent: 70` for the same team member/category left exactly one row read back at 70% (full replace, no duplication, no stale 30% value). |

No full UI/browser check was performed that pass; re-run the `npm run dev` manual walkthrough above once Playwright tooling is confirmed reachable.

**Results (this pass — patch pass, 2026-08-17)**

Applied six review findings from Blind Hunter / Edge Case Hunter / Verification Gap:

1. `team-member-detail-panel.tsx` Working Hours `onChange` now clamps with `Math.min(24, Math.max(1, Math.trunc(value)))` whenever `Number.isFinite(value)` (matching the percent inputs' clamp shape), falling back to `1` only when the parsed value is genuinely `NaN`. Clearing the field no longer silently sets hours to `0`.
2. `handleSave` no longer short-circuits on the first failing result — both `allocationResult`/`hoursResult` errors are collected and joined (newline-separated), and the error `<p>` renders each line separately, so a simultaneous double-failure shows both messages instead of only the allocation one.
3. `team-member-repository.ts`'s `updateWorkingHours` now uses the same atomic `updateMany({ where: { id, archivedAt: null } })` + count-check + `findUniqueOrThrow` shape as `archive`, with a comment explaining why this is a deliberate exception to the story's stated `update()`+catch-`P2025` preference (plain `update()` can't express `archivedAt: null` as an additional filter). The now-unused `Prisma` import was removed.
4. `DialogDescription` copy updated to "Team member details, working hours, and allocation."
5. The Working Hours `<label>` now has `htmlFor="working-hours-per-day"` matching the input's new `id="working-hours-per-day"`; the existing `aria-label` was left in place.

Reran the full Verification section after applying all patches:

- `npx tsc --noEmit` — PASS, no type errors.
- `npm run lint` — PASS, clean.
- `node domain/allocation.selfcheck.ts` — PASS, all assertions (unchanged; this suite still runs against the fake in-memory repo, which does not model the `archivedAt` guard added in patch #3 — that's exactly the gap item 6 below closes for real).
- New real-DB check for item 6 (Verification Gap finding): a throwaway script (`_selfcheck-real-db.ts` + throwaway loader `_ts-loader.mjs`, same pattern as the previous pass, both deleted after the run) called `teamMemberRepository.updateWorkingHours` directly against the live Supabase Postgres DB:
  - `updateWorkingHours(nonexistentId, 5)` → **PASS**, resolved to `null` (not a throw).
  - Seeded a team member, archived it via `teamMemberRepository.archive`, then called `updateWorkingHours(archivedId, 4)` → **PASS**, resolved to `null`, confirming patch #3's `archivedAt: null` guard rejects writes to archived members.
  - Re-read the archived row via `prisma.teamMember.findUniqueOrThrow` → **PASS**, `workingHoursPerDay` still `8` (unchanged by the rejected write).
  - Hard-deleted the seeded row and confirmed a `count()` for `name: { startsWith: "SELFCHECK-REALDB" }` returned `0` — no leftover rows.

No UI/browser walkthrough was performed this pass (out of scope for a patch pass over already-reviewed diff findings); the outstanding `npm run dev` manual walkthrough from the previous pass still applies if/when Playwright tooling is reachable.

## Suggested Review Order

**Domain: the shared validator and the new function**

- Entry point -- the extracted, reusable range check both `addTeamMember` and the new function call.
  [`allocation.ts:31`](../../domain/allocation.ts#L31)

- `updateTeamMemberWorkingHours` -- same discriminated-result shape as its siblings, delegates the not-found/archived check to the repo.
  [`allocation.ts:72`](../../domain/allocation.ts#L72)

**Infrastructure: the deliberate pattern exception**

- `updateWorkingHours` uses `updateMany`+count instead of this story's own stated `update()`+catch-`P2025` preference -- the comment explains why (`archivedAt: null` can't be expressed on a unique-only `update()`). This was itself a patch-pass fix for a real archived-member gap.
  [`team-member-repository.ts:27`](../../infrastructure/db/team-member-repository.ts#L27)

**UI: the combined-save panel**

- `handleSave` -- both actions run in parallel; the dialog only closes if both succeed, and a patch-pass fix now surfaces both error messages on a double failure instead of dropping one.
  [`team-member-detail-panel.tsx:55`](../../app/(pm)/roster/team-member-detail-panel.tsx#L55)

- The Working Hours input -- a patch-pass fix added the same clamp shape the percent inputs already used, plus label/id wiring.
  [`team-member-detail-panel.tsx:116`](../../app/(pm)/roster/team-member-detail-panel.tsx#L116)

**Server Actions**

- `updateTeamMemberWorkingHoursAction` -- same type-guard/try-catch/`revalidatePath` shape as its siblings.
  [`team-members.ts:78`](../../app/actions/team-members.ts#L78)

**Peripheral**

- The self-check's fake `TeamMemberRepo` and the two new cases -- note it doesn't model the archived-member guard (patch #3), which is why a separate real-DB check exists (see this file's Verification section).
  [`allocation.selfcheck.ts:84`](../../domain/allocation.selfcheck.ts#L84)
