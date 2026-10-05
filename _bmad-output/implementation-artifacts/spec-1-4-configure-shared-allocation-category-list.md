---
title: 'Configure Shared Allocation Category List'
type: 'feature'
created: '2026-08-14'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** There's no way to define the Allocation Categories (Dev, Management, DevOps, etc.) that Team Members will eventually split their time across — Story 1.5 (per-person Allocation %) has nothing to assign against yet.

**Approach:** Add the `AllocationCategory` model (name only) and a second domain/infrastructure/action set following the exact pattern from Stories 1.2/1.3, plus a management section on the Roster page (add, rename, remove).

**Scope note:** two of the epics' listed AC behaviors — "rename propagates to existing Team Member allocations" and "removal blocked while a category is assigned to a Team Member" — reference the `TeamMemberAllocation` join table that Story 1.5 creates, which doesn't exist yet. This story implements rename (there's nothing else that could hold a stale copy of the name yet — everything reads the category by id, so a rename is automatically reflected everywhere) and implements removal with a real in-use guard, but the guard can only check "does anything reference this category" once Story 1.5's join table exists. See Boundaries below for how removal is scoped for this story specifically.

## Boundaries & Constraints

**Always:**
- `AllocationCategory` Prisma model: `id` (`cuid()`), `name` (`String`) — no other fields yet.
- Domain functions live in `domain/allocation.ts` alongside the Team Member functions (per the Architecture Spine, this file owns all of FR-1 through FR-5): `addAllocationCategory`, `renameAllocationCategory`, `removeAllocationCategory` — same framework-free, repo-as-parameter, discriminated-result shape as `addTeamMember`/`archiveTeamMember`.
- New port `AllocationCategoryRepo` (`create`, `list`, `rename`, `remove`) — a separate port/repository from `TeamMemberRepo`, since it's a distinct aggregate (per the Architecture Spine's "one repository per aggregate" convention). New file: `infrastructure/db/allocation-category-repository.ts`.
- Name is required, same trim/blank/max-length (200 char) validation as Team Member names.
- Rename: since nothing in the codebase yet stores a category's name anywhere except by reference to its id (no join table exists to hold a stale copy), a rename is automatically "everywhere" the moment the row updates — no propagation logic needed in this story.
- Remove: since `TeamMemberAllocation` doesn't exist yet, nothing can currently reference a category, so removal in this story is unconditional (no in-use check is possible or needed yet). Structure `removeAllocationCategory` so that adding the in-use guard later (Story 1.5) is a small, additive change — e.g. leave a clear spot/comment for where that check will go, don't write removal logic that would need to be re-architected.
- Allocation Category Manager UI lives on the Roster page alongside the Team Member list, per `EXPERIENCE.md`.
- No confirm-before-destructive dialog for category removal — `EXPERIENCE.md`'s confirm-before-destructive requirement names only Remove Team Member and Close Sprint, not category removal; don't add one speculatively.

**Ask First:**
- _None known._

**Never:**
- No `TeamMemberAllocation` join table or Allocation % logic yet — that's Story 1.5. Don't create it early even defensively.
- No in-use removal guard in this story (see above) — it would have nothing to check against and risks inventing a schema shape Story 1.5 should own.
- No raw Prisma calls from `app/` — goes through `domain/allocation.ts`, same as Stories 1.2/1.3.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH_ADD | Valid category name | Category created, appears in the list immediately | N/A |
| HAPPY_PATH_RENAME | Existing category id + new valid name | Name updated | N/A |
| MISSING_NAME | Blank/whitespace-only name on add or rename | Rejected | `{ok:false, error}`, no record created/changed |
| NOT_FOUND | Rename or remove targeting a nonexistent id | Rejected | `{ok:false, error}`, not an unhandled throw |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` — has `TeamMember` (Stories 1.2/1.3). Add `AllocationCategory` alongside it.
- `domain/allocation.ts` — has `TeamMember`/`TeamMemberRepo`/`addTeamMember`/`archiveTeamMember`. Add `AllocationCategory`/`AllocationCategoryRepo`/`addAllocationCategory`/`renameAllocationCategory`/`removeAllocationCategory` in the same file.
- `infrastructure/db/team-member-repository.ts` — existing pattern to mirror; new file `infrastructure/db/allocation-category-repository.ts` is the sibling for this aggregate.
- `app/actions/team-members.ts` — existing pattern to mirror; new file `app/actions/allocation-categories.ts` for this aggregate's actions.
- `app/(pm)/roster/page.tsx` — currently renders the Team Member list + add form. Add an Allocation Categories section alongside it.

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma` -- add `model AllocationCategory { id, name }`; run `npx prisma migrate dev --name add_allocation_category`.
- [x] `domain/allocation.ts` -- add `AllocationCategory` type, `AllocationCategoryRepo` port, and `addAllocationCategory`/`renameAllocationCategory`/`removeAllocationCategory` functions (validate name on add/rename; reject rename/remove of a nonexistent id).
- [x] `infrastructure/db/allocation-category-repository.ts` -- implement `AllocationCategoryRepo` against Prisma (`create`, `list`, `rename` via atomic conditional update returning `null` on no match -- same pattern as `TeamMemberRepo.archive` --, `remove`).
- [x] `app/actions/allocation-categories.ts` -- `addAllocationCategoryAction`, `renameAllocationCategoryAction`, `removeAllocationCategoryAction`, mirroring `team-members.ts`'s error-handling shape (type-guarded input, try/catch, sanitized error, isolated `revalidatePath`).
- [x] `app/(pm)/roster/page.tsx` (+ new small components as needed) -- Allocation Categories section: list with inline rename and a remove action, plus an add form.

**Acceptance Criteria:**
- Given I add a new Allocation Category (e.g. "DevOps"), then it appears in the category list immediately and is available for future Team Member allocation (Story 1.5).
- Given I rename an existing category, then the new name is reflected wherever the category is displayed (trivially true today since nothing else stores a copy of the name).
- Given I try to add or rename a category to a blank/whitespace-only name, then the system rejects it with a validation error.
- Given I attempt to rename or remove a category id that doesn't exist, then it's rejected with a clear error rather than crashing.

## Spec Change Log

## Design Notes

This is the third data point for the ports-and-adapters pattern (after Team Member create/archive) — same shape, different aggregate, reusing the atomic conditional-update trick from Story 1.3's race fix for `rename` (an update scoped to `where: { id }` that returns `null` if the row doesn't exist, rather than throwing). The one deliberate scope boundary: `removeAllocationCategory` has no in-use guard yet because nothing can be "in use" until Story 1.5 exists — that story will need to add a check (e.g. "does any `TeamMemberAllocation` reference this category id") before allowing removal, turning today's unconditional remove into a guarded one.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: no type errors.
- `npx prisma validate` -- expected: schema valid.
- `npm run lint` -- expected: clean.
- `npx prisma migrate dev --name add_allocation_category` -- expected: migration applies against the live Supabase connection.
- `npm run dev` + manually: add a category, rename it, attempt to add/rename with a blank name (rejected), attempt to rename/remove a nonexistent id (rejected), remove a category (disappears from the list).

**Results (this pass):**
- `npx tsc --noEmit`, `npx prisma validate`, `npm run lint` — all clean.
- `npx prisma migrate dev --name add_allocation_category` — applied against the live Supabase connection.
- HAPPY_PATH_ADD, MISSING_NAME, HAPPY_PATH_RENAME — verified via Playwright against the real UI: added "DevOps," rejected a whitespace-only name, renamed "DevOps" → "Platform Engineering" inline.

**Post-review patch pass:** Three review layers independently flagged the same bug — `allocation-category-repository.ts`'s original `rename` used `updateMany` (count check) + a separate `findUniqueOrThrow`, which could throw uncaught `P2025` if the row was deleted between those two calls, inconsistent with `remove`'s own `delete` + catch-`P2025` pattern. Fixed by replacing it with a single `update()` wrapped in the same try/catch shape as `remove`. Verification Gap review also caught that the original NOT_FOUND checks only ran against a throwaway in-memory fake repo, never the real Prisma-backed one — re-verified properly against the live database, including the exact race window the fix targets (create → remove → immediately rename/remove the same now-gone id): both correctly returned `{ok:false, error:"Category not found"}` with no throw. 6 additional UI patches applied to `allocation-category-row.tsx`: input disabled while pending, draft/error reset when entering edit mode, error cleared at the start of each action, Enter-to-save/Escape-to-cancel keyboard support, and an accessible label on the editing input. 3 findings deferred (see `deferred-work.md`): duplicate category names (extends the existing Team Member duplicate-name question), audit timestamps, and the minor UI-flash/stale-error timing gap. Full Verification section re-run after patching — all commands still pass.

## Suggested Review Order

**Infrastructure: the fixed race**

- `rename` and `remove` now share the identical `update`/`delete` + catch-`P2025` shape — the fix, and why it's now consistent.
  [`allocation-category-repository.ts:14`](../../infrastructure/db/allocation-category-repository.ts#L14)

**Domain: the third data point for the pattern**

- Same framework-free, repo-as-parameter, discriminated-result shape as `addTeamMember`/`archiveTeamMember`, now for a second aggregate.
  [`allocation.ts:111`](../../domain/allocation.ts#L111)

- The deliberately unconditional remove — the `ponytail:` comment marking exactly where Story 1.5's in-use guard goes.
  [`allocation.ts:154`](../../domain/allocation.ts#L154)

**Server Actions**

- Mirrors `team-members.ts`'s error-handling shape from Stories 1.2/1.3.
  [`allocation-categories.ts:14`](../../app/actions/allocation-categories.ts#L14)

**UI: five review fixes live here**

- Start here — `handleRename`/`handleRemove`, the extracted `cancelEditing`, and the keyboard handler.
  [`allocation-category-row.tsx:16`](../../app/(pm)/roster/allocation-category-row.tsx#L16)

- The editing input: `disabled` while pending, `aria-label`, keyboard support.
  [`allocation-category-row.tsx:65`](../../app/(pm)/roster/allocation-category-row.tsx#L65)

**Peripheral**

- Where the new Allocation Categories section attaches to the existing Roster page.
  [`page.tsx:42`](../../app/(pm)/roster/page.tsx#L42)
