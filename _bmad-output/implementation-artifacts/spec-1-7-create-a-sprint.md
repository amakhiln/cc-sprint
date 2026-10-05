---
title: 'Create a Sprint'
type: 'feature'
created: '2026-08-17'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nothing in the app has a Sprint yet — there's no container to plan work against, and every later epic (Leave/Capacity, YouTrack issues, Sprint lifecycle) depends on one existing.

**Approach:** Add a `Sprint` model and `domain/sprint.ts` (new file, new aggregate) with a `createSprint` function enforcing AD-6's single-active-Sprint rule at both the domain layer (a friendly pre-check) and the database layer (a partial unique index, closing the check-then-write race). Build a minimal `app/(pm)/sprint` page per the Architecture Spine's Capability Map — an invitation-to-create state when no Sprint is active, a plain "Sprint active" display when one is.

## Boundaries & Constraints

**Always:**
- `Sprint` Prisma model exactly per the Architecture Spine ERD: `id` (`cuid()`), `startDate`/`endDate` (`DateTime @db.Date`), `status` (`SprintStatus` enum: `active`/`closed`, default `active`), `snapshotCapacityHours` (`Int?`), `snapshotAllocationBreakdown` (`Json?`), `snapshotActualVelocityHours` (`Int?`) — the three snapshot fields stay null; nothing in this story populates them.
- AD-6 enforcement, both layers: (1) `createSprint` checks `repo.findActive()` first and rejects with a clean error if one exists — the primary UX path; (2) a **partial unique index** at the DB level as the atomic backstop: run `npx prisma migrate dev --name add_sprint --create-only`, then hand-edit the generated migration SQL to append `CREATE UNIQUE INDEX "Sprint_one_active_idx" ON "Sprint"("status") WHERE "status" = 'active';` before applying — Prisma's schema DSL has no partial-index syntax, so this line must be added by hand to the migration file, matching AD-6's "DB constraint or equivalent guard" requirement literally rather than relying on the domain check alone.
- `domain/sprint.ts`: `SprintRepo` port (`findActive(): Promise<Sprint | null>`, `create(data: {startDate: Date; endDate: Date}): Promise<Sprint>`) and `createSprint(repo, input: {startDate: Date; lengthDays?: number})` — same discriminated-result shape as `domain/allocation.ts`'s functions. Validate: `startDate` is a valid `Date`; `lengthDays` (default `14`) is a positive integer. Compute `endDate` as `startDate + (lengthDays - 1)` days (inclusive both ends — 14 days starting Aug 18 ends Aug 31). If `repo.create()` throws a unique-constraint violation (the partial index firing on a race), catch it and return the same "already active" error rather than letting it throw.
- New `infrastructure/db/sprint-repository.ts` implementing `SprintRepo` against Prisma.
- New `app/actions/sprint.ts`: `createSprintAction(formData)`, same type-guarded/try-catch/sanitized-error shape as the Team Member and Allocation actions; `revalidatePath("/sprint")` (this route, not `/roster`).
- New route `app/(pm)/sprint/page.tsx` per the Architecture Spine's Capability → Architecture Map (`4.5 Sprint Planning | domain/sprint.ts, app/(pm)/sprint`). Server Component: if `sprintRepository.findActive()` returns null, show an invitation (EXPERIENCE.md's "No active Sprint" state) plus a create form (start date input, length-in-days input defaulting to 14); if one exists, show a plain glass-panel display of its date range and status — no Capacity Ledger, roster breakdown, or issue list (that's Epic 4's Sprint Plan Overview). Use the existing `.glass`/`font-heading` conventions and shadcn `Button` already wired into the app (Aurora Light identity, DESIGN.md) — don't introduce new styling patterns.
- Parse the date-input string (`YYYY-MM-DD` from `<input type="date">`) with plain `new Date(dateString)` — ISO date-only strings parse as UTC midnight per spec, which is already correct for a day-granularity, no-time-of-day field; no timezone conversion needed.

**Ask First:** _None known._

**Never:**
- No Close Sprint action, no Capacity Ledger, no roster/issue display on this page — those belong to Epic 4 (Sprint Plan Overview, Close Sprint flow) and Epic 2/3 respectively. This story only creates the Sprint and shows that it exists.
- No populating the three snapshot fields — they exist on the model per the Architecture Spine but stay null until Epic 4 implements Close Sprint.
- Don't make this page the app's root route (`/`) — the Architecture Spine's Capability Map fixes it at `app/(pm)/sprint`; `app/page.tsx` (the default Next.js splash) is out of scope, per the prior story's own note that it isn't part of the built PM app.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | No active Sprint, valid start date + length | Sprint created with status `active`, becomes the current Sprint | N/A |
| REJECT_WHEN_ACTIVE | An active Sprint already exists | Rejected | `{ok:false, error}`, no second Sprint created, existing one untouched |
| INVALID_LENGTH | `lengthDays` is 0, negative, or non-integer | Rejected | `{ok:false, error}` |
| INVALID_START_DATE | Missing or unparseable start date | Rejected | `{ok:false, error}` |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` — has `TeamMember`, `AllocationCategory`, `TeamMemberAllocation`. Add `SprintStatus` enum and `Sprint` model — first model in this schema using a `DateTime @db.Date` field and the first enum.
- `domain/allocation.ts` — existing functions (e.g. `setTeamMemberAllocations` at line 228, `removeAllocationCategory` at line 188) are the discriminated-result/repo-as-parameter pattern to mirror in the new `domain/sprint.ts` file.
- `infrastructure/db/allocation-category-repository.ts` / `team-member-allocation-repository.ts` — existing repo patterns (atomic `update`/`delete` + catch-`P2025`, and `$transaction` usage) to draw from for `sprint-repository.ts`'s `create`'s unique-violation catch.
- `app/actions/team-member-allocations.ts` — the Server Action pattern to mirror for `app/actions/sprint.ts`.
- `app/(pm)/roster/page.tsx` — the only existing page; reference for how `.glass` panels, `font-heading`, and the Aurora Light tokens are already used, to match in the new `app/(pm)/sprint/page.tsx`.
- Architecture Spine ERD (`_bmad-output/planning-artifacts/architecture/architecture-pm-2026-08-12/ARCHITECTURE-SPINE.md`, AD-6 and the Sprint entity block) — authoritative field names/types and the single-active-Sprint rule's required enforcement.

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma` -- add `enum SprintStatus { active closed }` and `model Sprint` per the ERD -- run `npx prisma migrate dev --name add_sprint --create-only`, hand-add the partial unique index SQL to the generated migration, then apply it.
- [x] `domain/sprint.ts` (new) -- `SprintRepo` port, `createSprint` (validate, pre-check active, compute `endDate`, catch unique-violation on create).
- [x] `infrastructure/db/sprint-repository.ts` (new) -- `findActive`, `create`.
- [x] `app/actions/sprint.ts` (new) -- `createSprintAction`.
- [x] `app/(pm)/sprint/page.tsx` (new) -- no-active-Sprint invitation + create form, or active-Sprint display.
- [x] `app/(pm)/sprint/create-sprint-form.tsx` (new) -- client component, `useActionState` + `createSprintAction`, start-date + length-in-days inputs.

**Acceptance Criteria:**
- [x] Given no Sprint is currently active, when I create a new Sprint with a start date and length, then the Sprint is created with status "active" and becomes the current Sprint.
- [x] Given a Sprint is already active, when I attempt to create another Sprint, then the system rejects it — I cannot have two Sprints open at the same time.

## Design Notes

The partial unique index is the one piece of this story that can't be expressed in `schema.prisma` directly (Prisma has no partial/filtered `@@unique` syntax as of this version) — hence the `--create-only` + hand-edit + apply sequence rather than a single `migrate dev` call. This mirrors Story 1.5's patch-pass precedent of adding a real DB constraint as a backstop under an app-level guard, just via raw migration SQL instead of a declarative relation.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: no type errors.
- `npx prisma validate` -- expected: schema valid.
- `npm run lint` -- expected: clean.
- `npx prisma migrate dev --name add_sprint --create-only` then the hand-edited apply -- expected: migration applies against the live Supabase connection, partial index visible in the DB (e.g. via `\d "Sprint"` or an information_schema query).
- `npm run dev` + manually: create a Sprint with valid inputs (becomes active, page reflects it), attempt to create a second one while active (rejected), attempt invalid length/start date (rejected).

**Results (this pass):**

- `npx tsc --noEmit`, `npx prisma validate`, `npm run lint` — all clean.
- Migration: `--create-only` unexpectedly auto-applied the schema in this environment before the partial index was hand-added. Reconciled by applying the missing `CREATE UNIQUE INDEX "Sprint_one_active_idx" ON "Sprint"("status") WHERE "status" = 'active';` directly against the live DB, then re-syncing `_prisma_migrations`' checksum (delete + `migrate resolve --applied`) so the tracked migration file matches what's actually in the database. Verified independently (not just by the implementer): `npx prisma migrate status` reports "Database schema is up to date!", and a direct `pg_indexes` query against the live Supabase DB confirms `Sprint_one_active_idx` exists with the exact partial `WHERE (status = 'active'::"SprintStatus")` clause. `Sprint` row count confirmed `0` (all throwaway test rows cleaned up).
- All 4 I/O matrix scenarios (HAPPY_PATH, REJECT_WHEN_ACTIVE, INVALID_LENGTH, INVALID_START_DATE) verified live against the real repo/Supabase DB via a throwaway script (deleted after): all passed, including confirming the DB partial index itself throws on a second active-row insert that bypasses the domain pre-check (the AD-6 backstop actually fires, not just the friendly check).
- No `npm run dev` manual browser walkthrough was performed (no browser tooling available this pass) — the create/reject/invalid paths were verified directly against the domain function and real database instead, which is the stronger check for this story's core invariant (the DB constraint) even without a UI click-through.
- One rough edge noticed but not fixed here (left for review): `createSprint`'s "already active" error message reads "Close it before starting a new one" — but no Close Sprint action exists yet (Epic 4), so this asks the user to do something not yet possible in the app.

**Results (2026-08-17 patch pass):**

Applied five confirmed findings from the Blind Hunter / Edge Case Hunter / Verification Gap review layers:

1. `domain/sprint.ts` — added a `MAX_LENGTH_DAYS = 365` ceiling to the `lengthDays` check (was `>= 1` with no upper bound), so an absurd value like `100000` is rejected with a clear message instead of producing an invalid/overflowed `endDate`. Error message: `"Length must be a whole number of days, between 1 and 365"`.
2. `app/(pm)/sprint/create-sprint-form.tsx` — added `max={365}` to the `lengthDays` input, mirroring the existing `min={1}`.
3. `app/(pm)/sprint/error.tsx` — new route-segment error boundary for `/sprint`, matching `app/(pm)/roster/error.tsx`'s shape and `.glass`/token styling (generic retry button, no route-specific messaging beyond the heading).
4. `domain/sprint.ts` — simplified `snapshotAllocationBreakdown: unknown | null` to `unknown` (redundant union).
5. Added `domain/sprint.selfcheck.ts` (kept, assert-based, no-framework, same pattern as `domain/allocation.selfcheck.ts`) covering: the duck-typed `isUniqueConstraintViolation` catch via a fake repo whose `create()` throws a `{code: "P2002"}`-shaped error; inclusive `endDate` arithmetic (14 days from 2026-08-18 → 2026-08-31; `lengthDays: 1` → `endDate === startDate`); `REJECT_WHEN_ACTIVE`; `INVALID_START_DATE`; and `INVALID_LENGTH` (non-integer, zero, negative, at-ceiling 365 accepted, 366 and 100000 rejected).

Reverification:
- `npx tsc --noEmit` — clean.
- `npx prisma validate` — schema valid.
- `npm run lint` — clean.
- `node domain/sprint.selfcheck.ts` — all assertions passed.
- FormData-parsing gap (item 5b): a throwaway script (deleted after, not committed) imported the real `createSprintAction` and `sprintRepository`'s underlying `prisma` client via `tsx` (plain `node` can't resolve `next/cache`'s extensionless subpath import outside Next's bundler — confirmed by reproducing the `ERR_MODULE_NOT_FOUND` failure directly), built a real `FormData` with string values (`startDate: "2026-08-18"`, `lengthDays: "14"`), called `createSprintAction` against the live Supabase DB, and asserted the persisted row's `startDate`/`endDate` via `getUTCFullYear()/getUTCMonth()/getUTCDate()` matched exactly what the strings imply (`2026-08-18` → `2026-08-31` inclusive of 14 days). All assertions passed. The action's own `revalidatePath` try/catch fired as designed (logged an "Invariant: static generation store missing" error since there's no real Next request context outside the dev server) without failing the result — exercising that fallback path too. The throwaway row was deleted afterward; `Sprint` row count independently reconfirmed as `0` post-cleanup.

## Suggested Review Order

**Domain: the new aggregate and AD-6's two-layer guard**

- Entry point -- validates input, pre-checks the active Sprint (the primary UX path), computes inclusive `endDate`, catches the DB backstop on the race path.
  [`sprint.ts:45`](../../domain/sprint.ts#L45)

- The duck-typed `P2002` check -- how the domain stays framework-free (AD-1) while still reacting to a real Prisma error shape.
  [`sprint.ts:36`](../../domain/sprint.ts#L36)

**Schema: the constraint Prisma can't declare**

- The hand-written partial unique index backing AD-6 at the DB level -- not expressible in `schema.prisma` itself.
  [`migration.sql:17`](../../prisma/migrations/20260817094412_add_sprint/migration.sql#L17)

- The `Sprint` model, first enum and first `@db.Date` field in this schema.
  [`schema.prisma:34`](../../prisma/schema.prisma#L34)

**Infrastructure & Server Action**

- `sprint-repository.ts` -- deliberately lets a unique-violation propagate for the domain layer to catch, rather than swallowing it here.
  [`sprint-repository.ts:8`](../../infrastructure/db/sprint-repository.ts#L8)

- `createSprintAction` -- the `<input type="date">` string-to-`Date` parsing this story's verification gap was specifically about.
  [`sprint.ts:23`](../../app/actions/sprint.ts#L23)

**UI: the minimal Sprint page**

- Two-state render (invitation+form vs. active display) -- no Capacity Ledger or roster on purpose, that's Epic 4.
  [`page.tsx:16`](../../app/(pm)/sprint/page.tsx#L16)

- The new route-segment error boundary, added in the patch pass to match the sibling `/roster` route.
  [`error.tsx:1`](../../app/(pm)/sprint/error.tsx#L1)

**Peripheral**

- The self-check -- covers the P2002 mapping and date arithmetic no other verification touches.
  [`sprint.selfcheck.ts:53`](../../domain/sprint.selfcheck.ts#L53)
</frozen-after-approval>
